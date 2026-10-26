import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import copyMd from '../docs/design/copy.md?raw';
import { ERAS, citationFor, citationIdFor, decisionFor, isChoiceEvent, possibleAgesOf, type Era, type EventDef } from '../src/core';
import { INSIGHT_BY_ID, INSIGHT_OMITTED, insightFor } from '../src/data/citationInsights';
import { CITATION_TABLE, getCitation } from '../src/data/citationsAccess';
import { DASH_TEXT } from '../src/data/dashText';
import { EVENT_POOL } from '../src/data/events';
import citationInsightsSrc from '../src/data/citationInsights.ts?raw';
import decisionCardSrc from '../src/ui/dash/DecisionCard.tsx?raw';
import parentCardSrc from '../src/ui/dash/ParentCard.tsx?raw';
import noteSheetSrc from '../src/ui/dash/NoteSheet.tsx?raw';
import { CitationBox } from '../src/ui/dash/CitationBox';
import type { CitationView } from '../src/core';
import { PAIRS } from '../scripts/checkContrastLib';

/** CSS는 ?raw가 빈 문자열이라 파일 시스템으로 읽는다 (tests/designAssets.test.ts와 같은 방법) */
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}
const dashCss = await readText('../src/styles/dash.css');

/**
 * 인용 박스 풀이 한 줄 (SPEC-005 r4 UX14·QI14, 마스터 결정 M23·M24 · 문구 확정 docs/design/copy.md 15-5, 초안과 마스터 결정 docs/data/citation-insights-draft.md 6절).
 *
 * 이 시험이 지키는 것(SPEC UX14-4 ①·완료 기준 6): ① 풀이 데이터가 copy.md 15-5의 확정 32문장과 **글자까지** 같고, 생략 3건(빈 줄 0)도 문서와 1:1이다 ② 대상(본인이 고르는 카드에 연결된 인용 35개)과 데이터의 키 + 생략이 1:1이다
 * ③ 한 문장 · 60자 이하 · 합쇼체 · 금지 낱말 0(합집합 8항의 낱말 목록 + 시제어) · 숫자는 요약의 값만(새 수치 0) · 수 lint 허용 목록 밖의 단위어 앞 수사 0 · 같은 문형 3개 초과 0 ④ 인용별 `usageCaution`을 지킨다
 * ⑤ 풀이는 본인이 고르는 카드(`DecisionCard`)의 인용 박스에만 그려지고 부모·흘러감·기록 카드·가린 카드에는 없으며 풀이 없는 인용 박스는 지금과 같다(빈 줄 0).
 * 이 시험은 기계로 잡을 수 있는 규칙만 본다 — 조언·정답·원인 단정·결정론·낙인의 판독은 reviewer 전수 판독(UX14-4 ②)이 한다.
 */

/** 인용 박스를 서버 렌더한다 (이 파일은 .ts라 JSX 대신 createElement) */
const box = (view: CitationView, insight?: string | null): string => renderToStaticMarkup(createElement(CitationBox, insight === undefined ? { view } : { view, insight }));

// ---------- copy.md 15-5 표 읽기 ----------

interface CopyRow {
  id: string;
  card: string;
  text: string;
}
interface CopyOmit {
  id: string;
}

/** copy.md 15-5 표의 확정 문장 행과 「생략」 행 */
function readCopyTable(): { rows: CopyRow[]; omitted: CopyOmit[] } {
  const start = copyMd.indexOf('### 15-5.');
  const end = copyMd.indexOf('### 15-6.');
  expect(start, 'copy.md에 15-5절이 있다').toBeGreaterThan(-1);
  expect(end, 'copy.md에 15-6절이 있다').toBeGreaterThan(start);
  const rows: CopyRow[] = [];
  const omitted: CopyOmit[] = [];
  for (const line of copyMd.slice(start, end).split('\n')) {
    const m = /^\| (\d+) \| (c-\d+) \| ([^|]*) \| ([^|]*) \| (\d+) \|/.exec(line);
    if (m !== null) rows.push({ id: m[2], card: m[3].trim(), text: m[4].trim() });
    const o = /^\| — \| (c-\d+) \| [^|]* \| \*\*생략\*\*/.exec(line);
    if (o !== null) omitted.push({ id: o[1] });
  }
  return { rows, omitted };
}

