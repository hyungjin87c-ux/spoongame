// QA-003 M7c 정상 플레이: prod 빌드에서 360x740 터치(탭)로 0세~사망까지 한 판. 자동 기록 카드 응답을 번갈아 하고(저장·빈 2번·글+2번+확인+돌아가기·Esc+확인+버림·빈 1번 오류) 수동 「생각 남기기」를 3건 이상 쓴다.
// 사용: node qa/scripts/m7c-play.mjs <era> <seed> <caseId> [speed=8] [mode=normal|skipall]
//   mode=skipall: 모든 기록 카드·수동 기록을 쓰지 않고 지나간다(인생 불변 표본용 — 같은 시드·같은 선택 정책과 엔딩을 비교)
// 결과: qa/results/m7c/play-<caseId>.json, 스크린샷 qa/screenshots/003/M7c-<caseId>-*.png
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, newGameToLife, waitGuard, readCard, readNote, readLog, readSave, noteRowsOf, shot, sleep, OUT, PROD, TOUCH, con, putText, sheetReady, clearInput, GAME_KEY, SETTINGS_KEY } from './m7c-lib.mjs';

const era = process.argv[2] || 'present';
const seed = Number(process.argv[3] || 11);
const caseId = process.argv[4] || `N-${era}`;
const speed = process.argv[5] || '8';
const mode = process.argv[6] || 'normal';
const MAX_SHOTS = 40;

const TEXTS = [
  '다섯 살 무렵, 마당의 감나무 밑에서 할머니가 곶감을 쥐여 주던 장면이 남아 있다.',
  '친구의 새 운동화가 부러웠던 날, 집에 와서 괜히 방문을 세게 닫았다.',
  '고백하지 못한 채 졸업했다.\n그 뒤로도 한참 그 골목을 지나다녔다.',
  '이 글은 확인 단계에서 버려질 글입니다.',
  '기억에 남는 건 😀 가족과 함께한 여름 🏖️ 이었다. 숫자 1️⃣ 도 센다.',
  '소화가 안 되던 겨울, 병원 대기실의 시계 소리.',
  '엄마의 걸음이 느려진 걸 어느 날 처음 알았다.',
  '인생은 긴 환승 구간 같다.',
];
const MANUAL_TEXTS = ['오늘은 괜히 창밖을 오래 봤다.', '한 줄 메모: 비 오는 날의 우산 냄새.', '세 번째 수동 기록 — 쉼표, 따옴표 "큰", \'작은\' & 앰퍼샌드 <b>굵게</b>', '네 번째 기록은 그냥 짧게'];

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

const rec = { era, seed, caseId, speed, mode, autoSheets: [], manual: [], events: [], shots: [], errors: errs, ext, ended: false, decisions: 0 };
const ev = (s) => {
  rec.events.push(s);
  console.log('  ' + s);
};
const t0 = Date.now();
await newGameToLife(p, { era });
await waitGuard(p, 'pause');
await p.locator(`[data-speed="${speed}"]`).tap();
rec.born = await p.evaluate(() => document.body.innerText.slice(0, 160));

let shots = 0;
const snap = (id) => shot(p, caseId, id).then((s) => {
  rec.shots.push(s);
  shots++;
});

/** 시트가 열릴 때 저장에서 읽는 맥락 (질문 전제 판독용) */
async function context() {
  const s = await readSave(p);
  const d = s && s.data ? s.data : {};
  return { age: d.age, flags: d.flags, stats: d.stats, seenNotes: Object.keys(d.seen || {}).filter((k) => k.startsWith('note-')), parents: d.birthReport ? { mother: d.birthReport.mother, father: d.birthReport.father } : null, paused: d.paused, seenIllness: ['middle-health-crisis', 'senior-illness', 'senior-illness-later'].filter((k) => d.seen && d.seen[k] !== undefined), era: d.era };
}

