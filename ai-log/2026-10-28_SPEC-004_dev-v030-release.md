# 2026-10-28 SPEC-004 dev — v0.3.0 배포 준비

- 누가: developer
- 무엇을: copy.md 13-2 v0.3.0 블록(요약 + 항목 8)을 `src/data/releaseNotes.ts` `RELEASE_NOTES` 맨 위에 글자 그대로 옮기고 머리 주석에 v0.3.0 날짜 줄을 더했다. 버전 0.3.0: `package.json`, `package-lock.json` 루트 두 곳(`APP_VERSION`은 `vite.config.ts`가 package.json에서 주입하므로 하드코딩 없음).
- 시험 맞춤: `tests/infoPanel.test.tsx`(실제 노트는 앞에서 NOTES_OPEN_COUNT개만 펼침 — 네 버전 중 마지막 접힘), `e2e/info-panel.spec.ts`(버전 4개·순서·펼침 [t,t,t,f]·notesSeen 0.3.0·의견 주소 v0.3.0·박스 개수 4).
- 결과: npm test / typecheck / build / check:todo / check:dist 통과, e2e info-panel·link-underline 통과, e2e-prod initial-load chromium 6/6 통과(합계 345,120 B).
- 다음: 마스터 커밋·배포.
