#!/usr/bin/env python3
"""PR 검증기. GitHub Actions의 pull_request_target 이벤트에서 통합 브랜치 판으로 실행한다.

규칙 설명은 docs/03-pull-request.md. 브랜치 이름과 PR 본문은 신뢰할 수 없는 입력이므로
셸을 거치지 않고 이벤트 파일에서 읽는다.
"""
import importlib.machinery
import importlib.util
import json
import os
import re
import subprocess
import sys
import unicodedata
import urllib.request
from pathlib import Path

COMMON = ("업무", "변경 목적", "영향 범위", "검증 결과", "위험도", "롤백 방안")
PROMOTION = ("포함 PR", "변경 목적", "영향 범위", "검증 결과", "위험도", "롤백 방안", "승인")
REMOVAL_LABEL = "marker-removal-approved"

# GitHub 렌더링과 같게 1~3칸 들여쓴 제목도 칸으로 친다. 4칸부터는 코드 블록이다.
# `\s+`와 `\S`가 겹치지 않아 선형이다. `(.+?)\s*$`는 긴 공백 줄에서 이차 시간이라 남이 쓴 코멘트로 job을 멈출 수 있다.
HEADING = re.compile(r"^ {0,3}##\s+(\S.*)$")
FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")
# 목록 항목 안의 펜스는 항목이 끝나면 닫힌다. 항목 내용이 시작하는 칸을 잰다. 구분선(`- - -`)은 항목이 아니다.
LIST_ITEM = re.compile(r"^( {0,3})([-*+]|\d{1,9}[.)])( +|$)")
THEMATIC_BREAK = re.compile(r"^ {0,3}([-*_])(?: *\1){2,} *$")
# 칸을 채운 것으로 치지 않는 줄: 목록 기호와 체크박스를 뗀 나머지가 비었거나 `<안내문>` 하나뿐인 줄.
BULLET = re.compile(r"^(?:[-*+]|\d+[.)])(?:\s+\[[ xX]?\])?(?:\s+|$)")
PLACEHOLDER = re.compile(r"^<[^<>]*>$")
PLACEHOLDER_ROW = re.compile(r"^<[^<>]*>(?:\s*:\s*<[^<>]*>)+$")
HTML_TAG = re.compile(r"^</?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?/?>$")  # `<br>`, `<img …>`, `<details>`는 안내문이 아니다.
EMPTY_MESSAGE = "(빈 메시지)"
# Ready PR의 `[ ]` 항목은 `: ` 뒤를 확인 시점 어휘로 시작해야 한다(03 완료 조건 체크리스트).
PENDING = ("병합 뒤", "승격 뒤", "설정 뒤")
# 인용문 안의 항목도 GitHub에서 체크박스다.
UNCHECKED = re.compile(r"^\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[ \](?:\s(.*))?$")
# `병합 뒤처리`처럼 어휘에 글자를 붙여 다른 낱말이 되면 인정하지 않는다. 조사 `에`는 붙일 수 있다.
PENDING_START = re.compile(rf"^(?:{'|'.join(PENDING)})(?!(?!에)[가-힣]|[A-Za-z0-9])")


def load_rules():
    """훅과 판정이 어긋나지 않게 확장자 없는 commit-msg를 그대로 불러온다."""
    sys.dont_write_bytecode = True
    path = Path(__file__).with_name("commit-msg")
    loader = importlib.machinery.SourceFileLoader("commit_msg", str(path))
    module = importlib.util.module_from_spec(importlib.util.spec_from_loader(loader.name, loader))
    loader.exec_module(module)
    return module


def git(*args):
    return subprocess.run(
        ["git", *args], capture_output=True, encoding="utf-8", errors="replace"
    )


def has_marker(rules, rev):
    return git("cat-file", "-t", f"{rev}:{rules.MARKER}").stdout.strip() == "blob"


