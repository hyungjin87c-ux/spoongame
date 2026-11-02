# SPEC-009 FM4b·시대의 창 QA 재현 도구 (2026-11-02)

저장소 루트에서 돌린다. 개발 서버는 미리 `npm run dev -- --port 5199 --strictPort`로 띄워 두고(끝나면 PID로 끈다) `QA_BASE=http://localhost:5199`를 준다. 프로덕션 번들은 `npm run build` 뒤 `npm run preview -- --port 4198 --strictPort`.
맨몸 `npx`는 쓰지 않는다 — `./node_modules/.bin/vite-node`·`node`를 쓴다.

1. 판 고르기(코어 탐색 → `states/*.json` 생성, 커밋하지 않는다): `vite-node qa/scripts/009/pick.ts` → `expect.ts` → `dump0.ts`·`dump1.ts`·`dump2.ts`·`dump3.ts`
2. R-558 공격(미성년 「혼자 지냅니다」 0): `vite-node qa/scripts/009/scan-alone.ts` (`QA_LIVES=1500`)
3. 브라우저 조작: `trace.mjs`(한 판 해마다 기록) · `era2009.mjs` · `p1.mjs` · `thatch.mjs` · `p360.mjs` · `attack.mjs <시나리오>` · `determ.mjs` · `statesrun.mjs <키…>` · `gentlefam.mjs` · `v030.mjs` · `bigtext.mjs` · `words.mjs` · `forcedcard.mjs` · `goneSib.mjs` · `skipfam.mjs` · `mash.mjs` · `deathreload.mjs` · `drift.mjs` · `wk263*.mjs` · `prodslow.mjs`(프로덕션 번들) · `realflow.mjs` · `holds.mjs`
4. WebKit 부분 실행: `./node_modules/.bin/playwright test -c qa/scripts/009/pw-webkit-qa.config.cjs`
리포트는 `qa/reports/QA-009-FM4b.md`.
