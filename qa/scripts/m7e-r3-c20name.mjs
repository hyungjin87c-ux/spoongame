// QA-003 M7e 3회차 C20 증거: 부모 임종·돌봄 카드의 「함께 나누는」 선택지 버튼의 접근성 이름(CDP 접근성 트리) 원문과 기호 유무
// 사용: QA_OUT=qa/results/m7e/r3 QA_SHOT_PREFIX=M7e-r3 node qa/scripts/m7e-r3-c20name.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, shot } from './m7e-lib.mjs';

const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const browser = await launch();
const out = [];
for (const card of ['card-farewell-plain', 'card-farewell-moved', 'card-middle-parents-farewell-past', 'card-middle-parents-care-present']) {
  const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
  await seedStorage(ctx, { [GAME_KEY]: fs.readFileSync(path.join(OUT, 'saves', card + '.json'), 'utf8'), [SETTINGS_KEY]: SPEED8 });
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
  await sleep(700);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('Accessibility.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
  for (const id of await page.evaluate(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].map((b) => b.getAttribute('data-testid')))) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[data-testid="${id}"]` });
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
    const name = nodes[0].name?.value ?? '';
    out.push({ card: card.replace('card-', ''), id, role: nodes[0].role?.value, name, nonHangulSymbols: [...name.matchAll(/[^가-힣0-9 .]/g)].map((m) => m[0]) });
  }
  if (card === 'card-farewell-plain') await shot(page, 'C20', 'farewell-share-label');
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'c20-name-detail.json'), JSON.stringify(out, null, 1));
for (const r of out) console.log(r.card, r.id, r.role, `「${r.name}」`, r.nonHangulSymbols.length ? '기호 ' + r.nonHangulSymbols.join('') : '기호 없음');