def strip_inline(line, closes_later):
    """줄 중간의 주석을 지운다. 인라인 코드 안은 그대로 둔다. (보이는 글자, 다음 줄로 이어지는 주석이 열렸는지)를 돌려준다.

    `<!-->`와 `<!--->`도 닫힌 주석이다(GitHub). 닫히지 않은 `<!--`는 뒤 줄에 `-->`가 없으면 글자로 남는다.
    """
    parts, position, start, tick = [], 0, line.find("<!--"), line.find("`")
    while True:
        if 0 <= start < position:
            start = line.find("<!--", position)
        if 0 <= tick < position:
            tick = line.find("`", position)
        if 0 <= tick and (start < 0 or tick < start):
            run = re.compile("`+").match(line, tick).end() - tick
            close = re.compile(f"(?<!`)`{{{run}}}(?!`)").search(line, tick + run)
            parts.append(line[position:close.end() if close else tick + run])
            position = close.end() if close else tick + run
            continue
        end = line.find("-->", start + 2) if start >= 0 else -1
        if end >= 0:
            parts.append(line[position:start])
            position = end + 3
            continue
        if start >= 0 and closes_later:
            parts.append(line[position:start])
            return "".join(parts), True
        parts.append(line[position:])
        return "".join(parts), False


def fence_open(line):
    """코드 펜스를 여는 줄이면 (문자, 길이)를 돌려준다. 백틱 펜스의 정보 문자열에는 백틱이 없어야 한다."""
    match = FENCE.match(line)
    if not match or (match.group(1)[0] == "`" and "`" in match.group(2)):
        return None
    return match.group(1)[0], len(match.group(1))


def fence_closes(line, fence):
    match = FENCE.match(line)
    return bool(match) and not match.group(2).strip() and match.group(1)[0] == fence[0] and len(match.group(1)) >= fence[1]


def parse(body):
    """(`## 제목`별 내용, 닫히지 않아 본문 끝까지 숨긴 줄 맨 앞 `<!--`의 줄 번호)를 돌려준다.

    GitHub 화면과 같게 주석은 내용으로 치지 않고, 코드 펜스 안의 줄과 줄 맨 앞 주석이 있는 줄은 제목으로 치지 않는다.
    """
    return scan(body)[:2]


def scan(body):
    """parse()에 더해 칸마다 코드 펜스에 속한 줄(경계 포함)의 번호 집합을 돌려준다. 펜스 판정을 한 곳에 둔다."""
    lines = unicodedata.normalize("NFC", body or "").splitlines()
    # 줄마다 같은 문단의 뒤 줄에 `-->`가 있는지. 빈 줄에서 문단이 끝나면 줄 중간 주석도 닫히지 않는다. 본문 길이에 비례해 끝난다.
    closes_later, later = [False] * len(lines), False
    for index in range(len(lines) - 1, -1, -1):
        closes_later[index], later = later, bool(lines[index].strip()) and (later or "-->" in lines[index])
    found, current, fence, items, comment, hidden, paragraph = {}, None, None, [], False, None, False
    fenced, count = {}, {}

    def add(text, in_fence=False):
        if in_fence:
            fenced.setdefault(current, set()).add(count.get(current, 0))
        count[current] = count.get(current, 0) + 1
        found[current] += text + "\n"
    for number, line in enumerate(lines, start=1):
        indent, is_text = len(line) - len(line.lstrip(" ")), False
        if comment:
            end = line.find("-->")
            if end < 0:
                continue
            rest, hidden = line[end + 3:], None
        elif fence and not (line.strip() and indent < fence[2]):
            if fence_closes(line, fence):
                fence = None
            if current:
                add(line, True)
            continue
        else:
            fence = None
            if line.strip():
                in_list = bool(items)
                while items and indent < items[-1]:
                    items.pop()
                item = None if THEMATIC_BREAK.match(line) else LIST_ITEM.match(line)
                # 문단 바로 다음 줄은 내용이 있는 `-`, `*`, `+`, `1.`만 새 목록을 연다(GitHub). `2. x`와 빈 `-`는 문단이다.
                if item and (in_list or not paragraph or (line[item.end():].strip() and item.group(2)[:-1] in ("", "1"))):
                    spaces = len(item.group(3))
                    items.append(len(item.group(1)) + len(item.group(2)) + (spaces if 1 <= spaces <= 4 else 1))
            if opened := fence_open(line):
                fence, paragraph = (*opened, items[-1] if items else 0), False
                if current:
                    add(line, True)
                continue
            if indent <= 3 and line[indent:].startswith("<!--"):  # GitHub의 HTML 블록. 이 줄은 제목이 아니다.
                end = line.find("-->", indent + 2)
                if end < 0:
                    comment, hidden, paragraph = True, (number, current), False
                    continue
                rest = line[end + 3:]
            else:
                rest, is_text = line, True
        visible, comment = strip_inline(rest, closes_later[number - 1])
        heading = is_text and HEADING.match(visible)
        paragraph = is_text and not heading and bool(visible.strip())
        if heading:
            current = heading.group(1).rstrip()
            found.setdefault(current, "")
        elif current:
            add(visible)
    return found, hidden, fenced


