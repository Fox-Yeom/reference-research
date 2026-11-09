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

HEADING = re.compile(r"^##\s+(.+?)\s*$")
COMMENT = re.compile(r"<!--.*?-->", re.S)
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


def sections(body):
    """`## 제목` 아래 내용을 제목별로 돌려준다. 주석은 내용으로 치지 않는다."""
    found, current = {}, None
    text = COMMENT.sub("", unicodedata.normalize("NFC", body or ""))
    for line in text.splitlines():
        heading = HEADING.match(line)
        if heading:
            current = heading.group(1)
            found.setdefault(current, "")
        elif current:
            found[current] += line + "\n"
    return found


def check_body(body, required):
    found = sections(body)
    empty = [name for name in required if not found.get(name, "").strip()]
    return [f"본문 칸이 비어 있음: {name}" for name in empty]


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


def as_recorded(message, parents):
    """check()는 작성 중인 메시지를 전제하므로 확정된 메시지에 맞게 고친다.

    확정된 메시지의 `#` 줄은 주석이 아니고, 부모가 1개인 `Merge`는 git이 만든 메시지가
    아니다. 앞에 공백을 넣으면 주석 제거와 자동 메시지 제외를 피한다.
    """
    message = re.sub(r"^#", " #", message, flags=re.M)
    if parents < 2 and message.startswith("Merge "):
        message = " " + message
    return message if message.strip() else EMPTY_MESSAGE


def check_commits(rules, base, head, branch):
    """브랜치를 넣어야만 나오는 위반이 `Refs`이고 나머지는 형식 위반이다."""
    errors, warnings = [], []
    for sha, parents, raw in commits(base, head):
        message = as_recorded(raw, parents)
        form = rules.check(message)
        errors += [f"{sha[:7]}: {e}" for e in rules.check(message, branch) if e not in form]
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
