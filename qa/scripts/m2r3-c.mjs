// QA-003 M2 3회차: M2-C02(줄바꿈 감사 — 푸터·첫 화면 본문·하단 띠 3상태·캐러셀 14장 × 폭 320·360·1280 × 글자 100·150·200% + 폭 훑기) · M2-C03(제목에 이름이 든 지표의 값이 화면에 눈에 보이는가 — 14장 전부)
// 기대값은 앱 모델이 아니라 저장소의 통계 JSON(src/data/koreaStats.json)에서 QA가 독립적으로 만든다. 화면은 DOM에서 「눈에 보이는 글자」만 모은다(대체 텍스트·숨긴 표 제외).
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, runCase, shot, sleep, openTitle, waitGuard, VP, TOUCH, OUT, SHOT_DIR, ROOT, ensureFixture, seedContext, openState } from './m2r3-lib.mjs';
import { OVERFLOW_AUDIT, LINE_AUDIT, setRootFont } from './m2r3-textlib.mjs';

const browser = await launch();
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);
const fx = await ensureFixture(browser);

const READ_SLIDE = () => {
  const a = document.querySelector('.slide.is-active');
  const txt = (e) => (e ? e.innerText.replace(/\s+/g, ' ').trim() : null);
  return { id: a.getAttribute('data-slide-id'), title: txt(a.querySelector('h3')), count: document.querySelector('[data-testid=carousel-count]').innerText.trim() };
};

/** 활성 슬라이드의 「눈에 보이는 글자」(대체 텍스트·숨긴 표·sr-only 제외; SVG 글자 포함) */
const VISIBLE_TEXT = () => {
  const a = document.querySelector('.slide.is-active');
  const vw = document.documentElement.clientWidth;
  const parts = [];
  const w = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (!n.textContent.trim()) continue;
    let ok = true;
    for (let x = n.parentElement; x && x !== a.parentElement; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) { ok = false; break; }
      if (x.tagName === 'TABLE' || x.tagName === 'title' || x.tagName === 'desc') { ok = false; break; }
      if (x !== a) {
        const r = x.getBoundingClientRect();
        if (x instanceof HTMLElement && (r.width <= 1.5 || r.height <= 1.5) && cs.overflow !== 'visible') { ok = false; break; }
      }
    }
    if (!ok) continue;
    const rg = document.createRange();
    rg.selectNodeContents(n);
    const rr = rg.getBoundingClientRect();
    if (rr.width <= 0 || rr.height <= 0) continue;
    parts.push({ t: n.textContent, outX: rr.right > vw + 0.5 || rr.left < -0.5 });
  }
  const side = a.querySelector('[data-testid=slide-side-value]');
  const val = a.querySelector('.slide__value');
  const basis = a.querySelector('[data-testid=slide-basis-line]') || a.querySelector('.slide__basis');
  const card = a.getBoundingClientRect();
  const rect = (e) => (e ? (({ top, bottom, left, right }) => ({ top: Math.round(top), bottom: Math.round(bottom), left: Math.round(left), right: Math.round(right) }))(e.getBoundingClientRect()) : null);
  return {
    text: parts.map((p) => p.t).join(' ').replace(/\s+/g, ' ').trim(),
    outX: parts.filter((p) => p.outX).map((p) => p.t.trim().slice(0, 20)),
    sideText: side ? side.innerText.replace(/\s+/g, ' ').trim() : null,
    sideRect: rect(side),
    sideClipped: side ? side.scrollWidth > side.clientWidth + 1 : null,
    valRect: rect(val),
    basisRect: rect(basis),
    cardRect: { left: Math.round(card.left), right: Math.round(card.right) },
    sideLines: side ? Math.round(side.getBoundingClientRect().height / parseFloat(getComputedStyle(side).lineHeight || '20')) : null,
  };
};

