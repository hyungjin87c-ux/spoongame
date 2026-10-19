// QA-003 M8 엔딩 플레이 시간 블록 보충: 낭독(접근성 트리)·강제 색상·수동 다크 테마·인쇄 아닌 화면 확대 등
// 사용: node qa/scripts/m8-extra.mjs
import { launch, openOracle, evalCore, openSeeded, shot, sleep, runCase, writeJson, SET_MANUAL, setRootFont } from './m8-lib.mjs';

const browser = await launch();
const { page: oracle } = await openOracle(browser);
const st = await evalCore(oracle, `return core.playToEnd(core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(7), 'present'))), null).state;`);
const play = { hold: 910900, decide: 755999, fold: 123456, note: 777777, idle: 999999, offSpeed: 190000, auto: 0, skips: 2, resumes: 3 };

await runCase({ id: 'AX01', title: '엔딩 플레이 시간 블록의 접근성 트리: 이름 → 값을 「27분 45초」로 읽고(보이는 27:45는 숨김), 보조 문장이 이어진다' }, async () => {
  const { ctx, page } = await openSeeded(browser, { ...st, play }, { wait: '[data-testid="ending-screen"]' });
  const snap = await page.locator('[data-testid="ending-playtime"]').ariaSnapshot();
  const section = await page.locator('[aria-label="사망과 선택"]').ariaSnapshot().catch(() => null);
  const s = await shot(page, 'AX01', 'block');
  await ctx.close();
  writeJson('ax-playtime.json', { snap, section });
  const hasSpoken = /27분 45초/.test(snap) && /15분 10초/.test(snap) && /12분 35초/.test(snap);
  const noVisibleDup = !/27:45|15:10|12:35/.test(snap);
  return { verdict: hasSpoken && noVisibleDup ? 'PASS' : 'FAIL', actual: `낭독 문자 ${hasSpoken}, 보이는 mm:ss가 트리에 중복되지 않음 ${noVisibleDup}; 트리: ${snap.replace(/\s+/g, ' ').slice(0, 500)}`, shots: [s] };
});

const sample = { clean: { ...play, offSpeed: 0, skips: 0 }, notClean: play };

await runCase({ id: 'FC01', title: '강제 색상(forced-colors: active): 이름·값·보조 문장이 시스템 색으로 그려지고 배경과 구별된다(렌더 대비 ≥ 7:1)' }, async () => {
  const out = [];
  let ok = true;
  const shots = [];
  for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await openSeeded(browser, { ...st, play: sample.notClean }, { extraCtx: { forcedColors: 'active', colorScheme: scheme }, wait: '[data-testid="ending-screen"]' });
    const r = await page.evaluate(() => {
      const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const Lm = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
      const parse = (s) => { const m = /rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/.exec(s); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null; };
      const bgOf = (e) => { let x = e; while (x) { const c = getComputedStyle(x).backgroundColor; const p = parse(c); const a = /rgba\(.*,\s*([\d.]+)\)/.exec(c); if (p && (!a || Number(a[1]) > 0.99)) return p; x = x.parentElement; } return [255, 255, 255]; };
      const q = (s) => document.querySelector(s);
      const res = {};
      for (const [k, sel] of [['dt', '[data-testid="ending-playtime"] dt'], ['value', '[data-testid="ending-playtime-value"]'], ['note', '[data-testid="ending-playtime-note"]']]) {
        const e = q(sel);
        const fg = parse(getComputedStyle(e).color);
        const bg = bgOf(e);
        const l1 = Lm(fg); const l2 = Lm(bg);
        res[k] = { fg: getComputedStyle(e).color, bg: `rgb(${bg.join(',')})`, ratio: +((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2) };
      }
      res.forced = matchMedia('(forced-colors: active)').matches;
      return res;
    });
    shots.push(await shot(page, 'FC01', `forced-${scheme}`));
    await ctx.close();
    out.push({ scheme, ...r });
    if (!r.forced || r.dt.ratio < 7 || r.value.ratio < 7 || r.note.ratio < 7) ok = false;
  }
  return { verdict: ok ? 'PASS' : 'FAIL', actual: out.map((o) => `${o.scheme}: forced=${o.forced} 이름 ${o.dt.ratio} 값 ${o.value.ratio} 보조 ${o.note.ratio} (${o.value.fg} on ${o.value.bg})`).join(' / '), shots };
});

await runCase({ id: 'DK01', title: '수동 다크 테마(설정 theme=dark, 시스템은 라이트): 블록 대비 ≥ 4.5:1, 글자 200%·320px에서도 넘침 0' }, async () => {
  const shots = [];
  const lines = [];
  let ok = true;
  for (const [vw, vh, pct] of [[360, 740, 100], [320, 568, 200]]) {
    const { ctx, page } = await openSeeded(browser, { ...st, play: sample.notClean }, { vp: { width: vw, height: vh }, settings: { ...SET_MANUAL, theme: 'dark' }, extraCtx: { colorScheme: 'light' }, wait: '[data-testid="ending-screen"]' });
    await setRootFont(page, pct);
    await sleep(300);
    const r = await page.evaluate(() => {
      const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const Lm = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
      const parse = (s) => { const m = /rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/.exec(s); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null; };
      const bgOf = (e) => { let x = e; while (x) { const c = getComputedStyle(x).backgroundColor; const p = parse(c); const a = /rgba\(.*,\s*([\d.]+)\)/.exec(c); if (p && (!a || Number(a[1]) > 0.99)) return p; x = x.parentElement; } return [255, 255, 255]; };
      const q = (s) => document.querySelector(s);
      const ratio = (e) => { const l1 = Lm(parse(getComputedStyle(e).color)); const l2 = Lm(bgOf(e)); return +((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2); };
      return { theme: document.documentElement.getAttribute('data-theme'), dt: ratio(q('[data-testid="ending-playtime"] dt')), value: ratio(q('[data-testid="ending-playtime-value"]')), note: ratio(q('[data-testid="ending-playtime-note"]')), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    await page.locator('[data-testid="ending-playtime"]').evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await sleep(200);
    shots.push(await shot(page, 'DK01', `manual-dark-${vw}x${vh}-${pct}`));
    await ctx.close();
    lines.push(`${vw}x${vh} ${pct}%: data-theme=${r.theme} 이름 ${r.dt} 값 ${r.value} 보조 ${r.note} 넘침 ${r.overflow}`);
    if (r.theme !== 'dark' || r.dt < 4.5 || r.value < 4.5 || r.note < 4.5 || r.overflow) ok = false;
  }
  return { verdict: ok ? 'PASS' : 'FAIL', actual: lines.join(' / '), shots };
});

await browser.close();
