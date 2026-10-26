// SPEC-005 r4 QA 9 시간 표본: 결정 카드가 있는 해에서 첫 선택지를 누른 뒤 몇 해를 1배속 실제 시계로 돌려, 해마다 연출 대기를 모델(core/timing.ts#holdMsFor — 앱과 report:time이 쓰는 같은 함수)과 대조한다.
// 상태는 개발 서버(5391)의 core로 만들고 프로덕션 빌드(4391)에 심어 연다. 사용: node qa/scripts/q005r4-time.mjs [--years 6] [--engine webkit]
import { launchChromium, launchWebkit, VP, Watch, PROD, DEV, run, ok, bad, note, sleep, readSave, seedPage, DEFAULT_SETTINGS, oracle, withPlay, withoutPlay, writeJson } from './q005r4-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const YEARS = Number(arg('years', '6'));
const ENGINE = arg('engine', 'chromium');
const tag = `${ENGINE === 'webkit' ? 'W-' : ''}T1x`;
const browser = await (ENGINE === 'webkit' ? launchWebkit() : launchChromium());
const devB = await launchChromium();
const dev = await (await devB.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });

// 시대마다: 본인이 고르는 결정 카드(통계 인용 있음)가 대기 중인 상태 + 그 뒤 YEARS해 동안 다음 선택지가 없는 표본. 기대 대기(ms)를 core 함수로 같이 낸다.
const plan = (era, minAge) =>
  oracle(
    dev,
    `const mod = await import('/src/data/events/index.ts');
    for (let seed = 21; seed < 4000; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
      for (let g = 0; g < 400 && s.phase === 'life'; g++) {
        if (s.pending !== null) {
          const ev = mod.EVENT_POOL.byId.get(s.pending.eventId);
          const self = core.decisionFor(s.pending.eventId, s.age) === 'self';
          const cite = ev ? core.citationFor(ev, arg.era, 2026) : null;
          if (self && cite !== null && s.age >= arg.minAge && s.pending.choiceIds.length >= 2) {
            const start = s;
            const first = s.pending.choiceIds[0];
            const r0 = core.resolveChoiceStep(s, s.pending.key, first);
            let t = r0.state; const ticks = [{ fromAge: s.age, kind: r0.tick.kind, by: r0.tick.by ?? null, lines: r0.tick.lines ?? null, readNeedMs: r0.tick.readNeedMs ?? null, hold: core.holdMsFor(r0.tick.kind, { mode: start.lifeLength, lines: r0.tick.lines, readNeedMs: r0.tick.readNeedMs }) }];
            let clean = true;
            for (let k = 0; k < arg.years && t.phase === 'life'; k++) {
              if (t.pending !== null) { clean = false; break; }
              const due = core.dueNote(t); if (due !== null) { clean = false; break; }
              const r = core.stepYear(t);
              ticks.push({ fromAge: t.age, kind: r.tick.kind, by: r.tick.by ?? null, lines: r.tick.lines ?? null, readNeedMs: r.tick.readNeedMs ?? null, hold: core.holdMsFor(r.tick.kind, { mode: start.lifeLength, lines: r.tick.lines, readNeedMs: r.tick.readNeedMs }) });
              t = r.state;
              if (r.tick.kind === 'choice' || r.tick.kind === 'death') { clean = false; break; }
            }
            if (clean && ticks.length > arg.years) return { seed, start, eventId: s.pending.eventId, firstChoice: first, age: s.age, ticks, lifeLength: start.lifeLength, cited: cite.id };
          }
          s = core.autoResolveStep(s, s.pending.key).state; continue;
        }
        const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due);
        s = core.stepYear(s).state;
      }
    }
    return null;`,
    { era, years: YEARS, minAge },
  );

const specs = [
  { era: 'present', minAge: 20 },
  { era: 'future', minAge: 30 },
];
const plans = [];
for (const sp of specs) {
  const P = await plan(sp.era, sp.minAge);
  if (!P) {
    await run({ id: `${tag}-${sp.era}`, area: '시간', title: `${sp.era} 결정 카드 구간`, steps: '-', expected: '-' }, async () => note('표본 상태를 찾지 못함'));
    continue;
  }
  plans.push({ ...sp, P });
}

