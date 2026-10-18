// QA-003 M7e 모순 증거: (a) 월세로 사는 20대 판의 「부모님 집에 머문다」 → 「집을 나서지 않기로 했습니다」 (b) 부모님과 한집에 사는 미혼 40대 판의 「혼자 맞는 명절」
// 사용: node qa/scripts/m7e-evidence.mjs   결과: cases.jsonl (M7e-T03a·T03b), 스크린샷 M7e-T03*-*
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, READ_DASH_M7E, runCase, shot } from './m7e-lib.mjs';

const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const browser = await launch();
const gameOf = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k)).data, GAME_KEY);
const open = async (name) => {
  const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
  await seedStorage(ctx, { [GAME_KEY]: fs.readFileSync(path.join(OUT, 'saves', name + '.json'), 'utf8'), [SETTINGS_KEY]: SPEED8 });
  await ctx.addInitScript(`window.__readDash = ${READ_DASH_M7E.toString()};`);
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  return { ctx, page };
};
const homeText = (p) => p.evaluate(() => document.querySelector('[data-testid="profile-home"]')?.textContent.replace(/\s+/g, ' ').trim() ?? null);
const famText = (p) => p.evaluate(() => document.querySelector('[data-testid="family-card"]')?.innerText.replace(/\n+/g, ' | ') ?? null);

await runCase({ id: 'M7e-T03a', cat: '문장 품질', title: '모순: 이미 월세로 독립한 판에서 「부모님 집에 머문다」 → 결과 「집을 나서지 않기로 했습니다」', steps: '지금 세상 재력 1단계(20세부터 월세) 24세 「살 곳을 구하는 일」 카드 → 「부모님 집에 머문다」 → 결과 줄·프로필 주거·가족 카드', expected: '선택지·결과 문장이 현재 주거(월세)와 맞는다(「돌아간다」류)' }, async () => {
  const { ctx, page } = await open('card-youth-housing-present-t1');
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 });
  await sleep(300);
  const before = await page.evaluate(() => window.__readDash());
  const homeBefore = await homeText(page);
  const g0 = await gameOf(page);
  const shots = [await shot(page, 'T03a', 'card')];
  const lab = before.choices.find((c) => c.id === 'parents')?.label;
  await page.locator('[data-testid="choice-parents"]').click();
  await sleep(700);
  const g1 = await gameOf(page);
  const row = g1.history.find((h) => h.eventId === 'youth-housing');
  const homeAfter = await homeText(page);
  await page.evaluate(() => document.querySelector('[data-testid="log-list"]').scrollTo({ top: 1e6, behavior: 'instant' }));
  shots.push(await shot(page, 'T03a', 'after'));
  await ctx.close();
  const mismatch = g0.assets.dwelling !== 'family' && /집을 나서지 않기로/.test(row?.text ?? '');
  return { verdict: mismatch ? 'FAIL' : 'PASS', actual: `선택 전 주거 「${homeBefore}」(저장 ${g0.assets.dwelling}), 선택지 「${lab}」, 결과 줄 「${row?.text}」, 선택 뒤 주거 「${homeAfter}」(저장 ${g1.assets.dwelling}). 이미 독립했는데 「집을 나서지 않기로」·「머문다」라고 말한다`, shots };
});

await runCase({ id: 'M7e-T03b', cat: '문장 품질', title: '모순: 부모님과 한집(가족 집)에 사는 미혼 40대 판에서 「혼자 맞는 명절」 (모두가 가족을 찾아 떠난 거리에서 혼자 명절을 보냈습니다)', steps: '지금 세상 재력 3단계 45세, 미혼·무자녀·가족 집·부모님 건강 → 「혼자 맞는 명절」이 나올 때까지 진행 → 인생 기록·가족 카드·프로필 주거', expected: '한집에 사는 부모님이 있는 판에서는 「혼자 명절」이 나오지 않거나 문장이 맞는다' }, async () => {
  const { ctx, page } = await open('narr-lonely-holiday-family');
  await page.waitForSelector('[data-testid="life-screen"]', { timeout: 30000 });
  const pb = page.locator('[data-testid="pause"]');
  if ((await pb.count()) && (await pb.getAttribute('data-paused')) === 'true') await pb.click().catch(() => {});
  const t0 = Date.now();
  let g;
  for (;;) {
    g = await gameOf(page);
    if (g.history.some((h) => h.eventId === 'middle-lonely-holiday')) break;
    if (Date.now() - t0 > 30000) break;
    await sleep(250);
  }
  await sleep(500);
  const row = g.history.find((h) => h.eventId === 'middle-lonely-holiday');
  const homeNow = await homeText(page);
  const fam = await famText(page);
  await page.evaluate(() => document.querySelector('[data-testid="log-list"]').scrollTo({ top: 1e6, behavior: 'instant' }));
  const shots = [await shot(page, 'T03b', 'log-row')];
  await page.evaluate(() => document.querySelector('[data-testid="family-card"]').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await sleep(200);
  shots.push(await shot(page, 'T03b', 'family-card'));
  await ctx.close();
  const mismatch = !!row && g.flags.includes('lives_with_parents') && !g.flags.includes('parents_gone');
  return { verdict: !row ? 'ERROR' : mismatch ? 'FAIL' : 'PASS', actual: row ? `${row.age}세 「${row.text}」 — 같은 화면의 프로필 주거 「${homeNow}」, 가족 카드 「${(fam ?? '').slice(0, 80)}」, 플래그 ${g.flags.join(',')}` : '이벤트가 안 나옴', shots };
});
await browser.close();
