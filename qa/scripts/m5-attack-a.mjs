// QA-003 M5 공격 A: 선택지 빠른 연속 클릭·더블 탭, 결정 중 새로고침 연타·뒤로가기, 저장 중 탭 닫기.
// 사용: node qa/scripts/m5-attack-a.mjs
import fs from 'node:fs';
import { launch, mkctx, seedStorage, PROD, DEV, GAME_KEY, SETTINGS_KEY, sleep, shot, runCase, READ_DASH_M5, editSave, TOUCH, con } from './m5-lib.mjs';
import { loadSave } from './m5-states.mjs';

const ONLY = process.env.ONLY || '';
const run = (c, fn) => (!ONLY || c.id.endsWith(ONLY) ? runCase(c, fn) : null);
const browser = await launch();
const RAW_ADULT = loadSave('present', 'adult-choice');
const RAW_YOUNG = loadSave('present', 'young-choice');

async function open(raw, { base = PROD, vp = { width: 1280, height: 800 }, touch = false, settings = null } = {}) {
  const ctx = await mkctx(browser, { viewport: vp, ...(touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) });
  await seedStorage(ctx, { [GAME_KEY]: raw, [SETTINGS_KEY]: settings });
  const page = await ctx.newPage();
  await page.addInitScript(`window.__readDash = ${READ_DASH_M5.toString()};`);
  await page.goto(base, { waitUntil: 'load' });
  return { ctx, page };
}
const rawOf = (page) => page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
const guardOpen = (page) => page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].length && [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 });
const dataOf = (raw) => JSON.parse(raw).data;
const choiceCount = (d) => d.history.filter((h) => h.kind === 'choice').length;

// 기준: 같은 저장에서 한 번만 눌렀을 때의 결과(결정론이므로 연타해도 같아야 한다)
async function single(raw, cid, opts = {}) {
  const { ctx, page } = await open(raw, opts);
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 15000 });
  await guardOpen(page);
  const before = await rawOf(page);
  await page.locator(`[data-testid="choice-${cid}"]`).click();
  await page.waitForFunction(([k, b]) => localStorage.getItem(k) !== b, [GAME_KEY, before], { timeout: 5000 });
  await sleep(300);
  const after = await rawOf(page);
  await ctx.close();
  return { before, after };
}

const results = {};
for (const [name, raw] of [['adult', RAW_ADULT], ['young', RAW_YOUNG]]) {
  const first = dataOf(raw).pending.choiceIds[0];
  results[name] = { raw, first, base: await single(raw, first) };
}

