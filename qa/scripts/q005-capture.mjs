// SPEC-005 구현 캡처(RECORD) — designer가 시안과 대조할 자료. 원본 조각은 스크래치 폴더에 모으고, q005-montage.py가 45장 이내로 합쳐 qa/screenshots/005/CAP-NN.png(≤300KB)로 낸다.
// 프로덕션 빌드(4391). 사용: node qa/scripts/q005-capture.mjs --out <폴더> [--part A,B,C,D,E,W]
import fs from 'node:fs';
import path from 'node:path';
import { launchChromium, launchWebkit, VP, PROD, DEV, sleep, seedPage, DEFAULT_SETTINGS, oracle, withoutPlay, QA_OBSERVER } from './q005-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const OUT = arg('out');
const PARTS = arg('part', 'A,B,C,D,E,W').split(',');
fs.mkdirSync(OUT, { recursive: true });
const browser = await launchChromium();
const devBrowser = await launchChromium();
const dev = await (await devBrowser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });

const log = [];
const VPS = { d1280: VP.d1280, d1920: VP.d1920, m360: VP.m360, m320: { viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }, d1280low: { viewport: { width: 1280, height: 620 }, deviceScaleFactor: 1 }, d1366low: { viewport: { width: 1366, height: 657 }, deviceScaleFactor: 1 } };
const MODE = { light: {}, dark: { colorScheme: 'dark' }, forced: { forcedColors: 'active' } };
const settle = (ms = 500) => sleep(ms);

async function page_(vp, mode = 'light', { game = null, settings = null, wait = 'title-screen', engine = null, font = 100, query = '/' } = {}) {
  const b = engine ?? browser;
  const ctx = await b.newContext({ ...VPS[vp], ...MODE[mode], locale: 'ko-KR' });
  const page = await ctx.newPage();
  if (game || settings) await seedPage(page, { game, settings });
  await page.goto(PROD + query);
  await page.getByTestId(wait).waitFor({ timeout: 60000 });
  await settle(900);
  if (font !== 100) {
    await page.evaluate((f) => { document.documentElement.style.fontSize = `${f}%`; }, font);
    await settle(500);
  }
  return { ctx, page };
}
const save = async (id, target) => {
  const f = path.join(OUT, `${id}.png`);
  if (target.screenshot && target.locator === undefined) await target.screenshot({ path: f }); // locator
  else await target.page.screenshot({ path: f });
  log.push(id);
};
const shotLoc = async (id, loc) => { await loc.screenshot({ path: path.join(OUT, `${id}.png`) }); log.push(id); };
const shotPage = async (id, page, opts = {}) => { await page.screenshot({ path: path.join(OUT, `${id}.png`), ...opts }); log.push(id); };
async function slideTo(page, slide) {
  await page.getByTestId('carousel-pause').click().catch(() => {});
  for (let k = 0; k < 21; k++) {
    const cur = Number((await page.getByTestId('carousel-count').innerText()).split('/')[0]);
    if (cur === slide) break;
    await page.getByTestId('carousel-next').click({ force: true });
  }
  await settle(400);
}
const clipOf = async (page, sels, pad = 8) => {
  const boxes = [];
  for (const s of sels) { const b = await page.locator(s).first().boundingBox(); if (b) boxes.push(b); }
  const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad);
  const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad);
  const r = Math.max(...boxes.map((b) => b.x + b.width)) + pad;
  const bt = Math.max(...boxes.map((b) => b.y + b.height)) + pad;
  return { x, y, width: r - x, height: bt - y };
};

// ---- 오라클 상태 ----
const heavyLife = () => oracle(dev, `for (let seed = 1; seed <= 2000; seed++) {
    let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
    let farewell = false;
    while (s.phase === 'life' && s.age < 66) { if (s.pending !== null) { if (s.pending.eventId === 'middle-parents-farewell') farewell = true; s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state; } else s = core.stepYear(s).state; }
    const heavy = s.history.filter((h) => core.heavyKindOfEntry(h) !== null);
    if (s.phase === 'life' && farewell && s.pending === null && heavy.length >= 4 && s.history.some((h) => h.text === '부모님이 남기신 재산을 물려받았습니다.') && s.history.some((h) => h.by !== undefined) ) return { ...s, paused: true };
  }
  return null;`).then(withoutPlay);
