// 공격 #10 프로덕션 번들(vite preview): 개발 탐침 쿼리가 아무 효과 없는지, 번들에 탐침 문자열이 없는지, 저장 변조·새로고침이 같은지
import fs from 'node:fs';
import path from 'node:path';
import { PROD, ROOT, GAME_KEY, SETTINGS_KEY, RES_DIR, launch, mkctx, runCase, shot, snap, toLife, toBirth, waitScreen, readSave, readSettings, readRaw, sleep, con } from './f-compat.mjs';

const G = 'a-prod';
const browser = await launch();
let n = 1;
const aId = () => `F-AP${String(n++).padStart(2, '0')}`;
const curId = () => `F-AP${String(n - 1).padStart(2, '0')}`;
const only = process.argv[2];

if (!only || only === 'A') {
  n = 1;
  await runCase(G, { id: aId(), cat: '#10 프로덕션', title: '번들 문자열 검사: dist에 개발 탐침(__timescale·__guard·__crash·__quota·harness) 문자열이 없다', steps: 'dist/**/*.{js,html,css}에서 문자열 검색', expected: '0건' }, async () => {
    const dist = path.join(ROOT, 'dist');
    const hits = {};
    const words = ['__timescale', '__guard', '__crash', '__quota', 'crash probe', 'quota probe', 'harness'];
    const files = [];
    const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? walk(p) : files.push(p); } };
    walk(dist);
    for (const f of files) {
      const t = fs.readFileSync(f, 'utf8');
      for (const w of words) if (t.includes(w)) hits[w] = (hits[w] || []).concat(path.basename(f));
    }
    return { verdict: Object.keys(hits).length ? 'FAIL' : 'PASS', actual: Object.keys(hits).length ? JSON.stringify(hits) : `파일 ${files.length}개(${files.map((f) => path.basename(f)).join(', ')})에서 0건`, shots: [] };
  });

  await runCase(G, { id: aId(), cat: '#10 프로덕션', title: '개발 탐침 쿼리(?__timescale=1000&__guard=0&__crash=1&__quota=1)가 프로덕션에서 아무 효과 없음', steps: '탐침 쿼리로 열기 → 타이틀 정상? → 시작 → 시대 → 확정 버튼 가드(0.4초 흐림) 존재? → 인생 진행 간격이 실시간(약 4초/년)? → 저장 실패 안내 없음?', expected: '크래시·저장 실패 안내·가드 해제·시간 가속 모두 없음' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await page.goto(PROD + '/?__timescale=1000&__guard=0&__crash=1&__quota=1');
    await sleep(800);
    const bad = [];
    const rows = [];
    const s0 = await snap(page);
    rows.push(`로드 ${s0.screen}, 안내=${s0.notice}`);
    if (s0.screen !== 'title-screen') bad.push(`타이틀이 아님(${s0.screen})`);
    if (s0.notice) bad.push('저장 실패 안내가 뜸(__quota 효과)');
    const sh1 = await shot(page, curId(), 'title');
    await page.getByRole('button', { name: '시작' }).waitFor();
    await sleep(600);
    await page.getByRole('button', { name: '시작' }).click();
    await waitScreen(page, 'era-screen');
    const g = await page.evaluate(() => document.querySelector('[data-testid="confirm-era"]').getAttribute('aria-disabled'));
    rows.push(`시대 선택 진입 직후 확정 버튼 aria-disabled=${g}`);
    if (g !== 'true') bad.push('가드가 없음(__guard=0 효과)');
    await sleep(600);
    await page.getByTestId('confirm-era').click();
    await waitScreen(page, 'birth-screen');
    await sleep(600);
    await page.getByTestId('next-life').click();
    await waitScreen(page, 'life-screen');
    const ages = [];
    const t0 = Date.now();
    let last = null;
    while (Date.now() - t0 < 14000 && ages.length < 3) {
      const s = await snap(page);
      if (s.age !== last) { ages.push([s.age, Date.now() - t0]); last = s.age; }
      await sleep(100);
    }
    const gaps = ages.slice(1).map((a, i) => a[1] - ages[i][1]);
    rows.push(`나이 변화 간격(ms) ${gaps.join(',')}`);
    if (gaps.some((x) => x < 3000)) bad.push(`진행이 빠름(__timescale 효과) ${gaps.join(',')}`);
    const sh2 = await shot(page, curId(), 'life');
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + rows.join(' | ') : rows.join(' | '), shots: [sh1, sh2] };
  });

  await runCase(G, { id: aId(), cat: '#10 프로덕션', title: '프로덕션: 개발 전용 하니스 페이지(/harness/guard.html)와 /src 가 제공되지 않음', steps: '/harness/guard.html, /src/main.tsx, /src/core/index.ts 요청', expected: '하니스·소스가 아닌 앱(SPA 폴백) 또는 404' }, async () => {
    const out = [];
    const bad = [];
    for (const p of ['/harness/guard.html', '/src/main.tsx', '/src/core/index.ts', '/e2e/helpers.ts']) {
      const r = await fetch(PROD + p);
      const t = await r.text();
      const looksSource = /import .* from|createRoot|export (function|const)/.test(t.slice(0, 3000)) && !t.includes('<div id="root">');
      const harness = /guard harness|GuardedButton/.test(t) && t.includes('<html');
      out.push(`${p} → ${r.status} ${r.headers.get('content-type')} ${looksSource ? '소스노출!' : ''}${harness ? '하니스!' : ''}`);
      if (looksSource || harness) bad.push(p);
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? '노출: ' + bad.join(',') + ' :: ' + out.join(' | ') : out.join(' | '), shots: [] };
  });
}