def sections(body):
    return parse(body)[0]


def is_placeholder(text):
    return bool(PLACEHOLDER.match(text)) and not HTML_TAG.match(text) and "://" not in text and "@" not in text


def is_placeholder_line(text):
    """줄 전체가 자리표시 하나이거나, `<조건>: <근거>`처럼 자리표시를 `:`로만 이은 줄은 안내문이다."""
    if is_placeholder(text):
        return True
    return bool(PLACEHOLDER_ROW.match(text)) and all(is_placeholder(token) for token in re.findall(r"<[^<>]*>", text))


def has_content(text):
    """안내문, 목록 기호, 빈 체크박스, 코드 펜스 경계만 있는 칸은 비어 있다. 펜스 안의 줄은 그대로 내용이다."""
    fence = None
    for line in text.splitlines():
        if fence:
            if fence_closes(line, fence):
                fence = None
            elif line.strip():
                return True
            continue
        if opened := fence_open(line):
            fence = opened
            continue
        rest = BULLET.sub("", line.strip(), count=1).strip()
        if rest and not is_placeholder_line(rest):
            return True
    return False


def check_body(body, required, kind="본문"):
    """빠진 칸마다 오류. 닫히지 않은 줄 맨 앞 `<!--`가 칸을 숨겼으면 그 줄을 알려 준다."""
    found, hidden = parse(body)
    empty = [name for name in required if not has_content(found.get(name, ""))]
    errors = [f"{kind} 칸이 비어 있음: {name}" for name in empty]
    if hidden and any(name not in found or name == hidden[1] for name in empty):
        errors.append(f"{hidden[0]}번째 줄의 `<!--`가 닫히지 않아 그 아래가 모두 숨겨짐. `-->`로 닫는다")
    return errors


def drop_inline_code(text):
    """인라인 코드를 지운다. 정규식 역추적 없이 백틱 run마다 같은 길이의 닫는 run을 한 번만 찾는다."""
    parts, position = [], 0
    while (tick := text.find("`", position)) >= 0:
        run = re.compile("`+").match(text, tick).end() - tick
        close = re.compile(f"(?<!`)`{{{run}}}(?!`)").search(text, tick + run)
        parts.append(text[position:tick] if close else text[position:tick + run])
        position = close.end() if close else tick + run
    return "".join(parts) + text[position:]


def check_pending(body):
    """`검증 결과`의 `[ ]` 중 첫 `: ` 바로 뒤가 확인 시점 어휘가 아닌 항목마다 오류.

    인라인 코드 안의 `: `와 어휘는 보지 않는다. 펜스 판정은 본문 칸 판정(scan)과 같다.
    """
    found, _, fenced = scan(body)
    errors, skip = [], fenced.get("검증 결과", set())
    for index, line in enumerate(found.get("검증 결과", "").splitlines()):
        match = None if index in skip else UNCHECKED.match(line)
        if not match:
            continue
        text = (match.group(1) or "").strip()
        _, colon, rest = drop_inline_code(text).partition(": ")
        if not (colon and PENDING_START.match(rest.lstrip())):
            errors.append(f"Ready PR의 검증 결과에 확인 시점 없는 `[ ]` 항목: {text!r}. "
                          f"근거를 붙여 `[x]`로 바꾸거나, PR에서 판정할 수 없는 조건이면 첫 `: ` 바로 뒤를 "
                          f"{', '.join(PENDING)} 중 하나로 시작한다(`병합 뒤처리`처럼 붙여 쓰지 않음). 근거를 붙일 수 없으면 Draft로 두고 보고한다(05 Ready 전 멈춤)")
    return errors


