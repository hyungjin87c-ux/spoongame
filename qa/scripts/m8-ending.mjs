// QA-003 M8 엔딩 화면 플레이 시간 블록: ① 표시값 규칙(버킷별 초 버림·mm:ss·낭독·datetime·분해 합·깨끗하지 않은 판 문장·play 없음) ② 360×740 한 화면 ③ 공통 뷰포트 11 × 글자 100·200% × 라이트·다크·강제 색상 레이아웃·대비
// 사용: node qa/scripts/m8-ending.mjs <part ...>   part: display fit layout
// 엔딩 상태는 개발 서버의 core(오라클)로 한 판을 끝까지 돌려 만들고 play 필드만 정한 값으로 바꾼다. 화면은 prod 번들에서 연다.
import fs from 'node:fs';
import path from 'node:path';
import { launch, openOracle, evalCore, openSeeded, shot, sleep, runCase, appendJsonl, writeJson, STD_VIEWPORTS, setRootFont, SET_MANUAL, OUT } from './m8-lib.mjs';

const parts = process.argv.slice(2);
const browser = await launch();
const { page: oracle } = await openOracle(browser);

const endingOf = (era, seed, find = null) =>
  evalCore(
    oracle,
    `for (let seed = arg.seed; seed < arg.seed + (arg.find ? 4000 : 1); seed++) {
       const s0 = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       const r = core.playToEnd(s0, null);
       const s = r.state;
       if (s.phase !== 'ending') continue;
       if (arg.find === 'early' && !(s.death && s.death.age < 20)) continue;
       return s;
     }
     return null;`,
    { era, seed, find },
  );

const PLAYS = {
  clean: { hold: 910900, decide: 755999, fold: 123456, note: 777777, idle: 999999, offSpeed: 0, auto: 0, skips: 0, resumes: 3 },
  long: { hold: 2400000, decide: 1265000, fold: 0, note: 0, idle: 0, offSpeed: 0, auto: 0, skips: 0, resumes: 0 },
  hundred: { hold: 5000000, decide: 1000000, fold: 0, note: 0, idle: 0, offSpeed: 0, auto: 0, skips: 0, resumes: 0 },
  max: { hold: 86400000, decide: 86400000, fold: 0, note: 0, idle: 0, offSpeed: 0, auto: 0, skips: 0, resumes: 0 },
  zero: { hold: 0, decide: 0, fold: 0, note: 0, idle: 0, offSpeed: 0, auto: 0, skips: 0, resumes: 0 },
  sub59: { hold: 59999, decide: 0, fold: 0, note: 0, idle: 0, offSpeed: 0, auto: 0, skips: 0, resumes: 0 },
  half: { hold: 500, decide: 500, fold: 0, note: 0, idle: 0, offSpeed: 0, auto: 0, skips: 0, resumes: 0 },
  speed: { hold: 190000, decide: 580000, fold: 0, note: 0, idle: 0, offSpeed: 190000, auto: 0, skips: 0, resumes: 0 },
  auto: { hold: 1000000, decide: 72000, fold: 0, note: 0, idle: 0, offSpeed: 0, auto: 1072000, skips: 0, resumes: 0 },
  skips: { hold: 300000, decide: 600000, fold: 0, note: 0, idle: 0, offSpeed: 0, auto: 0, skips: 7, resumes: 0 },
  resumesOnly: { hold: 1500000, decide: 600000, fold: 0, note: 0, idle: 0, offSpeed: 0, auto: 0, skips: 0, resumes: 9 },
};
const expectOf = (p) => {
  const h = Math.floor(p.hold / 1000);
  const d = Math.floor(p.decide / 1000);
  const f = (s) => ({ text: `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`, spoken: `${Math.floor(s / 60)}분 ${s % 60}초`, iso: `PT${Math.floor(s / 60)}M${s % 60}S` });
  return { total: f(h + d), hold: f(h), decide: f(d), clean: p.offSpeed === 0 && p.auto === 0 && p.skips === 0 };
};

const READ_BLOCK = () => {
  const q = (s) => document.querySelector(s);
  const t = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
  const spans = (e) => (e ? { vis: t(e.querySelector('[aria-hidden="true"]')), sr: t(e.querySelector('.sr-only')), dt: e.getAttribute('datetime') } : null);
  const block = q('[data-testid="ending-playtime"]');
  return {
    has: !!block,
    label: block ? t(block.querySelector('dt')) : null,
    value: spans(q('[data-testid="ending-playtime-value"]')),
    hold: spans(q('[data-testid="ending-playtime-hold"]')),
    decide: spans(q('[data-testid="ending-playtime-decide"]')),
    note: t(q('[data-testid="ending-playtime-note"]')),
    choices: t(q('[data-testid="ending-choices"]')),
    death: t(q('[data-testid="ending-death"]')),
  };
};

