# 지금 상태 (마스터가 단계마다 갱신 · 10줄 이내 · CLAUDE.md 6절)

- 갱신: 2026-11-12 · 배포: **v0.5.1**(main 6dcb7f8, 라이브 번들 확인) · 작업 브랜치: spec-011(문서 커밋은 main보다 앞섬 — 다음 배포 때 함께)
- 운영 구조 **v2 적용**(74c3fcd, 결정 `ai-log/decisions-2026-11.md` 후속 224): 마스터 단독 기본 · FAST/STANDARD/CRITICAL · CRITICAL은 Codex 먼저 · 지표 `ai-log/metrics.md`
- SPEC-018 「맞춤 인생」: v0.6.0(M1 기질·적성·갈림길·직업·외모 영향·밀레니얼) → v0.6.1(초점·돈 쓰기·얼굴) → v0.7.0 X·Z → v0.8.x SPEC-017
- 설계 `docs/data/persona-model.md` **r4 승인 완료**(후속 228~230 — 기질 가·적성 이름·INVEST_Q B·외모 연애 k 0.70·CX-002 반영 진로 트랙·4C 시대). Codex 처리 `docs/review/codex/CX-002-SPEC-018-design/resolution.md`
- 진행 중: **T3 마무리** — CX-003 처리 828daa1(지적 7건 재현·수정, resolution) · v0.5.1 회귀 e2e 10건 수정(후속 235, 1280×800 첫 화면 가림 — 배포 여부 형진 님 판단) · 남은 e2e 1건(R-438 360×740 log-list 포커스) · WebKit · e2e:prod. 끝난 것: 1단계(2cb6630) · 2단계(7559ca9) · 3a(0f6c15f) · 3b(736d15a) · IMG-001 PASS
- 다음: CX-003 재검증(001·002 첫 질문) → 콘텐츠 PL5(진로 카드 질문 문장 포함)·PL6·PL17 → `report:persona` · 수저 40대 비(3.0~3.97배)·알파 노년(진로 카드로 −0.08) GM10/PL5 뒤 재측정
- 효율화 과제(하나씩 승인): 시험 단계 npm 스크립트 · 자동 스크린샷 추적 정리 · 문서 분리 · 구현 종속 시험 전환
- 후속: SPEC-016 낮음(R-684·R-681a 등, TODO) · wiki v0.4.1 조작 행 · R-670 재측정 · AK9 반려동물 · 한 부모 「부모님」 2사건 · 플레이테스트 확인 포인트
- 다음 지적 ID R-686 · 다음 Codex CX-003(CX-004 = M2) · 공개 뒤 가족 골든 갱신은 One-way