def is_hotfix(rules, branch):
    match = rules.TASK_BRANCH.match(branch)
    return bool(match) and match.group(1) == "hotfix"


def same_repository(pr):
    """head가 base와 같은 저장소의 브랜치인지. 정보가 없거나 fork가 지워졌으면 다른 저장소로 본다."""
    base_repo = (pr["base"].get("repo") or {}).get("full_name")
    head_repo = (pr["head"].get("repo") or {}).get("full_name")
    return base_repo is not None and base_repo == head_repo


def check_target(rules, base_ref, head_ref, deploy, integration, internal):
    if base_ref != deploy or (internal and (head_ref == integration or is_hotfix(rules, head_ref))):
        return []
    return [f"배포 브랜치로 가는 PR은 hotfix와 승격뿐이다: {head_ref} → {base_ref}"]


def commits(base, head):
    """(SHA, 부모 수, 메시지) 목록. 메시지에 나올 수 없는 NUL로 커밋을 나눈다."""
    found = []
    for record in git("log", "-z", "--format=%H %P%n%B", f"{base}..{head}").stdout.split("\0"):
        if record:
            line, _, message = record.partition("\n")
            sha, *parents = line.split()
            found.append((sha, len(parents), message))
    return found


def as_recorded(message):
    """check()는 작성 중인 메시지를 전제하므로 확정된 메시지에 맞게 고친다.

    확정된 메시지의 `#` 줄은 주석이 아니다. 앞에 공백을 넣으면 주석 제거를 피한다.
    """
    message = re.sub(r"^#", " #", message, flags=re.M)
    return message if message.strip() else EMPTY_MESSAGE


def is_revert(rules, message):
    """`git revert`는 훅을 거치지 않으므로 사람이 만든 되돌리기 커밋은 형식과 `Refs`를 검사하지 않는다."""
    return bool(rules.GENERATED["revert"].match(message))


def check_commits(rules, base, head, branch):
    """브랜치를 넣어야만 나오는 위반이 `Refs`이고 나머지는 형식 위반이다.

    부모가 2개 이상일 때만 git이 만든 merge 메시지로 본다. `fixup!` 같은 접두어는 인정하지 않는다(05 Rework).
    """
    errors, warnings = [], []
    for sha, parents, raw in commits(base, head):
        if is_revert(rules, raw):
            if rules.AI_ATTRIBUTION.search(raw):
                warnings.append(f"{sha[:7]}: AI 작성 표기 금지 (Co-Authored-By: Claude 등)")
            continue
        message, generated = as_recorded(raw), ("merge",) if parents >= 2 else ()
        form = rules.check(message, "", generated)
        errors += [f"{sha[:7]}: {e}" for e in rules.check(message, branch, generated) if e not in form]
        warnings += [f"{sha[:7]}: {w}" for w in form]
    return errors, warnings


def check_marker(rules, base, head, labels):
    """분기 시점에 있던 표식이 사라진 경우만 삭제다. 표식 전에 분기한 브랜치는 해당 없다."""
    fork = git("merge-base", base, head).stdout.strip()
    if not has_marker(rules, fork) or has_marker(rules, head) or REMOVAL_LABEL in labels:
        return []
    return [f"`{rules.MARKER}` 삭제는 담당자 결정이 필요함. 결정했으면 `{REMOVAL_LABEL}` 라벨을 붙임"]


