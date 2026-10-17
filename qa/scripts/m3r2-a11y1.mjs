// QA-003 M3 접근성 1: CM10(포커스 가림)·CM11(글자 확대 넘침)·QM2-10(구분 기호·낱말 끊김)·QM2-12(띠 해제).
// 사용: node qa/scripts/m3-a11y1.mjs [vpName] [stateFilter]
import fs from 'node:fs';
import path from 'node:path';
import { launch, runCase, shot, sleep, OUT } from './m3r2-lib.mjs';
import { STD_VIEWPORTS, VARIANTS, openState, setRootFont, traverse, judgeSteps, INTERACTIVE, OVERFLOW_M3, LINE_AUDIT_M3, BAR_M3, settleScroll } from './m3r2-a11ylib.mjs';

const browser = await launch();
const onlyVp = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2] : null;
const onlyState = process.argv[3] || null;
const V = (id) => VARIANTS.find((v) => v.id === id);
const STATES = [
  { key: 'result-silver', state: 'roulette-result', v: V('present-4242-silver') },
  { key: 'result-honam', state: 'roulette-result', v: V('present-229-diamond-honam') },
  { key: 'result-past', state: 'roulette-result', v: V('past-155-dirt') },
  { key: 'result-future', state: 'roulette-result', v: V('future-138-diamond') },
  ...VARIANTS.map((v) => ({ key: `birth-${v.id}`, state: 'birth', v })),
];
const ROWS = path.join(OUT, `a11y1-rows${onlyVp ? '-' + onlyVp : ''}.jsonl`);
fs.writeFileSync(ROWS, '');
const FONTS_CM10 = [100, 200];
const FONTS_ALL = [100, 150, 200];
const ALLOWED_WORD = '전남광주통합특별시';

const agg = { cm10: [], cm11: [], line: [], bar: [], counts: { steps: 0, combos: 0, lineChars: 0, lineLines: 0, tabStops: new Set() }, releasedList: [], shots: [] };