const heavyLife2 = async () => (await heavyLife().catch(() => null)) ?? (await oracle(dev, `for (let seed = 1; seed <= 2000; seed++) {
    let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
    let farewell = false;
    while (s.phase === 'life' && s.age < 66) { if (s.pending !== null) { if (s.pending.eventId === 'middle-parents-farewell') farewell = true; s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state; } else s = core.stepYear(s).state; }
    const heavy = s.history.filter((h) => core.heavyKindOfEntry(h) !== null);
    if (s.phase === 'life' && farewell && s.pending === null && heavy.length >= 4 && s.history.some((h) => h.text === '부모님이 남기신 재산을 물려받았습니다.')) return { ...s, paused: true };
  }
  return null;`).then(withoutPlay));
const heavyPending = (eventId, era = 'present') => oracle(dev, `const mod = await import('/src/data/events/index.ts');
    const ev = mod.EVENT_POOL.byId.get(arg.eventId); const ages = core.possibleAgesOf(ev); const target = ages[Math.floor(ages.length / 2)];
    for (let seed = 1; seed <= 800; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
      while (s.phase === 'life' && s.age < target) { if (s.pending !== null) s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state; else s = core.stepYear(s).state; }
      if (s.phase !== 'life' || s.age !== target) continue;
      const visible = core.visibleChoices(ev, core.condContextOf(s)); if (visible.length < 2) continue;
      return { ...s, seen: { ...s.seen, [arg.eventId]: target }, lastChoiceAge: target, pending: { eventId: arg.eventId, key: arg.eventId + '@' + target, age: target, choiceIds: visible.map((c) => c.id) } };
    }
    return null;`, { eventId, era }).then(withoutPlay);
const delegated = (opts) => oracle(dev, `for (let seed = arg.from; seed < arg.from + 3000; seed++) {
    let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
    if (arg.tier !== null && s.character.parentWealth !== arg.tier) continue;
    for (let g = 0; g < 200 && s.phase === 'life' && s.age < 19; g++) {
      if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; }
      const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due);
      const r = core.stepYear(s);
      if (r.tick.kind === 'resolved' && r.tick.by === arg.by && s.age >= arg.minAge && (arg.eventId === null || r.tick.eventId === arg.eventId) && (arg.first === null || (r.tick.firstParent === true) === arg.first) && (arg.cite === null || (core.citationFor(arg.ev(r.tick.eventId), arg.era, 2026) !== null) === arg.cite)) return { start: s, tick: r.tick };
      s = r.state;
    }
  }
  return null;`.replace('arg.ev(r.tick.eventId)', 'null'), { from: opts.from ?? 1, era: opts.era ?? 'present', tier: opts.tier ?? null, by: opts.by ?? 'parent', minAge: opts.minAge ?? 0, eventId: opts.eventId ?? null, first: opts.first ?? null, cite: null }).then((y) => (y ? { ...y, start: withoutPlay(y.start) } : null));
const ON = { ...DEFAULT_SETTINGS, gentle: true, speed: 1, noteCards: false };
const OFF = { ...DEFAULT_SETTINGS, gentle: false, speed: 1, noteCards: false };
const X2 = { ...DEFAULT_SETTINGS, speed: 2, noteCards: false };

