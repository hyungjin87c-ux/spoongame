// QA-003 M7c 2회차 F-1 재측정 (content-M7c 11-1-6 (a)~(e), QA2-1).
// 사용: node qa/scripts/m7c-r2-guard.mjs <part> [run=1] [뷰포트 이름 일부]
//   part = dbl      (a) 더블탭 88조합 (버튼 4종 × 공통 뷰포트 11종 × 글자 100·200%)
//          dec      (b) 결정 카드(모달) 선택지 더블탭 22조합
//          inline   (b-보충) 자동 모드 인라인 카드의 사용자 선택 더블탭 11조합(글자 100%)
//          release  (d) 같은 110조합(+인라인 11)에서 한 번만 탭 → 450ms 뒤 배속 탭이 작동하는가(과한 가드 없음)
//          b07      (c) 간격 스윕: 1번 더블탭 뒤 100·250·380ms 거부 / 450·520ms 열림 (3 뷰포트)
//          misc     (d) 자동 선택 직후 배속 탭 · 시트 없는 소비 직후 · 평소 배속 연타
//          shots    케이스별 대표 스크린샷(더블탭 뒤 600ms 상태, 360×740 터치·320×568) — 통과한 케이스에도 증거 샷을 남긴다
// 같은 조합 판정은 상태 전후 비교(11-1-6): 일시정지·배속·자동 모드·나이·다크·BGM·나가기 확인·새 시트·결정 선택·팝업 중 하나라도 기대와 다르면 「작동」.
import { launch, openOracle, plainLife, dueStateFor, pendingState, withNotes, openSeeded, sheetReady, shot, sleep, runCase, appendJsonl, STD_VIEWPORTS, setRootFont, SET_MANUAL, SET_AUTO, GAME_KEY } from './m7c-r2-lib.mjs';

const PART = process.argv[2] || 'dbl';
const RUN = parseInt(process.argv[3] || '1', 10);
const VPF = process.argv[4] || '';
const VPS = STD_VIEWPORTS.filter((v) => !VPF || v.name.includes(VPF));

const b = await launch();
const { page: oracle } = await openOracle(b);
const base = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });
const infant = await dueStateFor(oracle, 'note-infant-memory', { era: 'present', paused: true });
const pend = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: true });
if (!base || !infant || !pend) throw new Error('상태 만들기 실패');

const readUi = (page) =>
  page.evaluate((k) => {
    const q = (s) => document.querySelector(s);
    let save = null;
    try {
      save = JSON.parse(localStorage.getItem(k));
    } catch {}
    const hist = save && save.data && Array.isArray(save.data.history) ? save.data.history : [];
    return {
      paused: q('[data-testid="pause"]') ? q('[data-testid="pause"]').getAttribute('data-paused') : null,
      speed: q('[data-speed][aria-pressed="true"]') ? q('[data-speed][aria-pressed="true"]').getAttribute('data-speed') : null,
      theme: document.documentElement.getAttribute('data-theme'),
      bgm: q('[data-testid="tool-bgm"]') ? q('[data-testid="tool-bgm"]').getAttribute('aria-pressed') : null,
      dark: q('[data-testid="tool-dark"]') ? q('[data-testid="tool-dark"]').getAttribute('aria-pressed') : null,
      auto: q('[data-testid="auto"]') ? q('[data-testid="auto"]').getAttribute('aria-pressed') : null,
      noteSheet: document.querySelectorAll('[data-testid="note-sheet"]').length,
      exitAsk: !!q('[data-testid="exit-ask"]'),
      choice: document.querySelectorAll('[data-testid="choice-panel"]').length,
      pendingKey: q('[data-testid="choice-panel"]') ? q('[data-testid="choice-panel"]').getAttribute('data-key') : null,
      age: q('[data-testid="life-age"] b') ? q('[data-testid="life-age"] b').textContent : null,
      screen: ['title-screen', 'life-screen', 'ending-screen', 'error-screen', 'superseded-screen'].find((id) => q(`[data-testid="${id}"]`)) || 'other',
      noteRows: hist.filter((h) => h.kind === 'note').length,
      histLen: hist.length,
      saveAge: save && save.data ? save.data.age : null,
    };
  }, GAME_KEY);

const describeAt = (page, x, y) =>
  page.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px, py);
    if (!el) return null;
    const btn = el.closest('button, a, [role="button"], input, textarea, select');
    const t = btn || el;
    return { tag: t.tagName.toLowerCase(), testid: t.getAttribute('data-testid') || t.closest('[data-testid]')?.getAttribute('data-testid') || '', speed: t.getAttribute('data-speed'), text: (t.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24), interactive: !!btn, inert: !!t.closest('[inert]'), ariaDisabled: t.getAttribute('aria-disabled') };
  }, [x, y]);

