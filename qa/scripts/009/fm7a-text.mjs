// 정상 흐름 ① 문장 노출: 키(T01…)마다 그 해 직전 판을 열어 한 해(또는 카드 뒤)까지 진행하고, 화면의 기록·카드 글을 그대로 찍는다
// 사용: QA_BASE=http://localhost:5311 node qa/scripts/009/fm7a-text.mjs T01-industrial T02-boomer …   (키 = 상태 파일 이름)
import { chromium, boot, loadState, logRows, playTo, readSave } from './fm7a-lib.mjs';

const keys = process.argv.slice(2);
const b = await chromium.launch();
for (const key of keys) {
  const st = loadState(key);
  const a0 = st.data.age;
  const { ctx, page, errors } = await boot(b, st, { scale: 40, settings: { speed: 1, autoMode: false } });
  await page.getByTestId('life-screen').waitFor({ timeout: 15000 });
  // 목표: 그 해가 끝나 나이가 올라갈 때까지. 카드는 「직접 돌본다」 같은 특정 선택지를 고르고 싶어 고르기 규칙을 키로 정한다
  const pickRule = (card) => {
    const i = card.choices.findIndex((c) => /직접|곁|돌보/.test(c.label));
    return i >= 0 ? i : 0;
  };
  const r = await playTo(page, a0 + 2, { pick: pickRule });
  await page.getByTestId('pause').click({ timeout: 800 }).catch(() => {});
  await page.waitForTimeout(300);
  const rows = (await logRows(page)).filter((t) => t.length > 0).slice(0, 14);
  const save = await readSave(page);
  console.log(`\n=== ${key} (시작 ${a0}세) → ${save?.data?.age}세 | errors ${errors.length} ${errors.slice(0, 2).join(' | ')}${r.timeout ? ' | TIMEOUT' : ''}`);
  for (const c of r.cards) console.log(`  [카드 ${c.age}세] 「${c.title}」 ${c.text}\n     선택지: ${c.choices.map((x) => x.id + '=' + x.label).join(' / ')}`);
  for (const t of rows) console.log('  · ' + t.slice(0, 160));
  if (process.env.FAM) {
    const fam = await page.evaluate(() => ({
      card: document.querySelector('[data-testid="family-card"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      gone: [...document.querySelectorAll('[data-testid="family-gone"] li, [data-testid="family-gone"]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).slice(0, 4),
      line: document.querySelector('[data-testid="scene-line"]')?.textContent ?? null,
    }));
    console.log('  [가족 카드] ' + String(fam.card).slice(0, 700));
    console.log('  [떠난 가족] ' + fam.gone.join(' ; '));
    console.log('  [한 줄] ' + fam.line);
  }
  await ctx.close();
}
await b.close();
