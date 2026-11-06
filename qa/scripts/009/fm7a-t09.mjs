// T09 youth-housing: 선택지 이름 둘·결과 글 (선택지마다 한 판씩). T07/T08 나머지 결과 문장은 원본 그대로인지도 본다
import { chromium, boot, loadState, cardNow, ageNow, readSave } from './fm7a-lib.mjs';
const jobs = [['T09-g86', 'return']];
const b = await chromium.launch();
for (const [key, want] of jobs) {
  const st = loadState(key); const a0 = st.data.age;
  const { ctx, page, errors } = await boot(b, st, { scale: 40, settings: { speed: 8, autoMode: false } });
  await page.getByTestId('life-screen').waitFor({ timeout: 12000 });
  const t0 = Date.now(); let card = null, chosen = null;
  while (Date.now() - t0 < 40000) {
    const c = await cardNow(page);
    if (c && !card) { card = c; const id = c.choices.find((x) => x.id === want)?.id ?? c.choices[0].id; chosen = id; await page.getByTestId(`choice-${id}`).click({ timeout: 2000 }).catch(() => {}); }
    if (card && (await ageNow(page)) >= a0 + 1) break;
    await page.waitForTimeout(60);
  }
  await page.getByTestId('pause').click({ timeout: 800 }).catch(() => {});
  const sv = await readSave(page);
  const row = sv.data.history.find((h) => h.kind === 'choice' && h.age === a0) ?? sv.data.history.filter((h) => h.age === a0).slice(-1)[0];
  console.log(`${key} 「${card?.title}」 선택지: ${card?.choices.map((c) => c.id + '=' + c.label).join(' / ')}\n   고름 ${chosen} → ${row?.text} | errors ${errors.length}`);
  await ctx.close();
}
await b.close();
