# SPEC-009 FM4b·시대의 창 QA 재현 도구 (2026-11-02)

저장소 루트에서 돌린다. 개발 서버는 미리 `npm run dev -- --port 5199 --strictPort`로 띄워 두고(끝나면 PID로 끈다) `QA_BASE=http://localhost:5199`를 준다. 프로덕션 번들은 `npm run build` 뒤 `npm run preview -- --port 4198 --strictPort`.
맨몸 `npx`는 쓰지 않는다 — `./node_modules/.bin/vite-node`·`node`를 쓴다.

1. 판 고르기(코어 탐색 → `states/*.json` 생성, 커밋하지 않는다): `vite-node qa/scripts/009/pick.ts` → `expect.ts` → `dump0.ts`·`dump1.ts`·`dump2.ts`·`dump3.ts`
2. R-558 공격(미성년 「혼자 지냅니다」 0): `vite-node qa/scripts/009/scan-alone.ts` (`QA_LIVES=1500`)
3. 브라우저 조작: `trace.mjs`(한 판 해마다 기록) · `era2009.mjs` · `p1.mjs` · `thatch.mjs` · `p360.mjs` · `attack.mjs <시나리오>` · `determ.mjs` · `statesrun.mjs <키…>` · `gentlefam.mjs` · `v030.mjs` · `bigtext.mjs` · `words.mjs` · `forcedcard.mjs` · `goneSib.mjs` · `skipfam.mjs` · `mash.mjs` · `deathreload.mjs` · `drift.mjs` · `wk263*.mjs` · `prodslow.mjs`(프로덕션 번들) · `realflow.mjs` · `holds.mjs`
4. WebKit 부분 실행: `./node_modules/.bin/playwright test -c qa/scripts/009/pw-webkit-qa.config.cjs`
리포트는 `qa/reports/QA-009-FM4b.md`.

## FM7a QA (2026-11-06) — `fm7a-*`
개발 서버 `./node_modules/.bin/vite --port 5311 --strictPort`(끝나면 PID로 끈다) + `QA_BASE=http://localhost:5311`, 판 파일은 저장소 밖에 둔다: `QA_OUT=<폴더>`(고르기) / `QA_STATES=<폴더>`(조작). 맨몸 `npx` 금지 — `./node_modules/.bin/vite-node`·`node`.
1. 고르기(코어 탐색, 판정 기준 아님): `fm7a-pick.ts`(T01~T10·옮겨진 별세·비어 가는 방·senior-alone) · `fm7a-pick2.ts`(옛 규칙 양성 대조: 같은 해 모순이 실제로 났던 판) · `fm7a-pick3.ts`(자녀 독립) · `fm7a-pick4.ts`(T10 글감) · `fm7a-pick5.ts`(떠난 가족이 가장 긴 판)
2. 화면 조작: `fm7a-text.mjs`(문장 노출, `FAM=1` 가족 카드) · `fm7a-t09/ages/cardscene/child/note.mjs` · `fm7a-gentle.mjs`(가리기·Tab 순서) · `fm7a-sameyear.mjs`(같은 해 모순·카드 새로고침·뒤로가기) · `fm7a-pending.mjs`(`pending.choiceIds` 복원·변조) · `fm7a-attack.mjs <legacy|tamper|tabs|rapid|killreload|backbtn|gentletoggle>` · `fm7a-m360.mjs` · `fm7a-ending.mjs`·`fm7a-ending2.mjs` · `fm7a-fullrun.mjs`(첫 화면부터 한 판)
3. 코어 보조: `fm7a-inherit.ts`(형제 별세 on/off 상속·형제 수·출생신고)
4. 렌더러 크래시 조사: `fm7a-crash.mjs`·`fm7a-crash3.mjs`(v0.3.0 트리에서도 같은 연타로 재현 — 리포트 RECORD 1)·`fm7a-crash4.mjs`(프로덕션 번들)·`fm7a-crash5.mjs`(CDP 지표)
