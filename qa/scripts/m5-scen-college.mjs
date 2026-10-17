// QA-003 M5: 19세 「입시를 앞둔 해」 선택이 20세 전환(독립)에서 학자금 대출(시작 부채)로 이어지는데 영향 줄에는 안 나오는가.
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, DEV, OUT, GAME_KEY, sleep, shot, addCase, READ_DASH_M5, editSave, parseMan } from './m5-lib.mjs';
const crafted = JSON.parse(fs.readFileSync(path.join(OUT, 'craft-saves.json'), 'utf8'));
const browser = await launch();
const rows = [];
const shots = [];
for (const tier of [1, 3, 5]) {
  const base = crafted[`exam19-tier${tier}`];
  const ids = JSON.parse(base.raw).data.pending ? null : null;
  for (const cid of ['apply', 'retry', 'work']) {
    const ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
    await seedStorage(ctx, { [GAME_KEY]: editSave(base.raw, (d) => (d.paused = false)) });
    const page = await ctx.newPage();
    await page.addInitScript(`window.__readDash = ${READ_DASH_M5.toString()};`);
    await page.goto(`${DEV}?__timescale=60`, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 20000 });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'));
    await page.locator('[data-testid="pause"]').click();
    const d = await page.evaluate(() => window.__readDash());
    const c = d.choices.find((x) => x.id === cid);
    if (!c) {
      await ctx.close();
      continue;
    }
    await page.locator(`[data-testid="choice-${cid}"]`).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="assets"]') !== null, null, { timeout: 8000 });
    const after = await page.evaluate(() => window.__readDash());
    const save = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
    rows.push({ tier, choice: cid, shown: c.impact.map((i) => i.shown).join(' · ') || '(영향 줄 없음)', age: save.age, net: after.assets.net, debt: after.assets.debt, income: after.assets.income, flags: save.flags.filter((f) => ['college', 'early_work'].includes(f)).join(',') });
    if (tier === 1 && cid === 'apply') shots.push(await shot(page, 'O01', 'college-loan-age20-tier1-apply'));
    if (tier === 1 && cid === 'work') shots.push(await shot(page, 'O01', 'college-loan-age20-tier1-work'));
    await ctx.close();
  }
}
// 같은 선택을 16세에 했을 때의 영향 줄(독립까지 4년 남음)
const early = [];
for (const tier of [1, 3]) {
  const base = crafted[`exam-tier${tier}`];
  const ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
  await seedStorage(ctx, { [GAME_KEY]: base.raw });
  const page = await ctx.newPage();
  await page.addInitScript(`window.__readDash = ${READ_DASH_M5.toString()};`);
  await page.goto(`${DEV}?__timescale=60`, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 20000 });
  const d = await page.evaluate(() => window.__readDash());
  early.push({ tier, age: JSON.parse(base.raw).data.age, lines: d.choices.map((c) => c.id + ':' + (c.impact.map((i) => i.shown).join('/') || '-')).join(' ; ') });
  if (tier === 1) shots.push(await shot(page, 'O01', 'exam-age16-tier1-lines'));
  await ctx.close();
}
await browser.close();
for (const e of early) console.log(JSON.stringify(e));
for (const r of rows) console.log(JSON.stringify(r));
// 판정: 선택 카드의 부채 표기(「부채 ▲▲」) ⇔ 20세 시작 부채(만 원). 학자금 대출 설계값은 economy-model.md 3-3절 표(재력 1 2,300 · 3 600 · 4~5 0)다.
const LOAN = { 1: 2300, 3: 600, 5: 0 };
const man = (t) => parseMan(t);
const bad = [];
for (const r of rows) {
  const college = r.flags === 'college';
  const wantDebt = college ? LOAN[r.tier] : 0;
  const showsDebt = /부채▲/.test(r.shown);
  const steps = (r.shown.match(/부채(▲+)/) || [])[1]?.length ?? 0;
  const wantSteps = wantDebt === 0 ? 0 : wantDebt < 500 ? 1 : wantDebt < 3000 ? 2 : 3;
  if (man(r.debt) < wantDebt) bad.push(`재력 ${r.tier} ${r.choice}: 20세 부채 ${r.debt} < 기대 ${wantDebt}`);
  if (steps !== wantSteps) bad.push(`재력 ${r.tier} ${r.choice}: 부채 표기 ${steps}칸 기대 ${wantSteps}칸 (실제 부채 ${r.debt})`);
  if (/집안 살림|자산/.test(r.shown) && /자산/.test(r.shown)) bad.push(`재력 ${r.tier} ${r.choice}: 20세 미만 카드에 자산 항목`);
}
for (const e of early) {
  const wantShow = e.tier <= 3;
  if (/apply:[^;]*부채▲/.test(e.lines) !== wantShow) bad.push(`16세 재력 ${e.tier}: apply 부채 표기가 기대(${wantShow})와 다름`);
}
addCase({ id: 'M5-E05', cat: '표기=실제', title: '입시 선택(school-exam/apply·retry = college)의 학자금 대출: 20세 미만 카드(16세·19세)에 「부채 ▲▲」로 표기되고 20세 전환 때 실제 시작 부채와 같다(재력 4~5단계는 표기·부채 모두 없음)', steps: '재력 1·3·5단계의 16세·19세 입시 카드에서 영향 줄을 읽고, 19세에 세 선택지를 각각 눌러 20세 자산 카드의 부채를 읽는다', expected: '재력 1·3의 대학 진학(apply·retry): 「부채 ▲▲」 표기 ⇔ 20세 부채 2,300·600만 원 이상, 일부터 시작(work): 부채 표기·부채 모두 0, 재력 5: 둘 다 0', verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `16세 카드(${early.map((e) => '재력 ' + e.tier + ' ' + e.lines).join(' / ')}) ‖ 19세 카드→20세: ` + rows.map((r) => `재력 ${r.tier} ${r.choice}[${r.shown}] → 20세 순자산 ${r.net}·부채 ${r.debt}`).join(' | '), shots });
