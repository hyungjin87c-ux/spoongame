// QA-003 M5 케이스 4(간이 상속): 부모 작별 장면의 선택지에 자산 ▲가 없는가, 해 끝 인생 기록 한 줄이 한 번만 나오는가(재력 1단계는 0번), 새로고침·이어 살기 뒤에도 한 번인가.
// 사용: node qa/scripts/m5-scen-inherit.mjs   (먼저 vite-node qa/scripts/m5-craft.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, DEV, OUT, GAME_KEY, sleep, shot, runCase, READ_DASH_M5, parseMan, waitGuard, editSave } from './m5-lib.mjs';

const crafted = JSON.parse(fs.readFileSync(path.join(OUT, 'craft-saves.json'), 'utf8'));
const browser = await launch();
const LINE = '부모님이 남기신 재산을 물려받았습니다.';
const INHERIT = [0, 1000, 8000, 60000, 150000];

async function openRaw(raw, { vp = { width: 1280, height: 800 }, ts = 60 } = {}) {
  const ctx = await mkctx(browser, { viewport: vp });
  await seedStorage(ctx, { [GAME_KEY]: raw });
  const page = await ctx.newPage();
  await page.addInitScript(`window.__readDash = ${READ_DASH_M5.toString()};`);
  await page.goto(`${DEV}?__timescale=${ts}`, { waitUntil: 'load' });
  return { ctx, page };
}
const logRows = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid="log-row"]')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
const siblingN = (page) => page.evaluate(() => document.querySelectorAll('[data-testid="family-sibling"]').length);
const count = (rows) => rows.filter((r) => r.includes(LINE)).length;
const saveOf = async (page) => JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
const readyChoice = (page) =>
  page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].length > 0 && [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 20000 });

/** 작별 장면: 일시정지 → 선택 → (기록·순자산 읽기) */
async function farewell(tier, choice, { vp } = {}) {
  const { ctx, page } = await openRaw(crafted[`farewell-tier${tier}`].raw, { vp });
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 20000 });
  await readyChoice(page);
  await page.locator('[data-testid="pause"]').click(); // 선택 뒤 시계가 더 돌지 않게
  const pre = await page.evaluate(() => window.__readDash());
  const preSave = await saveOf(page);
  const sib = await siblingN(page);
  const preShot = await shot(page, 'H01', `tier${tier}-${choice}-pre`);
  await page.locator(`[data-testid="choice-${choice}"]`).click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="choice-panel"]'), null, { timeout: 6000 });
  await sleep(400);
  const rows = await logRows(page);
  const post = await page.evaluate(() => window.__readDash());
  const postSave = await saveOf(page);
  return { ctx, page, pre, preSave, sib, rows, post, postSave, preShot };
}

// ---- H01: 작별 장면 영향 줄 ----
await runCase({ id: 'M5-H01', cat: '상속', title: '부모 작별 장면(middle-parents-farewell)의 세 선택지 영향 줄에 자산 ▲가 없고, 재력 1·2·3·5단계가 같은 줄이다', steps: '재력 1·2·3·5단계 저장에서 작별 카드를 열어 영향 줄을 읽는다', expected: '자산 ▲ 항목 0, 부채 항목 0, 재력 단계마다 영향 줄이 같음(상속은 선택 효과가 아님)' }, async () => {
  const lines = {};
  const bad = [];
  const shots = [];
  for (const tier of [1, 2, 3, 5]) {
    const { ctx, page } = await openRaw(crafted[`farewell-tier${tier}`].raw);
    await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 20000 });
    await readyChoice(page);
    const d = await page.evaluate(() => window.__readDash());
    lines[tier] = Object.fromEntries(d.choices.map((c) => [c.id, c.impact.map((i) => i.shown).join(' · ')]));
    for (const c of d.choices) {
      if (c.impact.some((i) => i.key === 'assets' && i.direction === 'up')) bad.push(`재력 ${tier} ${c.id}: 자산 ▲`);
      if (c.impact.some((i) => i.key === 'debt')) bad.push(`재력 ${tier} ${c.id}: 부채 항목`);
    }
    if (tier === 5) shots.push(await shot(page, 'H01', 'farewell-choices-tier5'));
    if (tier === 1) shots.push(await shot(page, 'H01', 'farewell-choices-tier1'));
    await ctx.close();
  }
  const ref = JSON.stringify(lines[1]);
  for (const t of [2, 3, 5]) if (JSON.stringify(lines[t]) !== ref) bad.push(`재력 ${t} 영향 줄이 재력 1과 다름: ${JSON.stringify(lines[t])} vs ${ref}`);
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `세 선택지 모두 자산 ▲ 없음, 4개 재력 단계 같은 줄: ${ref}`, shots };
});

