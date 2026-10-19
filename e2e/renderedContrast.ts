import { type Locator, type Page } from '@playwright/test';

/** 요소 스크린샷의 PNG 바이트 (Playwright 반환형을 그대로 쓴다 — 이 설정에는 Node 타입이 없어 `Buffer`를 직접 적지 않는다) */
export type PngBytes = Awaited<ReturnType<Locator['screenshot']>>;

/**
 * 렌더 픽셀 기준 대비 (SPEC-003 QM3-5, R-291). 계산된 글자색 대 배경색 비교는 **시스템 색 토큰이 바탕을 덮어쓰지 못하는 문제**(강제 색상에서 출생신고 띠 바탕이 검게 남고 글자 뒤에
 * Canvas 백플레이트가 깔려 글자가 사라진 일)를 못 잡는다. 그래서 색 바탕 상자를 **요소 스크린샷**으로 떠서 글자가 놓인 자리의 **픽셀**로 직접 잰다.
 *
 * - 색 바탕 상자 = 계산된 배경색이 투명이 아니고 눈에 보이는 글자를 품은 요소(글자의 가장 가까운 배경 조상). `html`·`body`·화면 바탕(`.page`)은 사용자 에이전트의 바탕이라 상자로 세지 않는다.
 * - 상자마다 요소 스크린샷 → 상자 안 글자(텍스트 노드의 줄 상자)마다 그 자리의 픽셀에서 **바탕 색**(가장 많은 색)과 **글자 색**(바탕과 명도 대비가 가장 큰 색, 3픽셀 이상)을 골라 명도 대비를 잰다.
 *   백플레이트가 글자를 가리면 그 자리가 한 색이라 대비가 1:1로 나온다(띠 제목 「출생 신고」가 이 시험에 걸린다).
 * - 눈에 보이는 글자만 센다: `.sr-only`·`visibility: hidden`·`display: none`·svg·조상 overflow가 잘라 낸 글자. 룰렛 릴의 결과 칸 밖 줄(흐림 가림막이 일부러 덮는 줄)은 장식 연출이라 뺀다.
 * - 하단 고정 띠는 다른 상자를 가리지 않도록 상자마다 숨기고(띠 자신은 숨기지 않는다) 뜬다.
 */

export interface RenderedContrastReport {
  /** 잰 색 바탕 상자 수 */
  boxes: number;
  /** 잰 글자 수(텍스트 노드의 줄 상자) */
  texts: number;
  /** 기준 미달 목록: 「상자 — 글자 — 대비」 */
  low: string[];
  /** 가장 낮은 대비 */
  min: number;
  /** 상자 이름 목록 (보고용) */
  boxNames: string[];
  /** 잰 글자 목록 「상자|글자」 — 띠 제목·표기처럼 꼭 재야 하는 글자가 실제로 들었는지 확인하는 공허 통과 방지용 */
  measured: string[];
}

interface Collected {
  names: string[];
}

/** 화면의 색 바탕 상자를 모아 임시 표식(data-rc-box)을 단다 */
async function collectBoxes(page: Page): Promise<Collected> {
  return page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll('[data-rc-box]'))) el.removeAttribute('data-rc-box');
    const rootEls = new Set<Element>([document.documentElement, document.body]);
    const isPageRoot = (el: Element): boolean => rootEls.has(el) || el.classList.contains('page') || el.classList.contains('title-page') || el.id === 'root';
    const hiddenCache = new Map<Element, boolean>();
    const isHidden = (el: Element): boolean => {
      const cached = hiddenCache.get(el);
      if (cached !== undefined) return cached;
      const cs = getComputedStyle(el);
      let out = false;
      if (el.classList.contains('sr-only') || el.tagName.toLowerCase() === 'svg') out = true;
      else if (cs.display === 'none' || cs.visibility === 'hidden') out = true;
      else if (cs.position === 'absolute' && /^rect\(0(px)?,? ?0(px)?,? ?0(px)?,? ?0(px)?\)$/.test(cs.clip)) out = true;
      else if (el.parentElement !== null) out = isHidden(el.parentElement);
      hiddenCache.set(el, out);
      return out;
    };
    // 읽히지 않는 글자(diff-003.md D-59): 모달 시트 뒤 스크림에 가린 바깥(`[inert]` 안)은 어두워져 있어 읽는 글자가 아니고, 닫힌 <details>의 본문(요약 밖)은 화면에 없다
    const notRead = (el: Element): boolean => {
      if (el.closest('[inert]') !== null) return true;
      if (el.closest('details:not([open])') !== null && el.closest('summary') === null) return true;
      return false;
    };
    const boxes = new Set<Element>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if (!/[가-힣A-Za-z0-9]/.test(node.textContent ?? '')) continue;
      const parent = (node as Text).parentElement;
      if (parent === null || isHidden(parent)) continue;
      if (parent.closest('.reel') !== null && parent.closest('.is-result') === null) continue; // 릴의 결과 칸 밖 줄은 흐림 가림막이 덮는 장식 연출
      if (notRead(parent)) continue;
      for (let cur: Element | null = parent; cur !== null; cur = cur.parentElement) {
        const bg = getComputedStyle(cur).backgroundColor;
        const m = /rgba?\(([^)]+)\)/.exec(bg);
        const alpha = m === null ? 0 : (() => {
          const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
          return p.length > 3 ? p[3] : 1;
        })();
        if (alpha > 0) {
          if (!isPageRoot(cur)) boxes.add(cur);
          break;
        }
      }
    }
    const names: string[] = [];
    let i = 0;
    for (const el of boxes) {
      el.setAttribute('data-rc-box', String(i++));
      const cls = (el as HTMLElement).className;
      const testId = el.getAttribute('data-testid');
      names.push(`${el.tagName.toLowerCase()}${typeof cls === 'string' && cls.trim() !== '' ? `.${cls.trim().split(/\s+/)[0]}` : ''}${testId === null ? '' : `#${testId}`}`);
    }
    return { names };
  });
}

