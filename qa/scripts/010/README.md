# SPEC-009 FM6 + SPEC-010 묶음 QA 재현 도구 (2026-11-05)

저장소 루트에서 돌린다. 개발 서버는 미리 `./node_modules/.bin/vite --port 5199 --strictPort`로 띄우고(끝나면 PID로 끈다) `QA_BASE=http://localhost:5199`를 준다. 프로덕션 번들은 `npm run build` 뒤 `./node_modules/.bin/vite preview --port 4198 --strictPort`.
맨몸 `npx`는 쓰지 않는다. `states/`(생성물, 커밋하지 않는다)는 아래 순서로 만든다.

1. 상태 만들기: `node qa/scripts/010/snaps.mjs` (알파 2016생 재력 1·3·5의 나이별 스냅숏 → `states/snaps-W*.json`; `WS=2,4`로 재력 지정) · `find-big-family.mjs`·`find-gone9.mjs`·`find-bigchild.mjs` (식구 많은 판)
2. FM6 카드: `sweep.mjs <chromium|webkit> [fine] [font=150] [vw=340-400]`(폭 훑기, `fine`은 카드 폭 0.05px 단위) · `zoneall.mjs`·`zonecase.mjs`(0.5px 허용 구간) · `shot-r591.mjs`(증거 사진) · `bigcard.mjs`·`bigchild.mjs`·`scene-vs-card.mjs` · `basis-open.mjs` · `resize-attack.mjs` · `v030-names.mjs`
3. 코어(vite-node): `./node_modules/.bin/vite-node qa/scripts/010/spouse-age.ts 250` · `spouse-craft.ts` · `r575.ts` · `r580.ts`
4. SPEC-010: `future-windows.mjs [해,…] [gentle]` · `gentle2095.mjs` · `future-run.mjs <재력> <시작 나이> [webkit]` · `endtable.mjs` · `blockchunk.mjs` · `slowchunk.mjs <engine> <지연ms> wheel` · `why-overflow.mjs` · `reading-line.mjs` · `a11y-names.mjs` · `hitarea.mjs` · `f01.mjs`
5. 공통: `mash.mjs`(새로고침·창 연타·뒤로가기·탭 닫기) · `perf8x.mjs` · `focus-audit.mjs [pill]`(e2e 포커스 감사 도구를 대신하는 직접 점검) · `tabwalk.mjs`
