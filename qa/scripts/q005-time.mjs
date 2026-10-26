// SPEC-005 QA 8 시간(연출 시간만): 1배속 0~12세(사람이 고르는 카드가 없는 구간) 몇 해를 실제 시계로 돌려 해마다 연출 대기를 모델(core/timing.ts#holdMsFor, report:time의 같은 함수)과 대조한다.
// 상태는 개발 서버(5391)의 core로 만들고 프로덕션 빌드(4391)에 심어 연다. 사용: node qa/scripts/q005-time.mjs --years 13 [--engine webkit]
import fs from 'node:fs';
import path from 'node:path';
import { launchChromium, launchWebkit, VP, Watch, PROD, DEV, RES, run, ok, bad, note, sleep, readSave, seedPage, DEFAULT_SETTINGS, oracle, withPlay, withoutPlay } from './q005-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const YEARS = Number(arg('years', '13'));
const ENGINE = arg('engine', 'chromium');
const SPEED = Number(arg('speed', '1'));
const tag = `${ENGINE === 'webkit' ? 'W-' : ''}T${SPEED}x`;
const browser = await (ENGINE === 'webkit' ? launchWebkit() : launchChromium());
const devBrowser = await launchChromium();
const dev = await (await devBrowser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });

// 시대마다: 0~YEARS해에 부모·흘러감 카드가 3장 이상이고 인용 박스가 든 카드가 하나 이상인 시드를 찾는다. 해마다의 기대 연출 대기(ms)를 core 함수로 같이 낸다.
const plan = (era) =>
  oracle(dev, `const mod = await import('/src/data/events/index.ts');
    for (let seed = 11; seed < 3000; seed++) {
      let s0 = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
      let s = s0; const ticks = [];
      for (let g = 0; g < 100 && s.phase === 'life' && s.age < arg.years; g++) {
        if (s.pending !== null) break;
        const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due);
        const r = core.stepYear(s);
        ticks.push({ fromAge: s.age, kind: r.tick.kind, by: r.tick.by ?? null, lines: r.tick.lines ?? null, readNeedMs: r.tick.readNeedMs ?? null, eventId: r.tick.eventId ?? null, hold: core.holdMsFor(r.tick.kind, { mode: s0.lifeLength, lines: r.tick.lines, readNeedMs: r.tick.readNeedMs }) });
        s = r.state;
        if (r.tick.kind === 'choice' || r.tick.kind === 'death') break;
      }
      if (s.age < arg.years || ticks.length < arg.years) continue;
      const cards = ticks.filter((t) => t.by);
      if (cards.length < 3) continue;
      const cited = cards.filter((t) => { const ev = mod.EVENT_POOL.byId.get(t.eventId); return ev && core.citationFor(ev, arg.era, 2026) !== null; }).length;
      if (cited < 1) continue;
      return { seed, start: s0, ticks, lifeLength: s0.lifeLength, quietMs: core.holdMsFor(null, { mode: s0.lifeLength }), cards: cards.length, cited };
    }
    return null;`, { era, years: YEARS });

const results = [];
for (const era of ['past', 'present', 'future']) {
  const P = await plan(era);
  if (!P) { await run({ id: `${tag}-${era}`, area: '시간', title: `${era} 연출 시간 표본`, steps: '-', expected: '-' }, async () => note('표본 상태를 찾지 못함')); continue; }
  results.push({ era, P });
}

async function measure({ era, P }) {
  const ctx = await browser.newContext({ ...VP.d1280, locale: 'ko-KR' });
  const watch = new Watch(era).attach(ctx);
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__t = [];
    window.__cards = [];
    const age = () => Number((document.querySelector('[data-testid="life-age"]')?.textContent ?? '').replace(/[^\d]/g, '')) || 0;
    let last = -1;
    let lastCard = null;
    const scan = () => {
      const a = age();
      if (document.querySelector('[data-testid="life-screen"]') && a !== last) { last = a; window.__t.push({ age: a, t: performance.now() }); }
      const pc = document.querySelector('[data-testid="parent-card"]');
      const k = pc ? pc.getAttribute('data-key') : null;
      if (k !== lastCard) {
        if (k) window.__cards.push({ key: k, by: pc.getAttribute('data-by'), on: performance.now(), off: null });
        else if (window.__cards.length && window.__cards[window.__cards.length - 1].off === null) window.__cards[window.__cards.length - 1].off = performance.now();
        lastCard = k;
      }
    };
    const start = () => {
      new MutationObserver(scan).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
      setInterval(scan, 50);
    };
    if (document.documentElement) start();
    else document.addEventListener('readystatechange', start, { once: true });
  });
  await seedPage(page, { game: withPlay(withoutPlay({ ...P.start, paused: false })), settings: { ...DEFAULT_SETTINGS, speed: SPEED, autoMode: false, noteCards: false } });
  const t0 = Date.now();
  await page.goto(PROD + '/');
  await page.getByTestId('life-screen').waitFor({ timeout: 60000 });
  let guard = 0;
  while (Date.now() - t0 < 600000) {
    const a = await page.evaluate(() => Number((document.querySelector('[data-testid="life-age"]')?.textContent ?? '').replace(/[^\d]/g, '')) || 0);
    if (a >= YEARS) break;
    await sleep(500);
    guard++;
  }
  await sleep(300);
  const t = await page.evaluate(() => window.__t);
  const cards = await page.evaluate(() => window.__cards);
  const sv = await readSave(page);
  const w = watch.take();
  await ctx.close();
  return { era, t, cards, play: sv?.data?.play ?? null, console: w.console.length, external: w.external.length };
}

