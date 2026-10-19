import { expect, type Page } from '@playwright/test';

/**
 * 글자 확대·리플로 측정 (SPEC-003 CM11, QM2-3, QA-003-M2 M2-V04). first-screen·text-resize·line-breaks e2e가 같이 쓴다.
 * 한 번의 page.evaluate로 지금 화면의 가로 넘침·글자 잘림·이름표 겹침·하단 띠를 잰다.
 *  - 가로 넘침: `documentElement.scrollWidth − clientWidth ≤ 0` 이고 화면에 보이는 모든 요소의 오른쪽 끝 ≤ 뷰포트 폭 (허용치 0px, 반올림 때문에 1px 의심이 나오면 허용치를 올리지 않고 원인 요소를 고친다).
 *    시각적으로 숨긴 요소(`sr-only`)·스프라이트·`visibility: hidden`(전환 중 안 보이는 슬라이드)은 문서 폭을 늘리지 않는 한 제외한다.
 *  - 글자 잘림: 스크롤 영역(overflow가 visible이 아닌 요소)의 내용이 상자보다 크거나, 글자가 자기 상자(블록·버튼)의 오른쪽 끝을 넘는다.
 *  - 이름표 겹침: 수저 띠의 이름표(`.spoon-fig__name`)끼리 겹치지 않고 띠 안에 있다.
 */

export interface TextResizeMeasure {
  viewport: { width: number; height: number };
  rootFontPx: number;
  /** scrollWidth − clientWidth (0 이하여야 한다) */
  overflowPx: number;
  /** 오른쪽 끝이 뷰포트 폭을 넘는 요소들 (태그.클래스로 표기) */
  offenders: string[];
  /** 글자가 자기 상자를 벗어났거나 스크롤 영역 안에서 잘린 요소들 */
  clipped: string[];
  /** 겹치거나 띠 밖으로 나간 수저 이름표 쌍 */
  nameOverlaps: string[];
  /** 수저 이름표가 몇 개 있는지 (공허 통과 방지) */
  nameCount: number;
  bar: BarMeasure | null;
  /** 띠 안의 버튼들: 높이·한가운데에서 맞는 요소가 그 버튼인가. 풀린(고정이 아닌) 띠는 버튼마다 화면 안으로 스크롤한 뒤 잰다 */
  buttons: Array<{ id: string; height: number; width: number; hit: boolean; inViewport: boolean }>;
}

/** 하단 띠 측정 (QM2-12): 고정이면 높이가 뷰포트의 절반 이하여야 하고, 풀렸으면(position이 fixed·sticky가 아님) 본문 끝 아래에 겹침 없이 놓여야 한다 */
export interface BarMeasure {
  height: number;
  /** 띠 높이 / 뷰포트 높이 */
  ratio: number;
  /** 계산된 position이 fixed·sticky인가 (false = 고정이 풀려 문서 흐름에 있다) */
  fixed: boolean;
  /** 문서 좌표(스크롤 위치를 더한 값)에서 띠의 위끝·아래끝 */
  docTop: number;
  docBottom: number;
  /** 푸터(본문 마지막 줄)의 아래끝(문서 좌표) */
  contentBottom: number;
  /** 문서 전체 높이 */
  docHeight: number;
  /** html의 계산된 scroll-padding-bottom(px) */
  scrollPaddingBottom: number;
}

