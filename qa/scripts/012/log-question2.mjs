// QF4 보충: 가린 줄 펼침 위치(보이는 em), 제목 없는 옛 줄(괄호 모양), 제목·고른 길 변조(특수문자·초장문·이모지·자모)
import { chromium, newPage, inject, SHOT } from './lib.mjs';
import { readFileSync } from 'node:fs';
const raw = JSON.parse(readFileSync('tests/fixtures/save-v040-both-age20.json', 'utf8')).data;
const rec = (id, verdict, note) => console.log(`${id} | ${verdict} | ${note}`);

// 1) 가린 줄 펼침: 보이는 em 기준
for (const [vp, label] of [[{ width: 1280, height: 800 }, 'PC'], [{ width: 360, height: 740 }, '360']]) {
  const { browser, page, errors } = await newPage(chromium, vp, { hasTouch: label === '360' });
  const st = { ...raw, paused: true }; delete st.play;
  await inject(page, st, { speed: 1, autoMode: false, noteCards: false, gentle: true });
  await page.getByTestId('life-screen').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  const rows = page.locator('[data-testid=log-row][data-veiled=true]').filter({ has: page.locator('[data-testid=log-q]') });
  const n = await rows.count();
  const res = [];
  for (let i = 0; i < n; i++) {
    const row = rows.nth(i);
    await row.scrollIntoViewIfNeeded();
    await row.getByRole('button').first().click();
    await page.waitForTimeout(200);
    const d = await row.evaluate((li) => {
      const f = (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height }; };
      const q = li.querySelector('[data-testid=log-q]');
      const ems = [...li.querySelectorAll('em')].filter((e) => e.getBoundingClientRect().height > 0 && !e.closest('.veil__lead') && e.dataset.testid !== 'veil-by');
      const resEl = li.querySelector('.log__result');
      return { q: f(q), em: ems.length ? f(ems[ems.length - 1]) : null, res: f(resEl), emText: ems.map((e) => e.textContent.trim().slice(0, 30)) };
    });
    const ok = d.em && d.q.bottom <= d.em.top + 1 && d.em.bottom <= d.res.top + 1;
    res.push(ok);
    // 다시 접기
    await row.getByRole('button').first().click();
    await page.waitForTimeout(150);
    const hiddenAgain = await row.evaluate((li) => { const q = li.querySelector('[data-testid=log-q]'); return q.getBoundingClientRect().height === 0 || getComputedStyle(q).display === 'none' || !!q.closest('[hidden]'); });
    res.push(hiddenAgain);
  }
  rec(`QF4 가린 줄 펼침·접기 ${label}`, res.length > 0 && res.every(Boolean) && errors.length === 0 ? 'PASS' : 'FAIL', `가린 결정 줄 ${n}개, 펼침 순서 맞고 다시 접힘 ${JSON.stringify(res)}, 오류 ${errors.length}`);
  await browser.close();
}

// 2) 제목 없는 옛 줄
{
  const { browser, page, errors } = await newPage(chromium, { width: 1280, height: 800 });
  const st = { ...raw, paused: true, history: raw.history.map((h, i) => (h.kind === 'choice' && i % 2 === 0 ? (({ title, ...r }) => r)(h) : h)) }; delete st.play;
  const nNo = st.history.filter((h) => h.kind === 'choice' && !h.title).length;
  const nYes = st.history.filter((h) => h.kind === 'choice' && h.title).length;
  await inject(page, st, { speed: 1, autoMode: false, noteCards: false });
  await page.getByTestId('life-screen').waitFor({ state: 'visible' });
  const r = await page.evaluate(() => ({ q: document.querySelectorAll('[data-testid=log-q]').length, paren: [...document.querySelectorAll('[data-testid=log-row] em')].filter((e) => /^\(.*\)$/.test(e.textContent.trim().replace(/^\S*\s*/, '')) || /^\(/.test(e.textContent.trim())).length, sample: [...document.querySelectorAll('[data-testid=log-row]')].map((l) => l.innerText.replace(/\s+/g, ' ')).filter((t) => /선택|정했|흘러/.test(t)).slice(0, 3) }));
  rec('QF4 제목 없는 결정 줄', r.q === nYes && errors.length === 0 ? 'PASS' : 'FAIL', `제목 있는 ${nYes} → 제목 줄 ${r.q}, 제목 없는 ${nNo}, 괄호 모양 em ${r.paren}, 예: ${JSON.stringify(r.sample[0])}`);
  await browser.close();
}

// 3) 변조: 제목·고른 길에 특수문자·초장문
const NASTY = ['<script>window.__x=1</script><img src=x onerror=window.__x=1>', "'\"; DROP TABLE--", '😀👨‍👩‍👧'.repeat(30), 'ㄱㅏㄴㅏㄷㅏ'.repeat(40), '가'.repeat(3000), ' ', '\n\n', 'a'.repeat(300) + ' ' + 'b'.repeat(300)];
for (const [i, nasty] of NASTY.entries()) {
  const { browser, page, errors } = await newPage(chromium, { width: 360, height: 740 }, { hasTouch: true });
  const hist = raw.history.map((h) => (h.kind === 'choice' ? { ...h, title: nasty, choice: nasty.slice(0, 80) } : h));
  const st = { ...raw, paused: true, history: hist }; delete st.play;
  await inject(page, st, { speed: 1, autoMode: false, noteCards: false });
  await page.getByTestId('life-screen').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => ({ screen: document.querySelector('[data-testid$="-screen"]')?.dataset.testid, x: window.__x ?? null, ox: document.documentElement.scrollWidth - document.documentElement.clientWidth, scripts: document.querySelectorAll('[data-testid=log] script, [data-testid=log] img').length, q: document.querySelectorAll('[data-testid=log-q]').length, logOver: (() => { const l = document.querySelector('[data-testid=log]'); return l ? l.scrollWidth - l.clientWidth : null; })() }));
  const ok = r.x === null && r.scripts === 0 && r.ox <= 0 && (r.logOver ?? 0) <= 0 && errors.length === 0;
  rec(`QF4 변조 제목 #${i} (${nasty.slice(0, 18).replace(/\n/g, '\\n')}…${nasty.length}자)`, ok ? 'PASS' : 'FAIL', `화면 ${r.screen}, 쌓인 줄 ${r.q}, XSS ${r.x}, 태그 주입 ${r.scripts}, 문서 넘침 ${r.ox}, 기록 영역 넘침 ${r.logOver}, 오류 ${errors.length} ${errors.slice(0, 1)}`);
  if (!ok && i === 4) await page.screenshot({ path: `${SHOT}/QF4-attack-${i}.png` });
  await browser.close();
}