const COPY = readCopyTable();

// ---------- 대상: 본인이 고르는 카드에 연결된 인용 ----------

/** 본인이 고르는 결정 카드가 될 수 있는가 — 어떤 나이에든 `decisionFor`가 'self'인 선택지 이벤트(19세 이상은 모두 본인, 어린 시절은 PD2 분류표) */
const hasSelfAge = (ev: EventDef): boolean => isChoiceEvent(ev) && possibleAgesOf(ev).some((age) => decisionFor(ev.id, age) === 'self');
/** 이벤트가 어느 세상에서든 가리키는 인용 id들 (세상별 연결 포함, 그 세상에 뜨지 않는 이벤트는 제외) */
const citationIdsOf = (ev: EventDef): string[] => {
  const out = new Set<string>();
  for (const era of ERAS) {
    const id = citationIdFor(ev, era);
    if (id !== null) out.add(id);
  }
  return [...out];
};

/** 인용 id → 그 인용을 단 선택지 이벤트 (본인이 고르는 구간이 있는 것 / 부모·흘러감 전용인 것) */
function citationUsers(): { self: Map<string, string[]>; parentOnly: Map<string, string[]> } {
  const self = new Map<string, string[]>();
  const parentOnly = new Map<string, string[]>();
  for (const ev of EVENT_POOL.events) {
    if (!isChoiceEvent(ev)) continue;
    for (const id of citationIdsOf(ev)) {
      const bag = hasSelfAge(ev) ? self : parentOnly;
      bag.set(id, [...(bag.get(id) ?? []), ev.id]);
    }
  }
  return { self, parentOnly };
}
const USERS = citationUsers();

// ---------- 규칙 (UX14-3 + 마스터 결정 ④⑤⑥ — 기계로 잡는 부분) ----------

/**
 * 금지 낱말: 초안 6절의 정규식(조언·권유 / 정답 / 원인 단정 / 과장 / 평가어 / 낙인 낱말)에 시제어(`지금|요즘|올해` — 풀이는 시대 무관 서술이라 쓰지 않는다)를 더했다.
 * 금지 낱말은 **부정문 속에서도** 쓰지 않는다(낱말 lint가 부정 여부를 가르지 않는다).
 */
const INSIGHT_BANNED_WORDS = /하세요|해야|편이|권합|권유|권하|바람직|때문|탓|로 이어|반드시|항상|모두|모든|누구나|가장|최선|정답|좋|나쁜|낫|유리|불리|훌륭|심각|안타|다행|놀랍|힘든|어려운|많|적|지금|요즘|올해/;
/** 한 문장: 마침표 뒤에 글이 더 이어지지 않고, 문장 끝 「다.」 하나뿐이다 */
const sentenceCount = (s: string): number => (s.match(/다\./g) ?? []).length;

/** 수 lint (마스터 결정 ⑥): 아라비아 숫자와 **단위어 앞 수사**만 본다. 「하루」 같은 낱말은 검사 대상이 아니다. 허용 목록은 마스터 승인(copy.md 15-6) */
const UNIT_NUMERAL_ALLOWED = ['한 해', '한 시간', '한 달', '두 사람'] as const;
const UNIT_NUMERAL = /(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|스무|스물)\s?(해|시간|달|사람|명|건|가구|살|분|번|배|곳|집|주|날|년|원|개|채|줄)/g;
/** 한글 수사 낱말(「서른 줄」 류)은 요약의 값이 그 범위 안에 있을 때만 쓴다 — 풀이가 요약에 없는 수를 만들어 내지 않는다(새 수치 0) */
const HANGUL_RANGE_WORDS: ReadonlyArray<{ word: string; min: number; max: number }> = [
  { word: '서른 줄', min: 30, max: 39 },
  { word: '서른 중반', min: 34, max: 37 },
  { word: '여든', min: 80, max: 89 },
  { word: '일흔', min: 70, max: 79 },
  { word: '예순다섯', min: 65, max: 65 },
];
/** 보이지 않는 글자(너비 0 공백·방향 표시·줄 구분자·소프트 하이픈·BOM) — 소스에 글자 그대로 쓰지 않으려고 코드 포인트로 만든다(tests/invisibleLiterals.test.ts) */
const INVISIBLE = new RegExp(`[${[0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2028, 0x2029, 0x00ad, 0xfeff].map((c) => String.fromCharCode(c)).join('')}]`);
const NUMBER_TOKEN = /\d[\d,]*(?:\.\d+)?/g;
const numbersIn = (s: string): string[] => s.match(NUMBER_TOKEN) ?? [];
const valueOf = (token: string): number => Number(token.replace(/,/g, ''));