// 버튼 종류 4(기록) + 결정 + 인라인
const TARGETS = [
  { id: 'keep-cite', label: '자동 ① 시트(인용 있음) · 1번', state: infant, settings: SET_MANUAL, text: '더블탭 시험', button: 'note-save', open: 'auto', expectRows: 1 },
  { id: 'keep-manual', label: '수동 시트 · 1번', state: base, settings: SET_MANUAL, text: '더블탭 시험', button: 'note-save', open: 'manual', expectRows: 1 },
  { id: 'skip-empty', label: '수동 시트(글 없음) · 2번', state: base, settings: SET_MANUAL, text: '', button: 'note-skip', open: 'manual', expectRows: 0 },
  { id: 'discard', label: '수동 시트 확인 단계 · 「글을 지우고 담아 두기」', state: base, settings: SET_MANUAL, text: '버릴 글', button: 'note-confirm-discard', open: 'manual', viaSkip: true, expectRows: 0 },
  { id: 'decision', label: '중대 결정 카드(모달) 선택지', state: pend, settings: SET_MANUAL, open: 'decision' },
  { id: 'inline', label: '자동 모드 인라인 결정 카드 선택지', state: pend, settings: SET_AUTO, open: 'decision', inline: true },
];

/** 조합 하나를 열어 버튼 좌표까지 준비한다 */
async function prepare(T, vp, font) {
  const waitSel = T.open === 'auto' ? '[data-testid="note-sheet"]' : T.open === 'decision' ? '[data-testid="choice-panel"]' : '[data-testid="life-screen"]';
  const { ctx, page } = await openSeeded(b, T.state, { vp: { width: vp.width, height: vp.height }, wait: waitSel, settings: T.settings });
  const popups = [];
  ctx.on('page', (p) => popups.push(p.url()));
  let btnSel;
  if (T.open === 'decision') {
    await setRootFont(page, font);
    await page
      .waitForFunction(() => { const bt = document.querySelector('[data-testid="decision-fold-btn"]'); return !bt || (bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled); }, null, { timeout: 6000 })
      .catch(() => {});
    await page
      .waitForFunction(() => { const c = document.querySelector('.choice'); return c && c.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 6000 })
      .catch(() => {});
    await sleep(500);
    btnSel = page.locator('.choice').first();
  } else {
    if (T.open === 'manual') await page.getByTestId('tool-note').tap();
    await sheetReady(page);
    await setRootFont(page, font);
    await sleep(300);
    if (T.text) {
      await page.getByTestId('note-input').focus();
      await page.keyboard.insertText(T.text);
    }
    if (T.viaSkip) {
      await page.getByTestId('note-skip').scrollIntoViewIfNeeded().catch(() => {});
      await page.getByTestId('note-skip').click({ force: true });
      await page.waitForSelector('[data-testid="note-confirm"]', { timeout: 3000 });
      await sleep(600);
    }
    btnSel = page.getByTestId(T.button);
  }
  await btnSel.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(150);
  const box = await btnSel.boundingBox();
  if (!box) {
    await ctx.close();
    return null;
  }
  const x = box.x + box.width / 2;
  const y = Math.min(box.y + box.height / 2, vp.height - 2);
  // 증거: 실제로 클릭이 도착한 요소와 그 순간의 aria-disabled(가드)를 문서 수준에서 기록한다
  await page.evaluate(() => {
    window.__clicks = [];
    document.addEventListener(
      'click',
      (e) => {
        const bt = e.target.closest ? e.target.closest('button, a, [role="button"]') : null;
        const t = bt || e.target;
        window.__clicks.push({ t: Math.round(e.timeStamp), tid: (t.getAttribute && (t.getAttribute('data-testid') || (t.getAttribute('data-speed') ? 'speed-' + t.getAttribute('data-speed') : ''))) || (t.tagName || '').toLowerCase(), dis: bt ? bt.getAttribute('aria-disabled') : null, btn: !!bt });
      },
      true,
    );
  });
  return { ctx, page, popups, x, y };
}

