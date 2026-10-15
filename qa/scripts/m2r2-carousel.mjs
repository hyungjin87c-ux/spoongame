// QA-003 M2 2회차: 캐러셀 14장 — 문구 덤프(QM2-4 사람 눈 확인용)·금지 패턴·형식표·줄바꿈(QM2-5)·글자 확대(QM2-3 (b))
// 결과 덤프: qa/results/m2r2/slides-<뷰포트>.txt (사람이 읽는다)
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, runCase, shot, sleep, openTitle, waitGuard, VP, TOUCH, OUT, SHOT_DIR } from './m2r2-lib.mjs';
import { OVERFLOW_AUDIT, LINE_AUDIT, setRootFont } from './m2r2-textlib.mjs';

const browser = await launch();
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);
const HIDE_BAR = '[data-testid=bottom-bar]{visibility:hidden !important}';

const READ_SLIDE = () => {
  const a = document.querySelector('.slide.is-active');
  const txt = (e) => (e ? e.innerText.replace(/\s+/g, ' ').trim() : null);
  const svg = a.querySelector('svg');
  const sb = svg ? svg.getBoundingClientRect() : null;
  const vb = svg && svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal.width : null;
  const scale = vb && sb ? sb.width / vb : 1;
  const gtexts = svg
    ? [...svg.querySelectorAll('text')].map((t) => {
        const b = t.getBoundingClientRect();
        return { s: t.textContent, fs: Math.round(parseFloat(getComputedStyle(t).fontSize) * scale * 10) / 10, clip: b.left < sb.left - 0.5 || b.right > sb.right + 0.5 || b.top < sb.top - 0.5 || b.bottom > sb.bottom + 0.5 };
      })
    : [];
  const table = a.querySelector('table');
  return {
    id: a.getAttribute('data-slide-id'),
    ariaLabel: a.getAttribute('aria-label'),
    title: txt(a.querySelector('h3')),
    caption: txt(a.querySelector('.slide__caption')),
    valueLine: txt(a.querySelector('.slide__value')),
    values: [...a.querySelectorAll('[data-testid=slide-value]')].map(txt),
    units: [...a.querySelectorAll('.slide__unit')].map(txt),
    basis: txt(a.querySelector('.slide__basis')),
    legend: [...a.querySelectorAll('.legend li')].map(txt),
    graphAria: svg ? svg.getAttribute('aria-label') : null,
    graphTexts: gtexts,
    definition: txt(a.querySelector('.t-sm.t-muted')),
    meta: [...a.querySelectorAll('.slide__meta')].map(txt),
    help: txt(a.querySelector('[data-testid=slide-help]')),
    tableHead: table ? [...table.querySelectorAll('thead th')].map((e) => e.textContent.trim()) : null,
    tableCaption: table ? txt(table.querySelector('caption')) : null,
    tableRows: table ? table.querySelectorAll('tbody tr').length : null,
    count: document.querySelector('[data-testid=carousel-count]').innerText.trim(),
    allText: txt(a),
  };
};

// QM2-4 금지 패턴 (SPEC 완료 기준 (a))
const FORBID = [/당 (명|건|세|년|%)(?![가-힣])/, /(명|건|세|년|%) ?\1(?![가-힣])/, /명당 명/];

async function open(vp, touch, font = 100) {
  const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}) });
  const p = await ctx.newPage();
  await openTitle(p);
  await waitGuard(p);
  await p.addStyleTag({ content: HIDE_BAR });
  await p.getByTestId('carousel-pause').click();
  await p.mouse.move(2, 2);
  if (font !== 100) await setRootFont(p, font);
  await sleep(250);
  return { ctx, p };
}

async function nextSlide(p) {
  await p.getByTestId('carousel-next').click();
  await p.mouse.move(2, 2);
  await sleep(480);
}

