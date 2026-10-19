// QA-003 M7b 공격 3: 자동 끄기 더블탭을 낮은 화면(320x568·360x568·375x667·667x375)에서 — 둘째 탭 자리에 선택지가 오는 조합을 찾아 오탭이 막히는지
import { launch, sleep, shot, runCase, readSave, choiceCount, cardReady } from './m7b-lib.mjs';
import { openCard, VPS } from './m7b-audit.mjs';

const ONLY = process.argv[2] || '';
const run = (c, fn) => (!ONLY || c.id.includes(ONLY) ? runCase({ cat: '공격', ...c }, fn) : null);
const browser = await launch();
const hist = async (page) => choiceCount(await readSave(page));
const VPS2 = [VPS[0], VPS[1], VPS[2], { name: '375x667-touch', width: 375, height: 667, touch: true }, VPS[4], VPS[3]];

await run({ id: 'A07b', title: '자동 끄기 더블탭(낮은 화면 포함) — 둘째 탭이 선택지·접기 버튼에 떨어지는 조합이 있으면 막히는지', steps: '카드 6종 × 뷰포트 6종(320x568·360x568·360x740·375x667·667x375·375x812)에서 「자동 모드」 버튼 중심을 탭 → 60ms 뒤 같은 좌표 다시 탭. 둘째 탭 자리의 요소와 선택 기록을 함께 기록', expected: '선택 기록 불변. (둘째 탭 자리가 선택지·접기 버튼인 조합이 나오면 가드 여부를 별도 기록)', }, async () => {
  const bad = [];
  const hits = [];
  const kinds = {};
  let combos = 0;
  const shots = [];
  for (const name of ['tutoring-present', 'sibling-past', 'startup-present', 'layoff-future', 'estate-present', 'fever-present']) {
    for (const vp of VPS2) {
      const { ctx, page } = await openCard(browser, name, 'inline', { vp, hidden: true });
      await cardReady(page);
      const base = await hist(page);
      const bb = await page.getByTestId('auto').boundingBox();
      const x = bb.x + bb.width / 2;
      const y = bb.y + bb.height / 2;
      if (vp.touch) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
      await sleep(60);
      const under = await page.evaluate(([px, py]) => { const e = document.elementFromPoint(px, py); const t = e ? e.closest('[data-testid]') : null; return e ? (t ? t.getAttribute('data-testid') : (typeof e.className === 'string' ? e.className.split(' ')[0] : e.tagName)) : null; }, [x, y]);
      kinds[under] = (kinds[under] || 0) + 1;
      if (vp.touch) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
      await sleep(700);
      const h = await hist(page);
      combos++;
      const isChoiceOrFold = /^(choice-(?!title|text|hint)|decision-fold-btn)/.test(String(under));
      if (isChoiceOrFold) hits.push(`${name}/${vp.name}: 둘째 탭 자리=${under} → 선택 +${h - base}`);
      if (h !== base) bad.push(`${name}/${vp.name}: 선택 +${h - base} (자리=${under})`);
      if (isChoiceOrFold && !shots.length) shots.push(await shot(page, 'A07b', `${name}-${vp.name}`));
      await ctx.close();
    }
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 4).join(' / ') + ` || 선택지·접기 자리 ${hits.length}조합` : `${combos}조합 모두 선택 불변. 둘째 탭 자리 분포 ${JSON.stringify(kinds)}${hits.length ? ' · 선택지·접기 자리였던 조합 ' + hits.length + '건(가드가 막음): ' + hits.slice(0, 3).join(' ; ') : ''}`, shots };
});
await browser.close();
