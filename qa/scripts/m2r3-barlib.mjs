// QA-003 M2 3회차: 하단 띠 고정 해제(QM2-12) 측정 도우미. 화면에서만 잰다(앱 코드는 읽지 않는다).
import { sleep } from './m2r3-lib.mjs';

/** 띠·문서 상태를 한 번에 잰다 (page.evaluate에 그대로 넘김) */
export const BAR_INFO = () => {
  const bar = document.querySelector('[data-testid=bottom-bar]');
  const root = document.documentElement;
  if (!bar) return { noBar: true };
  const cs = getComputedStyle(bar);
  const rcs = getComputedStyle(root);
  const r = bar.getBoundingClientRect();
  const vh = window.innerHeight;
  const sy = window.scrollY;
  const docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const foot = document.querySelector('footer');
  const fr = foot ? foot.getBoundingClientRect() : null;
  const spx = (n) => {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;visibility:hidden;padding-bottom:var(--sp-${n})`;
    document.body.appendChild(d);
    const v = parseFloat(getComputedStyle(d).paddingBottom);
    d.remove();
    return v;
  };
  const end = document.querySelector('.page-end-space');
  const side = document.querySelector('.title__side');
  const btns = ['start-birth', 'resume', 'begin-new', 'confirm-new-yes', 'confirm-new-no']
    .map((id) => document.querySelector(`[data-testid=${id}]`))
    .filter(Boolean)
    .map((b) => {
      const br = b.getBoundingClientRect();
      const hit = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
      return { id: b.getAttribute('data-testid'), h: Math.round(br.height), top: Math.round(br.top), bottom: Math.round(br.bottom), hitOk: !!hit && (b.contains(hit) || hit === b), inView: br.top >= -0.5 && br.bottom <= vh + 0.5 };
    });
  const ask = document.querySelector('[data-testid=confirm-new-ask]');
  const askR = ask ? ask.getBoundingClientRect() : null;
  return {
    pos: cs.position,
    released: root.classList.contains('bar-released'),
    hasBottomBar: root.classList.contains('has-bottom-bar'),
    h: Math.round(r.height * 10) / 10,
    top: Math.round(r.top * 10) / 10,
    bottom: Math.round(r.bottom * 10) / 10,
    vh,
    vw: window.innerWidth,
    ratio: Math.round((r.height / vh) * 1000) / 1000,
    scrollY: Math.round(sy),
    docH,
    barAbsBottom: Math.round((r.bottom + sy) * 10) / 10,
    footerBottomAbs: fr ? Math.round((fr.bottom + sy) * 10) / 10 : null,
    scrollPadBottom: parseFloat(rcs.scrollPaddingBottom) || 0,
    sp3: spx(3),
    sp6: spx(6),
    barVar: rcs.getPropertyValue('--bar-h').trim(),
    endSpace: end ? { display: getComputedStyle(end).display, h: Math.round(end.getBoundingClientRect().height) } : null,
    sideMaxH: side ? getComputedStyle(side).maxHeight : null,
    sidePos: side ? getComputedStyle(side).position : null,
    btns,
    ask: askR ? { top: Math.round(askR.top), bottom: Math.round(askR.bottom) } : null,
    active: document.activeElement ? document.activeElement.getAttribute('data-testid') || document.activeElement.tagName : null,
    docOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
  };
};

/** 띠 상태(클래스·높이·위치)가 80ms 간격으로 4번 연속 같을 때까지 기다린다 */
export async function settleBar(page, maxMs = 3000) {
  let last = '';
  let same = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const k = await page.evaluate(() => {
      const b = document.querySelector('[data-testid=bottom-bar]');
      if (!b) return 'nobar';
      const r = b.getBoundingClientRect();
      return `${document.documentElement.classList.contains('bar-released')}|${Math.round(r.height * 10)}|${Math.round(r.top * 10)}|${getComputedStyle(b).position}|${window.innerHeight}|${Math.round(window.scrollY)}`;
    });
    if (k === last) {
      if (++same >= 4) return true;
    } else {
      same = 0;
      last = k;
    }
    await sleep(80);
  }
  return false;
}

/** 휠로 문서 맨 아래까지 내린다(실제 사용자처럼) */
export async function wheelToBottom(page) {
  let last = -1;
  for (let i = 0; i < 80; i++) {
    const y = await page.evaluate(() => Math.round(window.scrollY));
    if (y === last) break;
    last = y;
    await page.mouse.move(100, 100);
    await page.mouse.wheel(0, 700);
    await sleep(50);
  }
  await sleep(120);
}

/** 규칙 판정 (SPEC QM2-12 규칙 1·3): 문제 문자열 목록을 돌려준다 */
export function judgeBar(info, tag) {
  const out = [];
  const fixedLike = info.pos === 'fixed' || info.pos === 'sticky';
  if (fixedLike) {
    if (info.ratio > 0.5 + 0.0005) out.push(`${tag}: 고정된 띠 ${info.h}px가 화면 높이 ${info.vh}의 ${Math.round(info.ratio * 100)}% — 절반을 넘는데 고정이 안 풀림`);
    if (info.released) out.push(`${tag}: 해제 클래스는 있는데 position이 ${info.pos}`);
  } else {
    if (!info.released) out.push(`${tag}: position ${info.pos}인데 bar-released 클래스가 없음`);
    if (Math.abs(info.barAbsBottom - info.docH) > 1.5) out.push(`${tag}: 풀린 띠 아래끝(${info.barAbsBottom})이 문서 끝(${info.docH})이 아님 — 빈 여백 또는 겹침`);
    if (info.footerBottomAbs !== null && info.footerBottomAbs > info.barAbsBottom - info.h + 1.5) out.push(`${tag}: 풀린 띠가 푸터와 겹침(푸터 아래끝 ${info.footerBottomAbs} > 띠 위끝 ${Math.round(info.barAbsBottom - info.h)})`);
    if (info.scrollPadBottom > info.sp3 + 0.5) out.push(`${tag}: 풀린 뒤 scroll-padding-bottom ${info.scrollPadBottom}px > 기본 간격 ${info.sp3}px`);
    if (info.endSpace && info.endSpace.display !== 'none' && info.endSpace.h > 0) out.push(`${tag}: 풀린 뒤에도 본문 끝 여백 ${info.endSpace.h}px`);
    if (info.sidePos === 'sticky' && info.vw >= 960 && info.sideMaxH && info.sideMaxH !== 'none') {
      const mh = parseFloat(info.sideMaxH);
      if (Number.isFinite(mh) && Math.abs(mh - (info.vh - info.sp6 - 3)) > 2) out.push(`${tag}: 풀린 뒤 우측 열 max-height ${info.sideMaxH} (기대 약 ${Math.round(info.vh - info.sp6 - 3)}px — 띠 높이에 묶인 채)`);
    }
  }
  if (info.docOverflow > 0) out.push(`${tag}: 가로 넘침 ${info.docOverflow}px`);
  return out;
}