/** 부모 카드가 뜨면 일시정지하고 카드와 인생 기록을 함께 찍는다 */
async function parentShot(id, y, vp, mode, { font = 100, settings = X2, withLog = true, engine = null } = {}) {
  const { ctx, page } = await page_(vp, mode, { game: { ...y.start, paused: false }, settings, wait: 'life-screen', font, engine });
  for (let i = 0; i < 700; i++) { if (await page.getByTestId('parent-card').count()) break; await sleep(60); }
  await page.getByTestId('pause').click({ force: true }).catch(() => {});
  await settle(500);
  if (await page.getByTestId('parent-card').count()) {
    // 긴 조각을 한 장으로 이을 때 화면에 고정된 컨트롤 띠가 중간에 끼어들지 않게 캡처 동안만 숨긴다(앱 코드는 그대로)
    await page.addStyleTag({ content: '[data-testid=controls],[data-testid=bottom-bar]{visibility:hidden !important}' });
    const clip = await clipOf(page, withLog ? ['[data-testid=parent-card]', '[data-testid=log]'] : ['[data-testid=parent-card]'], 6);
    clip.height = Math.min(clip.height, vp === 'm360' || vp === 'm320' ? 1400 : 900);
    await page.screenshot({ path: path.join(OUT, `${id}.png`), clip, fullPage: true });
    log.push(id);
  } else console.log('NO CARD', id);
  await ctx.close();
}

// ================================================================ A 첫 화면
if (PARTS.includes('A')) {
  for (const [id, vp, mode, font] of [['a01-d1280-light', 'd1280', 'light', 100], ['a02-d1280-dark', 'd1280', 'dark', 100], ['a03-d1920-light', 'd1920', 'light', 100], ['a04-m360-light', 'm360', 'light', 100], ['a05-m360-dark', 'm360', 'dark', 100], ['a06-d1280-forced', 'd1280', 'forced', 100], ['a07-d1280-low620', 'd1280low', 'light', 100], ['a08-d1366-low657', 'd1366low', 'light', 100], ['a09-d1280-200', 'd1280', 'light', 200], ['a10-m320-200', 'm320', 'light', 200]]) {
    const { ctx, page } = await page_(vp, mode, { font });
    await page.getByTestId('carousel-pause').click().catch(() => {});
    await shotPage(id, page, { fullPage: id.startsWith('a04') || id.startsWith('a05') || id.startsWith('a10') ? false : false });
    if (id === 'a04-m360-light' || id === 'a10-m320-200') {
      // 아래쪽(선택 영역 + 카드)도 한 장
      await page.evaluate(() => window.scrollTo(0, 900));
      await settle(400);
      await shotPage(id + '-down', page);
    }
    await ctx.close();
  }
  // 이어서 살기 띠: 저장된 판 → 나가기
  const S = await oracle(dev, `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(7), 'present'))); for (let g = 0; g < 4000 && s.phase === 'life' && s.age < 30; g++) { if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; } const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due); s = core.stepYear(s).state; } return { ...s, paused: true };`).then(withoutPlay);
  for (const [id, vp] of [['a11-resume-d1280', 'd1280'], ['a12-resume-m360', 'm360']]) {
    const { ctx, page } = await page_(vp, 'light', { game: S, settings: OFF, wait: 'life-screen' });
    await (vp === 'm360' ? page.getByTestId('tool-exit').tap() : page.getByTestId('tool-exit').click());
    await page.getByTestId('exit-ask').waitFor();
    await settle(600);
    await (vp === 'm360' ? page.getByTestId('exit-yes').tap() : page.getByTestId('exit-yes').click());
    await page.getByTestId('title-screen').waitFor();
    await settle(900);
    await page.getByTestId('carousel-pause').click().catch(() => {});
    await shotPage(id, page);
    await ctx.close();
  }
}

// ================================================================ B 슬라이드
if (PARTS.includes('B')) {
  const jobs = [
    ['b-d1280-light', 'd1280', 'light', 100, [4, 5, 16, 17, 18, 19, 20]],
    ['b-d1920-light', 'd1920', 'light', 100, [16, 19]],
    ['b-m360-light', 'm360', 'light', 100, [5, 16, 19, 20]],
    ['b-d1280-dark', 'd1280', 'dark', 100, [17, 20]],
    ['b-d1280-forced', 'd1280', 'forced', 100, [16, 17, 19, 20]],
    ['b-m320-200', 'm320', 'light', 200, [5, 16]],
  ];
  for (const [pre, vp, mode, font, slides] of jobs) {
    const { ctx, page } = await page_(vp, mode, { font });
    for (const n of slides) {
      await slideTo(page, n);
      await shotLoc(`${pre}-s${n}`, page.getByTestId('carousel'));
    }
    await ctx.close();
  }
}