def fetch_json(path):
    """저장소 API 경로의 JSON. Actions 밖(GITHUB_REPOSITORY 없음)이면 None, 조회에 실패하면 False."""
    repository = os.environ.get("GITHUB_REPOSITORY")
    if not repository:
        return None
    api = os.environ.get("GITHUB_API_URL", "https://api.github.com")
    request = urllib.request.Request(f"{api}/repos/{repository}/{path}")
    request.add_header("Accept", "application/vnd.github+json")
    if os.environ.get("GITHUB_TOKEN"):
        request.add_header("Authorization", f"Bearer {os.environ['GITHUB_TOKEN']}")
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.load(response)
    except Exception:  # 잘린 응답(http.client 예외)까지 모든 실패를 경고로 돌려 다른 PR을 막지 않는다.
        return False


def fetch_pages(path):
    """목록 API의 모든 쪽. Actions 밖이면 None, 조회에 실패하면 False."""
    items = []
    for page in range(1, 51):  # 5천 건이면 충분하고, 끝없는 응답에 job 시간을 다 쓰지 않는다.
        batch = fetch_json(f"{path}?per_page=100&page={page}")
        if batch is None:
            return None
        if not isinstance(batch, list):
            return False
        items += batch
        if len(batch) < 100:
            return items
    return False


def fetch_issue(number):
    """Actions 밖이면 None, 조회에 실패하면 False, 성공하면 Issue JSON."""
    return fetch_json(f"issues/{number}")


def check_issue(number, fetch=fetch_issue, hotfix_second=False):
    """병합되거나 중단한 Task의 번호로 브랜치를 다시 만들었는지 본다(01 B6). 조회 실패는 다른 PR을 막지 않게 경고만 낸다.

    `hotfix_second`는 hotfix 브랜치에서 통합 브랜치로 가는 PR(hotfix 둘째 PR)이다. 판정은 같고 안내만 더한다(#163).
    """
    issue = fetch(number)
    if issue is None:
        return [], []
    if not isinstance(issue, dict):
        return [], [f"Issue #{number}의 상태를 조회하지 못해 번호 재사용 검사를 건너뜀. 워크플로의 `issues: read` 권한을 확인"]
    if "pull_request" in issue:
        return [f"브랜치 번호가 Issue가 아니라 PR을 가리킴(#{number}). Task 브랜치에는 Issue 번호를 쓴다"], []
    if issue.get("state") == "closed":
        message = (f"브랜치 번호의 Issue가 닫혀 있음(#{number}). 병합되거나 중단한 번호로 브랜치를 다시 만들지 않고 새 Task로 한다. "
                   "잘못 닫은 Issue(병합·중단 없이 닫았거나 남은 조건이 채워지기 전에 닫음)만 담당자가 다시 연다")
        if hotfix_second and issue.get("state_reason") != "not_planned":  # 중단한 hotfix는 첫 PR이 병합되지 않았다
            message += (". 첫 PR이 배포 브랜치에 병합되고 둘째 PR이 남은 hotfix를 지운 브랜치에서 다시 만들었으면 "
                        "담당자가 Issue를 다시 연 뒤 이 검사를 다시 돌린다(01 병합 뒤의 변경)")
        return [message], []
    return [], []


def fetch_blockers(number):
    """Issue를 막는 Issue(blocked_by) 목록. Actions 밖이면 None, 조회에 실패하면 False."""
    return fetch_pages(f"issues/{number}/dependencies/blocked_by")


def check_blockers(number, fetch=fetch_blockers):
    """Task를 막는 Issue(blocked_by) 중 열린 것을 알린다(01 Blocked 기록, #86).

    스택 PR의 상위 Task나 남은 조건 때문에 열어 둔 선행처럼 열린 채 병합하는 것이 맞는 경우가 있고,
    선행 Issue를 닫아도 이 검사가 다시 돌지 않으므로 실패로 두면 다른 PR을 막는다. 그래서 경고만 낸다.
    """
    blockers = fetch(number)
    if blockers is None:
        return []
    if blockers is False:
        return [f"Issue #{number}의 선행(blocked_by)을 조회하지 못해 선행 확인을 건너뜀. 워크플로의 `issues: read` 권한을 확인"]
    repository = os.environ.get("GITHUB_REPOSITORY", "")
    found = []
    for issue in blockers:
        if isinstance(issue, dict) and issue.get("state") == "open":
            other = str(issue.get("repository_url") or "").partition("/repos/")[2]
            found.append(f"{'' if other in ('', repository) else other}#{issue.get('number')}")
    if not found:
        return []
    return [f"Task #{number}의 선행 Issue가 열려 있음(blocked_by): {', '.join(found)}. "
            "스택 PR의 상위 Task이거나 남은 조건 때문에 열어 둔 선행이 아니면 선행이 끝난 뒤 병합한다"]


