// QA-003 M7e 회귀(M5 자산 카드·20세 전환 + M7a 영유아): 19세 일시정지 저장을 열어 재개 → 20세에 자산 카드가 순자산·연 소득·부채로 바뀌고 「스무 살」 단계 줄(새 합쇼체)이 남으며,
// 20세 미만의 안내가 새 풀이를 갖고 시대 태그가 맞는다. 영유아 마일스톤·동생 카드·영향 줄은 수확 표본(m7e-analyze)에서 센다.
// 사용: node qa/scripts/m7e-regress2.mjs     결과: cases.jsonl (M7e-R06), 스크린샷 M7e-R06-*
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, runCase, shot } from './m7e-lib.mjs';

const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const browser = await launch();
await runCase({ id: 'M7e-R06', cat: '회귀', title: 'M5 자산 카드·20세 전환: 19세 저장 → 20세에 자산 카드가 순자산·연 소득·부채 금액으로 바뀌고 「스무 살이 되었습니다. 이제부터는 집안 형편이 아니라 내가 가진 것으로 살아갑니다.」 줄이 남음, 지난·다가올 세상은 「지금 가치로 환산」 태그', steps: '세 시대 × 재력 1·3·5단계의 19세 저장을 8배속으로 20세까지(카드는 첫 선택지) → 자산 카드·연표·저장 읽기', expected: '19세 카드는 「자산은 스무 살부터 셉니다…」 + 새 집안 살림 풀이, 20세 금액 3개, 저장 assets 있음·familyFund 0, 태그: 지난·다가올만, 단계 줄 새 문안' }, async () => {
  const bad = [];
  const rows = [];
  const shots = [];
  for (const era of ['present', 'past', 'future']) {
    for (const tier of [1, 3, 5]) {
      const name = `life-${era}-t${tier}-a19`;
      const fp = path.join(OUT, 'saves', name + '.json');
      if (!fs.existsSync(fp)) { bad.push(`${name}: 저장 없음`); continue; }
      const env = JSON.parse(fs.readFileSync(fp, 'utf8'));
      env.data.paused = false;
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await seedStorage(ctx, { [GAME_KEY]: JSON.stringify(env), [SETTINGS_KEY]: SPEED8 });
      const page = await ctx.newPage();
      await page.goto(PROD, { waitUntil: 'load' });
      await page.waitForSelector('[data-testid="life-screen"]');
      const card19 = await page.evaluate(() => document.querySelector('[data-testid="assets-card"]')?.textContent.replace(/\s+/g, ' ').trim() ?? null);
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
        if (Date.now() - t0 > 40000) break;
        await sleep(60);
      }
      await sleep(600);
      const r = await page.evaluate(() => {
        const q = (s) => document.querySelector(s);
        const tx = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
        return { net: tx(q('[data-testid="assets-net"]')), income: tx(q('[data-testid="assets-income"]')), debt: tx(q('[data-testid="assets-debt"]')), basis: tx(q('[data-testid="assets-basis"]')), last: [...document.querySelectorAll('[data-testid="log-row"]')].slice(-3).map((x) => tx(x)) };
      });
      const tag = `${era}-t${tier}`;
      if (!/자산은 스무 살부터 셉니다\. 지금은 집안 형편을 따릅니다\. 선택지에 보이는 「집안 살림」은 살림에 보태거나 축낸 몫을 모아 둔 값이고, 스무 살이 되면 내 자산과 부채로 합쳐집니다\./.test(card19 ?? '')) bad.push(`${tag}: 19세 카드 안내 「${card19}」`);
      if (g.age < 20 || g.assets === null) bad.push(`${tag}: 20세 자산 없음 age ${g.age}`);
      if (g.familyFund !== 0) bad.push(`${tag}: 20세 집안 살림 ${g.familyFund}`);
      if (!r.net || !r.income || !r.debt) bad.push(`${tag}: 금액 3개 중 빠짐 ${JSON.stringify(r)}`);
      if ((era === 'present') === (r.basis !== null)) bad.push(`${tag}: 환산 태그 ${r.basis}`);
      if (era !== 'present' && r.basis !== '지금 가치로 환산') bad.push(`${tag}: 태그 문구 ${r.basis}`);
      const stage = g.history.find((h) => h.kind === 'stage' && h.age === 20);
      if (!stage || stage.text !== '스무 살이 되었습니다. 이제부터는 집안 형편이 아니라 내가 가진 것으로 살아갑니다.') bad.push(`${tag}: 20세 단계 줄 「${stage?.text}」`);
      rows.push(`${tag}: 19세 「${(card19 ?? '').slice(0, 14)}…」→ 20세 순자산 ${r.net}·소득 ${r.income}·부채 ${r.debt}${r.basis ? '·태그 ' + r.basis : ''}`);
      if (tier === 1 && era === 'present') {
        await page.evaluate(() => document.querySelector('[data-testid="assets-card"]').scrollIntoView({ block: 'center', behavior: 'instant' }));
        await sleep(200);
        shots.push(await shot(page, 'R06', 'assets-card-age20-present-t1'));
      }
      await ctx.close();
    }
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') : `9조합 모두 정상. ${rows.slice(0, 3).join(' | ')}`, shots };
});
await browser.close();