// ---- H02: 한 번만, 재력 1단계는 0번, 금액 ----
const results = {};
await runCase({ id: 'M5-H02', cat: '상속', title: '해 끝 인생 기록에 「부모님이 남기신 재산을 물려받았습니다.」가 한 번만 나온다(재력 1단계 0번), 선택 기록 바로 뒤, 순자산 증가 = 표의 상속액 ÷ (형제 수 + 1)', steps: '재력 1·2·3·5 × 세 선택지 12번: 일시정지 → 선택 → 기록·순자산 읽기', expected: '재력 1: 0줄 / 재력 2·3·5: 1줄, 선택 기록 바로 뒤, 순자산 증가분 차이 = INHERIT[t] ÷ (형제+1) ± 연 규칙 오차' }, async () => {
  const bad = [];
  const shots = [];
  const rowsOut = [];
  for (const tier of [1, 2, 3, 5]) {
    for (const choice of ['stay', 'late', 'share']) {
      const r = await farewell(tier, choice);
      results[`${tier}-${choice}`] = { net: r.postSave.assets.net, sib: r.sib, rows: r.rows, preNet: r.preSave.assets.net };
      const n = count(r.rows);
      const want = tier === 1 ? 0 : 1;
      if (n !== want) bad.push(`재력 ${tier} ${choice}: 줄 ${n}개 (기대 ${want})`);
      if (n >= 1) {
        const i = r.rows.findIndex((x) => x.includes(LINE));
        // 같은 해의 선택 기록(작별 제목) 바로 뒤여야 한다
        const prev = r.rows[i - 1] ?? '';
        if (!/마지막 인사|선택/.test(prev) && !prev.includes(r.pre.choices.find((c) => c.id === choice)?.label ?? '@@')) bad.push(`재력 ${tier} ${choice}: 앞 줄이 선택 기록이 아님 「${prev.slice(0, 40)}」`);
        if (/\d+\s*(만|억)\s*원/.test(r.rows[i])) bad.push(`재력 ${tier} ${choice}: 기록 줄에 금액이 있음`);
      }
      rowsOut.push(`재력 ${tier} ${choice}: 형제 ${r.sib}, 순자산 ${r.preSave.assets.net}→${r.postSave.assets.net}, 상속줄 ${n}`);
      if (choice === 'stay' && (tier === 5 || tier === 1)) shots.push(await shot(r.page, 'H02', `log-tier${tier}-stay`));
      await r.ctx.close();
    }
  }
  // 상속액: 같은 선택에서 재력 t의 순자산 증가분 − 재력 1의 증가분 = INHERIT[t]/(형제+1)
  for (const choice of ['stay', 'late', 'share']) {
    const base = results[`1-${choice}`];
    for (const tier of [2, 3, 5]) {
      const r = results[`${tier}-${choice}`];
      const expected = Math.round(INHERIT[tier - 1] / (r.sib + 1));
      const got = r.net - r.preNet - (base.net - base.preNet);
      // 연 규칙(이자 등)은 상속 전 순자산으로 계산되므로 두 판의 차이는 상속액과 같아야 한다. 반올림·소액 차이만 허용
      if (Math.abs(got - expected) > Math.max(3, 0.002 * expected)) bad.push(`재력 ${tier} ${choice}: 순자산 증가 차이 ${got} ≠ 기대 ${expected} (형제 ${r.sib})`);
    }
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : rowsOut.join(' | '), shots };
});

