// QA-003 M7b 정상 플레이: prod 빌드에서 360x740 터치(탭)로 0세~사망까지 한 판. 카드마다 읽고 스크린샷, 중간에 자동 모드 구간(접기 → 자동 켜기 → 다시 열기 → 인라인 카드 → 자동 선택 → 자동 끄기).
// 사용: node qa/scripts/m7b-play.mjs <era> <seed> <caseId> [speed=8] [pick=rot]
// 결과: qa/results/m7b/play-<caseId>.json, 스크린샷 qa/screenshots/003/M7b-<caseId>-c<nn>-<카드>.png
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, newGameToLife, waitGuard, readCard, shot, sleep, OUT, PROD, TOUCH, con } from './m7b-lib.mjs';

const era = process.argv[2] || 'past';
const seed = Number(process.argv[3] || 11);
const caseId = process.argv[4] || `N-${era}`;
const speed = process.argv[5] || '8';
const pick = process.argv[6] || 'rot';
const MAX_SHOTS = 30;

const b = await launch();
const ctx = await mkctx(b, { viewport: { width: 360, height: 740 }, ...TOUCH });
await cleanStorageOnce(ctx);
await fixSeed(ctx, seed);
const p = await ctx.newPage();
const ext = [];
const errs = [];
p.on('request', (r) => {
  try {
    const h = new URL(r.url()).hostname;
    if (!/^(data:|blob:|about:)/.test(r.url()) && h !== '127.0.0.1' && h !== 'localhost') ext.push(r.url().slice(0, 100));
  } catch {}
});
p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));
p.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errs.push(`${m.type()}: ${m.text().slice(0, 200)}`);
});

const rec = { era, seed, caseId, speed, cards: [], events: [], shots: [], errors: errs, ext, ended: false };
const ev = (s) => rec.events.push(s);
const t0 = Date.now();
await newGameToLife(p, { era });
await waitGuard(p, 'pause');
await p.locator(`[data-speed="${speed}"]`).tap();
const born = await p.evaluate(() => document.body.innerText.slice(0, 200));

const safeId = (k) => (k || 'x').replace(/@.*/, '');
let n = 0;
let shots = 0;
let autoState = 'none'; // none → on → done
let lastKey = null;
let stall = Date.now();

const waitCardChange = async (key, ms = 15000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const c = await readCard(p);
    if (c.screen === 'ending-screen' || c.key !== key) return c;
    await sleep(120);
  }
  return null;
};