// ================================================================ C 무거운 장면
if (PARTS.includes('C')) {
  const H = await heavyLife2();
  // 가린 줄: 1280 / 360 / 320@200 / 다크 / 강제 색상 + 펼친 줄
  for (const [id, vp, mode, font] of [['c01-rows-d1280', 'd1280', 'light', 100], ['c02-rows-m360', 'm360', 'light', 100], ['c03-rows-m320-200', 'm320', 'light', 200], ['c04-rows-dark', 'd1280', 'dark', 100], ['c05-rows-forced', 'd1280', 'forced', 100]]) {
    const { ctx, page } = await page_(vp, mode, { game: H, settings: ON, wait: 'life-screen', font });
    await page.getByTestId('log').scrollIntoViewIfNeeded();
    await shotLoc(id, page.getByTestId('log'));
    if (id === 'c01-rows-d1280') {
      await page.getByTestId('veil-btn').first().click();
      await settle(400);
      await shotLoc('c01b-row-open', page.getByTestId('log'));
    }
    await ctx.close();
  }
  // 가린 결정 시트(1280·360), 인라인(자동 모드), 접힌 띠
  const P = await heavyPending('middle-layoff');
  for (const [id, vp, settings, extra] of [['c06-sheet-d1280', 'd1280', ON, null], ['c07-sheet-m360', 'm360', ON, null], ['c08-inline-d1280', 'd1280', { ...ON, autoMode: true }, null], ['c09-fold-d1280', 'd1280', ON, 'fold']]) {
    const { ctx, page } = await page_(vp, 'light', { game: { ...P, paused: true }, settings, wait: 'life-screen' });
    await page.getByTestId('choice-panel').waitFor();
    await settle(900);
    if (extra === 'fold') {
      await page.getByTestId('decision-fold-btn').click();
      await settle(500);
      await shotLoc(id, page.getByTestId('decision-fold'));
    } else if (id.startsWith('c08')) {
      await shotPage(id, page);
    } else {
      await shotPage(id, page);
    }
    await ctx.close();
  }
  // 가린 부모·흘러감 카드 (360 라이트, 1280 강제 색상)
  const Yp = await delegated({ by: 'parent', eventId: 'infant-fever' });
  const Yc = await delegated({ by: 'child', eventId: 'school-bully' });
  if (Yp) await parentShot('c10-veiled-parent-m360', Yp, 'm360', 'light', { settings: { ...ON, speed: 2 } });
  if (Yc) await parentShot('c11-veiled-child-forced', Yc, 'd1280', 'forced', { settings: { ...ON, speed: 2 } });
  // 엔딩 (맨 위 한 줄 + 가린 연표 줄)
  const E = await oracle(dev, `for (let seed = 1; seed <= 400; seed++) { const start = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present'))); const end = core.playToEnd(start, (s) => s.pending.choiceIds[0]).state; const heavy = end.history.filter((h) => core.heavyKindOfEntry(h) !== null); if (heavy.length >= 4 && heavy.some((h) => h.by !== undefined) && end.history.filter((h) => h.by === 'child').length >= 1) return end; } return null;`).then(withoutPlay);
  {
    const { ctx, page } = await page_('d1280', 'light', { game: { ...E, gentleUsed: true }, settings: ON, wait: 'ending-screen' });
    await shotPage('c12-ending-top', page);
    await page.getByTestId('ending-timeline').scrollIntoViewIfNeeded();
    await page.getByTestId('veil-btn').first().click().catch(() => {});
    await settle(500);
    await shotLoc('c13-ending-timeline', page.getByTestId('ending-timeline'));
    await ctx.close();
  }
  // 첫 화면 스위치 켜짐 + 자살률 슬라이드 가림/펼침
  for (const [id, vp, mode] of [['c14-slide-d1280', 'd1280', 'light'], ['c15-slide-m360', 'm360', 'light'], ['c16-slide-dark', 'd1280', 'dark'], ['c17-slide-forced', 'd1280', 'forced']]) {
    const { ctx, page } = await page_(vp, mode, { settings: ON });
    await slideTo(page, 6);
    await shotLoc(id + '-veiled', page.getByTestId('carousel'));
    if (id === 'c14-slide-d1280') {
      await page.getByTestId('slide-veil-btn').click();
      await settle(500);
      await shotLoc(id + '-open', page.getByTestId('carousel'));
      await page.evaluate(() => window.scrollTo(0, 0));
      await shotLoc('c18-switch-on', page.getByTestId('gentle-slot'));
    }
    await ctx.close();
  }
}

