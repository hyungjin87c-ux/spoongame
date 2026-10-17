// QA-003 M3: 포커스 측정(MEASURE)·조작 요소 수집(INTERACTIVE) — M2 3회차 N14b의 측정기를 그대로 가져온 것(화면에서만 잰다)
/** 페이지 안에서 현재 포커스 요소를 재는 함수(문자열로 주입) */
export const MEASURE = () => {
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

/** 화면에서 조작 가능한 요소의 키 집합 (라디오는 묶음 하나) */
export const INTERACTIVE = () => {
  const keys = new Set();
  const vis = (e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && (r.width > 0 || r.height > 0 || e.type === 'radio');
  };
  for (const e of document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')) {
    if (e.disabled) continue;
    if (e.getAttribute('tabindex') === '-1') continue;
    if (e.matches('[tabindex]') && !e.matches('a,button,input,select,textarea') && e.getAttribute('tabindex') !== '0') continue;
    if (!vis(e) && e.type !== 'radio') continue;
    if (e.type === 'radio') {
      if (e.disabled) continue;
      keys.add(`radio:${e.name}`);
      continue;
    }
    // 숨긴(접근성 전용) 표 안의 요소는 제외
    if (e.closest('table')) continue;
    keys.add(e.getAttribute('data-testid') || e.getAttribute('aria-label') || `${e.tagName}:${(e.innerText || '').slice(0, 14)}`);
  }
  return [...keys];
};