# 05 반려 사유와 복귀 단계 표. 도입 저장소에는 문서가 없으므로 값을 옮겨 둔다(test_pr_check가 05 표와 대조).
REJECTIONS = (
    ("수정 요청", "코드 결함", "구현"),
    ("수정 요청", "테스트 누락", "테스트 작성·검증"),
    ("수정 요청", "작업 범위 혼합", "브랜치 정리·변경 분리"),
    ("재설계 요청", "설계 결함", "재설계"),
    ("재설계 요청", "요구사항 불일치", "작업 정의·요구사항 분석"),
    ("재설계 요청", "영향 범위 확대", "영향 분석·업무 재분해"),
)
REJECTION_FIELDS = ("결정", "사유", "근거", "복귀 단계")
REJECTION_HEADING = re.compile(r"^반려(?:$|[\s:(])")
# 값은 `(.*)`로 받고 strip한다. `(.*?)\s*$`는 긴 공백 줄에서 역추적이 이차 시간이 된다.
REJECTION_FIELD = re.compile(r"^\s*(?:[-*+]\s+)?\**(결정|사유|근거|복귀 단계)\s*(?::\**|\**:)(.*)$")
# 05 반려 사유 표 아래의 단계 순서. 사유가 여럿이면 가장 앞 단계로 간다(K1).
STAGES = ("작업 정의·요구사항 분석", "영향 분석·업무 재분해", "재설계", "브랜치 정리·변경 분리", "구현", "테스트 작성·검증")


def fetch_timeline(number):
    """PR 타임라인 전체. Actions 밖이면 None, 조회에 실패하면 False."""
    return fetch_pages(f"issues/{number}/timeline")


def rejection_record(body):
    """`## 반려` 칸의 {칸: 값}. 반려 코멘트가 아니면 None."""
    found = sections(body or "")
    name = next((name for name in found if REJECTION_HEADING.match(name)), None)
    if name is None:
        return None
    record = {}
    for line in found[name].splitlines():
        if not (match := REJECTION_FIELD.match(line)):
            continue
        value = match.group(2).strip()
        if value and not is_placeholder_line(value):
            record.setdefault(match.group(1), value)
    return record


def rejection_values_match(record):
    """결정·사유·복귀 단계가 05 표와 맞는가. 사유는 쉼표로 여럿 쓸 수 있고 가장 앞 단계의 행과 맞아야 한다(K1)."""
    reasons = [reason.strip() for reason in record["사유"].split(",")]
    rows = [row for reason in reasons for row in REJECTIONS if row[1] == reason]
    if len(rows) != len(reasons):
        return False
    first = min(rows, key=lambda row: STAGES.index(row[2]))
    return (record["결정"], record["복귀 단계"]) == (first[0], first[2])