export interface TextRect {
  text: string;
  /** 상자 안 좌표(상자 왼쪽 위가 0,0) */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 상자 안 글자의 줄 상자를 상자 좌표로 구한다 (스크롤 뒤 바로 잰다) */
async function textRectsOf(page: Page, index: number): Promise<{ width: number; height: number; rects: TextRect[] } | null> {
  return page.evaluate((i) => {
    const box = document.querySelector(`[data-rc-box="${i}"]`);
    if (box === null) return null;
    const b = box.getBoundingClientRect();
    const rects: Array<{ text: string; x: number; y: number; w: number; h: number }> = [];
    const hiddenCache = new Map<Element, boolean>();
    const isHidden = (el: Element): boolean => {
      const cached = hiddenCache.get(el);
      if (cached !== undefined) return cached;
      const cs = getComputedStyle(el);
      let out = false;
      if (el.classList.contains('sr-only') || el.tagName.toLowerCase() === 'svg') out = true;
      else if (cs.display === 'none' || cs.visibility === 'hidden') out = true;
      else if (cs.position === 'absolute' && /^rect\(0(px)?,? ?0(px)?,? ?0(px)?,? ?0(px)?\)$/.test(cs.clip)) out = true;
      else if (el.parentElement !== null) out = isHidden(el.parentElement);
      hiddenCache.set(el, out);
      return out;
    };
    const nearestBox = (el: Element): Element | null => {
      for (let cur: Element | null = el; cur !== null; cur = cur.parentElement) if (cur.hasAttribute('data-rc-box')) return cur;
      return null;
    };
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = (node.textContent ?? '').trim();
      if (!/[가-힣A-Za-z0-9]/.test(text)) continue; // 구분 기호(「·」)만 있는 글자는 점 하나라 픽셀로 재기 어렵고, 양옆 낱말이 이미 상자를 증명한다
      const parent = (node as Text).parentElement;
      if (parent === null || isHidden(parent)) continue;
      if (parent.closest('.reel') !== null && parent.closest('.is-result') === null) continue;
      if (parent.closest('[inert]') !== null) continue; // 모달 뒤 스크림에 가린 바깥 글자 (D-59)
      if (nearestBox(parent) !== box) continue; // 안쪽 다른 색 바탕 상자의 글자는 그 상자가 잰다
      // 글자와 상자 사이의 스크롤 영역(overflow가 visible이 아닌 조상)이 잘라 내는 곳: 완전히 보이는 줄만 잰다. 스크롤 영역 밖으로 밀려난 줄이나 가장자리에 반쯤 걸린 줄은
      // 요소 스크린샷에 글자가 없거나 일부만 있어 「글자 색 = 바탕 색」으로 잘못 읽힌다(대시보드 인생 기록의 스크롤 영역, M4). 사용자가 읽을 수 없는 글자라 대비의 대상도 아니다.
      const clips: DOMRect[] = [];
      // 상자 자신이 스크롤 영역이면(모달 시트) 그 보이는 칸 밖으로 밀려난 줄도 요소 스크린샷에 들지 않으므로 같이 거른다(M7b — 시트는 맨 위·맨 아래 두 자리에서 따로 잰다)
      for (let cur: Element | null = parent; cur !== null; cur = cur.parentElement) {
        const cs = getComputedStyle(cur);
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') clips.push(cur.getBoundingClientRect());
        if (cur === box) break;
      }
      range.selectNodeContents(node);
      for (const r of Array.from(range.getClientRects())) {
        if (r.width < 2 || r.height < 4) continue;
        if (clips.some((c) => r.left < c.left - 1 || r.right > c.right + 1 || r.top < c.top - 1 || r.bottom > c.bottom + 1)) continue;
        rects.push({ text: text.slice(0, 14), x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height });
      }
    }
    return { width: b.width, height: b.height, rects };
  }, index);
}

export interface RegionResult {
  text: string;
  ratio: number;
  bg: string;
  fg: string;
}

