// QA-003 M9 P2: 8배속 + 「다음 결정으로」로 사람처럼 한 판 완주(카드는 읽고 고름). 단계마다 공통 감사기(m9-audit.mjs)로 화면 겹침·가림·넘침을 잰다.
// 흐름: 첫 화면 → 태어나기 → 룰렛(끝까지 돌림) → 출생신고 → 살아가기(8배속) → 결정 카드(인용·영향 줄) 선택 → 기록 카드(자동 시트) → 「생각 남기기」 1회 → 나가기 → 이어서 살기 → 엔딩 → 다시 태어나기
// 사용: node qa/scripts/m9-p2.mjs <era: past|present|future> <seed> <vp: d1280|m360> [caseId]
// 결과: qa/results/m9/p2/<caseId>.json + cases.jsonl 한 건. 문제가 있던 단계의 화면만 샷(임시 폴더 → 끝에서 FAIL·RECORD만 저장소로).
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, readCard, readNote, readSave, sleep, shot, addCase, waitGuard, sheetReady, putText, TOUCH, PROD, OUT, con } from './m7c-lib.mjs';
import { webkit } from 'playwright-core';
import { auditLayout, auditWords, auditContrast, COLUMNS_AUDIT } from './m9-audit.mjs';
const SCHEME = process.env.M9_SCHEME || ''; // light | dark (비우면 기본)
const CONTRAST = process.env.M9_CONTRAST === '1'; // 단계마다 글자 대비도 잼(P4 다크 1판)
const CAT = process.env.M9_CAT || 'P2 8배속 수동 흉내 완주';

const era = process.argv[2] || 'present';
const seed = Number(process.argv[3] || 31);
const vpName = process.argv[4] || 'd1280';
const caseId = process.argv[5] || `P2-${era}-${vpName}`;
const VPS = { d1280: { width: 1280, height: 800, touch: false }, d1920: { width: 1920, height: 1080, touch: false }, m360: { width: 360, height: 740, touch: true } };
const vp = VPS[vpName];
const touch = vp.touch;

const WK = process.env.M9_BROWSER === 'webkit';
const b = WK ? await webkit.launch({ headless: true }) : await launch();
const ctx = await mkctx(b, { viewport: { width: vp.width, height: vp.height }, ...(touch ? TOUCH : {}), ...(SCHEME ? { colorScheme: SCHEME } : {}) });
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

const act = async (loc) => (touch ? loc.tap() : loc.click());
const rec = { era, seed, vp: vpName, steps: [], notes: [], problems: [], soft: [], shots: [] };
const audited = new Set();
let firstProblemShot = null;

/** 단계 감사: 이름이 새로우면(또는 force) 레이아웃 감사를 하고 문제가 있으면 샷을 임시 폴더에 남긴다 */
async function step(name, { force = false, words = false } = {}) {
  if (!force && audited.has(name)) return;
  audited.add(name);
  await sleep(250);
  const a = await auditLayout(p);
  const entry = { name, texts: a.texts, problems: a.problems };
  if (CONTRAST) {
    const c = await auditContrast(p);
    entry.contrast = { checked: c.checked, unknown: c.unknown };
    entry.problems = [...entry.problems, ...c.problems];
  }
  let softHere = [];
  if (words) {
    const w = await auditWords(p, 'body');
    entry.words = w.problems;
    softHere = w.problems; // 낱말 끊김·구분 기호 — 모양 문제. Chromium에서는 FAIL, WebKit에서만 나면 RECORD(마스터 12-4 4)
    entry.problems = [...entry.problems, ...w.problems];
  }
  rec.steps.push(entry);
  const hardHere = entry.problems.filter((x) => !softHere.includes(x));
  if (hardHere.length) rec.problems.push(`${name}: ${hardHere.join(' | ')}`);
  if (softHere.length) rec.soft.push(`${name}: ${softHere.join(' | ')}`);
  if (entry.problems.length) {
    if (!firstProblemShot) firstProblemShot = await shot(p, caseId, name.replace(/[^a-z0-9가-힣-]/gi, '_'));
  }
}
const note = (s) => {
  rec.notes.push(s);
  console.log('  ' + s);
};

