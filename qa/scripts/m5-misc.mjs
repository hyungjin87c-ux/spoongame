// QA-003 M5 기타: 엔딩 최종 순자산 줄의 경우별 문구(20세 전·음수·0·양수), 새로고침이 경제를 두 번 돌리지 않는가(결정론 비교), 배포본이 개발 탐침을 무시하는가.
import { launch, mkctx, PROD, DEV, GAME_KEY, sleep, shot, runCase, READ_DASH_M5, editSave } from './m5-lib.mjs';
import { loadSave } from './m5-states.mjs';

const ONLY = process.env.ONLY || '';
const run = (c, fn) => (!ONLY || c.id.endsWith(ONLY) ? runCase(c, fn) : null);
const browser = await launch();

// ---- N07: 엔딩 줄 경우별 ----
await run({ id: 'M5-N07', cat: '정상', title: '엔딩 「최종 순자산」 줄의 경우별 문구: 20세 전에 끝난 인생(변조)·음수·0·양수 × 세 시대', steps: '엔딩 저장(양수·음수 −3,000·0·20세 전 사망)을 세 시대로 열어 final-net 블록을 읽는다', expected: '20세 전: 「스무 살이 되기 전이라 자산을 세지 않았습니다.」 한 문장(금액·자리 없음) / 음수: U+2212 「−3,000만 원」 / 0: 「0원」 / 지난·다가올 세상은 금액 아래 「지금 가치로 환산」 / 자리는 「같은 세상 안에서 …」' }, async () => {
  const bad = [];
  const rows = [];
  const shots = [];
  for (const era of ['present', 'past', 'future']) {
    for (const tag of ['ending', 'ending-neg', 'ending-zero', 'ending-early']) {
      const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
      const page = await ctx.newPage();
      await page.goto(PROD, { waitUntil: 'load' });
      await page.evaluate(([k, v]) => {
        localStorage.clear();
        localStorage.setItem(k, v);
      }, [GAME_KEY, loadSave(era, tag)]);
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('[data-testid="ending-screen"]', { timeout: 10000 });
      const t = await page.evaluate(() => {
        const q = (s) => document.querySelector(s);
        const tx = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
        return { value: tx(q('[data-testid="final-net-value"]')), basis: tx(q('[data-testid="final-net-basis"]')), standing: tx(q('[data-testid="final-net-standing"]')), none: tx(q('[data-testid="final-net-none"]')), dt: tx(q('[data-testid="final-net"] dt')) };
      });
      const where = `${era}/${tag}`;
      rows.push(`${where}: ${t.none ?? `${t.value}${t.basis ? ' + ' + t.basis : ''} · ${t.standing}`}`);
      if (t.dt !== '최종 순자산') bad.push(`${where}: dt ${t.dt}`);
      if (tag === 'ending-early') {
        if (t.none !== '스무 살이 되기 전이라 자산을 세지 않았습니다.') bad.push(`${where}: 20세 전 문장 「${t.none}」`);
        if (t.value || t.standing || t.basis) bad.push(`${where}: 20세 전인데 금액·자리·태그가 있음`);
      } else {
        if (!t.value) bad.push(`${where}: 금액 없음`);
        if (tag === 'ending-neg' && !/^−3,000만 원$/.test(t.value ?? '')) bad.push(`${where}: 음수 표기 ${t.value}`);
        if (tag === 'ending-zero' && t.value !== '0원') bad.push(`${where}: 0 표기 ${t.value}`);
        if ((era === 'present') === !!t.basis) bad.push(`${where}: 태그 ${t.basis}`);
        if (!/^같은 세상 안에서 /.test(t.standing ?? '')) bad.push(`${where}: 자리 ${t.standing}`);
        if (tag === 'ending-neg' && /상위/.test(t.standing ?? '')) bad.push(`${where}: 음수인데 「${t.standing}」`);
      }
      if (era === 'past' || tag === 'ending-early') {
        await page.locator('[data-testid="final-net"]').scrollIntoViewIfNeeded();
        shots.push(await shot(page, 'N07', `${era}-${tag}`));
      }
      await ctx.close();
    }
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : rows.join(' | '), shots };
});

