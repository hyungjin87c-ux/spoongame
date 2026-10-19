// QA-003 M7c 무작위 조작(원숭이 시험): 시드가 있는 난수로 시트 열기·공격 글 입력·키(Esc·Enter·Tab…)·버튼·IME·새로고침·탭 가림·뷰포트/글자 크기 변경·결정 선택을 마구 섞고
// 매 단계 불변식을 점검한다 — 대화상자 ≤1, 글자 수 표시 ≤140, 저장 JSON 유효·기록 줄 모양(≤140 그래핌·≤400 단위·줄 ≤3·숨은 글자 0), 가로 넘침 0, 페이지 오류 0.
// 사용: node qa/scripts/m7c-monkey.mjs [실행 수=8] [단계 수=120]
import { launch, openOracle, plainLife, dueStateFor, openSeeded, readNote, readCard, readSave, noteRowsOf, shot, sleep, setRootFont, appendJsonl, addCase, rand } from './m7c-lib.mjs';

const RUNS = Number(process.argv[2] || 8);
const STEPS = Number(process.argv[3] || 120);
const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const gc = (s) => [...seg.segment(s)].length;
const C = String.fromCodePoint;
const FAMILY = C(0x1f468) + '‍' + C(0x1f469) + '‍' + C(0x1f467);
const POOL = [
  '오늘의 짧은 기록',
  '<script>alert(1)</script>',
  "'; DROP TABLE x;--",
  FAMILY.repeat(3),
  C(0x1f1f0, 0x1f1f7) + C(0x1f44d, 0x1f3fd),
  '가'.repeat(150),
  '가나다 '.repeat(60),
  'a\n\n\n\nb\nc\nd\ne',
  '​‍‮숨김⁦글⁩',
  ' '.repeat(30),
  '\t\n\t',
  'שלום עולם مرحبا',
  'x' + '́'.repeat(120),
  'https://example.com/' + 'a'.repeat(300),
  '&amp; &lt;b&gt;',
  'ㅤ',
  '1\n2\n3\n4\n5',
  'ㅎㅏㄴ' + C(0x1112, 0x1161, 0x11ab),
];
const VPS = [
  [360, 740],
  [320, 568],
  [375, 812],
  [667, 375],
  [768, 1024],
  [1280, 800],
  [320, 256],
];

const b = await launch();
const { page: oracle } = await openOracle(b);
const plain = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });
const infant = await dueStateFor(oracle, 'note-infant-memory', { era: 'present', paused: false });
const infant2 = await dueStateFor(oracle, 'note-infant-memory', { era: 'past', paused: false, from: 300 });

const violations = [];
let totalSteps = 0;
const hist = {};

async function check(page, run, step, action, errs) {
  const probs = [];
  const c = await readCard(page);
  const n = await readNote(page);
  if (c.dialogCount > 1) probs.push(`대화상자 ${c.dialogCount}개`);
  if (n.present && n.count !== null) {
    const m = /^(\d+)\/140$/.exec(n.count);
    if (!m || Number(m[1]) > 140) probs.push(`글자 수 표시 ${n.count}`);
  }
  if (n.docOverflow) probs.push('문서 가로 넘침');
  if (c.screen === 'error-screen') probs.push('오류 화면');
  const sv = await readSave(page);
  if (sv && sv.__raw) probs.push('저장 JSON 손상');
  if (sv && sv.data) {
    for (const r of noteRowsOf(sv)) {
      if (typeof r.text !== 'string') probs.push('기록 text가 문자열 아님');
      else {
        if (gc(r.text) > 140 || r.text.length > 400) probs.push(`기록 길이 ${gc(r.text)}/${r.text.length}`);
        if (r.text.split('\n').length > 3) probs.push('기록 3줄 초과');
        if (/[\u0000-\u0008\u000b-\u001f\u007f-\u009f​‎‏‪-‮⁦-⁩﻿\ud800-\udbff](?![\udc00-\udfff])/.test(r.text.replace(/[\ud800-\udbff][\udc00-\udfff]/g, ''))) probs.push('기록에 숨은 글자·제어 문자');
        if (r.text.trim() === '') probs.push('빈 기록 줄');
      }
    }
    if (noteRowsOf(sv).length > 40) probs.push('기록 40개 초과');
  }
  if (errs.length) probs.push(`페이지 오류: ${errs.join(' | ')}`);
  if (probs.length) {
    violations.push({ run, step, action, probs });
    appendJsonl('monkey.jsonl', { run, step, action, probs });
  }
  return probs;
}