const t0 = Date.now();
await p.goto(PROD, { waitUntil: 'load' });
await p.waitForSelector('[data-testid="title-screen"]', { timeout: 15000 });
await step('title', { words: true });
if (era !== 'present') {
  await waitGuard(p, 'start-birth');
  await act(p.locator(`[data-testid="era-${era}"]`));
  await sleep(150);
}
await waitGuard(p, 'start-birth');
await act(p.getByTestId('start-birth'));
await p.waitForSelector('[data-testid="roulette-screen"]', { timeout: 8000 });
await sleep(800);
await step('roulette-spin');
// 룰렛이 저절로 끝나 결과가 뜰 때까지(최대 25초) 기다린다 — 끝나지 않으면 건너뛰기
const resultShown = await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 25000 }).then(() => true).catch(() => false);
if (!resultShown) {
  note('룰렛이 25초 안에 끝나지 않아 건너뛰기');
  await waitGuard(p, 'skip-roulette').catch(() => {});
  if (await p.locator('[data-testid="skip-roulette"]').count()) await act(p.getByTestId('skip-roulette'));
  await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 8000 });
}
await step('roulette-result', { words: true });
await waitGuard(p, 'to-birth');
await act(p.getByTestId('to-birth'));
await p.waitForSelector('[data-testid="birth-screen"]', { timeout: 8000 });
await step('birth', { words: true });
await waitGuard(p, 'next-life');
await act(p.getByTestId('next-life'));
await p.waitForSelector('[data-testid="life-screen"]', { timeout: 8000 });
await sleep(400);
await step('dash-start', { words: true });
{
  const cols = await p.evaluate(COLUMNS_AUDIT);
  rec.dashColumns = cols;
  if (vp.width >= 960) {
    if (cols.columns !== 3) rec.problems.push(`대시보드가 3열이 아님(열 ${cols.columns}, 폭 ${cols.vw})`);
    else if (!cols.allInFirstScreen) rec.problems.push(`3열이지만 프로필·기록·식구가 한 화면에 다 들어오지 않음(뷰포트 ${cols.vw}×${cols.vh})`);
  } else if (cols.columns !== 1) rec.problems.push(`좁은 화면인데 1열이 아님(열 ${cols.columns})`);
  note(`대시보드 열 ${cols.columns}, 프로필·기록·식구 첫 화면 안 ${cols.allInFirstScreen}, 또래 카드 첫 화면 안 ${cols.peersInView}`);
}
await waitGuard(p, 'pause');
await act(p.locator('[data-speed="8"]'));
rec.speed8 = await p.evaluate(() => {
  const e = document.querySelector('[data-speed="8"]');
  return e ? { pressed: e.getAttribute('aria-pressed') } : null;
});

let decisions = 0;
let autoSheets = 0;
let manualDone = false;
let exitDone = false;
let lastKey = null;
let citeSeen = 0;
let impactSeen = 0;
let stall = Date.now();
let ended = false;
const ageAtExit = { before: null, after: null };