async function measureAll(p, { vp, font, key, tabs }) {
  const tag = `${vp.name}/${font}%/${key}`;
  await setRootFont(p, font);
  await sleep(250);
  await p.evaluate(() => window.scrollTo(0, 0));
  await sleep(150);
  const ov = await p.evaluate(OVERFLOW_M3);
  const bar = await p.evaluate(BAR_M3);
  // 줄바꿈 감사: 본문·헤더·띠 글자(스크롤 위치와 무관, Range 좌표는 문서 좌표가 아니라 뷰포트 좌표라 줄 구분에는 영향 없음)
  const line = await p.evaluate(LINE_AUDIT_M3, 'main, .site-head, .bottom-bar');
  const row = { tag, vp: vp.name, font, key, ov: { px: ov.docOverflowPx, off: ov.offenders.slice(0, 4), clip: ov.clipped.slice(0, 4), bar: ov.bar, btn: ov.btn }, bar, line: { blocks: line.blocks, chars: line.chars, lines: line.lineCount, bad: line.bad.slice(0, 4), wb: line.wordBreaks.slice(0, 6) } };
  const problems = { cm11: [], line: [], bar: [] };
  // CM11
  if (ov.docOverflowPx > 0) problems.cm11.push(`${tag}: 가로 넘침 ${ov.docOverflowPx}px (${ov.offenders.slice(0, 3).join(', ')})`);
  if (ov.offenders.length) problems.cm11.push(`${tag}: 화면 밖 요소 ${ov.offenders.slice(0, 3).join(', ')}`);
  if (ov.clipped.length) problems.cm11.push(`${tag}: 잘림 ${ov.clipped.slice(0, 3).join(', ')}`);
  if (ov.btn) {
    if (ov.btn.h < 44) problems.cm11.push(`${tag}: 하단 버튼(${ov.btn.id}) 높이 ${ov.btn.h}px < 44`);
    if (!ov.btn.clickable) problems.cm11.push(`${tag}: 하단 버튼(${ov.btn.id})을 눌 수 없음(elementFromPoint가 다른 요소)`);
  }
  // QM2-10 + 낱말 끊김
  for (const b of line.bad) problems.line.push(`${tag}: ${b.kind} 「${b.ch}」 ${b.line} ⟨${b.where}⟩`);
  // 2회차: 낱말 끊김(QM3-1)은 새 독립 측정기(m3r2-l02.mjs)가 판정한다. 여기서는 옛 측정기가 센 끊김을 기록만 한다(구분 기호·숫자 단위만 판정).
  for (const w of line.wordBreaks) agg.line.push({ allowedBreak: `${tag}: ${w.word}(옛 측정기, 기록만)` });
  // QM2-12
  if (!bar.noBar) {
    if (bar.pos === 'fixed' || bar.pos === 'sticky') {
      if (bar.ratio > 0.5005) problems.bar.push(`${tag}: 고정 띠 ${bar.h}px = 화면 높이 ${bar.vh}의 ${Math.round(bar.ratio * 100)}% (>50%)인데 고정이 안 풀림`);
    } else {
      agg.releasedList.push(tag);
      if (!bar.released) problems.bar.push(`${tag}: 풀렸는데 bar-released 클래스 없음`);
      if (Math.abs(bar.barAbsBottom - bar.docH) > 1.5) problems.bar.push(`${tag}: 풀린 띠 아래끝 ${bar.barAbsBottom} ≠ 문서 끝 ${bar.docH}`);
      if (bar.lastBottomAbs !== null && bar.lastBottomAbs > bar.barAbsTop + 1.5) problems.bar.push(`${tag}: 풀린 띠가 마지막 줄과 겹침(마지막 줄 아래 ${bar.lastBottomAbs} > 띠 위끝 ${bar.barAbsTop})`);
      if (bar.scrollPadBottom > bar.sp3 + 0.5) problems.bar.push(`${tag}: 풀린 뒤 scroll-padding-bottom ${bar.scrollPadBottom} > ${bar.sp3}`);
      if (bar.endSpace && bar.endSpace.display !== 'none' && bar.endSpace.h > 0) problems.bar.push(`${tag}: 풀린 뒤에도 본문 끝 여백 ${bar.endSpace.h}px`);
    }
  }
  // CM10
  if (tabs) {
    await p.evaluate(() => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); window.scrollTo(0, 0); });
    await sleep(120);
    const tr = await traverse(p);
    const interactive = await p.evaluate(INTERACTIVE);
    const missed = interactive.filter((k) => !tr.visited.has(k));
    const pr = judgeSteps(tr.steps, tag, vp.height);
    if (missed.length) pr.push(`${tag}: 순회로 못 닿은 조작 요소 ${missed.join(',')}`);
    if (tr.visited.size === 0) pr.push(`${tag}: 순회에서 포커스를 받은 요소 0개(공허 통과)`);
    for (const k of tr.visited) agg.counts.tabStops.add(k);
    agg.counts.steps += tr.steps.filter((s) => !s.body).length;
    row.cm10 = { steps: tr.steps.filter((s) => !s.body).length, interactive, visited: [...tr.visited], problems: pr.length };
    for (const x of pr) agg.cm10.push(x);
  }
  agg.counts.combos++;
  agg.counts.lineChars += line.chars;
  agg.counts.lineLines += line.lines;
  fs.appendFileSync(ROWS, JSON.stringify(row) + '\n');
  agg.cm11.push(...problems.cm11);
  agg.line.push(...problems.line.map((x) => ({ problem: x })));
  agg.bar.push(...problems.bar);
  return { problems, row };
}

const SHOT_AT = new Set(['320x568/200%/birth-present-229-diamond-honam', '320x568/200%/result-honam', '360x740-touch/200%/birth-present-61-dirt-naju', '1280x800/100%/birth-present-229-diamond-honam', '667x375-landscape/200%/birth-present-229-diamond-honam', '320x256-zoom400/100%/birth-present-229-diamond-honam', '640x400-zoom200/100%/result-honam', '320x568/100%/result-past', '360x740-touch/100%/birth-past-155-dirt', '1280x620/100%/birth-future-138-diamond']);

for (const vp of STD_VIEWPORTS) {
  if (onlyVp && vp.name !== onlyVp) continue;
  const t0 = Date.now();
  for (const st of STATES) {
    if (onlyState && !st.key.includes(onlyState)) continue;
    const { ctx, p } = await openState(browser, vp, st.v, st.state);
    try {
      for (const font of FONTS_ALL) {
        const isCm10Font = FONTS_CM10.includes(font);
        const skipCm10 = vp.name === '320x256-zoom400' && font === 200; // 마스터 확인 4: 800% 확대 상당은 CM10 제외
        const { problems } = await measureAll(p, { vp, font, key: st.key, tabs: isCm10Font && !skipCm10 });
        const tag = `${vp.name}/${font}%/${st.key}`;
        if ((SHOT_AT.has(tag) || problems.cm11.length || problems.line.length || problems.bar.length) && agg.shots.length < 40) {
          const name = `C-${vp.name}-${font}-${st.key}${problems.cm11.length || problems.line.length || problems.bar.length ? '-FLAG' : ''}`;
          await p.evaluate(() => window.scrollTo(0, 0));
          agg.shots.push(await shot(p, 'C', name.replace('C-', '')));
        }
      }
    } catch (e) {
      agg.cm10.push(`${vp.name}/${st.key}: 스크립트 오류 ${String(e.message).slice(0, 150)}`);
    }
    await ctx.close();
  }
  console.log(`${vp.name} 완료 ${Math.round((Date.now() - t0) / 1000)}s — 누적 CM10 ${agg.cm10.length} / CM11 ${agg.cm11.length} / 줄 ${agg.line.filter((x) => x.problem).length} / 띠 ${agg.bar.length}`);
}

