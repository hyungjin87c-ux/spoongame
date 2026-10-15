/**
 * 줄바꿈 묶음 (SPEC-003 QM2-5, SC2·FS7, QA-003-M2 인상): 화면 글자가 줄 끝·첫머리에서 읽기 불편하게 끊기지 않게 어디를 한 묶음으로 둘지 정한다. 순수 함수라 React 없이 단위 테스트한다.
 *
 * 규칙
 *  1. 구분 기호(「·」「/」「—」)가 줄 끝이나 줄 첫머리에 혼자 남지 않는다. 기호는 어느 쪽에 붙이든 줄 가장자리에 놓일 수 있으므로 **양쪽 낱말과 함께 묶어** 그 자리에서 줄이 바뀌지 않게 한다.
 *     - 띄어 쓴 기호: 「앞말 · 뒷말」 「A / B / C」 → 사슬 통째로 한 묶음(chain).
 *     - 붙여 쓴 기호: 「인구동향조사·생명표)」 「6)·본문」 「시·도)」 → 공백으로 나뉜 낱말 하나(기호가 든 낱말)를 한 묶음(token)으로.
 *     묶음은 `display: inline-block; max-width: 100%`(.keep-phrase)라 줄에 안 들어가면 통째로 다음 줄로 내려가고, 그 자체가 한 줄보다 길 때(아주 좁은 폭·큰 글자)만 안에서 줄이 바뀐다.
 *     **묶음으로 지켜 주는 것은 사슬이 한 줄에 들어갈 때까지다**(QM2-10). 한 줄보다 길면 어디서 끊어도 기호가 줄 가장자리에 놓이므로 줄바꿈 CSS로 풀지 않고 글을 바꾼다:
 *       · 한 줄을 넘을 수 있는 나열(항목 수가 데이터·설정에 따라 바뀌는 것 — 푸터 통계 출처 기관 목록, 정의 문구의 「학원, 개인과외, …」)은 **쉼표 나열**로 쓴다(`commaList`).
 *         쉼표는 앞 낱말에 붙어 줄 끝에 오는 것이 정상 조판이고 줄 첫머리에는 오지 않는다. 데이터로 채우는 나열에 가운뎃점을 쓰지 않는다.
 *       · 「·」 사슬은 한 줄에 확실히 들어가는 **짧은 쌍**(항목 수 고정)에만 남기고, 그 쌍이 좁은 폭·큰 글자에서 한 줄을 넘으면 두 항목을 따로 줄로 나눠 쓴다(`splitPair` + ui/Pair.tsx).
 *     - 글자에 붙은 괄호: 「기간(15~49세)」 → 공백 없이 붙은 낱말인데 브라우저가 여는 괄호 앞에서 줄을 바꿔 낱말을 쪼개므로("기간 / (15~49세)") 그 낱말을 한 묶음으로(여는 괄호가 줄 끝에, 닫는 괄호가 줄 첫머리에 남는 것도 같은 뜻으로 막힌다).
 *     - 닫는 괄호 + 붙은 글자: 「기준)으로」 → 한국어 조사가 닫는 괄호에 붙어 있으면 keep-all도 「)」와 한글 사이에서는 줄을 바꿔 조사만 다음 줄로 보낸다("…(신고월 기준) / 으로 집계한", REV-003-M2-4 R-244). 그 낱말을 한 묶음으로.
 *  2. 숫자와 바로 뒤 단위(「240,326 건」「27.8 명」), 날짜·시각(「11월 1일 0시」「2026-10-15」)은 중간에서 줄이 바뀌지 않는다(`white-space: nowrap`).
 *
 * 문구 자체는 바꾸지 않는다 — 묶음은 같은 글자를 감싸는 표시일 뿐이라 접근 가능한 이름·글자 내용은 그대로다.
 */

export type GlueSegment =
  | { kind: 'plain'; text: string }
  /** 줄이 바뀌면 안 되는 짧은 묶음(숫자+단위·날짜) */
  | { kind: 'nowrap'; text: string }
  /** 구분 기호가 든 묶음(띄어 쓴 사슬 「A · B」 또는 붙여 쓴 낱말 「A·B」). 안에서도 숫자+단위·날짜는 그대로 묶는다 */
  | { kind: 'chain'; parts: GlueSegment[] };

/**
 * 분모 문구(「인구 1천 명당」「인구 10만 명당」) → 날짜·시각 → 숫자+단위. 앞쪽 대안이 먼저 맞는다(긴 날짜가 숫자+단위에 쪼개지지 않게).
 * 분모 문구는 「인구 1천 / 명당 4.7건」처럼 갈라지면 무엇의 몇 명당인지 읽기 어려워 한 묶음으로 둔다(글자 200%의 「조혼인율 인구 1천 명당 4.7건」).
 */
