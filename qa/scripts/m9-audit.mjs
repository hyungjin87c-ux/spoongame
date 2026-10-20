// QA-003 M9 공통 감사기: 화면에서만 잰다(앱 코드는 건드리지 않는다).
//  - auditLayout(page)   가로 넘침(문서·요소·잘린 글자) + 글자 겹침 + 가려진 글자 (페이지 안 함수 OVERFLOW_M3 · OVERLAP_AUDIT)
//  - auditWords(page)    낱말 중간 끊김·구분 기호 줄 끝/첫머리·숫자+단위 갈림 (LINE_AUDIT_M3, 글자 하나씩 Range로 줄을 나눔)
//  - auditFocus(page)    Tab·Shift+Tab 한 바퀴 동안 포커스가 고정 요소·화면 밖에 가려지는가 (MEASURE + judgeSteps — M2~M8과 같은 측정기)
// 기존 M3 r2 측정기(m3r2-a11ylib.mjs)를 그대로 가져다 쓰고, 겹침·가려짐 감사(OVERLAP_AUDIT)만 새로 더했다.
import { OVERFLOW_M3, LINE_AUDIT_M3, judgeSteps, settleScroll } from './m3r2-a11ylib.mjs';

export { OVERFLOW_M3, LINE_AUDIT_M3, judgeSteps };

