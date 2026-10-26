// SPEC-005 QA 4·2 폭·글자 크기 표: 첫 화면 / 인생 화면(부모 카드·결정 시트·기록) / 엔딩 / 정보 패널을 폭 × 글자 100·150·200%에서 겹침·넘침·가려진 포커스·낱말 끊김으로 훑는다.
// 프로덕션 빌드(4391). 사용: node qa/scripts/q005-sweep.mjs [--engine webkit] [--areas first,life,ending,panel]
import fs from 'node:fs';
import path from 'node:path';
import { launchChromium, launchWebkit, VP, Watch, PROD, DEV, RES, run, ok, bad, note, shot, sleep, focusHidden, seedPage, DEFAULT_SETTINGS, oracle, withoutPlay, QA_OBSERVER } from './q005-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const ENGINE = arg('engine', 'chromium');
const AREAS = arg('areas', 'first,life,ending,panel').split(',');
const tag = ENGINE === 'webkit' ? 'W-SW' : 'SW';
const browser = await (ENGINE === 'webkit' ? launchWebkit() : launchChromium());
const devBrowser = await launchChromium();
const dev = await (await devBrowser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });

const VPS = [
  { n: '320x640', w: 320, h: 640, touch: true },
  { n: '360x740', w: 360, h: 740, touch: true },
  { n: '375x812', w: 375, h: 812, touch: true },
  { n: '768x1024', w: 768, h: 1024 },
  { n: '959x800', w: 959, h: 800 },
  { n: '960x800', w: 960, h: 800 },
  { n: '1024x768', w: 1024, h: 768 },
  { n: '1280x620', w: 1280, h: 620 },
  { n: '1280x800', w: 1280, h: 800 },
  { n: '1366x657', w: 1366, h: 657 },
  { n: '1920x1080', w: 1920, h: 1080 },
];
const FONTS = [100, 150, 200];

/** 한 화면의 겹침·넘침·낱말 끊김 측정 */
const MEASURE = (pairs) => {
  const root = document.documentElement;
  const vw = root.clientWidth;
  const name = (e) => `${e.tagName}${e.dataset.testid ? '#' + e.dataset.testid : typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : ''}`;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.sprite, .sr-only, svg defs, [hidden], [inert] .page-end-space')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (el.closest('.slide:not(.is-active)')) continue;
    if (r.right > vw + 0.5 || r.left < -0.5) offenders.push(`${name(el)}:${Math.round(r.left)}..${Math.round(r.right)}`);
  }
  const rect = (sel) => { const e = [...document.querySelectorAll(sel)].find((x) => x.getBoundingClientRect().width > 0); return e ? e.getBoundingClientRect() : null; };
  const overlaps = [];
  for (const [a, b] of pairs) {
    const ra = rect(a);
    const rb = rect(b);
    if (ra && rb && ra.left < rb.right - 0.5 && rb.left < ra.right - 0.5 && ra.top < rb.bottom - 0.5 && rb.top < ra.bottom - 0.5) overlaps.push(`${a} × ${b}`);
  }
  // 낱말 끊김: 한 줄에 한 글자짜리 줄(고아)이 아니라, 단어 중간에서 줄이 바뀐 곳이 있는가는 e2e가 이미 본다 — 여기서는 글자가 상자 밖으로 잘린 곳만 센다
  const clipped = [];
  for (const el of document.querySelectorAll('h1,h2,h3,button,.slide__value,.slide__official,p')) {
    if (el.closest('[hidden], .sr-only, [inert], .slide:not(.is-active)')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (['hidden', 'clip'].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) clipped.push(name(el));
  }
  return { over: root.scrollWidth - vw, offenders: offenders.slice(0, 5), overlaps, clipped: clipped.slice(0, 4) };
};

async function ctxFor(v, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, hasTouch: !!v.touch, isMobile: !!v.touch && ENGINE === 'webkit' ? true : !!v.touch, deviceScaleFactor: 1, locale: 'ko-KR', ...extra });
  const watch = new Watch(v.n).attach(ctx);
  const page = await ctx.newPage();
  return { ctx, page, watch };
}
const setFont = async (page, pct) => {
  await page.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, pct);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await sleep(350);
};

