// 추가 공격: 자동 선택 타이머와 직접 클릭의 경쟁, 가림/복귀 폭풍 중 자동 모드, 선택 버튼에서 Enter 길게 누르기
import { DEV, SETTINGS_KEY, launch, mkctx, runCase, shot, snap, toLife, waitScreen, readSave, sleep } from './lib.mjs';

const G = 'a-race';
const browser = await launch();
const choiceCount = async (page) => {
  const sv = await readSave(page);
  return sv && sv.data ? sv.data.history.filter((h) => h.kind === 'choice').length : -1;
};

await runCase(G, { id: 'M3-A108', cat: '#3 자동 해제/경쟁', title: '자동 선택 타이머와 직접 클릭이 같은 순간에 겹침 x20 (1배·자동, ?__timescale=5: 자동 선택까지 약 0.6초, 가드 0.4초)', timescale: 5, steps: '자동 모드로 선택지가 뜨면 가드가 풀린 직후부터 자동 선택이 일어날 시점(0.6초) 전후 ±80ms에 선택 버튼을 직접 클릭. 20회', expected: '선택은 한 번만 확정(연표 선택 수 +1), 한 해가 두 번 진행되지 않음, 오류 없음' }, async () => {
  const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
  await ctx.addInitScript(([k, v]) => { if (location.protocol === 'about:') return; if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, [SETTINGS_KEY, JSON.stringify({ version: 1, data: { speed: 1, autoMode: true } })]);
  const page = await ctx.newPage();
  await page.goto(DEV + '/?__timescale=5');
  await toLife(page, 'present');
  const bad = [];
  let trials = 0;
  let manualWon = 0;
  let autoWon = 0;
  const t0 = Date.now();
  while (trials < 20 && Date.now() - t0 < 120000) {
    const s = await snap(page);
    if (s.screen === 'ending-placeholder') break;
    if (!s.hasChoice) { await sleep(15); continue; }
    const key = s.choiceKey;
    const nb = await choiceCount(page);
    const ageB = Number(s.age.replace('세', ''));
    const offset = 380 + Math.floor(Math.random() * 300); // 가드 직전~자동 선택 직후
    await sleep(offset);
    await page.locator('.choice-list button').first().click({ timeout: 500, force: true, noWaitAfter: true }).catch(() => {});
    await sleep(250);
    const na = await choiceCount(page);
    const sv = await readSave(page);
    const ageA = sv.data.age;
    trials++;
    if (na - nb !== 1) bad.push(`${trials}: 선택 ${nb}→${na} (offset ${offset}ms)`);
    if (ageA - ageB > 1 && na - nb === 1 && !(sv.data.pending)) { /* 다음 해들이 지나갔을 수 있음(자동) — 되감김/중복 해만 검사 */ }
    const last = sv.data.history.filter((h) => h.kind === 'choice');
    const dup = last.length >= 2 && last[last.length - 1].eventId === last[last.length - 2].eventId && last[last.length - 1].age === last[last.length - 2].age;
    if (dup) bad.push(`${trials}: 같은 이벤트·같은 나이 선택이 두 번 기록`);
    if (key && s.choiceKey !== key) bad.push('키 변경');
    await page.waitForFunction((k) => !document.querySelector(`[data-testid="choice-panel"][data-key="${k}"]`), key, { timeout: 3000 }).catch(() => {});
  }
  const sh = await shot(page, 'M3-A108');
  return { verdict: bad.length ? 'FAIL' : trials >= 8 ? 'PASS' : 'ERROR', actual: bad.length ? bad.join('; ') : `${trials}회 겹침 시도 모두 선택 1회씩만 확정, 같은 이벤트 중복 기록 없음`, shots: [sh] };
});

await runCase(G, { id: 'M3-A109', cat: '#3 자동 해제/경쟁', title: '가림/복귀 폭풍 중 자동 모드: 선택지 대기 중 가림 → 자동 선택 안 일어남 → 복귀 시 선택 / visibilitychange 200회 토글 (8배·자동)', steps: '선택지가 뜬 상태에서 hidden으로 5초 → 선택지 유지 확인 → visible → 자동 선택 확인. 이어서 hidden/visible을 200회 토글하며 진행 관찰', expected: '가린 동안 자동 선택·진행 없음, 복귀 후 정상. 토글 폭풍에도 한 해가 두 번 진행되거나 선택이 두 번 확정되지 않음, 오류 없음' }, async () => {
  const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
  await ctx.addInitScript(([k, v]) => { if (location.protocol === 'about:') return; if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, [SETTINGS_KEY, JSON.stringify({ version: 1, data: { speed: 1, autoMode: true } })]);
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__vis = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
  });
  await page.goto(DEV + '/?__timescale=3');
  await toLife(page, 'present');
  const setVis = (v) => page.evaluate((x) => { window.__vis = x; document.dispatchEvent(new Event('visibilitychange')); }, v);
  const bad = [];
  const rows = [];
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 60000 });
  await setVis('hidden');
  const key = (await snap(page)).choiceKey;
  const nb = await choiceCount(page);
  await sleep(5000);
  const s1 = await snap(page);
  if (!s1.hasChoice || s1.choiceKey !== key) bad.push('가린 동안 자동 선택이 일어남');
  rows.push(`가림 5초 후 선택지 유지=${s1.hasChoice && s1.choiceKey === key}`);
  await setVis('visible');
  await sleep(2500);
  const na = await choiceCount(page);
  rows.push(`복귀 후 선택 수 ${nb}→${na}`);
  if (na - nb < 1) bad.push('복귀 후 자동 선택이 일어나지 않음');
  // 토글 폭풍
  const ageSeries = [];
  for (let i = 0; i < 200; i++) {
    await setVis(i % 2 ? 'visible' : 'hidden');
    if (i % 40 === 0) { const s = await snap(page); ageSeries.push(s.age || s.screen); }
  }
  await setVis('visible');
  await sleep(3000);
  const f = await snap(page);
  const sv = await readSave(page);
  const hist = sv.data.history.filter((h) => h.kind === 'choice');
  const dup = hist.some((h, i) => i > 0 && h.eventId === hist[i - 1].eventId && h.age === hist[i - 1].age);
  if (dup) bad.push('중복 선택 기록');
  if (['error-screen', 'superseded-screen', 'BLANK'].includes(f.screen)) bad.push(`폭풍 후 ${f.screen}`);
  rows.push(`토글 200회 후 ${f.screen} ${f.age || ''}, 관측 [${ageSeries.join(',')}]`);
  const sh = await shot(page, 'M3-A109');
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + rows.join(' | ') : rows.join(' | '), shots: [sh] };
});