/** M3 r2 측정기(MEASURE)의 사본 — 모달(inert) 뒤의 고정 띠를 가림 후보에서 뺀다 */
export const MEASURE_M9 = () => {
  const a = document.activeElement;
  if (!a || a === document.body || a === document.documentElement) return { body: true };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const keyOf = (e) => (e.type === 'radio' ? `radio:${e.name}` : e.getAttribute('data-testid') || e.getAttribute('aria-label') || `${e.tagName}:${(e.innerText || '').slice(0, 14)}`);
  // 링을 그리는 요소 찾기
  const ringOf = (e) => {
    const hasRing = (x) => {
      const cs = getComputedStyle(x);
      return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? parseFloat(cs.outlineWidth) + Math.max(0, parseFloat(cs.outlineOffset) || 0) : 0;
    };
    let x = e;
    for (let i = 0; i < 4 && x && x !== document.body; i++, x = x.parentElement) {
      const r = hasRing(x);
      if (r && (x === e || x.matches(':focus-within'))) return { el: x, grow: r };
    }
    return { el: e, grow: 5 }; // 링을 못 찾으면 보수적으로 5px(3px + 2px)
  };
  const { el: rEl, grow } = ringOf(a);
  const b = rEl.getBoundingClientRect();
  const ring = { top: b.top - grow, bottom: b.bottom + grow, left: b.left - grow, right: b.right + grow };
  // 고정·붙은 요소 자동 수집
  const fixed = [];
  for (const e of document.querySelectorAll('*')) {
    const cs = getComputedStyle(e);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (e.closest('[inert]') !== null) continue; // 모달 시트가 떠 있는 동안 뒤쪽(inert)의 고정 띠는 포커스를 가리는 요소가 아니다(e2e/focusObscured.ts와 같은 예외)
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    fixed.push({ el: e, name: e.getAttribute('data-testid') || e.className || e.tagName, pos: cs.position, top: r.top, bottom: r.bottom, left: r.left, right: r.right });
  }
  const overlapsAll = [];
  let topInset = 0;
  let bottomInset = 0;
  for (const f of fixed) {
    if (f.el.contains(a)) continue; // 예외 ①: 고정 요소 안의 요소
    if (f.pos === 'fixed' && f.bottom >= vh - 2) bottomInset = Math.max(bottomInset, vh - f.top);
    if (f.pos === 'fixed' && f.top <= 2) topInset = Math.max(topInset, f.bottom);
    const w = Math.min(ring.right, f.right) - Math.max(ring.left, f.left);
    const h = Math.min(ring.bottom, f.bottom) - Math.max(ring.top, f.top);
    if (w > 0.5 && h > 0.5) overlapsAll.push({ name: String(f.name).slice(0, 30), pos: f.pos, area: Math.round(w * h), ringTop: Math.round(ring.top), ringBottom: Math.round(ring.bottom), fTop: Math.round(f.top), fBottom: Math.round(f.bottom) });
  }
  const availH = vh - topInset - bottomInset;
  const tall = b.height + 2 * grow > availH;
  // 예외 ②: 가용 높이보다 큰 요소는 겹침 면적 대신 「위쪽 변과 링이 가용 영역 안에 보이는가」(위쪽 40px 이상이 띠 위)로 판정
  const overlaps = tall ? overlapsAll.filter((o) => !(ring.top >= topInset - 0.5 && b.top + 40 <= vh - bottomInset)).map((o) => ({ ...o, tallTopHidden: true })) : overlapsAll;
  const inView = tall ? ring.top >= -0.5 && ring.top < vh - bottomInset : ring.top >= -0.5 && ring.bottom <= vh + 0.5;
  const inViewX = ring.left >= -0.5 && ring.right <= vw + 0.5;
  // 보이는 부분 한가운데 점
  const vx = Math.max(0, Math.min(vw, b.left)) + (Math.min(vw, b.right) - Math.max(0, b.left)) / 2;
  const vyTop = Math.max(0, b.top);
  const vyBot = Math.min(vh - bottomInset, b.bottom);
  const vy = vyTop + Math.max(1, Math.min(vyBot - vyTop, 24)) / 2;
  const hit = document.elementFromPoint(vx, vy);
  const hitOk = !!hit && (rEl.contains(hit) || a.contains(hit) || hit.contains(a) || hit.closest('label') === rEl.closest('label') && !!hit.closest('label'));
  // 스크롤 컨테이너에 링이 잘리는가(조상 중 overflow가 visible이 아닌 것)
  let clipped = null;
  for (let x = rEl.parentElement; x && x !== document.body && x !== document.documentElement; x = x.parentElement) {
    const cs = getComputedStyle(x);
    if (cs.overflowY === 'visible' && cs.overflowX === 'visible') continue;
    const r = x.getBoundingClientRect();
    if (!tall && (ring.top < r.top - 1.5 || ring.bottom > r.bottom + 1.5)) {
      clipped = `${(x.getAttribute('data-testid') || x.className || x.tagName).toString().slice(0, 24)} ${Math.round(r.top)}~${Math.round(r.bottom)} vs 링 ${Math.round(ring.top)}~${Math.round(ring.bottom)}`;
      break;
    }
  }
  return {
    key: keyOf(a),
    rv: a.type === 'radio' ? a.value : null,
    lab: a.type === 'radio' && a.closest('label') ? (({ top, bottom }) => [Math.round(top), Math.round(bottom)])(a.closest('label').getBoundingClientRect()) : null,
    inp: a.type === 'radio' ? (({ top, bottom, left, right, width, height }) => [Math.round(top), Math.round(bottom), Math.round(width), Math.round(height)])(a.getBoundingClientRect()) : null,
    released: document.documentElement.classList.contains('bar-released'),
    top: Math.round(b.top),
    bottom: Math.round(b.bottom),
    ringTop: Math.round(ring.top),
    ringBottom: Math.round(ring.bottom),
    overlaps,
    inView,
    inViewX,
    tall,
    tallVisible: Math.round(Math.min(b.bottom, vh - bottomInset) - Math.max(b.top, topInset)),
    hitOk,
    clipped,
    barTop: Math.round(Math.min(...fixed.filter((f) => f.pos === 'fixed' && f.bottom >= vh - 2).map((f) => f.top), vh)),
    scrollY: Math.round(window.scrollY),
    fixedNames: fixed.map((f) => `${String(f.name).slice(0, 18)}(${f.pos})`),
  };
};

