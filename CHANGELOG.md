# Changelog

## 0.1.0-beta.1 — 2026-10-02
첫 베타.
- Claude Code 플러그인으로 묶음: 스킬 `reference-research`, 읽기 전용 MCP `reference-library`, SessionStart 훅.
- 캡처 방식 자동 선택: Aside → headless Chrome → 없음(텍스트 자료만).
- `ref doctor`(환경 점검), `ref setup --embeddings | --git`.
- 임베딩(의미 검색)은 선택 설치로 분리 — 기본 설치 약 80 MB.
- macOS `sips` 의존 제거 → Pillow로 미리보기 생성.
- 기본 축(axes.json)을 플러그인에 포함 — 새 라이브러리도 패턴 이름이 한글로 정리됨.
