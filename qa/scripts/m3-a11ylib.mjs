// QA-003 M3 접근성 측정 라이브러리: 포커스 가림(CM10)·가로 넘침(CM11)·줄바꿈(QM2-10)·낱말 끊김·띠(QM2-12). 화면에서만 잰다.
import { mkctx, fixSeed, openTitle, toRoulette, waitGuard, sleep, TOUCH, STD_VIEWPORTS, setRootFont } from './m3-lib.mjs';
import { MEASURE, INTERACTIVE } from './m3-measure.mjs';
export { STD_VIEWPORTS, setRootFont, MEASURE, INTERACTIVE };

export async function settleScroll(p) {
  let last = -1;
  for (let i = 0; i < 12; i++) {
    const y = await p.evaluate(() => window.scrollY);
    if (y === last) break;
    last = y;
    await sleep(60);
  }
}

/** 변형 표본(시드·세상): 표본 스캔에서 고른 가장 긴 조합(긴 시군구·전남광주통합특별시·둘째·다이아몬드수저·지난 세상 등) */
export const VARIANTS = [
  { id: 'present-4242-silver', era: 'present', seed: 4242 },
  { id: 'present-229-diamond-honam', era: 'present', seed: 229 },
  { id: 'present-5-dirt-changwon', era: 'present', seed: 5 },
  { id: 'present-61-dirt-naju', era: 'present', seed: 61 },
  { id: 'past-155-dirt', era: 'past', seed: 155 },
  { id: 'past-183-gold-daejeon', era: 'past', seed: 183 },
  { id: 'future-138-diamond', era: 'future', seed: 138 },
];

/** 상태 열기. state: roulette-spin | roulette-result | birth. 글자 크기는 호출자가 이후에 적용한다. */
export async function openState(browser, vp, variant, state, extraCtx = {}) {
  const ctx = await mkctx(browser, { viewport: { width: vp.width, height: vp.height }, ...(vp.touch ? TOUCH : {}), ...extraCtx });
  await fixSeed(ctx, variant.seed);
  const p = await ctx.newPage();
  await openTitle(p);
  await toRoulette(p, variant.era);
  if (state === 'roulette-spin') {
    await sleep(900);
    return { ctx, p };
  }
  await waitGuard(p, 'skip-roulette');
  await p.getByTestId('skip-roulette').click();
  await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 3000 });
  if (state === 'roulette-result') {
    await sleep(500);
    return { ctx, p };
  }
  await waitGuard(p, 'to-birth');
  await p.getByTestId('to-birth').click();
  await p.waitForSelector('[data-testid="birth-screen"]', { timeout: 4000 });
  await sleep(450);
  return { ctx, p };
}

/** Tab 한 바퀴(앞) + Shift+Tab(뒤) 순회하며 매번 측정 */
export async function traverse(p) {
  const steps = [];
  const visited = new Set();
  for (const [dir, key] of [['fwd', 'Tab'], ['back', 'Shift+Tab']]) {
    let bodies = 0;
    const seenDir = new Set();
    for (let i = 0; i < 40; i++) {
      await p.keyboard.press(key);
      await sleep(60);
      await settleScroll(p);
      const m = await p.evaluate(MEASURE);
      if (m.body) {
        steps.push({ dir, i, body: true });
        if (++bodies >= 2) break;
        continue;
      }
      if (seenDir.has(m.key)) break;
      seenDir.add(m.key);
      visited.add(m.key);
      steps.push({ dir, i, ...m });
    }
  }
  return { steps, visited };
}

export function judgeSteps(steps, tag, vpHeight) {
  const problems = [];
  for (const s of steps) {
    if (s.body) continue;
    const w = `${tag} ${s.dir}${s.i + 1} ${s.key}`;
    if (s.overlaps.length) problems.push(`${w}: 링 ${s.ringTop}~${s.ringBottom}이 ${s.overlaps.map((o) => `${o.name}(${o.fTop}~${o.fBottom}) ${o.area}px²`).join(',')}에 가려짐`);
    if (!s.inView) problems.push(`${w}: 화면 밖 링 ${s.ringTop}~${s.ringBottom} (뷰포트 높이 ${vpHeight})`);
    if (!s.inViewX) problems.push(`${w}: 가로로 화면 밖`);
    if (!s.hitOk) problems.push(`${w}: 한가운데 점이 다른 요소 위(가려짐)`);
    if (s.clipped) problems.push(`${w}: 스크롤 컨테이너에 링이 잘림 ${s.clipped}`);
  }
  return problems;
}