/** Tab 한 바퀴(앞) + Shift+Tab(뒤) 순회하며 매번 측정 (m3r2-a11ylib.traverse와 같은 로직, 측정기만 MEASURE_M9) */
export async function traverse(p) {
  const steps = [];
  const visited = new Set();
  for (const [dir, key] of [['fwd', 'Tab'], ['back', 'Shift+Tab']]) {
    let bodies = 0;
    const seenDir = new Set();
    for (let i = 0; i < 40; i++) {
      await p.keyboard.press(key);
      await new Promise((r) => setTimeout(r, 60));
      await settleScroll(p);
      const m = await p.evaluate(MEASURE_M9);
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

/** 페이지 안: 보이는 글자 조각(줄 상자)끼리 겹치거나, 다른 요소에 덮여 가려진 글자를 찾는다. 모달 뒤(inert)·글자 없는 요소·화면 밖·스크롤 영역에서 잘려 안 보이는 부분은 제외 */
export const OVERLAP_AUDIT = () => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const vh = window.innerHeight;
  const entries = [];
  const hiddenAnc = (e) => {
    for (let x = e; x && x !== document.body; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return true;
      if (x.hasAttribute('inert')) return true;
      if (String(x.tagName).toLowerCase() === 'svg') return true;
      if (x.hasAttribute('hidden')) return true;
      if (x.tagName === 'DETAILS' && !x.open && !(e.closest('summary') && x.contains(e.closest('summary')))) return true; // 닫힌 접이식의 내용
      if (cs.textOverflow === 'ellipsis' && (cs.overflowX === 'hidden' || cs.overflowX === 'clip')) return true; // 설계된 말줄임(예: 키보드가 올라온 기록 시트의 질문 제목)
      if (cs.pointerEvents === 'none' && x.getAttribute('aria-hidden') === 'true') return true; // 장식 도장 등(예: 출생신고의 「접수」)
    }
    return false;
  };
  const fixedOf = (el) => {
    for (let x = el; x && x !== document.body; x = x.parentElement) {
      const pos = getComputedStyle(x).position;
      if (pos === 'fixed' || pos === 'sticky') return x;
    }
    return null;
  };
  const atTop = window.scrollY <= 1;
  const atBottom = window.scrollY + vh >= de.scrollHeight - 2;
  const nameOf = (e) => (e.getAttribute && (e.getAttribute('data-testid') || (typeof e.className === 'string' && e.className.split(' ')[0]))) || e.tagName;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent;
    if (!t.trim()) continue;
    const pe = n.parentElement;
    if (!pe || hiddenAnc(pe)) continue;
    const pr = pe.getBoundingClientRect();
    if (pr.width <= 1.5 || pr.height <= 1.5) continue; // 화면 낭독 전용(sr-only)
    const rg = document.createRange();
    rg.selectNodeContents(n);
    for (const r of rg.getClientRects()) {
      if (r.width < 2 || r.height < 2) continue;
      let vis = { l: Math.max(r.left, 0), t: Math.max(r.top, 0), r: Math.min(r.right, vw), b: Math.min(r.bottom, vh) };
      for (let x = pe; x && x !== document.body && x !== de; x = x.parentElement) {
        const cs = getComputedStyle(x);
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
          const xr = x.getBoundingClientRect();
          vis = { l: Math.max(vis.l, xr.left), t: Math.max(vis.t, xr.top), r: Math.min(vis.r, xr.right), b: Math.min(vis.b, xr.bottom) };
        }
      }
      if (vis.r - vis.l < 2 || vis.b - vis.t < 2) continue;
      entries.push({ pe, rect: r, vis, text: t.trim().slice(0, 14), fx: fixedOf(pe) });
    }
  }
  const covered = [];
  for (const en of entries) {
    const pts = [
      [(en.vis.l + en.vis.r) / 2, (en.vis.t + en.vis.b) / 2],
      [en.vis.l + (en.vis.r - en.vis.l) * 0.25, (en.vis.t + en.vis.b) / 2],
      [en.vis.l + (en.vis.r - en.vis.l) * 0.75, (en.vis.t + en.vis.b) / 2],
    ];
    let hidden = 0;
    let by = null;
    for (const [x, y] of pts) {
      const hit = document.elementFromPoint(x, y);
      if (!hit) continue;
      if (hit === en.pe || en.pe.contains(hit) || hit.contains(en.pe)) continue;
      const lab = en.pe.closest('label');
      if (lab && lab.contains(hit)) continue; // 라디오 카드의 투명한 input이 라벨 위를 덮는다
      // 고정/붙은 요소(머리·하단 띠)가 덮은 글은 스크롤하면 드러난다: 아래쪽 띠는 문서 끝에서만, 위쪽 머리는 문서 맨 위에서만 가림으로 센다
      {
        const fx = fixedOf(hit);
        if (fx) {
          const fr = fx.getBoundingClientRect();
          const nearBottom = fr.top > vh / 2;
          if (nearBottom && !atBottom) continue;
          if (!nearBottom && fr.bottom < vh / 2 && !atTop) continue;
        }
      }
      hidden++;
      by = nameOf(hit);
    }
    if (hidden >= 2) covered.push(`「${en.text}」(${nameOf(en.pe)}) ← ${by} 아래에 가려짐`);
  }
  const overlaps = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if ((a.fx === null) !== (b.fx === null)) continue; // 붙은 머리·띠와 그 밑으로 지나가는 글은 위 가려짐 판정이 맡는다
      const w = Math.min(a.vis.r, b.vis.r) - Math.max(a.vis.l, b.vis.l);
      const h = Math.min(a.vis.b, b.vis.b) - Math.max(a.vis.t, b.vis.t);
      if (w < 2 || h < 3) continue;
      const areaA = (a.vis.r - a.vis.l) * (a.vis.b - a.vis.t);
      const areaB = (b.vis.r - b.vis.l) * (b.vis.b - b.vis.t);
      if ((w * h) / Math.min(areaA, areaB) < 0.3) continue;
      overlaps.push(`「${a.text}」(${nameOf(a.pe)}) × 「${b.text}」(${nameOf(b.pe)}) ${Math.round(w)}×${Math.round(h)}px`);
    }
  }
  return { texts: entries.length, covered: covered.slice(0, 12), coveredN: covered.length, overlaps: overlaps.slice(0, 12), overlapsN: overlaps.length };
};


