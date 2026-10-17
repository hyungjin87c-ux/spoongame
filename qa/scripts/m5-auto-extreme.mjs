// QA-003 M5: 범위 끝 값(순자산 −20억/+200억, 부채 20억/100억, 소득 0/10억)에서 자동 모드로 한 판이 끝까지 가는가(NaN·무한·크래시·불변식 위반 0).
import { launch, mkctx, seedStorage, DEV, GAME_KEY, SETTINGS_KEY, sleep, shot, runCase, editSave, READ_DASH_M5 } from './m5-lib.mjs';
import { loadSave } from './m5-states.mjs';
const browser = await launch();
const settings = JSON.stringify({ version: 3, data: { speed: 8, autoMode: true, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'light' } });
await runCase({ id: 'M5-B11', cat: '공격', title: '범위 끝 자산(순자산 −20억·부채 20억·소득 0 / 순자산 +200억·부채 100억·소득 10억)에서 자동 모드로 엔딩까지: 크래시·NaN·무한·불변식 위반 0', steps: '저장을 범위 끝으로 바꿔(검증 통과값) 개발 서버 시간 배율 60·8배속·자동 모드로 끝까지 돌리며 매 나이 저장의 불변식을 확인', expected: '엔딩 도달, 오류 0, 모든 시점 정수·범위·debt ≥ max(0, −net), 화면 금액에 NaN·undefined 없음' }, async () => {
  const bad = [];
  const notes = [];
  const shots = [];
  for (const era of ['present', 'past', 'future']) {
    for (const [name, assets] of [['neg', { net: -200000, debt: 200000, income: 0, incomeAdj: -10000, dwelling: 'care' }], ['big', { net: 2000000, debt: 1000000, income: 100000, incomeAdj: 10000, dwelling: 'own' }]]) {
      const raw = editSave(loadSave(era, 'adult-dash'), (d) => {
        d.paused = false;
        d.assets = assets;
      });
      const ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
      await seedStorage(ctx, { [GAME_KEY]: raw, [SETTINGS_KEY]: settings });
      const page = await ctx.newPage();
      await page.goto(`${DEV}?__timescale=60`, { waitUntil: 'load' });
      const t0 = Date.now();
      let n = 0;
      let last = null;
      for (;;) {
        if (Date.now() - t0 > 60000) {
          bad.push(`${era}/${name}: 시간 초과`);
          break;
        }
        let r;
        try {
          r = await page.evaluate((k) => ({ raw: localStorage.getItem(k), text: document.body.innerText, screen: ['ending-screen', 'life-screen', 'error-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)) }), GAME_KEY);
        } catch {
          await sleep(30);
          continue;
        }
        if (r.screen === 'error-screen') {
          bad.push(`${era}/${name}: 오류 화면`);
          break;
        }
        const d = JSON.parse(r.raw).data;
        if (d.age !== last) {
          last = d.age;
          n++;
          const a = d.assets;
          if (a) {
            if (![a.net, a.income, a.debt, a.incomeAdj].every(Number.isInteger)) bad.push(`${era}/${name} ${d.age}세: 정수 아님`);
            if (a.debt < Math.max(0, -a.net)) bad.push(`${era}/${name} ${d.age}세: debt < −net`);
          }
          if (/NaN|undefined|Infinity/.test(r.text)) bad.push(`${era}/${name} ${d.age}세: 화면에 NaN/undefined`);
        }
        if (r.screen === 'ending-screen') break;
        await sleep(20);
      }
      const end = await page.evaluate(() => document.querySelector('[data-testid="final-net"]')?.innerText.replace(/\s+/g, ' '));
      notes.push(`${era}/${name}: ${n}개 나이 → 엔딩 「${end}」`);
      if (era === 'present') shots.push(await shot(page, 'B11', `${era}-${name}-ending`));
      await ctx.close();
    }
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') : notes.join(' | '), shots };
});
await browser.close();
