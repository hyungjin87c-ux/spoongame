// QA-009-FM6-010 2회차: 「시대의 창」 칸을 눌러 `#log-y…` 줄로 이동할 때 알약이 떠 있으면 그 줄이 알약 아래에 맞는가 (REV-010-QAFIX-1 「QA에 넘길 것」 4)
//   QA_BASE=... node qa/scripts/010/pill-eralink.mjs <chromium|webkit> [1280x800x100,...]
// 알파 2016년생 재력 3, 49세(2065) 스냅숏에서 시작 → 기록을 아래로 읽다가 「다음 결정으로」로 줄이 쌓여 알약이 뜬 상태 → 창(#scene-era)을 누르고 줄의 위치를 잰다.
import { chromium, webkit, newPage, inject, settle, BASE } from './lib.mjs';
import { readFileSync } from 'node:fs';
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const name = process.argv[2] === 'webkit' ? 'webkit' : 'chromium';
const CASES = (process.argv[3] ?? '1280x800x100,1280x800x200,360x740x100,360x740x200,320x568x200').split(',').map((s) => s.split('x').map(Number));
const W = process.env.W ?? '3';
const AGE = Number(process.env.AGE ?? 49);

const READ = `(() => {
  const list = document.querySelector('[data-testid="log-list"]'); const lr = list.getBoundingClientRect();
  const pill = document.querySelector('[data-testid="log-jump"]'); const pr = pill ? pill.getBoundingClientRect() : null;
  const era = document.querySelector('#scene-era'); const href = era ? era.getAttribute('href') : null;
  const row = href ? document.querySelector(href) : null; const rr = row ? row.getBoundingClientRect() : null;
  const heads = []; for (const e of document.querySelectorAll('[data-testid="dash-head"], [data-testid="controls"]')) { const cs = getComputedStyle(e); if ((cs.position === 'fixed' || cs.position === 'sticky') && e.getBoundingClientRect().top <= 1) heads.push(e.getBoundingClientRect().bottom); }
  const a = document.activeElement;
  return { href, row: !!row, rowTop: rr ? Math.round(rr.top) : null, rowBottom: rr ? Math.round(rr.bottom) : null, listTop: Math.round(lr.top), listBottom: Math.round(lr.bottom), listScrollTop: Math.round(list.scrollTop), pill: !!pill, pillBottom: pr ? Math.round(pr.bottom) : null, pad: parseFloat(getComputedStyle(list).scrollPaddingTop), headBottom: heads.length ? Math.round(Math.max(...heads)) : 0, scrollY: Math.round(scrollY), active: a && a !== document.body ? (a.id || a.getAttribute('data-testid') || a.tagName) : null };
})()`;
const settleScroll = (page) => page.evaluate(() => new Promise((res) => { let last = ''; let same = 0; const tick = () => { const l = document.querySelector('[data-testid="log-list"]'); const k = scrollY + ':' + (l ? l.scrollTop : 0); if (k === last) same++; else { same = 0; last = k; } if (same >= 8) res(); else requestAnimationFrame(tick); }; tick(); }));

