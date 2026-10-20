/**
 * 서버 렌더 마크업에서 **화면·접근성 트리에 보이는 글자**만 남기는 도우미 (SPEC-005 QI6 시험용).
 *
 * 무거운 장면 가리기는 원문을 `hidden` 요소로 DOM에 두므로(화면·접근성 트리·찾기에서 빠진다) 마크업 문자열에는 원문이 그대로 들어 있다 — 「원문이 새지 않는다」는 `hidden` 부분을 뺀 글자로 단언해야 한다.
 * `hidden` 속성이 달린 요소와 그 안쪽 전부를 걷어 낸다. `ariaHidden`을 켜면 `aria-hidden="true"` 요소도 걷어 내 **스크린리더가 읽는 글자**를 만든다(기본은 화면에 보이는 글자).
 */

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s[^<>]*?)?)(\/?)>/g;

function isHidden(attrs: string, ariaHidden: boolean): boolean {
  if (/(?:^|\s)hidden(?:=""|=\\?"[^"]*"|\s|$)/.test(attrs)) return true;
  return ariaHidden && /(?:^|\s)aria-hidden="true"/.test(attrs);
}

/** `hidden`(옵션이면 `aria-hidden`) 요소와 그 안쪽을 걷어 낸 마크업 */
export function dropHidden(html: string, opts: { ariaHidden?: boolean } = {}): string {
  const ariaHidden = opts.ariaHidden === true;
  let out = '';
  let last = 0;
  let skipDepth = 0;
  TAG.lastIndex = 0;
  for (let m = TAG.exec(html); m !== null; m = TAG.exec(html)) {
    const [whole, close, name, attrs, selfClose] = m;
    const lower = name.toLowerCase();
    const isVoid = VOID_TAGS.has(lower) || selfClose === '/';
    if (skipDepth === 0) {
      out += html.slice(last, m.index);
      if (close === '' && isHidden(attrs, ariaHidden)) {
        if (!isVoid) skipDepth = 1;
      } else {
        out += whole;
      }
    } else if (close === '') {
      if (!isVoid) skipDepth++;
    } else {
      skipDepth--;
    }
    last = m.index + whole.length;
  }
  if (skipDepth === 0) out += html.slice(last);
  return out;
}

const ENTITIES: Array<[RegExp, string]> = [
  [/&#x27;/g, "'"],
  [/&quot;/g, '"'],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&amp;/g, '&'],
];

/** 보이는 글자(공백 하나로 접음) */
export function visibleText(html: string, opts: { ariaHidden?: boolean } = {}): string {
  let t = dropHidden(html, opts).replace(/<[^>]+>/g, ' ');
  for (const [re, to] of ENTITIES) t = t.replace(re, to);
  return t.replace(/\s+/g, ' ').trim();
}
