# 지금 상태 (마스터가 단계마다 갱신 · 10줄 이내 · CLAUDE.md 6절)

- 갱신: 2026-11-13 · 배포: **v0.5.1**(main 6dcb7f8, 라이브 번들 확인) · 작업 브랜치: spec-011(문서 커밋은 main보다 앞섬 — 다음 배포 때 함께)
- 운영 구조 **v2 적용**(74c3fcd, 결정 `ai-log/decisions-2026-11.md` 후속 224): 마스터 단독 기본 · FAST/STANDARD/CRITICAL · CRITICAL은 Codex 먼저 · 지표 `ai-log/metrics.md`
- SPEC-018 「맞춤 인생」: v0.6.0(M1 기질·적성·갈림길·직업·외모 영향·밀레니얼) → v0.6.1(초점·돈 쓰기·얼굴) → v0.7.0 X·Z → v0.8.x SPEC-017
- 설계 `docs/data/persona-model.md` **r4 승인 완료**(후속 228~230 — 기질 가·적성 이름·INVEST_Q B·외모 연애 k 0.70·CX-002 반영 진로 트랙·4C 시대). Codex 처리 `docs/review/codex/CX-002-SPEC-018-design/resolution.md`
- 진행 중: **PL5 구현 커밋(e4ee33d)** · 병역·재수(후속 239)·큰 갈림길 강제 슬롯(후속 241) 구현 — 시험 갱신·기준선 재측정 중, `report:persona` 신설(1000판 측정 중). T5 ⑦ 사교육 보정 15.05%p(한도 15) 형진 님 보고 대기(후속 242). SPEC-019 r2(한국 나이 고정 + 헤더 작은 만 나이)는 개발 담당 worktree에서 진행
- 다음: 넓은 시험 재실행 → 커밋 → SPEC-019 r2 병합 → `report:time`·경제 가드 재측정 → PL6·PL17 초안 → T3 · CX-004
- 효율화 과제(하나씩 승인): 시험 단계 npm 스크립트 · 자동 스크린샷 추적 정리 · 문서 분리 · 구현 종속 시험 전환
- 후속: SPEC-016 낮음(R-684·R-681a 등, TODO) · wiki v0.4.1 조작 행 · R-670 재측정 · AK9 반려동물 · 한 부모 「부모님」 2사건 · 플레이테스트 확인 포인트
- 다음 지적 ID R-686 · 다음 Codex CX-003(CX-004 = M2) · 공개 뒤 가족 골든 갱신은 One-way