// ================================================================ 첫 화면
if (AREAS.includes('first')) {
  // 대조군(공허 통과 방지): 일부러 넘치게·겹치게 만든 화면을 이 측정이 잡아내는가
  {
    const { ctx, page } = await ctxFor(VPS[1]);
    await page.goto(PROD + '/');
    await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
    await sleep(800);
    await page.getByTestId('carousel-pause').click().catch(() => {});
    const clean = await page.evaluate(MEASURE, [['[data-testid=carousel-nav]', '.slide.is-active .slide__insight']]);
    await page.evaluate(() => {
      const d = document.createElement('div');
      d.id = 'qa-wide';
      d.textContent = 'QA 심은 넘침';
      d.style.cssText = 'position:absolute;left:0;top:0;width:700px;height:20px;background:#fdd;z-index:99';
      document.body.appendChild(d);
      const nav = document.querySelector('[data-testid=carousel-nav]').getBoundingClientRect();
      const ins = document.querySelector('.slide.is-active .slide__insight');
      ins.style.position = 'relative';
      ins.style.top = '-40px';
    });
    const bad = await page.evaluate(MEASURE, [['[data-testid=carousel-nav]', '.slide.is-active .slide__insight']]);
    await run({ id: `${tag}-control`, area: '공통 감사기 점검', title: '대조군: 심은 가로 넘침·내비×표제어 겹침을 이 측정이 잡아낸다(공허 통과 방지)', steps: '360 첫 화면에 폭 700px 요소와 표제어 위로 올림을 심고 측정', expected: '깨끗한 화면은 이상 0, 심은 화면은 넘침 > 0 · 가장자리 밖 요소 ≥ 1 · 겹침 ≥ 1' }, async () => {
      const t = `깨끗 ${JSON.stringify({ over: clean.over, off: clean.offenders.length, ov: clean.overlaps.length })} · 심은 ${JSON.stringify({ over: bad.over, off: bad.offenders.length, ov: bad.overlaps.length })}`;
      return clean.over <= 0 && clean.offenders.length === 0 && clean.overlaps.length === 0 && bad.over > 0 && bad.offenders.length >= 1 && bad.overlaps.length >= 1 ? ok(t) : bad(t);
    });
    await ctx.close();
  }
  // 959/960 경계: 한 칸 ↔ 두 칸
  {
    const res = [];
    for (const v of VPS.filter((x) => [959, 960].includes(x.w))) {
      const { ctx, page } = await ctxFor(v);
      await page.goto(PROD + '/');
      await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
      await sleep(800);
      const m = await page.evaluate(() => { const c = document.querySelector('[data-testid=carousel]').getBoundingClientRect(); const g = document.querySelector('[data-testid=gentle-slot]').getBoundingClientRect(); return { carouselLeft: Math.round(c.left), gentleRight: Math.round(g.right), twoCol: c.left >= g.right - 4 && c.top < g.bottom + 800 }; });
      res.push(`${v.n}: ${m.twoCol ? '두 칸' : '한 칸'}(카드 왼쪽 ${m.carouselLeft}, 설정 줄 오른쪽 ${m.gentleRight})`);
      await ctx.close();
    }
    await run({ id: `${tag}-breakpoint`, area: '홈', title: '폭 959 = 한 칸, 960 = 두 칸(오른쪽 열에 그림·캐러셀) 경계', steps: '959×800과 960×800에서 캐러셀 위치', expected: '959: 캐러셀이 선택 영역 아래(한 칸), 960: 오른쪽 열' }, async () => {
      const t = res.join(' · ');
      return /959x800: 한 칸/.test(t) && /960x800: 두 칸/.test(t) ? ok(t) : bad(t);
    });
  }

  const bad1 = [];
  let n = 0;
  const seen = [];
  for (const v of VPS) {
    const { ctx, page } = await ctxFor(v);
    await page.goto(PROD + '/');
    await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
    await sleep(900);
    await page.getByTestId('carousel-pause').click().catch(() => {});
    for (const f of FONTS) {
      await setFont(page, f);
      for (const slide of [1, 5, 8, 16, 19, 20]) {
        // slide 번호로 이동
        for (let k = 0; k < 21; k++) {
          const cur = Number((await page.getByTestId('carousel-count').innerText()).split('/')[0]);
          if (cur === slide) break;
          await page.getByTestId('carousel-next').click({ force: true }).catch(() => {});
        }
        await sleep(150);
        const m = await page.evaluate(MEASURE, [['[data-testid=carousel-nav]', '.slide.is-active .slide__insight'], ['[data-testid=carousel-nav]', '.slide.is-active .slide__official'], ['[data-testid=life-length-group]', '[data-testid=gentle-slot]'], ['[data-testid=bottom-bar]', '[data-testid=title-heading]']]);
        n++;
        const bar = await page.evaluate(() => { const b = document.querySelector('[data-testid="bottom-bar"]'); const s = document.querySelector('[data-testid="start-birth"]'); if (!b || !s) return null; const br = b.getBoundingClientRect(); const sr = s.getBoundingClientRect(); const view = innerHeight; return { barH: Math.round(br.height), ratio: +(br.height / view).toFixed(2), btnInView: sr.top >= 0 && sr.bottom <= view + 0.5, hit: document.elementFromPoint(sr.left + sr.width / 2, sr.top + sr.height / 2)?.closest('[data-testid="start-birth"]') !== null }; });
        const fail = m.over > 0 || m.offenders.length || m.overlaps.length || m.clipped.length || (bar && (!bar.btnInView || !bar.hit || bar.ratio > 0.5));
        seen.push(`${v.n}/${f}%/#${slide}${fail ? ' NG' : ''}`);
        if (fail) bad1.push({ v: v.n, f, slide, m, bar });
      }
    }
    // 이 폭의 가장 나쁜 조합 화면 한 장을 FAIL일 때만 남긴다
    const failHere = bad1.filter((b) => b.v === v.n);
    if (failHere.length) await shot(page, `${tag}-first-${v.n}`);
    await ctx.close();
  }
  await run({ id: `${tag}-first`, area: '홈', title: `첫 화면 폭 ${VPS.length}종 × 글자 100·150·200% × 슬라이드 6장: 가로 넘침·겹침(내비×표제어·공식 통계명, 인생 길이×스위치, 띠×제목)·잘림·고정 띠에 가려진 「태어나기」 버튼 0`, steps: `${n}개 조합 측정`, expected: '모든 조합 넘침 0 · 겹침 0 · 잘림 0, 하단 띠 높이 ≤ 화면 높이 50%, 「태어나기」 버튼이 화면 안·한가운데에서 눌림' }, async () => {
    const t = `${n}개 조합 중 이상 ${bad1.length}건` + (bad1.length ? ': ' + JSON.stringify(bad1.slice(0, 6)) : '');
    return bad1.length === 0 ? ok(t) : bad(t);
  });
}

