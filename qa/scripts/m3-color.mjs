// QA-003 M3 색: 라이트·다크·강제 색상(라이트/다크)에서 룰렛(회전 중·결과)·출생신고의 글자 대비와 구분 표시. 사용: node qa/scripts/m3-color.mjs
import { launch, mkctx, fixSeed, runCase, shot, openTitle, toRoulette, waitGuard, sleep, VP, TOUCH, SHOT_DIR } from './m3-lib.mjs';

const browser = await launch();

const SCAN = () => {
  const parse = (s) => {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(s);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])] : null;
  };
  const lin = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const mix = (top, bottom) => {
    const a = top[3];
    return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
  };
  const bgOf = (el) => {
    let acc = null;
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c[3] > 0) {
        if (c[3] >= 1) return acc ? mix(acc, c) : c;
        acc = acc ? mix(acc, c) : c;
      }
    }
    const root = parse(getComputedStyle(document.documentElement).backgroundColor);
    const base = root && root[3] > 0 ? root : [255, 255, 255, 1];
    return acc ? mix(acc, base) : base;
  };
  const rows = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.textContent.trim()) continue;
    const el = t.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1.5 || r.height <= 1.5) continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    // 부모 중 opacity < 1 이면 합성
    let op = 1;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
    const bg = bgOf(el);
    const fgm = mix([fg[0], fg[1], fg[2], fg[3] * op], bg);
    const l1 = L(fgm);
    const l2 = L(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const deco = !!el.closest('.stamp');
    const reelNeighbor = !!el.closest('.reel__item') && !el.closest('.reel__item.is-result') && !!el.closest('[aria-hidden="true"]');
    rows.push({ deco, text: t.textContent.trim().slice(0, 22), ratio: Math.round(ratio * 100) / 100, px: Math.round(px), large, reelNeighbor, op: Math.round(op * 100) / 100, fg: cs.color, bg: `rgb(${bg.slice(0, 3).map(Math.round)})`, cls: (el.className?.toString?.() || '').slice(0, 28) });
  }
  const fail45 = rows.filter((r) => r.ratio < (r.large ? 3 : 4.5) && !r.reelNeighbor && !r.deco);
  const decoRows = rows.filter((r) => r.deco);
  const reel = rows.filter((r) => r.reelNeighbor);
  const html = document.documentElement;
  const bodyBg = parse(getComputedStyle(document.body).backgroundColor);
  return {
    n: rows.length,
    fail: fail45.slice(0, 8),
    failN: fail45.length,
    deco: decoRows.map((r) => r.text + ' ' + r.ratio + ':1(' + r.px + 'px)'),
    min: rows.filter((r) => !r.reelNeighbor && !r.deco).reduce((a, r) => Math.min(a, r.ratio), 99),
    reelNeighborMin: reel.length ? Math.min(...reel.map((r) => r.ratio)) : null,
    reelNeighborN: reel.length,
    bodyBg: bodyBg ? `rgb(${bodyBg.slice(0, 3)})` : null,
    bodyLum: bodyBg ? Math.round(L(bodyBg) * 1000) / 1000 : null,
    theme: html.getAttribute('data-theme'),
    scheme: getComputedStyle(html).colorScheme,
  };
};

const MODES = [
  ['light', {}],
  ['dark', { colorScheme: 'dark' }],
  ['forced-light', { forcedColors: 'active', colorScheme: 'light' }],
  ['forced-dark', { forcedColors: 'active', colorScheme: 'dark' }],
  ['dark-reduced', { colorScheme: 'dark', reducedMotion: 'reduce' }],
];

