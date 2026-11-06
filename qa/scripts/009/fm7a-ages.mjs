// R-634a 나이 일치: 별세 줄 「N세」 = 별세가 나는 해 시작 때 식구 카드에 보이던 그분의 나이 = 줄이 난 뒤 「떠난 가족」의 「N세에 세상을 떠남」 (옮겨진 별세 포함)
import { chromium, boot, loadState, readSave, ageNow } from './fm7a-lib.mjs';
const keys = process.argv.slice(2);
const b = await chromium.launch();
for (const key of keys) {
  const st = loadState(key); st.data.paused = true; const a0 = st.data.age;
  const { ctx, page, errors } = await boot(b, st, { scale: 40, settings: { speed: 8, autoMode: true } });
  await page.getByTestId('life-screen').waitFor({ timeout: 12000 });
  await page.waitForTimeout(500);
  const pre = await page.evaluate(() => [...document.querySelectorAll('[data-testid="family-list"] dt')].filter((dt) => /^(어머니|아버지)$/.test(dt.textContent.trim())).map((dt) => dt.textContent.trim() + ' ' + (dt.nextElementSibling?.querySelector('.family-who')?.textContent ?? '')));
  await page.getByTestId('pause').click({ timeout: 800 }).catch(() => {});
  await page.waitForFunction((a) => Number(document.querySelector('[data-testid="life-age"]')?.textContent?.match(/\d+/)?.[0] ?? 0) >= a + 1, a0, { timeout: 40000 });
  await page.getByTestId('pause').click({ timeout: 800 }).catch(() => {});
  await page.waitForTimeout(300);
  const sv = await readSave(page);
  const line = sv.data.history.find((h) => h.eventId === 'fam-parent-gone' && h.age === a0);
  const m = line?.text.match(/^(어머니|아버지)가 (\d+)세/);
  const post = await page.evaluate(() => [...document.querySelectorAll('[data-testid="family-gone"] dt')].map((dt) => dt.textContent.trim() + ' ' + (dt.nextElementSibling?.innerText ?? '').replace(/\s+/g, ' ')).filter((t) => /^(어머니|아버지)/.test(t)));
  const preAge = m ? Number((pre.find((p) => p.startsWith(m[1])) ?? '').match(/(\d+)세/)?.[1]) : null;
  const postAge = m ? Number((post.find((p) => p.startsWith(m[1])) ?? '').match(/(\d+)세에 세상을 떠남/)?.[1]) : null;
  const ok = m && preAge === Number(m[2]) && postAge === Number(m[2]);
  console.log(`${key} (주인공 ${a0}세): 줄 「${line?.text.slice(0, 30)}」 N=${m?.[2]} | 시작 때 카드 ${JSON.stringify(pre)} → ${preAge} | 줄 뒤 카드 ${JSON.stringify(post)} → ${postAge} | 일치=${ok} | errors ${errors.length}`);
  await ctx.close();
}
await b.close();
