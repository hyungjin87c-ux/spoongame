// QA-003 M7a 회귀(M5 자산 카드·영유아 이후 20세 전환): 영유아 이벤트가 쌓인 연표를 가진 19세 저장이 20세가 될 때 자산 카드가 금액 3개로 바뀌고, 20세 미만 집안 살림이 20세 시작 순자산에 합쳐지며, 시대 태그가 맞는다.
// 사용: node qa/scripts/m7a-regress2.mjs     결과: cases.jsonl (M7a-R06), 스크린샷 M7a-R06-*
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, runCase, shot } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';

const craft = JSON.parse(fs.readFileSync(path.join(OUT, RP + 'craft-saves.json'), 'utf8'));
const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const browser = await launch();

await runCase({ id: 'M7a-R06', cat: '회귀', title: 'M5 자산 카드·20세 전환: 영유아 줄이 쌓인 19세 저장 → 20세에 자산 카드가 순자산·연 소득·부채 금액으로 바뀌고 「스무 살」 줄이 남음, 지난·다가올 세상은 「지금 가치로 환산」 태그', steps: '세 시대 × 재력 1·5단계의 19세 저장(집안 살림 ±)을 8배속으로 20세까지 → 자산 카드·연표·저장 읽기', expected: '19세 카드는 「자산은 스무 살부터 셉니다…」, 20세 금액 3개, 저장 assets 있음·familyFund 0, 태그: 지난·다가올만' }, async () => {
  const bad = [];
  const rows = [];
  const shots = [];
  for (const era of ['present', 'past', 'future']) {
    for (const tier of [1, 5]) {
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      const env = JSON.parse(craft[`w-infant-first-birthday-${era}-t${tier}`].raw);
      env.data.age = 19;
      env.data.seen = {};
      env.data.history = [env.data.history[0]];
      env.data.lastChoiceAge = null;
      env.data.familyFund = tier === 1 ? -300 : 1200;
      env.data.stats = { education: 60, health: 70, happiness: 60, relationships: 60 };
      // 19세 저장에서는 이벤트가 안 나오게 쉬운 난수를 고르지 않고 선택지가 뜨면 첫 번째를 누른다
      await seedStorage(ctx, { [GAME_KEY]: JSON.stringify(env), [SETTINGS_KEY]: SPEED8 });
      const page = await ctx.newPage();
      await page.goto(PROD, { waitUntil: 'load' });
      await page.waitForSelector('[data-testid="life-screen"]');
      const card19 = await page.evaluate(() => document.querySelector('[data-testid="assets-note"]')?.textContent.trim() ?? null);
      const t0 = Date.now();
      let g;
      for (;;) {
        g = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
        if (g.age >= 20) break;
        const ch = await page.evaluate(() => {
          const b = document.querySelector('[data-testid="choice-panel"] .choice');
          return b && b.getAttribute('aria-disabled') !== 'true' ? b.getAttribute('data-testid') : null;
        });
        if (ch) await page.locator(`[data-testid="${ch}"]`).click({ timeout: 2000 }).catch(() => {});
        if (Date.now() - t0 > 25000) break;
        await sleep(60);
      }
      await sleep(500);
      const r = await page.evaluate(() => {
        const q = (s) => document.querySelector(s);
        const tx = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
        return { net: tx(q('[data-testid="assets-net"]')), income: tx(q('[data-testid="assets-income"]')), debt: tx(q('[data-testid="assets-debt"]')), basis: tx(q('[data-testid="assets-basis"]')), note: tx(q('[data-testid="assets-note"]')), last: [...document.querySelectorAll('[data-testid="log-row"]')].slice(-2).map((x) => tx(x)) };
      });
      const tag = `${era}-t${tier}`;
      if (!/자산은 스무 살부터 셉니다/.test(card19 ?? '')) bad.push(`${tag}: 19세 카드 안내 「${card19}」`);
      if (g.age < 20 || g.assets === null) bad.push(`${tag}: 20세 자산 없음 age ${g.age}`);
      if (g.familyFund !== 0) bad.push(`${tag}: 20세 집안 살림 ${g.familyFund}`);
      if (!r.net || !r.income || !r.debt) bad.push(`${tag}: 금액 3개 중 빠짐 ${JSON.stringify(r)}`);
      if ((era === 'present') === (r.basis !== null)) bad.push(`${tag}: 환산 태그 ${r.basis}`);
      if (era !== 'present' && r.basis !== '지금 가치로 환산') bad.push(`${tag}: 태그 문구 ${r.basis}`);
      if (!g.history.some((h) => /스무 살/.test(h.text))) bad.push(`${tag}: 「스무 살」 줄 없음`);
      rows.push(`${tag}: 19세 「${(card19 ?? '').slice(0, 16)}…」→ 20세 순자산 ${r.net}·소득 ${r.income}·부채 ${r.debt}${r.basis ? '·태그 ' + r.basis : ''}`);
      if (tier === 1 && era === 'present') {
        await page.evaluate(() => document.querySelector('[data-testid="assets-card"]').scrollIntoView({ block: 'center', behavior: 'instant' }));
        await sleep(200);
        shots.push(await shot(page, 'R06', 'assets-card-age20-present-t1'));
      }
      await ctx.close();
    }
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') : `6조합 모두 정상. ${rows.slice(0, 3).join(' | ')}`, shots };
});
await browser.close();
