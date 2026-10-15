// QA-003 M2 2회차: 글자 확대·리플로(CM11·QM2-3)와 줄바꿈(QM2-5) 측정 도우미. 모두 화면에서 직접 잰다(앱 코드는 읽지 않는다).

/** 가로 넘침·잘림·이름표 겹침·하단 띠. page.evaluate에 그대로 넘긴다. */
export const OVERFLOW_AUDIT = () => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const vh = window.innerHeight;
  const out = { scrollW: de.scrollWidth, clientW: vw, docOverflowPx: Math.max(0, de.scrollWidth - vw), offenders: [], clipped: [], labelOverlap: [], bar: null, startBtn: null, rootFont: parseFloat(getComputedStyle(de).fontSize) };
  const nameOf = (e) => `${e.tagName}.${(e.className && e.className.baseVal === undefined ? e.className : '').toString().split(' ')[0]}`;
  const isSrOnly = (e, r) => r.width <= 1.5 || r.height <= 1.5;
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
    if (r.width === 0 || r.height === 0 || isSrOnly(e, r)) continue;
    if ((r.right > vw + 0.5 || r.left < -0.5) && !clippedByAncestor(e)) out.offenders.push(`${nameOf(e)}(${Math.round(r.left)}~${Math.round(r.right)} > ${vw})`);
    // 잘림: 내용이 자기 상자보다 넓은데 overflow가 숨김/자동인 곳
    if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip') && e.scrollWidth > e.clientWidth + 1.5) out.clipped.push(`${nameOf(e)}(scrollW ${e.scrollWidth} > clientW ${e.clientWidth})`);
  }
  // 글자가 자기 블록의 오른쪽 끝 밖으로 나갔는가
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent.trim();
    if (!t) continue;
    const pe = n.parentElement;
    if (!pe) continue;
    const pcs = getComputedStyle(pe);
    if (pcs.display === 'none' || pcs.visibility === 'hidden' || pe.closest('table, svg')) continue;
    let blk = pe;
    while (blk && blk !== document.body && /^inline/.test(getComputedStyle(blk).display) && blk.parentElement) blk = blk.parentElement;
    const rg = document.createRange();
    rg.selectNodeContents(n);
    const rr = rg.getBoundingClientRect();
    if (rr.width === 0) continue;
    const br = blk.getBoundingClientRect();
    // 시각적으로 숨긴(sr-only) 글자는 제외: 자기 또는 조상 상자가 1px 안팎
    let srOnly = false;
    for (let x = pe; x && x !== document.body; x = x.parentElement) {
      const xr = x.getBoundingClientRect();
      if (xr.width <= 1.5 || xr.height <= 1.5) {
        srOnly = true;
        break;
      }
    }
    if (srOnly) continue;
    if (rr.right > br.right + 1.5 || rr.left < br.left - 1.5) out.clipped.push(`글자「${t.slice(0, 14)}」 상자 ${Math.round(br.left)}~${Math.round(br.right)} 글자 ${Math.round(rr.left)}~${Math.round(rr.right)}`);
  }
  // 수저 이름표: 서로 겹침·줄 밖으로 나감
  const names = [...document.querySelectorAll('.spoon-fig__name')].map((e) => ({ t: e.textContent.trim(), r: e.getBoundingClientRect() }));
  for (let i = 0; i < names.length; i++) {
    const a = names[i];
    if (a.r.left < -0.5 || a.r.right > vw + 0.5) out.labelOverlap.push(`이름표「${a.t}」가 화면 밖 ${Math.round(a.r.left)}~${Math.round(a.r.right)}`);
    for (let j = i + 1; j < names.length; j++) {
      const b = names[j];
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > 0.5 && h > 0.5) out.labelOverlap.push(`이름표「${a.t}」와「${b.t}」겹침 ${Math.round(w)}x${Math.round(h)}`);
    }
  }
  const lineup = document.querySelector('[data-testid=spoon-lineup]');
  if (lineup) {
    const lr = lineup.getBoundingClientRect();
    for (const nm of names) if (nm.r.right > lr.right + 1 || nm.r.left < lr.left - 1) out.labelOverlap.push(`이름표「${nm.t}」가 수저 줄(${Math.round(lr.left)}~${Math.round(lr.right)}) 밖 ${Math.round(nm.r.left)}~${Math.round(nm.r.right)}`);
  }
  const bar = document.querySelector('[data-testid=bottom-bar]');
  if (bar) {
    const r = bar.getBoundingClientRect();
    out.bar = { h: Math.round(r.height), ratio: Math.round((r.height / vh) * 100) / 100, vh };
  }
  const sb = document.querySelector('[data-testid=start-birth], [data-testid=resume], [data-testid=confirm-new-no]');
  if (sb) {
    const r = sb.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    out.startBtn = { id: sb.getAttribute('data-testid'), h: Math.round(r.height), w: Math.round(r.width), clickable: !!hit && (sb.contains(hit) || hit === sb) };
  }
  return out;
};

