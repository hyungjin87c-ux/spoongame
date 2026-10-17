// QA-003 M3 2회차: 낱말 중간 끊김 독립 측정기(QM3-1·QM3-2). 개발자의 e2e/lineBreaks.ts를 보지 않고 SPEC 문장만으로 새로 썼다.
// 화면에서만 잰다(글자 하나씩 Range로 줄을 나눔). 사용: await page.evaluate(WB_AUDIT, { intended: [...] })
//
// 낱말 = 공백·구두점·<br>·칸(블록) 경계로 갈라낸 한글·영숫자 덩어리(요소 경계를 넘어 이어 붙은 글자는 한 낱말, 숫자 사이의 . , 는 낱말 안).
// 끊김 = 한 낱말의 글자가 둘 이상의 줄에 놓임.
// 판정: intended(줄이 바뀐 곳마다 <wbr>이 있고 낱말이 허용 목록에 있음) / unavoidable(낱말 자연 폭 > 한 줄 전체 + 0.5px) / broken(그 밖).
// 한 줄 전체 = 낱말에서 위로 올라가 처음 만나는 「여러 칸이 한 줄을 나눠 쓰는 상자」(격자 2열↑·가로 flex 자식 2↑·표 행)의 내용 폭. 인라인 계열(inline-flex 등) 상자는 내용 폭에 맞춰지는 포장이라 건너뛴다. 없으면 낱말을 담은 블록 폭.
export const WB_AUDIT = (opts) => {
  const INTENDED = (opts && opts.intended) || [];
  const csOf = (e) => getComputedStyle(e);
  const isWordCh = (c) => /[가-힣A-Za-z0-9]/.test(c);
  const isDigit = (c) => /[0-9]/.test(c);
  const isInlineDisp = (d) => d === 'inline' || d === 'contents';

  const hiddenEl = (e) => {
    for (let x = e; x && x !== document.documentElement; x = x.parentElement) {
      const cs = csOf(x);
      if (cs.display === 'none') return true;
      if (x === e && cs.visibility === 'hidden') return true;
      if (x.namespaceURI === 'http://www.w3.org/2000/svg') return true;
      if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(x.tagName)) return true;
      if (x !== document.body) {
        const r = x.getBoundingClientRect();
        const clipping = cs.overflow !== 'visible' || (cs.clip && cs.clip !== 'auto') || (cs.clipPath && cs.clipPath !== 'none');
        if (clipping && (r.width <= 1.5 || r.height <= 1.5)) return true; // sr-only
        if (!isInlineDisp(cs.display) && !cs.display.startsWith('inline') && (r.width <= 0 || r.height <= 0) && x.children.length === 0 && x.textContent.trim() !== '') return true;
      }
    }
    return false;
  };
  const blockOf = (el) => {
    let b = el;
    while (b && b.parentElement && isInlineDisp(csOf(b).display)) b = b.parentElement;
    return b;
  };
  // 글자 하나가 조상의 overflow 상자 밖으로 잘려 나갔는가(릴 창 밖 칸 등)
  const clippedOut = (el, r) => {
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (let x = el; x && x !== document.documentElement; x = x.parentElement) {
      if (x === document.body) break;
      const cs = csOf(x);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const b = x.getBoundingClientRect();
      if (cx < b.left - 1 || cx > b.right + 1 || cy < b.top - 1 || cy > b.bottom + 1) return true;
    }
    return false;
  };
  const contentW = (el) => {
    const cs = csOf(el);
    const r = el.getBoundingClientRect();
    return r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
  };
  const visibleKids = (el) => [...el.children].filter((k) => {
    if (k.namespaceURI === 'http://www.w3.org/2000/svg') return false; // 아이콘은 칸으로 세지 않는다
    if (/^(IMG|WBR|BR|SCRIPT|STYLE)$/.test(k.tagName)) return false;
    const cs = csOf(k);
    if (cs.display === 'none') return false;
    if (cs.position === 'absolute' || cs.position === 'fixed') return false;
    const r = k.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const isMultiCell = (P) => {
    const cs = csOf(P);
    const d = cs.display;
    if (d === 'grid' || d === 'inline-grid') {
      const tracks = cs.gridTemplateColumns.split(' ').filter((t) => t && t !== 'none').length;
      return tracks >= 2 && visibleKids(P).length >= 2;
    }
    if (d === 'flex' || d === 'inline-flex') return cs.flexDirection.startsWith('row') && visibleKids(P).length >= 2;
    if (d === 'table-row') return visibleKids(P).length >= 2;
    return false;
  };
  const lineWidthOf = (textParent, blk) => {
    for (let cur = textParent; cur && cur !== document.body; cur = cur.parentElement) {
      const P = cur.parentElement;
      if (!P || P === document.body) break;
      if (csOf(P).display.startsWith('inline')) continue; // 내용 폭에 맞춰지는 포장(칩 등)
      if (isMultiCell(P)) return { kind: 'row', w: contentW(P), el: label(P) };
    }
    let f = blk;
    while (f && f.parentElement && csOf(f).display.startsWith('inline')) f = f.parentElement;
    return { kind: 'block', w: contentW(f), el: label(f) };
  };
  const label = (e) => {
    if (!e) return '?';
    const id = e.getAttribute && e.getAttribute('data-testid');
    const cls = typeof e.className === 'string' ? e.className.split(' ').filter(Boolean)[0] : '';
    return `${e.tagName.toLowerCase()}${id ? '[' + id + ']' : cls ? '.' + cls : ''}`;
  };
  const whereOf = (e) => {
    const chain = [];
    for (let x = e; x && x !== document.body && chain.length < 3; x = x.parentElement) chain.push(label(x));
    return chain.join('<');
  };

  // ---- 문서 순서대로 보이는 글자·<br>를 칸(블록)별로 모은다 ----
  const blocks = new Map();
  const getBlk = (b) => {
    if (!blocks.has(b)) blocks.set(b, []);
    return blocks.get(b);
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (n.nodeType === 1) {
      if (n.tagName === 'BR' && !hiddenEl(n.parentElement)) getBlk(blockOf(n.parentElement)).push({ t: 'br' });
      continue;
    }
    if (n.textContent === '') continue;
    const pe = n.parentElement;
    if (!pe || hiddenEl(pe)) continue;
    getBlk(blockOf(pe)).push({ t: 'text', node: n, pe });
  }

  const words = [];
  let charsN = 0;
  let shy = 0;
  for (const [blk, items] of blocks) {
    let cur = [];
    const flush = () => {
      if (cur.length) words.push({ blk, chars: cur });
      cur = [];
    };
    for (const it of items) {
      if (it.t === 'br') {
        flush();
        continue;
      }
      const s = it.node.textContent;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '­') shy++;
        const prev = i > 0 ? s[i - 1] : '';
        const next = i + 1 < s.length ? s[i + 1] : '';
        const embedded = (ch === '.' || ch === ',') && isDigit(prev) && isDigit(next);
        if (!(isWordCh(ch) || embedded)) {
          flush();
          continue;
        }
        const rg = document.createRange();
        rg.setStart(it.node, i);
        rg.setEnd(it.node, i + 1);
        const rects = rg.getClientRects();
        if (!rects.length || (rects[0].width < 0.2 && !embedded)) {
          flush();
          continue;
        }
        const r = rects[0];
        if (clippedOut(it.pe, r)) {
          flush();
          continue;
        }
        cur.push({ ch, node: it.node, off: i, pe: it.pe, cy: r.top + r.height / 2, h: r.height, w: r.width, left: r.left });
        charsN++;
      }
      // 텍스트 노드가 끝나도 낱말은 이어진다(요소 경계 너머) — 공백·구두점·<br>에서만 끊는다
    }
    flush();
  }

  const out = { wordsN: words.length, charsN, shy, broken: [], unavoidable: [], intended: [], cats: {}, wbrEls: [] };
  const bump = (k) => (out.cats[k] = (out.cats[k] || 0) + 1);
  for (const w of words) {
    const pe0 = w.chars[0].pe;
    const cats = [];
    if (pe0.closest('h1')) cats.push('h1');
    if (pe0.closest('h2,h3')) cats.push('h2h3');
    if (pe0.closest('.grade')) cats.push('chip');
    if (pe0.closest('[data-testid^="birth-field-"]')) cats.push('field');
    if (pe0.closest('.cmp__source')) cats.push('source');
    if (pe0.closest('.reel__item')) cats.push('reel');
    if (pe0.closest('.doc__name,[data-testid="birth-name"]')) cats.push('name');
    if (pe0.closest('.doc__sentence,[data-testid="birth-sentence"]')) cats.push('sentence');
    if (pe0.closest('[data-testid="page-foot"]')) cats.push('foot');
    if (pe0.closest('[data-testid="bottom-bar"],.bottom-bar')) cats.push('bar');
    if (pe0.closest('.site-head,header')) cats.push('head');
    if (pe0.closest('.doc__band')) cats.push('band');
    if (pe0.closest('.stamp')) cats.push('stamp');
    if (pe0.closest('.people')) cats.push('peers');
    if (pe0.closest('table')) cats.push('table');
    for (const c of cats) bump(c);
    // 줄 나누기
    let line = 0;
    const breaksAt = [];
    for (let i = 1; i < w.chars.length; i++) {
      const a = w.chars[i - 1];
      const b = w.chars[i];
      if (Math.abs(a.cy - b.cy) > 0.5 * Math.max(a.h, b.h)) {
        line++;
        breaksAt.push(i);
      }
    }
    if (!breaksAt.length) continue;
    const text = w.chars.map((c) => c.ch).join('');
    const natural = w.chars.reduce((s, c) => s + c.w, 0);
    const blkW = contentW(w.blk);
    const lw = lineWidthOf(pe0, w.blk);
    // 줄 모양(어디서 끊겼는지) — 보고용
    const parts = [];
    let from = 0;
    for (const bi of breaksAt) {
      parts.push(text.slice(from, bi));
      from = bi;
    }
    parts.push(text.slice(from));
    // <wbr> 확인: 줄이 바뀐 지점마다 두 글자 사이에 <wbr> 요소가 있는가
    const wbrAll = breaksAt.every((bi) => {
      const a = w.chars[bi - 1];
      const b = w.chars[bi];
      if (a.node === b.node) return false;
      const r = document.createRange();
      r.setStart(a.node, a.off + 1);
      r.setEnd(b.node, b.off);
      return !!r.cloneContents().querySelector('wbr');
    });
    const rec = { word: text, shape: parts.join(' / '), where: whereOf(pe0), natural: Math.round(natural * 10) / 10, lineW: Math.round(lw.w * 10) / 10, lineKind: `${lw.kind}:${lw.el}`, blkW: Math.round(blkW * 10) / 10, cats: cats.join(',') };
    if (wbrAll && INTENDED.includes(text)) out.intended.push(rec);
    else if (natural > lw.w + 0.5) out.unavoidable.push(rec);
    else out.broken.push(rec);
  }
  for (const wb of document.querySelectorAll('wbr')) out.wbrEls.push((wb.parentElement ? wb.parentElement.textContent : '').replace(/\s+/g, ' ').trim().slice(0, 40));
  return out;
};

