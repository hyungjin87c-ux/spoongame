// SPEC-005 QA: 다크 · 강제 색상 · 움직임 줄이기에서 새 화면(가린 줄·부모 카드·결정 시트·엔딩·패널)이 읽히고 눌리는가.
// 프로덕션 빌드(4391). 사용: node qa/scripts/q005-modes.mjs --vp d1280|m360 [--engine webkit]
import { launchChromium, launchWebkit, VP, Watch, PROD, DEV, run, ok, bad, note, shot, sleep, overflowOf, seedPage, DEFAULT_SETTINGS, oracle, withoutPlay, QA_OBSERVER } from './q005-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const VPN = arg('vp', 'd1280');
const ENGINE = arg('engine', 'chromium');
const tag = `${ENGINE === 'webkit' ? 'W-' : ''}${VPN}`;
const touch = !!VP[VPN].hasTouch;
const browser = await (ENGINE === 'webkit' ? launchWebkit() : launchChromium());
const devBrowser = await launchChromium();
const dev = await (await devBrowser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });
const click = async (loc, o = {}) => (touch ? loc.tap(o) : loc.click(o));
const ON = { ...DEFAULT_SETTINGS, gentle: true, speed: 1, noteCards: false };

const heavyLife = await oracle(dev, `for (let seed = 1; seed <= 2000; seed++) {
    let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
    let farewell = false;
    while (s.phase === 'life' && s.age < 66) { if (s.pending !== null) { if (s.pending.eventId === 'middle-parents-farewell') farewell = true; s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state; } else s = core.stepYear(s).state; }
    const heavy = s.history.filter((h) => core.heavyKindOfEntry(h) !== null);
    if (s.phase === 'life' && farewell && s.pending === null && heavy.length >= 4 && s.history.some((h) => h.text === '부모님이 남기신 재산을 물려받았습니다.')) return { ...s, paused: true };
  }
  return null;`).then(withoutPlay);
const pend = await oracle(dev, `const mod = await import('/src/data/events/index.ts');
    const ev = mod.EVENT_POOL.byId.get('middle-layoff'); const ages = core.possibleAgesOf(ev); const target = ages[Math.floor(ages.length / 2)];
    for (let seed = 1; seed <= 800; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
      while (s.phase === 'life' && s.age < target) { if (s.pending !== null) s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state; else s = core.stepYear(s).state; }
      if (s.phase !== 'life' || s.age !== target) continue;
      const visible = core.visibleChoices(ev, core.condContextOf(s)); if (visible.length < 2) continue;
      return { ...s, seen: { ...s.seen, 'middle-layoff': target }, lastChoiceAge: target, pending: { eventId: 'middle-layoff', key: 'middle-layoff@' + target, age: target, choiceIds: visible.map((c) => c.id) } };
    }
    return null;`).then(withoutPlay);
const ending = await oracle(dev, `for (let seed = 1; seed <= 400; seed++) { const start = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present'))); const end = core.playToEnd(start, (s) => s.pending.choiceIds[0]).state; const heavy = end.history.filter((h) => core.heavyKindOfEntry(h) !== null); if (heavy.length >= 4 && heavy.some((h) => h.by !== undefined)) return end; } return null;`).then(withoutPlay);
const Y = await oracle(dev, `for (let seed = 40; seed < 2000; seed++) { let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present'))); for (let g = 0; g < 200 && s.phase === 'life' && s.age < 12; g++) { if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; } const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due); const r = core.stepYear(s); if (r.tick.kind === 'resolved' && r.tick.by === 'parent' && s.age >= 3) return s; s = r.state; } } return null;`).then(withoutPlay);

/** 글자 대비: 요소의 글자 색 ÷ 가장 가까운 불투명 배경 */
const CONTRAST = (sels) => {
  const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a >= 0.99) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const out = [];
  for (const s of sels) {
    const el = [...document.querySelectorAll(s)].find((e) => e.getBoundingClientRect().width > 0 && !e.closest('[hidden]'));
    if (!el) { out.push({ s, ratio: null }); continue; }
    const fg = parse(getComputedStyle(el).color);
    const bg = bgOf(el);
    const a = lum(fg) + 0.05;
    const b = lum(bg) + 0.05;
    out.push({ s, ratio: +(Math.max(a, b) / Math.min(a, b)).toFixed(2), size: parseFloat(getComputedStyle(el).fontSize) });
  }
  return out;
};