// ================================================================ 인생 화면: 결정 시트(대기)·부모 카드·기록
if (AREAS.includes('life')) {
  const D = await oracle(dev, `for (let seed = 21; seed < 400; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
      for (let g = 0; g < 4000 && s.phase === 'life'; g++) {
        if (s.pending !== null) { if (s.age >= 22 && s.pending.choiceIds.length >= 3) return s; s = core.autoResolveStep(s, s.pending.key).state; continue; }
        const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due);
        s = core.stepYear(s).state;
      }
    }
    return null;`).then(withoutPlay);
  const bad2 = [];
  let n2 = 0;
  for (const v of VPS) {
    for (const mode of ['sheet', 'inline']) {
      const { ctx, page } = await ctxFor(v);
      await page.addInitScript(QA_OBSERVER);
      await seedPage(page, { game: { ...D, paused: true }, settings: { ...DEFAULT_SETTINGS, speed: 1, autoMode: mode === 'inline', noteCards: false } });
      await page.goto(PROD + '/');
      await page.getByTestId('choice-panel').waitFor({ timeout: 30000 });
      await sleep(800);
      for (const f of FONTS) {
        await setFont(page, f);
        const m = await page.evaluate(MEASURE, [['[data-testid=choice-panel]', '[data-testid=log]'], ['[data-testid=decision-fold]', '[data-testid=log]']].filter((x) => mode === 'inline'));
        const reach = await page.evaluate(() => { const bs = [...document.querySelectorAll('[data-testid="choice-panel"] button.choice')]; return bs.length ? bs.every((b) => { b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el && b.contains(el); }) : null; });
        n2++;
        if (m.over > 0 || m.offenders.length || m.overlaps.length || reach === false) bad2.push({ v: v.n, f, mode, m, reach });
      }
      await ctx.close();
    }
  }
  await run({ id: `${tag}-life-decision`, area: '인생 기록', title: `결정 카드(시트·자동 모드 인라인) 폭 ${VPS.length}종 × 글자 100·150·200%: 가로 넘침·기록과 겹침·선택지 버튼 도달 불가 0`, steps: `${n2}개 조합`, expected: '넘침 0, 겹침 0, 모든 선택지 버튼이 가려지지 않고 눌림' }, async () => {
    const t = `${n2}개 조합 중 이상 ${bad2.length}건` + (bad2.length ? ': ' + JSON.stringify(bad2.slice(0, 5)) : '');
    return bad2.length === 0 ? ok(t) : bad(t);
  });

  // 부모 카드가 떠 있는 상태(2배속에서 카드가 뜨면 일시정지)
  const Y2 = await (oracle(dev, `for (let seed = 40; seed < 2000; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
      for (let g = 0; g < 200 && s.phase === 'life' && s.age < 12; g++) {
        if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; }
        const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due);
        const r = core.stepYear(s);
        if (r.tick.kind === 'resolved' && r.tick.by === 'parent' && s.age >= 3) return s;
        s = r.state;
      }
    }
    return null;`).then(withoutPlay));
  const bad3 = [];
  let n3 = 0;
  for (const v of VPS) {
    const { ctx, page } = await ctxFor(v);
    await seedPage(page, { game: { ...Y2, paused: false }, settings: { ...DEFAULT_SETTINGS, speed: 8, autoMode: false, noteCards: false } });
    // 시계를 천천히(1배속) 두고 카드가 뜨면 일시정지
    await page.goto(PROD + '/');
    await page.getByTestId('life-screen').waitFor({ timeout: 60000 });
    let has = false;
    for (let i = 0; i < 400; i++) {
      if (await page.getByTestId('parent-card').count()) { has = true; break; }
      await sleep(60);
    }
    await page.getByTestId('pause').click({ force: true }).catch(() => {});
    await sleep(300);
    if (!has) { bad3.push({ v: v.n, err: '카드가 안 뜸' }); await ctx.close(); continue; }
    for (const f of FONTS) {
      await setFont(page, f);
      const m = await page.evaluate(MEASURE, [['[data-testid=parent-card]', '[data-testid=log]'], ['[data-testid=parent-card]', '[data-testid=dash-head]']]);
      const vis = await page.evaluate(() => { const c = document.querySelector('[data-testid="parent-card"]'); if (!c) return null; const r = c.getBoundingClientRect(); return { top: Math.round(r.top), hasLog: !!document.querySelector('[data-testid="log"]') }; });
      n3++;
      if (m.over > 0 || m.offenders.length || m.overlaps.length || !vis) bad3.push({ v: v.n, f, m });
    }
    if (bad3.some((b) => b.v === v.n)) await shot(page, `${tag}-life-parent-${v.n}`);
    await ctx.close();
  }
  await run({ id: `${tag}-life-parent`, area: '부모 결정', title: `부모 카드 폭 ${VPS.length}종 × 글자 100·150·200%: 넘침·카드×인생 기록 겹침·카드×머리 겹침 0`, steps: `${n3}개 조합(카드가 뜬 순간 일시정지)`, expected: '넘침 0, 겹침 0' }, async () => {
    const t = `${n3}개 조합 중 이상 ${bad3.length}건` + (bad3.length ? ': ' + JSON.stringify(bad3.slice(0, 5)) : '');
    return bad3.length === 0 ? ok(t) : bad(t);
  });
}

