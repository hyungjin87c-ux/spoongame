// QA-003 M7b L01: 360x740 터치 시트 — 실제 터치 스와이프(CDP synthesizeScrollGesture)로 세 번째 선택지·영향 안내·자동 모드 안내에 닿는지, 더 있다는 것이 보이는지(맨 위 화면에서 아래 가장자리에 잘린 요소)
// 사용: node qa/scripts/m7b-sheet.mjs   결과: 케이스 L01 + 스크린샷 M7b-L01-*
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, mkctx, PROD, DEV, shot, runCase, readCard, cardReady, evalCore, findCardState, TOUCH, GAME_KEY, SETTINGS_KEY, settingsEnvelope, SET_MANUAL } from './m7b-lib.mjs';
import { openCard, VPS, CARD_MEASURE } from './m7b-audit.mjs';

const browser = await launch();
const STATES = path.join(OUT, 'states');

// 가장 긴 카드 몇 장을 수확 표본에서 고른다(제목+상황+선택지+인용+출처 글자 수)
const files = fs.readdirSync(OUT).filter((f) => /^samples-harvest-(past|present|future)-[ab]\.jsonl$/.test(f));
const best = new Map();
for (const f of files) {
  for (const line of fs.readFileSync(path.join(OUT, f), 'utf8').trim().split('\n')) {
    const l = JSON.parse(line);
    for (const c of l.cards || []) {
      const len = c.title.length + c.text.length + c.choices.reduce((s, x) => s + x.label.length + x.impact.length * 6, 0) + (c.cite ? c.cite.text.length + c.cite.src.length : 0) + (c.hint ? 40 : 0);
      const ev = c.key.replace(/@.*/, '');
      const k = `${l.era}|${ev}`;
      if (!best.has(k) || best.get(k).len < len) best.set(k, { era: l.era, ev, len, nChoices: c.choices.length, hasCite: !!c.cite });
    }
  }
}
const top = [...best.values()].filter((x) => x.nChoices >= 3).sort((a, b) => b.len - a.len).slice(0, 6);
const names = [];
{
  const ctx = await mkctx(browser);
  const p = await ctx.newPage();
  await p.goto(DEV, { waitUntil: 'load' });
  await p.waitForSelector('[data-testid="title-screen"]');
  for (const t of top) {
    const s = await findCardState(p, t.ev, t.era, {});
    if (!s) continue;
    const name = `long-${t.era}-${t.ev}`;
    fs.writeFileSync(path.join(STATES, `${name}.json`), JSON.stringify(s));
    names.push({ name, ...t });
  }
  await ctx.close();
}
// 비교용: 짧은 카드(선택지 2개)도 하나
{
  const ctx = await mkctx(browser);
  const p = await ctx.newPage();
  await p.goto(DEV, { waitUntil: 'load' });
  await p.waitForSelector('[data-testid="title-screen"]');
  const s = await findCardState(p, 'school-scholarship', 'present', {});
  fs.writeFileSync(path.join(STATES, 'short-present-scholarship.json'), JSON.stringify(s));
  names.push({ name: 'short-present-scholarship', era: 'present', ev: 'school-scholarship', len: 0, nChoices: 2 });
  await ctx.close();
}

