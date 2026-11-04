# 조사 흐름 개편 기획안 (v2 · 2026-11-04)

대상: `skills/reference-research/SKILL.md` + `scripts/` (store · capture · evidence · report · board · mcp · ref)
상태: 결정 3건 반영 (2026-11-04, 8절). 1단계 구현, 2단계 착수 전.
배경: 실사용 포스트모템 (2026-10-30, 발표 자료 디자인 양식 조사)과 관리자 보정 5방향. 보드 개편(`BOARD-REDESIGN.md`)과 홈 개편(`HOME-REDESIGN.md`)의 원칙·부품을 이어 쓴다.

## 0. 결론

**조사 흐름을 "한 줄 목표 → 검색 → 캡처 → 나열"에서 "질문으로 목적 좁히기 → 최신순으로 넓혔다 좁히기를 반복 → 가치 유형별 채널 → 왜를 역추적 → 결론부터 쓰는 보고서"로 바꾼다.** 1단계는 SKILL.md 절차, 2단계는 CLI·보드·MCP이고, 도구 9종을 함께 붙인다 (4절).

| 방향 | 바꾸는 것 | 1단계 (SKILL.md) | 2단계 (CLI·보드) |
|---|---|---|---|
| 1. 최신순·순환 탐색 | 최신 자료부터 보고, 최신 자료에서 뽑은 단서로 질의를 다시 만드는 순환을 최대 3바퀴. 12개월 넘은 자료는 원리·변화 비교에만 | 절차·규칙 | 발행일 자동 추출, 날짜순 정렬, 바퀴 기록 |
| 2. 선질문 순환 | 조사 전에 문제·목표·가치 유형을 묻고, 회피형 요청은 '왜 → 어디서 → 대신 무엇'으로 좁힌다. 범위는 직접·간접·트렌드 | 질문 루프·개요 | `brief`, 역할 이전 |
| 3. 가치 유형별 채널 | 전략·디자인·사용자 반응·여행·기술·교육과정마다 1차·해석·반응·이유 채널과 편향 주의 | 채널 표 | 채널 범위 점검, 커넥터 |
| 4. 왜 역추적 | 노트를 기능 → 맥락 → 왜 → 대안 → 결과 → 시사점 6칸으로. '왜'에는 근거 종류(공식·정황·추정) | 노트 본문 6칸 | 노트 칸, 역추적 카드, MCP |
| 5. 결론 먼저 | 결론 → 근거 3개 → 역추적 → 공통·차별 → 피할 것 → 열린 질문 → 조사 과정. 헤드라인은 주장 문장, 색은 뜻 하나에 하나 | 요약 순서·쓰기 규칙 | 보드 머리, 독자 유형, 색 토큰 |

## 1. 진단 (실제 라이브러리 · 2026-11-04, 읽기 전용 집계)

| 항목 | 값 | 뜻 |
|---|---|---|
| 발행일 | 레퍼런스 1,750 중 **853 (49%)만 있음**. 있는 것 중 12개월 이내 258 (30%) | 최신순으로 정렬하려 해도 절반은 날짜가 없다 |
| 캡처 날짜 | `capture.mjs`가 `published`를 채우지 않음 (`ref store`만 앱 버전 날짜를 씀) | 캡처한 레퍼런스는 늘 날짜 미상 |
| 발견의 신선도 | 발견 653 중 520 (80%), 핵심 결론 83 중 55 (66%)가 날짜 없거나 12개월 넘은 출처만 인용 | 새 규칙을 소급하면 대부분 경고가 뜬다 → 새 회차부터 적용하고, 기존 것은 배지만 단다 |
| '왜'의 자리 | 노트 1,305 중 칸 나눈 노트 73 (6%), 본문에 '왜·이유·의도'가 있는 노트 10 (0.8%, 단어 검색 근사) | 왜 이렇게 만들었는지 기록하는 칸이 없다 |
| 범위 역할 | 직접 944 · 간접 612 · **유사 210** · 없음 121 | 결정 ②에 따라 유사 210건을 옮겨야 한다 |
| 목적 정의 | 회차 36개 모두 목표 한 줄은 있음. 조사 30개 중 대상 13 · 질문 13. 문제 정의 칸은 없음 | 목표는 있지만 '왜 하는가'가 없다 |
| 검색 기록 | 30개 중 23개 조사에 있지만 자유 글 | 후보 발행일·바퀴·새 패턴 수를 기계가 읽지 못한다 |
| 보드 색 | `board.mjs`에 서로 다른 색값 76개 | 색마다 뜻 하나가 지켜지는지 확인할 수 없다 |
| 검색 도구 | 기본 WebSearch는 날짜 정렬·기간 필터 없음 (도메인 허용·차단만) | 최신순은 질의에 연도를 넣는 것 말고 방법이 없다 → 커넥터 (4.3) |
| 실사용 사례 | 요청("~티 안 나게")을 그대로 목표로 옮긴 조사가 4회차 동안 흔들림 | 회피 조건은 목적이 아니다 |

