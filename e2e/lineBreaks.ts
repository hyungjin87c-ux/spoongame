import { type Page } from '@playwright/test';

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
