// 360px(터치) 대표 화면: 「떠난 가족」이 늘어난 카드(글자 100·200%) · FM7a 변형 카드·줄(글자 200%) · 가림 켠 줄. 가로 넘침·줄 수 측정
import { chromium, boot, loadState, cardNow, ageNow } from './fm7a-lib.mjs';
const b = await chromium.launch();
const vp = { width: 360, height: 740 };
// ① 떠난 가족 카드
for (const pct of [100, 200]) {
  const st = loadState('GONEMAX'); st.data.paused = true;
  const { ctx, page, errors } = await boot(b, st, { viewport: vp, scale: 1, settings: { speed: 1, autoMode: false } });
  await page.getByTestId('life-screen').waitFor({ timeout: 12000 });
  if (pct !== 100) await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.waitForTimeout(300);
  await page.getByTestId('family-more').click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(200);
  const m = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid="family-gone"] dd')].map((dd) => { const lh = parseFloat(getComputedStyle(dd).lineHeight) || parseFloat(getComputedStyle(dd.querySelector('small') ?? dd).lineHeight) || 20; return { text: dd.innerText.replace(/\s+/g, ' ').trim(), lines: Math.round(dd.getBoundingClientRect().height / lh) }; });
    const card = document.querySelector('[data-testid="family-card"]');
    return { rows, cardW: Math.round(card.getBoundingClientRect().width), pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, cardOverflow: card.scrollWidth - card.clientWidth };
  });
  console.log(`① ${vp.width}px 글자 ${pct}%: 떠난 가족 ${m.rows.length}명, 줄 수 ${m.rows.map((r) => r.lines).join('/')} (최대 ${Math.max(...m.rows.map((r) => r.lines))}) | 카드 가로 넘침 ${m.cardOverflow}px · 페이지 ${m.pageOverflow}px | errors ${errors.length}`);
  await ctx.close();
}
// ② FM7a 변형 카드·줄 (글자 200%): 시트·인라인 카드 가로 넘침, 줄 넘침
for (const [key, dir] of [['T07-m-industrial', 'states'], ['T08-f-g86', 'states'], ['T06-male-누나-boomer', 'states'], ['T04-g86', 'states']]) {
  const st = loadState(key);
  const { ctx, page, errors } = await boot(b, st, { viewport: vp, scale: 40, settings: { speed: 8, autoMode: false } });
  await page.addInitScript(() => {}); 
  await page.getByTestId('life-screen').waitFor({ timeout: 12000 });
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  const a0 = st.data.age;
  const t0 = Date.now(); let cardInfo = null;
  while (Date.now() - t0 < 40000) {
    const c = await cardNow(page);
    if (c && !cardInfo) {
      await page.waitForTimeout(250);
      cardInfo = await page.evaluate(() => { const dlg = document.querySelector('[role="dialog"]') ?? document.querySelector('[data-testid="choice-panel"]'); return { sheetOverflow: dlg ? dlg.scrollWidth - dlg.clientWidth : null, pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, title: document.querySelector('[data-testid="choice-title"]')?.textContent }; });
      await page.getByTestId(`choice-${c.choices[0].id}`).click({ timeout: 2000 }).catch(() => {});
    }
    if ((await ageNow(page)) >= a0 + 2) break;
    await page.waitForTimeout(80);
  }
  await page.getByTestId('pause').click({ timeout: 800 }).catch(() => {});
  const log = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, rowOverflow: [...document.querySelectorAll('[data-testid="log-list"] li')].filter((li) => li.scrollWidth > li.clientWidth + 1).length }));
  console.log(`② ${key} 360px 200%: 카드 ${JSON.stringify(cardInfo)} | 기록 줄 넘침 ${log.rowOverflow}개 · 페이지 가로 넘침 ${log.overflow}px | errors ${errors.length}`);
  await ctx.close();
}
// ③ 가림 켠 360px
{
  const st = loadState('T06-male-형-industrial');
  const { ctx, page, errors } = await boot(b, st, { viewport: vp, scale: 40, settings: { speed: 8, autoMode: true, gentle: true } });
  await page.getByTestId('life-screen').waitFor({ timeout: 12000 });
  await page.waitForFunction((a) => Number(document.querySelector('[data-testid="life-age"]')?.textContent?.match(/\d+/)?.[0] ?? 0) >= a + 2, st.data.age, { timeout: 40000 });
  await page.getByTestId('pause').click({ timeout: 800 }).catch(() => {});
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, veiled: [...document.querySelectorAll('[data-testid="log-list"] li[data-veiled="true"]:not([data-tl="era"])')].map((li) => ({ w: li.scrollWidth - li.clientWidth, btn: li.querySelector('[data-testid="veil-btn"]')?.getBoundingClientRect().height }))}));
  console.log(`③ 가림 켬 360px 200%: 가림 줄 ${m.veiled.length}개 가로 넘침 ${m.veiled.map((v) => v.w).join('/')}px · 버튼 높이 ${m.veiled.map((v) => Math.round(v.btn)).join('/')}px | 페이지 가로 넘침 ${m.overflow}px | errors ${errors.length}`);
  await ctx.close();
}
await b.close();
