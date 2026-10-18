// QA-003 M7a 케이스 4(동생): 첫째 판에서 「동생 맞이」 → 가족 카드 동생 표시 → 「동생의 장난감」 흐름을 실제 화면에서 확인한다.
// 사용: node qa/scripts/m7a-sibling.mjs     결과: cases.jsonl (M7a-S01·S02), 스크린샷 M7a-S01-*
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, READ_DASH_M7A, runCase, shot } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';

const craft = JSON.parse(fs.readFileSync(path.join(OUT, RP + 'craft-saves.json'), 'utf8'));
const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const browser = await launch();
const gameOf = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).data, GAME_KEY);
async function open(name) {
  const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
  await seedStorage(ctx, { [GAME_KEY]: craft[name].raw, [SETTINGS_KEY]: SPEED8 });
  const page = await ctx.newPage();
  await page.addInitScript(`window.__readDash = ${READ_DASH_M7A.toString()};`);
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 }).catch(() => {});
  await sleep(300);
  return { ctx, page };
}
const sibs = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid="family-sibling"]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
const toFamily = async (page) => {
  await page.evaluate(() => document.querySelector('[data-testid="family-card"]').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await sleep(250);
};

await runCase({ id: 'M7a-S01', cat: '동생', title: '첫째 판: 동생 맞이 카드(2~4세) → 가족 카드에 동생이 생김(나이·나이 차 정합) → 이어서 「동생의 장난감」 카드가 뜰 때 가족 카드에 동생이 있다', steps: '첫째(birthOrder 1)·어머니 30세 이하 저장에서 3세 동생 맞이 카드 → 가족 카드 확인 → 「동생을 예뻐하며 돌본다」 → 4세 가족 카드, 이어 동생 맞이 2세 뒤 4세 장난감 카드 저장을 열어 가족 카드 확인', expected: '카드가 뜬 때 이미 「동생 0세 · 3세 아래」(카드 본문과 정합), 한 해 뒤 「동생 1세 · 3세 아래」, 장난감 카드 때 동생 2세·2세 아래, 저장 플래그 younger_sibling·seen과 일치' }, async () => {
  const bad = [];
  const notes = [];
  const shots = [];
  {
    const { ctx, page } = await open('w-infant-new-sibling-present-t5');
    const g0 = await gameOf(page);
    const before = await sibs(page);
    await toFamily(page);
    shots.push(await shot(page, 'S01', 'family-at-new-sibling-card'));
    // 카드 본문이 「집에 동생이 생겼습니다」라서 카드가 뜬 때 이미 가족 카드에 갓난 동생(0세, 나이 차 = 지금 나이)이 있어야 정합이다
    {
      const mm = /동생 (\d+)세(\d+)세 아래/.exec(before.join(' '));
      if (!mm || Number(mm[1]) !== 0 || Number(mm[2]) !== g0.age) bad.push(`카드가 뜬 때 가족 카드 ${before.join(' / ')} (기대 동생 0세·${g0.age}세 아래)`);
    }
    notes.push(`카드가 뜬 때(나이 ${g0.age}, 첫째 ${g0.birthReport.birthOrder}): ${before.join(' / ')}`);
    await page.evaluate(() => document.querySelector('[data-testid="choice-panel"]').scrollIntoView({ block: 'center', behavior: 'instant' }));
    shots.push(await shot(page, 'S01', 'card-new-sibling'));
    await page.locator('[data-testid="choice-help"]').click();
    const t0 = Date.now();
    let g1;
    while (Date.now() - t0 < 9000) {
      g1 = await gameOf(page);
      if (g1.pending === null && g1.age === g0.age + 1) break;
      await sleep(80);
    }
    await sleep(300);
    const after = await sibs(page);
    await toFamily(page);
    shots.push(await shot(page, 'S01', 'family-after-new-sibling'));
    if (!g1.flags.includes('younger_sibling')) bad.push('younger_sibling 플래그가 없음');
    if (!g1.flags.includes('sibling_close')) bad.push('sibling_close 플래그가 없음(help 선택)');
    if (g1.seen['infant-new-sibling'] !== g0.age) bad.push(`seen 나이 ${g1.seen['infant-new-sibling']}`);
    const m = /동생 (\d+)세(\d+)세 아래/.exec(after.join(' '));
    if (!m || Number(m[1]) !== 1 || Number(m[2]) !== 3) bad.push(`맞이 뒤 가족 카드 ${after.join(' / ')} (기대 동생 1세·3세 아래)`);
    notes.push(`맞이 뒤(나이 ${g1.age}): ${after.join(' / ')}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open('w-infant-sibling-toy-present-t5');
    const g = await gameOf(page);
    const at = await sibs(page);
    await toFamily(page);
    shots.push(await shot(page, 'S01', 'family-at-toy-card'));
    const m = /동생 (\d+)세(\d+)세 아래/.exec(at.join(' '));
    if (!m || Number(m[1]) !== g.age - 2 || Number(m[2]) !== 2) bad.push(`장난감 카드 때 가족 카드 ${at.join(' / ')} (기대 동생 ${g.age - 2}세·2세 아래)`);
    notes.push(`장난감 카드(나이 ${g.age}): ${at.join(' / ')}`);
    await page.evaluate(() => document.querySelector('[data-testid="choice-panel"]').scrollIntoView({ block: 'center', behavior: 'instant' }));
    shots.push(await shot(page, 'S01', 'card-sibling-toy'));
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots };
});

await runCase({ id: 'M7a-S02', cat: '동생', title: '둘째 이상 판: 동생 맞이 카드 0 · 동생 장난감 0 · 가족 카드에 동생 없음', steps: '둘째(birthOrder 2)·셋째 저장을 1~8세 화면에서 8번 돌려 동생 맞이가 한 번도 안 나오는지 본다(수확 표본 323판은 별도)', expected: '동생 맞이·동생 장난감 0, 가족 카드 동생 줄 0' }, async () => {
  const bad = [];
  const notes = [];
  let runs = 0;
  for (const order of [2, 3]) {
    for (const k of [1, 2, 3, 4]) {
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      const base = JSON.parse(craft['w-infant-first-birthday-present-t5'].raw);
      base.data.age = 1;
      base.data.birthReport.birthOrder = order;
      base.data.rngState = Math.imul(k + order * 100, 2654435761) >>> 0;
      await seedStorage(ctx, { [GAME_KEY]: JSON.stringify(base), [SETTINGS_KEY]: SPEED8 });
      const page = await ctx.newPage();
      await page.addInitScript(`window.__readDash = ${READ_DASH_M7A.toString()};`);
      await page.goto(PROD, { waitUntil: 'load' });
      await page.waitForSelector('[data-testid="life-screen"]');
      const t0 = Date.now();
      for (;;) {
        const d = await page.evaluate(() => window.__readDash());
        if (d.screen !== 'life-screen' || d.age >= 8 || Date.now() - t0 > 40000) break;
        if (d.choices.length && d.choices.every((c) => c.aria !== 'true')) await page.locator(`[data-testid="choice-${d.choices[0].id}"]`).click({ timeout: 2000 }).catch(() => {});
        await sleep(50);
      }
      const g = await gameOf(page);
      runs++;
      const sib = await sibs(page);
      if (g.seen['infant-new-sibling'] !== undefined || g.seen['infant-sibling-toy'] !== undefined) bad.push(`order ${order}/난수 ${k}: 동생 맞이 ${g.seen['infant-new-sibling']} 장난감 ${g.seen['infant-sibling-toy']}`);
      if (sib.some((t) => /동생/.test(t))) bad.push(`order ${order}/난수 ${k}: 가족 카드에 동생 ${sib}`);
      if (k === 1 && order === 2) notes.push(`예(둘째): ${sib.join(' / ')} · ${g.age}세까지 영유아 이벤트 ${Object.keys(g.seen).filter((x) => x.startsWith('infant')).length}종`);
      await ctx.close();
    }
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `둘째·셋째 ${runs}판을 1~8세까지 돌려 동생 맞이·장난감 0, 가족 카드 동생 줄 0. ${notes.join(' ')}`, shots: [] };
});
await browser.close();