while (Date.now() - t0 < 12 * 60 * 1000) {
  const c = await readCard(p);
  if (c.screen === 'ending-screen') {
    ended = true;
    break;
  }
  if (c.screen === 'title-screen') {
    // 나가기 뒤 첫 화면: 이어서 살기
    await step('title-after-exit', { words: false });
    await waitGuard(p, 'resume');
    await act(p.getByTestId('resume'));
    await p.waitForSelector('[data-testid="life-screen"]', { timeout: 8000 });
    await sleep(500);
    const c2 = await readCard(p);
    ageAtExit.after = c2.age;
    note(`이어서 살기: 나갈 때 ${ageAtExit.before}세 → 돌아온 직후 ${c2.age}세`);
    await step('dash-after-resume');
    continue;
  }
  if (c.screen !== 'life-screen') {
    note(`뜻밖의 화면 ${c.screen}`);
    rec.problems.push(`뜻밖의 화면 ${c.screen}`);
    break;
  }
  if (c.noteSheet) {
    autoSheets++;
    await sheetReady(p);
    await step('note-sheet-auto');
    const n0 = await readNote(p);
    if (autoSheets === 1) {
      await putText(p, '여덟 배속으로 지나가도 이 장면은 오래 남는다.', 'type');
      await step('note-sheet-typed', { force: false });
      await act(p.getByTestId('note-save'));
    } else {
      await act(p.getByTestId('note-skip'));
    }
    await p.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 5000 }).catch(() => rec.problems.push('기록 시트가 안 닫힘'));
    stall = Date.now();
    continue;
  }
  if (c.mode === 'sheet') {
    stall = Date.now();
    await p.waitForFunction(() => {
      const bt = document.querySelector('[data-testid="decision-fold-btn"]');
      return bt !== null && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled;
    }, null, { timeout: 8000 }).catch(() => {});
    await sleep(200);
    if (c.key === lastKey) {
      await sleep(100);
      continue;
    }
    await step('decision-card', { words: decisions === 0 });
    const info = await p.evaluate(() => {
      const panel = document.querySelector('[data-testid="choice-panel"]');
      return { cite: panel ? panel.querySelectorAll('[data-testid="cite"]').length : 0, impact: panel ? panel.querySelectorAll('[data-testid="impact"]').length : 0, hint: !!(panel && panel.querySelector('[data-testid="choice-hint"]')) };
    });
    if (info.cite) citeSeen++;
    if (info.impact) impactSeen++;
    if (decisions === 0) note(`첫 결정 카드: ${c.title} / 선택지 ${c.choices.length}개 / 인용 ${info.cite} / 영향 줄 ${info.impact} / 안내 ${info.hint}`);
    await sleep(600); // 읽는 시늉
    const idx = (seed * 3 + decisions) % c.choices.length;
    lastKey = c.key;
    await act(p.getByTestId(`choice-${c.choices[idx].id}`));
    decisions++;
    await sleep(300);
    continue;
  }
  if (!manualDone && decisions >= 3 && c.mode === null) {
    // 「생각 남기기」 1회(수동)
    await waitGuard(p, 'tool-note');
    await act(p.getByTestId('tool-note'));
    await sheetReady(p);
    await step('note-sheet-manual');
    await putText(p, '손으로 남기는 한 줄 메모.', 'type');
    await act(p.getByTestId('note-save'));
    await p.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 5000 }).catch(() => rec.problems.push('수동 기록 시트가 안 닫힘'));
    manualDone = true;
    await sleep(300);
    continue;
  }
  if (manualDone && !exitDone && decisions >= 5 && c.mode === null) {
    // 나가기 → 확인 → 첫 화면 → 이어서 살기
    await waitGuard(p, 'tool-exit');
    ageAtExit.before = c.age;
    await act(p.getByTestId('tool-exit'));
    await p.waitForSelector('[data-testid="exit-ask"]', { timeout: 4000 });
    await step('exit-ask');
    await waitGuard(p, 'exit-yes');
    await act(p.getByTestId('exit-yes'));
    exitDone = true;
    await p.waitForSelector('[data-testid="title-screen"]', { timeout: 8000 });
    continue;
  }
  if (c.mode === 'inline' || c.mode === 'fold') {
    await sleep(150);
    continue;
  }
  if (c.skipDisabled !== 'true') await act(p.getByTestId('skip')).catch(() => {});
  await sleep(120);
  if (Date.now() - stall > 90000) {
    note('90초 정체');
    rec.problems.push('90초 정체');
    break;
  }
}