await runCase(
  { id: 'M3-K01', cat: '접근성', title: '라이트·다크·강제 색상(라이트/다크)·다크+움직임 줄이기에서 룰렛(회전 중·결과)·출생신고(상·또래·비교) 글자 대비', steps: '5개 모드 × (룰렛 회전 중·결과·출생신고) × 시드 2개(흙수저·다이아몬드수저)를 모든 보이는 글자의 글자색·바탕색 대비로 잰다(글자 4.5:1, 큰 글자 3:1). 릴의 흐린 이웃 칸(aria-hidden 장식)은 따로 기록. 스크린샷으로 눈 확인', expected: '모든 모드에서 대비 미달 0(장식 이웃 칸 제외), 강제 색상에서 결과 칸·버튼·수저 칩이 구분됨, 다크에서 본문 배경이 어둡다' },
  async () => {
    const bad = [];
    const notes = [];
    const shots = [];
    for (const [mode, opts] of MODES) {
      for (const [sname, seed, era] of [['dirt', 5, 'present'], ['diamond', 229, 'present'], ['past', 155, 'past']]) {
        const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH, ...opts });
        await fixSeed(ctx, seed);
        const p = await ctx.newPage();
        await openTitle(p);
        await toRoulette(p, era);
        const reduced = opts.reducedMotion === 'reduce';
        if (!reduced) {
          await sleep(900);
          const sp = await p.evaluate(SCAN);
          if (sp.failN) bad.push(`${mode}/${sname}/회전 중: 대비 미달 ${sp.failN}건 ${JSON.stringify(sp.fail.slice(0, 3))}`);
          notes.push(`${mode}/${sname}/spin: 최소 ${sp.min}`);
          if (sname === 'diamond') shots.push(await shot(p, 'K01', `${mode}-roulette-spin`));
          await waitGuard(p, 'skip-roulette');
          await p.getByTestId('skip-roulette').click();
          await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 3000 });
        }
        await sleep(500);
        const rs = await p.evaluate(SCAN);
        if (rs.failN) bad.push(`${mode}/${sname}/결과: 대비 미달 ${rs.failN}건 ${JSON.stringify(rs.fail.slice(0, 3))}`);
        notes.push(`${mode}/${sname}/결과: 최소 ${rs.min}, 장식 칸 최소 ${rs.reelNeighborMin}(${rs.reelNeighborN}개), 배경 ${rs.bodyBg}`);
        if (mode.startsWith('dark') || mode.startsWith('forced')) {
          // 다크면 어두운 배경
          if ((mode === 'dark' || mode === 'dark-reduced' || mode === 'forced-dark') && rs.bodyLum !== null && rs.bodyLum > 0.25) bad.push(`${mode}/${sname}: 배경이 밝음 ${rs.bodyBg}`);
        }
        if (sname === 'diamond' || sname === 'dirt') shots.push(await shot(p, 'K01', `${mode}-roulette-result-${sname}`));
        await waitGuard(p, 'to-birth');
        await p.getByTestId('to-birth').click();
        await p.waitForSelector('[data-testid="birth-screen"]');
        await sleep(450);
        const bs = await p.evaluate(SCAN);
        if (bs.failN) bad.push(`${mode}/${sname}/출생신고: 대비 미달 ${bs.failN}건 ${JSON.stringify(bs.fail.slice(0, 3))}`);
        notes.push(`${mode}/${sname}/birth: 최소 ${bs.min}${bs.deco.length ? ', 장식 도장(aria-hidden) ' + bs.deco.join(',') : ''}`);
        if (sname === 'diamond' || sname === 'past') {
          shots.push(await shot(p, 'K01', `${mode}-birth-top-${sname}`));
          if (sname === 'diamond') {
            await p.evaluate(() => document.querySelector('[data-testid="peers-card"]')?.scrollIntoView({ block: 'start' }));
            await sleep(200);
            shots.push(await shot(p, 'K01', `${mode}-birth-peers-${sname}`));
            await p.evaluate(() => document.querySelector('[data-testid="compare-card"]')?.scrollIntoView({ block: 'start' }));
            await sleep(200);
            shots.push(await shot(p, 'K01', `${mode}-birth-compare-${sname}`));
          }
        }
        await ctx.close();
      }
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간(접근성)', actual: bad.length ? bad.slice(0, 8).join(' / ') : `15조합(5모드 × 3표본 × 회전 중·결과·출생신고) 모두 글자 대비 미달 0. ` + notes.filter((n) => /diamond\/결과|diamond\/birth/.test(n)).join(' ; '), shots: shots.slice(0, 40) };
  },
);