async function open(vp, touch, font = 100, base = 'prod') {
  const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}) });
  const p = await ctx.newPage();
  await openTitle(p);
  await waitGuard(p);
  await p.getByTestId('carousel-pause').click();
  await p.mouse.move(2, 2);
  if (process.env.QA_MUTATE === 'side') await p.addStyleTag({ content: '[data-testid=slide-side-value]{display:none !important}' }); // 측정기 점검: 조혼인율 줄을 감춘 옛 모양에서 실패가 잡히는가
  if (font !== 100) await setRootFont(p, font);
  await sleep(250);
  return { ctx, p };
}
async function nextSlide(p) {
  await p.getByTestId('carousel-next').click();
  await p.mouse.move(2, 2);
  await sleep(480);
}
const fmt = (v, d) => new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

// ---------- C02: 줄바꿈 감사 ----------
if (want('C02'))
  await runCase(
    { id: 'M2-C02', cat: '공격', title: '줄바꿈 감사(QM2-5·QM2-10) — 푸터·첫 화면 본문·하단 띠 3상태·캐러셀 14장, 폭 320·360·1280 × 글자 100·150·200%', steps: '글자 하나씩 Range로 줄을 나눠 (a) 줄 끝 · / — ( (b) 줄 첫머리 · / — ) , . (c) 구분 기호·문장부호만 남은 줄 (d) 숫자+단위·날짜 갈라짐을 잰다. 대상: 첫 화면 전체 보이는 글자(본문·푸터·카드), 활성 슬라이드 14장(일시정지·하나씩), 하단 띠 3상태(새 판=prod, 이어하기·확인 단계=개발 서버). 푸터 글자도 따로 읽는다', expected: '위 이상 0건, 가로 넘침 0px, 잘림 0, 그래프 글자 ≥ 12px, 푸터는 「통계 출처: 국가데이터처, 행정안전부, 교육부 …」 쉼표 나열' },
    async () => {
      const problems = [];
      const facts = [];
      const shots = [];
      let audits = 0;
      let charsTotal = 0;
      let linesTotal = 0;
      const footerTexts = new Set();
      for (const [tag, vp, touch] of [['320', VP.m320, true], ['360', VP.m360, true], ['1280', VP.d1280, false]]) {
        for (const font of [100, 150, 200]) {
          const { ctx, p } = await open(vp, touch, font);
          const page0 = await p.evaluate(LINE_AUDIT, '.title-page');
          audits++;
          charsTotal += page0.chars;
          linesTotal += page0.lineCount;
          for (const b of page0.bad) problems.push(`${tag}/${font}% 첫 화면 [${b.kind}] 「${b.line}」 ← ${b.where.slice(0, 90)}`);
          const foot = await p.evaluate(LINE_AUDIT, 'footer');
          audits++;
          linesTotal += foot.lineCount;
          for (const b of foot.bad) problems.push(`${tag}/${font}% 푸터 [${b.kind}] 「${b.line}」 ← ${b.where.slice(0, 90)}`);
          const footTxt = await p.evaluate(() => document.querySelector('[data-testid=stats-credit]').innerText.replace(/\s+/g, ' ').trim());
          footerTexts.add(footTxt.slice(0, 80));
          const ov0 = await p.evaluate(OVERFLOW_AUDIT);
          if (ov0.docOverflowPx > 0 || ov0.offenders.length || ov0.clipped.length) problems.push(`${tag}/${font}% 첫 화면 넘침/잘림 ${ov0.docOverflowPx}px ${ov0.offenders.slice(0, 2)} ${ov0.clipped.slice(0, 2)}`);
          if (font === 200 && (tag === '320' || tag === '360')) {
            await p.locator('footer').scrollIntoViewIfNeeded();
            await p.evaluate(() => document.querySelector('[data-testid=bottom-bar]').style.setProperty('visibility', 'hidden'));
            const name = `M2r3-C02-footer-${tag}-200.png`;
            await p.locator('footer').screenshot({ path: path.join(SHOT_DIR, name) });
            shots.push(`qa/screenshots/003/${name}`);
            await p.evaluate(() => document.querySelector('[data-testid=bottom-bar]').style.removeProperty('visibility'));
          }
          let minFs = 99;
          for (let i = 0; i < 14; i++) {
            const la = await p.evaluate(LINE_AUDIT, '.slide.is-active');
            audits++;
            charsTotal += la.chars;
            linesTotal += la.lineCount;
            const s = await p.evaluate(READ_SLIDE);
            for (const b of la.bad) problems.push(`${tag}/${font}% ${s.count} ${s.title} [${b.kind}] 「${b.line}」 ← ${b.where.slice(0, 90)}`);
            const ov = await p.evaluate(OVERFLOW_AUDIT);
            if (ov.docOverflowPx > 0) problems.push(`${tag}/${font}% ${s.count} ${s.title}: 문서 가로 넘침 ${ov.docOverflowPx}px ${ov.offenders.slice(0, 3)}`);
            else if (ov.offenders.length) problems.push(`${tag}/${font}% ${s.count} ${s.title}: 화면 밖 요소 ${ov.offenders.slice(0, 3)}`);
            if (ov.clipped.length) problems.push(`${tag}/${font}% ${s.count} ${s.title}: 잘림 ${ov.clipped.slice(0, 3)}`);
            const gt = await p.evaluate(() => {
              const a = document.querySelector('.slide.is-active');
              const svg = a.querySelector('svg');
              if (!svg) return [];
              const sb = svg.getBoundingClientRect();
              const vb = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal.width : null;
              const scale = vb ? sb.width / vb : 1;
              return [...svg.querySelectorAll('text')].map((t) => {
                const b = t.getBoundingClientRect();
                return { s: t.textContent, fs: Math.round(parseFloat(getComputedStyle(t).fontSize) * scale * 10) / 10, clip: b.left < sb.left - 0.5 || b.right > sb.right + 0.5 || b.top < sb.top - 0.5 || b.bottom > sb.bottom + 0.5 };
              });
            });
            for (const t of gt) {
              minFs = Math.min(minFs, t.fs);
              if (t.fs < 12) problems.push(`${tag}/${font}% ${s.count}: 그래프 글자 ${t.fs}px 「${t.s}」`);
              if (t.clip) problems.push(`${tag}/${font}% ${s.count}: 그래프 글자 「${t.s}」 svg 밖으로 잘림`);
            }
            if (font === 200 && (tag === '320' || tag === '360') && [0, 2, 4, 9, 12].includes(i)) {
              await p.evaluate(() => document.querySelector('[data-testid=bottom-bar]').style.setProperty('visibility', 'hidden'));
              await p.getByTestId('carousel').scrollIntoViewIfNeeded();
              const name = `M2r3-C02-${tag}-200-s${String(i + 1).padStart(2, '0')}.png`;
              await p.getByTestId('carousel').screenshot({ path: path.join(SHOT_DIR, name) });
              await p.evaluate(() => document.querySelector('[data-testid=bottom-bar]').style.removeProperty('visibility'));
              if (i === 2) shots.push(`qa/screenshots/003/${name}`);
            }
            await nextSlide(p);
          }
          facts.push(`${tag}/${font}%: 그래프 글자 최소 ${minFs}px`);
          await ctx.close();
        }
      }
      // 푸터 글자 확인
      const ft = [...footerTexts].join(' | ');
      if (![...footerTexts].every((t) => /^통계 출처: 국가데이터처, 행정안전부, 교육부 \(통계표/.test(t))) problems.push(`푸터 글자가 쉼표 나열이 아님: ${ft}`);
      // 하단 띠 3상태 (QM2-10 a): 새 판(prod)·이어하기·확인 단계(개발 서버)
      let barAudits = 0;
      for (const state of ['new', 'continue', 'confirm']) {
        for (const [tag, vp, touch] of [['320', VP.m320, true], ['360', VP.m360, true], ['1280', VP.d1280, false]]) {
          for (const font of [100, 150, 200]) {
            const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}) });
            if (state !== 'new') await seedContext(ctx, fx);
            const p = await ctx.newPage();
            await openState(p, state);
            await setRootFont(p, font);
            await sleep(300);
            await p.mouse.move(2, 2);
            const la = await p.evaluate(LINE_AUDIT, '.bottom-bar');
            audits++;
            barAudits++;
            charsTotal += la.chars;
            linesTotal += la.lineCount;
            for (const b of la.bad) problems.push(`띠 ${state} ${tag}/${font}% [${b.kind}] 「${b.line}」 ← ${b.where.slice(0, 90)}`);
            const ov = await p.evaluate(OVERFLOW_AUDIT);
            if (ov.docOverflowPx > 0 || ov.offenders.length || ov.clipped.length) problems.push(`띠 ${state} ${tag}/${font}%: 넘침/잘림 ${ov.docOverflowPx}px ${ov.offenders.slice(0, 2)} ${ov.clipped.slice(0, 2)}`);
            if (font === 200 && tag === '320') shots.push(await shot(p, 'C02', `bar-${state}-320-200`));
            await ctx.close();
          }
        }
      }
      const uniq = [...new Set(problems)];
      return {
        verdict: uniq.length ? 'FAIL' : 'PASS',
        severity: uniq.length ? '낮음' : undefined,
        actual: (uniq.length ? `이상 ${uniq.length}건: ${uniq.slice(0, 8).join(' // ')} || ` : `줄 끝 기호 0·줄 첫머리 기호·쉼표·마침표 0·기호만 남은 줄 0·숫자-단위/날짜 갈라짐 0·가로 넘침 0px·잘림 0·그래프 글자 ≥ 12px (감사 ${audits}회 = 폭 3 × 글자 3 × (본문·푸터·14장) + 띠 ${barAudits}조합, 글자 ${charsTotal.toLocaleString()}자·줄 ${linesTotal.toLocaleString()}줄) || `) + `푸터 글자: ${ft} || ` + facts.join(' ; '),
        shots,
      };
    }
  );