/** 문형의 기계적 대리: ① 첫 절 끝 두 글자 + 문장 끝 네 글자 ② 끝 두 어절. 같은 것이 3개를 넘으면 되풀이 틀이다(마스터 결정 ⑤ — 진짜 판독은 reviewer) */
function patternKeys(text: string): { frame: string; tail: string } {
  const body = text.replace(/\.$/, '');
  const comma = body.indexOf(', ');
  const connective = comma > 0 ? [...body.slice(0, comma)].slice(-2).join('') : '(단문)';
  return { frame: `${connective}|${[...body].slice(-4).join('')}`, tail: body.split(' ').slice(-2).join(' ') };
}
/** 초안이 되풀이하던 한계 진술 틀 — 비춤형으로 다시 쓰며 0이 됐다(copy.md 15-6) */
const OLD_FRAMES = [/일 뿐/, /에 없습니다/, /다를 수 있습니다/, /알 수 없습니다/, /단정할 수 없/, /아닙니다\.$/];

describe('copy.md 15-5와 풀이 데이터 (글자까지 같다)', () => {
  it('copy.md 15-5의 확정 문장 표를 읽었다: 32문장 + 생략 3건(c-095·c-030·c-096)', () => {
    expect(COPY.rows).toHaveLength(32);
    expect(COPY.omitted.map((o) => o.id)).toEqual(['c-095', 'c-030', 'c-096']);
    expect(new Set(COPY.rows.map((r) => r.id)).size, '인용 id마다 한 문장').toBe(32);
  });

  it('데이터의 32문장은 copy.md 15-5와 글자까지 같다 (인용 id → 한 문장)', () => {
    for (const row of COPY.rows) expect(INSIGHT_BY_ID[row.id], row.id).toBe(row.text);
    expect(Object.keys(INSIGHT_BY_ID).sort()).toEqual(COPY.rows.map((r) => r.id).sort());
  });

  it('생략 목록은 copy.md의 「생략」 행과 1:1이고, 데이터에 키가 없다 (빈 줄 0)', () => {
    expect([...INSIGHT_OMITTED].sort()).toEqual(COPY.omitted.map((o) => o.id).sort());
    for (const id of INSIGHT_OMITTED) {
      expect(INSIGHT_BY_ID[id], id).toBeUndefined();
      expect(insightFor(id), id).toBeNull();
    }
  });

  it('insightFor: 있는 인용은 문장을, 없는 id·인용 밖 id·객체 상속 이름은 null이다', () => {
    expect(insightFor('c-015')).toBe('29세 이하 가구의 절반은 그보다 덜 가진 채 같은 거리 앞에 서 있습니다.');
    for (const id of ['c-095', 'c-999', '', 'constructor', 'toString', '__proto__']) expect(insightFor(id), id).toBeNull();
  });

  it('copy.md 15-6의 요약 수치와 맞는다: 32문장 · 합 1,635자 · 평균 51.1자 · 최장 60자 (시간 모델 입력)', () => {
    const lens = Object.values(INSIGHT_BY_ID).map((s) => [...s].length);
    expect(lens).toHaveLength(32);
    expect(lens.reduce((a, b) => a + b, 0)).toBe(1635);
    expect(Math.max(...lens)).toBe(60);
    expect(Math.min(...lens)).toBe(31);
    expect(lens.reduce((a, b) => a + b, 0) / lens.length).toBeCloseTo(51.1, 1);
  });
});