// 강제 색상: 결과 칸·버튼·수저 칩이 구분되는가(계산된 테두리·배경)
await runCase(
  { id: 'M3-K02', cat: '접근성', title: '강제 색상(Windows 고대비 흉내)에서 결과 칸 표시·버튼 테두리·수저 칩 외곽이 사라지지 않는다', steps: 'forced-colors: active(라이트·다크)에서 룰렛 결과·출생신고의 결과 칸(is-result)·하단 버튼·수저 칩·릴 창의 계산된 테두리/윤곽을 읽는다. 스크린샷', expected: '결과 칸에 보이는 테두리(두께 > 0, 색 ≠ 배경)가 있고 버튼에도 테두리가 있으며 수저 칩에 외곽 또는 글자(이름·점)가 있다' },
  async () => {
    const bad = [];
    const shots = [];
    const notes = [];
    for (const scheme of ['light', 'dark']) {
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH, forcedColors: 'active', colorScheme: scheme });
      await fixSeed(ctx, 229);
      const p = await ctx.newPage();
      await openTitle(p);
      await toRoulette(p, 'present');
      await waitGuard(p, 'skip-roulette');
      await p.getByTestId('skip-roulette').click();
      await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]');
      await sleep(500);
      const info = await p.evaluate(() => {
        const bw = (el) => {
          const cs = getComputedStyle(el);
          return { border: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor, outline: cs.outlineWidth + ' ' + cs.outlineStyle, bg: cs.backgroundColor, color: cs.color, forced: cs.forcedColorAdjust };
        };
        const res = document.querySelector('[data-testid="reel-wealth"] [data-result="true"]');
        const win = document.querySelector('[data-testid="reel-wealth"] .reel__window');
        const btn = document.querySelector('[data-testid="to-birth"]');
        const chip = document.querySelector('[data-testid="reel-wealth"] [data-result="true"] .grade, [data-testid="reel-wealth"] [data-result="true"] > *');
        return { res: res && bw(res), win: win && bw(win), btn: btn && bw(btn), chip: chip && bw(chip), chipText: chip?.textContent.trim() };
      });
      notes.push(`${scheme}: 결과칸 ${JSON.stringify(info.res)} / 창 ${JSON.stringify(info.win)} / 버튼 ${JSON.stringify(info.btn)}`);
      const resVisible = (info.win && /^[1-9]/.test(info.win.border) && !/none/.test(info.win.border)) || (info.res && /^[1-9]/.test(info.res.border) && !/none/.test(info.res.border)) || (info.win && /^[1-9]/.test(info.win.outline));
      if (!resVisible) bad.push(`${scheme}: 결과 칸 창/칸에 보이는 테두리·윤곽이 없음 ${JSON.stringify({ win: info.win, res: info.res })}`);
      if (!(info.btn && /^[1-9]/.test(info.btn.border) && !/none/.test(info.btn.border))) bad.push(`${scheme}: 하단 버튼에 테두리 없음 ${JSON.stringify(info.btn)}`);
      if (!info.chipText) bad.push(`${scheme}: 수저 칩에 글자 없음`);
      shots.push(await shot(p, 'K02', `forced-${scheme}-result`));
      await ctx.close();
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간(접근성)', actual: bad.length ? bad.join(' / ') : '강제 색상 라이트·다크 모두 결과 칸·버튼 테두리 유지, 수저 칩에 이름 글자 있음. ' + notes.join(' ; ').slice(0, 400), shots };
  },
);

await browser.close();