if (!only || only === 'B') {
  n = 4;
  // 프로덕션에서 정상 1판 (8배 + 다음 결정으로, 모바일)은 play.mjs(--url)로 별도 실행: M3-P01. 여기서는 새로고침/변조/키보드 일부를 프로덕션에서 재확인.
  await runCase(G, { id: aId(), cat: '#10 프로덕션', title: '프로덕션: 선택지 대기 중 새로고침 연타 x15, 손상 저장, 설정 변조', steps: '프로덕션 빌드에서 선택지 대기 → 새로고침 15회 → 같은 선택지. 이어서 저장을 깨뜨리고 로드, 설정 변조 후 로드', expected: '개발 서버와 같은 동작(복원·새 게임 시작, 크래시 없음)' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await page.goto(PROD + '/');
    await toLife(page, 'present');
    await sleep(600);
    await page.getByTestId('skip').click();
    await page.waitForSelector('[data-testid="choice-panel"]');
    await sleep(500);
    const a = await snap(page);
    for (let i = 0; i < 15; i++) await page.reload({ waitUntil: i % 2 ? 'commit' : 'domcontentloaded' }).catch(() => {});
    await page.waitForLoadState('load').catch(() => {});
    await sleep(800);
    const b = await snap(page);
    const bad = [];
    if (a.choiceKey !== b.choiceKey || a.name !== b.name) bad.push(`복원 불일치 ${a.name}/${a.choiceKey} → ${b.name}/${b.choiceKey}`);
    const sh = await shot(page, curId(), 'restored');
    // 손상
    await page.evaluate(([k, s]) => { localStorage.setItem(k, '{"version":4,"data":'); localStorage.setItem(s, '{"version":1,"data":{"speed":3,"autoMode":"yes"}}'); }, [GAME_KEY, SETTINGS_KEY]);
    await page.evaluate((k) => window.dispatchEvent(new StorageEvent('storage', { key: k })), GAME_KEY); // 떠나는 앱이 덮어쓰지 않게
    await page.reload();
    await sleep(800);
    const c = await snap(page);
    if (c.screen !== 'title-screen') bad.push(`손상 저장 → ${c.screen}`);
    const sh2 = await shot(page, curId(), 'corrupt');
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') : `복원 동일(${b.name} ${b.age} ${b.choiceKey}), 손상 저장 → ${c.screen}`, shots: [sh, sh2] };
  });
}
await browser.close();