/** 상태 전후 비교로 「작동」을 센다 */
function judge(T, before, after, popups, ref) {
  const diff = {};
  if (T.open === 'decision') {
    // 결정 카드는 한 번 탭한 판(ref)과 모든 값이 같아야 한다(선택 1번, 나머지 컨트롤 불변)
    for (const k of Object.keys(ref)) if (ref[k] !== after[k]) diff[k] = `한 번 탭=${ref[k]} / 더블탭=${after[k]}`;
    if (popups.length) diff.popup = popups.join(',').slice(0, 80);
    return diff;
  }
  const IGN = new Set(['noteSheet', 'choice', 'pendingKey', 'noteRows', 'histLen', 'saveAge']);
  for (const k of Object.keys(before)) if (!IGN.has(k) && before[k] !== after[k]) diff[k] = `${before[k]}→${after[k]}`;
  if (T.open === 'decision') {
    // 선택은 정확히 1번(연표 +1), 같은 카드가 다시 뜨거나 다른 결정 카드가 뜨면 작동
    if (after.histLen !== before.histLen + 1 && after.histLen !== before.histLen + 2) diff.decisionHist = `${before.histLen}→${after.histLen}`;
    if (after.noteSheet !== 0) diff.newNoteSheet = String(after.noteSheet);
    if (after.choice !== 0) diff.choiceStill = `${after.choice}:${after.pendingKey}`;
  } else {
    if (after.noteSheet !== 0) diff.newNoteSheet = `${after.noteSheet}`;
    if (after.choice !== 0) diff.choiceOpened = `${after.choice}:${after.pendingKey}`;
    if (after.noteRows !== T.expectRows) diff.noteRows = `기대 ${T.expectRows}, 실제 ${after.noteRows}`;
  }
  if (popups.length) diff.popup = popups.join(',').slice(0, 80);
  return diff;
}

const sel = (ids) => TARGETS.filter((t) => ids.includes(t.id));

async function runDouble(ids, fonts, label, jsonl, caseIdPrefix) {
  for (const T of sel(ids)) {
    for (const font of fonts) {
      const id = `${caseIdPrefix}-${T.id}-${font}-run${RUN}`;
      await runCase(
        { id, cat: '입력 가드(2회차)', title: `${T.label} 더블탭(60ms) — 글자 ${font}% · ${label}`, steps: '버튼 중심을 60ms 간격으로 두 번 탭 → 600ms 뒤 컨트롤 상태 비교', expected: '컨트롤 작동 0(일시정지·배속·자동 모드·나이·다크·BGM·나가기 확인·새 시트·결정 선택 변화 0)' },
        async () => {
          const hits = [];
          const table = [];
          const shots = [];
          for (const vp of VPS) {
            const r = await prepare(T, vp, font);
            if (!r) {
              table.push({ vp: vp.name, error: 'no box' });
              hits.push({ vp: vp.name, diff: { error: 'no box' } });
              continue;
            }
            const { ctx, page, popups, x, y } = r;
            const before = await readUi(page);
            let ref = null;
            if (T.open === 'decision') {
              const r1 = await prepare(T, vp, font);
              if (r1) {
                await r1.page.touchscreen.tap(r1.x, r1.y);
                await sleep(700);
                ref = await readUi(r1.page);
                await r1.ctx.close();
              }
            }
            await page.touchscreen.tap(x, y);
            await sleep(60);
            await page.touchscreen.tap(x, y);
            await sleep(600);
            const clicks = await page.evaluate(() => window.__clicks);
            const under = clicks.length >= 2 ? clicks[clicks.length - 1] : { tid: clicks.length ? '(둘째 클릭 없음)' : '(클릭 없음)' };
            const after = await readUi(page);
            const diff = judge(T, before, after, popups, ref);
            const rec = { id, run: RUN, vp: vp.name, font, target: T.id, x: Math.round(x), y: Math.round(y), clicks, under, before, ref, after, diff };
            table.push(rec);
            appendJsonl(jsonl, rec);
            if (Object.keys(diff).length) {
              hits.push(rec);
              shots.push(await shot(page, `${id}-${vp.name}`, 'after'));
            }
            await ctx.close();
          }
          return {
            verdict: hits.length ? 'FAIL' : 'PASS',
            actual: hits.length ? `컨트롤이 작동한 뷰포트 ${hits.length}/${VPS.length}: ${hits.map((h) => `${h.vp} [${h.under ? h.under.tid : '?'} ${JSON.stringify(h.diff)}]`).join(' | ')}` : `${VPS.length}개 뷰포트에서 컨트롤 작동 0(둘째 클릭이 닿은 요소: ${[...new Set(table.map((t) => (t.under ? `${t.under.tid}${t.under.dis === 'true' ? '(aria-disabled=true, 가드가 버림)' : t.under.btn ? '(버튼, 가드 아님)' : ''}` : '?')))].join(', ')})`,
            shots,
            table: table.map((t) => ({ vp: t.vp, clicks: t.clicks, diff: t.diff })),
          };
        },
      );
    }
  }
}

