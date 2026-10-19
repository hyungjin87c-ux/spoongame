import { type Page } from '@playwright/test';
import { FORCED_BREAK_WORDS, INTENDED_BREAK_WORDS } from './intendedBreaks';

/**
 * 줄바꿈 품질 측정 (SPEC-003 QM2-5, QA-003-M2 인상). 화면에 보이는 글자를 글자 하나씩 `Range`로 재서 줄로 나눈 뒤 두 가지를 본다.
 *  (a) 구분 기호가 줄 끝이나 첫머리에 서지 않는다: 줄 마지막(공백 제외) 글자가 `·` `/` `—` `(` 인 줄 0, 줄 첫 글자가 `·` `/` `—` `)` `,` `.` 인 줄 0.
 *      (쉼표·마침표는 구분 기호가 아니라 문장부호라 줄 끝에 오는 것은 괜찮고 줄 첫머리에 오는 것만 막는다 — QM2-10 규칙 2.)
 *  (b) 숫자와 바로 뒤 단위(`/\d[\d,.]*\s?(%|명|건|세|년|월|일|시)/`)와 날짜·시각 묶음(`/\d+월 \d+일( \d+시)?/`)이 통째로 같은 줄에 있다.
 * 줄은 글자 상자의 세로 겹침으로 나눈다(같은 줄의 글자는 서로 높이가 겹치고, 다음 줄은 거의 겹치지 않는다). 글자가 섞여 있어도(큰 숫자 + 작은 단위) 같은 줄로 본다.
 * 읽는 글자만 센다: 시각적으로 숨긴 요소(sr-only)·svg·`visibility: hidden`(전환 중 안 보이는 슬라이드)·`display: none`은 뺀다.
 * 숫자+단위·날짜 묶음은 **블록 하나 안에서만** 찾는다(블록 사이의 글자를 이어 붙여 거짓으로 맞추지 않는다).
 * `keepWords`: 갈라지면 안 되는 낱말(예 「한 번의」) — 블록 안에서 찾아 모든 글자가 같은 줄에 있어야 한다.
 */

export interface LineReport {
  /** 잰 줄 수 (공허 통과 방지) */
  lineCount: number;
  /** 잰 글자 수 */
  charCount: number;
  /** 숫자+단위·날짜 묶음·keepWords로 잰 개수 */
  keepChecked: number;
  /** 위반 (비면 통과) */
  violations: string[];
  /** 줄 모양 보기용: 앞 몇 줄 */
  sample: string[];
}

