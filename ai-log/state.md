# 지금 상태 (마스터가 단계마다 갱신 · 10줄 이내 · CLAUDE.md 6절)

- 갱신: 2026-11-13 · 배포: **v0.5.1**(main 6dcb7f8, 라이브 번들 확인) · 작업 브랜치: spec-011(v0.6.0 코드 + 문서 — 다음 배포 때 함께)
- 운영 구조 **v2**(후속 224) · QA는 Codex 유형 B로(후속 248) · 결정 기록 `ai-log/decisions-2026-11.md`
- SPEC-018 「맞춤 인생」: v0.6.0(M1 + PL5 큰 갈림길·병역·재수·강제 슬롯 + SPEC-019 나이 표시) → v0.6.1(초점·연애 교제 카드 후속 246·SPEC-020 한 번 쓰기) → v0.6.2(SPEC-020 보유) → v0.7.0 X·Z
- 진행 중: v0.6.0 **CX-004 Codex 대기**(A+B, 대상 eede085, `review/CX-004` → Codex 고정 폴더 체크아웃 완료) — T3 끝: npm test 5,625 통과 · e2e 전체 실패 원인별 처리(세대 줄 「·」 회귀 FitPair, 기대값 한국 나이) · WebKit 기존 실패 5건(main도 같음, TODO) · e2e:prod 34 통과(초기 로드 394,726 / 398,777 B)
- 다음: 형진 님 Codex 지시문 붙여 넣기 → findings 재현·처리(resolution.md) → 배포 승인 / G2 노출 64.6% 처리 방향(형진 님 답 대기) / SPEC-020 설계 문서(Codex 도는 동안)
- SPEC-020 돈 쓰기·투자 **r3 확정**(후속 250): 시대 시세 자료 수집(조사 에이전트 → `docs/data/market-history.md`) → 설계 `docs/data/spend-invest-model.md` → Codex C 레드팀
- 후속: 맞춤 판 남자 외모 1단계 35세 결혼 8.7%(보고 필요) · G4·G5 8(a) · SPEC-016 낮음(TODO) · developer worktree 정리 · 플레이테스트 확인 포인트
- 다음 지적 ID R-686 · 다음 Codex 번호 CX-005(CX-004 = 이번 M1 콘텐츠) · 공개 뒤 가족 골든 갱신은 One-way
