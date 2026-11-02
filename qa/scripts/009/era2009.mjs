import { runLife, summarize } from './trace.mjs';
const combos = [];
for (const w of [1, 2, 3, 4, 5]) for (const g of [false, true]) combos.push({ w, g });
for (const { w, g } of combos) {
  const r = await runLife({ generation: 'genz', wealth: w, birthYear: 2004, region: '서울', seed: 5100 + w, gentle: g, scale: 8, stopYear: 2010 });
  const y = summarize(r.trace).find((x) => x.yr === '2009년');
  const veiled = await r.page.evaluate(() => { const row = document.querySelector('#log-y2009'); return row ? { veiled: row.getAttribute('data-veiled'), txt: row.textContent.slice(0, 70) } : null; });
  console.log(`재력${w} gentle=${g} |`, y ? `${y.kind} ${y.era} hid=${y.hid}` : '2009 없음', '|', JSON.stringify(veiled), '| errors', r.errors.length);
  await r.browser.close();
}