/** 페이지 안: 가로 넘침·잘림. OVERFLOW_M3(m3r2-a11ylib.mjs)의 사본 — 닫힌 접이식(<details>) 안의 글과 설계된 말줄임(text-overflow: ellipsis)은 제외 */
export const OVERFLOW_M9 = () => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const out = { docOverflowPx: Math.max(0, de.scrollWidth - vw), scrollW: de.scrollWidth, clientW: vw, offenders: [], clipped: [] };
  const nameOf = (e) => `${e.tagName}.${(e.className && e.className.baseVal === undefined ? e.className : '').toString().split(' ')[0]}`;
  const closedDetails = (e) => {
    for (let x = e; x && x !== document.body; x = x.parentElement) {
      if (x.tagName === 'DETAILS' && !x.open) {
        const sm = e.closest('summary');
        if (!(sm && x.contains(sm))) return true;
      }
    }
    return false;
  };
  const ellipsisAnc = (e) => {
    for (let x = e; x && x !== document.body; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.textOverflow === 'ellipsis' && (cs.overflowX === 'hidden' || cs.overflowX === 'clip')) return true;
    }
    return false;
  };
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
    if (closedDetails(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.width <= 1.5 || r.height <= 1.5) continue;
    if ((r.right > vw + 0.5 || r.left < -0.5) && !clippedByAncestor(e)) out.offenders.push(`${nameOf(e)}(${Math.round(r.left)}~${Math.round(r.right)} > ${vw})`);
    if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip') && e.scrollWidth > e.clientWidth + 1.5 && cs.textOverflow !== 'ellipsis') out.clipped.push(`${nameOf(e)}(scrollW ${e.scrollWidth} > clientW ${e.clientWidth})`);
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent.trim();
    if (!t) continue;
    const pe = n.parentElement;
    if (!pe) continue;
    const pcs = getComputedStyle(pe);
    if (pcs.display === 'none' || pcs.visibility === 'hidden' || pe.closest('svg') || closedDetails(pe) || ellipsisAnc(pe)) continue;
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
  return out;
};