/** 제목(h1) 감사(QM3-2): 낱말마다 한 줄인가·자연 폭 ≤ h1 내용 폭·제목 글자 ≥ 본문 문단 글자 */
export const H1_AUDIT = () => {
  const csOf = (e) => getComputedStyle(e);
  const rows = [];
  const bodyFs = [];
  for (const p of document.querySelectorAll('p, .card__note, .doc__sentence, [data-testid="roulette-status"]')) {
    if (p.closest('h1') || p.closest('.doc__name,[data-testid="birth-name"]')) continue;
    const cs = csOf(p);
    const r = p.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width <= 1.5 || r.height <= 1.5) continue;
    bodyFs.push({ fs: parseFloat(cs.fontSize), t: p.textContent.trim().slice(0, 20) });
  }
  const maxBody = bodyFs.reduce((m, x) => Math.max(m, x.fs), 0);
  for (const h of document.querySelectorAll('h1')) {
    const cs = csOf(h);
    const r = h.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width <= 1.5 || r.height <= 1.5) continue;
    // 글자 하나씩 줄 나누기
    const items = [];
    const walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const s = n.textContent;
      for (let i = 0; i < s.length; i++) {
        const rg = document.createRange();
        rg.setStart(n, i);
        rg.setEnd(n, i + 1);
        const rects = rg.getClientRects();
        if (!rects.length || /\s/.test(s[i])) {
          items.push({ ch: s[i], ws: true });
          continue;
        }
        const q = rects[0];
        items.push({ ch: s[i], ws: false, cy: q.top + q.height / 2, h: q.height, w: q.width });
      }
    }
    const words = [];
    let cur = [];
    for (const it of items) {
      if (it.ws || !/[가-힣A-Za-z0-9]/.test(it.ch)) {
        if (cur.length) words.push(cur);
        cur = [];
      } else cur.push(it);
    }
    if (cur.length) words.push(cur);
    const contentW = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const wrows = words.map((w) => {
      let lines = 1;
      for (let i = 1; i < w.length; i++) if (Math.abs(w[i].cy - w[i - 1].cy) > 0.5 * Math.max(w[i].h, w[i - 1].h)) lines++;
      const natural = w.reduce((s, c) => s + c.w, 0);
      return { word: w.map((c) => c.ch).join(''), lines, natural: Math.round(natural * 10) / 10 };
    });
    const lineTops = new Set(items.filter((i) => !i.ws).map((i) => Math.round(i.cy / 4)));
    rows.push({ id: h.getAttribute('data-testid') || h.className || 'h1', text: h.textContent.replace(/\s+/g, ' ').trim(), fs: parseFloat(cs.fontSize), contentW: Math.round(contentW * 10) / 10, wrows, linesTotal: lineTops.size });
  }
  return { rows, maxBodyFs: maxBody, bodyFsCount: bodyFs.length, rootFs: parseFloat(csOf(document.documentElement).fontSize) };
};