## 2. 방향 1 — 최신순·순환 탐색 (F)

**원칙:** 날짜 내림차순으로 보고, 최신 자료에서 뽑은 단서로 질의를 다시 만든다. 12개월이 넘었거나 날짜를 모르는 자료는 '지난 자료'로 둔다.

**근거:**
- 실제 검색은 질의가 바뀌며 조각조각 모인다 (Bates 1989 [1]).
- 기술 분야는 최신성이 중요하다. 다만 기준은 주제·용도에 따라 다르다 (CRAAP [8]).
- 경쟁·시장 기대는 6~12개월이면 낡는다. 업체 추정이다 [7].

**신선도 규칙 (결정 ③):**

| 구분 | 기준 | 쓸 수 있는 자리 |
|---|---|---|
| 신선 | 발행·갱신 12개월 이내 | 어디든 (지향 예시, 핵심 결론) |
| 지난 자료 | 12개월 초과 또는 날짜 미상 | 원리(사람의 인지·이론)나 변화 비교(예전엔 이랬고 지금은 이렇다)에만 |

- 핵심 결론이 지난 자료만 인용하면 경고한다.
- 원리를 말하는 결론은 `scope: "원리"`로 표시하면 경고에서 뺀다. 기존 claim 필드를 그대로 쓴다.

**순환 절차 (한 바퀴 = 넓히기 → 읽기 → 좁히기):**
1. **0바퀴:** 올해·작년 연도를 넣은 질의와 체인지로그·최근 발표로 후보를 모은다. 후보마다 발행일을 적고, 롱리스트를 날짜 내림차순으로 정렬한다.
2. **단서 뽑기:** 최신 5~10건에서 반복되는 이름·용어·패턴을 뽑아 다음 질의를 만든다.
3. **가지치기:** 좋은 자료에서 뒤로(참고한 것), 앞으로(뒤에 나온 것, 따라 한 것) 따라간다 [s1].
4. **멈춤:** 새 패턴(축)이 0개인 바퀴가 나오면 멈춘다. 0바퀴를 포함해 최대 3바퀴.

| # | 제안 | 지금 | 단계 | 비용 |
|---|---|---|---|---|
| F1 | 0바퀴와 날짜 내림차순 롱리스트 | 5개 각도 동시 검색, 날짜 없음 | 1 | S |
| F2 | 순환 절차와 멈춤 규칙 | 한 번에 끝냄 | 1 | S |
| F3 | 신선도 규칙 (12개월) | 없음 | 1 | S |
| F4 | 캡처 때 발행일 자동 추출: `article:published_time` · JSON-LD `datePublished`/`dateModified` · `<time datetime>` · `Last-Modified` | `published: null` | 2 | M |
| F5 | 날짜 미상이면 웹 아카이브 첫 저장일을 '늦어도 이때부터'로 기록 (T4) | 없음 | 2 | M |
| F6 | `ref list`·보드 자료 목록을 날짜 내림차순으로, 신선·지난 배지를 붙인다. 지난 자료만 인용한 핵심 결론은 `ref cite`가 경고 (T6) | 없음 | 2 | M |
| F7 | 바퀴 기록을 구조화해 멈춤 규칙을 CLI가 판정 (T2) | 자유 글 노트 | 2 | M |

## 3. 방향 2 — 선질문 순환 (Q)

**원칙:** 조사 전에 묻고, 개요는 가설로 두며, 첫 바퀴 뒤에 다시 확인한다.

**근거:**
- 현재 LLM은 모호한 요청을 가려내고 되묻는 능력이 제한적이다. chain-of-thought·few-shot으로는 개선이 미미하다 (CLAMBER, ACL 2024 [5]).
- 지금 SKILL 1절의 "Pick a reasonable scope if vague; ask only if truly ambiguous"가 이 약점을 그대로 둔다.
- 원래 Double Diamond는 조사한 뒤에 문제를 정의한다 [s7]. 그래서 개요는 확정이 아니라 가설로 둔다.

**1라운드 (항상, 보기형 4문항):**

| 칸 | 질문 |
|---|---|
| 문제 | 지금 무엇이 안 되고 있어서 이 조사를 하나요? |
| 목표 | 조사 결과로 무엇을 결정하거나 만드나요? 누가 보나요? |
| 가치 유형 | 전략·비즈니스 / 디자인·UX / 사용자 반응·시장 / 여행·동선 / 기술 / 교육과정 |
| 성공 모습 | 조사가 끝났을 때 손에 무엇이 있으면 성공인가요? |

**회피형 요청** ("~티 안 나게", "~처럼", "세련되게"): 문제·목표 질문 대신 아래 사다리로 묻는다.

