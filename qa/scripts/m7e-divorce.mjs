// QA-003 M7e 이혼 경로 강제 확인(마스터 결정 E-6): 「서먹해진 식탁」 카드 저장에서 「따로 살기로 한다」를 눌러, 결과 문장·가족 카드(배우자 행)·자산 카드·플래그가 맞고 이후 생애가 끝까지 모순 없이 이어지는지 본다.
// 사용: node qa/scripts/m7e-divorce.mjs   결과: cases.jsonl (M7e-D01), 스크린샷 M7e-D01-*
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, READ_DASH_M7E, runCase, shot } from './m7e-lib.mjs';

const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const browser = await launch();
const gameOf = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k)).data, GAME_KEY);

await runCase({ id: 'M7e-D01', cat: '정상', title: '이혼 경로(E-6): 「서먹해진 식탁」 → 「따로 살기로 한다」 → 끝까지', steps: '카드 저장(지금 세상, 48세)에서 선택지 세 개를 읽고 「따로 살기로 한다」 → 결과 줄·가족 카드·자산 카드·플래그 → 8배속으로 끝까지(첫 선택지) → 엔딩', expected: '결과 문장 = 새 문안, 배우자 행 사라짐·divorced 플래그·married 없음, 이후 연표에 배우자·부부 언급 0, 엔딩 정상' }, async () => {
  const bad = [];
  const shots = [];
  const names = ['card-middle-marriage-crisis-present'];
  const raw = fs.readFileSync(path.join(OUT, 'saves', names[0] + '.json'), 'utf8');
  const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
  await seedStorage(ctx, { [GAME_KEY]: raw, [SETTINGS_KEY]: SPEED8 });
  await ctx.addInitScript(`window.__readDash = ${READ_DASH_M7E.toString()};`);
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 });
  await sleep(300);
  const before = await page.evaluate(() => window.__readDash());
  const g0 = await gameOf(page);
  if (!g0.flags.includes('married')) bad.push('시작 저장이 기혼이 아님');
  const spouseBefore = await page.locator('[data-testid="family-spouse"]').innerText().catch(() => null);
  const assetsBefore = await page.evaluate(() => document.querySelector('[data-testid="assets-card"]')?.textContent.replace(/\s+/g, ' ').trim());
  shots.push(await shot(page, 'D01', 'card'));
  const apart = before.choices.find((c) => c.id === 'apart');
  await page.locator('[data-testid="choice-apart"]').click();
  await sleep(700);
  const g1 = await gameOf(page);
  const row = g1.history.find((h) => h.eventId === 'middle-marriage-crisis');
  const wantResult = '오랜 고민 끝에 각자의 길을 가기로 했습니다. 재산을 나누느라 목돈이 나갔지만 따로 꾸리는 살림은 가벼워졌고, 오랜 긴장도 풀렸습니다.';
  if (!row || row.text !== wantResult) bad.push(`결과 문장 「${row?.text}」`);
  if (!g1.flags.includes('divorced')) bad.push('divorced 플래그 없음');
  if (g1.flags.includes('married')) bad.push('married 플래그가 남음');
  const d1 = await page.evaluate(() => window.__readDash());
  const spouseAfter = await page.locator('[data-testid="family-spouse"]').innerText().catch(() => null);
  if (spouseBefore !== '있음') bad.push(`이혼 전 배우자 행 「${spouseBefore}」`);
  if (spouseAfter !== '이혼') bad.push(`이혼 뒤 배우자 행 「${spouseAfter}」 (「이혼」이어야 함)`);
  await page.evaluate(() => document.querySelector('[data-testid="log-list"]').scrollTo({ top: 1e6, behavior: 'instant' }));
  shots.push(await shot(page, 'D01', 'after-apart'));
  // 끝까지
  const t0 = Date.now();
  while (Date.now() - t0 < 240000) {
    if (await page.locator('[data-testid="ending-screen"]').count()) break;
    await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="choice-panel"]');
      if (panel) {
        const b = [...panel.querySelectorAll('.choice')];
        if (b.length && b.every((x) => x.getAttribute('aria-disabled') !== 'true')) b[0].click();
      }
    });
    const pb = page.locator('[data-testid="pause"]');
    if ((await pb.count()) && (await pb.getAttribute('data-paused')) === 'true') await pb.click().catch(() => {});
    await sleep(200);
  }
  await page.waitForSelector('[data-testid="ending-screen"]', { timeout: 10000 }).catch(() => bad.push('엔딩에 닿지 못함'));
  const g2 = await gameOf(page);
  const after = g2.history.filter((h) => h.age > row.age && ['event', 'choice'].includes(h.kind));
  const hit = after.filter((h) => /부부|남편|아내|배우자|결혼|함께 살|식을 올/.test(h.text));
  if (hit.length) bad.push(`이혼 뒤 배우자 언급 ${hit.map((h) => h.eventId)}`);
  if (g2.flags.includes('married')) bad.push('끝에 married');
  const spouseEvents = after.filter((h) => ['senior-spouse-care', 'middle-both-working', 'youth-child', 'middle-marriage-crisis'].includes(h.eventId));
  if (spouseEvents.length) bad.push(`이혼 뒤 부부 이벤트 ${spouseEvents.map((h) => h.eventId)}`);
  const end = await page.evaluate(() => ({ journey: document.querySelector('[data-testid="ending-journey"]')?.textContent.trim(), movement: document.querySelector('[data-testid="ending-movement"]')?.textContent.trim(), death: document.querySelector('[data-testid="ending-death"]')?.textContent.trim() }));
  shots.push(await shot(page, 'D01', 'ending-top'));
  await page.evaluate(() => document.querySelector('[data-testid="ending-timeline"]').scrollIntoView({ block: 'start', behavior: 'instant' }));
  shots.push(await shot(page, 'D01', 'ending-timeline'));
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `이혼 경로 정상: 표기 「${(apart?.impact ?? []).join('·')}」, 결과 문장 = 새 문안, 가족 카드 배우자 「${spouseBefore}」 → 「${spouseAfter}」, divorced 켜짐·married 꺼짐, 이후 연표 ${after.length}줄에 배우자 언급 0, 사망 ${g2.age}세 「${end.movement}」`, shots };
});
await browser.close();
