// QF4: 인생 기록 결정 줄 「제목 → 고른 길 → 결과」 — v0.4.0·v0.3.0 옛 저장 + 가린 줄 + 글자 200% + 다크
import { chromium, newPage, inject, SHOT } from './lib.mjs';
import { readFileSync } from 'node:fs';
const FX = ['save-v040-both-age20', 'save-v040-mother-age20', 'save-v030-age20', 'save-v030-age65'];
const rows = [];
const rec = (id, verdict, note) => { rows.push(`${id} | ${verdict} | ${note}`); console.log(`${id} | ${verdict} | ${note}`); };

const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

async function analyse(page) {
  return page.evaluate(() => {
    const out = { stacked: 0, plainChoice: 0, bad: [], samples: [] };
    for (const li of document.querySelectorAll('[data-testid=log-row]')) {
      const q = li.querySelector('[data-testid=log-q]');
      const choice = li.querySelector('em');
      const veiled = li.dataset.veiled === 'true';
      if (!q) { if (choice && !li.matches('[data-kind=note]')) out.plainChoice++; continue; }
      if (veiled && li.querySelector('[hidden]') && getComputedStyle(q).display === 'none') continue; // 접힌 가린 줄
      const res = li.querySelector('.log__result');
      const rq = q.getBoundingClientRect(), rc = choice.getBoundingClientRect(), rr = res.getBoundingClientRect();
      out.stacked++;
      const orderOk = rq.bottom <= rc.top + 1 && rc.bottom <= rr.top + 1;
      if (!orderOk) out.bad.push({ age: li.querySelector('.log__age')?.textContent, q: q.textContent, choice: choice.textContent.slice(0, 20), qb: rq.bottom, ct: rc.top, cb: rc.bottom, rt: rr.top, veiled });
      const qs = getComputedStyle(q), rs = getComputedStyle(res);
      if (out.samples.length < 1) out.samples.push({ q: q.textContent, choice: choice.textContent, result: res.textContent.slice(0, 30), qSize: qs.fontSize, rSize: rs.fontSize, qColor: qs.color, bg: getComputedStyle(document.body).backgroundColor, qWeight: qs.fontWeight });
    }
    out.overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    out.veiledRows = document.querySelectorAll('[data-testid=log-row][data-veiled=true]').length;
    return out;
  });
}

for (const fx of FX) {
  const raw = JSON.parse(readFileSync(`tests/fixtures/${fx}.json`, 'utf8')).data;
  for (const [vp, label] of [[{ width: 1280, height: 800 }, 'PC'], [{ width: 360, height: 740 }, '360']]) {
    for (const scheme of label === 'PC' ? ['light', 'dark'] : ['light']) {
      const { browser, page, errors } = await newPage(chromium, vp, { hasTouch: label === '360', colorScheme: scheme });
      const st = { ...raw, paused: true }; delete st.play;
      await inject(page, st, { speed: 1, autoMode: false, noteCards: false, theme: scheme });
      await page.getByTestId('life-screen').waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
      const withTitle = raw.history.filter((h) => h.kind === 'choice' && h.title).length;
      const noTitle = raw.history.filter((h) => h.kind === 'choice' && !h.title).length;
      const a = await analyse(page);
      let cr = '';
      if (a.samples[0]) cr = ` 제목 ${a.samples[0].qSize}/${a.samples[0].qWeight} 본문 ${a.samples[0].rSize} 대비 ${ratio(a.samples[0].qColor, a.samples[0].bg).toFixed(2)}`;
      rec(`QF4 ${fx} ${label}/${scheme}`, a.stacked === withTitle && a.plainChoice === noTitle && a.bad.length === 0 && a.overflowX <= 0 && errors.length === 0 && (!a.samples[0] || ratio(a.samples[0].qColor, a.samples[0].bg) >= 4.5) ? 'PASS' : 'FAIL', `저장된 제목 있는 결정 ${withTitle} / 쌓인 줄 ${a.stacked}, 제목 없는 결정 ${noTitle} / 괄호 줄 ${a.plainChoice}, 순서 어긋남 ${a.bad.length}${a.bad.length ? JSON.stringify(a.bad[0]) : ''}, 넘침 ${a.overflowX}, 오류 ${errors.length},${cr}`);
      await browser.close();
    }
  }
}