export async function measureTextResize(page: Page): Promise<TextResizeMeasure> {
  // 하단 띠의 높이 변수(--bar-h)와 고정 해제(html.bar-released)는 ResizeObserver·resize 이벤트로 한 프레임 뒤에 정해진다 — 확인 단계를 열거나 글자 크기·창 크기를 바꾼 직후에는 정착할 때까지 기다린다(QM2-12)
  await page.waitForFunction(() => {
    const bar = document.querySelector('[data-testid="bottom-bar"]') as HTMLElement | null;
    if (bar === null) return true;
    const root = document.documentElement;
    // 앱의 판정 기준은 작은 뷰포트 높이(100svh 탐침, ui/barRelease.ts — R-240)다. 탐침이 없으면(svh를 모르는 브라우저) innerHeight
    const probe = document.querySelector('[data-viewport-probe]');
    const view = probe === null ? window.innerHeight : probe.getBoundingClientRect().height;
    return root.style.getPropertyValue('--bar-h') === `${bar.offsetHeight}px` && root.classList.contains('bar-released') === bar.offsetHeight > view * 0.5;
  }, undefined, { timeout: 5_000 }).catch(() => undefined); // 정착하지 않으면(예: 고정 해제가 꺼진 구현) 기다림을 포기하고 그 상태를 그대로 재서 barViolations가 규칙 위반으로 알린다
  return page.evaluate(() => {
    const root = document.documentElement;
    const vw = root.clientWidth;
    const vh = window.innerHeight;
    const name = (el: Element): string => {
      const c = (el as HTMLElement).className;
      const cls = typeof c === 'string' && c.trim() !== '' ? `.${c.trim().split(/\s+/)[0]}` : '';
      const t = el.getAttribute('data-testid');
      return `${el.tagName}${cls}${t ? `#${t}` : ''}`;
    };
    // 시각적으로 숨긴 표 머리글처럼 `position: absolute` + `clip: rect(0,0,0,0)`로 1px에 접은 요소(와 그 안쪽)도 `sr-only`와 같이 뺀다 (M3 출생신고의 비교 표 머리글)
    const clipHidden = (el: Element): boolean => {
      for (let cur: Element | null = el; cur !== null && cur !== document.body; cur = cur.parentElement) {
        const c = getComputedStyle(cur);
        if (c.position === 'absolute' && /^rect\(0(px)?,? ?0(px)?,? ?0(px)?,? ?0(px)?\)$/.test(c.clip)) return true;
      }
      return false;
    };
    const skip = (el: Element): boolean => {
      if (el.closest('.sprite, .sr-only, [aria-hidden="true"] defs')) return true;
      const cs = getComputedStyle(el);
      return cs.visibility === 'hidden' || cs.display === 'none' || clipHidden(el);
    };
    const offenders: string[] = [];
    const clipped: string[] = [];
    // 줄임(…)으로 한 줄에 줄인 글자는 "잘림"이 아니라 설계된 표시다 — 허용 목록(designer D-88: compact에서 시트 위에 고정되는 질문 한 줄)에 있고 세 조건(text-overflow: ellipsis · white-space: nowrap · overflow-x: hidden)이 모두 걸려 있을 때만.
    // 조건이 하나라도 빠지면(예: 줄임표 없이 그냥 잘림) 허용하지 않는다. 전체 문장은 compact가 풀리면 다시 다 보이고 접근 가능한 이름은 그대로다.
    const ELLIPSIS_ALLOWED = ['.sheet--compact .sheet__title'];
    const ellipsisAllowed = (el: Element, cs: CSSStyleDeclaration): boolean =>
      ELLIPSIS_ALLOWED.some((sel) => el.matches(sel)) && cs.textOverflow === 'ellipsis' && cs.whiteSpace === 'nowrap' && cs.overflowX === 'hidden';
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      if (skip(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      // SVG 안쪽 도형은 svg 상자가 판단한다
      if (el.closest('svg') !== null && el.tagName.toLowerCase() !== 'svg') continue;
      if (r.right > vw + 0.5 || r.left < -0.5) offenders.push(`${name(el)}(${Math.round(r.left)}~${Math.round(r.right)} > ${vw})`);
      const cs = getComputedStyle(el);
      const scroll = cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
      if (scroll && el !== root && el !== document.body) {
        if (el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'visible' && !ellipsisAllowed(el, cs)) clipped.push(`${name(el)}: 가로 ${el.scrollWidth} > ${el.clientWidth}`);
      }
      // 글자가 자기 상자의 오른쪽 끝을 넘는다 (블록·버튼·flex/grid 아이템. 줄 안의 인라인은 제외)
      if (cs.display !== 'inline' && cs.display !== 'contents' && !ellipsisAllowed(el, cs)) {
        const hasText = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
        if (hasText) {
          // 눈에 보이는 글자만 센다: 시각적으로 숨긴 글자(.sr-only — 한 줄로 이어 붙인 읽기 전용 문장은 상자보다 길다)가 같은 요소 안에 있어도 잘림으로 잡지 않는다 (M5 안내 줄 .choice-panel__hint)
          const range = document.createRange();
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let hit = false;
          for (let n = walker.nextNode(); n !== null && !hit; n = walker.nextNode()) {
            const holder = (n as Text).parentElement;
            if (holder === null || (n.textContent ?? '').trim() === '' || skip(holder)) continue;
            range.selectNodeContents(n);
            for (const tr of Array.from(range.getClientRects())) {
              if (tr.width > 0 && tr.right > r.right + 1) {
                clipped.push(`${name(el)}: 글자 ${Math.round(tr.right)} > 상자 ${Math.round(r.right)}`);
                hit = true;
                break;
              }
            }
          }
        }
      }
    }
    // 수저 이름표 겹침
    const names = Array.from(document.querySelectorAll('.spoon-fig__name')).map((e) => ({ text: (e.textContent ?? '').trim(), r: e.getBoundingClientRect() }));
    const nameOverlaps: string[] = [];
    const lineup = document.querySelector('[data-testid="spoon-lineup"]')?.getBoundingClientRect();
    for (let i = 0; i < names.length; i++) {
      if (lineup !== undefined && (names[i].r.right > lineup.right + 0.5 || names[i].r.left < lineup.left - 0.5)) nameOverlaps.push(`${names[i].text}: 띠 밖으로 나감`);
      for (let j = i + 1; j < names.length; j++) {
        const a = names[i].r;
        const b = names[j].r;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 0.5 && h > 0.5) nameOverlaps.push(`${names[i].text} × ${names[j].text}`);
      }
    }
    const barEl = document.querySelector('[data-testid="bottom-bar"]');
    const barFixed = barEl !== null && ['fixed', 'sticky'].includes(getComputedStyle(barEl).position);
    // 본문 마지막 줄: 첫 화면은 푸터(title-foot), 룰렛·출생신고(M3)는 하단 안내(page-foot)
    const footEl = document.querySelector('[data-testid="title-foot"], [data-testid="page-foot"]');
    const scrollY = window.scrollY;
    const barRect = barEl?.getBoundingClientRect();
    const bar =
      barEl === null || barRect === undefined
        ? null
        : {
            height: barRect.height,
            ratio: barRect.height / vh,
            fixed: barFixed,
            docTop: barRect.top + scrollY,
            docBottom: barRect.bottom + scrollY,
            contentBottom: footEl === null ? 0 : footEl.getBoundingClientRect().bottom + scrollY,
            docHeight: root.scrollHeight,
            scrollPaddingBottom: parseFloat(getComputedStyle(root).scrollPaddingBottom) || 0,
          };
    const buttons = barEl === null ? [] : Array.from(barEl.querySelectorAll('button')).map((b) => {
      // 풀린 띠는 본문 끝에 있어 스크롤해야 닿는다 — 버튼마다 화면 안으로 스크롤한 뒤 잰다(고정 띠는 늘 화면 안이라 스크롤하지 않는다)
      if (!barFixed) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = b.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { id: b.getAttribute('data-testid') ?? name(b), height: r.height, width: r.width, hit: hit !== null && (b === hit || b.contains(hit)), inViewport: r.top >= -0.5 && r.bottom <= vh + 0.5 };
    });
    return {
      viewport: { width: vw, height: vh },
      rootFontPx: parseFloat(getComputedStyle(root).fontSize),
      overflowPx: root.scrollWidth - root.clientWidth,
      offenders,
      clipped,
      nameOverlaps,
      nameCount: names.length,
      bar,
      buttons,
    };
  });
}