// ---------- C01: 14장 문구 덤프 + 금지 패턴 + 형식 + 기준 연도 ----------
if (want('C01'))
  await runCase(
    { id: 'M2-C01', cat: '정상', title: '캐러셀 14장 값·단위·기준 줄 문구 (QM2-4) — 금지 패턴(「명당 명」 류)·형식표·기준 연도 한 값', steps: '360x740(터치)·320x568·1280x800에서 일시정지 후 14장을 모두 넘기며 제목·값 줄·단위·기준 줄·정의·범례·그래프 글자·대체 텍스트·숨긴 표 머리글·출처·통계 기준을 덤프하고(qa/results/m2r2/slides-*.txt), 모든 글자에서 「당 명」·같은 단위 연속을 검색, 기준 줄이 형식표(A·B·C·D)에 맞는지, 기준 연도 표기들이 한 값인지 본다', expected: '금지 패턴 0, 슬라이드마다 형식표 일치, 기준 줄·통계 기준 줄·그래프 마지막 점·가로축 끝의 연도가 같은 값' },
    async () => {
      const problems = [];
      const facts = [];
      const shots = [];
      for (const [tag, vp, touch] of [['360', VP.m360, true], ['320', VP.m320, true], ['1280', VP.d1280, false]]) {
        const { ctx, p } = await open(vp, touch);
        const slides = [];
        for (let i = 0; i < 14; i++) {
          const s = await p.evaluate(READ_SLIDE);
          slides.push(s);
          const el = p.getByTestId('carousel');
          await el.scrollIntoViewIfNeeded();
          if (tag !== '1280') {
            const name = `M2r2-C01-${tag}-s${String(i + 1).padStart(2, '0')}.png`;
            await el.screenshot({ path: path.join(SHOT_DIR, name) });
            if (i < 3) shots.push(`qa/screenshots/003/${name}`);
          } else if ([0, 3, 4, 5, 7, 8].includes(i)) {
            const name = `M2r2-C01-${tag}-s${String(i + 1).padStart(2, '0')}.png`;
            await el.screenshot({ path: path.join(SHOT_DIR, name) });
          }
          await nextSlide(p);
        }
        const wrap = await p.evaluate(READ_SLIDE);
        if (wrap.count !== '1 / 14') problems.push(`${tag}: 15번째가 ${wrap.count}`);
        if (slides.length !== 14 || new Set(slides.map((s) => s.id)).size !== 14) problems.push(`${tag}: 14장이 아님`);
        // 덤프
        const lines = [];
        for (const s of slides) {
          lines.push(`### ${s.count}  ${s.title}   [id=${s.id}]`);
          lines.push(`값 줄: ${s.caption ? `(${s.caption}) ` : ''}${s.valueLine ?? '(없음)'}   | 값=${JSON.stringify(s.values)} 단위=${JSON.stringify(s.units)}`);
          lines.push(`기준 줄: ${s.basis ?? '(없음)'}`);
          if (s.legend.length) lines.push(`범례: ${s.legend.join(' | ')}`);
          lines.push(`그래프 대체 텍스트: ${s.graphAria}`);
          lines.push(`그래프 글자: ${s.graphTexts.map((t) => `${t.s}(${t.fs}px)`).join(' ')}`);
          lines.push(`정의: ${s.definition}`);
          if (s.help) lines.push(`도움: ${s.help}`);
          if (s.tableHead) lines.push(`숨긴 표: 캡션「${s.tableCaption}」 머리글 ${JSON.stringify(s.tableHead)} ${s.tableRows}행`);
          for (const m of s.meta) lines.push(`${m}`);
          lines.push('');
        }
        fs.writeFileSync(path.join(OUT, `slides-${tag}.txt`), lines.join('\n'));
        // 금지 패턴: 슬라이드의 모든 글자 + 대체 텍스트 + 표 머리글 + 범례
        for (const s of slides) {
          const hay = [s.allText, s.graphAria, s.ariaLabel, s.tableCaption, ...(s.tableHead ?? []), ...s.legend, ...s.graphTexts.map((t) => t.s)].filter(Boolean).join(' \n ');
          for (const re of FORBID) {
            const m = re.exec(hay);
            if (m) problems.push(`${tag} ${s.count} ${s.title}: 금지 패턴 ${re} → 「${hay.slice(Math.max(0, m.index - 14), m.index + 18).replace(/\n/g, ' ')}」`);
          }
          // 형식표
          const year = /(\d{4})년 기준/.exec(s.basis ?? '');
          const isB = s.id === 'suicide-rate' || s.id === 'crude-death-rate' || /자살|조사망/.test(s.title);
          const isD = /주민등록|시·도별/.test(s.title);
          const isC = /초혼/.test(s.title);
          if (!s.basis) problems.push(`${tag} ${s.count} ${s.title}: 기준 줄 없음`);
          else if (isB) {
            if (!/^인구 (1천|10만) 명당 · \d{4}년 기준$/.test(s.basis)) problems.push(`${tag} ${s.count} ${s.title}: B형 기준 줄 모양 아님 「${s.basis}」`);
            if (!s.units.length || s.units[0] !== '명') problems.push(`${tag} ${s.count} ${s.title}: B형 단위가 「명」이 아님 ${JSON.stringify(s.units)}`);
          } else if (isD) {
            // D형: 범위 문구 기준 줄 (연도·범위가 있음)
            if (!/(\d{4}년)/.test(s.basis)) problems.push(`${tag} ${s.count} ${s.title}: D형 기준 줄에 연도 없음 「${s.basis}」`);
          } else if (!/^\d{4}년 기준$/.test(s.basis)) problems.push(`${tag} ${s.count} ${s.title}: A/C형 기준 줄 모양 아님 「${s.basis}」`);
          // 연도 일치: 기준 줄 연도 = 통계 기준 줄 연도 = 그래프 마지막 가로축 글자 (D형은 범위 문구라 별도)
          const metaBasis = s.meta.find((m) => m.startsWith('통계 기준:')) ?? '';
          const yMeta = /통계 기준: (\d{4})년/.exec(metaBasis);
          const axisYears = s.graphTexts.map((t) => t.s).filter((t) => /^\d{4}$/.test(t));
          if (!isD) {
            if (year && yMeta && year[1] !== yMeta[1]) problems.push(`${tag} ${s.count} ${s.title}: 기준 줄 ${year[1]}년 ≠ 통계 기준 줄 ${yMeta[1]}년`);
            if (year && axisYears.length && axisYears[axisYears.length - 1] !== year[1]) problems.push(`${tag} ${s.count} ${s.title}: 가로축 끝 ${axisYears[axisYears.length - 1]} ≠ 기준 줄 ${year[1]}`);
          }
          if (/[!！]/.test(s.allText ?? '')) problems.push(`${tag} ${s.count}: 느낌표`);
        }
        const q = slides.find((s) => s.id === 'suicide-rate' || /자살/.test(s.title));
        const d = slides.find((s) => /조사망/.test(s.title));
        facts.push(`${tag}: 14장 확인. 자살률 「${q?.valueLine}」/「${q?.basis}」, 조사망률 「${d?.valueLine}」/「${d?.basis}」`);
        await ctx.close();
      }
      return { verdict: problems.length ? 'FAIL' : 'PASS', severity: problems.length ? '낮음' : undefined, actual: (problems.length ? `이상 ${problems.length}건: ${problems.slice(0, 8).join(' // ')} || ` : '금지 패턴 0, 형식표·기준 연도 일치 || ') + facts.join(' ; ') + ' (14장 전문은 qa/results/m2r2/slides-360.txt)', shots };
    }
  );

