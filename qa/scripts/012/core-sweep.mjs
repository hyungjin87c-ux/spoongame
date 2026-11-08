// QF2·QF3 코어 전수 훑기(실제 승인 데이터, 개발 서버의 /src를 그대로 import). QA 쪽 독립 기준표로 점검한다(개발자 시험표를 복사하지 않음 — SPEC-012 부록 A 원문 + 마스터 승인 2줄).
import { chromium, newPage, evalCore, BASE } from './lib.mjs';
const { browser, page } = await newPage(chromium);
await page.goto(BASE + '/');
const out = await evalCore(page, `
  const era = await import('/src/core/eraWindow.ts');
  const L = await import('/src/data/eraWindows/index.ts');
  const windows = [];
  for (const d of L.ERA_DECADES_WITH_DATA) windows.push(...(await L.ERA_DECADE_LOADERS[d]()).windows);
  // 부록 A (SPEC 원문; 투표는 마스터 승인으로 21세, 떡볶이 7세)
  const A = { 'era-1946-well-side':7,'era-1948-polling-queue':21,'era-1953-tent-school':7,'era-1954-relief-queue':7,'era-1970s-low-kerosene-room':13,'era-1972-briquette-dawn':13,'era-1981-hillside-village':13,'era-1990s-high-newtown-living':7,'era-1993-exam-gate-dawn':13,'era-2000-pc-bang':13,'era-2001-folder-phones-stop':13,'era-2009-first-smartphone':13,'era-2019-vertical-video':13,'era-2020s-wfh-table':7,'era-2021-empty-classroom-online':7,'era-2024-chat-bubbles':13,'era-2025-timetable-desk':7,'era-2000s-tteokbokki-stand':7 };
  const byId = new Map(windows.map(w => [w.id, w]));
  const missing = Object.keys(A).filter(id => !byId.has(id));
  const dataBad = Object.entries(A).filter(([id,min]) => byId.has(id) && (!byId.get(id).ages || byId.get(id).ages[0] !== min)).map(([id]) => id);
  const res = { windows: windows.length, missing, dataBad, dup: [], agesViolation: [], appendixViolation: [], pairMismatch: [], emptyStats: {}, checks: 0, sceneYears: {}, lineSample: null };
  const seeds = [1, 7, 99, 12345, 777, 31337, 4242, 8, 65535, 20261108];
  const births = [1940,1945,1950,1958,1965,1975,1985,1990,1995,2000,2005,2010,2015,2020,2026,2030];
  for (const birth of births) for (const band of ['low','mid','high']) for (const gentle of [false,true]) for (const seed of seeds) {
    const ctx = { regionKey: '서울', gentle, seed, windows, birthYear: birth, band };
    const seenPic = new Map(), seenLine = new Map(); let sceneYears = 0;
    for (let age = 0; age <= 110; age++) {
      const y = birth + age; if (y > 2110) break;
      const p = era.eraOf(y, ctx); res.checks++;
      for (const k of ['pic','line']) {
        const w = p[k]; if (!w) continue;
        if (w.ages && (age < w.ages[0] || age > w.ages[1])) res.agesViolation.push([birth, band, gentle, seed, y, age, k, w.id]);
        if (A[w.id] !== undefined && age < A[w.id]) res.appendixViolation.push([birth, band, gentle, seed, y, age, k, w.id]);
      }
      if (!gentle && (p.pic === null) !== (p.line === null) && y <= 2109) res.pairMismatch.push([birth, band, seed, y, p.pic?.id, p.line?.id]);
      if (y >= 2027 && y <= 2109 && y >= Math.max(2027, birth)) {
        if (p.pic) { if (seenPic.has(p.pic.id)) res.dup.push(['pic', birth, band, gentle, seed, y, p.pic.id, seenPic.get(p.pic.id)]); seenPic.set(p.pic.id, y); }
        if (p.line) { if (seenLine.has(p.line.id)) res.dup.push(['line', birth, band, gentle, seed, y, p.line.id, seenLine.get(p.line.id)]); seenLine.set(p.line.id, y); sceneYears++; }
      }
    }
    const key = birth + '/' + band + '/' + (gentle ? 'g' : 'n');
    (res.sceneYears[key] ??= []).push(sceneYears);
  }
  // eraRowsOf(인생 기록)가 eraOf와 같은 판단인지 + 같은 line 문장 되풀이
  let rowDup = 0, rowMismatch = 0;
  for (const birth of [1995, 2000, 2005, 2010]) for (const seed of seeds) for (const gentle of [false, true]) for (const band of ['low','mid','high']) {
    const ctx = { regionKey: '서울', gentle, seed, windows, band };
    const rows = era.eraRowsOf(birth, 100, ctx);
    const fut = rows.filter(r => r.forecast).map(r => r.line);
    if (new Set(fut).size !== fut.length) rowDup++;
    for (const r of rows) { const p = era.eraOf(r.year, { ...ctx, birthYear: birth }); if (!p.line || p.line.line !== r.line) rowMismatch++; }
  }
  res.rowDup = rowDup; res.rowMismatch = rowMismatch;
  for (const k of Object.keys(res.sceneYears)) { const a = res.sceneYears[k]; res.sceneYears[k] = Math.min(...a) + '~' + Math.max(...a); }
  res.dup = res.dup.slice(0, 5); res.agesViolation = res.agesViolation.slice(0, 5); res.appendixViolation = res.appendixViolation.slice(0, 5); res.pairMismatch = res.pairMismatch.slice(0, 5);
  return res;
`);
console.log(JSON.stringify(out, null, 1));
await browser.close();