// ---- A01 ----
await run({ id: 'M5-A01', cat: '공격', title: '영향 줄이 붙은 선택지 빠른 연속 클릭(마우스 12번·키보드 Enter 6번)·가드 안 클릭·서로 다른 선택지 연달아 클릭', steps: '저장된 선택지 카드(성인 5항목/20세 미만 집안 살림)에서 (1) 진입 직후 클릭 (2) 가드가 풀린 뒤 같은 버튼을 마우스로 12번 연타 (3) 포커스 후 Enter 6번 (4) 선택지 1을 누르고 곧바로 선택지 2를 누름', expected: '선택은 한 번만 적용되어 저장이 「한 번 누른 결과」와 완전히 같다(기록·순자산·나이·부채). 가드 안 클릭은 무시' }, async () => {
  const bad = [];
  const notes = [];
  const shots = [];
  for (const name of ['adult', 'young']) {
    const { raw, first, base } = results[name];
    const d0 = dataOf(raw);
    // (1) 가드 안 클릭: 페이지가 뜨자마자 눌러 본다
    {
      const { ctx, page } = await open(raw);
      await page.waitForSelector('[data-testid="choice-panel"]');
      const box = await page.locator(`[data-testid="choice-${first}"]`).boundingBox();
      for (let i = 0; i < 4; i++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(150);
      const r = await rawOf(page);
      // 가드(0.4초) 안에서 눌렀다면 저장이 그대로여야 한다. 측정 시점이 가드 뒤였다면(느린 기계) 무효 처리
      const waited = await page.evaluate(() => performance.now());
      if (waited < 380 && r !== raw) bad.push(`${name}: 가드 안 클릭이 적용됨`);
      notes.push(`${name} 가드 안 클릭: 저장 ${r === raw ? '불변' : '변함'}(경과 ${Math.round(waited)}ms)`);
      await ctx.close();
    }
    // (2) 마우스 연타 12번
    {
      const { ctx, page } = await open(raw);
      await page.waitForSelector('[data-testid="choice-panel"]');
      await guardOpen(page);
      const box = await page.locator(`[data-testid="choice-${first}"]`).boundingBox();
      for (let i = 0; i < 12; i++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { delay: 0 });
      await sleep(500);
      const r = await rawOf(page);
      if (r !== base.after) bad.push(`${name}: 마우스 연타 결과가 한 번 누른 결과와 다름 (선택 기록 ${choiceCount(dataOf(r))} vs ${choiceCount(dataOf(base.after))}, 나이 ${dataOf(r).age} vs ${dataOf(base.after).age})`);
      notes.push(`${name} 연타 12번: 나이 ${d0.age}→${dataOf(r).age}, 선택 기록 ${choiceCount(d0)}→${choiceCount(dataOf(r))}`);
      shots.push(await shot(page, 'A01', `${name}-mouse-12`));
      await ctx.close();
    }
    // (3) 키보드 Enter 6번
    {
      const { ctx, page } = await open(raw);
      await page.waitForSelector('[data-testid="choice-panel"]');
      await guardOpen(page);
      await page.locator(`[data-testid="choice-${first}"]`).focus();
      for (let i = 0; i < 6; i++) await page.keyboard.press('Enter');
      await sleep(500);
      const r = await rawOf(page);
      if (r !== base.after) bad.push(`${name}: Enter 연타 결과가 다름 (선택 ${choiceCount(dataOf(r))} vs ${choiceCount(dataOf(base.after))})`);
      notes.push(`${name} Enter 6번: 선택 기록 ${choiceCount(dataOf(r))}`);
      await ctx.close();
    }
    // (4) 선택지 1 → 곧바로 선택지 2
    {
      const { ctx, page } = await open(raw);
      await page.waitForSelector('[data-testid="choice-panel"]');
      await guardOpen(page);
      const ids = d0.pending.choiceIds;
      const b1 = await page.locator(`[data-testid="choice-${ids[0]}"]`).boundingBox();
      const b2 = await page.locator(`[data-testid="choice-${ids[1]}"]`).boundingBox();
      await page.mouse.click(b1.x + b1.width / 2, b1.y + b1.height / 2);
      await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);
      await sleep(500);
      const r = await rawOf(page);
      if (r !== base.after) bad.push(`${name}: 서로 다른 선택지를 연달아 누르자 첫 선택만 적용되지 않음`);
      notes.push(`${name} 1번→2번: 선택 기록 ${choiceCount(dataOf(r))}, 마지막 기록 「${dataOf(r).history.filter((h) => h.kind === 'choice').slice(-1)[0]?.choice}」`);
      await ctx.close();
    }
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots };
});

// ---- A02: 더블 탭(터치) ----
await run({ id: 'M5-A02', cat: '공격', title: '터치 더블 탭: 선택지 카드를 두 번 탭해도, 서로 다른 선택지를 번갈아 탭해도 한 번만 적용', steps: '360×740 터치에서 첫 선택지를 80ms 간격으로 2번 탭, 3번 탭, 선택지 1·2 번갈아 탭', expected: '저장이 한 번 누른 결과와 같다' }, async () => {
  const bad = [];
  const notes = [];
  for (const gap of [0, 80, 200]) {
    const { raw, first, base } = results.adult;
    const { ctx, page } = await open(raw, { vp: { width: 360, height: 740 }, touch: true });
    await page.waitForSelector('[data-testid="choice-panel"]');
    await guardOpen(page);
    const loc = page.locator(`[data-testid="choice-${first}"]`);
    await loc.scrollIntoViewIfNeeded();
    const box = await loc.boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.touchscreen.tap(x, y);
    if (gap) await sleep(gap);
    await page.touchscreen.tap(x, y);
    if (gap) await sleep(gap);
    await page.touchscreen.tap(x, y);
    await sleep(600);
    const r = await rawOf(page);
    if (r !== base.after) bad.push(`간격 ${gap}ms: 결과가 한 번 누른 결과와 다름 (선택 기록 ${choiceCount(dataOf(r))})`);
    notes.push(`간격 ${gap}ms: 선택 기록 ${choiceCount(dataOf(r))}`);
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots: [] };
});