// ---------- C02: 줄바꿈 감사 + 글자 확대 14장 ----------
if (want('C02'))
  await runCase(
    { id: 'M2-C02', cat: '공격', title: '줄바꿈(QM2-5)과 글자 확대(QM2-3 (b)) — 캐러셀 14장 + 첫 화면 본문·푸터, 폭 320·360·1280 × 글자 100·150·200%', steps: '일시정지하고 14장을 넘기며 글자 하나씩 Range로 줄을 나눠 줄 끝 「·」「/」「—」「(」·줄 첫머리 「·」「/」「—」「)」, 숫자+단위·날짜 묶음이 갈라지는지, 가로 넘침·잘림·그래프 글자 ≥ 12px를 잰다. 첫 화면 본문·푸터도 같은 방식(보이는 글자 전부)', expected: '구분 기호만 줄 가장자리에 남는 곳 0, 숫자/단위 갈라짐 0, 가로 넘침 0px, 잘림 0, 그래프 글자 ≥ 12px' },
    async () => {
      const problems = [];
      const facts = [];
      const shots = [];
      let audits = 0;
      let charsTotal = 0;
      for (const [tag, vp, touch] of [['320', VP.m320, true], ['360', VP.m360, true], ['1280', VP.d1280, false]]) {
        for (const font of [100, 150, 200]) {
          const { ctx, p } = await open(vp, touch, font);
          // 첫 화면 본문·푸터 (활성 슬라이드 포함 .title-page 전체)
          const page0 = await p.evaluate(LINE_AUDIT, '.title-page');
          audits++;
          charsTotal += page0.chars;
          for (const b of page0.bad) problems.push(`${tag}/${font}% 본문·푸터 [${b.kind}] 「${b.line}」 ← ${b.where.slice(0, 90)}`);
          const ov0 = await p.evaluate(OVERFLOW_AUDIT);
          if (ov0.docOverflowPx > 0 || ov0.offenders.length || ov0.clipped.length) problems.push(`${tag}/${font}% 첫 화면 넘침/잘림 ${ov0.docOverflowPx}px ${ov0.offenders.slice(0, 2)} ${ov0.clipped.slice(0, 2)}`);
          let minFs = 99;
          for (let i = 0; i < 14; i++) {
            const la = await p.evaluate(LINE_AUDIT, '.slide.is-active');
            audits++;
            charsTotal += la.chars;
            const s = await p.evaluate(READ_SLIDE);
            for (const b of la.bad) problems.push(`${tag}/${font}% ${s.count} ${s.title} [${b.kind}] 「${b.line}」 ← ${b.where.slice(0, 90)}`);
            const ov = await p.evaluate(OVERFLOW_AUDIT);
            if (ov.docOverflowPx > 0) problems.push(`${tag}/${font}% ${s.count} ${s.title}: 문서 가로 넘침 ${ov.docOverflowPx}px ${ov.offenders.slice(0, 3)}`);
            else if (ov.offenders.length) problems.push(`${tag}/${font}% ${s.count} ${s.title}: 화면 밖 요소 ${ov.offenders.slice(0, 3)}`);
            if (ov.clipped.length) problems.push(`${tag}/${font}% ${s.count} ${s.title}: 잘림 ${ov.clipped.slice(0, 3)}`);
            for (const t of s.graphTexts) {
              minFs = Math.min(minFs, t.fs);
              if (t.fs < 12) problems.push(`${tag}/${font}% ${s.count}: 그래프 글자 ${t.fs}px 「${t.s}」`);
              if (t.clip) problems.push(`${tag}/${font}% ${s.count}: 그래프 글자 「${t.s}」 svg 밖으로 잘림`);
            }
            // 큰 값 줄이 둘로 갈라지지 않는가는 LINE_AUDIT(num-unit)이 본다. 스크린샷: 200% 중 눈에 띄는 슬라이드
            if (font === 200 && (tag === '320' || tag === '360') && [0, 1, 2, 3, 4, 5, 9, 12].includes(i)) {
              await p.getByTestId('carousel').scrollIntoViewIfNeeded();
              const name = `M2r2-C02-${tag}-200-s${String(i + 1).padStart(2, '0')}.png`;
              await p.getByTestId('carousel').screenshot({ path: path.join(SHOT_DIR, name) });
              if (i < 2) shots.push(`qa/screenshots/003/${name}`);
            }
            if (font === 150 && tag === '320' && [9, 10, 12].includes(i)) {
              await p.getByTestId('carousel').scrollIntoViewIfNeeded();
              const name = `M2r2-C02-${tag}-150-s${String(i + 1).padStart(2, '0')}.png`;
              await p.getByTestId('carousel').screenshot({ path: path.join(SHOT_DIR, name) });
            }
            await nextSlide(p);
          }
          facts.push(`${tag}/${font}%: 그래프 글자 최소 ${minFs}px`);
          await ctx.close();
        }
      }
      const uniq = [...new Set(problems)];
      return { verdict: uniq.length ? 'FAIL' : 'PASS', severity: uniq.length ? '낮음' : undefined, actual: (uniq.length ? `이상 ${uniq.length}건: ${uniq.slice(0, 8).join(' // ')} || ` : `줄 끝/첫머리 기호 0·숫자-단위/날짜 갈라짐 0·가로 넘침 0px·잘림 0·그래프 글자 ≥ 12px (감사 ${audits}회, 글자 ${charsTotal.toLocaleString()}자) || `) + facts.join(' ; '), shots };
    }
  );