/** 측정 결과를 규칙에 맞춰 위반 목록으로 (비어 있으면 통과) */
export function textResizeViolations(m: TextResizeMeasure, label: string): string[] {
  const out: string[] = [];
  if (m.overflowPx > 0) out.push(`${label}: 가로 넘침 ${m.overflowPx}px — ${m.offenders.slice(0, 8).join(', ')}`);
  if (m.offenders.length > 0 && m.overflowPx <= 0) out.push(`${label}: 화면 밖으로 나간 요소 — ${m.offenders.slice(0, 8).join(', ')}`);
  if (m.clipped.length > 0) out.push(`${label}: 글자 잘림 — ${m.clipped.slice(0, 8).join(' | ')}`);
  if (m.nameOverlaps.length > 0) out.push(`${label}: 이름표 겹침 — ${m.nameOverlaps.join(', ')}`);
  return out;
}

/**
 * 하단 띠 규칙 (QM2-3·QM2-12): 띠가 **고정**(position fixed·sticky)이면 높이가 뷰포트 높이의 절반 이하이고, **고정이 풀렸으면** 띠는 본문 마지막 줄 아래에 겹침 없이 문서 끝에 놓인다
 * (절반 이하인데 풀리는 것도 어긋난 것이다 — 「50% 이하이면 현행대로 고정」). 어느 쪽이든 띠의 버튼은 눌리고(높이 ≥ 44px, 한가운데에서 그 버튼이 맞는다) 화면 안으로 닿는다.
 */