await runCase({ id: 'L01', cat: '레이아웃', title: '360×740 터치 시트: 세 번째 선택지·영향 안내·자동 모드 안내에 실제 스와이프로 닿는지, 맨 위 화면에서 더 있다는 단서(잘린 요소)가 보이는지', steps: `가장 긴 카드 ${names.length - 1}장(수확 표본 글자 수 상위)+짧은 카드 1장을 360×740 터치로 열고, 시트에서 위로 쓸어 올려(스와이프) 선택지 3개·영향 안내·자동 모드 안내가 온전히 보이는 순간을 찾는다`, expected: '모든 선택지·안내에 스크롤로 닿음, 스크롤이 필요한 카드는 맨 위 화면의 아래 가장자리에 잘린 요소(또는 다른 단서)가 있음' }, async () => {
  const bad = [];
  const rows = [];
  const shots = [];
  const noCue = [];
  const docYs = [];
  for (const n of names) {
    const { ctx, page } = await openCard(browser, n.name, 'sheet', { vp: VPS[2], hidden: true });
    await cardReady(page);
    await sleep(300);
    const m = await page.evaluate(CARD_MEASURE);
    const cdp = await ctx.newCDPSession(page);
    const fullyVisible = async (sel, idx = 0) =>
      page.evaluate(([s, i]) => {
        const sheet = document.querySelector('.sheet');
        const sr = sheet.getBoundingClientRect();
        const els = [...document.querySelectorAll(s)];
        const e = els[i];
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return r.top >= sr.top - 1 && r.bottom <= sr.bottom + 1 && r.bottom <= innerHeight + 1;
      }, [sel, idx]);
    const seen = { c1: false, c2: false, c3: false, hint: false, auto: false };
    const nCh = await page.evaluate(() => document.querySelectorAll('.choice').length);
    const update = async () => {
      seen.c1 ||= !!(await fullyVisible('.choice', 0));
      seen.c2 ||= !!(await fullyVisible('.choice', 1));
      if (nCh >= 3) seen.c3 ||= !!(await fullyVisible('.choice', 2));
      seen.hint ||= !!(await fullyVisible('.decision__hint'));
      seen.auto ||= !!(await fullyVisible('.decision__auto'));
    };
    await update();
    const top0 = await shot(page, 'L01', `${n.name}-top`);
    if (n === names[0]) shots.push(top0);
    let gestures = 0;
    for (let i = 0; i < 8; i++) {
      const before = await page.evaluate(() => document.querySelector('.sheet').scrollTop);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 620 }] });
      for (let k = 1; k <= 10; k++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y: 620 - k * 24 }] });
        await sleep(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(350);
      const after = await page.evaluate(() => document.querySelector('.sheet').scrollTop);
      gestures++;
      await update();
      if (after === before) break;
    }
    const docY = await page.evaluate(() => Math.round(window.scrollY));
    docYs.push(`${n.ev}:${docY}`);
    const bottom = await shot(page, 'L01', `${n.name}-bottom`);
    if (n === names[0]) shots.push(bottom);
    const needScroll = m.sheet.canScroll;
    const cue = m.scrollCue;
    const hasCue = !needScroll || cue.cut.length > 0;
    rows.push(`${n.ev}/${n.era}: 스크롤 ${m.sheet.scrollH}/${m.sheet.clientH}${needScroll ? '' : '(스크롤 불필요)'} 스와이프 ${gestures}번 → 선택지1 ${seen.c1} 2 ${seen.c2} 3 ${nCh >= 3 ? seen.c3 : '-'} 영향안내 ${seen.hint} 자동안내 ${seen.auto} · 맨 위 단서 ${needScroll ? (cue.cut.length ? cue.cut.join('·') : '없음') : '-'}`);
    if (!seen.c1 || !seen.c2 || (nCh >= 3 && !seen.c3)) bad.push(`${n.ev}: 선택지에 스와이프로 닿지 못함 ${JSON.stringify(seen)}`);
    if (!seen.hint || !seen.auto) bad.push(`${n.ev}: 안내에 닿지 못함 ${JSON.stringify(seen)}`);
    if (!hasCue) noCue.push(`${n.ev}/${n.era}`);
    await ctx.close();
  }
  rows.push(`스와이프 뒤 시트 뒤쪽 문서 스크롤(px): ${docYs.join(', ')}`);
  if (noCue.length) rows.push(`※ 스크롤이 필요한데 맨 위 화면에 잘린 요소(단서)가 없는 카드: ${noCue.join(', ')}`);
  return { verdict: bad.length ? 'FAIL' : noCue.length ? 'RECORD' : 'PASS', actual: (bad.length ? bad.join(' / ') + ' || ' : '') + rows.join(' | '), shots };
});
await browser.close();