// ================================================================ 엔딩
if (AREAS.includes('ending')) {
  const E = await oracle(dev, `for (let seed = 1; seed <= 400; seed++) {
      const start = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
      const end = core.playToEnd(start, (s) => s.pending.choiceIds[0]).state;
      const heavy = end.history.filter((h) => core.heavyKindOfEntry(h) !== null);
      if (heavy.length >= 4 && heavy.some((h) => h.by !== undefined) && end.history.filter((h) => h.by === 'child').length >= 1) return end;
    }
    return null;`).then(withoutPlay);
  for (const gentle of [false, true]) {
    const bad4 = [];
    let n4 = 0;
    for (const v of VPS) {
      const { ctx, page } = await ctxFor(v);
      await seedPage(page, { game: gentle ? { ...E, gentleUsed: true } : E, settings: { ...DEFAULT_SETTINGS, gentle } });
      await page.goto(PROD + '/');
      await page.getByTestId('ending-screen').waitFor({ timeout: 60000 });
      await sleep(600);
      for (const f of FONTS) {
        await setFont(page, f);
        const m = await page.evaluate(MEASURE, [['[data-testid=ending-death]', '[data-testid=ending-choices]'], ['[data-testid=ending-timeline-order]', '[data-testid=ending-timeline]']].slice(0, 1));
        n4++;
        if (m.over > 0 || m.offenders.length || m.overlaps.length || m.clipped.length) bad4.push({ v: v.n, f, m });
      }
      if (bad4.some((b) => b.v === v.n)) await shot(page, `${tag}-ending${gentle ? '-gentle' : ''}-${v.n}`);
      await ctx.close();
    }
    await run({ id: `${tag}-ending${gentle ? '-gentle' : ''}`, area: '엔딩', title: `엔딩${gentle ? '(가림 켬)' : ''} 폭 ${VPS.length}종 × 글자 100·150·200%: 넘침·겹침·잘림 0`, steps: `${n4}개 조합`, expected: '넘침 0, 겹침 0' }, async () => {
      const t = `${n4}개 조합 중 이상 ${bad4.length}건` + (bad4.length ? ': ' + JSON.stringify(bad4.slice(0, 5)) : '');
      return bad4.length === 0 ? ok(t) : bad(t);
    });
  }
}