export async function measureLineBreaks(page: Page, scopeSelector: string, options: { separators?: boolean; keeps?: boolean; keepWords?: readonly string[] } = {}): Promise<LineReport> {
  const check = { separators: options.separators ?? true, keeps: options.keeps ?? true, keepWords: [...(options.keepWords ?? [])] };
  return page.evaluate(
    ([selector, wanted]) => {
      const scope = document.querySelector(selector);
      if (scope === null) throw new Error(`범위를 찾을 수 없다: ${selector}`);
      const BLOCK_INLINE = new Set(['inline', 'inline-block', 'inline-flex', 'inline-grid', 'contents', 'ruby', 'ruby-text']);
      type Ch = { ch: string; top: number; bottom: number; left: number; right: number; block: Element };
      const chars: Ch[] = [];
      const blockOf = (el: Element | null): Element => {
        let cur: Element | null = el;
        while (cur !== null && cur !== scope && BLOCK_INLINE.has(getComputedStyle(cur).display)) cur = cur.parentElement;
        return cur ?? (scope as Element);
      };
      const hidden = (el: Element | null): boolean => {
        for (let cur = el; cur !== null; cur = cur.parentElement) {
          if (cur.classList.contains('sr-only') || cur.tagName.toLowerCase() === 'svg') return true;
          const cs = getComputedStyle(cur);
          if (cs.visibility === 'hidden' || cs.display === 'none') return true;
          // `position: absolute` + `clip: rect(0,0,0,0)`로 1px에 접은 시각적으로 숨긴 요소(좁은 폭의 비교 표 머리글 등)도 읽는 글자가 아니다
          if (cs.position === 'absolute' && /^rect\(0(px)?,? ?0(px)?,? ?0(px)?,? ?0(px)?\)$/.test(cs.clip)) return true;
          if (cur === scope) break;
        }
        return false;
      };
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode() as Text | null; node !== null; node = walker.nextNode() as Text | null) {
        const parent = node.parentElement;
        if (parent === null || hidden(parent)) continue;
        const block = blockOf(parent);
        const text = node.data;
        const range = document.createRange();
        for (let i = 0; i < text.length; i++) {
          if (/\s/.test(text[i])) {
            chars.push({ ch: text[i], top: NaN, bottom: NaN, left: NaN, right: NaN, block });
            continue;
          }
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const r = range.getClientRects()[0];
          if (r === undefined || (r.width === 0 && r.height === 0)) {
            chars.push({ ch: text[i], top: NaN, bottom: NaN, left: NaN, right: NaN, block });
            continue;
          }
          chars.push({ ch: text[i], top: r.top, bottom: r.bottom, left: r.left, right: r.right, block });
        }
      }
      // 줄 나누기: 같은 블록 안에서 글자 상자의 세로 겹침이 작아지면 새 줄
      const lineOf: number[] = new Array(chars.length).fill(-1);
      const lines: number[][] = [];
      let cur: { top: number; bottom: number; block: Element; idx: number[] } | null = null;
      chars.forEach((c, i) => {
        if (Number.isNaN(c.top)) {
          // 공백·재지 못한 글자는 앞 글자와 같은 줄로 (맨 앞이면 다음 글자가 정한다)
          if (cur !== null && cur.block === c.block) {
            cur.idx.push(i);
            lineOf[i] = lines.length - 1;
          }
          return;
        }
        const h = c.bottom - c.top;
        if (cur !== null && cur.block === c.block) {
          const overlap = Math.min(c.bottom, cur.bottom) - Math.max(c.top, cur.top);
          const smaller = Math.min(h, cur.bottom - cur.top);
          if (overlap >= 0.5 * smaller) {
            cur.top = Math.min(cur.top, c.top);
            cur.bottom = Math.max(cur.bottom, c.bottom);
            cur.idx.push(i);
            lineOf[i] = lines.length - 1;
            return;
          }
        }
        cur = { top: c.top, bottom: c.bottom, block: c.block, idx: [i] };
        lines.push(cur.idx);
        lineOf[i] = lines.length - 1;
      });
      const visible = (i: number) => !Number.isNaN(chars[i].top);
      const violations: string[] = [];
      const show = (idx: number[]) => idx.map((i) => chars[i].ch).join('').replace(/\s+/g, ' ').trim();
      if (wanted.separators) {
        for (const idx of lines) {
          const vis = idx.filter(visible).filter((i) => chars[i].ch.trim() !== '');
          if (vis.length === 0) continue;
          const first = chars[vis[0]].ch;
          const last = chars[vis[vis.length - 1]].ch;
          if ('·/—('.includes(last) && vis.length >= 1) violations.push(`줄 끝에 「${last}」: 「${show(idx)}」`);
          if ('·/—),.'.includes(first) && vis.length >= 1) violations.push(`줄 첫머리에 「${first}」: 「${show(idx)}」`);
        }
      }
      let keepChecked = 0;
      if (wanted.keeps) {
        // 블록마다 글자를 이어 붙여(공백 포함) 숫자+단위·날짜를 찾고, 그 범위의 글자가 모두 같은 줄인지 본다
        const blocks = new Map<Element, number[]>();
        chars.forEach((c, i) => {
          if (!blocks.has(c.block)) blocks.set(c.block, []);
          blocks.get(c.block)!.push(i);
        });
        const patterns: RegExp[] = [/\d[\d,.]*\s?(?:%|명|건|세|년|월|일|시)/g, /\d+월 \d+일(?: \d+시)?/g];
        for (const word of wanted.keepWords) patterns.push(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
        for (const idxs of blocks.values()) {
          const text = idxs.map((i) => chars[i].ch).join('');
          for (const re of patterns) {
            for (const m of text.matchAll(re)) {
              const from = m.index ?? 0;
              const to = from + m[0].length;
              const span = idxs.slice(from, to).filter((i) => visible(i) && chars[i].ch.trim() !== '');
              if (span.length === 0) continue;
              keepChecked++;
              const lineIds = new Set(span.map((i) => lineOf[i]));
              if (lineIds.size > 1) violations.push(`「${m[0]}」가 두 줄로 갈라짐 (앞뒤: 「${text.slice(Math.max(0, from - 6), to + 6)}」)`);
            }
          }
        }
      }
      return {
        lineCount: lines.filter((idx) => idx.some(visible)).length,
        charCount: chars.filter((c) => !Number.isNaN(c.top)).length,
        keepChecked,
        violations,
        sample: lines.slice(0, 6).map(show),
      };
    },
    [scopeSelector, check] as const,
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// 낱말 중간 끊김 감사 (SPEC-003 QM3-1, QA-003-M3 M3-L02)
// ---------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * 한 낱말의 기록: 낱말·곳(가장 가까운 data-testid 또는 태그.클래스)·자연 폭(글자 상자 폭의 합, px)·한 줄 전체의 폭(px)
 */
export interface WordBreakRecord {
  word: string;
  where: string;
  natural: number;
  line: number;
}

export interface WordBreakReport {
  /** 잰 낱말 수 (같은 낱말도 곳마다 센다, 공허 통과 방지) */
  checked: number;
  /** 잰 낱말 목록 (중복 없음) */
  words: string[];
  /** 그 밖의 끊김 = 결함. 비어야 통과한다 */
  broken: WordBreakRecord[];
  /** 한 줄 전체보다 낱말이 길어(자연 폭 > 한 줄 + 0.5px) 끊을 수밖에 없는 것. 글자 100%에서는 비어야 한다 */
  unavoidable: WordBreakRecord[];
  /** 코드에 명시한 `<wbr>` 지점에서만 끊긴 목록 낱말 */
  intended: WordBreakRecord[];
  /**
   * 등록한 강제 줄바꿈 `<br>`(FORCED_BREAKS)에서만 갈린 목록 낱말 (R-300). 폭과 상관없이 늘 같은 자리에서 갈리는 글쓴이가 정한 줄 구조라 결함은 아니지만 **따로 보고**한다 —
   * 호출하는 e2e가 이 집합이 화면의 기대(첫 화면 수저 띠의 「다이아몬드수저」 하나 …)와 같음을 단언해, 등록 없는 `<br>`가 조용히 면제가 되지 못하게 한다.
   * 등록되지 않은 낱말 한가운데의 `<br>`는 폭과 상관없이 `broken`이다.
   */
  forced: WordBreakRecord[];
  /** `options.categories`의 이름마다, 그 선택자 안에서 잰 낱말 수 (제목·칩·직업 라벨 등이 실제로 잰 대상에 들었는지 확인하는 공허 통과 방지용) */
  categories: Record<string, number>;
}

export interface WordBreakOptions {
  /** 감사 범위 선택자 (기본 `body` = 화면에 보이는 모든 글자) */
  scope?: string;
  /** 의도된 줄바꿈 낱말 목록 (기본 `INTENDED_BREAK_WORDS`) — 변조 대조에서 비워 볼 때 쓴다 */
  intended?: readonly string[];
  /** 강제 줄바꿈 `<br>`로 갈려도 되는 등록 낱말 목록 (기본 `FORCED_BREAK_WORDS`) — 변조 대조에서 비워 볼 때 쓴다 (R-300) */
  forced?: readonly string[];
  /** 이름 → 선택자. 그 안에서 잰 낱말 수를 `categories`로 돌려준다 */
  categories?: Readonly<Record<string, string>>;
}

/** 기록을 한 줄 글로 */
export function describeWordBreak(r: WordBreakRecord): string {
  return `${r.word} @${r.where} (낱말 ${r.natural}px / 한 줄 ${r.line}px)`;
}

/**
 * 한 줄의 폭을 바깥 격자가 아니라 **상자 자신의 안쪽 폭**으로 재는 상자 (M7b; M7c D-80에서 「나의 기록」 줄 — 인생 기록 `.log__row--note`·엔딩 연표 `.timeline li.is-note` — 이 더해졌다: 나이 칸을 뺀 글 칸이 한 줄이다). 인용 박스(`.cite`)는 옅은 쪽빛 면 + 놋쇠 막대 + 안쪽 여백을 가진 상자라 카드 폭에서 그만큼 좁다 —
 * 글자 200% × 폭 320에서 「국민노후보장패널조사」 같은 긴 기관 이름은 카드 폭에는 들어도 박스 안쪽 폭보다 길어 어디서든 끊어야 한다(한 줄보다 긴 낱말 = unavoidable). 글자 100%에서는 여전히 0이어야 한다.
 */
export const FACE_BOXES: readonly string[] = ['.cite', '.log__row--note', '.timeline li.is-note'];

/**
 * 눈에 보이는 모든 글자의 **낱말이 중간에서 끊겼는가**를 잰다 (QM3-1). 판정식:
 *  - 끊긴 낱말 w마다 `intended` = (w 안에서 줄이 바뀐 지점이 모두 `<wbr>` 바로 뒤이고 w가 `intended` 목록에 있음) / `forced` = (줄이 바뀐 지점이 모두 `<br>` 바로 뒤이고 w가 `forced` 목록에 있음)
 *    / `unavoidable` = (자연 폭(w) > 한 줄 전체 + 0.5px) / 그 밖은 `broken`. `<br>`로 갈렸는데 w가 `forced` 목록에 없으면 폭과 상관없이 `broken`.
 *
 * 용어 (SPEC-003 QM3-1)
 *  - **낱말** = 공백으로 갈라낸 글자 덩어리에서 앞뒤 구두점·괄호를 뗀 한글·영숫자 부분. 요소 경계(`<span>`·`<wbr>`)를 넘어 이어 붙은 글자는 한 낱말이다(「다이아몬드<wbr>수저」 = 낱말 하나).
 *    숫자 사이의 `.`·`,`는 낱말 안(3.3, 1,234)이고, 그 밖의 구두점·기호(`·` `/` `—` `(` `)` `%` …)는 낱말 경계다. 낱말 **사이**나 구두점 뒤의 줄바꿈은 끊김이 아니다.
 *    공백 텍스트 노드(`{' '}`)도 낱말을 가르는 공백으로 센다(QA 기록 12의 측정 도구 결함 1). 블록·칸(flex·grid 아이템, inline-block …)이 다른 글자는 이어 붙이지 않는다(칸 사이는 공백이 없어도 다른 낱말).
 *    강제 줄바꿈 `<br>`는 낱말 경계가 **아니다**(R-300): 글자 사이에 바로 붙은 `<br>`(「다이아몬드<br>수저」)는 낱말 한가운데를 가르므로 한 낱말로 이어 붙여 잰다.
 *    그 낱말이 `FORCED_BREAKS`(등록제, 폭과 상관없이 늘 같은 자리에서 갈리는 글쓴이가 정한 줄 구조)에 있고 `<br>`에서만 갈렸으면 `forced`(결함 아님, 따로 보고)이고, 등록 없는 낱말의 `<br>`는 폭과 상관없이 `broken`이다.
 *    `<br>`와 글자 사이에 공백·구두점이 끼면 보통 낱말 경계다(「안녕 <br>하세요」「안녕.<br>하세요」 — 낱말 사이의 줄바꿈).
 *  - **끊김** = 낱말의 글자(글자 하나씩 `Range`로 잰다)가 서로 다른 두 줄 이상에 걸친 것. 줄은 글자 상자의 세로 겹침으로 나눈다.
 *  - **한 줄 전체** = 그 낱말에서 위로 올라가 처음 만나는, 여러 칸이 한 줄을 나눠 쓰는 상자(격자·가로 flex·표)의 내용 폭 — 한 칸의 폭이 아니다. 그런 상자가 없으면(칸 안에서 혼자 줄을 이루는 글)
 *    낱말을 담은 블록(문단 등)의 내용 폭이다. 예: 서류 격자(`dl`)의 칸 → 격자 폭, 또래 항목 → `li` 폭, 표 셀 → 표 폭, 릴 칸 → 두 릴 전체(`.reels`).
 *    칩(`inline-flex`·`inline-block`)과 한 자식만 가진 flex는 칸을 나누지 않으므로 그냥 지나 올라간다(칩이 칸 폭을 못 차지하게 폭을 고치는 것이 해법이라 칩 자신의 폭을 기준으로 삼지 않는다).
 *  - **자연 폭** = 낱말 글자 상자들의 폭의 합(같은 글꼴·크기·굵기·자간으로 한 줄에 놓았을 때 폭).
 * 제외는 눈에 보이지 않는 것뿐이다: `display: none`·`visibility: hidden`·`.sr-only`/`clip: rect(0,0,0,0)`·폭 또는 높이 0·`svg`·`overflow`로 잘려 안 보이는 글자(돌아가는 릴 목록의 화면 밖 칸).
 * `aria-hidden`이라도 눈에 보이면 감사 대상이다(장식 도장 「접수」).
 */
export async function measureWordBreaks(page: Page, options: WordBreakOptions = {}): Promise<WordBreakReport> {
  const scope = options.scope ?? 'body';
  const intended = [...(options.intended ?? INTENDED_BREAK_WORDS)];
  const forcedWords = [...(options.forced ?? FORCED_BREAK_WORDS)];
  const categories = Object.entries(options.categories ?? {});
  return page.evaluate(
    ([scopeSel, intendedWords, forcedList, cats, faceSel]) => {
      const root = document.querySelector(scopeSel);
      if (root === null) throw new Error(`범위를 찾을 수 없다: ${scopeSel}`);
      type Item = { ch: string; sep: boolean; rect: DOMRect | null; ifc: Element | null; parent: Element | null; afterWbr: boolean; afterBr: boolean };

      // ---------- 눈에 보이는가 ----------
      const hiddenCache = new Map<Element, boolean>();
      const isHidden = (el: Element): boolean => {
        const cached = hiddenCache.get(el);
        if (cached !== undefined) return cached;
        let out = false;
        const cs = getComputedStyle(el);
        if (el.classList.contains('sr-only') || el.tagName.toLowerCase() === 'svg') out = true;
        else if (cs.display === 'none' || cs.visibility === 'hidden') out = true;
        else if (cs.position === 'absolute' && /^rect\(0(px)?,? ?0(px)?,? ?0(px)?,? ?0(px)?\)$/.test(cs.clip)) out = true;
        else if (el.parentElement !== null && el !== root) out = isHidden(el.parentElement);
        hiddenCache.set(el, out);
        return out;
      };
      const clipCache = new Map<Element, DOMRect | null>();
      /** 조상의 overflow가 잘라 내는 보이는 영역 (없으면 null = 제한 없음) */
      const clipBoxOf = (el: Element): DOMRect | null => {
        if (clipCache.has(el)) return clipCache.get(el)!;
        let box: { left: number; top: number; right: number; bottom: number } | null = null;
        for (let cur: Element | null = el; cur !== null && cur !== document.documentElement; cur = cur.parentElement) {
          const cs = getComputedStyle(cur);
          if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
          const r = cur.getBoundingClientRect();
          box = box === null ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : { left: Math.max(box.left, r.left), top: Math.max(box.top, r.top), right: Math.min(box.right, r.right), bottom: Math.min(box.bottom, r.bottom) };
        }
        const out = box === null ? null : new DOMRect(box.left, box.top, Math.max(0, box.right - box.left), Math.max(0, box.bottom - box.top));
        clipCache.set(el, out);
        return out;
      };
      const intersects = (a: DOMRect, b: DOMRect): boolean => a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;

      // ---------- 칸·한 줄 전체 ----------
      const isInline = (d: string): boolean => d === 'inline' || d === 'contents' || d === 'ruby' || d === 'ruby-text' || d === 'ruby-base';
      const blockLevel = (d: string): boolean => !d.startsWith('inline') && d !== 'contents' && d !== 'none' && !d.startsWith('ruby');
      const ifcRootOf = (el: Element): Element => {
        let cur: Element = el;
        while (cur.parentElement !== null && isInline(getComputedStyle(cur).display)) cur = cur.parentElement;
        return cur;
      };
      /**
       * 칸 수: 흐름 안에 있는 자식. 아이콘(`svg`·`img`·`[role="img"]`)은 칸을 차지하지 않는다 — 수저 칩(아이콘 + 이름 + 점)은 이름 하나가 칸이고,
       * 칩이 flex 아이템이 되면 `inline-flex`가 `flex`로 바뀌어(blockify) 겉으로는 가로 flex 상자가 되기 때문이다.
       */
      const inFlowCount = (p: Element): number => {
        let n = 0;
        for (const c of Array.from(p.childNodes)) {
          if (c.nodeType === Node.TEXT_NODE) {
            if ((c.textContent ?? '').trim() !== '') n++;
          } else if (c.nodeType === Node.ELEMENT_NODE) {
            const el = c as Element;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.display === 'contents' || cs.position === 'absolute' || cs.position === 'fixed') continue;
            if (['svg', 'img'].includes(el.tagName.toLowerCase()) || el.getAttribute('role') === 'img') continue;
            n++;
          }
        }
        return n;
      };
      /** 칸 둘 이상이 한 줄을 나눠 쓰는 상자인가: 격자·가로 flex(칸 둘 이상). 칩(inline-flex)·inline-block은 칸을 나누지 않는다 */
      const sharesRow = (p: Element): boolean => {
        const cs = getComputedStyle(p);
        if (cs.display === 'grid') return inFlowCount(p) >= 2;
        if (cs.display === 'flex') return (cs.flexDirection === 'row' || cs.flexDirection === 'row-reverse') && inFlowCount(p) >= 2;
        return false;
      };
      const contentWidth = (el: Element): number => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
      };
      const lineCache = new Map<Element, number>();
      /** 한 줄 전체의 폭 (용어 설명은 measureWordBreaks의 주석) */
      const lineWidthOf = (start: Element): number => {
        const cached = lineCache.get(start);
        if (cached !== undefined) return cached;
        let width: number | null = null;
        // 자기 면·여백·막대를 가진 상자(FACE_BOXES — 인용 박스) 안의 글은 그 상자 안쪽의 문단 폭이 한 줄이다(바깥 격자 폭이 아니다)
        if (start.closest(faceSel) !== null) {
          let own: Element = start;
          while (own.parentElement !== null && !blockLevel(getComputedStyle(own).display)) own = own.parentElement;
          width = contentWidth(own);
          lineCache.set(start, width);
          return width;
        }
        for (let el: Element | null = start; el !== null && el !== document.body; el = el.parentElement) {
          const p: Element | null = el.parentElement;
          if (p === null) break;
          if (getComputedStyle(el).display === 'table-cell') {
            const table = el.closest('table');
            width = contentWidth(table ?? p);
            break;
          }
          if (sharesRow(p)) {
            width = contentWidth(p);
            break;
          }
        }
        if (width === null) {
          // 칸을 나눠 쓰는 상자가 없다: 낱말을 담은 블록(문단 등)의 내용 폭
          let block: Element = start;
          while (block.parentElement !== null && !blockLevel(getComputedStyle(block).display)) block = block.parentElement;
          width = contentWidth(block);
        }
        lineCache.set(start, width);
        return width;
      };
      const labelOf = (el: Element): string => {
        for (let cur: Element | null = el, depth = 0; cur !== null && depth < 6; cur = cur.parentElement, depth++) {
          const t = cur.getAttribute('data-testid');
          if (t !== null) return t;
        }
        const cls = (el as HTMLElement).className;
        return `${el.tagName.toLowerCase()}${typeof cls === 'string' && cls.trim() !== '' ? `.${cls.trim().split(/\s+/)[0]}` : ''}`;
      };

      // ---------- 글자 흐름 만들기 (공백 텍스트 노드·`<wbr>` 포함) ----------
      const items: Item[] = [];
      let pendingWbr = false;
      let pendingBr = false;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          if (el.tagName === 'WBR' && !isHidden(el)) pendingWbr = true;
          // `<br>`은 낱말 경계가 아니다(R-300): 글자 사이에 바로 붙은 `<br>`는 낱말 한가운데를 가르는 줄바꿈이라 이어 붙여 재고, 다음 글자에 표시만 남긴다(afterBr).
          // 등록한 낱말(FORCED_BREAKS)이면 `forced`로 따로 보고하고, 등록 없는 낱말이면 폭과 상관없이 결함이다. 앞뒤 공백·구두점이 있으면 보통 낱말 경계다.
          else if (el.tagName === 'BR' && !isHidden(el)) {
            pendingBr = true;
            pendingWbr = false;
          }
          continue;
        }
        const text = node as Text;
        const parent = text.parentElement;
        if (parent === null || isHidden(parent)) continue;
        // 사용자가 쓴 글(`[data-user-text]`)은 우리 문구가 아니라 어디서든 끊길 수 있다(design-system.md 11-8 「사용자 글 영역」, D-80) — 낱말 끊김에서만 뺀다. 넘침·줄바꿈 감사·대비는 이 글도 잰다
        if (parent.closest('[data-user-text]') !== null) continue;
        const ifc = ifcRootOf(parent);
        for (let i = 0; i < text.data.length; i++) {
          const ch = text.data[i];
          if (ch === '\u00AD') {
            pendingWbr = true;
            continue;
          }
          if (/[ \t\n\r\f\u3000]/.test(ch)) {
            items.push({ ch, sep: true, rect: null, ifc, parent, afterWbr: false, afterBr: false });
            pendingWbr = false;
            pendingBr = false;
            continue;
          }
          range.setStart(text, i);
          range.setEnd(text, i + 1);
          const r = range.getClientRects()[0];
          items.push({ ch, sep: false, rect: r === undefined || (r.width === 0 && r.height === 0) ? null : r, ifc, parent, afterWbr: pendingWbr, afterBr: pendingBr });
          pendingWbr = false;
          pendingBr = false;
        }
      }

      // ---------- 낱말로 묶기 ----------
      const isWordChar = (ch: string): boolean => /[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]/.test(ch);
      const isDigit = (ch: string | undefined): boolean => ch !== undefined && /[0-9]/.test(ch);
      const words: Item[][] = [];
      let cur: Item[] = [];
      const flush = () => {
        if (cur.length > 0) words.push(cur);
        cur = [];
      };
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const joinsNumber = (it.ch === '.' || it.ch === ',') && cur.length > 0 && isDigit(cur[cur.length - 1].ch) && isDigit(items[i + 1]?.ch) && items[i + 1]?.ifc === it.ifc;
        if (it.sep || !(isWordChar(it.ch) || joinsNumber)) {
          flush();
          continue;
        }
        if (cur.length > 0 && cur[0].ifc !== it.ifc) flush();
        cur.push(it);
      }
      flush();

      // ---------- 판정 ----------
      const intendedSet = new Set(intendedWords);
      const forcedSet = new Set(forcedList);
      const broken: Array<{ word: string; where: string; natural: number; line: number }> = [];
      const unavoidable: Array<{ word: string; where: string; natural: number; line: number }> = [];
      const intended: Array<{ word: string; where: string; natural: number; line: number }> = [];
      const forced: Array<{ word: string; where: string; natural: number; line: number }> = [];
      const seen = new Set<string>();
      const counts: Record<string, number> = {};
      for (const [name] of cats) counts[name] = 0;
      let checked = 0;
      for (const w of words) {
        const rects = w.filter((it) => it.rect !== null) as Array<Item & { rect: DOMRect }>;
        if (rects.length === 0) continue;
        // 눈에 보이는가: 조상 overflow가 잘라 낸 영역 밖의 글자는 세지 않는다
        const clip = clipBoxOf(rects[0].parent!);
        if (clip !== null && !rects.some((it) => intersects(it.rect, clip))) continue;
        const word = w.map((it) => it.ch).join('');
        const start = rects[0].parent!;
        checked++;
        seen.add(word);
        for (const [name, selector] of cats) if (start.closest(selector) !== null) counts[name]++;
        // 줄 나누기: 이어진 두 글자의 세로 겹침이 작으면 새 줄
        const breakAt: number[] = [];
        for (let k = 1; k < rects.length; k++) {
          const a = rects[k - 1].rect;
          const b = rects[k].rect;
          const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlap < 0.5 * Math.min(a.height, b.height)) breakAt.push(k);
        }
        if (breakAt.length === 0) continue;
        // `<br>` 바로 뒤에서 갈린 지점(강제)과 그 밖의 지점. 자연 폭은 강제 줄바꿈으로 나뉜 조각 중 가장 넓은 것(조각마다 한 줄을 이룬다)
        const brAt = breakAt.filter((k) => rects[k].afterBr);
        const otherAt = breakAt.filter((k) => !rects[k].afterBr);
        let natural = 0;
        let piece = 0;
        rects.forEach((it, k) => {
          if (brAt.includes(k)) piece = 0;
          piece += it.rect.width;
          natural = Math.max(natural, piece);
        });
        const line = lineWidthOf(start);
        const record = { word, where: labelOf(start), natural: Math.round(natural), line: Math.round(line) };
        if (brAt.length > 0) {
          // 등록 없는 낱말 한가운데의 `<br>`는 폭과 상관없이 결함이다(R-300). 등록한 낱말이 `<br>`에서만 갈렸으면 forced
          if (!forcedSet.has(word)) broken.push(record);
          else if (otherAt.length === 0) forced.push(record);
          else if (natural > line + 0.5) unavoidable.push(record);
          else broken.push(record);
        } else if (intendedSet.has(word) && breakAt.every((k) => rects[k].afterWbr)) intended.push(record);
        else if (natural > line + 0.5) unavoidable.push(record);
        else broken.push(record);
      }
      return { checked, words: [...seen], broken, unavoidable, intended, forced, categories: counts };
    },
    [scope, intended, forcedWords, categories, FACE_BOXES.join(', ')] as const,
  );
}