// ---- H03: 새로고침·이어서 살기·몇 해 더 지나도 한 번 ----
await runCase({ id: 'M5-H03', cat: '상속', title: '상속 줄은 새로고침(연타)·나가기 후 이어서 살기·몇 해 더 산 뒤에도 한 번이다', steps: '재력 5 작별(share) 선택 후: 새로고침 12번, 나가기→이어서 살기, 10년 더 진행(선택은 첫 항목)', expected: '매번 상속 줄 1개, 순자산이 상속 때문에 한 번 더 늘지 않음' }, async () => {
  const bad = [];
  const r = await farewell(5, 'share');
  const { page, ctx } = r;
  const rowsList = [`선택 직후 ${count(r.rows)}`];
  let netAfter = r.postSave.assets.net;
  for (let i = 0; i < 12; i++) {
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="life-screen"]', { timeout: 10000 });
    await sleep(120);
  }
  let rows = await logRows(page);
  rowsList.push(`새로고침 12번 뒤 ${count(rows)}`);
  if (count(rows) !== 1) bad.push(`새로고침 뒤 상속 줄 ${count(rows)}개`);
  let save = await saveOf(page);
  if (save.assets.net !== netAfter) bad.push(`새로고침 뒤 순자산 ${save.assets.net} ≠ ${netAfter}`);
  // 일시정지 상태로 저장돼 있다. 나가기 → 첫 화면 → 이어서 살기
  await waitGuard(page, 'tool-exit').catch(() => {});
  await page.getByTestId('tool-exit').click();
  await page.getByTestId('exit-yes').click();
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 6000 });
  await waitGuard(page, 'resume').catch(() => {});
  const resume = page.locator('[data-testid="resume"], [data-testid="continue"], [data-testid="resume-life"]').first();
  if (await resume.count()) await resume.click();
  else await page.getByRole('button', { name: /이어서 살기/ }).first().click();
  await page.waitForSelector('[data-testid="life-screen"]', { timeout: 6000 });
  await sleep(300);
  rows = await logRows(page);
  rowsList.push(`이어서 살기 뒤 ${count(rows)}`);
  if (count(rows) !== 1) bad.push(`이어서 살기 뒤 상속 줄 ${count(rows)}개`);
  // 10년 진행
  const startAge = (await page.evaluate(() => window.__readDash())).age;
  if ((await page.getByTestId('pause').getAttribute('data-paused')) === 'true') await page.getByTestId('pause').click();
  await page.locator('[data-speed="8"]').click();
  const t0 = Date.now();
  for (;;) {
    const d = await page.evaluate(() => window.__readDash());
    if (d.screen === 'ending-screen' || d.age >= startAge + 10) break;
    if (d.choices.length) {
      await readyChoice(page).catch(() => {});
      await page.locator('[data-testid="choice-panel"] .choice').first().click().catch(() => {});
    }
    if (Date.now() - t0 > 60000) {
      bad.push('10년 진행 시간 초과');
      break;
    }
    await sleep(60);
  }
  rows = await logRows(page);
  const onEnding = await page.evaluate(() => !!document.querySelector('[data-testid="ending-screen"]'));
  let endLines = 0;
  if (onEnding) endLines = await page.evaluate((L) => [...document.querySelectorAll('[data-testid="timeline-entry"]')].filter((e) => e.textContent.includes(L)).length, LINE);
  const total = onEnding ? endLines : count(rows);
  rowsList.push(`10년 더 산 뒤 ${total}${onEnding ? '(엔딩 연표)' : ''}`);
  if (total !== 1) bad.push(`10년 뒤 상속 줄 ${total}개`);
  const s3 = await shot(page, 'H03', 'after-10years');
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : rowsList.join(' → '), shots: [s3] };
});

