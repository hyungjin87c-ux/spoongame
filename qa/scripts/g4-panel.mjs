import { open, go, sleep, rec } from './g4-lib.mjs';
const SP = process.argv[2];
const { browser, page } = await open('d1280');
await go(page); await sleep(500);
await page.screenshot({ path: SP + '/title-1280x800.png' });
for (const [tid, name] of [['link-privacy', '개인정보 처리방침'], ['link-terms', '이용 안내'], ['link-intro', '소개'], ['link-news', '새 소식']]) {
  await page.click(`[data-testid="${tid}"]`); await sleep(700);
  const d = await page.evaluate((name) => {
    const dlg = document.querySelector('[role=dialog]'); const h = [...dlg.querySelectorAll('h2,h3')].find((e) => e.innerText.trim() === name);
    const dr = dlg.getBoundingClientRect(); const hr = h?.getBoundingClientRect();
    const sc = [...dlg.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 5 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY));
    return { dlgTop: Math.round(dr.top), dlgBottom: Math.round(dr.bottom), hTop: hr && Math.round(hr.top), hBottom: hr && Math.round(hr.bottom), scrollTop: sc && Math.round(sc.scrollTop), active: document.activeElement.tagName + ':' + (document.activeElement.innerText || '').slice(0, 30), expanded: h?.closest('details')?.open, hash: location.hash };
  }, name);
  const inView = d.hTop !== null && d.hTop >= d.dlgTop && d.hBottom <= d.dlgBottom;
  rec('F04b-' + name, `하단 「${name}」 클릭 후 해당 제목 위치`, '해당 구역이 창 안에 보이고 초점이 거기 있음', JSON.stringify(d), inView ? 'PASS' : 'FAIL');
  if (!inView) await page.screenshot({ path: SP + '/panel-' + tid + '.png' });
  await page.keyboard.press('Escape'); await sleep(500);
}
await browser.close();