/** 스크린샷(PNG)을 브라우저에서 풀어 글자 자리마다 바탕 색·글자 색·명도 대비를 잰다 */
export async function analyze(page: Page, png: PngBytes, rects: TextRect[], boxSize: { width: number; height: number }): Promise<RegionResult[]> {
  return page.evaluate(
    async ([b64, regions, size]) => {
      const bytes = Uint8Array.from(atob(b64 as string), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(bitmap, 0, 0);
      const scaleX = bitmap.width / Math.max(1, (size as { width: number }).width);
      const scaleY = bitmap.height / Math.max(1, (size as { height: number }).height);
      const lin = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const out: Array<{ text: string; ratio: number; bg: string; fg: string }> = [];
      for (const r of regions as TextRect[]) {
        // 글자 줄 상자의 가장자리 2픽셀은 뺀다: 백플레이트(글자 뒤 바탕 사각형)가 줄 상자보다 한두 픽셀 작으면 가장자리에 바깥 바탕색이 끼어, 글자가 가려졌는데도 「글자 색」으로 읽힌다
        const inset = 2;
        const x0 = Math.max(0, Math.floor(r.x * scaleX) + inset);
        const y0 = Math.max(0, Math.floor(r.y * scaleY) + inset);
        const x1 = Math.min(bitmap.width, Math.ceil((r.x + r.w) * scaleX) - inset);
        const y1 = Math.min(bitmap.height, Math.ceil((r.y + r.h) * scaleY) - inset);
        if (x1 <= x0 || y1 <= y0) continue;
        const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
        const counts = new Map<number, number>();
        for (let i = 0; i < data.length; i += 4) {
          const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        let bgKey = 0;
        let bgCount = -1;
        for (const [k, n] of counts) if (n > bgCount) { bgKey = k; bgCount = n; }
        const bgL = lum((bgKey >> 16) & 255, (bgKey >> 8) & 255, bgKey & 255);
        let best = 1;
        let bestKey = bgKey;
        for (const [k, n] of counts) {
          if (n < 3) continue;
          const l = lum((k >> 16) & 255, (k >> 8) & 255, k & 255);
          const ratio = (Math.max(l, bgL) + 0.05) / (Math.min(l, bgL) + 0.05);
          if (ratio > best) { best = ratio; bestKey = k; }
        }
        const hex = (k: number) => `#${k.toString(16).padStart(6, '0')}`;
        out.push({ text: r.text, ratio: best, bg: hex(bgKey), fg: hex(bestKey) });
      }
      return out;
    },
    [png.toString('base64'), rects, boxSize] as const,
  );
}

/**
 * 지금 화면의 모든 색 바탕 상자를 요소 스크린샷으로 떠서 글자 자리의 렌더 픽셀 명도 대비를 잰다 (`min` 기본 4.5:1).
 * `screenshotDir`가 있으면 미달 상자의 스크린샷을 그 폴더에 남긴다(디버깅·증거용).
 */
export async function measureRenderedContrast(page: Page, options: { min?: number; evidence?: (name: string, png: PngBytes) => Promise<void> } = {}): Promise<RenderedContrastReport> {
  const min = options.min ?? 4.5;
  const { names } = await collectBoxes(page);
  const low: string[] = [];
  const measured: string[] = [];
  let texts = 0;
  let lowest = Infinity;
  for (let i = 0; i < names.length; i++) {
    const loc = page.locator(`[data-rc-box="${i}"]`);
    const inBar = await loc.evaluate((el) => el.closest('[data-testid="bottom-bar"]') !== null);
    // 고정 띠가 다른 상자를 가리지 않게(띠 자신은 숨기지 않는다)
    await page.evaluate((hide) => {
      const bar = document.querySelector('[data-testid="bottom-bar"]') as HTMLElement | null;
      if (bar !== null) bar.style.visibility = hide ? 'hidden' : '';
    }, !inBar);
    await loc.scrollIntoViewIfNeeded();
    const info = await textRectsOf(page, i);
    if (info === null || info.rects.length === 0 || info.width < 2 || info.height < 2) continue;
    const png = await loc.screenshot({ animations: 'disabled' });
    const results = await analyze(page, png, info.rects, { width: info.width, height: info.height });
    let boxLow = false;
    for (const r of results) {
      texts++;
      measured.push(`${names[i]}|${r.text}`);
      lowest = Math.min(lowest, r.ratio);
      if (r.ratio < min) {
        low.push(`${names[i]} 「${r.text}」 ${r.ratio.toFixed(2)}:1 < ${min} (바탕 ${r.bg} · 글자 ${r.fg})`);
        boxLow = true;
      }
    }
    if (boxLow && options.evidence !== undefined) await options.evidence(names[i].replace(/[^\w.#-]/g, '_'), png);
  }
  await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="bottom-bar"]') as HTMLElement | null;
    if (bar !== null) bar.style.visibility = '';
    for (const el of Array.from(document.querySelectorAll('[data-rc-box]'))) el.removeAttribute('data-rc-box');
  });
  return { boxes: names.length, texts, low, min: Number.isFinite(lowest) ? lowest : 0, boxNames: names, measured };
}