describe('대상 ↔ 데이터: 본인이 고르는 카드에 연결된 인용 35개 = 풀이 32 + 생략 3', () => {
  it('본인이 고르는 구간이 있는 선택지 이벤트에 연결된 서로 다른 인용은 35개이고, 데이터의 키 + 생략과 같은 집합이다', () => {
    const targets = [...USERS.self.keys()].sort();
    expect(targets).toHaveLength(35);
    expect(targets).toEqual([...Object.keys(INSIGHT_BY_ID), ...INSIGHT_OMITTED].sort());
  });

  it('부모·흘러감 전용 카드에만 연결된 인용(13개)에는 풀이가 없다 — 풀이를 달 일이 없다 (M23)', () => {
    const parentOnly = [...USERS.parentOnly.keys()].filter((id) => !USERS.self.has(id));
    expect(parentOnly).toHaveLength(13);
    for (const id of parentOnly) expect(insightFor(id), id).toBeNull();
  });

  it('공유 인용 c-011은 두 장면(youth-first-job · middle-child-school)에 같은 한 문장이다 (마스터 결정 ① — 인용 하나에 한 문장)', () => {
    expect([...(USERS.self.get('c-011') ?? [])].sort()).toEqual(['middle-child-school', 'youth-first-job']);
    expect(Object.keys(INSIGHT_BY_ID).filter((id) => id === 'c-011')).toHaveLength(1);
  });

  it('풀이의 인용은 모두 실제로 쓸 수 있는(verified·usable) 통계다 — 연구 인용이면 `usageCaution.framing` 낱말이 풀이에 있어야 한다 (지금 대상은 통계 35개뿐)', () => {
    for (const id of Object.keys(INSIGHT_BY_ID)) {
      const c = getCitation(id);
      expect(c, `${id}는 쓸 수 있는 인용`).toBeDefined();
      expect(c!.kind, id).toBe('stat');
      if (c!.kind === 'research' && c!.usageCaution?.framing !== undefined) expect(c!.usageCaution.framing.some((w) => INSIGHT_BY_ID[id].includes(w)), id).toBe(true);
    }
  });

  it('5세 기록 카드의 인용(기록 카드)은 대상이 아니다 — 기록 카드에는 풀이를 달지 않는다 (UX14-2)', () => {
    const noteCitation = [...CITATION_TABLE].filter((c) => (c.usedBy ?? []).includes('note-infant-memory')).map((c) => c.id);
    expect(noteCitation, '5세 기록 카드의 인용은 심리·아동학 논문 c-102 하나 (r4 QI13)').toEqual(['c-102']);
    for (const id of noteCitation) expect(insightFor(id), id).toBeNull();
    expect(USERS.self.has('c-102'), '기록 카드의 인용은 선택지 이벤트에 연결되지 않는다').toBe(false);
  });
});