async function handleAutoSheet(k) {
  await sheetReady(p);
  await sleep(200);
  const n0 = await readNote(p);
  const ctxInfo = await context();
  const entry = { k, card: n0.card, via: n0.via, title: n0.title, when: n0.when, cite: n0.cite, dialogName: n0.dialogName, toggle: n0.toggle, hint: n0.hint, focus: n0.activeTid, ctx: ctxInfo, action: null };
  rec.autoSheets.push(entry);
  const label = `a${String(k + 1).padStart(2, '0')}-${n0.card}`;
  if (shots < MAX_SHOTS) await snap(`${label}-open`);
  const before = noteRowsOf(await readSave(p)).length;
  if (mode === 'skipall') {
    await p.getByTestId('note-skip').tap();
    entry.action = 'skip-empty';
    await p.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 4000 });
    return;
  }
  const text = TEXTS[k % TEXTS.length];
  const plan = ['save', 'skip-empty', 'skip-text-back-save', 'esc-text-discard', 'save-emoji', 'empty-save-error', 'save', 'save'][k % 8] ?? 'save';
  entry.action = plan;
  if (plan === 'save' || plan === 'save-emoji') {
    await putText(p, text, plan === 'save' ? 'type' : 'insert');
    const n1 = await readNote(p);
    entry.afterType = { count: n1.count, countSr: n1.countSr, msg: n1.msg, value: n1.inputValue };
    if (shots < MAX_SHOTS) await snap(`${label}-typed`);
    await p.getByTestId('note-save').tap();
  } else if (plan === 'skip-empty') {
    await p.getByTestId('note-skip').tap();
  } else if (plan === 'skip-text-back-save') {
    await putText(p, text, 'insert');
    await p.getByTestId('note-skip').tap();
    await p.waitForSelector('[data-testid="note-confirm"]', { timeout: 3000 });
    await sleep(500);
    const c = await readNote(p);
    entry.confirm = { ...c.confirm, focus: c.activeTid, inputReadOnly: c.inputReadOnly, value: c.inputValue };
    if (shots < MAX_SHOTS) await snap(`${label}-confirm`);
    await p.getByTestId('note-confirm-back').tap();
    await sleep(300);
    const c2 = await readNote(p);
    entry.afterBack = { value: c2.inputValue, focus: c2.activeTid, confirm: c2.confirm };
    await p.getByTestId('note-save').tap();
  } else if (plan === 'esc-text-discard') {
    await putText(p, text, 'insert');
    await p.keyboard.press('Escape');
    await p.waitForSelector('[data-testid="note-confirm"]', { timeout: 3000 });
    await sleep(500);
    const c = await readNote(p);
    entry.confirm = { ...c.confirm, focus: c.activeTid };
    if (shots < MAX_SHOTS) await snap(`${label}-esc-confirm`);
    await p.getByTestId('note-confirm-discard').tap();
  } else if (plan === 'empty-save-error') {
    await p.getByTestId('note-save').tap();
    await sleep(300);
    const c = await readNote(p);
    entry.emptyError = { msg: c.msg, msgError: c.msgError, invalid: c.inputInvalid, focus: c.activeTid, sheetStill: c.present, described: c.inputDescribed };
    rec.rowsDuringEmpty = noteRowsOf(await readSave(p)).length;
    if (shots < MAX_SHOTS) await snap(`${label}-empty-error`);
    await putText(p, text, 'type');
    await p.getByTestId('note-save').tap();
  }
  await p.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 5000 }).catch(() => ev(`시트가 안 닫힘 ${label}`));
  await sleep(200);
  const after = noteRowsOf(await readSave(p)).length;
  entry.rowsBefore = before;
  entry.rowsAfter = after;
  const cc = await readCard(p);
  entry.focusAfter = cc.activeTid;
  ev(`자동 시트 ${k + 1} ${n0.card} 나이 ${ctxInfo.age} [${plan}] 기록 ${before}→${after} 질문: ${n0.title}`);
}

