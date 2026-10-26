/**
 * 「이 브라우저는 이 CSS를 어떻게 읽는가」를 흉내 낸다 (SPEC-003 M3 r5, REV-003-M3-4 R-302).
 * 컨테이너 질의(`container-type`·`@container`·`cqi` 같은 단위)를 모르는 브라우저(Safari 16 미만)는 ① `@container` 블록을 통째로 건너뛰고 ② `container-type`·`container-name` 선언을 무시하며
 * ③ `@supports`의 조건을 거짓으로 읽는다. 이 모듈은 CSS 글자를 그 규칙대로 걸러 「그 브라우저가 실제로 적용할 CSS」를 돌려준다.
 *
 * 순수 함수(DOM·파일 없음)라 vitest(tests/docCssFallback.test.ts)와 e2e(e2e/m3-css-fallback.spec.ts, e2e-prod)가 함께 쓴다. 이 저장소의 CSS가 쓰는 꼴만 푼다:
 * 주석 제거, `@container …{}` 제거, `@supports [not] (속성: 값) {}` 평가(다른 꼴은 던진다), `@media`·`@layer` 안쪽 재귀, 스타일 규칙 안의 `container-type`·`container-name` 선언 제거.
 * 실제 브라우저의 파서를 대신하지는 않는다 — 어느 규칙이 살고 죽는지를 가르는 용도다.
 */

export interface BrowserFeatures {
  /** 컨테이너 질의(`container-type`·`@container`)와 컨테이너 단위(`cqi` 등)를 아는가 */
  containerQueries: boolean;
}

/** 모르는 브라우저(Safari 16 미만 등) */
export const NO_CONTAINER_QUERIES: BrowserFeatures = { containerQueries: false };
/** 아는 브라우저(현재의 기준) */
export const WITH_CONTAINER_QUERIES: BrowserFeatures = { containerQueries: true };

/** 컨테이너 단위: 숫자 바로 뒤에 붙는 cqw·cqh·cqi·cqb·cqmin·cqmax */
const CQ_UNIT = /\d(?:cqw|cqh|cqi|cqb|cqmin|cqmax)\b/i;

export function stripCssComments(css: string): string {
  return css.replace(/\/\*[^]*?\*\//g, '');
}

/** `open` 위치의 `{`와 짝이 맞는 `}`의 위치 */
function matchBrace(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error(`짝이 맞는 }를 찾지 못했다: …${text.slice(open, open + 60)}`);
}

/** `(속성: 값)` 하나를 이 브라우저가 지원하는가 */
function supportsDeclaration(property: string, value: string, features: BrowserFeatures): boolean {
  if (features.containerQueries) return true;
  const p = property.trim().toLowerCase();
  if (p === 'container-type' || p === 'container-name' || p === 'container') return false;
  return !CQ_UNIT.test(value);
}

/**
 * `@supports` 조건 평가. 이 저장소가 쓰는 꼴 `[not] (속성: 값)` 하나만 푼다 — 다른 꼴(and/or/중첩 조건)은 조용히 틀리지 않도록 던진다.
 * 값 안의 함수 호출 한 겹은 값의 일부다(R-489: `(height: clamp(1px, 2px, 3px))` — title.css의 낮은 창 그림 높이 규칙). 컨테이너 질의를 모르는 브라우저(Safari 16 미만)도 `clamp()`는 지원하므로(Safari 13.1+) 참이다.
 */
export function evaluateSupports(condition: string, features: BrowserFeatures): boolean {
  const m = /^\s*(not\s+)?\(\s*([a-z-]+)\s*:\s*((?:[^()]|\([^()]*\))+?)\s*\)\s*$/i.exec(condition);
  if (m === null) throw new Error(`browserCss: 지원하지 않는 @supports 조건: ${condition.trim()}`);
  const supported = supportsDeclaration(m[2], m[3], features);
  return m[1] === undefined ? supported : !supported;
}

/** 스타일 규칙 본문에서 이 브라우저가 모르는 선언을 뺀다 */
function stripUnknownDeclarations(body: string, features: BrowserFeatures): string {
  if (features.containerQueries) return body;
  // 선언 앞 구분 기호는 먼저 읽지 않고(lookbehind) 선언과 뒤의 `;`만 지운다 — 이어진 선언(`container-type:x;container-name:y`)이 모두 지워진다
  return body.replace(/(?<=^|[;{\s])container(?:-type|-name)?\s*:[^;}]*;?/gi, '');
}

function processRules(text: string, features: BrowserFeatures): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open === -1) {
      out += text.slice(i);
      break;
    }
    const prelude = text.slice(i, open);
    const close = matchBrace(text, open);
    const body = text.slice(open + 1, close);
    const head = prelude.trim();
    if (/^@container\b/i.test(head)) {
      if (features.containerQueries) out += `${prelude}{${body}}`;
      // 모르는 브라우저: 규칙 블록을 통째로 건너뛴다
    } else if (/^@supports\b/i.test(head)) {
      if (evaluateSupports(head.replace(/^@supports\b/i, ''), features)) out += processRules(body, features);
    } else if (/^@(?:media|layer)\b/i.test(head)) {
      out += `${prelude}{${processRules(body, features)}}`;
    } else if (head.startsWith('@')) {
      out += `${prelude}{${body}}`;
    } else {
      out += `${prelude}{${stripUnknownDeclarations(body, features)}}`;
    }
    i = close + 1;
  }
  return out;
}