const KEEP = /인구 \d[\d,.]*[천만]? 명당|\d{4}년 \d{1,2}월(?: \d{1,2}일(?: \d{1,2}시)?)?|\d{1,2}월 \d{1,2}일(?: \d{1,2}시)?|\d{4}-\d{2}-\d{2}|\d[\d,.]*\s?(?:%|명|건|세|년|월|일|시|개|원)/g;

/**
 * 한 묶음으로 둘 것: ① 띄어 쓴 구분 기호 사슬(「A · B」 「A / B / C」) ② 기호가 붙어 있는 낱말 하나(「A·B」) ③ 괄호가 글자에 붙은 낱말(「기간(15~49세)」) ④ 닫는 괄호 뒤에 글자가 붙은 낱말(「기준)으로」).
 * ③은 공백 없이 붙은 한 낱말인데 브라우저가 여는 괄호 앞에서 줄을 바꿔 「기간 / (15~49세)」처럼 낱말을 쪼갠다(한국어는 띄어쓰기에서만 줄을 바꾼다 — e2e/polish.spec.ts 「단어 중간에서 끊기지 않는다」).
 * 괄호로 시작하는 낱말(「(통계표」)은 앞이 공백이라 쪼개질 낱말이 아니므로 묶지 않는다. 닫는 괄호로 끝나거나 구두점(「)」 뒤의 「.」「,」)만 붙은 낱말(「…합니다).」)은 뒤에 갈라질 글자가 없고
 * 브라우저도 구두점 앞에서는 줄을 바꾸지 않으므로 묶지 않는다.
 * ④는 브라우저가 닫는 괄호와 뒤 한글(·영문·숫자) 사이에서 줄을 바꿔 조사만 떼어 놓는 것을 막는다(keep-all은 이 자리를 막지 않는다 — REV-003-M2-4 R-244 `\S*\)\S+`를 글자·숫자가 붙은 경우로 좁혔다, e2e/polish.spec.ts).
 */
const CHAIN = /\S+(?: [·/—] \S+)+|\S*[·/—]\S*|[^\s(]+\((?:\d{4}년 \d{1,2}월(?: \d{1,2}일(?: \d{1,2}시)?)?|\d{1,2}월 \d{1,2}일(?: \d{1,2}시)?|\d[\d,.]*\s?(?:%|명|건|세|년|월|일|시|개|원))?\S*|\S*\)[가-힣A-Za-z0-9]\S*/g;
// ↑ ③의 괄호 안은 날짜·숫자+단위가 먼저 이어 붙는다(「비율입니다(11월 1일 0시」를 괄호 낱말과 날짜로 둘로 쪼개지 않는다)

function keepSegments(text: string): GlueSegment[] {
  const out: GlueSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(KEEP)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: 'plain', text: text.slice(last, at) });
    out.push({ kind: 'nowrap', text: m[0] });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'plain', text: text.slice(last) });
  return out;
}

/** 글자를 묶음 조각으로 나눈다. 조각을 이어 붙이면 원래 글자와 같다. */
export function glueSegments(text: string): GlueSegment[] {
  const out: GlueSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(CHAIN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(...keepSegments(text.slice(last, at)));
    out.push({ kind: 'chain', parts: keepSegments(m[0]) });
    last = at + m[0].length;
  }
  if (last < text.length) out.push(...keepSegments(text.slice(last)));
  return out;
}

/** 조각을 이어 붙인 글자 (원래 글자와 같아야 한다 — 묶음은 글자를 바꾸지 않는다) */
export function segmentsText(segments: readonly GlueSegment[]): string {
  return segments.map((s) => (s.kind === 'chain' ? segmentsText(s.parts) : s.text)).join('');
}

/**
 * 쉼표 나열 (QM2-10 규칙 2): 「국가데이터처, 행정안전부, 교육부」. 한 줄을 넘을 수 있는 나열(항목 수가 데이터에 따라 바뀌는 것)은 가운뎃점이 아니라 이것으로 쓴다 —
 * 쉼표는 줄 끝에 와도 되고(앞 낱말에 붙어 있다) 줄 첫머리에는 오지 않는다. 항목 안의 공백에서 줄이 바뀌는 것은 괜찮다.
 */
export function commaList(items: readonly string[]): string {
  return items.join(', ');
}

/**
 * 「A · B」처럼 구분 기호가 **정확히 하나**인 짧은 쌍이면 [A, B], 아니면 null (QM2-10 규칙 3). 쌍은 한 줄에 들어갈 때만 한 줄로 보이고
 * 좁은 폭·큰 글자에서 넘치면 두 줄로 나뉜다(ui/Pair.tsx, 컨테이너 쿼리) — 기호가 줄 끝·첫머리에 혼자 남지 않는다.
 */
export function splitPair(text: string): [string, string] | null {
  const parts = text.split(' · ');
  return parts.length === 2 && parts[0].trim() !== '' && parts[1].trim() !== '' ? [parts[0], parts[1]] : null;
}
