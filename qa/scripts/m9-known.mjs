// QA-003 M9: REV-003-M9-2 2절 「알려진 2차 후보」가 이번 빌드에서도 보이는지 측정해 RECORD(이월)로 적는다(FAIL로 세지 않음).
//  K-A 1280×800 첫 화면에서 「인생 길이」 카드가 하단 띠에 가림 (1920×1080에서는 어떤지도 같이)
//  K-B 헤더 진행 막대 라벨: 「올해 진행」인데 나이 칩 옆이라 인생 진행률로 읽힐 수 있음 (나이 50세 화면의 퍼센트)
//  K-C 360×740 대시보드 하단 조작 띠가 화면에서 차지하는 비율(약 15%)
// 사용: node qa/scripts/m9-known.mjs
import { launch, openOracle, plainLife, openSeeded, mkctx, cleanStorageOnce, sleep, shot, runCase, readCard, SET_MANUAL, PROD } from './m7c-lib.mjs';

const browser = await launch();
const { page: oracle } = await openOracle(browser);

await runCase({ id: 'KNOWN-title-life-length-hidden', cat: '2차 후보 이월', title: '1280×800 첫 화면 「인생 길이」 카드가 하단 띠(태어나기)에 반쯤 가려 스크롤해야 보인다 (REV-003-M9-2 2절, SPEC-005 「인생 길이 작게」)', steps: '새 저장소로 첫 화면을 열고 인생 길이 카드의 위치와 하단 띠의 위치를 견줌(1280×800·1920×1080·1280×720)' }, async () => {
  const lines = [];
  let hidden = false;
  let shotPath = null;
  for (const [w, h] of [[1280, 800], [1920, 1080], [1280, 720]]) {
    const ctx = await mkctx(browser, { viewport: { width: w, height: h } });
    await cleanStorageOnce(ctx);
    const p = await ctx.newPage();
    await p.goto(PROD, { waitUntil: 'load' });
    await p.waitForSelector('[data-testid="title-screen"]');
    await sleep(500);
    const m = await p.evaluate(() => {
      const g = document.querySelector('[data-testid="life-length-group"]').getBoundingClientRect();
      const bar = document.querySelector('[data-testid="bottom-bar"]');
      const b = bar ? bar.getBoundingClientRect() : null;
      return { top: Math.round(g.top), bottom: Math.round(g.bottom), barTop: b ? Math.round(b.top) : null, vh: window.innerHeight };
    });
    const covered = m.barTop !== null && m.bottom > m.barTop + 1;
    lines.push(`${w}×${h}: 카드 ${m.top}~${m.bottom}, 띠 위끝 ${m.barTop} → ${covered ? (m.top >= m.barTop ? '완전히 가림' : '일부 가림') : '다 보임'}`);
    if (covered && w === 1280 && h === 800) { hidden = true; shotPath = await shot(p, 'KNOWN-title-life-length-hidden', '1280x800'); }
    await ctx.close();
  }
  return { verdict: hidden ? 'RECORD' : 'PASS', actual: lines.join(' / ') + (hidden ? ' — 알려진 2차 후보(첫 화면 위계), 스크롤하면 닿음' : ''), shots: shotPath ? [shotPath] : [] };
});

await runCase({ id: 'KNOWN-year-bar-label', cat: '2차 후보 이월', title: '헤더 진행 막대는 「올해 진행」인데 나이 칩 옆에 있어 인생 진행률로 오해할 수 있다 (REV-003-M9-2 2절 새 후보 2)', steps: '50세 성인 판의 대시보드 머리를 열어 막대의 이름(aria-label)과 눈에 보이는 글자·퍼센트를 읽음' }, async () => {
  const st = await plainLife(oracle, { era: 'present', seed: 4242, age: 50, paused: true });
  const { ctx, page } = await openSeeded(browser, st, { vp: { width: 1280, height: 800 }, touch: false, settings: SET_MANUAL });
  await sleep(400);
  const r = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="year-progress"]');
    const head = document.querySelector('[data-testid="dash-head"]') || document.querySelector('header');
    return { aria: bar ? bar.getAttribute('aria-label') : null, now: bar ? bar.getAttribute('aria-valuenow') : null, year: (document.querySelector('[data-testid="life-year"]') || {}).textContent, pct: (document.querySelector('[data-testid="year-pct"]') || {}).textContent, age: (document.querySelector('[data-testid="life-age"]') || {}).textContent, headText: head ? head.innerText.replace(/\s+/g, ' ').slice(0, 120) : null };
  });
  const s = await shot(page, 'KNOWN-year-bar-label');
  await ctx.close();
  return { verdict: 'RECORD', actual: `막대 이름 「${r.aria}」, 보이는 글자: 연도 「${(r.year || '').trim()}」·퍼센트 「${(r.pct || '').trim()}」·나이 「${(r.age || '').replace(/\s+/g, ' ').trim()}」 — 나이 칩 옆의 막대가 올해 진행(${r.now}%)임을 보이는 라벨은 연도 글자뿐 — 알려진 2차 후보(디자인 판단)`, shots: [s] };
});

await runCase({ id: 'KNOWN-m360-bar-height', cat: '2차 후보 이월', title: '360×740 대시보드 하단 조작 띠가 화면에서 차지하는 비율(알려진 값 약 15%) (REV-003-M9-2 2절)', steps: '360×740 터치 대시보드에서 하단 고정 띠의 높이 ÷ 뷰포트 높이' }, async () => {
  const st = await plainLife(oracle, { era: 'present', seed: 4242, age: 30, paused: true });
  const { ctx, page } = await openSeeded(browser, st, { vp: { width: 360, height: 740 }, touch: true, settings: SET_MANUAL });
  await sleep(400);
  const m = await page.evaluate(() => { const b = document.querySelector('[data-testid="controls"]') || document.querySelector('[data-testid="bottom-bar"]'); const r = b.getBoundingClientRect(); return { h: Math.round(r.height), pos: getComputedStyle(b).position, vh: window.innerHeight }; });
  const ratio = m.h / m.vh;
  const s = ratio >= 0.12 ? await shot(page, 'KNOWN-m360-bar-height') : null;
  await ctx.close();
  return { verdict: ratio >= 0.12 ? 'RECORD' : 'PASS', actual: `하단 띠 ${m.h}px ÷ ${m.vh}px = ${(ratio * 100).toFixed(1)}% (${m.pos})${ratio >= 0.12 ? ' — 알려진 2차 후보(조작 영역이 큼)' : ''}`, shots: s ? [s] : [] };
});

await browser.close();