// ---- A03: 새로고침 연타·뒤로가기 ----
await run({ id: 'M5-A03', cat: '공격', title: '결정을 기다리는 중 새로고침 15번 연타·뒤로/앞으로: 같은 카드·같은 영향 줄·저장 불변', steps: '성인 선택지 카드에서 새로고침 15번(간격 0~150ms), page.goBack/goForward, 다시 새로고침', expected: '카드의 제목·선택지·영향 줄이 늘 같고 저장 원문이 그대로(선택이 새어 적용되지 않음)' }, async () => {
  const bad = [];
  const { ctx, page } = await open(RAW_ADULT);
  await page.waitForSelector('[data-testid="choice-panel"]');
  await guardOpen(page);
  const ref = await page.evaluate(() => window.__readDash());
  const refLines = JSON.stringify(ref.choices.map((c) => [c.id, c.impact.map((i) => i.shown)]));
  const raw0 = await rawOf(page);
  for (let i = 0; i < 15; i++) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep([0, 30, 80, 150][i % 4]);
  }
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 15000 });
  await guardOpen(page);
  let cur = await page.evaluate(() => window.__readDash());
  if (JSON.stringify(cur.choices.map((c) => [c.id, c.impact.map((i) => i.shown)])) !== refLines) bad.push('새로고침 연타 뒤 영향 줄이 달라짐');
  if (cur.choiceKey !== ref.choiceKey) bad.push('카드 키가 바뀜');
  let raw1 = await rawOf(page);
  if (raw1 !== raw0) bad.push('새로고침 연타 뒤 저장 원문이 변함');
  // 뒤로/앞으로
  const nav = [];
  const back = await page.goBack({ waitUntil: 'load' }).catch((e) => null);
  nav.push(`뒤로: ${page.url().slice(0, 40)}`);
  const fwd = await page.goForward({ waitUntil: 'load' }).catch((e) => null);
  nav.push(`앞으로: ${page.url().slice(0, 40)}`);
  await page.waitForSelector('[data-testid="life-screen"]', { timeout: 15000 }).catch(() => bad.push('앞으로 가기 뒤 인생 화면이 아님'));
  const cur2 = await page.evaluate(() => window.__readDash());
  if (cur2.choiceKey !== ref.choiceKey) bad.push(`뒤로/앞으로 뒤 카드 키 ${cur2.choiceKey} ≠ ${ref.choiceKey}`);
  const raw2 = await rawOf(page);
  if (raw2 !== raw0) bad.push('뒤로/앞으로 뒤 저장 원문이 변함');
  const sh = await shot(page, 'A03', 'after-reload15-back');
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `새로고침 15번 뒤 카드 ${ref.choiceKey} 영향 줄 불변, 저장 원문 동일 · ${nav.join(' → ')} 뒤에도 같은 카드·같은 저장`, shots: [sh] };
});

// ---- A04: 선택 직후 탭 닫기 ----
await run({ id: 'M5-A04', cat: '공격', title: '저장 중 탭 닫기: 선택 클릭 직후 0~200ms에 탭을 닫고 다시 열기(36번)', steps: '개발 서버에서 선택지를 누르고 d ms 뒤 탭을 닫은 다음 같은 저장소로 새 탭을 연다 (성인/20세 미만 × d 6단계 × 3번)', expected: '늘 유효한 저장 — 선택 전(카드 그대로) 또는 선택 후(다음 해)이며, 반쯤 적용된 상태·새 게임·오류 화면이 0' }, async () => {
  const bad = [];
  const outcomes = { before: 0, after: 0 };
  for (const name of ['adult', 'young']) {
    const { raw } = results[name];
    const d0 = dataOf(raw);
    for (const delay of [0, 5, 15, 40, 90, 200]) {
      for (let rep = 0; rep < 3; rep++) {
        const ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
        let page = await ctx.newPage();
        await page.goto(DEV, { waitUntil: 'load' });
        await page.evaluate(([k, v]) => localStorage.setItem(k, v), [GAME_KEY, raw]);
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('[data-testid="choice-panel"]');
        await guardOpen(page);
        await page.locator(`[data-testid="choice-${d0.pending.choiceIds[rep % d0.pending.choiceIds.length]}"]`).click({ noWaitAfter: true });
        if (delay) await sleep(delay);
        await page.close({ runBeforeUnload: false });
        page = await ctx.newPage();
        await page.addInitScript(`window.__readDash = ${READ_DASH_M5.toString()};`);
        await page.goto(DEV, { waitUntil: 'load' });
        await sleep(300);
        const screen = await page.evaluate(() => window.__readDash().screen);
        const r = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
        let d;
        try {
          d = JSON.parse(r).data;
        } catch {
          d = null;
        }
        if (screen !== 'life-screen' && screen !== 'ending-screen') bad.push(`${name} d=${delay}: 다시 열었더니 ${screen}`);
        else if (!d) bad.push(`${name} d=${delay}: 저장 파싱 실패`);
        else if (d.pending && d.pending.key === d0.pending.key) outcomes.before++;
        else if (d.age === d0.age + 1 || d.phase === 'ending') outcomes.after++;
        else bad.push(`${name} d=${delay}: 뜻밖의 저장 age ${d.age} pending ${d.pending?.key}`);
        await ctx.close();
      }
    }
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') : `36번 모두 유효: 선택 전 ${outcomes.before} · 선택 후 ${outcomes.after}`, shots: [] };
});

await browser.close();