// ================================================================ D 정보 패널
if (PARTS.includes('D')) {
  for (const [id, vp, mode, font, link] of [['d01-news-d1280', 'd1280', 'light', 100, 'link-news'], ['d02-intro-d1280', 'd1280', 'light', 100, 'link-intro'], ['d03-news-m360', 'm360', 'light', 100, 'link-news'], ['d04-intro-m320-200', 'm320', 'light', 200, 'link-intro'], ['d05-news-dark', 'd1280', 'dark', 100, 'link-news'], ['d06-intro-forced', 'd1280', 'forced', 100, 'link-intro']]) {
    const { ctx, page } = await page_(vp, mode, { font });
    await (vp.startsWith('m') ? page.getByTestId(link).tap() : page.getByTestId(link).click());
    await page.getByTestId('info-panel').waitFor();
    await settle(900);
    await shotPage(id, page);
    await ctx.close();
  }
  for (const [id, vp, font] of [['d07-foot-m360', 'm360', 100], ['d08-foot-m320-200', 'm320', 200]]) {
    const { ctx, page } = await page_(vp, 'light', { font });
    await page.getByTestId('title-foot').scrollIntoViewIfNeeded();
    await settle(500);
    await shotLoc(id, page.getByTestId('title-foot'));
    await ctx.close();
  }
}

