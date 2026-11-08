// QF5 조작 영역 안 B 실측 + 배속 한 단추 동작·접근성 + Tab 순서 (고정 저장 v0.4.0 both-age20, 일시정지 상태)
import { chromium, webkit, newPage, inject, SETTINGS_KEY } from './lib.mjs';
const ENG = process.env.QA_ENGINE === 'webkit' ? webkit : chromium;
import { readFileSync } from 'node:fs';
const raw = JSON.parse(readFileSync('tests/fixtures/save-v040-both-age20.json', 'utf8')).data;
const base = { ...raw, paused: true };
delete base.play;
const results = {};
const rec = (k, v) => { results[k] = v; };

async function measure(page) {
  return page.evaluate(() => {
    const bar = document.querySelector('[data-testid=controls]');
    const tools = document.querySelector('[data-testid=tools]');
    const rect = (b) => {
      const r = b.getBoundingClientRect();
      const bf = getComputedStyle(b, '::before');
      const bw = parseFloat(getComputedStyle(b).borderTopWidth);
      return { id: b.dataset.testid, h: +r.height.toFixed(1), w: +r.width.toFixed(1), top: +r.top.toFixed(1), left: r.left, right: r.right, reach: bf.content === 'none' ? 0 : +(-parseFloat(bf.top) - bw).toFixed(1), reachB: bf.content === 'none' ? 0 : +(-parseFloat(bf.bottom) - bw).toFixed(1) };
    };
    const br = bar.getBoundingClientRect();
    const tr = tools.getBoundingClientRect();
    return {
      vw: innerWidth, vh: innerHeight, barH: +br.height.toFixed(1), barPos: getComputedStyle(bar).position, barBottomGap: +(innerHeight - br.bottom).toFixed(1), ratio: +(br.height / innerHeight).toFixed(3), toolsH: +tr.height.toFixed(1),
      progress: [...bar.querySelectorAll('button')].map(rect), toolBtns: [...tools.querySelectorAll('button,a')].map(rect),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      offenders: [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 0.5 && !e.closest('.sr-only') && getComputedStyle(e).visibility !== 'hidden'; }).slice(0, 5).map((e) => e.tagName + '.' + e.className),
      labels: [...bar.querySelectorAll('button')].map((b) => ({ id: b.dataset.testid, txt: b.innerText.trim().replace(/\s+/g, ' '), aria: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed'), disabled: b.getAttribute('aria-disabled') })),
    };
  });
}
const sum = (m) => `bar ${m.barH}px(${(m.ratio * 100).toFixed(1)}%, ${m.barPos}, 바닥간격 ${m.barBottomGap}) tools ${m.toolsH}px 버튼높이[${m.progress.map((b) => b.h)}] 폭[${m.progress.map((b) => b.w)}] reach[${m.progress.map((b) => b.reach + '/' + b.reachB)}] 도구[${m.toolBtns.map((b) => b.h)}] overflowX ${m.overflowX} offenders ${m.offenders.length} ${m.offenders.join(',')}`;

async function run(name, vp, { hasTouch = true, pct = 100, scheme = 'light', settings = {}, state = base } = {}) {
  const { browser, ctx, page, errors } = await newPage(ENG, vp, { hasTouch, colorScheme: scheme });
  await inject(page, state, { speed: 1, autoMode: false, noteCards: false, ...settings });
  await page.getByTestId('life-screen').waitFor({ state: 'visible' });
  if (pct !== 100) await page.evaluate((p) => { document.documentElement.style.fontSize = p + '%'; }, pct);
  await page.waitForTimeout(600);
  const m = await measure(page);
  rec(name, sum(m));
  return { browser, ctx, page, errors, m };
}

// 1) 360x740 터치 100%
{
  const { browser, page, errors, m } = await run('360x740 터치 100%', { width: 360, height: 740 });
  rec('  라벨 360', JSON.stringify(m.labels));
  rec('  도구 이름', await page.evaluate(() => [...document.querySelectorAll('[data-testid=tools] button, [data-testid=tools] a')].map((b) => b.innerText.trim() + '|' + b.getAttribute('aria-label') + '|' + getComputedStyle(b).whiteSpace)));
  await page.waitForTimeout(600);
  const seq = [];
  for (let i = 0; i < 5; i++) {
    const s = await page.evaluate(() => {
      const b = document.querySelector('[data-testid=speed]');
      return { speed: b.dataset.speed, txt: b.innerText.trim(), aria: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed'), status: document.querySelector('[data-testid=speed-status]')?.textContent, role: document.querySelector('[data-testid=speed-status]')?.getAttribute('role') };
    });
    seq.push(s);
    await page.getByTestId('speed').tap();
    await page.waitForTimeout(250);
  }
  rec('배속 순환', seq.map((s) => `${s.speed}|${s.txt}|${s.aria}|${s.status}|${s.role}|pressed=${s.pressed}`));
  rec('배속 설정 저장', await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).data.speed, SETTINGS_KEY));
  const p1 = await page.evaluate(() => {
    const b = document.querySelector('[data-testid=pause]');
    return { txt: b.innerText.trim(), aria: b.getAttribute('aria-label'), paused: b.dataset.paused, html: b.innerHTML.slice(0, 200) };
  });
  rec('일시정지(진입 시)', JSON.stringify(p1));
  await page.evaluate(() => document.activeElement?.blur());
  await page.getByTestId('life-name').focus().catch(() => {});
  const stops = [];
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    stops.push(await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName));
  }
  rec('Tab 30회 정지점', stops.join(' > '));
  rec('console errors 360', JSON.stringify(errors));
  await browser.close();
}
for (const [n, vp, pct] of [['360x740 200%', { width: 360, height: 740 }, 200], ['320x568 100%', { width: 320, height: 568 }, 100], ['320x568 200%', { width: 320, height: 568 }, 200], ['360x640 100%', { width: 360, height: 640 }, 100], ['360x740 150%', { width: 360, height: 740 }, 150]]) {
  const { browser } = await run(n, vp, { pct });
  await browser.close();
}
{
  const { browser, page } = await run('360 다크', { width: 360, height: 740 }, { scheme: 'dark' });
  rec('  다크 배경/글자', await page.evaluate(() => { const b = document.querySelector('[data-testid=speed]'); const c = getComputedStyle(b); return `${c.backgroundColor} / ${c.color} / border ${c.borderColor}`; }));
  await browser.close();
}
{
  const { browser, page } = await run('360 자동모드 켜짐', { width: 360, height: 740 }, { settings: { autoMode: true } });
  rec('  자동 라벨', await page.evaluate(() => { const b = document.querySelector('[data-testid=auto]'); return `txt=${b.innerText.trim().replace(/\s+/g, ' ')} aria-pressed=${b.getAttribute('aria-pressed')} aria=${b.getAttribute('aria-label')}`; }));
  await browser.close();
}
{
  const { browser, m } = await run('PC 1280x800', { width: 1280, height: 800 }, { hasTouch: false });
  rec('  PC 라벨', JSON.stringify(m.labels));
  await browser.close();
}
{ const { browser } = await run('가로 740x360 터치', { width: 740, height: 360 }); await browser.close(); }
{ const { browser } = await run('1024x768 터치', { width: 1024, height: 768 }); await browser.close(); }
for (const [k, v] of Object.entries(results)) console.log(k.padEnd(22), typeof v === 'string' ? v : JSON.stringify(v));
