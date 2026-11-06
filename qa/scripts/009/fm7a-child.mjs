// 자녀 독립(R-586) 화면 확인: 주인공 나이별로 가족 카드의 자녀 줄(나이·함께/따로 삶)을 기록해 규칙을 화면 숫자로 본다
// ① 19세 미만 자녀는 「따로 삶」이 아니다 ② 20~30세 사이에 「따로 삶」으로 바뀐다(31세 이상 「함께」 없음) ③ senior-alone(「혼자 지냅니다」)이 나온 해에 함께 사는 자녀가 없다
import { chromium, boot, loadState, readSave, picks } from './fm7a-lib.mjs';

const RECORDER = `
(() => {
  const rec = {}; window.__rec = rec;
  const age = () => Number(document.querySelector('[data-testid="life-age"]')?.textContent?.match(/\\d+/)?.[0] ?? -1);
  const snap = () => {
    const a = age(); if (a < 0) return;
    const kids = [...document.querySelectorAll('[data-testid="family-child"]')].map((e) => ({ who: e.querySelector('.family-who')?.textContent?.replace(/\\s+/g, ' ').trim(), state: e.getAttribute('data-state') }));
    const people = [...document.querySelectorAll('[data-testid="family-scene"] [data-testid="scene-people"] li')].map((li) => li.textContent.replace(/\\s+/g, ' ').trim());
    rec[a] = { kids, line: document.querySelector('[data-testid="scene-line"]')?.textContent ?? '' };
  };
  let timer = null; let last = -1;
  new MutationObserver(() => { const a = age(); if (a !== last) { last = a; clearTimeout(timer); timer = setTimeout(snap, 120); } }).observe(document, { subtree: true, childList: true, characterData: true });
  setInterval(snap, 150);
})();
`;
const keys = process.argv.slice(2);
const b = await chromium.launch();
let bad = 0;
for (const key of keys) {
  const st = loadState(key);
  const { ctx, page, errors } = await boot(b, st, { scale: 25, settings: { speed: 8, autoMode: true } });
  await page.addInitScript(RECORDER);
  await page.reload();
  await page.getByTestId('life-screen').waitFor({ timeout: 15000 });
  await page.getByTestId('family-more').click({ timeout: 4000 }).catch(() => {});
  const t0 = Date.now();
  while (Date.now() - t0 < 150000) {
    if (await page.getByTestId('ending-screen').isVisible().catch(() => false)) break;
    const a = await page.evaluate(() => Number(document.querySelector('[data-testid="life-age"]')?.textContent?.match(/\d+/)?.[0] ?? -1));
    if (a >= 82) break;
    await page.getByTestId('family-more').click({ timeout: 300 }).catch(() => {});
    await page.waitForTimeout(250);
  }
  const rec = await page.evaluate(() => window.__rec).catch(() => ({}));
  const sv = await readSave(page).catch(() => null);
  const aloneAges = (sv?.data?.history ?? []).filter((h) => h.eventId === 'senior-alone').map((h) => h.age);
  const leftAges = (sv?.data?.history ?? []).filter((h) => h.eventId === 'middle-child-leaves').map((h) => h.age);
  // 자녀별 (나이, 상태) 열
  const byKid = {};
  for (const [heroAge, r] of Object.entries(rec)) for (const k of r.kids) {
    const m = k.who?.match(/^(.*?)\s+(\d+)세$/);
    if (!m) continue;
    (byKid[m[1]] ??= []).push({ hero: Number(heroAge), age: Number(m[2]), state: k.state });
  }
  const problems = [];
  for (const [name, seq] of Object.entries(byKid)) {
    seq.sort((x, y) => x.hero - y.hero);
    for (const s of seq) {
      if (s.state === 'apart' && s.age < 19) problems.push(`${name} ${s.age}세 따로 삶(19세 미만) @주인공 ${s.hero}`);
      if (s.state === 'with' && s.age >= 30) problems.push(`${name} ${s.age}세 함께(30세 이상 — leaveAge 최댓값) @주인공 ${s.hero}`);
    }
    let back = false; for (let i = 1; i < seq.length; i++) if (seq[i - 1].state === 'apart' && seq[i].state === 'with') back = true;
    if (back) problems.push(`${name} 따로→함께 되돌아감`);
  }
  const aloneWith = aloneAges.filter((a) => (rec[a] ?? rec[a + 1])?.kids.some((k) => k.state === 'with'));
  const summ = Object.entries(byKid).map(([n, s]) => { const first = s.find((x) => x.state === 'apart'); const lastWith = [...s].reverse().find((x) => x.state === 'with'); return `${n}: ${s[0]?.age}세~${s[s.length - 1]?.age}세 구간, 마지막 함께 ${lastWith ? lastWith.age + '세' : '-'} · 따로 삶 첫 관측 ${first ? first.age + '세(주인공 ' + first.hero + ')' : '없음'}`; });
  console.log(`\n=== ${key} (시작 ${st.data.age}세) 관측한 해 ${Object.keys(rec).length} | 자녀 ${Object.keys(byKid).length}명 | senior-alone ${JSON.stringify(aloneAges)} | 비어가는방 ${JSON.stringify(leftAges)} | errors ${errors.length}`);
  for (const s of summ) console.log('  ' + s);
  console.log(`  위반 ${problems.length}${problems.length ? ': ' + problems.join(' / ') : ''} | senior-alone 해에 함께 사는 자녀 ${aloneWith.length}`);
  bad += problems.length + aloneWith.length;
  await ctx.close();
}
await b.close();
console.log('\n총 위반', bad);