// 가린 줄: 접힘 → 펼침 (제목 포함)
for (const [vp, label] of [[{ width: 1280, height: 800 }, 'PC'], [{ width: 360, height: 740 }, '360']]) {
  const raw = JSON.parse(readFileSync('tests/fixtures/save-v040-both-age20.json', 'utf8')).data;
  const { browser, page, errors } = await newPage(chromium, vp, { hasTouch: label === '360' });
  const st = { ...raw, paused: true }; delete st.play;
  await inject(page, st, { speed: 1, autoMode: false, noteCards: false, gentle: true });
  await page.getByTestId('life-screen').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  const veil = await page.evaluate(() => [...document.querySelectorAll('[data-testid=log-row][data-veiled=true]')].map((li) => ({ age: li.querySelector('.log__age')?.textContent, visibleText: li.innerText.replace(/\s+/g, ' ').slice(0, 120), qVisible: (() => { const q = li.querySelector('[data-testid=log-q]'); if (!q) return null; const r = q.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(q).visibility !== 'hidden'; })() })));
  const withQ = veil.filter((v) => v.qVisible !== null);
  const leaked = withQ.filter((v) => v.qVisible === true);
  // 첫 가린 줄 펼치기
  const btn = page.locator('[data-testid=log-row][data-veiled=true]').filter({ has: page.locator('[data-testid=log-q]') }).first().getByRole('button');
  const nBtn = await btn.count();
  let expanded = null;
  if (nBtn > 0) {
    await btn.first().scrollIntoViewIfNeeded();
    await btn.first().click();
    await page.waitForTimeout(300);
    expanded = await analyse(page);
    const detail = await page.evaluate(() => {
      const li = [...document.querySelectorAll('[data-testid=log-row][data-veiled=true]')].find((l) => l.querySelector('[data-testid=log-q]') && getComputedStyle(l.querySelector('[data-testid=log-q]')).display !== 'none' && l.querySelector('[data-testid=log-q]').getBoundingClientRect().height > 0);
      if (!li) return null;
      const q = li.querySelector('[data-testid=log-q]'); const em = li.querySelector('em'); const res = li.querySelector('.log__result');
      const f = (e) => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), disp: getComputedStyle(e).display }; };
      return { q: f(q), em: f(em), res: f(res), text: li.innerText.replace(/\s+/g, ' ').slice(0, 160) };
    });
    // 펼침 위치 측정은 log-question2.mjs(보이는 em 기준)가 한다 — 여기서는 첫 em이 가린 줄의 도장이라 어긋난다
  }
  rec(`QF4 가린 줄 접힘 ${label}`, leaked.length === 0 && withQ.length > 0 ? 'PASS' : 'FAIL', `가린 줄 ${veil.length}(제목 있는 ${withQ.length}), 제목이 보이는 줄 ${leaked.length}, 첫 줄 보이는 글 "${veil[0]?.visibleText}", 오류 ${errors.length}`);
  await browser.close();
}

// 글자 200% / 360 / 가로 넘침
{
  const raw = JSON.parse(readFileSync('tests/fixtures/save-v040-both-age20.json', 'utf8')).data;
  for (const pct of [200, 150]) {
    const { browser, page, errors } = await newPage(chromium, { width: 360, height: 740 }, { hasTouch: true });
    const st = { ...raw, paused: true }; delete st.play;
    await inject(page, st, { speed: 1, autoMode: false, noteCards: false });
    await page.getByTestId('life-screen').waitFor({ state: 'visible' });
    await page.evaluate((p) => { document.documentElement.style.fontSize = p + '%'; }, pct);
    await page.waitForTimeout(500);
    const a = await analyse(page);
    const clipped = await page.evaluate(() => [...document.querySelectorAll('[data-testid=log-row] *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 0.5; }).length);
    rec(`QF4 360 글자 ${pct}%`, a.bad.length === 0 && a.overflowX <= 0 && clipped === 0 && errors.length === 0 ? 'PASS' : 'FAIL', `쌓인 줄 ${a.stacked}, 순서 어긋남 ${a.bad.length}, 가로 넘침 ${a.overflowX}, 오른쪽 밖 요소 ${clipped}, 오류 ${errors.length}`);
    await browser.close();
  }
}