// ---------- C02b: 폭 훑기 — Pair(짧은 쌍)의 한 줄↔두 줄 전환 구간 ----------
if (want('C02b'))
  await runCase(
    { id: 'M2-C02b', cat: '공격', title: '짧은 쌍(Pair) 폭 훑기 — 폭 280~1280을 촘촘히 바꾸며 글자 100·150·200%에서 기준 줄·통계 기준 줄이 한 줄/두 줄 어느 쪽이든 어색하지 않은가', steps: '캐러셀 1·3·5·10번째 슬라이드(기준 줄이 A형·B형인 곳 포함)에서 폭 280~480은 10px, 480~1280은 큰 걸음으로 바꾸고 글자 100·150·200%마다 줄바꿈 감사 + 쌍이 「한 줄 A · B」 아니면 「기호 없이 두 줄」인지(어정쩡한 한 줄 반+한 줄 금지) 분류', expected: '모든 폭·글자에서 기호가 줄 가장자리에 혼자 남음 0, 쌍은 한 줄(A · B) 또는 두 줄(기호 숨김) 둘 중 하나, 가로 넘침 0' },
    async () => {
      const problems = [];
      const belowSpec = []; // 명세 범위(폭 ≥ 320, 접이식 폰 280은 글자 100%만) 밖의 관찰 — 판정 제외, 기록만
      const states = new Map(); // `${font}` → [{w, kind, state}]
      const shots = [];
      let audits = 0;
      const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 }, ...TOUCH, reducedMotion: 'reduce' });
      const p = await ctx.newPage();
      await openTitle(p);
      await waitGuard(p);
      await p.mouse.move(2, 2); // 움직임 줄이기 모드라 자동 전환이 없다(일시정지 버튼도 없음)
      const widths = [];
      for (let w = 280; w <= 480; w += 10) widths.push(w);
      for (const w of [520, 600, 700, 768, 900, 959, 960, 1100, 1280]) widths.push(w);
      const PAIR = () => {
        const out = [];
        const a = document.querySelector('.slide.is-active');
        for (const e of a.querySelectorAll('.pair')) {
          const items = [...e.querySelectorAll('.pair__item')];
          const sep = e.querySelector('.pair__sep');
          const sepShown = sep ? getComputedStyle(sep).display !== 'none' : null;
          const tops = items.map((i) => Math.round(i.getBoundingClientRect().top));
          const lines = items.map((i) => Math.round(i.getBoundingClientRect().height / (parseFloat(getComputedStyle(i).lineHeight) || 16)));
          out.push({ kind: e.className.replace('pair ', ''), sepShown, sameLine: tops.length === 2 && Math.abs(tops[0] - tops[1]) < 4, innerLines: lines, text: e.innerText.replace(/\s+/g, ' ').trim() });
        }
        return out;
      };
      for (const font of [100, 150, 200]) {
        await setRootFont(p, font);
        const rows = [];
        for (const w of widths) {
          await p.setViewportSize({ width: w, height: 800 });
          await sleep(120);
          for (const target of [0, 2, 4, 9]) {
            // 슬라이드 target으로 이동 (처음부터 센다: 현재 위치를 읽어 이동)
            for (let guard = 0; guard < 14; guard++) {
              const c = await p.evaluate(() => parseInt(document.querySelector('[data-testid=carousel-count]').innerText, 10) - 1);
              if (c === target) break;
              await p.getByTestId('carousel-next').click();
              await p.mouse.move(2, 2);
              await sleep(110);
            }
            const la = await p.evaluate(LINE_AUDIT, '.slide.is-active');
            audits++;
            for (const b of la.bad) (w < 320 && font > 100 ? belowSpec : problems).push(`폭 ${w}/${font}% 슬라이드 ${target + 1} [${b.kind}] 「${b.line}」 ← ${b.where.slice(0, 100)}`);
            const ov = await p.evaluate(OVERFLOW_AUDIT);
            if (ov.docOverflowPx > 0 || ov.offenders.length) problems.push(`폭 ${w}/${font}% 슬라이드 ${target + 1}: 가로 넘침 ${ov.docOverflowPx}px ${ov.offenders.slice(0, 2)}`);
            const pairs = await p.evaluate(PAIR);
            for (const pr of pairs) {
              // 정상 두 모양: (한 줄) 같은 줄 + 기호 보임, (두 줄) 다른 줄 + 기호 숨김. 어정쩡: 같은 줄인데 기호 숨김 / 다른 줄인데 기호 보임 / 항목 안쪽이 여러 줄
              const shape = pr.sameLine ? (pr.sepShown ? 'one' : 'BAD-hidden-sep-same-line') : pr.sepShown ? 'BAD-shown-sep-two-lines' : 'two';
              rows.push({ w, slide: target + 1, kind: pr.kind, shape, innerLines: pr.innerLines.join('/') });
              if (shape.startsWith('BAD')) problems.push(`폭 ${w}/${font}% 슬라이드 ${target + 1} ${pr.kind}: ${shape} 「${pr.text}」`);
            }
          }
        }
        states.set(font, rows);
      }
      // 한 줄↔두 줄 문턱 요약
      const thr = [];
      for (const [font, rows] of states) {
        for (const kind of ['pair--basis', 'pair--meta']) {
          // 폭 960부터는 카드가 오른쪽 열로 가서 다시 좁아진다(레이아웃 전환) — 한 열 구간(폭 < 960)에서만 단조 검사
          const rs = rows.filter((r) => r.kind === kind && r.slide === (kind === 'pair--basis' ? 3 : 1) && r.w < 960);
          const flips = [];
          for (let i = 1; i < rs.length; i++) if (rs[i].shape !== rs[i - 1].shape) flips.push(`${rs[i - 1].w}(${rs[i - 1].shape})→${rs[i].w}(${rs[i].shape})`);
          thr.push(`${font}%/${kind}: ${rs.map((r) => (r.shape === 'one' ? '1' : r.shape === 'two' ? '2' : '?')).join('')} 전환 ${flips.length}회 ${flips.join(' ')}`);
          if (flips.length > 1) problems.push(`${font}% ${kind}: 폭을 키우는 동안 한 줄↔두 줄이 ${flips.length}번 바뀜(1번만 기대) ${flips.join(' ')}`);
        }
      }
      fs.writeFileSync(path.join(OUT, 'pair-threshold.txt'), thr.join('\n') + '\n');
      await ctx.close();
      const uniq = [...new Set(problems)];
      const bs = [...new Set(belowSpec)];
      return { verdict: uniq.length ? 'FAIL' : 'PASS', severity: uniq.length ? '낮음' : undefined, actual: (uniq.length ? `이상 ${uniq.length}건: ${uniq.slice(0, 8).join(' // ')} || ` : `폭 ${widths.length}종 × 글자 3 × 슬라이드 4 = 감사 ${audits}회, 명세 범위(폭 ≥ 320) 이상 0 || `) + thr.join(' ; ') + (bs.length ? ` || [기록·명세 범위 밖: 폭 280~290 × 글자 150~200%] ${bs.length}건: ${bs.slice(0, 4).map((x) => x.slice(0, 80)).join(' // ')}` : ''), shots };
    }
  );

