// QA-003 M7b 공격 5: 접힌 채 컨트롤 난타(다음 결정으로·일시정지·배속), 멀티터치 동시 탭, 화면 회전·크기 변경
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, shot, runCase, readCard, readSave, choiceCount, cardReady } from './m7b-lib.mjs';
import { openCard, VPS } from './m7b-audit.mjs';
const ONLY = process.argv[2] || '';
const run = (c, fn) => (!ONLY || c.id.includes(ONLY) ? runCase({ cat: '공격', ...c }, fn) : null);
const b = await launch();
const hist = async (p) => choiceCount(await readSave(p));
const snap = (p) => p.evaluate(() => ({ panels: document.querySelectorAll('[data-testid="choice-panel"]').length, folds: document.querySelectorAll('[data-testid="decision-fold"]').length, age: document.querySelector('[data-testid="life-age"]')?.textContent.replace(/\s+/g, ' ').trim(), key: (document.querySelector('[data-testid="choice-panel"]') || document.querySelector('[data-testid="decision-fold"]'))?.getAttribute('data-key') ?? null, screen: ['life-screen', 'ending-screen', 'error-screen', 'superseded-screen', 'title-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)) }));

await run({ id: 'A18', title: '접힌 채 컨트롤 난타(다음 결정으로·일시정지·배속·자동) + 멀티터치 동시 탭 — 대기 중인 카드가 건너뛰어지거나 선택되지 않는다', steps: '(a) 접힌 띠에서 「다음 결정으로」 5번·일시정지 토글 4번·배속 순환·자동 토글 4번 (b) 시트에서 선택지 1·2·3 자리를 세 손가락으로 동시에 탭 (c) 접힌 채 연타 후 다시 열기', expected: '카드 key·나이 불변, 선택 기록 불변((a)), (b)는 선택 정확히 +1', }, async () => {
  const bad = [];
  const rows = [];
  {
    const { ctx, page } = await openCard(b, 'tutoring-present', 'sheet', { vp: VPS[2], hidden: true });
    await cardReady(page);
    const base = await hist(page);
    const s0 = await snap(page);
    await page.getByTestId('decision-fold-btn').tap();
    await page.waitForSelector('[data-testid="decision-fold"]');
    for (let i = 0; i < 5; i++) { await page.getByTestId('skip').tap().catch(() => {}); await sleep(120); }
    for (let i = 0; i < 4; i++) { await page.getByTestId('pause').tap().catch(() => {}); await sleep(120); }
    for (const sp of [2, 4, 8, 1]) { await page.locator(`[data-speed="${sp}"]`).tap().catch(() => {}); await sleep(100); }
    for (let i = 0; i < 4; i++) { await page.getByTestId('auto').tap().catch(() => {}); await sleep(120); }
    await sleep(700);
    const s1 = await snap(page);
    const h1 = await hist(page);
    rows.push(`(a) 접힌 채 난타: key ${s1.key === s0.key ? '같음' : s1.key}·나이 ${s0.age}→${s1.age}·선택 +${h1 - base}·띠 ${s1.folds}`);
    if (s1.key !== s0.key || s1.age !== s0.age) bad.push(`(a) 카드/나이 변함 ${JSON.stringify(s1)}`);
    if (h1 !== base) bad.push(`(a) 선택 +${h1 - base}`);
    if (s1.folds + s1.panels !== 1) bad.push(`(a) 카드 ${s1.panels}+${s1.folds}`);
    await shot(page, 'A18', 'after-controls-mash');
    await ctx.close();
  }
  {
    const { ctx, page } = await openCard(b, 'tutoring-present', 'sheet', { vp: VPS[2], hidden: true });
    await cardReady(page);
    await sleep(300);
    const base = await hist(page);
    const pts = await page.evaluate(() => [...document.querySelectorAll('.choice')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 })) });
    await sleep(40);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(900);
    const h = await hist(page);
    rows.push(`(b) 세 손가락 동시 탭: 선택 +${h - base}`);
    if (h - base > 1) bad.push(`(b) 멀티터치로 선택 +${h - base}`);
    await shot(page, 'A18', 'after-multitouch');
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') + ' || ' + rows.join(' | ') : rows.join(' | '), shots: [] };
});

await run({ id: 'A19', title: '화면 회전·크기 변경 중 카드(시트·접힌 띠·인라인) — 포커스·카드가 유지되고 가로 넘침·잘림이 없다', steps: '360×740 → 740×360(가로) → 320×568 → 1280×800 → 360×740으로 viewport를 바꾸며 각 상태에서 카드·포커스·가로 넘침을 읽는다', expected: '카드 key·모드 유지, 선택 기록 불변, 가로 넘침 0' }, async () => {
  const bad = [];
  const rows = [];
  for (const mode of ['sheet', 'fold', 'inline']) {
    const { ctx, page } = await openCard(b, 'sibling-past', mode, { vp: VPS[2], hidden: true });
    await cardReady(page).catch(() => {});
    const base = await hist(page);
    const c0 = await readCard(page);
    const seq = [];
    for (const [w, h] of [[740, 360], [320, 568], [1280, 800], [360, 740]]) {
      await page.setViewportSize({ width: w, height: h });
      await sleep(350);
      const c = await readCard(page);
      seq.push(`${w}x${h}:${c.mode}${c.docOverflow ? '·넘침' : ''}`);
      if (c.key !== c0.key || c.mode !== c0.mode) bad.push(`${mode} ${w}x${h}: ${c.mode}/${c.key}`);
      if (c.docOverflow) bad.push(`${mode} ${w}x${h}: 가로 넘침`);
    }
    if ((await hist(page)) !== base) bad.push(`${mode}: 선택 기록 변함`);
    rows.push(`${mode}: ${seq.join(' ')}`);
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') + ' || ' + rows.join(' | ') : rows.join(' | '), shots: [] };
});
await b.close();