| 단계 | 질문 |
|---|---|
| 왜 | 그게 왜 문제인가요? 보는 사람이 어떻게 느끼나요? |
| 어디서 | 어느 부분에서 그렇게 느껴지나요? (색 · 배치 · 말투 · 도형 …) |
| 대신 무엇 | 대신 어떤 느낌이면 성공인가요? 예시가 있나요? |

**2라운드 (1라운드 답으로 범위를 못 정할 때) — 범위 3갈래 (결정 ②):**

| 범위 | 뜻 |
|---|---|
| 직접 (direct) | 같은 문제를 같은 방식으로 푸는 것 |
| 간접 (indirect) | 같은 문제를 다른 방식으로, 또는 같은 방식으로 다른 고객을. 다른 업종이지만 구조가 같은 것도 여기 넣는다 |
| 트렌드 (trend) | 해외·최신 흐름. 이 분야가 어디로 가는지 |

**진행 규칙:**
- 답을 개요 표(목적 · 대상 · 문제 · 성공 기준 · 가치 유형 · 범위 · 고정할 것 · 뺄 것 · 가정)로 정리해 보여 준 뒤 시작한다.
- 사용자가 "알아서"라고 하면 빈칸을 **가정**으로 채운다.
- 0바퀴 뒤에는 "최신 자료를 보니 X 쪽으로 좁혀집니다. 맞나요?"라고 한 줄로 확인한다.
- 요청에 문제·목표·가치 유형이 다 있으면 묻지 않고 개요만 보여 준다.

| # | 제안 | 지금 | 단계 | 비용 |
|---|---|---|---|---|
| Q1 | 1라운드 4문항 (AskUserQuestion 보기형, T8) | "모호하면 적당히" | 1 | S |
| Q2 | 회피형 요청 사다리 | 없음 | 1 | S |
| Q3 | 2라운드 범위 3갈래 | 역할 3종(유사 포함) | 1 | S |
| Q4 | 개요를 보여 준 뒤 시작, 가정 표시 | 없음 | 1 | S |
| Q5 | 0바퀴 뒤 한 줄 재확인 | 없음 | 1 | S |
| Q6 | `run start`가 `brief` 객체를 받고, 비면 경고하고, 보드 머리에 문제·목표·가정을 표시 (T1) | goal · audience · question | 2 | M |
| Q7 | 역할 어휘: `trend` 추가, `analogous` 제거. 기존 210건은 `indirect`로 옮기고 원래 값은 `roleWas`에 보존 (T10) | 3역할 | 1 (어휘) · 2 (이전) | S · M |

## 4. 방향 3 — 가치 유형별 채널 (C)

**원칙:** 원하는 가치에 따라 채널을 고른다. 유형마다 1차·반응·이유 채널을 각 1개 이상 본다.

**근거 (대부분 업체 글 — 3단계에서 검증):**
- 리뷰를 모을 플랫폼은 대상별로 다르고, 원문 인용·URL·편향을 함께 기록해야 한다 [s10].
- 실서비스 화면과 콘셉트 샷은 성격이 다르다 [s11].
- IR 자료는 회사 관점이고 사업보고서는 법정 공시다 [s12].

| 가치 유형 | 1차 (사실·실물) | 해석 | 반응 | 이유 근거 | 편향 주의 | 남길 것 |
|---|---|---|---|---|---|---|
| 전략·비즈니스 | DART·SEC 공시, IR·실적 발표, 가격·약관 | 증권사·업계 리포트, 언론 | 고객 리뷰, 커뮤니티 | 실적 발표 질의응답, 대표 인터뷰, 채용 공고 | IR은 회사 관점 | 수익 구조·가격·성장 수치 (기준일 필수) |
| 디자인·UX | 실제 제품 화면(캡처·앱스토어·실서비스 화면 라이브러리), 공식 디자인 시스템·브랜드 가이드 | 템플릿 플랫폼 본문, 디자인 매체 리뷰 | 리뷰 중 화면 관련 의견 | 체인지로그, 디자인 블로그·발표 | 콘셉트 샷은 '영감'으로만 | 화면 흐름, 색·글꼴 체계, 상태 화면 |
| 사용자 반응·시장 | 앱스토어·플레이 리뷰(버전·날짜별), G2·Capterra | 리뷰 분석 리포트 | Reddit·HN·GitHub 이슈, 국내 커뮤니티 | 회사의 답글·공지 | 불만 많은 사용자 과대표, 체험단·광고 | 원문 인용 + URL + 날짜 + 작성자 유형 |
| 여행·동선 | 공식(관광청·시설 영업시간·요금), 지도 앱의 영업시간·이동 시간 | 큐레이션 앱·가이드북 | 최근 6개월 방문 후기 | — | 협찬·체험단, 폐업·시간 변경 | 동선·시간표, 장소마다 마지막 확인일 |
| 기술·개발 | 공식 문서, GitHub 릴리스·이슈, 표준 | 엔지니어링 블로그, 벤치마크 | HN·Reddit·이슈 토론 | RFC·설계 문서·릴리스 노트 | 벤치마크 조건 차이 | 버전 기준 비교 |
| 교육과정 (9절) | 강의계획서 | 역량 프레임워크·수요 조사 | 수강 후기 | — | 판매 페이지 과장 | 모듈·시간·순서 |

