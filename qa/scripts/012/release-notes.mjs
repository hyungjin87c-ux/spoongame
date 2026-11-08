// QF7: 새 소식 패널 — v0.4.1이 맨 위, 요약 한 문장, 항목 수·길이, 버전 표기. 360·1280.
import { chromium, newPage, BASE } from './lib.mjs';
for (const [vp, label] of [[{ width: 1280, height: 800 }, 'PC'], [{ width: 360, height: 740 }, '360']]) {
  const { browser, page, errors } = await newPage(chromium, vp, { hasTouch: label === '360' });
  await page.goto(BASE + '/');
  await page.getByTestId('title-screen').waitFor({ state: 'visible' });
  await page.getByTestId('link-news').click();
  await page.getByTestId('info-panel').waitFor({ state: 'visible' });
  const r = await page.evaluate(() => {
    const vs = [...document.querySelectorAll('[data-testid=info-version]')];
    const v0 = vs[0];
    const items = [...v0.querySelectorAll('li')].map((li) => ({ kind: li.querySelector('.note-kind')?.textContent, text: li.textContent.replace(li.querySelector('.note-kind')?.textContent ?? '', '').trim() }));
    return { versions: vs.map((v) => v.dataset.version), open: vs.map((v) => v.open), head: v0.querySelector('summary')?.innerText.replace(/\s+/g, ' '), summary: v0.querySelector('.note-summary, p')?.textContent.trim(), items, footerVersion: document.body.innerText.match(/v?0\.\d+\.\d+/g), ox: document.documentElement.scrollWidth - document.documentElement.clientWidth, panelOx: (() => { const p = document.querySelector('[data-testid=info-panel]'); return p.scrollWidth - p.clientWidth; })() };
  });
  const sentences = (r.summary ?? '').split(/(?<=[.!?요다])\s+/).filter(Boolean).length;
  const bad = r.items.filter((i) => [...i.text].length > 70 || /SPEC-|R-\d|QF\d|DS\d|M\d|[0-9a-f]{7,}/.test(i.text));
  console.log(`QF7 ${label} | ${r.versions[0] === '0.4.1' && r.items.length <= 8 && bad.length === 0 && errors.length === 0 && r.panelOx <= 0 ? 'PASS' : 'FAIL'} | 버전 ${r.versions.join(',')} 펼침 ${r.open.join(',')} 머리 "${r.head}" 요약 "${r.summary}"(${[...(r.summary ?? '')].length}자) 항목 ${r.items.length}개 길이 ${r.items.map((i) => [...i.text].length).join(',')} 긴·내부식별자 ${bad.length} 푸터 버전 ${JSON.stringify(r.footerVersion)} 넘침 ${r.ox}/${r.panelOx} 오류 ${errors.length}`);
  if (label === 'PC') console.log(r.items.map((i) => `  [${i.kind}] ${i.text}`).join('\n'));
  await browser.close();
}
