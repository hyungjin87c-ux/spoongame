// 「무거운 장면 가리기」: 켠 채 FM7a 줄·카드가 분류 이름으로 접히고 원문이 안 새는지, 키보드 Tab 순서·펼침, 끄면 원문이 돌아오는지
// 사용: QA_STATES=… QA_BASE=http://localhost:5311 node qa/scripts/009/fm7a-gentle.mjs T06-male-형-industrial T01-industrial …
import { chromium, boot, loadState, cardNow, ageNow, readSave } from './fm7a-lib.mjs';

const HEAVY_IDS = /^(fam-parent-gone|fam-gp-gone|fam-parents-apart|fam-sib-lost)$/;
const keys = process.argv.slice(2);
const vp = process.env.QA_VP === '360' ? { width: 360, height: 740 } : { width: 1280, height: 800 };
const b = await chromium.launch();
for (const key of keys) {
  const st = loadState(key);
  const a0 = st.data.age;
  const { ctx, page, errors } = await boot(b, st, { scale: 40, viewport: vp, settings: { speed: 1, autoMode: false, gentle: true } });
  await page.getByTestId('life-screen').waitFor({ timeout: 15000 });
  const veilCards = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 80000) {
    if ((await ageNow(page)) >= a0 + 2) break;
    if (await page.getByTestId('veil-open').isVisible().catch(() => false)) {
      // 가린 결정 카드: 분류 이름만 보이는지
      const head = await page.getByTestId('choice-title').textContent();
      const hasChoices = (await cardNow(page)) !== null;
      const note = await page.getByTestId('veil-note').textContent().catch(() => '');
      veilCards.push({ head: head?.replace(/\s+/g, ' ').trim(), note: note?.trim(), choicesLeaked: hasChoices });
      await page.getByTestId('veil-open').click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(80);
      const card = await cardNow(page);
      if (card) await page.getByTestId(`choice-${card.choices[0].id}`).click({ timeout: 2000 }).catch(() => {});
      continue;
    }
    const card = await cardNow(page);
    if (card) { await page.getByTestId(`choice-${card.choices[0].id}`).click({ timeout: 2000 }).catch(() => {}); continue; }
    await page.waitForTimeout(40);
  }
  await page.getByTestId('pause').click({ timeout: 800 }).catch(() => {});
  await page.waitForTimeout(300);
  const save = await readSave(page);
  const hist = save.data.history;
  const heavyRows = hist.filter((h) => HEAVY_IDS.test(h.eventId ?? '') || /-(mother|father)-gone$/.test(h.eventId ?? ''));
  const logBox = page.getByTestId('log-list');
  const inner = await page.evaluate(() => document.querySelector('[data-testid="log-list"]').innerText);
  const aria = await logBox.ariaSnapshot();
  const leaks = heavyRows.filter((h) => inner.includes(h.text.slice(0, 14)) || aria.includes(h.text.slice(0, 14))).map((h) => `${h.age}세 ${h.eventId}`);
  const veiled = await page.evaluate(() => [...document.querySelectorAll('[data-testid="log-list"] li[data-veiled="true"]:not([data-tl="era"])')].map((li) => ({ shown: li.innerText.replace(/\s+/g, ' ').trim(), btn: li.querySelector('[data-testid="veil-btn"]')?.getAttribute('aria-label'), hiddenBody: li.querySelector('[data-testid="veil-body"]')?.hidden })));
  console.log(`\n=== ${key} gentle=on ${vp.width}px (${a0}세→${await ageNow(page)}세) | 가림 대상 줄 ${heavyRows.length} | 원문 노출 ${leaks.length}${leaks.length ? ' ' + leaks.join(',') : ''} | errors ${errors.length}`);
  console.log('  가린 카드:', JSON.stringify(veilCards));
  for (const v of veiled.slice(0, 5)) console.log('  가린 줄:', JSON.stringify(v));
  // 키보드: 첫 veil-btn에서 시작해 Tab으로 다음 veil-btn들을 지나가는 순서와 Enter 펼침
  const order = await page.evaluate(() => [...document.querySelectorAll('[data-testid="log-list"] [data-testid="veil-btn"]')].map((x) => x.getAttribute('aria-label')));
  if (order.length > 0) {
    await page.locator('[data-testid="log-list"] [data-testid="veil-btn"]').first().focus();
    const walked = [await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))];
    for (let i = 0; i < Math.min(order.length + 1, 8); i++) { await page.keyboard.press('Tab'); walked.push(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName)); }
    const inDomOrder = order.every((lab, i) => walked[i] === lab || walked.slice(i).includes(lab));
    console.log('  Tab 순서(DOM):', JSON.stringify(order.slice(0, 6)), '\n  Tab 걸음   :', JSON.stringify(walked.slice(0, 8)), '| DOM 순서대로 닿음', inDomOrder);
    // Enter로 펼침 → 원문 보임 → Enter로 접힘
    const first = page.locator('[data-testid="log-list"] [data-testid="veil-btn"]').first();
    await first.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(120);
    const open = await page.evaluate(() => { const bt = document.querySelector('[data-testid="log-list"] [data-testid="veil-btn"]'); const body = document.getElementById(bt.getAttribute('aria-controls')); return { expanded: bt.getAttribute('aria-expanded'), bodyHidden: body.hidden, text: body.innerText.replace(/\s+/g, ' ').trim().slice(0, 90), focusKept: document.activeElement === bt }; });
    await page.keyboard.press('Enter'); await page.waitForTimeout(120);
    const closed = await page.evaluate(() => { const bt = document.querySelector('[data-testid="log-list"] [data-testid="veil-btn"]'); return { expanded: bt.getAttribute('aria-expanded'), bodyHidden: document.getElementById(bt.getAttribute('aria-controls')).hidden }; });
    console.log('  Enter 펼침:', JSON.stringify(open), '→ 접힘:', JSON.stringify(closed));
  }
  await ctx.close();
}
await b.close();