def check_rejection(number, fetch=fetch_timeline):
    """Ready 뒤 Draft로 되돌린 차례마다 `## 반려` 코멘트가 하나씩 있는지 본다(05 반려 기록, #120).

    차례 k는 그 Draft 전환 앞의 마지막 Ready 전환 뒤에 남긴 기록 중 앞 차례가 쓰지 않은 가장 이른 것으로 채운다.
    기록 하나는 한 차례만 채우고, 끝을 닫지 않으므로 빠진 기록은 나중에 더하면 채워진다. 빠진 칸과 05 표에 없는 값은 경고다.
    """
    timeline = fetch(number)
    if timeline is None:
        return [], []
    if timeline is False:
        return [], ["PR 타임라인을 조회하지 못해 반려 기록 검사를 건너뜀. 워크플로의 `pull-requests: read` 권한을 확인"]
    ready, rounds, records = -1, [], []
    for index, event in enumerate(event for event in timeline
                                  if isinstance(event, dict) and isinstance(event.get("created_at"), str)):
        kind = event.get("event")
        if kind == "ready_for_review":
            ready = index
        elif kind == "convert_to_draft":
            rounds.append((ready, event["created_at"]))
        elif kind == "commented" and (record := rejection_record(event.get("body"))) is not None:
            records.append((index, record))
    errors, warnings, position = [], [], 0
    for start, when in rounds:  # 차례의 시작은 늘기만 하므로 앞에서부터 하나씩 배정하면 된다.
        while position < len(records) and records[position][0] <= start:
            position += 1
        if position == len(records):
            errors.append(f"{when}에 Draft로 되돌렸는데 그 차례의 `## 반려` 코멘트가 없음. 05 반려 기록 양식"
                          f"({', '.join(REJECTION_FIELDS)})으로 PR 코멘트를 남긴 뒤 실패한 이 검사 실행을 다시 돌린다."
                          " 기록은 앞 차례부터 채우므로 빠진 기록 수만큼 더하면 된다."
                          " 반려가 아닌 이유로 되돌렸어도 그 이유를 같은 양식으로 남긴다")
            continue
        record = records[position][1]
        position += 1
        missing = [field for field in REJECTION_FIELDS if field not in record]
        if missing:
            warnings.append(f"{when} 반려 기록에 빠진 칸: {', '.join(missing)}")
        if all(field in record for field in ("결정", "사유", "복귀 단계")) and not rejection_values_match(record):
            values = " / ".join(record[field] for field in ("결정", "사유", "복귀 단계"))
            warnings.append(f"{when} 반려 기록의 결정·사유·복귀 단계가 05 표와 맞지 않음: {values}")
    return errors, warnings


def check_title(rules, title, promotion, deploy, integration):
    """PR 제목은 커밋 제목과 다른 PR 고유 형식이다(03 PR 제목). 판정은 커밋 형식처럼 경고만 낸다."""
    title = unicodedata.normalize("NFC", title or "").strip()
    if promotion:
        if re.fullmatch(rf"{re.escape(integration)} → {re.escape(deploy)} 승격 \(#[0-9]+(?:, #[0-9]+)*\)", title):
            return []
        return [f"승격 PR 제목 형식 불일치: {title!r}. 형식: {integration} → {deploy} 승격 (#<포함 PR>, …)"]
    warnings = []
    if rules.HEADER.match(title):
        warnings.append(f"PR 제목에 type 접두어를 쓰지 않음: {title!r}. 형식: <한글 요약>")
    if not re.search(r"[가-힣]", title):
        warnings.append("PR 제목에 한글이 없음")
    if title.endswith("."):
        warnings.append("PR 제목 끝에 마침표 사용")
    if rules.SENTENCE_ENDING.search(title):
        warnings.append("PR 제목이 서술형으로 끝남 (명사형으로: 추가, 수정, 해결)")
    if rules.display_width(title) > rules.MAX_WIDTH:
        warnings.append(f"PR 제목 폭 {rules.display_width(title)}칸 ({rules.MAX_WIDTH}칸 초과)")
    return warnings


def live_base(base_ref, payload_sha):
    """(커밋 범위의 시작, 경고). 대상 브랜치의 현재 끝을 쓰고, 없으면 이벤트의 base.sha로 물러선다.

    스택 PR의 대상을 바꾼 뒤 아래 PR이 병합돼도 이벤트의 base.sha는 옛 끝에 머물러, 이미 병합된 커밋을
    이 PR의 커밋으로 셌다(#179). fetch-depth: 0 체크아웃이 모든 브랜치를 refs/remotes/origin/에 받아 둔다.
    """
    live = git("rev-parse", "--verify", "-q", f"refs/remotes/origin/{base_ref}^{{commit}}").stdout.strip()
    if live:
        return live, []
    return payload_sha, [f"대상 브랜치 {base_ref}의 현재 끝을 읽지 못해 이벤트의 base.sha로 판정함"]