if (ended) {
  await sleep(500);
  await step('ending-top', { words: true });
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(400);
  await step('ending-bottom', { force: true });
  await p.evaluate(() => window.scrollTo(0, 0));
  const save = await readSave(p);
  rec.endAge = save && save.data ? save.data.age : null;
  await waitGuard(p, 'rebirth');
  await act(p.getByTestId('rebirth'));
  await p.waitForSelector('[data-testid="title-screen"]', { timeout: 8000 }).catch(() => rec.problems.push('다시 태어나기 뒤 첫 화면이 안 뜸'));
  await step('title-after-rebirth', { force: true });
} else {
  rec.problems.push('엔딩에 닿지 못함');
}

const exitOk = exitDone && ageAtExit.after !== null && ageAtExit.after >= ageAtExit.before && ageAtExit.after <= ageAtExit.before + 1;
if (!exitDone) rec.problems.push('나가기 → 이어서 살기를 하지 못함');
else if (!exitOk) rec.problems.push(`이어서 살기 나이 어긋남: 나갈 때 ${ageAtExit.before} → ${ageAtExit.after}`);
if (errs.length) rec.problems.push(`콘솔 오류 ${errs.length}: ${errs.slice(0, 2).join(' | ')}`);
if (ext.length) rec.problems.push(`외부 요청 ${ext.length}`);
if (decisions === 0) rec.problems.push('결정 카드를 만나지 못함');
rec.decisions = decisions;
rec.autoSheets = autoSheets;
rec.citeSeen = citeSeen;
rec.impactSeen = impactSeen;
rec.ms = Date.now() - t0;
fs.mkdirSync(path.join(OUT, 'p2'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'p2', `${caseId}.json`), JSON.stringify(rec, null, 1));
con.take();
con.takeRequests();
addCase({
  id: caseId,
  cat: CAT,
  title: `${WK ? 'WebKit · ' : ''}${SCHEME ? SCHEME + ' 모드 · ' : ''}${era} 세상 · ${vpName === 'm360' ? '360×740 터치' : vpName === 'd1920' ? '1920×1080 마우스' : '1280×800 마우스'} · 8배속 + 다음 결정으로 + 카드 읽고 선택: 단계마다 겹침·가림·넘침 감사`,
  steps: '첫 화면 → 태어나기 → 룰렛(끝까지) → 출생신고 → 살아가기 → 결정 카드 선택(인용·영향 줄) → 기록 카드 → 생각 남기기 1회 → 나가기 → 이어서 살기 → 엔딩 → 다시 태어나기',
  expected: `엔딩까지 완주, 나갔다 이어 살면 나이가 같거나 한 살 많음, 감사한 모든 단계에서 가로 넘침·겹친 글자·가려진 글자 0${CONTRAST ? '·글자 대비 기준(4.5/큰 글자 3) 이상' : ''}, 콘솔 오류·외부 요청 0`,
  actual: rec.problems.length === 0 && rec.soft.length === 0 ? `완주(${rec.endAge}세) — 결정 ${decisions}장(인용 있는 카드 ${citeSeen}, 영향 줄 있는 카드 ${impactSeen}), 자동 기록 시트 ${autoSheets}장, 단계 ${rec.steps.length}곳 감사 문제 0, 나가기→이어서 ${ageAtExit.before}→${ageAtExit.after}세, ${Math.round(rec.ms / 1000)}초` : [...rec.problems, ...rec.soft.map((x) => `[모양] ${x}`)].join(' || '),
  verdict: rec.problems.length > 0 ? 'FAIL' : rec.soft.length > 0 ? (WK ? 'RECORD' : 'FAIL') : 'PASS',
  shots: firstProblemShot ? [firstProblemShot] : [],
  console: errs.map((e) => ({ type: 'err', text: e })),
  externalRequests: ext,
});
await b.close();