const NOTCLEAN = '배속이나 자동 모드, 「다음 결정으로」를 쓴 판이라 1배속으로 직접 고른 판보다 짧게 잡힙니다.';

if (parts.includes('display')) {
  const base = await endingOf('present', 7);
  if (!base) throw new Error('엔딩 상태 만들기 실패');
  for (const [name, play] of Object.entries(PLAYS)) {
    await runCase({ id: `ED-${name}`, title: `엔딩 플레이 시간 표시 (${name})` }, async () => {
      const { ctx, page } = await openSeeded(browser, { ...base, play }, { wait: '[data-testid="ending-screen"]' });
      const b = await page.evaluate(READ_BLOCK);
      const e = expectOf(play);
      const problems = [];
      if (!b.has) problems.push('블록 없음');
      if (b.label !== '이 판의 플레이 시간') problems.push(`이름 ${b.label}`);
      if (!b.value || b.value.vis !== e.total.text) problems.push(`값 ${b.value && b.value.vis} ≠ ${e.total.text}`);
      if (!b.value || b.value.sr !== e.total.spoken) problems.push(`낭독 ${b.value && b.value.sr} ≠ ${e.total.spoken}`);
      if (!b.value || b.value.dt !== e.total.iso) problems.push(`datetime ${b.value && b.value.dt} ≠ ${e.total.iso}`);
      if (!b.hold || b.hold.vis !== e.hold.text || b.hold.sr !== e.hold.spoken) problems.push(`분해 연출 ${b.hold && b.hold.vis}/${b.hold && b.hold.sr} ≠ ${e.hold.text}`);
      if (!b.decide || b.decide.vis !== e.decide.text || b.decide.sr !== e.decide.spoken) problems.push(`분해 결정 ${b.decide && b.decide.vis}/${b.decide && b.decide.sr} ≠ ${e.decide.text}`);
      // 분해 두 값의 합 = 표시값
      const toSec = (v) => (v ? Number(v.vis.split(':')[0]) * 60 + Number(v.vis.split(':')[1]) : NaN);
      if (toSec(b.hold) + toSec(b.decide) !== toSec(b.value)) problems.push(`분해 합 ${toSec(b.hold) + toSec(b.decide)} ≠ 표시값 ${toSec(b.value)}`);
      const hasNot = !!b.note && b.note.includes(NOTCLEAN);
      if (hasNot === e.clean) problems.push(`깨끗하지 않은 판 문장 ${hasNot} (깨끗한 판 ${e.clean})`);
      if (b.note && /이어|이어하기|횟수|일시정지/.test(b.note)) problems.push('이어하기·일시정지 횟수가 보인다');
      if (b.note && !b.note.includes('이 기기에만 저장됩니다.')) problems.push('저장 범위 문장 없음');
      if (b.note && !b.note.includes('멈춰 있던 시간과 생각을 적은 시간은 넣지 않았습니다.')) problems.push('제외 문장 없음');
      const s = await shot(page, `ED-${name}`, 'block');
      await ctx.close();
      return { verdict: problems.length === 0 ? 'PASS' : 'FAIL', actual: problems.length === 0 ? `${b.value.vis} (${b.value.sr}) = ${b.hold.vis} + ${b.decide.vis}, 깨끗하지 않음 문장 ${hasNot}` : problems.join(' / '), shots: [s] };
    });
  }
  await runCase({ id: 'ED-none', title: '엔딩: play 필드가 없는 판(M8 이전 저장)은 블록이 없고 선택 수 줄은 그대로' }, async () => {
    const { play, ...noPlay } = { ...base, play: undefined };
    const raw = JSON.parse(JSON.stringify(noPlay));
    delete raw.play;
    const { ctx, page } = await openSeeded(browser, raw, { wait: '[data-testid="ending-screen"]' });
    const b = await page.evaluate(READ_BLOCK);
    const s = await shot(page, 'ED-none', 'no-block');
    await ctx.close();
    return { verdict: !b.has && b.choices && b.choices.length > 0 ? 'PASS' : 'FAIL', actual: `블록 ${b.has}, 선택 수 줄 「${b.choices}」`, shots: [s] };
  });
}