await runCase(G, { id: 'M3-A110', cat: '#2 키보드', title: '선택 버튼에 포커스한 채 Enter 길게 누르기(자동 반복)·Space 연타 — 선택 1회만 확정, 다음 선택지는 눌리지 않음 (?__timescale=40, 8배)', timescale: 40, steps: '선택 버튼에 포커스 → Enter를 누른 채 40회 keydown 반복 → 연표 선택 수와 다음 선택지 상태 확인. Space로도 반복', expected: '선택 1회, 다음 선택지(가드)는 눌리지 않음' }, async () => {
  const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
  await ctx.addInitScript(([k, v]) => { if (location.protocol === 'about:') return; if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, [SETTINGS_KEY, JSON.stringify({ version: 1, data: { speed: 8, autoMode: false } })]);
  const page = await ctx.newPage();
  await page.goto(DEV + '/?__timescale=40');
  await toLife(page, 'present');
  const bad = [];
  const rows = [];
  for (const k of ['Enter', ' ']) {
    await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
    await page.waitForFunction(() => { const b = document.querySelector('.choice-list button'); return b && b.getAttribute('aria-disabled') !== 'true'; });
    await page.locator('.choice-list button').first().focus();
    const nb = await choiceCount(page);
    await page.keyboard.down(k);
    for (let i = 0; i < 40; i++) await page.keyboard.down(k);
    await page.keyboard.up(k);
    await sleep(100);
    const na = await choiceCount(page);
    rows.push(`${k === ' ' ? 'Space' : k} 반복: 선택 ${nb}→${na}`);
    if (na - nb !== 1) bad.push(`${k}: 선택 ${na - nb}개 확정`);
    await sleep(400);
  }
  const sh = await shot(page, 'M3-A110');
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + rows.join(' | ') : rows.join(' | '), shots: [sh] };
});
await browser.close();