def run(rules, event, deploy, integration):
    """(오류, 경고, 건너뛴 이유)를 돌려준다."""
    pr = event["pull_request"]
    base_ref, head_ref = pr["base"]["ref"], pr["head"]["ref"]
    head = pr["head"]["sha"]
    labels = {label["name"] for label in pr.get("labels", [])}
    if git("rev-parse", "--is-shallow-repository").stdout.strip() == "true":
        return ["이력이 잘려 있어 판정할 수 없음. 워크플로에 fetch-depth: 0이 필요함"], [], None
    base, base_warnings = live_base(base_ref, pr["base"]["sha"])
    unreadable = [rev for rev in (base, head) if git("cat-file", "-e", f"{rev}^{{commit}}").returncode]
    if unreadable:  # 미도입으로 처리하면 설정이 틀린 저장소의 검사가 조용히 꺼진다.
        return [f"커밋을 읽을 수 없음: {rev}. 워크플로의 fetch-depth와 PR head fetch 단계를 확인" for rev in unreadable], [], None
    # 대상 브랜치로 판정해야 표식 전에 분기한 브랜치도 검사한다.
    if not has_marker(rules, base):
        return [], [], "도입 저장소가 아님"

    internal = same_repository(pr)
    promotion = internal and base_ref == deploy and head_ref == integration
    errors = check_target(rules, base_ref, head_ref, deploy, integration, internal)
    errors += check_body(pr.get("body"), PROMOTION if promotion else COMMON)
    errors += check_marker(rules, base, head, labels)
    warnings = base_warnings + check_title(rules, pr.get("title"), promotion, deploy, integration)
    if not promotion and not pr.get("draft") and pr.get("state", "open") == "open":  # 승격 PR의 검증 결과 형식은 정하지 않았다.
        errors += check_pending(pr.get("body"))
        if pr.get("number") is not None:  # Draft에서는 반려 기록을 남기는 중일 수 있어 Ready일 때만 본다.
            rejection_errors, rejection_warnings = check_rejection(pr["number"])
            errors += rejection_errors
            warnings += rejection_warnings
    if not promotion:  # 승격에 포함된 커밋은 각자의 Task PR에서 검사했다.
        commit_errors, commit_warnings = check_commits(rules, base, head, head_ref)
        errors += commit_errors
        warnings += commit_warnings
        task = rules.TASK_BRANCH.match(head_ref)
        if not task:
            errors.append(f"Task 브랜치 형식이 아님: {head_ref}. 형식: <type>/<번호>-<slug>")
        elif pr.get("state", "open") == "open":  # 병합 뒤 본문 수정 이벤트에서 닫힌 Issue로 실패하지 않게 한다.
            hotfix_second = task.group(1) == "hotfix" and base_ref == integration
            issue_errors, issue_warnings = check_issue(task.group(2), hotfix_second=hotfix_second)
            errors += issue_errors
            warnings += issue_warnings
            if not issue_errors and not issue_warnings:  # 번호가 틀렸거나 조회가 막혔으면 선행도 볼 수 없다.
                warnings += check_blockers(task.group(2))
    return errors, warnings, None


def annotate(level, message, write=print):
    """메시지의 개행이 새 워크플로 명령이 되지 않게 이스케이프한다."""
    text = message.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
    write(f"::{level}::{text}")


def main():
    with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8") as event_file:
        event = json.load(event_file)
    errors, warnings, skipped = run(
        load_rules(), event, os.environ["DEPLOY_BRANCH"], os.environ["INTEGRATION_BRANCH"]
    )
    if skipped:
        print(f"건너뜀: {skipped}")
    for warning in warnings:
        annotate("warning", warning)
    for error in errors:
        annotate("error", error)
    if not errors:
        print("통과")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