export function barViolations(m: TextResizeMeasure, label: string): string[] {
  const out: string[] = [];
  if (m.bar === null) return [`${label}: 하단 띠가 없다`];
  if (m.bar.fixed) {
    if (m.bar.ratio > 0.5 + 1e-6) out.push(`${label}: 고정된 하단 띠 ${Math.round(m.bar.height)}px가 화면 높이(${m.viewport.height})의 ${(m.bar.ratio * 100).toFixed(0)}% — 절반을 넘는데 고정이 풀리지 않았다`);
  } else {
    if (m.bar.ratio <= 0.5 + 1e-6) out.push(`${label}: 하단 띠 ${Math.round(m.bar.height)}px가 화면 높이(${m.viewport.height})의 ${(m.bar.ratio * 100).toFixed(0)}%로 절반 이하인데 고정이 풀렸다`);
    if (m.bar.docTop < m.bar.contentBottom - 0.5) out.push(`${label}: 풀린 띠(문서 ${Math.round(m.bar.docTop)}~)가 본문 마지막 줄(아래끝 ${Math.round(m.bar.contentBottom)})과 겹친다`);
    if (m.bar.docHeight - m.bar.docBottom > 1.5) out.push(`${label}: 풀린 띠 아래에 빈 여백 ${Math.round(m.bar.docHeight - m.bar.docBottom)}px가 남는다(본문 끝 여백이 안 풀렸다)`);
  }
  if (m.buttons.length === 0) out.push(`${label}: 하단 띠에 버튼이 없다`);
  for (const b of m.buttons) {
    if (b.height < 44 - 0.5) out.push(`${label}: ${b.id} 높이 ${Math.round(b.height)}px < 44px`);
    if (!b.hit) out.push(`${label}: ${b.id} 한가운데에서 다른 요소가 눌린다`);
    if (!b.inViewport) out.push(`${label}: ${b.id}가 화면 밖에 있다`);
  }
  return out;
}

/** 루트 글자 크기를 바꾼다 (기기·브라우저의 글자 크기 설정 상당). 새로 그린 뒤 레이아웃이 안정되도록 두 프레임 기다린다. */
export async function setRootFontPercent(page: Page, percent: number): Promise<void> {
  await page.evaluate((p) => {
    document.documentElement.style.fontSize = `${p}%`;
  }, percent);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const px = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  expect(px, `루트 글자 크기 ${percent}%`).toBeCloseTo((16 * percent) / 100, 1);
}