// ---------- C03: 제목에 이름이 든 지표의 값이 눈에 보이는가 (QM2-11) ----------
if (want('C03'))
  await runCase(
    { id: process.env.QA_MUTATE ? 'M2-C03-변이점검' : 'M2-C03', cat: '정상', title: '제목에 이름이 든 지표마다 화면에 값이 눈에 보이는가 (QM2-11) — 14장 전부, 혼인 건수 슬라이드의 「조혼인율 인구 1천 명당 4.7건」', steps: '기대값은 저장소 통계 JSON에서 QA가 독립 계산(지표 최신 값 + 제목에 이름(괄호 풀이·괄호 안 낱말 포함)이 든 계열의 최신 값). 폭 320·360·1280 × 글자 100·200%에서 일시정지하고 14장을 넘기며 DOM에서 눈에 보이는 글자(대체 텍스트·숨긴 표·sr-only 제외)만 모아 값이 들어 있는지 단언. 혼인 슬라이드는 큰 값 아래 줄인지(위치), 잘림·가로 넘침 0, 값 줄/조혼인율 줄/기준 줄 겹침 0', expected: '(슬라이드, 지표) 쌍 모두 값이 보임, 조혼인율 줄이 큰 값 바로 아래·기준 줄 위, 잘림 0' },
    async () => {
      const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'koreaStats.json'), 'utf8'));
      const inds = data.indicators.filter((i) => (i.use || []).includes('carousel'));
      const byId = new Map(inds.map((i) => [i.id, i]));
      const problems = [];
      const facts = [];
      const shots = [];
      const pairsChecked = new Set();
      // QA 독립 기대값: [{name, value(format)}]
      const expectedFor = (ind) => {
        const out = [];
        const dec = ind.decimals ?? 0;
        // 본 계열: 지표 자신(제목이 지표 이름이다)
        if (ind.kind === 'line' && ind.latest && typeof ind.latest.value === 'number') out.push({ name: ind.seriesLabel || ind.title, text: fmt(ind.latest.value, dec) });
        // 보조 계열: 제목에 이름(또는 괄호 안 낱말)이 든 것만
        for (const e of ind.extraSeries ?? []) {
          const v = e.latest?.value ?? e.series?.[e.series.length - 1]?.value;
          if (typeof v !== 'number') continue;
          const bare = e.label.replace(/\(.*?\)/g, '').trim();
          const inner = [...e.label.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
          const tokens = [bare, ...inner.flatMap((x) => x.split(/[,，·\s]+/).filter((t) => t.length >= 2))];
          if (tokens.some((t) => ind.title.includes(t))) out.push({ name: e.label, text: fmt(v, e.decimals ?? dec), side: true });
        }
        // 본 계열 라벨이 괄호 안 낱말로 제목에 든 경우(평균 초혼 연령 「남편(남자)」)도 본 계열 값 — 위에서 이미 포함
        return out;
      };
      for (const [tag, vp, touch] of [['320', VP.m320, true], ['360', VP.m360, true], ['1280', VP.d1280, false]]) {
        for (const font of [100, 200]) {
          const { ctx, p } = await open(vp, touch, font);
          await p.evaluate(() => document.querySelector('[data-testid=bottom-bar]').style.setProperty('visibility', 'hidden'));
          let sideSeen = false;
          for (let i = 0; i < 14; i++) {
            const s = await p.evaluate(READ_SLIDE);
            const ind = byId.get(s.id);
            const w = `${tag}/${font}% ${s.count} ${s.title}`;
            if (!ind) {
              problems.push(`${w}: 슬라이드 id ${s.id}가 통계 JSON에 없음`);
              await nextSlide(p);
              continue;
            }
            const vis = await p.evaluate(VISIBLE_TEXT);
            const exp = expectedFor(ind);
            if (ind.kind === 'line' && exp.length === 0) problems.push(`${w}: 기대 쌍을 못 만듦(QA 오라클 오류)`);
            for (const e of exp) {
              pairsChecked.add(`${s.id}:${e.name}`);
              if (!vis.text.includes(e.text)) problems.push(`${w}: 지표「${e.name}」의 값 ${e.text}이 눈에 보이는 글자에 없다 [보이는 글자: ${vis.text.slice(0, 90)}…]`);
              if (e.side && ind.id === 'marriage-count') {
                sideSeen = true;
                const want = `조혼인율 인구 1천 명당 ${e.text}건`;
                if (!vis.text.includes(want)) problems.push(`${w}: 「${want}」가 보이는 글자에 없다`);
                if (vis.sideText !== want) problems.push(`${w}: 값 아래 줄 글자가 「${vis.sideText}」 (기대 「${want}」)`);
                // 위치: 큰 값 줄 아래, 기준 줄 위, 잘림·넘침 없음
                const r = vis.sideRect;
                if (!r) problems.push(`${w}: 조혼인율 줄 요소 없음`);
                else {
                  if (vis.valRect && r.top < vis.valRect.bottom - 1) problems.push(`${w}: 조혼인율 줄(${r.top})이 큰 값 줄 아래(${vis.valRect.bottom})가 아님`);
                  if (vis.basisRect && r.bottom > vis.basisRect.top + 1) problems.push(`${w}: 조혼인율 줄(${r.bottom})이 기준 줄 위(${vis.basisRect.top})가 아님`);
                  if (r.left < vis.cardRect.left - 1 || r.right > vis.cardRect.right + 1) problems.push(`${w}: 조혼인율 줄이 카드 밖 ${r.left}~${r.right} vs ${vis.cardRect.left}~${vis.cardRect.right}`);
                  if (r.right > vp.width + 0.5 || r.left < -0.5) problems.push(`${w}: 조혼인율 줄이 화면 밖`);
                }
                if (vis.sideClipped) problems.push(`${w}: 조혼인율 줄 글자가 잘림`);
                const ov = await p.evaluate(OVERFLOW_AUDIT);
                if (ov.docOverflowPx > 0 || ov.offenders.length || ov.clipped.length) problems.push(`${w}: 혼인 슬라이드 넘침/잘림 ${ov.docOverflowPx}px ${ov.offenders.slice(0, 2)} ${ov.clipped.slice(0, 2)}`);
                facts.push(`${tag}/${font}%: 「${vis.sideText}」 ${vis.sideLines}줄, 큰 값 ${vis.valRect.bottom} → 조혼인율 ${r.top}~${r.bottom} → 기준 ${vis.basisRect.top}`);
                await p.getByTestId('carousel').scrollIntoViewIfNeeded();
                const name = `M2r3-C03-marriage-${tag}-${font}${process.env.QA_MUTATE ? '-mut' : ''}.png`;
                await p.getByTestId('carousel').screenshot({ path: path.join(SHOT_DIR, name) });
                shots.push(`qa/screenshots/003/${name}`);
              }
            }
            if (vis.outX.length) problems.push(`${w}: 화면 가로 밖 글자 ${vis.outX.join(',')}`);
            // 지표 이름이 아닌 다른 쌍의 값도 눈에 보이는지(슬라이드 14장 전부 한 번씩 스크린샷은 C01이 맡음)
            await nextSlide(p);
          }
          if (!sideSeen) problems.push(`${tag}/${font}%: 혼인 슬라이드를 못 찾음(공허 통과 방지)`);
          await ctx.close();
        }
      }
      if (pairsChecked.size < 14) problems.push(`검사한 (슬라이드, 지표) 쌍이 ${pairsChecked.size}개 (14 이상 기대)`);
      if (![...pairsChecked].some((k) => k.startsWith('marriage-count:조혼인율'))) problems.push('조혼인율 쌍이 검사 대상에 없음');
      const uniq = [...new Set(problems)];
      return { verdict: uniq.length ? 'FAIL' : 'PASS', severity: uniq.length ? '낮음' : undefined, actual: (uniq.length ? `이상 ${uniq.length}건: ${uniq.slice(0, 8).join(' // ')} || ` : `검사한 (슬라이드, 지표) 쌍 ${pairsChecked.size}개 모두 값이 눈에 보임 || `) + facts.join(' ; '), shots };
    }
  );

await browser.close();