const outs = await Promise.all(results.map((r) => measure(r)));
for (const o of outs) console.log("DBG", o.era, o.t.length, o.cards.length, o.console, o.external);
const table = [];
for (const o of outs) {
  const P = results.find((r) => r.era === o.era).P;
  // 해 k → k+1 사이 간격 = 그 해로 넘어올 때의 tick(= ticks[k-1])의 연출 대기. 처음 간격(로드 → 1세)은 「조용한 해」 대기.
  const rows = [];
  for (let k = 0; k < o.t.length - 1; k++) {
    const a = o.t[k].age;
    const dt = o.t[k + 1].t - o.t[k].t;
    // 나이 a에서 머문 시간 = a세 도착 때의 tick 대기. a=시작 나이면 tick null → 조용한 해 대기
    const tick = a === 0 ? null : P.ticks[a - 1];
    const expect = (tick ? tick.hold : P.quietMs) / SPEED;
    rows.push({ age: a, kind: tick ? tick.kind + (tick.by ? '/' + tick.by : '') : 'quiet(로드 직후)', lines: tick?.lines ?? null, need: tick?.readNeedMs ?? null, expectMs: Math.round(expect), measuredMs: Math.round(dt), ratio: +(dt / expect).toFixed(4) });
  }
  const sumE = rows.reduce((s, r) => s + r.expectMs, 0);
  const sumM = rows.reduce((s, r) => s + r.measuredMs, 0);
  table.push({ era: o.era, rows, sumE, sumM, ratio: +(sumM / sumE).toFixed(4), cards: o.cards.map((c) => ({ key: c.key, by: c.by, showMs: c.off ? Math.round(c.off - c.on) : null })), play: o.play, console: o.console, external: o.external });
}
fs.writeFileSync(path.join(RES, `time-${tag}.json`), JSON.stringify(table, null, 1));
for (const tb of table) {
  await run({ id: `${tag}-${tb.era}`, area: '시간', title: `${tb.era} 1~${YEARS}세 ${SPEED}배속 연출 시간 = 모델(holdMsFor)`, steps: `${tb.rows.length}해를 실제 시계로 관찰(부모·흘러감 카드 ${tb.cards.length}장 포함)`, expected: SPEED === 1 ? '해마다 실측/모델 비 0.97~1.03, 합계 비 0.99~1.01, play.hold ≈ 합계' : '해마다 모델보다 20ms 이상 빠르지 않고 100ms 넘게 늦지 않음, 합계 비 0.985~1.015' }, async () => {
    const worst = tb.rows.reduce((m, r) => (Math.abs(r.ratio - 1) > Math.abs(m.ratio - 1) ? r : m), tb.rows[0]);
    const ph = tb.play ? tb.play.hold : null;
    const t = `${tb.rows.length}해 합계 모델 ${(tb.sumE / 1000).toFixed(1)}s · 실측 ${(tb.sumM / 1000).toFixed(1)}s · 비 ${tb.ratio}, 최악 해 ${worst.age}세(${worst.kind}) 비 ${worst.ratio}, play.hold ${ph !== null ? (ph / 1000).toFixed(1) + 's' : '-'}, 카드 노출 ${tb.cards.map((c) => `${c.key}:${c.showMs}ms`).join(' ')}`;
    // 1배속: 해마다 ±3%·합계 ±1%. 빠른 배속은 연출 대기가 짧아(8배속 1~5초) 고정 지연(프레임·타이머 약 20~50ms)이 비로 크게 보이므로 해마다 +100ms 이내·합계 ±1.5%로 본다(앞 연출이 모델보다 빨라지는 쪽은 허용하지 않는다)
    const absOk = tb.rows.every((r) => r.measuredMs - r.expectMs >= -20 && r.measuredMs - r.expectMs <= (SPEED === 1 ? 300 : 100));
    const pass = (SPEED === 1 ? Math.abs(tb.ratio - 1) <= 0.01 && tb.rows.every((r) => Math.abs(r.ratio - 1) <= 0.03) : Math.abs(tb.ratio - 1) <= 0.015 && absOk) && tb.console === 0 && tb.external === 0;
    const maxAbs = Math.max(...tb.rows.map((r) => r.measuredMs - r.expectMs));
    return pass ? ok(t + `, 해마다 최대 초과 ${maxAbs}ms`, { evidence: JSON.stringify(tb.rows) }) : bad(t + `, 해마다 최대 초과 ${maxAbs}ms`, { evidence: JSON.stringify(tb.rows) });
  });
}
await browser.close();
await devBrowser.close();
console.log('done', tag);