/** 레이아웃 감사 한 번: 넘침 + 겹침/가려짐. 문제가 있으면 problems에 사람이 읽을 문장으로 담는다 */
export async function auditLayout(page, { atEnd = true } = {}) {
  const ov = await page.evaluate(OVERFLOW_M9);
  const lap = await page.evaluate(OVERLAP_AUDIT);
  const problems = [];
  if (atEnd) {
    const y0 = await page.evaluate(() => window.scrollY);
    const moved = await page.evaluate(() => {
      const de = document.documentElement;
      if (window.scrollY + window.innerHeight >= de.scrollHeight - 2) return false;
      window.scrollTo(0, de.scrollHeight);
      return true;
    });
    if (moved) {
      await new Promise((r) => setTimeout(r, 250));
      const lapEnd = await page.evaluate(OVERLAP_AUDIT);
      if (lapEnd.coveredN) problems.push(`[문서 끝] 가려진 글자 ${lapEnd.coveredN}: ${lapEnd.covered.slice(0, 3).join(' / ')}`);
      if (lapEnd.overlapsN && !lap.overlapsN) problems.push(`[문서 끝] 겹친 글자 ${lapEnd.overlapsN}: ${lapEnd.overlaps.slice(0, 3).join(' / ')}`);
      await page.evaluate((y) => window.scrollTo(0, y), y0);
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  if (ov.docOverflowPx > 0) problems.push(`문서 가로 넘침 ${ov.docOverflowPx}px (scrollW ${ov.scrollW} > clientW ${ov.clientW})`);
  if (ov.offenders.length) problems.push(`가로로 화면 밖 요소 ${ov.offenders.length}: ${ov.offenders.slice(0, 4).join(', ')}`);
  if (ov.clipped.length) problems.push(`잘린 글자·요소 ${ov.clipped.length}: ${ov.clipped.slice(0, 3).join(' / ')}`);
  if (lap.coveredN) problems.push(`가려진 글자 ${lap.coveredN}: ${lap.covered.slice(0, 3).join(' / ')}`);
  if (lap.overlapsN) problems.push(`겹친 글자 ${lap.overlapsN}: ${lap.overlaps.slice(0, 3).join(' / ')}`);
  return { problems, texts: lap.texts, ov };
}

/** 낱말 끊김 감사: root 아래 글을 글자 하나씩 줄로 나눠 낱말 가운데서 갈린 곳을 센다 */
export async function auditWords(page, root = 'body') {
  const r0 = await page.evaluate(LINE_AUDIT_M3, root);
  const INTENDED = new Set(['다이아몬드수저']); // e2e/intendedBreaks.ts — 등록된 의도된 줄바꿈(<br>·<wbr>)
  const r = { ...r0, wordBreaks: r0.wordBreaks.filter((w) => !INTENDED.has(w.word)) };
  const problems = [];
  if (r.wordBreaks.length) problems.push(`낱말 중간 끊김 ${r.wordBreaks.length}: ${r.wordBreaks.slice(0, 4).map((w) => `「${w.word}」`).join(' ')}`);
  const bad = r.bad.filter((b) => b.kind !== 'num-unit' && b.kind !== 'date');
  const num = r.bad.filter((b) => b.kind === 'num-unit' || b.kind === 'date');
  if (bad.length) problems.push(`구분 기호 줄 끝/첫머리 ${bad.length}: ${bad.slice(0, 3).map((b) => `${b.kind}「${b.ch}」`).join(' ')}`);
  if (num.length) problems.push(`숫자+단위 갈림 ${num.length}: ${num.slice(0, 3).map((b) => `「${b.ch}」`).join(' ')}`);
  return { problems, blocks: r.blocks, chars: r.chars, wordBreaks: r.wordBreaks, bad: r.bad };
}

/** 포커스 감사: Tab 한 바퀴 + Shift+Tab 한 바퀴 */
export async function auditFocus(page, tag, vpHeight) {
  const { steps, visited } = await traverse(page);
  const problems = judgeSteps(steps, tag, vpHeight);
  return { problems, stops: visited.size, steps: steps.length };
}

/** 페이지 안: 글자 대비(WCAG). 글자 색을 겹쳐진 배경 색(투명 배경은 위로 올라가며 합성)과 견준다. 배경이 그림·그라데이션이면 건너뜀(unknown으로 센다). 비활성 컨트롤은 제외 */
export const CONTRAST_AUDIT = () => {
  const parse = (s) => {
    let m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/.exec(s);
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4])];
    m = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(s);
    if (m) return [Number(m[1]) * 255, Number(m[2]) * 255, Number(m[3]) * 255, m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4])];
    return null;
  };
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const over = (top, bot) => {
    const a = top[3];
    return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1];
  };
  const rootBg = (() => {
    const c = parse(getComputedStyle(document.documentElement).backgroundColor);
    if (c && c[3] > 0) return [c[0], c[1], c[2], 1];
    const b = parse(getComputedStyle(document.body).backgroundColor);
    if (b && b[3] > 0) return [b[0], b[1], b[2], 1];
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? [0, 0, 0, 1] : [255, 255, 255, 1];
  })();
  const out = { checked: 0, unknown: 0, fails: [] };
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    const r = el.getBoundingClientRect();
    if (r.width <= 1.5 || r.height <= 1.5) continue;
    let hidden = false;
    let disabled = false;
    let opacity = 1;
    for (let x = el; x && x !== document.documentElement; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.display === 'none' || cs.visibility === 'hidden') hidden = true;
      if (x.hasAttribute('inert')) hidden = true;
      if (x.disabled || x.getAttribute('aria-disabled') === 'true') disabled = true;
      opacity *= Number(cs.opacity);
      if (String(x.tagName).toLowerCase() === 'svg') hidden = true;
    }
    if (hidden || disabled) continue;
    const cs = getComputedStyle(el);
    const fg0 = parse(cs.color);
    if (!fg0) continue;
    // 배경 합성
    const layers = [];
    let unknown = false;
    for (let x = el; x; x = x.parentElement) {
      const xs = getComputedStyle(x);
      if (xs.backgroundImage && xs.backgroundImage !== 'none') {
        unknown = true;
        break;
      }
      const c = parse(xs.backgroundColor);
      if (c && c[3] > 0) {
        layers.push(c);
        if (c[3] >= 0.999) break;
      }
    }
    if (unknown) {
      out.unknown++;
      continue;
    }
    let bg = layers.length && layers[layers.length - 1][3] >= 0.999 ? layers[layers.length - 1] : rootBg;
    const start = layers.length && layers[layers.length - 1][3] >= 0.999 ? layers.length - 2 : layers.length - 1;
    for (let i = start; i >= 0; i--) bg = over(layers[i], bg);
    const fg = fg0[3] < 1 ? over([fg0[0], fg0[1], fg0[2], fg0[3] * opacity], bg) : opacity < 1 ? over([fg0[0], fg0[1], fg0[2], opacity], bg) : fg0;
    const l1 = lum(fg);
    const l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    out.checked++;
    if (ratio < need - 0.01) out.fails.push(`「${n.textContent.trim().slice(0, 14)}」(${el.getAttribute('data-testid') || el.className || el.tagName}) ${ratio.toFixed(2)} < ${need} (${cs.color} on ${bg.map((v) => Math.round(v)).slice(0, 3).join(',')})`);
  }
  return out;
};

