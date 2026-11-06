// ④ 결정 카드가 떠 있는 해에 별세가 일어나도 카드·그림·한 줄이 같다: 카드가 뜬 순간의 식구 카드(산 사람·떠난 가족)·그림 조각·아래 한 줄을 읽는다
import { chromium, boot, loadState, cardNow, readSave } from './fm7a-lib.mjs';
const b = await chromium.launch();
for (const key of process.argv.slice(2)) {
  const st = loadState(key);
  const { ctx, page, errors } = await boot(b, st, { scale: 60, settings: { speed: 1, autoMode: false } });
  await page.getByTestId('life-screen').waitFor();
  let card = null; const t0 = Date.now();
  while (Date.now() - t0 < 30000 && !(card = await cardNow(page))) await page.waitForTimeout(40);
  if (!card) { console.log(key, '카드 없음'); await ctx.close(); continue; }
  await page.waitForTimeout(400);
  const view = await page.evaluate(() => ({
    alive: [...document.querySelectorAll('[data-testid="family-list"] dt')].map((dt) => dt.textContent.trim() + ' ' + (dt.nextElementSibling?.querySelector('.family-who')?.textContent ?? '')),
    gone: [...document.querySelectorAll('[data-testid="family-gone"] dt')].map((dt) => dt.textContent.trim() + ' ' + (dt.nextElementSibling?.innerText ?? '').replace(/\s+/g, ' ')),
    line: document.querySelector('[data-testid="scene-line"]')?.textContent,
    pieces: [...document.querySelectorAll('[data-layer="식구"] [data-piece]')].map((e) => e.getAttribute('data-piece')),
    log: [...document.querySelectorAll('[data-testid="log-list"] li')].filter((li) => /세상을 떠나|따로 살게/.test(li.innerText)).slice(0, 2).map((li) => li.innerText.replace(/\s+/g, ' ').slice(0, 60)),
  }));
  console.log(`${key} 카드 「${card.title}」(${card.choices.map((c) => c.id).join('|')})\n  산 사람 ${view.alive.join(' ; ')}\n  떠난 가족 ${view.gone.filter((g) => !/태어나기 전/.test(g)).join(' ; ')}\n  그림 조각 ${view.pieces.join(',')}\n  아래 한 줄 「${view.line}」 | 기록 ${JSON.stringify(view.log)} | errors ${errors.length}`);
  await ctx.close();
}
await b.close();