**규칙**
- 채널을 빼려면 그 채널의 표본 1건을 먼저 보고, 검색 기록에 S#와 이유를 남긴다.
- 유형마다 국내 채널을 최소 1개 본다.
- 가치 유형이 여럿이면 주 유형에 질의를 더 배분한다.

| # | 제안 | 지금 | 단계 | 비용 |
|---|---|---|---|---|
| C1 | 채널 표를 SKILL 새 절로 (2절의 '5개 각도'를 보강) | 5개 각도 | 1 | S |
| C2 | 채널 제외 규칙 (표본 1건 + 이유) | 없음 | 1 | S |
| C3 | `domain`에 `strategy · voice · travel` 추가 | design · dev · research · curriculum | 2 | S |
| C4 | 레퍼런스에 `channel` 필드 (`primary · interpretation · reaction · rationale`). 기본값은 `type`에서 정함 (store·community → reaction, official·docs·repo → primary …) | type만 | 2 | S |
| C5 | 채널 범위 점검 `ref channels` (T5) | 화면 범위만 | 2 | M |

## 5. 방향 4 — 왜 역추적 (W)

**원칙:** 레퍼런스를 볼 때 "무엇"에서 멈추지 않고 "왜 이렇게 만들었나"를 증거로 역추적한다.

**근거:**
- 티어다운의 목적은 what만이 아니라 how와 why다 (LogRocket 2025 [9]).
- 설계 이유는 질문·선택지·기준으로 기록해야 하고, 다른 선택지와 비교할 때 설명된다 (QOC 1991 [s6]).
- 관찰 → 의미 → 행동 순서로 쓰고, 행동은 구체적이어야 한다 (What? So what? Now what? [6]).

| 칸 | 묻는 것 | 근거 규칙 |
|---|---|---|
| 기능 | 무엇이 보이나 (화면·수치 그대로) | 캡처 S#와 화면 번호 필수 |
| 맥락 | 누구를 위해, 어떤 제약에서 (고객 · 시장 · 시기 · 플랫폼) | 출처가 있으면 S#, 없으면 추정 |
| 왜 | 왜 이렇게 만들었나 | **공식**(회사가 직접 밝힘: 블로그·체인지로그·발표·인터뷰) / **정황**(채용 공고·가격 변화·여러 제품의 반복) / **추정**(가설) |
| 대안 | 같은 문제를 다른 곳은 어떻게 풀었나 | 다른 레퍼런스 S# 1개 이상 |
| 결과 | 효과가 있었나 | 공식 수치, 사용자 반응, 유지 여부(1년 뒤에도 남아 있나: 재캡처 변화·웹 아카이브), 확산(다른 제품이 따라 했나) |
| 시사점 | 우리 목표(개요)에 무엇을 뜻하나 | 차용 · 변형 · 회피 중 하나 + 조건 |

**규칙**
- '왜'나 '결과'가 추정뿐이면 핵심 결론이 될 수 없다.
- 회피는 조합·맥락 단위로 적는다. 요소 단위 금지 목록은 만들지 않는다.
- 6칸 전부는 핵심 레퍼런스 3~5건만 쓰고, 나머지는 기능·시사점 2칸만 쓴다.

| # | 제안 | 지금 | 단계 | 비용 |
|---|---|---|---|---|
| W1 | SKILL 5절을 6칸으로. 1단계는 `note` 마크다운에 `**라벨**:` 줄로 쓰고, 구조·카피·비주얼·UI는 '기능' 칸에 적는다. `fields`를 함께 보내면 뷰어가 `fields`만 보여 주므로 `note`만 보낸다 | 구조·카피·비주얼·UI·차용·피할 점 | 1 | S |
| W2 | `NOTE_FIELDS`에 `context · why · why_basis(official\|signal\|guess) · alternatives · result · implication` 추가 (하위 호환) | 6칸 고정 | 2 | S |
| W3 | 뷰어 정보 패널에 역추적 카드, 축 카드에 '왜' 요약 1줄 | 없음 | 2 | M |
| W4 | '결과 — 유지 여부' 근거: 재캡처 변화 기록 + 웹 아카이브 스냅숏 (T4) | 재캡처만 | 2 | M |
| W5 | MCP `get_rationale` (T7) | 없음 | 2 | S |

## 6. 방향 5 — 결론 먼저 보고서 (R)

**원칙:** 읽는 사람이 빠른 시간 안에 핵심을 파악하고 결정하게 한다.

**관리자 팁 검증:**

