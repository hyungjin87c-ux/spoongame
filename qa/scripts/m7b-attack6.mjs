// QA-003 M7b 기록용 확인: A20 시트 뒤 문서 스크롤(overscroll chaining), A12b 이름의 RTL 제어 문자
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, mkctx, PROD, shot, runCase, readCard, cardReady, GAME_KEY, SETTINGS_KEY, settingsEnvelope, SET_MANUAL } from './m7b-lib.mjs';
import { openCard, VPS } from './m7b-audit.mjs';
const b = await launch();
await runCase({ id: 'A20', cat: '공격', title: '수동 시트 뒤 문서 스크롤: 시트 안에서 끝까지 쓸어 올린 뒤에도 계속 쓸면 시트 뒤 대시보드가 같이 스크롤되는가, 접은 뒤 띠가 화면에 보이는가', steps: '360×740 터치, 긴 카드 시트에서 실제 터치 드래그를 8번(시트 끝 이후 포함) → 문서 scrollY, 시트의 overscroll-behavior 계산값 → 접기 → 접힌 띠 위치', expected: '(권고) 시트 뒤 문서는 움직이지 않음(overscroll-behavior: contain 또는 스크롤 잠금), 접은 뒤 띠가 보임' }, async () => {
  const { ctx, page } = await openCard(b, 'sibling-past', 'sheet', { vp: VPS[2], hidden: true });
  await cardReady(page);
  const cdp = await ctx.newCDPSession(page);
  for (let i = 0; i < 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 620 }] });
    for (let k = 1; k <= 10; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y: 620 - k * 24 }] }); await sleep(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(250);
  }
  const m = await page.evaluate(() => { const s = document.querySelector('.sheet'); const o = document.querySelector('.overlay'); return { docY: Math.round(scrollY), sheetTop: Math.round(s.scrollTop), sheetMax: s.scrollHeight - s.clientHeight, obSheet: getComputedStyle(s).overscrollBehaviorY, obOverlay: getComputedStyle(o).overscrollBehaviorY, bodyOverflow: getComputedStyle(document.body).overflow, htmlOverflow: getComputedStyle(document.documentElement).overflow }; });
  const s1 = await shot(page, 'A20', 'sheet-after-swipes');
  // 접기 → 띠 위치
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid="decision-fold"]');
  await sleep(500);
  const f = await page.evaluate(() => { const r = document.querySelector('[data-testid="decision-fold"]').getBoundingClientRect(); const a = document.activeElement.getAttribute('data-testid'); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, docY: Math.round(scrollY), focus: a, inView: r.bottom > 0 && r.top < innerHeight }; });
  const s2 = await shot(page, 'A20', 'fold-after-swipes');
  await ctx.close();
  return { verdict: m.docY > 0 || !f.inView ? 'RECORD' : 'PASS', actual: `시트 끝(${m.sheetTop}/${m.sheetMax}) 이후에도 쓸자 시트 뒤 문서 scrollY ${m.docY}px(overscroll-behavior 시트 ${m.obSheet}·바탕 ${m.obOverlay}·body overflow ${m.bodyOverflow}). 접은 뒤 띠: 화면 y ${f.top}~${f.bottom}/${f.vh}, 보임 ${f.inView}, 포커스 ${f.focus}`, shots: [s1, s2] };
});
await runCase({ id: 'A12b', cat: '공격', title: '이름 변조(RTL 제어 문자 U+202E·제로폭·결합 문자)가 든 저장 — 영향 안내 줄 「…{이름}에게 생기는 변화입니다」의 글자 방향', steps: '카드가 대기 중인 저장의 character.name을 「김\u202E민\u200B준\u0301\u0301\u0301」로 바꿔 prod에서 연다', expected: '안내 줄이 읽을 수 있는 순서로 보임(제어 문자가 뒷문장 방향을 뒤집지 않음)' }, async () => {
  const st = JSON.parse(fs.readFileSync(path.join(OUT, 'states', 'tutoring-present.json'), 'utf8'));
  st.character.name = '김\u202E민\u200B준\u0301\u0301\u0301';
  const ctx = await mkctx(b, { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(([k, v, sk, sv]) => { try { if (!sessionStorage.getItem('__qa_seeded')) { localStorage.clear(); localStorage.setItem(k, v); localStorage.setItem(sk, sv); sessionStorage.setItem('__qa_seeded', '1'); } } catch {} window.__vis = 'hidden'; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis }); }, [GAME_KEY, JSON.stringify({ version: 8, data: st }), SETTINGS_KEY, settingsEnvelope(SET_MANUAL)]);
  const p = await ctx.newPage();
  await p.goto(PROD, { waitUntil: 'load' });
  await p.waitForSelector('[data-testid="choice-panel"]');
  await cardReady(p);
  await p.evaluate(() => document.querySelector('.decision__hint').scrollIntoView({ block: 'center' }));
  await sleep(300);
  const info = await p.evaluate(() => { const h = document.querySelector('.decision__hint'); const cs = getComputedStyle(h); return { text: h.textContent.slice(0, 80), direction: cs.direction, unicodeBidi: cs.unicodeBidi, name: document.querySelector('[data-testid="life-name"]')?.textContent, hasCtl: /\u202E/.test(h.textContent) }; });
  const s = await shot(p, 'A12b', 'rtl-name-hint');
  await ctx.close();
  return { verdict: info.hasCtl ? 'RECORD' : 'PASS', actual: `제어 문자가 화면 글자에 그대로 남음 ${info.hasCtl}(direction ${info.direction}, unicode-bidi ${info.unicodeBidi}) — 스크린샷에서 안내 줄의 뒷문장 방향 확인. 사람이 저장을 직접 고칠 때만 생기는 경로(이름은 게임이 만든 값)`, shots: [s] };
});
await b.close();