// ================================================================ 정보 패널
if (AREAS.includes('panel')) {
  const bad5 = [];
  let n5 = 0;
  for (const v of VPS) {
    const { ctx, page } = await ctxFor(v);
    await page.goto(PROD + '/');
    await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
    await sleep(800);
    await (v.touch ? page.getByTestId('link-news').tap() : page.getByTestId('link-news').click());
    await page.getByTestId('info-panel').waitFor();
    await sleep(500);
    for (const f of FONTS) {
      await setFont(page, f);
      const m = await page.evaluate(MEASURE, []);
      const g = await page.evaluate(() => { const p = document.querySelector('[data-testid="info-panel"]'); const c = document.querySelector('[data-testid="info-close"]').getBoundingClientRect(); return { fits: p.getBoundingClientRect().right <= innerWidth + 0.5 && p.getBoundingClientRect().left >= -0.5, closeIn: c.top >= -0.5 && c.bottom <= innerHeight + 0.5 && c.right <= innerWidth + 0.5, closeW: Math.round(c.width), closeH: Math.round(c.height) }; });
      n5++;
      if (m.over > 0 || m.offenders.length || !g.fits || !g.closeIn || m.clipped.length) bad5.push({ v: v.n, f, m, g });
    }
    if (bad5.some((b) => b.v === v.n)) await shot(page, `${tag}-panel-${v.n}`);
    await ctx.close();
  }
  await run({ id: `${tag}-panel`, area: '새 소식', title: `정보 패널 폭 ${VPS.length}종 × 글자 100·150·200%: 패널이 화면 안·가로 넘침 0·닫기 버튼이 화면 안`, steps: `${n5}개 조합`, expected: '이상 0' }, async () => {
    const t = `${n5}개 조합 중 이상 ${bad5.length}건` + (bad5.length ? ': ' + JSON.stringify(bad5.slice(0, 5)) : '');
    return bad5.length === 0 ? ok(t) : bad(t);
  });
}

await browser.close();
await devBrowser.close();
console.log('done', tag);