| 팁 | 근거 | 판정 |
|---|---|---|
| 텍스트 두 단계 (헤드라인 · 팩트) | 문장 헤드라인 + 시각 근거 슬라이드가 주제형보다 이해·기억이 좋았다 (p < .01) [2]. 2012 후속 연구는 유의하지 않은 경향만 보였고, 시각 근거 설계가 더 중요할 수 있다고 했다 [s4] | 지지 (조건부). 헤드라인은 주장 문장, 대표 화면 고르기가 문장만큼 중요 |
| 컬러 코딩 제한 | "Use color only when needed to serve a particular communication goal." 다른 색은 뜻이 다를 때만, 강조만 진한 색 [4]. 무지개 색 지도는 혼란을 준다 [s2] | 지지 |
| 두괄식 결론 | 가장 중요한 정보(결론)를 먼저 둔다. 사용자는 온라인에서 꼼꼼히 읽지 않는다 [3]. BLUF [s5] | 지지. 가장 강한 반대 근거를 결론 바로 아래 1줄로 |
| 독자별 톤 | 누구를 위해 쓰는지 알 것, 전문가 대상이어도 쉬운 말 [s9] | 지지 (근거 약함) |

**색과 기존 결정:** DECISIONS 2026-10-02("단색 거부 — 인디고 + 의미 색")는 유지한다. 이 제안은 단색화가 아니다.
- 인디고(구조)와 의미 색 3개(확인됨 · 주의 · 반박)로 나누고, **색마다 뜻 하나**를 지킨다.
- 장식용 색(역할 칩 3색 등)은 줄인다.
- 색값 76개를 토큰으로 묶는다.

**보고서 순서 (보드와 요약 공통):**
1. 결론: 답한 질문, 답 한 문장, 제안하는 결정
2. 근거 3개: 주장 헤드라인 + 대표 화면 + 출처 칩
3. 왜 이렇게 만들었나 (역추적 카드 3~5건)
4. 공통 vs 차별 (기본기 · 선택지 · 차별점)
5. 피할 것 (맥락과 함께)
6. 열린 질문 · 다음 조사
7. 조사 과정 (접힘): 개요, 질문 답변, 채널, 바퀴 기록, 신선도 분포

**1단계의 요약 제목:** `splitSummary`가 읽는 제목 계약(`board.mjs`)은 그대로 두고 순서만 바꾼다.
- 순서: `## 목표` → `## 핵심 결론`(/핵심/에 맞아 key로 읽힘) → `## 왜 이렇게 만들었나` → `## 공통 vs 차별` → `## 피할 것` → `## 추천` → `## 열린 질문` → `## 이번 실행에서 바뀐 것` → `## 조사 과정`.
- 계약에 없는 제목('왜 이렇게 만들었나', '피할 것', '조사 과정')은 요약 본문에만 보인다. 2단계에서 계약에 넣는다.
- 절 안에는 불릿·표만 쓴다. `**`로 시작하는 줄은 `splitSummary`가 제목으로 읽어 절이 끊긴다.
- `## 조사 과정`은 문단으로 쓴다. 불릿으로 쓰면 `ref cite`가 인용 없는 줄로 경고한다.

| # | 제안 | 지금 | 단계 | 비용 |
|---|---|---|---|---|
| R1 | 요약 순서와 쓰기 규칙: 헤드라인은 40자 안팎의 주장 문장, 내부 번호는 칩, 한 단락 3문장 이내 | 6제목 계약 | 1 | S |
| R2 | 제목 계약에 why · avoid · process 추가 | 6제목 | 2 | S |
| R3 | 보드 머리: 결론 문장 먼저, 숫자 타일은 조사 과정으로 | 목적 블록 + 타일 먼저 | 2 | M |
| R4 | `ref report`의 `reader: decision \| practitioner \| archive` (펼침·순서·길이) | `audience` 텍스트 | 2 | M |
| R5 | 색 토큰 정리 (76 → 인디고·의미 3색·회색 단계) | 76값 | 2 | M |
| R6 | 역추적 카드 절 | 없음 | 2 | M |

## 7. 추가 제안 — 모델 구조에 맞는 도구 (T)