if (PART === 'dbl') await runDouble(['keep-cite', 'keep-manual', 'skip-empty', 'discard'], [100, 200], '공통 뷰포트 11종', 'guard-dbl.jsonl', 'G-dbl');
else if (PART === 'dec') await runDouble(['decision'], [100, 200], '공통 뷰포트 11종(모달 결정 시트)', 'guard-dec.jsonl', 'G-dec');
else if (PART === 'inline') await runDouble(['inline'], [100], '공통 뷰포트 11종(인라인 카드, 보충)', 'guard-inline.jsonl', 'G-inl');
else if (PART === 'release') {
  // (d) 과한 가드 없음: 한 번만 탭 → 450ms 뒤 배속(현재와 다른 값) 탭 → 바뀐다
  for (const T of TARGETS) {
    for (const font of T.id === 'inline' ? [100] : [100, 200]) {
      const id = `G-rel-${T.id}-${font}-run${RUN}`;
      await runCase(
        { id, cat: '입력 가드(2회차)', title: `${T.label} 한 번 탭 → 450ms 뒤 배속 탭 — 글자 ${font}% · 공통 뷰포트 11종`, steps: '버튼 한 번 탭 → 450ms 기다림 → 배속 버튼(현재와 다른 값) 탭', expected: '배속이 바뀜(과한 가드 없음)' },
        async () => {
          const bad = [];
          const table = [];
          for (const vp of VPS) {
            const r = await prepare(T, vp, font);
            if (!r) {
              bad.push({ vp: vp.name, error: 'no box' });
              continue;
            }
            const { ctx, page, x, y } = r;
            const t0 = Date.now();
            await page.touchscreen.tap(x, y);
            const wait = 450 - (Date.now() - t0);
            if (wait > 0) await sleep(wait);
            const info = await page.evaluate(() => {
              const cur = document.querySelector('[data-speed][aria-pressed="true"]');
              const curV = cur ? cur.getAttribute('data-speed') : null;
              const targetV = curV === '4' ? '2' : '4';
              const t = document.querySelector(`[data-speed="${targetV}"]`);
              if (!t) return null;
              t.scrollIntoView({ block: 'center', inline: 'center' });
              const r2 = t.getBoundingClientRect();
              return { curV, targetV, x: r2.x + r2.width / 2, y: r2.y + r2.height / 2, disabled: t.getAttribute('aria-disabled') };
            });
            if (!info) {
              bad.push({ vp: vp.name, error: 'no speed button' });
              await ctx.close();
              continue;
            }
            await sleep(100);
            await page.touchscreen.tap(info.x, info.y);
            await sleep(250);
            const now = await page.evaluate(() => { const c = document.querySelector('[data-speed][aria-pressed="true"]'); return c ? c.getAttribute('data-speed') : null; });
            const rec = { id, vp: vp.name, font, target: T.id, from: info.curV, want: info.targetV, now, guardedAtTap: info.disabled };
            table.push(rec);
            appendJsonl('guard-release.jsonl', rec);
            if (now !== info.targetV) bad.push(rec);
            await ctx.close();
          }
          return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `배속이 안 바뀐 뷰포트 ${bad.length}/${VPS.length}: ${JSON.stringify(bad).slice(0, 400)}` : `${VPS.length}/${VPS.length}에서 450ms 뒤 배속 탭이 작동`, table };
        },
      );
    }
  }
} else if (PART === 'b07') {
  const gaps = [100, 250, 380, 450, 520];
  const VPB = STD_VIEWPORTS.filter((v) => ['360x740', '320x568', '1280x800'].some((n) => v.name.startsWith(n)));
  for (const mode of ['double', 'single']) {
    for (const T of [TARGETS[0], TARGETS[1]]) {
      const id = `G-b07-${mode}-${T.id}-run${RUN}`;
      await runCase(
        { id, cat: '입력 가드(2회차)', title: `B07 간격 스윕(${mode === 'double' ? '1번 더블탭' : '1번 한 번'}) — ${T.label}: 첫 탭 뒤 100·250·380ms는 새 「생각 남기기」 시트가 안 열리고 450·520ms는 열림`, steps: '1번 탭(더블탭이면 60ms 뒤 한 번 더) → 첫 탭 기준 N ms 뒤 도구 줄 「생각 남기기」 위치 탭 → 600ms 뒤 시트 유무', expected: '400ms 안은 거부, 450 이상은 열림' },
        async () => {
          const trials = [];
          const shots = [];
          for (const vp of VPB) {
            for (const gap of gaps) {
              const r = await prepare(T, vp, 100);
              if (!r) {
                trials.push({ vp: vp.name, gap, error: 'no box' });
                continue;
              }
              const { ctx, page, x, y } = r;
              await page.evaluate(() => { window.__pd = []; document.addEventListener('pointerdown', (e) => window.__pd.push(Math.round(e.timeStamp)), true); });
              const tool = await page.getByTestId('tool-note').boundingBox();
              const [tx, ty] = [tool.x + tool.width / 2, tool.y + tool.height / 2];
              const t0 = Date.now();
              await page.touchscreen.tap(x, y);
              if (mode === 'double') {
                await sleep(60);
                await page.touchscreen.tap(x, y);
              }
              const rest = gap - (Date.now() - t0);
              if (rest > 0) await sleep(rest);
              await page.touchscreen.tap(tx, ty);
              await sleep(700);
              const pd = await page.evaluate(() => window.__pd);
              const open = await page.evaluate(() => ({ sheet: document.querySelectorAll('[data-testid="note-sheet"]').length, via: document.querySelector('[data-testid="note-sheet"]')?.getAttribute('data-via') ?? null }));
              const rowsN = (await readUi(page)).noteRows;
              const actualGap = pd.length >= 2 ? pd[pd.length - 1] - pd[0] : null;
              const rec = { id, vp: vp.name, gapNominal: gap, actualGapFromFirstTap: actualGap, opened: open.sheet > 0, via: open.via, noteRows: rowsN };
              trials.push(rec);
              appendJsonl('guard-b07.jsonl', rec);
              if (gap === 380 && vp.name.startsWith('360x740')) shots.push(await shot(page, id, `gap${gap}-${vp.name}`));
              await ctx.close();
            }
          }
          const rejectBad = trials.filter((t) => t.gapNominal < 400 && (t.opened || t.error));
          const openBad = trials.filter((t) => t.gapNominal >= 450 && (!t.opened || t.error));
          const rowsBad = trials.filter((t) => t.noteRows !== 1 && !t.error);
          const actualOver = trials.filter((t) => t.gapNominal < 400 && t.actualGapFromFirstTap !== null && t.actualGapFromFirstTap >= 400);
          const ok = !rejectBad.length && !openBad.length && !rowsBad.length;
          return { verdict: ok ? 'PASS' : 'FAIL', actual: ok ? `${trials.length}회: 400ms 안(100·250·380) ${trials.filter((t) => t.gapNominal < 400).length}회 모두 거부, 450·520ms ${trials.filter((t) => t.gapNominal >= 450).length}회 모두 열림, 기록은 늘 1줄${actualOver.length ? ` (참고: 실제 간격이 400ms를 넘긴 거부 대상 ${actualOver.length}회)` : ''}` : `거부 실패 ${rejectBad.length} / 열림 실패 ${openBad.length} / 기록 줄 이상 ${rowsBad.length}: ${JSON.stringify({ rejectBad, openBad, rowsBad }).slice(0, 600)}`, shots, trials };
        },
      );
    }
  }
}

