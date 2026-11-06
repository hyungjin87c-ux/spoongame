// pending.choiceIds(줄이 난 해 줄어든 선택지)의 저장·복원·변조: 카드가 떠 있을 때 저장을 읽어 → 변조해 → 다시 열기
import { chromium, boot, loadState, readSave, cardNow, GAME_KEY, stopSaving, BASE } from './fm7a-lib.mjs';
const st = loadState('parentc-industrial-81000531');
const b = await chromium.launch();
// 1) 카드가 뜬 저장을 얻는다
const first = await boot(b, st, { scale: 60, settings: { speed: 1, autoMode: false } });
await first.page.getByTestId('life-screen').waitFor();
let card = null; const t0 = Date.now();
while (Date.now() - t0 < 30000 && !(card = await cardNow(first.page))) await first.page.waitForTimeout(40);
const raw = await first.page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
const pend = JSON.parse(raw).data.pending;
console.log('원래 카드', card.title, card.choices.map((c) => c.id).join('|'), '| 저장 pending', JSON.stringify(pend));
await first.ctx.close();
const variants = {
  '그대로(저장 → 닫기 → 다시 열기)': (d) => d,
  'choiceIds에 막힌 선택지 ask 되살림': (d) => { d.pending.choiceIds = ['accept', 'ask', 'decline']; },
  'choiceIds 1개만': (d) => { d.pending.choiceIds = ['accept']; },
  'choiceIds 빈 배열': (d) => { d.pending.choiceIds = []; },
  'choiceIds 없는 id': (d) => { d.pending.choiceIds = ['nope', 'accept']; },
  'choiceIds 문자열': (d) => { d.pending.choiceIds = 'accept'; },
  'choiceIds 중복 [accept,accept]': (d) => { d.pending.choiceIds = ['accept', 'accept']; },
  'choiceIds 필드 삭제': (d) => { delete d.pending.choiceIds; },
};
for (const [label, fn] of Object.entries(variants)) {
  const env = JSON.parse(raw);
  fn(env.data);
  const r = await boot(b, null, { scale: 60, raw: JSON.stringify(env), settings: { speed: 1, autoMode: false } });
  await r.page.waitForTimeout(1500);
  const scr = await r.page.evaluate(() => ['life-screen', 'title-screen', 'error-screen'].filter((i) => document.querySelector(`[data-testid="${i}"]`)?.getClientRects().length).join(','));
  const c = await cardNow(r.page);
  const sv = await readSave(r.page);
  console.log(`${label.padEnd(34)} → 화면 ${scr} | 카드 ${c ? c.title + ' ' + c.choices.map((x) => x.label).join(' ; ') : '(없음)'} | 저장 pending ${JSON.stringify(sv?.data?.pending?.choiceIds)} | phase ${sv?.data?.phase} age ${sv?.data?.age} | 본문 「${(await r.page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))).slice(0, 70)}」 | 이어서 버튼 ${await r.page.getByTestId('resume').isVisible().catch(() => false)} | errors ${r.errors.length}`);
  await r.ctx.close();
}
await b.close();