/** 이 브라우저가 실제로 적용할 CSS (주석 없음, `@supports`는 평가되어 안쪽 규칙이 올라오거나 사라진다) */
export function cssAppliedBy(css: string, features: BrowserFeatures): string {
  return processRules(stripCssComments(css), features);
}

/** 줄·들여쓰기 차이를 없앤 비교용 글자 */
export function normalizeCss(css: string): string {
  return css.replace(/\s+/g, ' ').replace(/\s*([{};:,])\s*/g, '$1').trim();
}

/**
 * 시작 부분이 `head`(공백 정규화)와 같은 블록의 안쪽을 모두 돌려준다 (최상위·`@media`·`@supports` 안쪽까지 훑는다).
 * 예: `blocksStartingWith(css, '@container cmp (max-width: 35rem)')` → 그 `@container` 블록의 본문 글자들.
 */
export function blocksStartingWith(css: string, head: string): string[] {
  const wanted = normalizeCss(head);
  const found: string[] = [];
  const walk = (text: string): void => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open === -1) return;
      const close = matchBrace(text, open);
      const prelude = normalizeCss(text.slice(i, open));
      const body = text.slice(open + 1, close);
      if (prelude === wanted) found.push(body);
      if (prelude.startsWith('@')) walk(body);
      i = close + 1;
    }
  };
  walk(stripCssComments(css));
  return found;
}

/**
 * 머리가 `head`인 블록(최상위·@media·@supports 안쪽까지)을 통째로 뺀 CSS. 「고치기 전 상태」를 흉내 내는 대조용이다
 * (예: 폴백 블록을 뺀 CSS를 모르는 브라우저로 걸러 보면 r4 상태가 된다 — e2e/m3-css-fallback.spec.ts).
 */
export function withoutBlocks(css: string, head: string): string {
  const wanted = normalizeCss(head);
  const walk = (text: string): string => {
    let out = '';
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open === -1) {
        out += text.slice(i);
        break;
      }
      const close = matchBrace(text, open);
      const prelude = text.slice(i, open);
      const body = text.slice(open + 1, close);
      if (normalizeCss(prelude) === wanted) {
        // 이 블록은 뺀다
      } else if (normalizeCss(prelude).startsWith('@')) out += `${prelude}{${walk(body)}}`;
      else out += `${prelude}{${body}}`;
      i = close + 1;
    }
    return out;
  };
  return walk(stripCssComments(css));
}