export async function auditContrast(page) {
  const r = await page.evaluate(CONTRAST_AUDIT);
  return { problems: r.fails.length ? [`대비 부족 ${r.fails.length}/${r.checked}: ${r.fails.slice(0, 4).join(' / ')}`] : [], checked: r.checked, unknown: r.unknown, fails: r.fails };
}

/** 페이지 안: 대시보드 열 배치 — 프로필 카드 · 인생 기록 · 식구 카드 · 또래 카드의 위치. columns = 3(좌·중·우가 서로 다른 열) | 1(한 열로 쌓임) | 0(못 읽음) */
export const COLUMNS_AUDIT = () => {
  const r = (id) => {
    const e = document.querySelector(`[data-testid="${id}"]`);
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width) };
  };
  const profile = r('profile-card');
  const log = r('log');
  const family = r('family-card');
  const peers = r('peers-card') || r('peers-now-card');
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  if (!profile || !log || !family) return { columns: 0, profile, log, family, peers, vw, vh };
  const three = profile.r <= log.l + 1 && log.r <= family.l + 1;
  const one = Math.abs(profile.l - log.l) <= 2 && Math.abs(log.l - family.l) <= 2 && log.t >= profile.b - 2 && family.t >= log.b - 2;
  const inView = (x) => !!x && x.t < vh && x.b > 0 && x.l >= 0 && x.r <= vw + 0.5;
  return { columns: three ? 3 : one ? 1 : 2, profile, log, family, peers, vw, vh, allInFirstScreen: inView(profile) && inView(log) && inView(family), peersInView: inView(peers) };
};