/**
 * 줄바꿈 감사: 글자 하나씩 Range로 줄을 나눠 (a) 줄 끝 · / — ( 와 줄 첫머리 · / — ) (b) 숫자+단위·날짜 묶음이 같은 줄인지 본다.
 * root: CSS 선택자(여러 개면 콤마), 활성 슬라이드는 '.slide.is-active'.
 */
export const LINE_AUDIT = (rootSelector) => {
  const roots = [...document.querySelectorAll(rootSelector)].filter((r) => {
    const cs = getComputedStyle(r);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  });
  const bad = [];
  let blocks = 0;
  let chars = 0;
  const isHidden = (e) => {
    for (let x = e; x && x !== document.body; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.display === 'none' || cs.visibility === 'hidden') return true;
      if (x.tagName === 'TABLE' || x.tagName === 'svg') return true; // 숨긴 표·그래프 글자는 줄바꿈 대상 아님
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
      if (!n.textContent.trim() || isHidden(n.parentElement)) continue;
      const b = blockOf(n);
      if (!blocksMap.has(b)) blocksMap.set(b, []);
      blocksMap.get(b).push(n);
    }
  }
  for (const [blk, nodes] of blocksMap) {
    blocks++;
    const cs = getComputedStyle(blk);
    const fs = parseFloat(cs.fontSize) || 16;
    const items = []; // {ch, top, line}
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
    // 줄 나누기: 보이는 글자의 top이 이전 줄 기준과 fs*0.5 이상 다르면 새 줄
    const lines = [];
    let cur = null;
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      if (it.top === null) {
        it.line = cur ? lines.length - 1 : -1;
        continue;
      }
      // 같은 줄 판정: 세로 가운데가 줄 기준 글자의 가운데와 글자 높이의 0.45배 안(글자 크기가 섞인 줄(큰 숫자+작은 단위)도 한 줄로 본다)
      const cy = it.top + it.h / 2;
      if (!cur || Math.abs(cy - cur.cy) > 0.45 * Math.max(it.h, cur.h)) {
        cur = { top: it.top, cy, h: it.h, chars: [] };
        lines.push(cur);
      }
      it.line = lines.length - 1;
      cur.chars.push(it);
    }
    const textOf = (l) => l.chars.map((c) => c.ch).join('').trim();
    const sample = lines.map(textOf).join(' ⏎ ').slice(0, 160);
    lines.forEach((l, li) => {
      const vis = l.chars.filter((c) => !c.ws);
      if (!vis.length) return;
      const first = vis[0].ch;
      const last = vis[vis.length - 1].ch;
      if (/[·/—(（]/.test(last)) bad.push({ kind: 'end', ch: last, line: textOf(l).slice(-24), where: sample });
      if (/[·/—)）]/.test(first)) bad.push({ kind: 'start', ch: first, line: textOf(l).slice(0, 24), where: sample });
    });
    // 숫자+단위, 날짜 묶음이 한 줄인가 (공백 포함 전체 문자열 기준)
    const full = items.map((c) => c.ch).join('');
    const check = (re, kind) => {
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(full))) {
        const part = items.slice(m.index, m.index + m[0].length).filter((c) => c.top !== null && !c.ws);
        const ls = new Set(part.map((c) => c.line));
        if (ls.size > 1) bad.push({ kind, ch: m[0], line: m[0], where: sample });
      }
    };
    check(/\d[\d,.]*\s?(%|명|건|세|년|월|일|시)(?![가-힣])/g, 'num-unit');
    check(/\d+월 \d+일( \d+시)?/g, 'date');
  }
  return { blocks, chars, bad, roots: roots.length };
};

/** 글자 크기 N%를 루트에 적용 */
export async function setRootFont(page, pct) {
  await page.evaluate((p) => {
    let st = document.getElementById('__qa_font');
    if (!st) {
      st = document.createElement('style');
      st.id = '__qa_font';
      document.head.appendChild(st);
    }
    st.textContent = p === 100 ? '' : `html { font-size: ${p}% !important; }`;
  }, pct);
}
