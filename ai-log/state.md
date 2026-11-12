# 지금 상태 (마스터가 단계마다 갱신 · 10줄 이내 · CLAUDE.md 6절)

- 갱신: 2026-11-12 · 배포: **v0.5.1**(main 6dcb7f8, 라이브 번들 확인) · 작업 브랜치: spec-011(문서 커밋은 main보다 앞섬 — 다음 배포 때 함께)
- 운영 구조 **v2 적용**(74c3fcd, 결정 `ai-log/decisions-2026-11.md` 후속 224): 마스터 단독 기본 · FAST/STANDARD/CRITICAL · CRITICAL은 Codex 먼저 · 지표 `ai-log/metrics.md`
- SPEC-018 「맞춤 인생」: v0.6.0(M1 기질·적성·갈림길·직업·외모 영향·밀레니얼) → v0.6.1(초점·돈 쓰기·얼굴) → v0.7.0 X·Z → v0.8.x SPEC-017
- 설계 `docs/data/persona-model.md` **r4 승인 완료**(후속 228~230 — 기질 가·적성 이름·INVEST_Q B·외모 연애 k 0.70·CX-002 반영 진로 트랙·4C 시대). Codex 처리 `docs/review/codex/CX-002-SPEC-018-design/resolution.md`
- 진행 중: **구현 3a 진로 트랙**(PL4 — 직업 표·지원 판정·HIREYEAR·jobMul·직업 카드 연결). 끝난 것: 1단계 골든(2cb6630) · 2단계 기질·적성·조건·저장(7559ca9, `PERSONA_ENABLED` false) · IMG-001 얼굴 80장 PASS(후속 232, 여성 3·4 맞바꿈)
- 다음: 3b PL16 외모 영향·스위치 켜기(골든은 스위치 끈 경로로 고정) → T3 → CX-003 Codex 코드 검증(진로 트랙 첫 질문) → 콘텐츠 PL5·PL6·PL17 → 실측 `report:persona`(기질 shown≠born 0% 문제)
- 효율화 과제(하나씩 승인): 시험 단계 npm 스크립트 · 자동 스크린샷 추적 정리 · 문서 분리 · 구현 종속 시험 전환
- 후속: SPEC-016 낮음(R-684·R-681a 등, TODO) · wiki v0.4.1 조작 행 · R-670 재측정 · AK9 반려동물 · 한 부모 「부모님」 2사건 · 플레이테스트 확인 포인트
- 다음 지적 ID R-686 · 다음 Codex CX-003(CX-004 = M2) · 공개 뒤 가족 골든 갱신은 One-way