if (parts.includes('fit')) {
  // 형진 님 실측 캡처 한 장: 360×740 한 화면에 머리(세상·나이)·선택 수·플레이 시간(보조 문장까지)이 들어오는가
  const eras = ['past', 'present', 'future'];
  for (const era of eras) {
    const st = await endingOf(era, 11);
    for (const [pname, play] of [['clean', PLAYS.clean], ['speed', PLAYS.speed], ['long', PLAYS.long]]) {
      for (const scheme of ['light', 'dark']) {
        await runCase({ id: `EF-${era}-${pname}-${scheme}`, title: `엔딩 360×740 한 화면 (${era}, ${pname}, ${scheme})` }, async () => {
          const { ctx, page } = await openSeeded(browser, { ...st, play }, { vp: { width: 360, height: 740 }, touch: true, extraCtx: { colorScheme: scheme }, wait: '[data-testid="ending-screen"]' });
          await sleep(300);
          const m = await page.evaluate(() => {
            const R = (s) => {
              const e = document.querySelector(s);
              if (!e) return null;
              const r = e.getBoundingClientRect();
              return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) };
            };
            return { vh: window.innerHeight, scrollY: window.scrollY, head: R('[data-testid="ending-name"]') || R('[data-testid="ending-era"]'), era: R('[data-testid="ending-era"]'), death: R('[data-testid="ending-death"]'), choices: R('[data-testid="ending-choices"]'), block: R('[data-testid="ending-playtime"]'), value: R('[data-testid="ending-playtime-value"]'), note: R('[data-testid="ending-playtime-note"]'), docH: document.documentElement.scrollHeight };
          });
          const inView = (r) => r !== null && r.t >= 0 && r.b <= m.vh;
          const ok = inView(m.death) && inView(m.choices) && inView(m.block) && inView(m.note) && inView(m.value);
          const s = await shot(page, `EF-${era}-${pname}-${scheme}`, '360x740');
          await ctx.close();
          return { verdict: ok ? 'PASS' : 'FAIL', actual: `뷰포트 높이 ${m.vh}: 머리 ${JSON.stringify(m.era || m.head)} / 사망 문장 ${m.death && m.death.t}~${m.death && m.death.b} / 선택 수 ${m.choices && m.choices.t}~${m.choices && m.choices.b} / 플레이 시간 블록 ${m.block && m.block.t}~${m.block && m.block.b} (값 ${m.value && m.value.b}, 보조 ${m.note && m.note.b})`, shots: [s] };
        });
      }
    }
  }
}