async function manualNote(i) {
  // 결정 시트가 열려 있으면 도구 줄이 inert — 닫힐 때까지 기다린다
  const c = await readCard(p);
  if (c.mode === 'sheet' || c.noteSheet) return false;
  await waitGuard(p, 'tool-note');
  await p.getByTestId('tool-note').tap();
  await sheetReady(p);
  await sleep(150);
  const n0 = await readNote(p);
  const m = { i, via: n0.via, title: n0.title, when: n0.when, focus: n0.activeTid, age: (await context()).age };
  rec.manual.push(m);
  const label = `m${i + 1}`;
  if (shots < MAX_SHOTS) await snap(`${label}-open`);
  const before = noteRowsOf(await readSave(p)).length;
  if (i === 1) {
    // 두 번째 수동 기록은 쓰다 버린다(글 + 2번 + 확인 + 버림)
    await putText(p, '쓰다 버릴 글', 'insert');
    await p.getByTestId('note-skip').tap();
    await p.waitForSelector('[data-testid="note-confirm"]', { timeout: 3000 });
    await sleep(500);
    await p.getByTestId('note-confirm-discard').tap();
    m.action = 'discard';
  } else {
    await putText(p, MANUAL_TEXTS[i % MANUAL_TEXTS.length], 'type');
    if (shots < MAX_SHOTS) await snap(`${label}-typed`);
    await p.getByTestId('note-save').tap();
    m.action = 'save';
  }
  await p.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 5000 }).catch(() => ev(`수동 시트가 안 닫힘 ${label}`));
  await sleep(250);
  const after = noteRowsOf(await readSave(p)).length;
  m.rowsBefore = before;
  m.rowsAfter = after;
  m.focusAfter = (await readCard(p)).activeTid;
  ev(`수동 기록 ${i + 1} [${m.action}] 기록 ${before}→${after} 나이 ${m.age}`);
  return true;
}

let autoK = 0;
let manualI = 0;
let lastKey = null;
let stall = Date.now();
const MANUAL_AT = [2, 6, 10, 14]; // 결정을 이만큼 고른 뒤 수동 기록 (normal 모드)

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
  if (c.noteSheet) {
    await handleAutoSheet(autoK++);
    stall = Date.now();
    continue;
  }
  if (c.mode === 'sheet') {
    stall = Date.now();
    await p.waitForFunction(() => {
      const bt = document.querySelector('[data-testid="decision-fold-btn"]');
      return bt !== null && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled;
    }, null, { timeout: 8000 }).catch(() => {});
    await sleep(150);
    if (c.key === lastKey) {
      await sleep(100);
      continue;
    }
    const idx = (seed * 3 + rec.decisions) % c.choices.length;
    lastKey = c.key;
    await p.getByTestId(`choice-${c.choices[idx].id}`).tap();
    rec.decisions++;
    await sleep(250);
    continue;
  }
  if (mode === 'normal' && manualI < MANUAL_AT.length && rec.decisions >= MANUAL_AT[manualI] && c.mode === null) {
    const ok = await manualNote(manualI);
    if (ok) manualI++;
    continue;
  }
  if (c.mode === 'inline' || c.mode === 'fold') {
    await sleep(150);
    continue;
  }
  // 평시: 다음 결정으로
  if (c.skipDisabled !== 'true') {
    await p.getByTestId('skip').tap().catch(() => {});
  }
  await sleep(120);
  if (Date.now() - stall > 90000) {
    ev('90초 정체');
    break;
  }
}

await sleep(600);
rec.ms = Date.now() - t0;
rec.autoCount = rec.autoSheets.length;
const finalSave = await readSave(p);
const rowsEnd = noteRowsOf(finalSave);
rec.noteRowsAtEnd = rowsEnd.map((r) => ({ age: r.age, title: r.title, text: r.text, eventId: r.eventId }));
rec.endState = finalSave && finalSave.data ? { age: finalSave.data.age, phase: finalSave.data.phase, death: finalSave.data.death, stats: finalSave.data.stats, assets: finalSave.data.assets, flags: finalSave.data.flags, seenNonNote: Object.fromEntries(Object.entries(finalSave.data.seen || {}).filter(([k]) => !k.startsWith('note-'))), historyNonNote: (finalSave.data.history || []).filter((h) => h.kind !== 'note').length } : null;

