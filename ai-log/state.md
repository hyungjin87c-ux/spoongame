# 지금 상태 (마스터가 단계마다 갱신 · 10줄 이내 · CLAUDE.md 6절)

- 갱신: 2026-11-12 · 배포: **v0.5.1**(main 6dcb7f8, 라이브 번들 확인) · 작업 브랜치: spec-011(문서 커밋은 main보다 앞섬 — 다음 배포 때 함께)
- 운영 구조 **v2 적용**(74c3fcd, 결정 `ai-log/decisions-2026-11.md` 후속 224): 마스터 단독 기본 · FAST/STANDARD/CRITICAL · CRITICAL은 Codex 먼저 · 지표 `ai-log/metrics.md`
- SPEC-018 「맞춤 인생」: v0.6.0(M1 기질·적성·갈림길·직업·외모 영향·밀레니얼) → v0.6.1(초점·돈 쓰기·얼굴) → v0.7.0 X·Z → v0.8.x SPEC-017
- 설계 `docs/data/persona-model.md` **r4 승인 완료**(후속 228~230 — 기질 가·적성 이름·INVEST_Q B·외모 연애 k 0.70·CX-002 반영 진로 트랙·4C 시대). Codex 처리 `docs/review/codex/CX-002-SPEC-018-design/resolution.md`
- 진행 중: **T3**(3b 커밋 뒤 — npm test 전체·e2e·WebKit·e2e:prod) → CX-003 요청(초안 scratchpad). 끝난 것: 1단계 골든(2cb6630) · 2단계(7559ca9) · 3a 진로 트랙(0f6c15f) · 3b 외모 영향·스위치 켬·후속 233(합격 소득 이전·진로 카드 페이싱 1장·첫사랑 −3 삭제·측정 결함 수정) · IMG-001 PASS(후속 232)
- 다음: CX-003 Codex 코드 검증(진로 트랙 첫 질문, 비교 2f0239e → 3b) → 콘텐츠 PL5·PL6·PL17 → 실측 `report:persona`(기질 shown≠born 0% 문제) · 수저 40대 비(3.2~3.9배, 알려진 차이) PL5 뒤 재측정
- 효율화 과제(하나씩 승인): 시험 단계 npm 스크립트 · 자동 스크린샷 추적 정리 · 문서 분리 · 구현 종속 시험 전환
- 후속: SPEC-016 낮음(R-684·R-681a 등, TODO) · wiki v0.4.1 조작 행 · R-670 재측정 · AK9 반려동물 · 한 부모 「부모님」 2사건 · 플레이테스트 확인 포인트
- 다음 지적 ID R-686 · 다음 Codex CX-003(CX-004 = M2) · 공개 뒤 가족 골든 갱신은 One-way