for (let run = 0; run < RUNS; run++) {
  const rnd = rand(Number(process.argv[4] || 1000) + run * 77);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const start = run % 3 === 0 ? infant : run % 3 === 1 ? infant2 : plain;
  const vp0 = VPS[run % 3];
  const { ctx, page } = await openSeeded(b, start, { vp: { width: vp0[0], height: vp0[1] }, settings: { speed: 8, autoMode: false, noteCards: true }, wait: '[data-testid="life-screen"]' });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
  const cdp = await ctx.newCDPSession(page);
  let vis = 'visible';
  for (let step = 0; step < STEPS; step++) {
    let action = '';
    try {
      const c = await readCard(page);
      const n = await readNote(page);
      const r = rnd();
      if (c.screen !== 'life-screen') {
        action = `화면 ${c.screen}`;
        break;
      }
      if (c.mode === 'sheet' && !n.present) {
        // 결정 시트: 선택하거나 접기
        action = '결정 선택';
        await page.waitForFunction(() => { const bt = document.querySelector('[data-testid="decision-fold-btn"]'); return bt && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled; }, null, { timeout: 2500 }).catch(() => {});
        await page.locator('.choice').first().click({ timeout: 1500, force: true }).catch(() => {});
      } else if (!n.present) {
        // 시트 없음: 열기·건너뛰기·일시정지 토글·새로고침·뷰포트
        if (r < 0.5) {
          action = '생각 남기기 탭';
          await page.getByTestId('tool-note').click({ timeout: 1500, force: true }).catch(() => {});
        } else if (r < 0.65) {
          action = '다음 결정으로';
          await page.getByTestId('skip').click({ timeout: 1500, force: true }).catch(() => {});
        } else if (r < 0.75) {
          action = '새로고침';
          await page.reload({ waitUntil: 'load' });
          await sleep(300);
        } else if (r < 0.85) {
          const vp = pick(VPS);
          action = `뷰포트 ${vp.join('×')}`;
          await page.setViewportSize({ width: vp[0], height: vp[1] });
        } else if (r < 0.92) {
          const f = pick([100, 150, 200]);
          action = `글자 ${f}%`;
          await setRootFont(page, f);
        } else {
          action = '대기';
          await sleep(300);
        }
      } else {
        // 시트 열림: 무작위 조작
        if (r < 0.28) {
          const t = pick(POOL);
          action = `입력 ${JSON.stringify(t.slice(0, 14))}`;
          await page.getByTestId('note-input').focus({ timeout: 1000 }).catch(() => {});
          await page.keyboard.insertText(t).catch(() => {});
        } else if (r < 0.36) {
          const k = pick(['Escape', 'Enter', 'Tab', 'Shift+Tab', 'Backspace', 'Control+A', 'Delete', 'ArrowLeft', 'Home', 'End', 'Space']);
          action = `키 ${k}`;
          await page.keyboard.press(k).catch(() => {});
        } else if (r < 0.46) {
          action = '1번';
          await page.getByTestId('note-save').click({ timeout: 800, force: true }).catch(() => {});
        } else if (r < 0.54) {
          action = '2번';
          await page.getByTestId('note-skip').click({ timeout: 800, force: true }).catch(() => {});
        } else if (r < 0.6) {
          action = '확인 돌아가기/버리기';
          await page.getByTestId(rnd() < 0.5 ? 'note-confirm-back' : 'note-confirm-discard').click({ timeout: 800, force: true }).catch(() => {});
        } else if (r < 0.65) {
          action = '끄기/켜기';
          await page.getByTestId('note-cards-toggle').click({ timeout: 800, force: true }).catch(() => {});
        } else if (r < 0.72) {
          action = 'IME 조합';
          await page.getByTestId('note-input').focus({ timeout: 800 }).catch(() => {});
          const w = pick(['ㅎ', '하', '한', '글', 'ㅈ']);
          await cdp.send('Input.imeSetComposition', { text: w, selectionStart: w.length, selectionEnd: w.length }).catch(() => {});
          if (rnd() < 0.6) await cdp.send('Input.insertText', { text: w }).catch(() => {});
        } else if (r < 0.78) {
          action = '새로고침';
          await page.reload({ waitUntil: 'load' });
          await sleep(300);
        } else if (r < 0.84) {
          vis = vis === 'visible' ? 'hidden' : 'visible';
          action = `탭 ${vis}`;
          await page.evaluate((v) => {
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
            document.dispatchEvent(new Event('visibilitychange'));
          }, vis);
        } else if (r < 0.9) {
          const vp = pick(VPS);
          action = `뷰포트 ${vp.join('×')}`;
          await page.setViewportSize({ width: vp[0], height: vp[1] });
        } else if (r < 0.95) {
          const f = pick([100, 150, 200]);
          action = `글자 ${f}%`;
          await setRootFont(page, f);
        } else {
          action = '입력란 전체 지우기';
          await page.getByTestId('note-input').fill('', { timeout: 800 }).catch(() => {});
        }
      }
      await sleep(80 + Math.floor(rnd() * 120));
    } catch (e) {
      action += ` (조작 예외: ${String(e.message).slice(0, 60)})`;
    }
    totalSteps++;
    hist[action.split(' ')[0]] = (hist[action.split(' ')[0]] || 0) + 1;
    const probs = await check(page, run, step, action, errs.splice(0)).catch((e) => [`점검 예외 ${String(e.message).slice(0, 80)}`]);
    if (probs.length) {
      await shot(page, `monkey-${run}-${step}`, '').catch(() => {});
      break;
    }
  }
  const sv = await readSave(page).catch(() => null);
  console.log(`run ${run}: 기록 ${sv && sv.data ? noteRowsOf(sv).length : '?'}줄, 나이 ${sv && sv.data ? sv.data.age : '?'}, 위반 ${violations.filter((v) => v.run === run).length}`);
  await ctx.close();
}
await b.close();
console.log(`총 ${totalSteps}단계, 위반 ${violations.length}건`, JSON.stringify(hist));
for (const v of violations) console.log(`  run ${v.run} step ${v.step} [${v.action}]: ${v.probs.join(' / ')}`);
addCase({ id: process.argv[5] || 'MK01', cat: '무작위 조작', title: `무작위 조작 ${RUNS}판 × 최대 ${STEPS}단계(시트 열기·공격 글·키·버튼·IME·새로고침·탭 가림·뷰포트·글자 크기·결정 선택)`, steps: '시드 난수로 조작을 섞고 매 단계 불변식(대화상자 ≤1·글자 수 ≤140·저장 JSON 유효·기록 줄 모양·가로 넘침 0·페이지 오류 0)을 점검', expected: '위반 0', actual: violations.length ? `위반 ${violations.length}건: ${violations.slice(0, 4).map((v) => `run${v.run}/step${v.step}[${v.action}] ${v.probs.join(',')}`).join(' | ')}` : `${totalSteps}단계 위반 0 (${JSON.stringify(hist)})`, verdict: violations.length ? 'FAIL' : 'PASS', shots: [] });
