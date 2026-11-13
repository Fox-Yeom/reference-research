// Demo data for the board drafts: dev/demo.sh collection + fictional home collections (synthetic: true).
window.DEMO = {
 "board": {
  "id": "note-app-pricing",
  "title": "메모 앱 요금제 비교 (예시)",
  "kind": "카테고리 조사",
  "domain": "디자인·기획",
  "date": "2026-11-13",
  "goal": "메모·할 일 앱 요금제를 비교해 우리 앱의 무료/유료 구성을 정한다",
  "audience": "요금제를 처음 설계하는 1인 개발자",
  "question": "첫 유료 단계를 어디에 두고, 무엇을 유료로 묶을까?",
  "brief": {
   "문제": "무료 범위를 어디까지 둘지 정하지 못함",
   "성공 기준": "무료/유료 경계 안 1개와 가격 구간",
   "제외": "기업용 계약 조건"
  },
  "answer": {
   "text": "무료 1단과 개인 유료 1단으로 시작하고, 동기화를 유료 경계 후보로 둔다",
   "claims": [
    "C2",
    "C4"
   ]
  },
  "proposal": {
   "text": "월간/연간 결제 토글을 두고 개인 유료 첫 단계 가격을 비교 3곳의 구간 안에서 정한다",
   "claims": [
    "C1",
    "C5"
   ]
  },
  "evidence": [
   {
    "text": "5곳 모두 월간/연간 결제 토글을 둔다",
    "claims": [
     "C1"
    ],
    "refs": [
     "S1"
    ],
    "strength": "강함"
   },
   {
    "text": "무료 단계 옆에 유료 단계를 나란히 비교한다",
    "claims": [
     "C2"
    ],
    "refs": [
     "S2"
    ],
    "strength": "강함",
    "countered": true
   },
   {
    "text": "Obsidian은 앱을 무료로 두고 동기화·게시만 판다",
    "claims": [
     "C4"
    ],
    "refs": [
     "S4"
    ],
    "strength": "보통"
   }
  ],
  "counter": {
   "against": 2,
   "text": "Evernote 요금표 첫 화면에는 ₩0 단계가 없어 무료 단계가 필수는 아니다",
   "claims": [
    "C6"
   ],
   "refs": [
    "S3"
   ]
  },
  "common": [
   [
    "기본기",
    "월간/연간 토글",
    "C1"
   ],
   [
    "기본기",
    "무료 + 유료 나란히 비교",
    "C2"
   ],
   [
    "선택지",
    "팀·기업 단계를 문의형으로 분리",
    "C3"
   ],
   [
    "차별점 후보",
    "앱은 무료, 동기화·게시만 판매",
    "C4"
   ]
  ],
  "avoid": [
   {
    "text": "유료 단계를 늘리면서 무료 단계를 표에서 빼는 조합. 무료로 시작하려는 사람이 경계를 찾기 어렵다는 추정이다",
    "claims": [
     "C6"
    ]
   }
  ],
  "recommend": [
   {
    "text": "무료 + 개인 유료 1단으로 시작",
    "why": "단계가 적어야 첫 버전의 경계를 시험하기 쉽다",
    "claims": [
     "C2"
    ]
   },
   {
    "text": "동기화를 유료 기능으로 묶는 안 검토",
    "why": "서버 비용이 드는 기능과 유료 경계를 맞출 수 있는지 본다",
    "claims": [
     "C4"
    ]
   }
  ],
  "open": [
   {
    "text": "동기화를 유료로 묶으면 무료 사용자가 얼마나 이탈하나",
    "why": "답에 따라 무료 범위가 바뀐다",
    "claims": [
     "C4"
    ]
   },
   {
    "text": "팀 요금제가 첫 버전에 필요한가",
    "why": "필요하면 문의형 단계를 표에 넣는다",
    "claims": [
     "C3"
    ]
   }
  ],
  "process": "README 예시용 조사다. 요금제 페이지 5곳을 캡처해 화면에 보이는 내용만 기록했고, 바퀴 기록의 질의는 보여 주기 위한 예시다.",
  "refs": [
   {
    "id": "S1",
    "product": "Notion",
    "page": "요금제",
    "url": "https://www.notion.com/pricing",
    "type": "공식",
    "cred": "A",
    "role": "직접 경쟁",
    "tags": [
     {
      "id": "freemium-compare",
      "label": "무료 vs 프리미엄 비교표"
     },
     {
      "id": "annual-monthly-equivalent",
      "label": "연간 결제를 월 환산가로 표기"
     },
     {
      "id": "dense-table",
      "label": "고밀도 표 화면"
     }
    ],
    "basis": "정황",
    "note": [
     [
      "기능",
      "Free ₩0 · Plus ₩14,000 · Business ₩30,000 · Enterprise 4단, 연간 결제 토글에 Save up to 20% 문구 [S1]"
     ],
     [
      "맥락",
      "개인과 팀을 한 표에서 고르는 화면"
     ],
     [
      "의도",
      "Business에만 Recommended 배지를 달아 팀 단계로 시선을 모은다 [S1]"
     ],
     [
      "대안",
      "Evernote는 개인용과 팀용을 두 묶음으로 나눈다 [S3]"
     ],
     [
      "결과",
      "효과 수치는 페이지에 없다"
     ],
     [
      "시사점",
      "변형 — 추천 단계 하나만 강조한다 (조건: 유료 단계가 2개 이상일 때)"
     ]
    ],
    "images": [
     "img/s1-1.jpg",
     "img/s1-2.jpg",
     "img/s1-3.jpg"
    ]
   },
   {
    "id": "S2",
    "product": "Todoist",
    "page": "요금제",
    "url": "https://www.todoist.com/ko/pricing",
    "type": "공식",
    "cred": "A",
    "role": "직접 경쟁",
    "tags": [
     {
      "id": "two-tier",
      "label": "2단 요금제"
     },
     {
      "id": "freemium-compare",
      "label": "무료 vs 프리미엄 비교표"
     },
     {
      "id": "annual-monthly-equivalent",
      "label": "연간 결제를 월 환산가로 표기"
     }
    ],
    "basis": null,
    "note": [
     [
      "기능",
      "비기너 $0 · 프로 $5 · 비지니스 $8, 연간 토글에 20% 할인 표시 [S2]"
     ],
     [
      "시사점",
      "차용 — 무료와 유료 기능을 표 하나로 비교한다"
     ]
    ],
    "images": [
     "img/s2-1.jpg",
     "img/s2-2.jpg",
     "img/s2-3.jpg"
    ]
   },
   {
    "id": "S3",
    "product": "Evernote",
    "page": "요금제 비교",
    "url": "https://evernote.com/ko-kr/compare-plans",
    "type": "공식",
    "cred": "A",
    "role": "직접 경쟁",
    "tags": [
     {
      "id": "annual-monthly-equivalent",
      "label": "연간 결제를 월 환산가로 표기"
     }
    ],
    "basis": null,
    "note": [
     [
      "기능",
      "개인용 Starter · Advanced와 팀용 Flexible · Enterprise를 두 묶음으로 나눈다. Enterprise는 영업팀 문의 [S3]"
     ],
     [
      "시사점",
      "변형 — 개인과 팀을 나누되 무료 단계는 표에 남긴다"
     ]
    ],
    "images": [
     "img/s3-1.jpg",
     "img/s3-2.jpg",
     "img/s3-3.jpg"
    ]
   },
   {
    "id": "S4",
    "product": "Obsidian",
    "page": "요금제",
    "url": "https://obsidian.md/pricing",
    "type": "공식",
    "cred": "A",
    "role": "간접 경쟁",
    "tags": [
     {
      "id": "why-pay-section",
      "label": "'왜 유료인가' 설명"
     }
    ],
    "basis": "공식",
    "note": [
     [
      "기능",
      "Free without limits, 가입 없이 사용. Sync $4 · Publish $8를 부가 서비스로 판매 [S4]"
     ],
     [
      "맥락",
      "개인 노트 앱, 앱 자체에는 요금 단계가 없다"
     ],
     [
      "의도",
      "페이지가 100% user-supported라고 밝히고 부가 서비스와 Catalyst·Commercial 라이선스를 판다 [S4]"
     ],
     [
      "대안",
      "Notion은 기능 단계를 나눠 판다 [S1]"
     ],
     [
      "결과",
      "효과 수치는 페이지에 없다"
     ],
     [
      "시사점",
      "변형 — 핵심 기능은 무료로 두고 동기화만 유료로 묶는다 (조건: 서버 비용이 동기화에 몰릴 때)"
     ]
    ],
    "images": [
     "img/s4-1.jpg",
     "img/s4-2.jpg",
     "img/s4-3.jpg"
    ]
   },
   {
    "id": "S5",
    "product": "Craft",
    "page": "요금제",
    "url": "https://www.craft.do/ko/pricing",
    "type": "공식",
    "cred": "A",
    "role": "간접 경쟁",
    "tags": [
     {
      "id": "freemium-compare",
      "label": "무료 vs 프리미엄 비교표"
     },
     {
      "id": "annual-monthly-equivalent",
      "label": "연간 결제를 월 환산가로 표기"
     },
     {
      "id": "illustration-hero",
      "label": "일러스트 히어로"
     }
    ],
    "basis": null,
    "note": [
     [
      "기능",
      "Starter ₩0 · Plus ₩9,667 · Team $5/멤버(최소 3명) · Enterprise 상담. 비교표에 최대 6명 플랜도 있다 [S5]"
     ],
     [
      "시사점",
      "피할 점 없음 — 구름 일러스트 배경은 브랜드 표현이라 그대로 따르지 않는다"
     ]
    ],
    "images": [
     "img/s5-1.jpg",
     "img/s5-2.jpg",
     "img/s5-3.jpg"
    ]
   }
  ],
  "claims": [
   {
    "id": "C1",
    "text": "요금제 페이지 5곳 모두 월간/연간 결제 토글을 둔다",
    "kind": "패턴",
    "subject": "결제 주기",
    "key": true,
    "strength": "강함",
    "sources": [
     "S1",
     "S2",
     "S3",
     "S4",
     "S5"
    ],
    "run": "R1"
   },
   {
    "id": "C2",
    "text": "무료 단계를 맨 왼쪽에 두고 유료 단계를 나란히 비교하는 구성이 많다",
    "kind": "패턴",
    "subject": "단계 구성",
    "key": true,
    "strength": "강함",
    "sources": [
     "S1",
     "S2",
     "S5"
    ],
    "run": "R1"
   },
   {
    "id": "C3",
    "text": "팀·기업 최상위 단계는 가격 대신 문의로 분리한다",
    "kind": "패턴",
    "subject": "기업 단계",
    "key": false,
    "strength": "강함",
    "sources": [
     "S3",
     "S5"
    ],
    "run": "R1"
   },
   {
    "id": "C4",
    "text": "Obsidian은 앱을 무료로 두고 동기화·게시를 부가 서비스로 판매한다",
    "kind": "사실",
    "subject": "Obsidian",
    "key": true,
    "strength": "보통",
    "sources": [
     "S4"
    ],
    "run": "R1"
   },
   {
    "id": "C5",
    "text": "개인 유료 첫 단계는 Todoist $5 · Craft ₩9,667 · Notion ₩14,000(월, 연간 결제 기준) 수준이다",
    "kind": "기준치",
    "subject": "개인 유료 가격",
    "key": false,
    "strength": "강함",
    "sources": [
     "S1",
     "S2",
     "S5"
    ],
    "run": "R1"
   },
   {
    "id": "C6",
    "text": "Evernote 요금표 첫 화면의 플랜 4개에는 ₩0 단계가 없다",
    "kind": "사실",
    "subject": "Evernote 무료 단계",
    "key": false,
    "strength": "보통",
    "sources": [
     "S3"
    ],
    "run": "R1"
   }
  ],
  "rounds": [
   {
    "n": 1,
    "queries": [
     "note taking app pricing 2026",
     "todo app pricing comparison 2026",
     "메모 앱 요금제 비교 2026",
     "할 일 앱 유료 구독 2026"
    ],
    "found": [
     "Notion",
     "Todoist",
     "Evernote"
    ],
    "newAxes": [
     "월간/연간 토글",
     "무료 + 유료 비교표"
    ],
    "stopped": null
   },
   {
    "n": 2,
    "queries": [
     "obsidian sync pricing latest",
     "craft docs pricing plans 2026",
     "메모 앱 동기화 유료"
    ],
    "found": [
     "Obsidian",
     "Craft"
    ],
    "newAxes": [
     "기능 단위 판매"
    ],
    "stopped": null
   },
   {
    "n": 3,
    "queries": [
     "note app family plan pricing"
    ],
    "found": [],
    "newAxes": [],
    "stopped": "새 패턴 없음"
   }
  ],
  "axes": [
   {
    "id": "data-views",
    "label": "데이터 보기 방식",
    "question": "데이터를 어떤 화면 형식으로 보나?",
    "verdict": null,
    "members": [
     {
      "ref": "S1",
      "tags": [
       "고밀도 표 화면"
      ]
     }
    ]
   },
   {
    "id": "hero-visual",
    "label": "히어로 비주얼 방식",
    "question": "첫 화면을 무엇으로 채우나?",
    "verdict": null,
    "members": [
     {
      "ref": "S5",
      "tags": [
       "일러스트 히어로"
      ]
     }
    ]
   },
   {
    "id": "pricing-justification",
    "label": "가격 설계·정당화",
    "question": "가격을 어떻게 설계하고 설득하나?",
    "verdict": "월간/연간 토글은 기본기 — 따라간다 [C1]",
    "members": [
     {
      "ref": "S1",
      "tags": [
       "무료 vs 프리미엄 비교표",
       "연간 결제를 월 환산가로 표기"
      ]
     },
     {
      "ref": "S2",
      "tags": [
       "2단 요금제",
       "무료 vs 프리미엄 비교표",
       "연간 결제를 월 환산가로 표기"
      ]
     },
     {
      "ref": "S3",
      "tags": [
       "연간 결제를 월 환산가로 표기"
      ]
     },
     {
      "ref": "S4",
      "tags": [
       "'왜 유료인가' 설명"
      ]
     },
     {
      "ref": "S5",
      "tags": [
       "무료 vs 프리미엄 비교표",
       "연간 결제를 월 환산가로 표기"
      ]
     }
    ]
   }
  ]
 },
 "home": {
  "collections": [
   {
    "runsAt": [
     "2026-11-13"
    ],
    "newByRun": [
     6
    ],
    "id": "note-app-pricing",
    "title": "메모 앱 요금제 비교 (예시)",
    "domain": "디자인·기획",
    "topic": "요금·수익",
    "date": "2026-11-13",
    "question": "첫 유료 단계를 어디에 두고, 무엇을 유료로 묶을까?",
    "answer": "무료 1단과 개인 유료 1단으로 시작하고, 동기화를 유료 경계 후보로 둔다",
    "refs": 5,
    "claims": 6,
    "runs": 1,
    "open": 2,
    "thumb": "img/s1-1.jpg",
    "thumbs": [
     "img/s1-1.jpg",
     "img/s2-1.jpg",
     "img/s4-1.jpg"
    ],
    "synthetic": false
   },
   {
    "runsAt": [
     "2026-11-03",
     "2026-11-10"
    ],
    "newByRun": [
     6,
     3
    ],
    "id": "weather-app-home",
    "title": "날씨 앱 첫 화면 비교",
    "domain": "디자인·기획",
    "topic": "첫 화면·온보딩",
    "date": "2026-11-10",
    "question": "첫 화면에서 오늘 날씨를 어떻게 보여 줄까?",
    "answer": "기온 하나를 크게 두고 시간별 예보는 아래로 내린다",
    "refs": 12,
    "claims": 9,
    "runs": 2,
    "open": 1,
    "synthetic": true
   },
   {
    "runsAt": [
     "2026-11-06"
    ],
    "newByRun": [
     7
    ],
    "id": "photo-app-onboarding",
    "title": "사진 정리 앱 온보딩",
    "domain": "디자인·기획",
    "topic": "첫 화면·온보딩",
    "date": "2026-11-06",
    "question": "사진 접근 권한을 언제, 어떤 말로 요청할까?",
    "answer": "첫 정리 결과를 보여 준 뒤 권한을 요청한다",
    "refs": 8,
    "claims": 7,
    "runs": 1,
    "open": 3,
    "synthetic": true
   },
   {
    "runsAt": [
     "2026-10-08",
     "2026-10-18",
     "2026-10-29"
    ],
    "newByRun": [
     6,
     5,
     3
    ],
    "id": "indie-app-revenue",
    "title": "1인 개발 앱 수익 모델 자료",
    "domain": "전략·비즈니스",
    "topic": "요금·수익",
    "date": "2026-10-29",
    "question": "구독과 단건 구매 중 무엇으로 시작할까?",
    "answer": "근거가 아직 엇갈린다 — 구독 쪽 근거 4개, 단건 쪽 근거 3개",
    "refs": 21,
    "claims": 14,
    "runs": 3,
    "open": 2,
    "synthetic": true,
    "mixed": true
   },
   {
    "runsAt": [
     "2026-10-14",
     "2026-10-21"
    ],
    "newByRun": [
     8,
     3
    ],
    "id": "memo-app-reviews",
    "title": "메모 앱 리뷰 불만 모음",
    "domain": "사용자 반응",
    "topic": "요금·수익",
    "date": "2026-10-21",
    "question": "사용자가 유료 전환을 망설이는 이유는 무엇인가?",
    "answer": "동기화 가격보다 기기 수 제한에 대한 불만이 많다",
    "refs": 30,
    "claims": 11,
    "runs": 2,
    "open": 0,
    "synthetic": true
   }
  ],
  "shared": [
   {
    "ref": "S1",
    "product": "Notion",
    "in": [
     "note-app-pricing",
     "indie-app-revenue"
    ]
   },
   {
    "ref": "S4",
    "product": "Obsidian",
    "in": [
     "note-app-pricing",
     "memo-app-reviews",
     "indie-app-revenue"
    ]
   }
  ],
  "patterns": [
   {
    "label": "월간/연간 결제 토글",
    "question": "결제 주기를 어떻게 고르게 하나?",
    "verdict": "기본기 — 따라간다",
    "in": {
     "note-app-pricing": 5,
     "indie-app-revenue": 6
    }
   },
   {
    "label": "핵심 숫자 하나를 크게 표시",
    "question": "핵심 값을 어떻게 보여 주나?",
    "verdict": null,
    "in": {
     "weather-app-home": 7,
     "memo-app-reviews": 2
    }
   },
   {
    "label": "결과를 먼저 보여 주고 권한 요청",
    "question": "권한을 언제 묻나?",
    "verdict": "차용 — 첫 정리 결과 뒤에 묻는다",
    "in": {
     "photo-app-onboarding": 5,
     "weather-app-home": 2
    }
   }
  ],
  "recent": [
   {
    "date": "2026-11-13",
    "collection": "note-app-pricing",
    "run": "R1",
    "result": "무료 1단과 개인 유료 1단으로 시작하고, 동기화를 유료 경계 후보로 둔다",
    "newClaims": 6
   },
   {
    "date": "2026-11-10",
    "collection": "weather-app-home",
    "run": "R2",
    "result": "기온 하나를 크게 두는 안으로 좁힘",
    "newClaims": 3
   },
   {
    "date": "2026-11-06",
    "collection": "photo-app-onboarding",
    "run": "R1",
    "result": "권한 요청 시점 3가지 비교",
    "newClaims": 7
   }
  ]
 }
};