for (const [mode, opts] of [['dark', { colorScheme: 'dark' }], ['forced', { forcedColors: 'active' }], ['reduced', { reducedMotion: 'reduce' }]]) {
  const ctxOpts = { ...VP[VPN], locale: 'ko-KR', ...opts };
  const mk = async (game, settings, wait) => {
    const ctx = await browser.newContext(ctxOpts);
    const watch = new Watch(tag).attach(ctx);
    const page = await ctx.newPage();
    await seedPage(page, { game, settings });
    await page.goto(PROD + '/');
    await page.getByTestId(wait).waitFor({ timeout: 60000 });
    await sleep(900);
    return { ctx, page, watch };
  };
  const out = [];
  let failShotPage = null;
  // 1) 가린 줄 + 인생 화면
  {
    const { ctx, page, watch } = await mk(heavyLife, ON, 'life-screen');
    const ov = await overflowOf(page);
    const veil = await page.evaluate(() => { const b = document.querySelector('[data-testid="veil-btn"]'); const cs = getComputedStyle(b); const lead = document.querySelector('[data-testid="veil-lead"]'); return { border: `${cs.borderTopStyle}/${cs.borderTopWidth}`, leadVisible: lead && lead.getBoundingClientRect().width > 0, forced: matchMedia('(forced-colors: active)').matches }; });
    const c = mode === 'dark' ? await page.evaluate(CONTRAST, ['[data-testid="veil-lead"]', '[data-testid="log-row"] .log__text', '.log__age', '[data-testid="log-hint"]', '[data-testid="stats"]']) : [];
    out.push({ screen: '가린 줄', over: ov.over, veil, c });
    if (ov.over > 0 || !veil.leadVisible || (mode === 'forced' && /none/.test(veil.border))) failShotPage = failShotPage ?? { page, id: `${tag}-MD-${mode}-rows` };
    const w = watch.take();
    out.push({ screen: '콘솔', n: w.console.length, ext: w.external.length });
    if (!failShotPage || failShotPage.page !== page) await ctx.close();
  }
  // 2) 부모 카드
  {
    const { ctx, page } = await mk({ ...Y, paused: false }, { ...DEFAULT_SETTINGS, speed: 4, noteCards: false }, 'life-screen');
    for (let i = 0; i < 500; i++) { if (await page.getByTestId('parent-card').count()) break; await sleep(60); }
    await page.getByTestId('pause').click({ force: true }).catch(() => {});
    await sleep(500);
    const has = await page.getByTestId('parent-card').count();
    const ov = await overflowOf(page);
    const m = has ? await page.evaluate(() => { const cs = (e) => getComputedStyle(e); const chip = document.querySelector('[data-testid="parent-chip"]'); const pick = document.querySelector('[data-testid="parent-pick"]'); return { chipBorder: `${cs(chip).borderTopStyle}/${cs(chip).borderTopWidth}`, pickBorder: `${cs(pick).borderLeftStyle}/${cs(pick).borderLeftWidth}`, chipIcon: !!chip.querySelector('svg, .icon') }; }) : null;
    const c = mode === 'dark' && has ? await page.evaluate(CONTRAST, ['[data-testid="parent-stamp"]', '[data-testid="parent-chip"]', '[data-testid="parent-text"]', '[data-testid="parent-hint"]']) : [];
    out.push({ screen: '부모 카드', has, over: ov.over, m, c });
    if (!has || ov.over > 0) failShotPage = failShotPage ?? { page, id: `${tag}-MD-${mode}-parent` };
    else await ctx.close();
  }
  // 3) 결정 시트
  {
    const { ctx, page } = await mk({ ...pend, paused: true }, ON, 'life-screen');
    await page.getByTestId('choice-panel').waitFor();
    const ov = await overflowOf(page);
    const m = await page.evaluate(() => { const b = document.querySelector('[data-testid="veil-open"]'); const cs = getComputedStyle(b); return { btn: `${cs.borderTopStyle}/${cs.borderTopWidth}`, visible: b.getBoundingClientRect().width > 0 }; });
    out.push({ screen: '가린 결정 시트', over: ov.over, m });
    if (ov.over > 0 || !m.visible) failShotPage = failShotPage ?? { page, id: `${tag}-MD-${mode}-sheet` };
    else await ctx.close();
  }
  // 4) 엔딩
  {
    const { ctx, page } = await mk({ ...ending, gentleUsed: true }, ON, 'ending-screen');
    const ov = await overflowOf(page);
    out.push({ screen: '엔딩', over: ov.over, veiled: await page.locator('[data-testid="timeline-entry"][data-veiled="true"]').count() });
    if (ov.over > 0) failShotPage = failShotPage ?? { page, id: `${tag}-MD-${mode}-ending` };
    else await ctx.close();
  }
  // 5) 움직임 줄이기: 「새 기록 N개 · 맨 위로」가 부드럽지 않게(즉시) 올라간다
  let reducedNote = '';
  if (mode === 'reduced') {
    const { ctx, page } = await mk({ ...heavyLife, paused: false }, { ...DEFAULT_SETTINGS, speed: 8, autoMode: true, noteCards: false, gentle: false }, 'life-screen');
    const lst = page.getByTestId('log-list');
    await lst.evaluate((e) => { e.scrollTop = 300; });
    let seen = false;
    for (let i = 0; i < 400; i++) { await sleep(250); if (await page.getByTestId('log-jump').count()) { seen = true; break; } }
    if (seen) {
      await page.getByTestId('log-jump').click({ noWaitAfter: true });
      await sleep(80);
      const top = await lst.evaluate((e) => e.scrollTop);
      reducedNote = `알약 누른 직후(80ms) scrollTop ${top}`;
      out.push({ screen: '움직임 줄이기 맨 위로', top });
    } else out.push({ screen: '움직임 줄이기 맨 위로', top: 'pill 안 뜸' });
    await ctx.close();
  }
  await run({ id: `${tag}-MD-${mode}`, area: '모드', title: `${tag} ${mode}: 가린 줄·부모 카드·가린 결정 시트·엔딩이 읽히고 넘침 0${mode === 'dark' ? '·글자 대비 ≥ 4.5' : mode === 'forced' ? '·컨트롤 테두리 유지' : '·「맨 위로」가 즉시'}`, steps: `${mode} 환경에서 네 화면 확인`, expected: mode === 'dark' ? '넘침 0, 주요 글자 대비 ≥ 4.5:1(큰 글자 ≥ 3)' : mode === 'forced' ? '넘침 0, 가림 펼침 버튼·고른 길 상자·시트 버튼에 테두리(none 아님), 칩에 아이콘' : '넘침 0, 알약 누른 직후 scrollTop 0' }, async () => {
    const t = JSON.stringify(out) + (reducedNote ? ' · ' + reducedNote : '');
    const overs = out.filter((o) => o.over > 0);
    const lowC = out.flatMap((o) => (o.c ?? []).filter((x) => x.ratio !== null && x.ratio < (x.size >= 24 ? 3 : 4.5)));
    const forcedBad = mode === 'forced' ? out.filter((o) => (o.veil && /none/.test(o.veil.border)) || (o.m && ((o.m.pickBorder !== undefined && /none/.test(o.m.pickBorder)) || (o.m.btn !== undefined && /none/.test(o.m.btn)) || (o.m.chipIcon === false)))) : [];
    const hasCard = out.find((o) => o.screen === '부모 카드')?.has;
    const redBad = mode === 'reduced' ? out.filter((o) => o.screen === '움직임 줄이기 맨 위로' && o.top !== 0) : [];
    const pass = overs.length === 0 && lowC.length === 0 && forcedBad.length === 0 && hasCard && redBad.length === 0;
    return pass ? ok(t) : bad(t + ` · 넘침 ${overs.length} 낮은 대비 ${JSON.stringify(lowC)} 테두리 이상 ${forcedBad.length} 카드 ${hasCard} 즉시 올림 이상 ${redBad.length}`, failShotPage ? { shot: await shot(failShotPage.page, failShotPage.id) } : {});
  });
  if (failShotPage) await failShotPage.page.context().close();
}

await browser.close();
await devBrowser.close();
console.log('done', tag);