describe('풀이 규칙 (UX14-3 + 마스터 결정 ④⑤⑥): 한 문장 · ≤ 60자 · 합쇼체 · 금지 낱말 0 · 새 수치 0', () => {
  const entries = Object.entries(INSIGHT_BY_ID);

  it('모두 한 문장이다: 「다.」가 문장 끝에 하나뿐이고 줄바꿈·여러 마침표가 없다', () => {
    for (const [id, s] of entries) {
      expect(sentenceCount(s), `${id}: ${s}`).toBe(1);
      expect(s.endsWith('다.'), id).toBe(true);
      expect(s.includes('\n'), id).toBe(false);
      expect(s.trim(), id).toBe(s);
      expect((s.match(/[.!?]/g) ?? []).length, `${id}: 문장 부호는 끝 마침표 하나뿐 (73.6% 같은 소수점은 숫자 사이)`).toBe(1 + (s.match(/\d\.\d/g) ?? []).length);
    }
  });

  it('60자 이하(공백 포함, 코드 포인트)', () => {
    for (const [id, s] of entries) expect([...s].length, `${id}: ${s}`).toBeLessThanOrEqual(60);
  });

  it('합쇼체 평서문이다: 「-습니다.」로 끝나고 해요체·반말 어미가 없다 (카드 서술 C1)', () => {
    for (const [id, s] of entries) {
      expect(s, id).toMatch(/습니다\.$/);
      expect(s, id).not.toMatch(/(해요|에요|예요|네요|죠|거든요|세요)[.?]?$/);
      expect(s, id).not.toMatch(/[?!]/);
    }
  });

  it('금지 낱말 0: 조언·권유·정답·원인 단정·과장·평가어 낱말과 시제어(지금·요즘·올해) — 부정문 속에서도 쓰지 않는다', () => {
    for (const [id, s] of entries) expect(INSIGHT_BANNED_WORDS.test(s), `${id}: ${s}`).toBe(false);
  });

  it('금지 낱말 lint가 실제로 잡는다 (대조군): 조언·원인·평가어·시제어를 넣으면 걸린다', () => {
    for (const bad of ['저축하세요.', '일자리 때문입니다.', '이 길이 가장 낫습니다.', '지금은 많습니다.', '요즘 힘든 일입니다.', '권합니다.', '올해의 값입니다.']) expect(INSIGHT_BANNED_WORDS.test(bad), bad).toBe(true);
  });

  it('숫자는 그 인용의 요약(text)에 있는 값뿐이다: 풀이의 아라비아 숫자 토큰이 모두 요약의 토큰이다 (새 수치 0)', () => {
    for (const [id, s] of entries) {
      const summary = getCitation(id)!.text;
      const known = new Set(numbersIn(summary));
      for (const token of numbersIn(s)) expect(known.has(token), `${id}: 풀이의 「${token}」가 요약에 없다 — ${s} / ${summary}`).toBe(true);
    }
  });

  it('수 lint: 단위어 앞 수사는 허용 목록(한 해·한 시간·한 달·두 사람)뿐이다 — 아라비아 숫자와 단위어 앞 수사만 검사하고 「하루」 같은 낱말은 대상이 아니다', () => {
    for (const [id, s] of entries) {
      for (const m of s.matchAll(UNIT_NUMERAL)) {
        const phrase = `${m[1]} ${m[2]}`;
        expect(UNIT_NUMERAL_ALLOWED as readonly string[], `${id}: 허용 목록 밖의 단위어 앞 수사 「${m[0]}」 — ${s}`).toContain(phrase);
      }
    }
    // 허용 목록의 낱말이 실제로 쓰인 곳은 그 인용 요약의 뜻과 맞는다: 한 시간(시간당) · 한 달(월소득) · 한 해(연간 등록금·출생 연도) · 두 사람(장면의 두 사람)
    expect(INSIGHT_BY_ID['c-017']).toContain('한 시간');
    expect(getCitation('c-017')!.text).toContain('시간당');
    expect(INSIGHT_BY_ID['c-094']).toContain('한 달');
    expect(getCitation('c-094')!.text).toMatch(/월|소득/);
    expect(INSIGHT_BY_ID['c-010']).toContain('한 해');
    expect(INSIGHT_BY_ID['c-099']).toContain('한 해');
    // 대조군
    const flagged = [...'아이 셋이 있다. 두 명이 왔다.'.matchAll(UNIT_NUMERAL)].map((m) => `${m[1]} ${m[2]}`);
    expect(flagged).toEqual(['두 명']);
  });

  it('한글 수사 낱말(서른 줄·서른 중반·여든·일흔·예순다섯)은 요약의 값이 그 범위 안에 있을 때만 쓴다 — 풀이가 요약에 없는 수를 만들지 않는다', () => {
    let used = 0;
    for (const [id, s] of entries) {
      for (const w of HANGUL_RANGE_WORDS) {
        if (!s.includes(w.word)) continue;
        used++;
        const values = numbersIn(getCitation(id)!.text).map(valueOf);
        expect(
          values.some((v) => v >= w.min && v <= w.max),
          `${id}: 「${w.word}」는 요약에 ${w.min}~${w.max} 값이 있을 때만 — 요약 ${getCitation(id)!.text}`,
        ).toBe(true);
      }
    }
    expect(used, '한글 수사 낱말이 실제로 쓰인 곳이 있다 (검사가 공허하지 않다)').toBeGreaterThanOrEqual(5);
  });

  it('같은 문형은 3개를 넘지 않는다 (마스터 결정 ⑤): 「첫 절 끝 + 문장 끝」 쌍과 끝 두 어절이 같은 문장이 각각 3개 이하이고 초안의 한계 진술 틀은 0이다', () => {
    const frames = new Map<string, string[]>();
    const tails = new Map<string, string[]>();
    for (const [id, s] of entries) {
      const k = patternKeys(s);
      frames.set(k.frame, [...(frames.get(k.frame) ?? []), id]);
      tails.set(k.tail, [...(tails.get(k.tail) ?? []), id]);
      for (const f of OLD_FRAMES) expect(f.test(s), `${id}: 초안의 되풀이 틀 ${f} — ${s}`).toBe(false);
    }
    for (const [k, ids] of frames) expect(ids.length, `문형 ${k}: ${ids.join(' ')}`).toBeLessThanOrEqual(3);
    for (const [k, ids] of tails) expect(ids.length, `끝 두 어절 ${k}: ${ids.join(' ')}`).toBeLessThanOrEqual(3);
  });

  it('보이지 않는 글자·줄 끝 공백·따옴표 쌍이 없다 (낱말 끊김·낭독이 흐트러지지 않게)', () => {
    for (const [id, s] of entries) {
      expect(s, id).not.toMatch(INVISIBLE);
      expect(s, id).not.toMatch(/\s{2,}/);
      expect(s, id).not.toMatch(/["'`<>]/);
    }
  });

  it('요약 문장을 그대로 되풀이하지 않는다: 풀이가 요약의 열두 글자(공백 제외) 이상 이어진 구절을 베끼지 않는다 (요약과 같은 말이 되면 풀이가 아니다 — 짧은 낱말 겹침은 같은 대상을 가리키는 말이라 허용)', () => {
    const chunks = (s: string, n: number): Set<string> => {
      const chars = [...s.replace(/\s/g, '')];
      return new Set(Array.from({ length: Math.max(0, chars.length - n + 1) }, (_, i) => chars.slice(i, i + n).join('')));
    };
    for (const [id, s] of entries) {
      const summary = chunks(getCitation(id)!.text, 12);
      const copied = [...chunks(s, 12)].filter((c) => summary.has(c));
      // 숫자 구절(「113만9천명」)은 요약의 값을 그대로 가리키는 것이라 허용한다 — 숫자가 아닌 12글자 구절이 겹치면 베낀 것이다
      expect(copied.filter((c) => !/\d/.test(c)), `${id}: 요약과 겹치는 구절`).toEqual([]);
    }
  });
});

describe('usageCaution 준수 (UX14-3 ③)', () => {
  it('풀이가 달린 인용의 `usageCaution.forbiddenEvents`에 그 인용이 연결된 어떤 이벤트도 들어 있지 않다', () => {
    for (const id of Object.keys(INSIGHT_BY_ID)) {
      const forbidden = new Set(getCitation(id)!.usageCaution?.forbiddenEvents ?? []);
      for (const ev of USERS.self.get(id) ?? []) expect(forbidden.has(ev), `${id} ↔ ${ev}`).toBe(false);
    }
  });

  it('`determinism`·`self-blame`·`stigma`·`comparison-ranking`·`parent-blame` 같은 금지 카드 유형이 있는 인용의 풀이는 결정론·자책·견줌 낱말을 쓰지 않는다 (유형별 낱말 목록)', () => {
    const TYPE_WORDS: Readonly<Record<string, RegExp>> = {
      determinism: /결정|운명|앞날|성공|실패|합격|보장|될 것|질 것|수명|남은 시간/,
      'self-blame': /네 탓|내 탓|잘못|게으|노력이 부족|못한|부족/,
      stigma: /낙오|패배|뒤처|열등|못난|한심|무능|문제 있/,
      'comparison-ranking': /보다 낫|보다 못|우위|열위|순위|더 좋|더 나쁜|비해 높|비해 낮/,
      'parent-blame': /부모 탓|부모의 잘못|키운 탓|가르친 탓/,
    };
    let checked = 0;
    for (const id of Object.keys(INSIGHT_BY_ID)) {
      for (const type of getCitation(id)!.usageCaution?.forbiddenCardTypes ?? []) {
        const re = TYPE_WORDS[type];
        if (re === undefined) continue;
        checked++;
        expect(re.test(INSIGHT_BY_ID[id]), `${id} [${type}]: ${INSIGHT_BY_ID[id]}`).toBe(false);
      }
    }
    expect(checked, '유형 검사가 실제로 돌았다').toBeGreaterThan(20);
  });

  it('인용이 보일 때만 풀이가 보인다 — 인용이 연결되지 않은 세상·보이지 않는 연도에는 풀이만 따로 나오지 않는다 (풀이는 인용 박스 안에만 있다)', () => {
    // CitationBox가 풀이의 유일한 소비처다 — 박스 밖에 풀이를 그리는 코드가 없다
    for (const [name, src] of [['DecisionCard', decisionCardSrc], ['ParentCard', parentCardSrc], ['NoteSheet', noteSheetSrc]] as const) {
      expect(src.match(/INSIGHT_BY_ID/g) ?? [], `${name}은 데이터 객체를 직접 읽지 않는다`).toHaveLength(0);
    }
    expect(decisionCardSrc.match(/insightFor\(/g) ?? [], 'DecisionCard만 insightFor를 부른다').toHaveLength(1);
    expect(decisionCardSrc).toContain('<CitationBox view={cite} insight={insightFor(cite.id)} />');
    expect(parentCardSrc, '부모·흘러감 카드는 풀이를 넘기지 않는다 (M23)').not.toMatch(/insight/i);
    expect(noteSheetSrc, '기록 카드는 풀이를 넘기지 않는다 (UX14-2)').not.toMatch(/insight/i);
    expect(citationInsightsSrc.match(/export function insightFor/g)).toHaveLength(1);
  });
});

describe('CitationBox: 풀이 줄 (copy.md 15-4 · design-system 16-4)', () => {
  const VIEW = { id: 'c-015', kind: 'stat' as const, text: '2025년 3월말 요약입니다.', sourceWho: '국가데이터처(2026),', sourceTitle: '2025년 가계금융복지조사 결과', sourceLine: '국가데이터처(2026), 2025년 가계금융복지조사 결과' };

  it('풀이를 넘기면 출처 줄 뒤에 한 문장 묶음이 생긴다 — 화면 라벨 없이, 눈에 안 보이는 접두 「풀이:」(sr-only)만: 종류 → 요약 → 출처 → 풀이 (형진 님 2026-10-26)', () => {
    const html = box(VIEW, '풀이 문장입니다.');
    expect(html).toContain('<div class="cite__insight" data-testid="cite-insight"><p class="cite__insight-text"><span class="sr-only">풀이: </span>풀이 문장입니다.</p></div>');
    expect(html, '보이는 라벨 요소 0 (옛 .cite__insight-label)').not.toContain('cite__insight-label');
    expect(html.replace(/<span class="sr-only">[^<]*<\/span>/g, ''), '눈에 보이는 글자(sr-only를 뺀 것)에 「풀이」가 없다').not.toContain('풀이:');
    expect(DASH_TEXT.citeInsightLabel).toBe('풀이'); // 스크린리더 접두의 글자(copy.md 15절 상수 — 화면 라벨로는 쓰지 않는다)
    const order = ['cite__kind', 'data-testid="cite-text"', 'data-testid="cite-src"', 'data-testid="cite-insight"'].map((n) => html.indexOf(n));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // 풀이는 인용 박스 안이다
    expect(html.indexOf('data-testid="cite-insight"')).toBeLessThan(html.lastIndexOf('</div>'));
  });

  it('풀이를 넘기지 않으면(없음 · null) 풀이 요소 자체가 없다 — 박스는 지금과 같다 (빈 줄 0)', () => {
    const without = box(VIEW);
    expect(box(VIEW, null)).toBe(without);
    expect(without).not.toMatch(/cite__insight|풀이/);
    expect(without.endsWith('</p></div>')).toBe(true);
  });

  it('문장 스타일: 라벨 없이 색·굵기로 구분한다 — .cite__insight-text는 굵게 + 놋쇠 계열 글자 토큰, 기울임·새 글꼴·새 글자 크기 없음, 대비 쌍이 PAIRS에 있다 (형진 님 2026-10-26)', () => {
    const css = dashCss.replace(/\/\*[^]*?\*\//g, '');
    const rules = [...css.matchAll(/\.cite__insight-text\s*\{([^}]*)\}/g)].map((m) => m[1]);
    expect(rules.length, '규칙은 시안 블록의 크기 규칙 + 뒤에서 덮는 구분 규칙 둘').toBe(2);
    const merged = rules.join(';');
    expect(merged).toMatch(/font-weight:\s*var\(--fw-bold\)/); // 굵게(보통 → 굵게, 중간 굵기 없음)
    expect(merged).toMatch(/color:\s*var\(--c-on-accent-soft\)/); // 「전망」 칩 글자와 같은 토큰
    expect(merged, '기울임 없음').not.toMatch(/font-style/);
    expect(merged, '새 글꼴 없음').not.toMatch(/font-family/);
    expect(merged, '글자 크기는 14px(--fs-sm) 그대로').toMatch(/font-size:\s*var\(--fs-sm\)/);
    expect(css, '새 웹폰트 없음(초기 로드 예산)').not.toMatch(/@font-face/);
    // 대비: 문장 글자(--c-on-accent-soft) ↔ 인용 박스 면(--c-brand-soft), 라이트·다크 모두 4.5:1 (tests/contrast.test.ts가 모든 쌍을 두 테마에서 돌린다)
    expect(PAIRS.some((p) => p.fg === '--c-on-accent-soft' && p.bg === '--c-brand-soft' && p.min === 4.5 && p.kind === 'text')).toBe(true);
    // 구분 규칙은 designer 블록(시안과 한 글자씩 같은 블록)의 바깥에 있다
    const designerBlock = dashCss.slice(dashCss.indexOf('/* ---------- r4 중대 결정 카드 —'), dashCss.indexOf('/* ---------- r4 중대 결정 카드 끝 ---------- */'));
    expect(designerBlock).not.toContain('--c-on-accent-soft');
    expect(dashCss).toContain('/* ---------- r4 구현 변경 — 풀이 줄에서 「풀이」 라벨을 없애고');
  });

  it('풀이 문장도 Glue로 그린다: 숫자+단위는 줄 끝에 혼자 남지 않게 묶인다 (요약과 같은 규칙)', () => {
    const html = box(VIEW, INSIGHT_BY_ID['c-074']);
    expect(html).toMatch(/<p class="cite__insight-text">.*<span class="nowrap">73\.6%/);
  });
});

describe('실제 인용 박스: 본인이 고르는 카드의 인용에는 풀이가 있고, 생략된 인용은 박스가 그대로다', () => {
  it('지금 세상 youth-housing(c-015)의 CitationBox는 풀이 줄을 그린다 · youth-return-school(c-095, 생략)은 풀이 요소가 없다', () => {
    const housing = EVENT_POOL.byId.get('youth-housing')!;
    const view = citationFor(housing, 'present' satisfies Era, 2040)!;
    expect(view.id).toBe('c-015');
    const html = box(view, insightFor(view.id));
    expect(html.replace(/<\/?span[^>]*>/g, '')).toContain('29세 이하 가구의 절반은 그보다 덜 가진 채 같은 거리 앞에 서 있습니다.'); // Glue 묶음 span을 벗긴 눈에 보이는 글자
    const back = EVENT_POOL.byId.get('youth-return-school')!;
    const backView = citationFor(back, 'present', 2040)!;
    expect(backView.id).toBe('c-095');
    expect(box(backView, insightFor(backView.id))).not.toContain('cite__insight');
  });
});