else if (PART === 'shots') {
  for (const T of TARGETS) {
    for (const font of T.id === 'inline' ? [100] : [100, 200]) {
      const prefix = T.id === 'decision' ? 'G-dec' : T.id === 'inline' ? 'G-inl' : 'G-dbl';
      const id = `${prefix}-${T.id}-${font}-run1`;
      for (const vp of STD_VIEWPORTS.filter((v) => ['360x740', '320x568'].some((n) => v.name.startsWith(n)))) {
        const r = await prepare(T, vp, font);
        if (!r) continue;
        await r.page.touchscreen.tap(r.x, r.y);
        await sleep(60);
        await r.page.touchscreen.tap(r.x, r.y);
        await sleep(100);
        await shot(r.page, id, `${vp.name}-during`);
        await sleep(600);
        await shot(r.page, id, `${vp.name}-after`);
        await r.ctx.close();
      }
      // 해제 확인(한 번 탭 → 450ms 뒤 배속 4배 탭) 대표 샷 — 360×740 터치
      {
        const vp = STD_VIEWPORTS.find((v) => v.name.startsWith('360x740'));
        const r = await prepare(T, vp, font);
        if (r) {
          const rid = `G-rel-${T.id}-${font}-run1`;
          await r.page.touchscreen.tap(r.x, r.y);
          await sleep(450);
          const info = await r.page.evaluate(() => { const t = document.querySelector('[data-speed="4"]'); t.scrollIntoView({ block: 'center' }); const q = t.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; });
          await r.page.touchscreen.tap(info.x, info.y);
          await sleep(300);
          await shot(r.page, rid, `${vp.name}-after`);
          await r.ctx.close();
        }
      }
    }
  }
}

await b.close();
