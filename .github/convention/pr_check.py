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
from pathlib import Path

COMMON = ("업무", "변경 목적", "영향 범위", "검증 결과", "위험도", "롤백 방안")
PROMOTION = ("포함 PR", "변경 목적", "영향 범위", "검증 결과", "위험도", "롤백 방안", "승인")
REMOVAL_LABEL = "marker-removal-approved"

# GitHub 렌더링과 같게 1~3칸 들여쓴 제목도 칸으로 친다. 4칸부터는 코드 블록이다.
HEADING = re.compile(r"^ {0,3}##\s+(.+?)\s*$")
FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")
# 목록 항목 안의 펜스는 항목이 끝나면 닫힌다. 항목 내용이 시작하는 칸을 잰다. 구분선(`- - -`)은 항목이 아니다.
LIST_ITEM = re.compile(r"^( {0,3})([-*+]|\d{1,9}[.)])( +|$)")
THEMATIC_BREAK = re.compile(r"^ {0,3}([-*_])(?: *\1){2,} *$")
# 칸을 채운 것으로 치지 않는 줄: 목록 기호와 체크박스를 뗀 나머지가 비었거나 `<안내문>` 하나뿐인 줄.
BULLET = re.compile(r"^(?:[-*+]|\d+[.)])(?:\s+\[[ xX]?\])?(?:\s+|$)")
PLACEHOLDER = re.compile(r"^<[^<>]*>$")
HTML_TAG = re.compile(r"^</?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?/?>$")  # `<br>`, `<img …>`, `<details>`는 안내문이 아니다.
EMPTY_MESSAGE = "(빈 메시지)"


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
    lines = unicodedata.normalize("NFC", body or "").splitlines()
    # 줄마다 같은 문단의 뒤 줄에 `-->`가 있는지. 빈 줄에서 문단이 끝나면 줄 중간 주석도 닫히지 않는다. 본문 길이에 비례해 끝난다.
    closes_later, later = [False] * len(lines), False
    for index in range(len(lines) - 1, -1, -1):
        closes_later[index], later = later, bool(lines[index].strip()) and (later or "-->" in lines[index])
    found, current, fence, items, comment, hidden, paragraph = {}, None, None, [], False, None, False
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
                found[current] += line + "\n"
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
                    found[current] += line + "\n"
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
            current = heading.group(1)
            found.setdefault(current, "")
        elif current:
            found[current] += visible + "\n"
    return found, hidden


def sections(body):
    return parse(body)[0]


def is_placeholder(text):
    return bool(PLACEHOLDER.match(text)) and not HTML_TAG.match(text) and "://" not in text and "@" not in text


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
        if rest and not is_placeholder(rest):
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


def run(rules, event, deploy, integration):
    """(오류, 경고, 건너뛴 이유)를 돌려준다."""
    pr = event["pull_request"]
    base_ref, head_ref = pr["base"]["ref"], pr["head"]["ref"]
    base, head = pr["base"]["sha"], pr["head"]["sha"]
    labels = {label["name"] for label in pr.get("labels", [])}
    if git("rev-parse", "--is-shallow-repository").stdout.strip() == "true":
        return ["이력이 잘려 있어 판정할 수 없음. 워크플로에 fetch-depth: 0이 필요함"], [], None
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
    warnings = []
    if not promotion:  # 승격에 포함된 커밋은 각자의 Task PR에서 검사했다.
        commit_errors, warnings = check_commits(rules, base, head, head_ref)
        errors += commit_errors
        if not rules.TASK_BRANCH.match(head_ref):
            errors.append(f"Task 브랜치 형식이 아님: {head_ref}. 형식: <type>/<번호>-<slug>")
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