if (parts.includes('layout')) {
  const early = await endingOf('present', 1, 'early');
  const states = [
    ['clean-present', await endingOf('present', 21), PLAYS.clean],
    ['speed-past', await endingOf('past', 22), PLAYS.speed],
    ['hundred-future', await endingOf('future', 23), PLAYS.hundred],
    ['max-present', await endingOf('present', 24), PLAYS.max],
    ['long-past', await endingOf('past', 25), PLAYS.long],
    ['zero-future', await endingOf('future', 26), PLAYS.zero],
  ];
  if (early) states.push(['early-present', early, PLAYS.auto]);
  else appendJsonl('ending-layout.jsonl', { note: '20세 전 엔딩 표본을 찾지 못함' });
  const schemes = [
    ['light', { colorScheme: 'light' }],
    ['dark', { colorScheme: 'dark' }],
    ['forced', { forcedColors: 'active', colorScheme: 'light' }],
  ];
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const la = L(a); const lb = L(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  let total = 0;
  const bad = [];
  let minContrast = { light: 99, dark: 99 };
  for (const [sname, st, play] of states) {
    for (const vp of STD_VIEWPORTS) {
      for (const [schName, schOpts] of schemes) {
        const { ctx, page } = await openSeeded(browser, { ...st, play }, { vp, touch: !!vp.touch, extraCtx: schOpts, wait: '[data-testid="ending-screen"]' });
        for (const pct of [100, 200]) {
          await setRootFont(page, pct);
          await sleep(120);
          const m = await page.evaluate(() => {
            const q = (s) => document.querySelector(s);
            const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
            const block = q('[data-testid="ending-playtime"]');
            const times = [...block.querySelectorAll('time')];
            const note = q('[data-testid="ending-playtime-note"]');
            const row = block.querySelector('.playtime__row');
            const doc = document.documentElement;
            const parseC = (s) => { const m = /rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[, /]+([\d.]+))?/.exec(s); return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])] : null; };
            const bgOf = (e) => {
              let x = e;
              while (x) {
                const c = parseC(getComputedStyle(x).backgroundColor);
                if (c && c[3] > 0.99) return c;
                x = x.parentElement;
              }
              return [255, 255, 255, 1];
            };
            const colorsOf = (e) => ({ fg: parseC(getComputedStyle(e).color), bg: bgOf(e), raw: getComputedStyle(e).color });
            // 줄바꿈: 각 time이 한 줄에 그려졌는가(높이가 한 줄 높이의 1.5배 미만)
            const timeInfo = times.map((t) => {
              const rects = [...t.getClientRects()];
              return { text: t.textContent.replace(/\s+/g, ' ').trim().slice(0, 20), lines: rects.length, ws: getComputedStyle(t).whiteSpace };
            });
            const noteRects = R(note);
            const clipped = [block, note, row].some((e) => e.scrollWidth > e.clientWidth + 1);
            // 가려짐: 값 중심점의 최상단 요소가 값 안에 있는가
            const vr = R(q('[data-testid="ending-playtime-value"]'));
            const cx = (vr.l + vr.r) / 2;
            const cy = (vr.t + vr.b) / 2;
            let covered = false;
            if (cy >= 0 && cy <= window.innerHeight) {
              const top = document.elementFromPoint(cx, cy);
              covered = !(top && block.contains(top));
            }
            return {
              overflowX: doc.scrollWidth > doc.clientWidth,
              vw: window.innerWidth,
              block: R(block),
              note: noteRects,
              value: vr,
              timeInfo,
              clipped,
              covered,
              contrast: { dt: colorsOf(block.querySelector('dt')), value: colorsOf(q('[data-testid="ending-playtime-value"]')), note: colorsOf(note) },
              text: block.innerText.replace(/\s+/g, ' ').slice(0, 400),
            };
          });
          total++;
          const issues = [];
          if (m.overflowX) issues.push('문서 가로 넘침');
          if (m.block.l < -0.5 || m.block.r > m.vw + 0.5) issues.push(`블록이 화면 밖 ${Math.round(m.block.l)}~${Math.round(m.block.r)}/${m.vw}`);
          if (m.clipped) issues.push('블록/보조 문장/행이 잘림(scrollWidth>clientWidth)');
          for (const t of m.timeInfo) if (t.lines > 1 || t.ws !== 'nowrap') issues.push(`시간 값 줄바꿈/비-nowrap ${t.text} lines=${t.lines} ws=${t.ws}`);
          if (m.covered) issues.push('값이 다른 요소에 가려짐');
          const cr = {};
          if (schName !== 'forced') {
            for (const k of ['dt', 'value', 'note']) {
              const c = m.contrast[k];
              const r = ratio(c.fg, c.bg);
              cr[k] = +r.toFixed(2);
              if (r < minContrast[schName]) minContrast[schName] = r;
              if (r < 4.5) issues.push(`대비 ${k} ${r.toFixed(2)} < 4.5`);
            }
          }
          const rec = { state: sname, vp: vp.name, scheme: schName, pct, issues, contrast: cr, blockBottom: Math.round(m.block.b), note: m.note.h };
          appendJsonl('ending-layout.jsonl', rec);
          if (issues.length) bad.push(rec);
        }
        // 대표 장면만 스크린샷
        const key = (vp.name === '360x740-touch' && sname === 'clean-present') || (vp.name === '320x568' && sname === 'max-present') || (vp.name === '320x256-zoom400' && sname === 'hundred-future');
        if (key) {
          await setRootFont(page, 200);
          await sleep(150);
          await page.evaluate(() => document.querySelector('[data-testid="ending-playtime"]').scrollIntoView({ block: 'center', behavior: 'instant' }));
          await sleep(200);
          await shot(page, `EL-${sname}-${vp.name}-${schName}`, 'text200');
        }
        await ctx.close();
      }
    }
  }
  writeJson('ending-layout-summary.json', { total, bad: bad.length, minContrast });
  await runCase({ id: 'EL01', title: `엔딩 플레이 시간 블록 레이아웃 ${total}조합 (상태 ${states.length} × 뷰포트 ${STD_VIEWPORTS.length} × 라이트·다크·강제 색상 × 글자 100·200%)` }, async () => ({
    verdict: bad.length === 0 ? 'PASS' : 'FAIL',
    actual: `${total}조합 중 문제 ${bad.length}건, 최저 대비 라이트 ${minContrast.light.toFixed(2)} 다크 ${minContrast.dark.toFixed(2)}${bad.length ? ' · 예: ' + JSON.stringify(bad.slice(0, 4)) : ''}`,
    shots: [],
  }));
}

await browser.close();
console.log('parts done', parts.join(','));