if (rec.ended) {
  await snap('ending-top');
  rec.ending = await p.evaluate(() => {
    const tx = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
    const rows = [...document.querySelectorAll('[data-testid="timeline-entry"]')];
    return {
      timelineRows: rows.length,
      noteRows: rows
        .filter((r) => r.querySelector('[data-testid="note-label"]'))
        .map((r) => ({ label: tx(r.querySelector('[data-testid="note-label"]')), text: r.querySelector('[data-testid="note-text"]') ? r.querySelector('[data-testid="note-text"]').textContent : null, anchors: r.querySelectorAll('a, img, script').length, rect: (() => { const q = r.getBoundingClientRect(); return { x: Math.round(q.x), w: Math.round(q.width), r: Math.round(q.right) }; })() })),
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      endText: document.body.innerText,
      meta: Object.fromEntries(['ending-name', 'ending-span', 'ending-era', 'ending-death', 'ending-stats', 'ending-journey', 'ending-legend', 'final-looks', 'ending-movement'].map((id) => [id, tx(document.querySelector(`[data-testid="${id}"]`))])),
      nonNoteTimeline: rows.filter((r) => !r.querySelector('[data-testid="note-label"]')).map((r) => tx(r)),
    };
  });
  // 연표의 첫 「나의 기록」 줄을 화면에 가져와 스크린샷
  const noteLoc = p.locator('[data-testid="timeline-entry"]:has([data-testid="note-label"])').first();
  if ((await noteLoc.count()) > 0) {
    await noteLoc.scrollIntoViewIfNeeded();
    await sleep(300);
    await snap('ending-note-row');
  }
  await shot(p, caseId, 'ending-full', { full: true }).then((s) => rec.shots.push(s));
  // 엔딩 새로고침: 연표가 같다
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('[data-testid="ending-screen"]', { timeout: 10000 });
  await sleep(500);
  const afterReload = await p.evaluate(() => [...document.querySelectorAll('[data-testid="timeline-entry"]:has([data-testid="note-label"]) [data-testid="note-text"]')].map((e) => e.textContent));
  rec.endingReloadNoteTexts = afterReload;
  // 다시 태어나기: 이전 글이 localStorage 어느 키에도 없다
  const texts = rowsEnd.map((r) => r.text);
  await waitGuard(p, 'rebirth').catch(() => {});
  await p.getByTestId('rebirth').tap();
  await sleep(1200);
  const keys = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
  const sess = await p.evaluate(() => Object.fromEntries(Object.keys(sessionStorage).map((k) => [k, sessionStorage.getItem(k)])));
  const all = JSON.stringify(keys) + JSON.stringify(sess);
  rec.afterRebirth = { storageKeys: Object.keys(keys), leftover: texts.filter((t) => t && (all.includes(t) || all.includes(JSON.stringify(t).slice(1, -1)))), screen: (await readCard(p)).screen };
  await snap('after-rebirth');
}
rec.totalAutoNoteSheets = rec.autoSheets.length;
rec.manualCount = rec.manual.length;
fs.writeFileSync(path.join(OUT, `play-${caseId}.json`), JSON.stringify(rec, null, 1));
console.log(`${caseId}: era=${era} seed=${seed} mode=${mode} 자동 시트 ${rec.autoSheets.length}장 [${rec.autoSheets.map((a) => a.card.replace('note-', '')).join(', ')}] 수동 ${rec.manual.length}건 끝 ${rec.ended} 결정 ${rec.decisions} ${Math.round(rec.ms / 1000)}s 오류 ${errs.length} 외부요청 ${ext.length}`);
await b.close();