**기준:** 5방향 중 무엇을 받치나 · 모델(S# · C# · R# · 조사 · 축) 어디에 붙나 · 키·비용 · 이번에 실제로 확인했나.

### 7.1 모델 × 도구 지도

| 모델 | 지금 도구 | 빈 곳 | 제안 |
|---|---|---|---|
| 회차 R# | `run start`(goal), 검색 기록 노트(자유 글) | 개요, 바퀴 기록 | T1 `ref brief` · T2 `ref run round` |
| 레퍼런스 S# | capture · store · source add, 재캡처 변화 | 발행일, 첫 등장일, 채널 분류 | T3 날짜 추출 · T4 `ref date` · C4 `channel` |
| 조사 (카테고리) | `coverage`(화면 범위) | 채널 범위 | T5 `ref channels` |
| 발견 C# | claim · cite | 신선도 점검, 원리와 현재 구분 | T6 `ref fresh` (+ `scope:"원리"`) |
| 노트 | `fields` 6칸 | 왜 · 결과 | W2 |
| 축 | `verdict` | 축별 '왜' | W3 · T7 |
| MCP (읽기 전용) | 6개 도구 | 개요 · 역추적 · 신선도 필터 · 결론 | T7 |
| 에이전트 도구 | WebSearch · WebFetch · Aside | 날짜 정렬, 보기형 질문 | T8 · T9 |
| 역할 | direct · indirect · analogous | trend | T10 |

### 7.2 CLI 도구 (2단계)

| # | 도구 | 하는 일 | 붙는 곳 | 비용 |
|---|---|---|---|---|
| T1 | `ref brief set\|show <collection>` | 개요(문제 · 목표 · 대상 · 가치 유형 · 범위 · 성공 기준 · 고정 · 제외 · 가정)를 조사에 저장. `run start`가 이어받고, 0바퀴 뒤 수정 이력을 남긴다 | collection.json · R# | M |
| T2 | `ref run round '<json>'` | 바퀴마다 `{queries:[{q,lang}], candidates:[{url,published,title}], new_axes}`를 기록. 멈춤 규칙(새 축 0 · 최대 3바퀴)을 판정하고 보드 '조사 과정'에 바퀴별 표를 만든다. 자유 글 검색 기록을 대체 | runs.jsonl R# | M |
| T3 | 캡처 날짜 추출 (F4) | 메타·JSON-LD·`<time>`·`Last-Modified` 순으로 `published`, 출처 표시 `publishedFrom` | capture.mjs · S# | M |
| T4 | `ref date <S#\|url>` | 웹 아카이브 CDX로 첫 저장일 → `firstArchived`(날짜 미상일 때의 하한), 특정 시점 스냅숏 URL(결과 '유지 여부'의 근거) | S# | M |
| T5 | `ref channels <collection>` | 가치 유형별 1차·해석·반응·이유 채널이 몇 개 레퍼런스로 덮였는지, 국내 채널이 있는지 확인하고 빠지면 경고. `coverage`와 같은 형식 | 조사 · S#.channel | M |
| T6 | `ref fresh <collection>` | 신선도 분포, 날짜 미상 목록(채울 순서대로), 지난 자료만 인용한 핵심 결론. `ref cite`에 같은 경고. 새 회차부터 경고하고, 기존은 배지만 | C# · S# | S |
| T10 | `ref migrate roles [--dry-run]` | `analogous` → `indirect`, `roleWas` 보존. 보드 표시 이름은 '트렌드' 추가 | collection.json members | S |

### 7.3 채널 커넥터 (선택 설치 · 2단계 끝)

임베딩처럼 선택 사항이다 (DECISIONS 2026-10-02). 기본은 WebSearch·WebFetch이고, 키가 필요 없는 것부터 붙인다. 키는 환경 변수로만 받고 라이브러리에 저장하지 않는다. `ref doctor`가 쓸 수 있는 커넥터를 보여 준다.

형태: `ref fetch <connector> '<json>'` → 후보 목록(URL · 발행일 · 제목 · 요지)을 날짜 내림차순으로 출력. 고른 것만 `source add`로 넣는다.

| 커넥터 | 채널 (가치 유형) | 날짜 | 키 | 확인 (2026-11-04) |
|---|---|---|---|---|
| HN Algolia `search_by_date` | 반응 (기술·제품) | 최신순 기본 | 없음 | **실측**: "design system" 검색 → 2026-11-03 글부터 반환 |
| App Store 리뷰 RSS `…/rss/customerreviews/page=N/id=…/sortby=mostrecent/json` | 반응 (B2C 앱) | 최신순 | 없음. Apple 공식 문서가 없는 경로이고, 국가별 약 500건 상한이라는 보고가 있다 [s13] | **실측**: 1쪽 50건, 최신 2026-11-01. `ref store`의 리뷰 옵션으로 |
| GitHub Releases API | 이유(체인지로그) · 1차(기술) | `published_at` | 없음 (시간당 한도) | **실측**: 최신 릴리스와 `published_at` 반환. 역추적 '왜(공식)'의 근거 |
| 웹 아카이브 CDX | 날짜(첫 등장) · 결과(유지 여부) | 시간순 | 없음 | **실측**: 2018-02-11 발행 글의 첫 저장 2018-02-13. T4 |
| 네이버 검색 API (블로그·뉴스·카페) `sort=date` | 반응·해석 (국내) | 날짜 내림차순 | 필요 (하루 25,000회 [s14]). 오픈 API와 NAVER API HUB의 인증 방식이 달라 확인 필요 | 요약만 (개발자 문서 접근 실패). 국내 채널 규칙(C) |
| OpenDART | 1차 (전략, 국내 상장사) | 접수일 | 인증키 신청 메뉴 있음. 요구 여부·한도는 소개 페이지에서 확인 못 함 | 소개 페이지만 읽음 [s15] |
| 보류: Reddit, Google Play 리뷰 | 반응 | — | — | 공식 경로·약관을 이번에 확인하지 않음. 확인 전까지 보류 |

### 7.4 MCP 확장 (읽기 전용 유지)

| 도구 | 반환 | 쓰임 |
|---|---|---|
| `get_brief(collection)` | 개요 · 가정 · 수정 이력 | 다른 작업 중에도 조사의 목적을 잃지 않음 |
| `get_conclusion(collection)` | 결론 · 근거 3개 · 열린 질문 | 결론만 필요한 에이전트용 |
| `get_rationale(query \| axis \| S#)` | 역추적 카드 (왜 · 근거 종류 · 결과) | 다른 조사에서 '왜'를 재사용 |
| 기존 `search_references`·`search_findings`에 `since`·`fresh_only` | 날짜 거른 결과 | 최신 근거만 |

### 7.5 에이전트 도구 사용 지시 (1단계, SKILL.md)

| # | 지시 | 이유 |
|---|---|---|
| T8 | Q1·Q2 질문은 Claude Code의 **AskUserQuestion**으로 보기형으로 묻는다 (질문 4개 한도가 Q1과 같다). 보기는 질문당 4개까지라 가치 유형은 유력한 3~4개만 보여 주고 나머지는 '기타'로 받는다. 이 도구가 없는 환경에서는 텍스트로 묻는다 | 보기가 있으면 추상적인 요청을 고르기 쉽다 |
| T9 | WebSearch는 날짜 정렬이 없으므로 0바퀴 질의에 연도·"latest"·"changelog"를 넣는다. 커넥터가 있으면 그쪽을 먼저 쓴다 | F1 |
| (선택) | 가치 유형이 둘 이상이면 채널별 탐색을 서브에이전트로 나눌 수 있다. 비용이 크므로 사용자가 원할 때만 | 속도 |

## 8. 결정 사항 (2026-11-04)

| # | 결정 | 반영 |
|---|---|---|
| ① | 1단계(SKILL.md) 후 2단계(CLI·보드)로 나눠 진행 | 9절 |
| ② | 범위에서 '유사(analogous)' 제거. 직접 · 간접 · 트렌드 3갈래 | Q3 · Q7 · T10. 다른 업종이지만 구조가 같은 것은 간접에 넣는다 |
| ③ | 신선도 기준 12개월 단일 | F3 · F6 · T6. 12개월 초과와 날짜 미상은 '지난 자료' |

## 9. 단계 계획

### 1단계: SKILL.md (+ 역할 어휘)
- **범위:** F1 · F2 · F3 · Q1~Q5 · Q7(어휘) · C1 · C2 · W1 · R1 · T8 · T9.
- **코드 예외 (역할 어휘):** `store.mjs`의 `ROLES`에 `trend`를 추가한다(`analogous`는 기존 데이터 때문에 받기만 함). 같은 어휘를 따로 쓰는 `evidence.mjs`(태그 → 역할), `board.mjs`(`ROLE_KO` · 역할 칩 색 · 역할 필터), `report.mjs`(`ROLE_ORDER`)도 맞춘다.
  - 이유: 없으면 `collect`가 모르는 역할을 조용히 지운다 (`store.mjs` `addMember`).
- **domain:** C3 전까지 전략·사용자 반응·여행은 `research`로 둔다.
- **확인:**
  - `dev/test.sh`를 돌린다.
  - 임시 라이브러리(`REF_LIBRARY`·`REF_HOME`)에서 중립 주제로 한 회차를 돌려 질문 루프·순환·6칸 노트·요약 순서를 확인한다.
  - `dev/sync-local.sh`로 로컬 설치에 반영한다.

### 2단계: CLI·보드·MCP
| 묶음 | 항목 |
|---|---|
| 2a 데이터 | F4/T3 · T4 · Q6/T1 · T2 · C3 · C4 · W2 · T10 (역할 이전) |
| 2b 점검 명령 | F6/T6 · C5/T5 |
| 2c 보드 | R2 · R3 · R4 · R5 · R6 · W3 (렌더링 화면으로 확인 — CLAUDE.md 규칙) |
| 2d MCP | W5 · T7 |
| 2e 커넥터 (선택) | HN · App Store 리뷰 · GitHub Releases 먼저, 키가 필요한 네이버 · OpenDART는 그다음 |

릴리스: 2단계가 끝나면 `docs/RELEASE.md` 절차로 버전을 올린다.

### 3단계: 검증
- 실사용 조사 1건을 새 흐름으로 다시 돌린다.
- 같은 잣대(목적 적합 · 위계 · 일관성 · 신선도 · 근거 세기)로 이전 회차와 비교한다.
- 채널 표는 실제 조사 2회 뒤 `ref learn`으로 보정한다.

## 10. 위험

| 위험 | 대응 |
|---|---|
| 질문이 많아 지침 | 2라운드 · 4문항 상한. 요청에 이미 있으면 생략 |
| 최신 편향으로 원리를 잃음 | '원리' 자리와 `scope:"원리"` 예외 |
| 소급 경고 폭주 (발견 80%) | 새 회차부터 경고, 기존은 배지만 |
| 채널 표 근거가 약함 | 3단계 검증 뒤 보정 |
| 분석 비용 증가 | 6칸 전부는 핵심 3~5건만 |
| 커넥터 키 노출 | 환경 변수만. 라이브러리·보드·로그에 남기지 않음 |
| 비공식 경로(App Store 리뷰 RSS) 변경 | 선택 커넥터로 두고, 실패하면 캡처로 대체 |

## 출처

### 원문을 읽은 자료
1. Bates, M. J. (1989). The design of browsing and berrypicking techniques for the online search interface. *Online Review* 13(5). https://www.pages.gseis.ucla.edu/faculty/bates/articles/berrypicking.pdf
2. Penn State, Scientific Presentations — Research (Garner·Alley·Wolfe·Sawarynski 2013 외). https://writing.engr.psu.edu/research.html
3. Schade, A. (2018-02-11). Inverted Pyramid: Writing for Comprehension. NN/g. https://www.nngroup.com/articles/inverted-pyramid/
4. Few, S. (2008-02). Practical Rules for Using Color in Charts. https://www.makinggood.ac.nz/media/1257/few_2008_rules_for_using_color.pdf
5. Zhang, T. 외 (2024). CLAMBER. ACL 2024. https://arxiv.org/abs/2405.12063
6. University of Edinburgh, Reflection Toolkit — What? So what? Now what? https://reflection.ed.ac.uk/reflectors-toolkit/reflecting-on-experience/what-so-what-now-what
7. Koji (2026-09-28, 업체 문서). How Long Is User Research Valid? https://www.koji.so/docs/research-refresh-cadence
8. Southern Utah University Library. CRAAP Test. https://library.suu.edu/LibraryResearch/craap-test
9. Adeniyi, K. (2025-01-03). What is a product teardown? LogRocket. https://blog.logrocket.com/product-management/what-is-a-product-teardown-process-tools/

### 실측 (2026-11-04, 공개 엔드포인트 GET)
- HN Algolia `https://hn.algolia.com/api/v1/search_by_date`
- 웹 아카이브 CDX `https://web.archive.org/cdx/search/cdx` (README: https://github.com/internetarchive/wayback/blob/master/wayback-cdx-server/README.md, 읽음)
- App Store 리뷰 RSS `https://itunes.apple.com/kr/rss/customerreviews/page=1/id=<id>/sortby=mostrecent/json`
- GitHub REST `https://api.github.com/repos/<owner>/<repo>/releases`

### 검색 요약으로만 본 자료 (판정의 보조)
- s1. Wohlin (2014), snowballing 가이드라인. https://swov.nl/en/publicatie/guidelines-snowballing-systematic-literature-studies-and-replication-software
- s2. Borland & Taylor (2007), Rainbow Color Map (Still) Considered Harmful (서지만 확인). https://www.sci.utah.edu/~kpotter/Library/Papers/borland:2007:RCCH/index.html
- s3. Ware·Stone·Szafir (2023), Rainbow Colormaps Are Not All Bad. https://ccom.unh.edu/publications/rainbow-colormaps-are-not-all-bad
- s4. Alley 그룹 2012 후속 연구 (원문 URL 미확정)
- s5. BLUF / AR 25-50. https://en.wikipedia.org/wiki/BLUF_(communication)
- s6. MacLean·Young·Bellotti·Moran (1991), QOC. https://acawiki.org/Questions,_Options,_and_Criteria:_Elements_of_design_space_analysis
- s7. Double Diamond. https://dovetail.com/product-development/what-is-the-double-diamond-design-process
- s8. Minto Pyramid Principle. https://thinkinsights.net/strategy/pyramid-principle
- s9. GOV.UK, Writing for GOV.UK (리다이렉트로 원문 못 읽음). https://www.gov.uk/guidance/content-design/writing-for-gov-uk
- s10. 리뷰 마이닝 가이드. https://www.revenuecat.com/blog/growth/review-mining-for-subscription-apps.md
- s11. Mobbin vs Dribbble. https://thegtmdirectory.com/compare/mobbin-vs-dribbble
- s12. DART로 회사 분석하기. https://www.tossbank.com/articles/dart
- s13. App Store 리뷰 RSS 상한 보고. https://developer.apple.com/forums/thread/685441
- s14. NAVER API HUB 블로그 검색 문서. https://api.ncloud-docs.com/docs/naver-api-hub-search-blog
- s15. OpenDART 소개 (읽음, 키·한도 기재 없음). https://opendart.fss.or.kr/intro/main.do