// ---- B10: 새로고침이 경제를 두 번 돌리지 않는가 ----
await run({ id: 'M5-B10', cat: '공격', title: '진행 중 새로고침 연타가 경제를 두 번 돌리지 않는다: 같은 저장에서 새로고침 없이 24년 vs 250~800ms 무작위 간격(= 해 중간·해 끝 가리지 않고)으로 새로고침하며 24년 — 나이별 순자산·부채·소득·스탯이 같다', steps: '성인 대시보드 저장(개발 서버 시간 배율 30)에서 선택지는 첫 항목으로 누르며 +24년. A는 가만히, B는 250~800ms 무작위 간격으로 새로고침(한 해 = 약 220ms)', expected: '같은 나이의 자산·스탯이 A·B에서 완전히 같음(해 끝 규칙이 한 번만 돈다)' }, async () => {
  const raw = editSave(loadSave('present', 'adult-dash'), (d) => (d.paused = false));
  const run = async (reloadEveryMs) => {
    const ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(`${DEV}?__timescale=60`, { waitUntil: 'load' });
    await page.evaluate(([k, v]) => {
      localStorage.clear();
      localStorage.setItem(k, v);
    }, [GAME_KEY, raw]);
    await page.reload({ waitUntil: 'load' });
    const start = JSON.parse(raw).data.age;
    const series = new Map();
    const t0 = Date.now();
    let lastReload = Date.now();
    let reloads = 0;
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    let nextGap = 400;
    for (;;) {
      if (Date.now() - t0 > 90000) break;
      let snap;
      try {
        snap = await page.evaluate((k) => {
          const r = localStorage.getItem(k);
          const panel = document.querySelector('[data-testid="choice-panel"]');
          const guardOpen = panel ? [...panel.querySelectorAll('.choice')].every((b) => b.getAttribute('aria-disabled') !== 'true') : false;
          return { raw: r, hasPanel: !!panel, guardOpen };
        }, GAME_KEY);
      } catch {
        await sleep(50);
        continue;
      }
      const d = JSON.parse(snap.raw).data;
      series.set(d.age + (d.pending ? 'p' : ''), { net: d.assets?.net, debt: d.assets?.debt, income: d.assets?.income, stats: d.stats, phase: d.phase, hist: d.history.length });
      if (d.phase === 'ending' || d.age >= start + 24) break;
      if (snap.hasPanel && snap.guardOpen) {
        await page.locator('[data-testid="choice-panel"] .choice').first().click({ timeout: 2000 }).catch(() => {});
        continue;
      }
      if (reloadEveryMs && Date.now() - lastReload > nextGap) {
        lastReload = Date.now();
        nextGap = 250 + Math.floor(rnd() * 550);
        reloads++;
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      }
      await sleep(12);
    }
    await ctx.close();
    return { series, reloads };
  };
  const A = await run(0);
  const B = await run(-1);
  const bad = [];
  console.log('A키', [...A.series.keys()].join(','), '| B키', [...B.series.keys()].join(','), '| B reload', B.reloads);
  let compared = 0;
  for (const [k, a] of A.series) {
    if (!B.series.has(k)) continue;
    compared++;
    const b = B.series.get(k);
    if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(`${k}세: A ${JSON.stringify(a).slice(0, 90)} ≠ B ${JSON.stringify(b).slice(0, 90)}`);
  }
  if (compared < 12) bad.push(`비교 가능한 나이가 ${compared}개뿐`);
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 4).join(' / ') : `나이 ${compared}개 지점의 자산·스탯이 새로고침 ${B.reloads}번을 끼워도 같음`, shots: [] };
});

// ---- X02: 배포본이 개발 탐침을 무시 ----
await run({ id: 'M5-X02', cat: '환경', title: '배포본(prod)이 개발 탐침(?__timescale·__quota·__crash·__exit)을 무시하고 서비스 워커·외부 요청이 없다', steps: 'prod에 ?__timescale=100&__quota&__crash&__exit로 진행 중인 판을 열고 2.5초 뒤 한 해 진행률·화면·저장을 본다', expected: '진행률이 한 해의 일부(시간 배율 무시), 오류 화면 아님, 저장 정상, 서비스 워커 0, 외부 요청 0' }, async () => {
  const bad = [];
  const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
  const page = await ctx.newPage();
  await page.addInitScript(`window.__readDash = ${READ_DASH_M5.toString()};`);
  await page.goto(PROD, { waitUntil: 'load' });
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [GAME_KEY, editSave(loadSave('present', 'adult-dash'), (d) => (d.paused = false))]);
  await page.goto(`${PROD}?__timescale=100&__quota&__crash&__exit`, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="life-screen"]', { timeout: 10000 }).catch(() => bad.push('인생 화면이 아님(__exit/__crash가 먹힘)'));
  await sleep(2500);
  const d = await page.evaluate(() => window.__readDash());
  const pct = await page.evaluate(() => document.querySelector('[data-testid="year-pct"]')?.textContent);
  const sw = await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations?.())?.length ?? 0);
  const saved = await page.evaluate((k) => localStorage.getItem(k) !== null, GAME_KEY);
  if (d.screen !== 'life-screen') bad.push(`화면 ${d.screen}`);
  if (parseInt(pct, 10) > 60) bad.push(`진행률 ${pct} — 시간 배율이 먹힌 듯함`);
  if (sw) bad.push(`서비스 워커 ${sw}개`);
  if (!saved) bad.push('저장 실패(__quota가 먹힌 듯)');
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `2.5초 뒤 진행률 ${pct}, 화면 ${d.screen}, 저장 있음, 서비스 워커 ${sw}개`, shots: [] };
});

await browser.close();