// ---------- 가로 넘침·잘림·띠·버튼 (CM11) ----------
export const OVERFLOW_M3 = () => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const vh = window.innerHeight;
  const out = { docOverflowPx: Math.max(0, de.scrollWidth - vw), scrollW: de.scrollWidth, clientW: vw, offenders: [], clipped: [], bar: null, btn: null, rootFont: parseFloat(getComputedStyle(de).fontSize) };
  const nameOf = (e) => `${e.tagName}.${(e.className && e.className.baseVal === undefined ? e.className : '').toString().split(' ')[0]}`;
  const clippedByAncestor = (e) => {
    for (let x = e.parentElement; x && x !== document.body && x !== de; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.overflowX !== 'visible') {
        const r = x.getBoundingClientRect();
        if (r.left >= -0.5 && r.right <= vw + 0.5) return true;
      }
    }
    return false;
  };
  for (const e of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (e instanceof SVGElement && e.tagName.toLowerCase() !== 'svg') continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.width <= 1.5 || r.height <= 1.5) continue;
    if ((r.right > vw + 0.5 || r.left < -0.5) && !clippedByAncestor(e)) out.offenders.push(`${nameOf(e)}(${Math.round(r.left)}~${Math.round(r.right)} > ${vw})`);
    if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip') && e.scrollWidth > e.clientWidth + 1.5) out.clipped.push(`${nameOf(e)}(scrollW ${e.scrollWidth} > clientW ${e.clientWidth})`);
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent.trim();
    if (!t) continue;
    const pe = n.parentElement;
    if (!pe) continue;
    const pcs = getComputedStyle(pe);
    if (pcs.display === 'none' || pcs.visibility === 'hidden' || pe.closest('svg')) continue;
    let srOnly = false;
    for (let x = pe; x && x !== document.body; x = x.parentElement) {
      const xr = x.getBoundingClientRect();
      if (xr.width <= 1.5 || xr.height <= 1.5) {
        srOnly = true;
        break;
      }
    }
    if (srOnly) continue;
    let blk = pe;
    while (blk && blk !== document.body && /^inline/.test(getComputedStyle(blk).display) && blk.parentElement) blk = blk.parentElement;
    const rg = document.createRange();
    rg.selectNodeContents(n);
    const rr = rg.getBoundingClientRect();
    if (rr.width === 0) continue;
    const br = blk.getBoundingClientRect();
    if (rr.right > br.right + 1.5 || rr.left < br.left - 1.5) out.clipped.push(`글자「${t.slice(0, 14)}」 상자 ${Math.round(br.left)}~${Math.round(br.right)} 글자 ${Math.round(rr.left)}~${Math.round(rr.right)}`);
  }
  const bar = document.querySelector('[data-testid=bottom-bar]');
  if (bar) {
    const r = bar.getBoundingClientRect();
    out.bar = { h: Math.round(r.height), ratio: Math.round((r.height / vh) * 1000) / 1000, vh, pos: getComputedStyle(bar).position, released: de.classList.contains('bar-released') };
  }
  const b = document.querySelector('[data-testid=skip-roulette], [data-testid=to-birth], [data-testid=next-life]');
  if (b) {
    if (!(out.bar && out.bar.pos === 'fixed')) b.scrollIntoView({ block: 'end' });
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    out.btn = { id: b.getAttribute('data-testid'), h: Math.round(r.height), w: Math.round(r.width), clickable: !!hit && (b.contains(hit) || hit === b) };
  }
  return out;
};