while (Date.now() - t0 < 14 * 60 * 1000) {
  const c = await readCard(p);
  if (c.screen === 'ending-screen') {
    rec.ended = true;
    break;
  }
  if (c.screen !== 'life-screen') {
    ev(`뜻밖의 화면 ${c.screen}`);
    break;
  }
  if (!c.mode) {
    await sleep(100);
    continue;
  }
  stall = Date.now();
  if (c.mode === 'sheet') {
    await p.waitForFunction(() => {
      const b = document.querySelector('[data-testid="decision-fold-btn"]');
      return b !== null && b.getAttribute('aria-disabled') !== 'true' && !b.disabled;
    }, null, { timeout: 8000 }).catch(() => {});
    await sleep(150);
  }
  if (c.key === lastKey && c.mode !== 'fold') {
    await sleep(100);
    continue;
  }
  const c2 = await readCard(p);
  n++;
  lastKey = c2.key;
  const entry = { n, mode: c2.mode, key: c2.key, when: c2.when, title: c2.title, text: c2.text, cite: c2.cite ? { id: c2.cite.id, kind: c2.cite.kind, text: c2.cite.text, src: c2.cite.src, links: c2.cite.links } : null, choices: c2.choices.map((x) => ({ id: x.id, label: x.label, impact: x.impact })), autoNote: c2.autoNote, docOverflow: c2.docOverflow, focus: c2.activeTid, speed };
  rec.cards.push(entry);
  if (shots < MAX_SHOTS && (c2.mode === 'sheet' || c2.mode === 'inline')) {
    rec.shots.push(await shot(p, caseId, `c${String(n).padStart(2, '0')}-${safeId(c2.key)}`));
    shots++;
  }
  // 자동 모드 구간: 8번째 카드에서 접기 → 자동 켜기 → 다시 열기
  if (n === 8 && autoState === 'none' && c2.mode === 'sheet') {
    autoState = 'on';
    await p.getByTestId('decision-fold-btn').tap();
    await p.waitForSelector('[data-testid="decision-fold"]', { timeout: 3000 });
    const f1 = await readCard(p);
    ev(`접기: mode=${f1.mode} focus=${f1.activeTid} note=${f1.foldNote}`);
    rec.shots.push(await shot(p, caseId, `c${String(n).padStart(2, '0')}-folded`));
    await p.getByTestId('auto').tap();
    await sleep(300);
    const f2 = await readCard(p);
    ev(`접힌 채 자동 켜기: mode=${f2.mode} auto=${f2.auto} key=${f2.key === c2.key}`);
    await sleep(3600); // 접은 동안 자동 선택이 멈추는지(AUTO_CHOICE_MS 3초보다 길게 기다린다)
    const f3 = await readCard(p);
    ev(`접힌 채 3.6초 뒤: mode=${f3.mode} key=${f3.key === c2.key} age=${f3.age}`);
    await p.waitForFunction(() => {
      const b = document.querySelector('[data-testid="decision-reopen"]');
      return b !== null && b.getAttribute('aria-disabled') !== 'true' && !b.disabled;
    }, null, { timeout: 5000 });
    const tRe = Date.now();
    await p.getByTestId('decision-reopen').tap();
    await sleep(250);
    const r1 = await readCard(p);
    ev(`다시 열기: mode=${r1.mode} focus=${r1.activeTid} autoNote=${r1.autoNote}`);
    rec.shots.push(await shot(p, caseId, `c${String(n).padStart(2, '0')}-reopened-inline`));
    const after = await waitCardChange(c2.key, 12000);
    const dt = Date.now() - tRe;
    const ac = await readCard(p);
    ev(`자동 선택까지 ${dt}ms (기대 약 3000ms) 뒤 포커스=${ac.activeTid} 모드=${ac.mode}`);
    entry.autoTimerMs = dt;
    entry.focusAfterAuto = ac.activeTid;
    continue;
  }
  if (c2.mode === 'inline') {
    // 자동 모드 구간: 인라인 카드, 자동으로 고를 때까지 기다린다. 4번째 인라인 카드에서 자동 끄기
    entry.inlineIndex = rec.cards.filter((x) => x.mode === 'inline').length;
    if (entry.inlineIndex === 4 && autoState === 'on') {
      autoState = 'done';
      await sleep(400);
      await p.getByTestId('auto').tap();
      await sleep(400);
      const off = await readCard(p);
      ev(`인라인에서 자동 끄기: mode=${off.mode} focus=${off.activeTid} autoNote=${off.autoNote}`);
      rec.shots.push(await shot(p, caseId, `c${String(n).padStart(2, '0')}-auto-off-sheet`));
      lastKey = null;
      continue;
    }
    await waitCardChange(c2.key, 12000);
    continue;
  }
  // 수동 시트: 정책대로 하나를 탭
  const idx = pick === 'first' ? 0 : pick === 'last' ? c2.choices.length - 1 : (seed * 3 + n) % c2.choices.length;
  await p.getByTestId(`choice-${c2.choices[idx].id}`).tap();
  entry.picked = c2.choices[idx].id;
  await waitCardChange(c2.key, 15000);
}

await sleep(500);
const endText = await p.evaluate(() => (document.querySelector('[data-testid="ending-screen"]') ? document.body.innerText : null));
if (rec.ended) rec.shots.push(await shot(p, caseId, 'ending'));
rec.endingText = endText;
rec.born = born;
rec.ms = Date.now() - t0;
fs.writeFileSync(path.join(OUT, `play-${caseId}.json`), JSON.stringify(rec, null, 1));
console.log(`${caseId}: era=${era} seed=${seed} 카드 ${rec.cards.length}장(시트 ${rec.cards.filter((x) => x.mode === 'sheet').length}·인라인 ${rec.cards.filter((x) => x.mode === 'inline').length}), 인용 ${rec.cards.filter((x) => x.cite).length}, 끝 ${rec.ended}, ${Math.round(rec.ms / 1000)}s, 오류 ${errs.length}, 외부요청 ${ext.length}`);
console.log(rec.events.join('\n'));
await b.close();