// ---- H04: 나이 상한 경로(부모 모두 100세 초과) ----
await runCase({ id: 'M5-H04', cat: '상속', title: '나이 상한 경로: 부모가 모두 100세를 넘기는 해 끝에 한 번(재력 5단계), 재력 1단계는 0번, 이미 넘긴 저장을 불러오면 0번', steps: '부모 출생 때 나이 56·56 + 자녀 44세 저장(해 끝에 부모 101세)을 열어 한 해 진행. 대조: 이미 부모 100세 초과인 저장(자녀 50세)', expected: '재력 5: 1줄, 재력 1: 0줄, 이미 떠난 저장: 0줄' }, async () => {
  const bad = [];
  const rowsOut = [];
  const base = Object.values(crafted).find((c) => c.meta.age >= 40 && c.meta.age <= 60);
  const mk = (tier, age, flagsFix) =>
    editSave(base.raw, (d) => {
      d.pending = null;
      d.age = age;
      d.paused = false;
      d.character.parentWealth = tier;
      d.birthReport.mother.age = 56;
      d.birthReport.father.age = 56;
      d.flags = d.flags.filter((f) => f !== 'parents_gone');
      d.seen = Object.fromEntries(Object.entries(d.seen).filter(([, a]) => a <= age));
      d.lastChoiceAge = null;
      d.history = d.history.filter((h) => h.age <= age);
      d.history = d.history.filter((h) => !h.text.includes(LINE));
      if (flagsFix) flagsFix(d);
    });
  const run = async (name, raw, wantLines, yearsToRun) => {
    const { ctx, page } = await openRaw(raw);
    await page.waitForSelector('[data-testid="life-screen"]', { timeout: 15000 });
    const startAge = (await page.evaluate(() => window.__readDash())).age;
    await page.locator('[data-speed="8"]').click();
    const t0 = Date.now();
    for (;;) {
      const d = await page.evaluate(() => window.__readDash());
      if (d.screen === 'ending-screen' || d.age >= startAge + yearsToRun) break;
      if (d.choices.length) {
        await readyChoice(page).catch(() => {});
        await page.locator('[data-testid="choice-panel"] .choice').first().click().catch(() => {});
      }
      if (Date.now() - t0 > 60000) break;
      await sleep(40);
    }
    const onEnding = await page.evaluate(() => !!document.querySelector('[data-testid="ending-screen"]'));
    const rows = onEnding
      ? await page.evaluate(() => [...document.querySelectorAll('[data-testid="timeline-entry"]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()))
      : await logRows(page);
    const n = count(rows);
    const at = rows.find((r) => r.includes(LINE));
    rowsOut.push(`${name}: ${n}줄${at ? ` 「${at.slice(0, 20)}…」` : ''} (${startAge}세에서 ${yearsToRun}년${onEnding ? ', 엔딩' : ''})`);
    if (n !== wantLines) bad.push(`${name}: ${n}줄 (기대 ${wantLines})`);
    const sh = await shot(page, 'H04', name);
    await ctx.close();
    return sh;
  };
  const shots = [];
  shots.push(await run('tier5-crossing', mk(5, 44), 1, 4));
  shots.push(await run('tier1-crossing', mk(1, 44), 0, 4));
  shots.push(await run('tier5-already-gone', mk(5, 50), 0, 4));
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : rowsOut.join(' | '), shots };
});

// ---- H05: 20세 전에 부모가 모두 떠난 저장(변조): 독립 때 한 번 ----
await runCase({ id: 'M5-H05', cat: '상속', title: '변조: 19세에 이미 사별(`parents_gone`)인 저장은 독립(20세) 때 순자산에 한 번, 20세 줄 한 번', steps: '19세·재력 5·`parents_gone` 켠 저장을 열어 20세까지 진행, 새로고침, 몇 해 더', expected: '20세 줄 1개(두 번 이상 0), 자산 카드가 20세에 나타남, 새로고침·진행 뒤에도 1개' }, async () => {
  const bad = [];
  const age19 = Object.values(crafted).find((c) => c.meta.event === 'school-exam');
  const raw = editSave(age19.raw, (d) => {
    d.pending = null;
    d.age = 19;
    d.character.parentWealth = 5;
    d.paused = false;
    d.flags = [...new Set([...d.flags, 'parents_gone'])].sort();
    d.seen = Object.fromEntries(Object.entries(d.seen).filter(([, a]) => a <= 19));
    d.history = d.history.filter((h) => h.age <= 19 && !h.text.includes(LINE));
    d.lastChoiceAge = null;
    d.familyFund = 0;
    delete d.seen['school-exam'];
  });
  const { ctx, page } = await openRaw(raw);
  await page.waitForSelector('[data-testid="life-screen"]', { timeout: 15000 });
  await page.locator('[data-speed="8"]').click();
  const t0 = Date.now();
  let at20 = null;
  for (;;) {
    const d = await page.evaluate(() => window.__readDash());
    if (d.age >= 20 && d.assets) {
      at20 = d;
      break;
    }
    if (d.choices.length) {
      await readyChoice(page).catch(() => {});
      await page.locator('[data-testid="choice-panel"] .choice').first().click().catch(() => {});
    }
    if (Date.now() - t0 > 40000) {
      bad.push('20세에 닿지 못함');
      break;
    }
    await sleep(40);
  }
  const rowsOut = [];
  if (at20) {
    await page.locator('[data-testid="pause"]').click().catch(() => {});
    await sleep(200);
    const save20 = await saveOf(page);
    let rows = await logRows(page);
    rowsOut.push(`20세 직후 줄 ${count(rows)}, 순자산 ${at20.assets.net}`);
    if (count(rows) !== 1) bad.push(`20세 직후 상속 줄 ${count(rows)}개`);
    const at = rows.find((r) => r.includes(LINE));
    if (at && !/^20세/.test(at)) bad.push(`상속 줄이 20세 줄이 아님: 「${at.slice(0, 20)}」`);
    if (save20.assets.net < 15000 / 3) bad.push(`순자산이 상속을 반영하지 않은 듯함 ${save20.assets.net}`);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="life-screen"]', { timeout: 10000 });
    rows = await logRows(page);
    rowsOut.push(`새로고침 뒤 줄 ${count(rows)}`);
    if (count(rows) !== 1) bad.push(`새로고침 뒤 상속 줄 ${count(rows)}개`);
  }
  const sh = await shot(page, 'H05', 'age20');
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : rowsOut.join(' | '), shots: [sh] };
});

await browser.close();