// ================================================================ E 부모·흘러감 카드·기록 줄·엔딩
if (PARTS.includes('E')) {
  const Y1 = await delegated({ by: 'parent', first: true });
  const Y2 = await delegated({ by: 'parent', first: false, minAge: 3, from: 50 });
  const Ycs = [await delegated({ by: 'child', eventId: 'infant-new-sibling' }), await delegated({ by: 'child', eventId: 'school-bully' }), await delegated({ by: 'child', eventId: 'school-family-priority', era: 'past' })];
  for (const [id, vp, mode] of [['e01-first-m360-light', 'm360', 'light'], ['e02-first-m360-dark', 'm360', 'dark'], ['e03-first-d1280-light', 'd1280', 'light'], ['e04-first-d1280-dark', 'd1280', 'dark'], ['e05-first-d1920', 'd1920', 'light']]) if (Y1) await parentShot(id, Y1, vp, mode);
  for (let i = 0; i < Ycs.length; i++) if (Ycs[i]) await parentShot(`e06-flow${i + 1}-d1280`, Ycs[i], 'd1280', 'light');
  if (Y2) {
    await parentShot('e07-card-m320-200', Y2, 'm320', 'light', { font: 200 });
    await parentShot('e08-card-forced', Y2, 'd1280', 'forced');
  }
  // 인생 기록 줄 세 표지(본인·부모·흘러감) 한 화면: 기록이 쌓인 판
  const L3 = await oracle(dev, `for (let seed = 1; seed < 2000; seed++) { let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present'))); for (let g = 0; g < 4000 && s.phase === 'life' && s.age < 20; g++) { if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; } const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due); s = core.stepYear(s).state; } const h = s.history; if (s.phase === 'life' && h.some((x) => x.by === 'parent') && h.some((x) => x.by === 'child') && h.some((x) => x.kind === 'choice' && !x.by)) return { ...s, paused: true }; } return null;`).then(withoutPlay);
  for (const [id, vp] of [['e09-rows3-m360', 'm360'], ['e10-rows3-d1280', 'd1280']]) {
    const { ctx, page } = await page_(vp, 'light', { game: L3, settings: OFF, wait: 'life-screen' });
    await page.getByTestId('log').scrollIntoViewIfNeeded();
    await shotLoc(id, page.getByTestId('log'));
    await ctx.close();
  }
  // 엔딩 둘째 줄 세 갈래 + 연표 표지
  const E3 = await oracle(dev, `for (let seed = 1; seed <= 600; seed++) { const start = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present'))); const end = core.playToEnd(start, (s) => s.pending.choiceIds[0]).state; if (end.history.some((h) => h.by === 'parent') && end.history.some((h) => h.by === 'child')) return end; } return null;`).then(withoutPlay);
  {
    const { ctx, page } = await page_('d1280', 'light', { game: E3, settings: OFF, wait: 'ending-screen' });
    await shotPage('e11-ending-top', page);
    await page.getByTestId('ending-timeline').scrollIntoViewIfNeeded();
    await settle(400);
    await shotLoc('e12-ending-timeline', page.getByTestId('ending-timeline'));
    await ctx.close();
  }
  // 재력 1 대 5 (같은 카드가 집안 형편에 따라 다른 길)
  for (const ev of ['school-after-hours', 'infant-fever', 'school-scholarship']) {
    for (const tier of [1, 5]) {
      const y = await delegated({ by: 'parent', eventId: ev, tier });
      if (!y) { console.log('NO tier', ev, tier); continue; }
      const { ctx, page } = await page_('d1280', 'light', { game: { ...y.start, paused: false }, settings: X2, wait: 'life-screen' });
      for (let i = 0; i < 700; i++) { if (await page.getByTestId('parent-card').count()) break; await sleep(60); }
      await page.getByTestId('pause').click({ force: true }).catch(() => {});
      await settle(400);
      if (await page.getByTestId('parent-card').count()) await shotLoc(`e13-${ev}-t${tier}`, page.getByTestId('parent-card'));
      await ctx.close();
    }
  }
  // 일시정지 중 부모 카드(이미 위 e01 계열) · 자동 모드 인라인 카드와 직전 부모 카드 순서: 13세 이후 자동 모드
  const A13 = await oracle(dev, `for (let seed = 1; seed < 3000; seed++) { let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present'))); for (let g = 0; g < 4000 && s.phase === 'life'; g++) { if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; } const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due); const r = core.stepYear(s); if (r.tick.kind === 'resolved' && r.tick.by === 'parent' && s.age >= 13 && s.age <= 17) return s; s = r.state; } } return null;`).then((s) => (s ? withoutPlay(s) : null));
  if (A13) await parentShot('e14-auto-parent-d1280', { start: A13 }, 'd1280', 'light', { settings: { ...X2, autoMode: true } });
}

// ================================================================ W WebKit
if (PARTS.includes('W')) {
  const wk = await launchWebkit();
  const Y1 = await delegated({ by: 'parent', first: false, minAge: 3, from: 50 });
  {
    const { ctx, page } = await page_('d1280', 'light', { engine: wk });
    await page.getByTestId('carousel-pause').click().catch(() => {});
    await shotPage('w01-first-d1280', page);
    await ctx.close();
  }
  if (Y1) await parentShot('w02-parent-d1280', Y1, 'd1280', 'light', { engine: wk });
  await wk.close();
}

fs.writeFileSync(path.join(OUT, '_list.json'), JSON.stringify(log, null, 1));
console.log('captured', log.length);
await browser.close();
await devBrowser.close();