let bad = 0;
for (const [w, h, pct] of CASES) {
  const { browser, page, errors } = await newPage(engine, { width: w, height: h });
  const st = JSON.parse(readFileSync(`qa/scripts/010/states/snaps-W${W}.json`, 'utf8')).snaps[AGE];
  await inject(page, { ...st, paused: false }, { speed: 1, autoMode: false, noteCards: false }, '/');
  await page.getByTestId('life-screen').waitFor();
  await page.waitForSelector('#scene-era[href]', { timeout: 20000 }).catch(() => {});
  if (pct !== 100) await page.addStyleTag({ content: `html { font-size: ${pct}% !important; }` });
  await settle(page, 400);
  // 알약: 기록을 아래로 읽다가 줄이 쌓이게. 알약이 떴고 결정 시트가 닫혀 있을 때까지(시트가 열려 있으면 뒤가 inert라 창을 누를 수 없다)
  const sheetOpen = async () => (await page.getByTestId('choice-panel').count()) > 0;
  await page.getByTestId('log-list').evaluate((el) => el.scrollTo({ top: 220, behavior: 'instant' }));
  for (let i = 0; i < 80 && ((await page.getByTestId('log-jump').count()) === 0 || (await sheetOpen())); i++) {
    await page.evaluate(() => { const c = document.querySelector('[data-testid="choice-panel"] button[data-testid^="choice-"]'); const k = document.querySelector('[data-testid="skip"]'); (c ?? k)?.click(); });
    await page.waitForTimeout(350);
  }
  await page.getByTestId('pause').click().catch(() => {});
  await settleScroll(page);
  // 읽는 자리가 알약을 띄울 만큼 아래이도록 한 번 더 스크롤(진행이 줄을 위에 쌓아 알약이 떠 있다)
  const pre = await page.evaluate(READ);
  if (!pre.pill) { console.log(`${name} ${w}x${h}·${pct}%: 알약을 못 띄움 — 건너뜀 (${JSON.stringify(pre)})`); await browser.close(); continue; }
  if (!pre.row) { console.log(`${name} ${w}x${h}·${pct}%: 창의 줄(${pre.href})이 기록에 없음 — 건너뜀`); await browser.close(); continue; }
  await page.locator('#scene-era').scrollIntoViewIfNeeded();
  await settleScroll(page);
  const before = await page.evaluate(READ);
  // 합성 경로(창이 가리키는 줄이 맨 위가 아니라 더 아래 줄일 때): 알약이 뜬 채 시대 줄(4번째)을 영역 위로 지나쳐 놓고 창이 쓰는 scrollIntoView({block:'nearest'})를 그 줄에 건다 — 줄이 알약 아래에 맞는가
  const synth = await page.evaluate(async () => {
    const list = document.querySelector('[data-testid="log-list"]');
    const eras = [...list.querySelectorAll('li[id^="log-y"]')];
    const row = eras[3] ?? eras[eras.length - 1];
    if (!row) return { skip: 'no-row' };
    const lr = list.getBoundingClientRect();
    const rowContentY = row.getBoundingClientRect().top - lr.top + list.scrollTop;
    list.scrollTo({ top: rowContentY + row.getBoundingClientRect().height + 160, behavior: 'instant' }); // 줄이 영역 위로 완전히 지나가도록
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const pillBefore = document.querySelector('[data-testid="log-jump"]'); const rb = row.getBoundingClientRect();
    const was = { rowBottom: Math.round(rb.bottom), listTop: Math.round(lr.top), pill: !!pillBefore };
    row.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const pill = document.querySelector('[data-testid="log-jump"]'); const pr = pill ? pill.getBoundingClientRect() : null; const rr = row.getBoundingClientRect(); const l2 = list.getBoundingClientRect();
    return { id: row.id, was, rowH: Math.round(rr.height), listH: list.clientHeight, rowTop: Math.round(rr.top), listTop: Math.round(l2.top), pill: !!pill, pillBottom: pr ? Math.round(pr.bottom) : null, pad: parseFloat(getComputedStyle(list).scrollPaddingTop), scrollTop: Math.round(list.scrollTop) };
  });
  if (synth.skip) console.log(`${name} ${w}x${h}·${pct}% 합성: 시대 줄 없음`);
  else {
    const free = synth.listH - synth.pad - 12; // 알약 밑으로 남는 보이는 구간(영역 높이 − 위 여백 − 아래 여백)
    const tall = synth.rowH > free; // 줄이 보이는 구간보다 크면 nearest는 줄의 아랫변을 맞춘다 — 윗부분이 알약 밑에 남는 건 줄 크기 탓
    const ok = !synth.pill || synth.rowTop >= synth.pillBottom - 1;
    if (!ok && !tall) bad++;
    console.log(`${name} ${w}x${h}·${pct}% 합성(${synth.id}): 알약 ${synth.was.pill ? '있음' : '없음'} → 맞춘 뒤 줄 윗변 ${synth.rowTop} (영역 윗변 ${synth.listTop}, 알약 ${synth.pill ? '아랫변 ' + synth.pillBottom : '없음'}, 위 여백 ${synth.pad}, 줄 높이 ${synth.rowH} · 보이는 구간 ${free}) listTop ${synth.scrollTop}${ok ? '' : tall ? '  ▷ RECORD: 줄(' + synth.rowH + 'px)이 보이는 구간(' + free + 'px)보다 커서 아랫변에 맞춰짐' : '  ▶ FAIL: 줄이 알약에 가림'}`);
  }
  await page.evaluate(() => document.querySelector('[data-testid="log-list"]').scrollTo({ top: 400, behavior: 'instant' }));
  await page.locator('#scene-era').scrollIntoViewIfNeeded(); // 합성 단계의 scrollIntoView가 문서도 내렸다 — 창을 다시 화면으로
  await settleScroll(page);
  // 창을 누른다 — 사람이 하는 클릭(마우스)
  const box = await page.locator('#scene-era').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await settleScroll(page); await page.waitForTimeout(600); await settleScroll(page);
  const after = await page.evaluate(READ);
  const issues = [];
  if (after.row) {
    if (after.pill && after.pillBottom !== null && after.rowTop < after.pillBottom - 1) issues.push(`줄 윗변(${after.rowTop})이 알약 아랫변(${after.pillBottom})보다 위`);
    if (after.rowTop < after.headBottom - 1) issues.push(`줄 윗변이 고정 머리 아랫변(${after.headBottom}) 밑으로 숨음`);
    if (after.rowTop < after.listTop - 1 && !after.pill) issues.push(`알약이 없는데 줄이 영역 위로 벗어남`);
    if (after.rowBottom > after.listBottom + 1 && after.rowTop > after.listBottom) issues.push('줄이 영역 아래로 벗어남');
  }
  if (issues.length) bad++;
  console.log(`${name} ${w}x${h}·${pct}% (W${W} ${AGE}세): 누르기 전 줄 윗변 ${before.rowTop} 영역 윗변 ${before.listTop} listTop ${before.listScrollTop} 알약 ${before.pill}(아랫변 ${before.pillBottom}) → 누른 뒤 줄 윗변 ${after.rowTop} (영역 윗변 ${after.listTop}, 알약 ${after.pill ? '아랫변 ' + after.pillBottom : '없음'}, 위 여백 ${after.pad}, 머리 ${after.headBottom}) listTop ${after.listScrollTop} scrollY ${before.scrollY}→${after.scrollY} 포커스 ${after.active}${issues.length ? '  ▶ FAIL: ' + issues.join(' / ') : ''}`);
  if (errors.length) console.log('  errors:', errors.slice(0, 3));
  await browser.close();
}
console.log(bad ? `\n판정 문제 ${bad}건` : '\n판정 문제 0건');