// 회전 중 상태(짧은 시간 안에): 폰트 100·200 각각 새로 열어 첫 Tab 1번 + 넘침·띠
for (const vp of STD_VIEWPORTS) {
  if (onlyVp && vp.name !== onlyVp) continue;
  if (onlyState && !'spin'.includes(onlyState)) continue;
  for (const font of [100, 200]) {
    const { ctx, p } = await openState(browser, vp, V('present-4242-silver'), 'roulette-spin');
    try {
      await setRootFont(p, font);
      await sleep(150);
      const ov = await p.evaluate(OVERFLOW_M3);
      const bar = await p.evaluate(BAR_M3);
      const state = await p.evaluate(() => document.querySelector('[data-testid="roulette-screen"]')?.getAttribute('data-state'));
      const tag = `${vp.name}/${font}%/spin`;
      if (state !== 'spinning') agg.cm11.push(`${tag}: 측정 시점에 이미 회전이 끝남(공허 통과 방지 — 표본 제외)`);
      else {
        if (ov.docOverflowPx > 0 || ov.offenders.length) agg.cm11.push(`${tag}: 가로 넘침 ${ov.docOverflowPx}px ${ov.offenders.slice(0, 3)}`);
        if (ov.clipped.length) agg.cm11.push(`${tag}: 잘림 ${ov.clipped.slice(0, 3)}`);
        if (ov.btn && (ov.btn.h < 44 || !ov.btn.clickable)) agg.cm11.push(`${tag}: 건너뛰기 ${ov.btn.h}px 클릭가능 ${ov.btn.clickable}`);
        if (!bar.noBar && (bar.pos === 'fixed' || bar.pos === 'sticky') && bar.ratio > 0.5005) agg.bar.push(`${tag}: 고정 띠 ${Math.round(bar.ratio * 100)}%`);
        if (!(vp.name === '320x256-zoom400' && font === 200)) {
          await p.evaluate(() => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); });
          const tr = await traverse(p);
          const pr = judgeSteps(tr.steps, tag, vp.height);
          const stateAfter = await p.evaluate(() => document.querySelector('[data-testid="roulette-screen"]')?.getAttribute('data-state'));
          if (tr.visited.size === 0) pr.push(`${tag}: 포커스 받은 요소 0개`);
          agg.cm10.push(...pr);
          agg.counts.steps += tr.steps.filter((s) => !s.body).length;
          for (const k of tr.visited) agg.counts.tabStops.add(k);
          agg.counts.combos++;
          fs.appendFileSync(ROWS, JSON.stringify({ tag, vp: vp.name, font, key: 'spin', stateAfter, visited: [...tr.visited], steps: tr.steps.filter((s) => !s.body).length }) + '\n');
        }
        if (vp.name === '360x740-touch' && font === 200) agg.shots.push(await shot(p, 'C', 'spin-360-200'));
      }
    } catch (e) {
      agg.cm10.push(`${vp.name}/spin: 스크립트 오류 ${String(e.message).slice(0, 150)}`);
    }
    await ctx.close();
  }
}

const lineProblems = agg.line.filter((x) => x.problem).map((x) => x.problem);
const allowedBreaks = agg.line.filter((x) => x.allowedBreak).map((x) => x.allowedBreak);
const summary = { counts: { ...agg.counts, tabStops: [...agg.counts.tabStops] }, released: agg.releasedList, allowedBreaks, cm10: agg.cm10, cm11: agg.cm11, line: lineProblems, bar: agg.bar, shots: agg.shots };
fs.writeFileSync(path.join(OUT, `a11y1-summary${onlyVp ? '-' + onlyVp : ''}.json`), JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ counts: summary.counts, releasedN: agg.releasedList.length, allowedBreaksN: allowedBreaks.length, cm10: agg.cm10.length, cm11: agg.cm11.length, line: lineProblems.length, bar: agg.bar.length }));
for (const k of ['cm10', 'cm11', 'bar']) for (const x of summary[k].slice(0, 12)) console.log(`${k.toUpperCase()} ${x}`.slice(0, 400));
for (const x of lineProblems.slice(0, 12)) console.log(`LINE ${x}`.slice(0, 500));
await browser.close();