async function measure({ era, P }) {
  const ctx = await browser.newContext({ ...VP.d1280, locale: 'ko-KR' });
  const watch = new Watch(era).attach(ctx);
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__t = [];
    window.__click = null;
    document.addEventListener(
      'click',
      (e) => {
        const b = e.target instanceof Element ? e.target.closest('[data-testid^="choice-"]') : null;
        if (b && window.__click === null && /^choice-(?!ask|title|text)/.test(b.getAttribute('data-testid') ?? '')) window.__click = performance.now();
      },
      true,
    );
    const age = () => Number((document.querySelector('[data-testid="life-age"]')?.textContent ?? '').replace(/[^\d]/g, '')) || 0;
    let last = -1;
    const scan = () => {
      const a = age();
      if (document.querySelector('[data-testid="life-screen"]') && a !== last) {
        last = a;
        window.__t.push({ age: a, t: performance.now() });
      }
    };
    const start = () => {
      new MutationObserver(scan).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
      setInterval(scan, 50);
    };
    if (document.documentElement) start();
    else document.addEventListener('readystatechange', start, { once: true });
  });
  await seedPage(page, { game: withPlay(withoutPlay({ ...P.start, paused: false })), settings: { ...DEFAULT_SETTINGS, speed: 1, autoMode: false, noteCards: false } });
  await page.goto(PROD + '/');
  await page.getByTestId('choice-panel').waitFor({ timeout: 60000 });
  // 읽는 척 2.5초 뒤 첫 선택지를 누른다(입력 가드 400ms 지난 뒤)
  await sleep(2500);
  const cardInfo = await page.evaluate(() => ({ ask: !!document.querySelector('[data-testid="choice-ask"]'), insight: !!document.querySelector('.cite__insight') }));
  const chosen = P.firstChoice;
  await page.getByTestId(`choice-${chosen}`).click();
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    const a = await page.evaluate(() => Number((document.querySelector('[data-testid="life-age"]')?.textContent ?? '').replace(/[^\d]/g, '')) || 0);
    if (a >= P.age + YEARS + 1) break;
    await sleep(400);
  }
  await sleep(300);
  const t = await page.evaluate(() => window.__t);
  const click = await page.evaluate(() => window.__click);
  const sv = await readSave(page);
  const w = watch.take();
  await ctx.close();
  return { era, t, click, cardInfo, play: sv?.data?.play ?? null, console: w.console.length, external: w.external.length };
}

const outs = [];
for (const p of plans) outs.push(await measure(p));
const table = [];
for (const o of outs) {
  const P = plans.find((r) => r.era === o.era).P;
  // 선택을 누르면 그 자리에서 한 해가 지나(나이 +1, 결과 tick 'resolved') 새 나이에서 hold(tick0)만큼 머문다. 그래서 첫 나이 변화는 클릭과 거의 동시(응답 지연)이고, 그 뒤 k번째 나이 변화 간격이 ticks[k]의 연출 대기다.
  const after = o.t.filter((x) => x.age > P.age).sort((a, b) => a.age - b.age);
  const rows = [];
  const clickLag = after.length ? Math.round(after[0].t - o.click) : null;
  for (let k = 0; k + 1 < after.length && k < P.ticks.length; k++) {
    const dt = after[k + 1].t - after[k].t;
    const tick = P.ticks[k];
    rows.push({ stayAt: P.age + k + 1, kind: tick.kind + (tick.by ? '/' + tick.by : ''), lines: tick.lines, need: tick.readNeedMs, expectMs: tick.hold, measuredMs: Math.round(dt), ratio: +(dt / tick.hold).toFixed(4) });
  }
  const sumE = rows.reduce((s, r) => s + r.expectMs, 0);
  const sumM = rows.reduce((s, r) => s + r.measuredMs, 0);
  table.push({ clickLag, era: o.era, eventId: P.eventId, citation: P.cited, startAge: P.age, rows, sumE, sumM, ratio: +(sumM / sumE).toFixed(4), cardInfo: o.cardInfo, play: o.play, console: o.console, external: o.external });
}
writeJson(`time-${tag}.json`, table);
for (const tb of table) {
  await run({ id: `${tag}-${tb.era}`, area: '시간', title: `${tb.era} 결정 카드(${tb.eventId}, ${tb.startAge}세) 선택 뒤 ${tb.rows.length}해 1배속 연출 시간 = 모델(holdMsFor)`, steps: `시트에서 2.5초 뒤 첫 선택지 클릭 → 이후 해마다 나이가 바뀐 시각을 실제 시계로 관찰`, expected: '해마다 실측/모델 비 0.97~1.03(+지연 300ms 이내), 합계 비 0.99~1.01' }, async () => {
    const worst = tb.rows.reduce((m, r) => (Math.abs(r.ratio - 1) > Math.abs(m.ratio - 1) ? r : m), tb.rows[0]);
    const maxAbs = Math.max(...tb.rows.map((r) => r.measuredMs - r.expectMs));
    const minAbs = Math.min(...tb.rows.map((r) => r.measuredMs - r.expectMs));
    const t = `${tb.rows.length}해 합계 모델 ${(tb.sumE / 1000).toFixed(1)}s · 실측 ${(tb.sumM / 1000).toFixed(1)}s · 비 ${tb.ratio}, 최악 해 ${worst.stayAt}세(${worst.kind}) 비 ${worst.ratio}, 해마다 오차 ${minAbs}~${maxAbs}ms, 시트에 질문 ${tb.cardInfo.ask ? '있음' : '없음'}·풀이 ${tb.cardInfo.insight ? '있음' : '없음'}`;
    const pass = Math.abs(tb.ratio - 1) <= 0.01 && tb.rows.every((r) => Math.abs(r.ratio - 1) <= 0.03) && tb.console === 0 && tb.external === 0;
    return (pass ? ok : bad)(t, { evidence: JSON.stringify(tb.rows) });
  });
}
await browser.close();
await devB.close();
console.log('done', tag);
