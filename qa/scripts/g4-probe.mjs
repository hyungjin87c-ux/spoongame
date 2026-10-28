import { open, go, sleep } from './g4-lib.mjs';
const { browser, page, logs } = await open('d1280');
await go(page);
await sleep(600);
const info = await page.evaluate(() => {
  const t = (s) => document.querySelector(s)?.innerText;
  return {
    head: document.querySelector('header,.title-head,[data-testid="title-heading"]')?.parentElement?.innerText?.slice(0, 600),
    rows: [...document.querySelectorAll('[data-testid^="gen-row-"]')].map((e) => e.innerText.replace(/\n/g, ' | ')),
    checked: [...document.querySelectorAll('[role=radio][aria-checked=true],input[type=radio]:checked')].map((e) => e.getAttribute('data-testid') || e.value),
    carousel: t('[data-testid="carousel"]')?.slice(0, 500),
    count: t('[data-testid="carousel-count"]'),
    foot: document.querySelector('footer')?.innerText,
    bodyW: document.documentElement.scrollWidth, vw: innerWidth,
  };
});
console.log(JSON.stringify(info, null, 1));
console.log(logs);
await browser.close();