// ---------- C03: 혼인 건수 슬라이드의 조혼인율 (QM2-4 형식표 A 행) ----------
if (want('C03'))
  await runCase(
    { id: 'M2-C03', cat: '정상', title: '「혼인 건수와 조혼인율」 슬라이드에 조혼인율이 화면에 있는가 (QM2-4 형식표 A·SC2)', steps: '360·320·1280에서 일시정지 후 혼인 건수 슬라이드(10번째)로 가서 제목·값 줄·범례·그래프 대체 텍스트·정의 안의 「조혼인율」과 값(인구 1천 명당 N건)을 찾는다', expected: 'SPEC 형식표 A: 혼인 건수(건, 조혼인율은 범례에 「조혼인율 인구 1천 명당 {값}건」) — 범례에 조혼인율 값이 있다' },
    async () => {
      const problems = [];
      const facts = [];
      const shots = [];
      for (const [tag, vp, touch] of [['360', VP.m360, true], ['320', VP.m320, true], ['1280', VP.d1280, false]]) {
        const { ctx, p } = await open(vp, touch);
        for (let i = 0; i < 9; i++) await nextSlide(p);
        const s = await p.evaluate(READ_SLIDE);
        const hasLegend = s.legend.length > 0;
        const legendHas = s.legend.some((l) => /조혼인율/.test(l));
        facts.push(`${tag}: 제목 「${s.title}」, 범례 ${hasLegend ? JSON.stringify(s.legend) : '없음'}, 그래프 대체 텍스트에 조혼인율 ${/조혼인율/.test(s.graphAria ?? '')}`);
        if (!legendHas) problems.push(`${tag}: 제목은 「${s.title}」인데 화면에 조혼인율 값·범례가 없다(범례 ${hasLegend ? JSON.stringify(s.legend) : '없음'}, 정의·출처 문장에만 낱말이 나옴)`);
        if (tag === '360') {
          await p.getByTestId('carousel').scrollIntoViewIfNeeded();
          shots.push(await shot(p, 'C03', 'marriage-slide-360'));
        }
        await ctx.close();
      }
      return { verdict: problems.length ? 'FAIL' : 'PASS', severity: problems.length ? '낮음' : undefined, actual: (problems.length ? problems.join(' / ') + ' || ' : '') + facts.join(' ; '), shots };
    }
  );

await browser.close();