// ---------- 줄바꿈(구분 기호 줄 끝·첫머리, 숫자+단위, 낱말 중간 끊김) ----------
/** root 아래 보이는 글자를 글자 하나씩 Range로 줄로 나눠 점검한다. wordBreaks: 낱말 중간에서 줄이 바뀐 곳 */
export const LINE_AUDIT_M3 = (rootSelector) => {
  const roots = [...document.querySelectorAll(rootSelector)].filter((r) => {
    const cs = getComputedStyle(r);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  });
  const bad = [];
  const wordBreaks = [];
  let blocks = 0;
  let chars = 0;
  let lineCount = 0;
  const isHidden = (e) => {
    for (let x = e; x && x !== document.body; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.display === 'none' || cs.visibility === 'hidden') return true;
      if (x.tagName === 'svg') return true;
      if (x.classList && x.classList.contains('sr-only')) return true;
      const r = x.getBoundingClientRect();
      if ((r.width <= 1.5 || r.height <= 1.5) && x.tagName !== 'SPAN' && x.tagName !== 'B') return true;
    }
    return false;
  };
  const blockOf = (node) => {
    let b = node.parentElement;
    while (b && b.parentElement && /^inline/.test(getComputedStyle(b).display)) b = b.parentElement;
    return b;
  };
  const blocksMap = new Map();
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (n.textContent === '' || isHidden(n.parentElement)) continue;
      const b = blockOf(n);
      if (!blocksMap.has(b)) blocksMap.set(b, []);
      blocksMap.get(b).push(n);
    }
  }
  for (const [blk, nodes] of blocksMap) {
    blocks++;
    const items = [];
    for (const n of nodes) {
      const s = n.textContent;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        const rg = document.createRange();
        rg.setStart(n, i);
        rg.setEnd(n, i + 1);
        const rects = rg.getClientRects();
        if (!rects.length) {
          items.push({ ch, ws: true, top: null });
          continue;
        }
        const r = rects[0];
        if (/\s/.test(ch) && r.width < 0.5) {
          items.push({ ch, ws: true, top: null });
          continue;
        }
        items.push({ ch, ws: /\s/.test(ch), top: r.top, h: r.height, left: r.left });
      }
    }
    chars += items.length;
    const lines = [];
    let cur = null;
    for (const it of items) {
      if (it.top === null) {
        it.line = cur ? lines.length - 1 : -1;
        continue;
      }
      const cy = it.top + it.h / 2;
      if (!cur || Math.abs(cy - cur.cy) > 0.45 * Math.max(it.h, cur.h)) {
        cur = { top: it.top, cy, h: it.h, chars: [] };
        lines.push(cur);
      }
      it.line = lines.length - 1;
      cur.chars.push(it);
    }
    const textOf = (l) => l.chars.map((c) => c.ch).join('').trim();
    const sample = lines.map(textOf).join(' ⏎ ').slice(0, 200);
    lines.forEach((l) => {
      const vis = l.chars.filter((c) => !c.ws);
      if (!vis.length) return;
      const first = vis[0].ch;
      const last = vis[vis.length - 1].ch;
      if (/[·/—(（]/.test(last)) bad.push({ kind: 'end', ch: last, line: textOf(l).slice(-24), where: sample });
      if (/[·/—)）,.，。]/.test(first)) bad.push({ kind: 'start', ch: first, line: textOf(l).slice(0, 24), where: sample });
      if (lines.length > 1 && vis.length <= 3 && vis.every((c) => /[·/—()（）,.，。]/.test(c.ch))) bad.push({ kind: 'alone', ch: vis.map((c) => c.ch).join(''), line: textOf(l), where: sample });
      lineCount++;
    });
    const full = items.map((c) => c.ch).join('');
    const check = (re, kind) => {
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(full))) {
        const part = items.slice(m.index, m.index + m[0].length).filter((c) => c.top !== null && !c.ws);
        if (new Set(part.map((c) => c.line)).size > 1) bad.push({ kind, ch: m[0], line: m[0], where: sample });
      }
    };
    check(/\d[\d,.]*\s?(%|명|건|세|년|월|일|시)(?![가-힣])/g, 'num-unit');
    check(/\d+월 \d+일( \d+시)?/g, 'date');
    // 낱말 중간 끊김: 공백으로 둘러싸인 한 덩어리(낱말) 안의 글자가 서로 다른 줄에 놓임
    const wre = /[가-힣A-Za-z0-9]+/g;
    let wm;
    while ((wm = wre.exec(full))) {
      const part = items.slice(wm.index, wm.index + wm[0].length).filter((c) => c.top !== null && !c.ws);
      if (part.length < 2) continue;
      if (new Set(part.map((c) => c.line)).size > 1) wordBreaks.push({ word: wm[0], where: sample.slice(0, 120), blockW: Math.round(blk.getBoundingClientRect().width) });
    }
  }
  return { blocks, chars, lineCount, bad, wordBreaks, roots: roots.length };
};

// ---------- 띠(QM2-12) ----------
export const BAR_M3 = () => {
  const bar = document.querySelector('[data-testid=bottom-bar]');
  const root = document.documentElement;
  if (!bar) return { noBar: true };
  const cs = getComputedStyle(bar);
  const r = bar.getBoundingClientRect();
  const vh = window.innerHeight;
  const sy = window.scrollY;
  const docH = Math.max(root.scrollHeight, document.body.scrollHeight);
  const lastBlock = document.querySelector('[data-testid=page-foot]');
  const lr = lastBlock ? lastBlock.getBoundingClientRect() : null;
  const end = document.querySelector('.page-end-space');
  const sp3 = (() => {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;visibility:hidden;padding-bottom:var(--sp-3)';
    document.body.appendChild(d);
    const v = parseFloat(getComputedStyle(d).paddingBottom);
    d.remove();
    return v;
  })();
  return {
    pos: cs.position,
    released: root.classList.contains('bar-released'),
    h: Math.round(r.height * 10) / 10,
    vh,
    ratio: Math.round((r.height / vh) * 1000) / 1000,
    barAbsBottom: Math.round((r.bottom + sy) * 10) / 10,
    barAbsTop: Math.round((r.top + sy) * 10) / 10,
    docH,
    lastBottomAbs: lr ? Math.round((lr.bottom + sy) * 10) / 10 : null,
    endSpace: end ? { display: getComputedStyle(end).display, h: Math.round(end.getBoundingClientRect().height) } : null,
    scrollPadBottom: parseFloat(getComputedStyle(root).scrollPaddingBottom) || 0,
    sp3,
    docOverflow: Math.max(0, root.scrollWidth - root.clientWidth),
  };
};
