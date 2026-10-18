// QA-003 M7e 2회차 추가 공격: 「살 곳을 구하는 일」 카드 변조 — 보이는 선택지가 주거와 어긋나게 고친 저장을 열고 눌러도 멈춤·빈 화면·NaN이 없는가.
//  v1 월세 판 카드에 parents(가족 집 전용) 끼워 넣기  v2 가족 집 판 카드에 return 끼워 넣기  v3 lives_alone 판 카드에 return 끼워 넣기  v4 주거 변조(care·own)로 카드 열기
// 사용: QA_OUT=qa/results/m7e/r2 QA_SHOT_PREFIX=M7e-r2 node qa/scripts/m7e-r2-attack.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, READ_DASH_M7E, editSave, runCase, shot } from './m7e-lib.mjs';

const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const load = (n) => fs.readFileSync(path.join(OUT, 'saves', n + '.json'), 'utf8');
// 카드 저장은 「다음 해에 카드가 뜨는」 상태라 pending이 비어 있다 — 한 번 열어 카드가 뜬 뒤의 저장(pending 있음)을 읽어 둔다
async function pendingSave(base) {
  const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
  await seedStorage(ctx, { [GAME_KEY]: load(base), [SETTINGS_KEY]: SPEED8 });
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
  await sleep(500);
  const raw = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
  await ctx.close();
  return raw;
}
const browser = await launch();
await runCase({ id: 'M7e-A08', cat: '공격', title: '「살 곳을 구하는 일」 카드 변조: 주거와 어긋나는 선택지(월세 판에 parents, 가족 집 판에 return, lives_alone 판에 return)를 끼워 넣거나 주거를 care·own으로 바꾼 저장을 열고 눌러도 멈춤·빈 화면·NaN·경고창 0', steps: '카드 저장 3종의 대기 카드 선택지 id를 고치고 열어 보이는 선택지를 읽은 뒤 어긋난 선택지를 눌러 다음 해까지 진행한다', expected: '화면이 멈추지 않고 연표 줄이 하나 쌓이며 나이가 흐른다(어긋난 상태는 새 게임으로 날아가거나 그대로 이어져도 되지만 깨지면 안 됨)' }, async () => {
  const bad = [];
  const note = [];
  const shots = [];
  const cases = [
    ['v1-월세에-parents', 'card-youth-housing-rent', (d) => { d.pending.choiceIds = ['rent', 'parents', 'loan']; }, 'parents'],
    ['v2-가족집에-return', 'card-youth-housing-family', (d) => { d.pending.choiceIds = ['rent', 'return', 'loan']; }, 'return'],
    ['v3-혼자살이에-return', 'card-youth-housing-alone', (d) => { d.pending.choiceIds = ['rent', 'return', 'loan']; }, 'return'],
    ['v4-주거-care', 'card-youth-housing-rent', (d) => { d.assets.dwelling = 'care'; }, 'return'],
    ['v5-주거-own', 'card-youth-housing-rent', (d) => { d.assets.dwelling = 'own'; }, 'return'],
  ];
  for (const [tag, base, fn, pick] of cases) {
    const raw = editSave(await pendingSave(base), (d) => fn(d));
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    await seedStorage(ctx, { [GAME_KEY]: raw, [SETTINGS_KEY]: SPEED8 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
    page.on('dialog', (d) => { errs.push('경고창 ' + d.type()); d.dismiss().catch(() => {}); });
    await page.addInitScript(`window.__readDash = ${READ_DASH_M7E.toString()};`);
    await page.goto(PROD, { waitUntil: 'load' });
    await sleep(1200);
    const screen = await page.evaluate(() => (document.querySelector('[data-testid="choice-panel"]') ? 'card' : document.querySelector('[data-testid="title-screen"]') ? 'title' : document.querySelector('[data-testid="life-screen"]') ? 'life' : 'other'));
    if (screen === 'card') {
      const ids = await page.evaluate(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].map((b) => b.getAttribute('data-testid').replace('choice-', '')));
      const age0 = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).data.age, GAME_KEY);
      const target = ids.includes(pick) ? pick : ids[0];
      await page.locator(`[data-testid="choice-${target}"]`).click();
      await sleep(900);
      const after = await page.evaluate((k) => {
        const d = JSON.parse(localStorage.getItem(k)).data;
        return { age: d.age, dw: d.assets.dwelling, net: d.assets.net, debt: d.assets.debt, fl: d.flags.filter((f) => ['lives_with_parents', 'lives_alone', 'renting', 'own_home'].includes(f)), hist: d.history.length, nan: JSON.stringify(d).includes('null,') && /NaN/.test(JSON.stringify(d)) };
      }, GAME_KEY);
      const txt = await page.evaluate(() => document.body.innerText);
      if (/NaN|undefined|\[object/.test(txt)) bad.push(`${tag}: 화면에 NaN/undefined`);
      if (!Number.isFinite(after.net) || !Number.isFinite(after.debt)) bad.push(`${tag}: 자산 비유한`);
      note.push(`${tag}: 카드 ${ids.join(',')} → ${target} 선택 → 주거 ${after.dw}·플래그 ${after.fl.join(',')}`);
    } else {
      note.push(`${tag}: 화면 ${screen}(카드 대신 ${screen === 'title' ? '새 게임으로 정리됨' : screen})`);
    }
    if (errs.length) bad.push(`${tag}: ${errs.join(',')}`);
    if (tag === 'v1-월세에-parents' || tag === 'v3-혼자살이에-return') shots.push(await shot(page, 'A08', tag));
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `변조 5종 모두 멈춤·경고창·NaN 0. ${note.join(' | ')}`, shots };
});
await browser.close();
