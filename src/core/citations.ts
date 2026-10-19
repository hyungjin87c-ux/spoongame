import { ERA_CONFIG } from '../data/birthTable';
import { CITATION_TABLE, getCitation, type CitationRecord, type CitationSource } from '../data/citationsAccess';
import { STAGE_TABLE } from '../data/lifeTable';
import { NO_CITATION_CODES, type EventDef } from './events';
import { ERAS, STAGES, type Era } from './types';

/**
 * 중대 결정 카드의 인용 (SPEC-003 MD2·MD3·EV6, M7b 1단계 — 문구·규칙은 docs/design/copy.md 6-3절, 배치는 docs/data/content-M7b.md).
 * 순수 함수 모음이다(CM2 — 시각·난수·DOM 없음). 게임 속 연도(출생 연도 + 나이)는 UI가 `calendarYear(birthYear, age)`로 만들어 넘긴다.
 *
 * 카드(이벤트)와 인용의 연결은 이벤트 JSON의 `citation`(문자열 또는 세상별 객체)·`noCitation`이다. 이 모듈은 그 연결을 읽어 **그 세상·그 해에 실제로 보일 인용**을 고른다 —
 * 연결돼 있어도 아래 중 하나면 보이지 않는다(null): 인용이 없거나 `verified`·`usable`이 아님 / 인용의 `eras`에 그 세상이 없음 / 게임 속 연도가 인용의 유효 범위 밖.
 */

/** 다가올 세상의 모든 인용 머리말 (M-2): 지금의 통계·연구를 「지금 기준으로는」이라고 밝힌다. 인용이 `eraPrefix.future`를 가지면 그것이 먼저다 */
export const FUTURE_PREFIX = '지금 기준으로는';

/** 인용 박스에 그릴 한 건 */
export interface CitationView {
  id: string;
  kind: 'stat' | 'research';
  /** 표시 문자열 = (시대 머리말 + 한 칸) + 요약. 합쳐서 ≤ 100자 */
  text: string;
  /** 출처 줄의 앞머리 「{누가}({연도}),」 — 한 덩어리로 줄바꿈을 지킨다 */
  sourceWho: string;
  /** 출처 줄의 자료 이름(원제 그대로) */
  sourceTitle: string;
  /** 출처 한 줄 「{누가}({연도}), {자료 이름}」 */
  sourceLine: string;
}

/** 이벤트의 `citation`에서 그 세상의 인용 id를 꺼낸다(연결이 없으면 null). 카드가 뜨지 않는 세상(`eras`에 없음)은 문자열 형태여도 null이다. 인용이 실제로 쓸 수 있는지는 보지 않는다 */
export function citationIdFor(event: Pick<EventDef, 'citation' | 'eras'>, era: Era): string | null {
  const c = event.citation;
  if (c === undefined) return null;
  if (event.eras !== undefined && !event.eras.includes(era)) return null;
  if (typeof c === 'string') return c;
  return c[era] ?? null;
}

/**
 * 인용이 보이는 게임 속 연도의 범위 (R-182 — 지난 세상 카드에 그 시기보다 늦은 통계가 새지 않게).
 *  - 아래 한계 `validFromYear`: 필드가 있으면 그것, 없으면 **통계는 `refs`의 가장 늦은 연도**(값에 들어 있는 가장 늦은 해, 연도가 없는 참조는 건너뛴다), 연구는 한계 없음(-무한).
 *  - 위 한계 `validUntilYear`: 필드가 있을 때만(전망 인용 — 전망 대상 해가 지나면 「됩니다」가 거짓이 된다), 없으면 +무한.
 */
export function citationValidRange(c: CitationRecord): { from: number; until: number } {
  const refYears = c.kind === 'stat' ? (c.refs ?? []).map((r) => r.year).filter((y): y is number => typeof y === 'number' && Number.isFinite(y)) : [];
  const from = c.validFromYear ?? (refYears.length > 0 ? Math.max(...refYears) : Number.NEGATIVE_INFINITY);
  return { from, until: c.validUntilYear ?? Number.POSITIVE_INFINITY };
}

/** 인용이 게임 속 연도 `calendarYear`에 보이는가 */
export function citationValidAt(c: CitationRecord, calendarYear: number): boolean {
  const r = citationValidRange(c);
  return calendarYear >= r.from && calendarYear <= r.until;
}

/** 시대 머리말: 인용의 `eraPrefix[era]`가 먼저, 다가올 세상은 없으면 상수 「지금 기준으로는」. 지난·지금 세상은 인용이 정한 것만(없으면 없음) */
export function eraPrefixOf(c: CitationRecord, era: Era): string {
  const own = c.eraPrefix?.[era];
  if (own !== undefined && own !== '') return own;
  // 다가올 세상의 상수 머리말은 **지금의 통계·연구를 가져다 쓰는 인용**(eras에 present가 있음)에만 — 다가올 세상 전용 전망(c-051 등)은 이미 「전망」이라 따로 붙이지 않는다
  return era === 'future' && c.eras.includes('present') ? FUTURE_PREFIX : '';
}

/** 표시 문자열 = 「{머리말} {요약}」(머리말이 없으면 요약만) */
export function citationText(c: CitationRecord, era: Era): string {
  const prefix = eraPrefixOf(c, era);
  return prefix === '' ? c.text : `${prefix} ${c.text}`;
}

// ---------- 출처 줄 (copy.md 6-3) ----------

/** 「Teti, D. M., Sakin, J. W., …, & Eiden, R. D.」 → ['Teti', 'Sakin', …]. 저자 목록 꼴(성, 머리글자 반복)이 아니면 null — 기관 이름(「질병관리청」「세계보건기구(WHO)」)·연구 그룹 이름 */
export function authorSurnames(org: string): string[] | null {
  const parts = org
    .split(/,\s*(?:&\s*)?/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
  if (parts.length < 2 || parts.length % 2 !== 0) return null;
  const names: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    if (!/^(?:[A-Z]\.(?:\s|-)?)+$/.test(parts[i + 1])) return null;
    names.push(parts[i]);
  }
  return names;
}

/**
 * 출처 줄의 「누가」: 통계는 기관 그대로, 연구는 저자 **성만** — 1명 「Volling」, 2명 「Shonkoff·Garner」, 3명 이상 「Teti 외」(M-11).
 * 저자 성 배열(`source.authors`)이 있으면 그것을 읽고, 없으면 `org`에서 파싱한다. 저자 목록 꼴이 아닌 `org`(기관이 쓴 연구 자료)는 기관 그대로.
 */
export function sourceWho(source: CitationSource, kind: 'stat' | 'research'): string {
  if (kind === 'research') {
    const names = source.authors !== undefined && source.authors.length > 0 ? source.authors : authorSurnames(source.org);
    if (names !== null) return names.length >= 3 ? `${names[0]} 외` : names.length === 2 ? `${names[0]}·${names[1]}` : names[0];
    return source.org;
  }
  // 통계의 기관이 둘 이상이면(데이터에 「국가데이터처·교육부」처럼 가운뎃점으로 이은 것) **쉼표 나열**로 보인다 — 가운뎃점으로 이은 나열은 좁은 폭·큰 글자에서 어디서 끊어도 「·」가 줄 끝·첫머리에 남는다
  // (QM2-10 규칙 2, 마스터 확정: 항목 수가 데이터에 따라 바뀌는 나열은 쉼표). 기관 이름 자체는 그대로다.
  return source.org.replace(/·/g, ', ');
}

/**
 * 자료 이름: 연구는 원제 그대로(번역·줄임 없음 — M-11). 통계의 자료 이름은 우리가 「조사 이름 — 표 이름」으로 이어 쓴 것이라 띄어 쓴 줄표(「 — 」)를 **쌍점**(「: 」)으로 보인다 —
 * 줄표는 한 줄보다 긴 첫 낱말(「초중고사교육비조사」) 뒤에서 줄 첫머리에 혼자 남는다(QM2-5 구분 기호 규칙). 조사 이름과 표 이름의 관계는 그대로다.
 */
export function sourceTitle(source: CitationSource, kind: 'stat' | 'research'): string {
  return kind === 'stat' ? source.title.replace(/ — /g, ': ') : source.title;
}

/** 출처 줄을 앞머리와 자료 이름으로 나눈 것 — 앞머리 「{누가}({연도}),」는 줄바꿈 한 덩어리로, 자료 이름은 줄바꿈 묶음으로 그리려고 나눠 둔다 */
export function splitSourceLine(source: CitationSource, kind: 'stat' | 'research'): { head: string; title: string } {
  const who = sourceWho(source, kind);
  const year = source.yearKind === 'accessed' ? `${source.year}년 열람` : String(source.year);
  // 「누가」가 괄호로 끝나면(「세계보건기구(WHO)」) 연도 괄호 앞에 한 칸 — 「(WHO)(2019)」로 붙어 읽히지 않게
  return { head: `${who}${who.endsWith(')') ? ' ' : ''}(${year}),`, title: sourceTitle(source, kind) };
}

/**
 * 글 속 라틴 문자 덩어리(영문 저자 성·약어·원제)를 가른다 — 스크린 리더가 한국어 음성으로 영문을 읽지 않게 `lang="en"`을 달 자리를 찾는 데 쓴다(QA-003-M7b K11).
 * 덩어리 = 영문자로 시작하는 낱말 + 공백·쉼표·마침표·쌍점·`&`로 이어지는 영숫자 낱말. 한글·가운뎃점·괄호에서 끊긴다(「Teti 외(1996),」 → 「Teti」, 「Shonkoff·Garner」 → 「Shonkoff」·「Garner」).
 */
export function latinRuns(text: string): Array<{ text: string; latin: boolean }> {
  const out: Array<{ text: string; latin: boolean }> = [];
  const re = /[A-Za-z][A-Za-z0-9'’-]*(?:[ ,.:;&]+[A-Za-z0-9'’-]+)*/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at), latin: false });
    out.push({ text: m[0], latin: true });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), latin: false });
  return out;
}

/** 이 글이 라틴 문자 위주인가(영문 원제) — 영문자가 한글보다 많으면 'en', 아니면 undefined. 자료 이름처럼 통째로 한 언어인 글에 `lang`을 다는 데 쓴다 */
export function dominantLang(text: string): 'en' | undefined {
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  const hangul = (text.match(/[가-힣]/g) ?? []).length;
  return latin > hangul ? 'en' : undefined;
}

/** 출처 한 줄 「{누가}({연도}), {자료 이름}」. 열람 연도는 「{연도}년 열람」. `venue`·`doi`·`pmid`·`url`은 어디에도 쓰지 않는다(EV6) */
export function formatSourceLine(source: CitationSource, kind: 'stat' | 'research'): string {
  const { head, title } = splitSourceLine(source, kind);
  return `${head} ${title}`;
}

// ---------- 카드 × 세상 × 게임 속 연도 → 보일 인용 ----------

/**
 * 이 카드가 이 세상·이 해에 보일 인용. 보일 인용이 없으면 null(인용 박스를 그리지 않는다 — 빈 박스 0).
 * 선택 순서: 이벤트의 `citation`에서 그 세상의 id → 인용 테이블(verified·usable)에서 찾기 → 인용의 `eras`에 그 세상이 있는가 → 게임 속 연도가 유효 범위인가.
 */
export function citationFor(event: Pick<EventDef, 'citation' | 'eras'>, era: Era, calendarYear: number, table: readonly CitationRecord[] = CITATION_TABLE): CitationView | null {
  const id = citationIdFor(event, era);
  if (id === null) return null;
  const c = getCitation(id, table);
  if (c === undefined || !c.eras.includes(era) || !citationValidAt(c, calendarYear)) return null;
  const { head, title } = splitSourceLine(c.source, c.kind);
  return { id: c.id, kind: c.kind, text: citationText(c, era), sourceWho: head, sourceTitle: title, sourceLine: `${head} ${title}` };
}

// ---------- MD2 정적 연결률 (1차 게이트, 마스터 결정 M-1) ----------

/**
 * MD2 **1차 게이트**: 시대별 정적 연결률의 하한 — 지금 ≥ 40% · 다가올 ≥ 40% · 지난 ≥ 8%. SPEC MD2의 70%(지금·다가올)는 **2차 최종 목표**로 남고 2차 끝(M7d 새 카드 + T 수집 뒤)에 다시 판정한다.
 * 지난 세상 40%는 중년·노년 카드가 1970~89 통계와 겹치지 않아 구조적으로 불가능하므로 2차 착수 때 영유아·학창·청년 카드 기준의 별도 임계로 다시 정한다. 이 상수를 2차 목표로 착각하지 않게 시험 이름에 「1차 게이트」를 적는다.
 */
export const CITATION_COVERAGE_MIN: Readonly<Record<Era, number>> = { present: 0.4, future: 0.4, past: 0.08 };

/** 「인용 ≥ 30개」(1차 릴리스, M-4) — 카드에 연결된 서로 다른 인용 id 수의 하한 */
export const CITATION_DISTINCT_MIN = 30;

/** 이 카드가 이 세상에서 뜰 수 있는 게임 속 연도의 범위 [from, to] — 출생 연도 범위(시대 설정) + 카드의 나이 범위(`ageRange`와 단계가 겹치는 나이) */
export function cardCalendarYears(ev: Pick<EventDef, 'stages' | 'ageRange'>, era: Era): { from: number; to: number } {
  const { min, max } = ERA_CONFIG[era].birthYears;
  const spans = ev.stages.map((st) => {
    const i = STAGES.indexOf(st);
    const next = STAGES[i + 1];
    return { lo: STAGE_TABLE[st].startAge, hi: next ? STAGE_TABLE[next].startAge - 1 : 130 };
  });
  const lo = Math.max(ev.ageRange?.min ?? 0, Math.min(...spans.map((x) => x.lo)));
  const hi = Math.min(ev.ageRange?.max ?? 130, Math.max(...spans.map((x) => x.hi)));
  return { from: min + lo, to: max + hi };
}

export interface CoverageCell {
  /** 그 세상에서 뜰 수 있는 선택지 이벤트(분모) */
  total: number;
  /** 연결 인용이 있고 그 세상에서 보일 수 있는 이벤트(분자) */
  connected: number;
  rate: number;
  /** 분자에 든 이벤트 id */
  ids: string[];
}

/**
 * 시대별 **정적 연결률** (MD2 판정, 마스터 결정 M-1): 그 세상에서 뜰 수 있는 선택지 이벤트(`eras`가 없으면 세 세상 모두) 가운데, 그 세상의 `citation`이 **쓸 수 있는 인용**(verified·usable)이고
 * 인용의 `eras`에 그 세상이 있으며 인용의 유효 연도 범위가 그 카드가 그 세상에서 뜰 수 있는 게임 속 연도 범위와 **한 번이라도 겹치는** 이벤트의 비율. 노출률(1000판에서 실제 보인 몫)은 판정이 아니라 보고다(`scripts/citationExposureLib.ts`).
 * 조건(플래그·재력·성별)은 보지 않는 정적 기준이다.
 */
export function citationCoverage(events: readonly EventDef[], table: readonly CitationRecord[] = CITATION_TABLE): Record<Era, CoverageCell> {
  const out = {} as Record<Era, CoverageCell>;
  for (const era of ERAS) {
    const ids: string[] = [];
    let total = 0;
    for (const ev of events) {
      if (ev.choices === undefined || ev.choices.length === 0) continue;
      if (ev.eras !== undefined && !ev.eras.includes(era)) continue;
      total++;
      const cid = citationIdFor(ev, era);
      const c = cid === null ? undefined : getCitation(cid, table);
      if (c === undefined || !c.eras.includes(era)) continue;
      const range = citationValidRange(c);
      const years = cardCalendarYears(ev, era);
      if (years.to >= range.from && years.from <= range.until) ids.push(ev.id);
    }
    out[era] = { total, connected: ids.length, rate: total === 0 ? 0 : ids.length / total, ids };
  }
  return out;
}

/** 카드에 연결된(정적 연결률의 분자에 든) 서로 다른 인용 id — 「인용 ≥ 30개」(M-4)를 센다 */
export function connectedCitationIds(events: readonly EventDef[], table: readonly CitationRecord[] = CITATION_TABLE): string[] {
  const set = new Set<string>();
  const cov = citationCoverage(events, table);
  const byId = new Map(events.map((e) => [e.id, e]));
  for (const era of ERAS) for (const id of cov[era].ids) set.add(citationIdFor(byId.get(id)!, era)!);
  return [...set].sort();
}

// ---------- 연결 점검 · 역색인 (check:events·check:citations·시험) ----------

/**
 * 인용 → 그 인용을 쓰는 이벤트 id 목록의 역색인 (`citations.json`의 `usedBy`가 이것과 같아야 한다 — 사람이 쓰지 않고 `npm run gen:citations`가 쓴다, M-5).
 * 이벤트의 `citation`이 가리키는 모든 세상의 id를 모은다(세상이 달라도 같은 카드는 한 번). 목록은 이벤트 id 오름차순이다.
 */
export function usedByIndex(events: readonly EventDef[]): Record<string, string[]> {
  const index: Record<string, Set<string>> = {};
  for (const ev of events) {
    for (const era of ERAS) {
      const id = citationIdFor(ev, era);
      if (id !== null) (index[id] ??= new Set()).add(ev.id);
    }
  }
  return Object.fromEntries(Object.entries(index).map(([id, set]) => [id, [...set].sort()]));
}


/**
 * 이벤트가 가리키는 인용 id가 모두 `citations.json`에 있고 `verified`·`usable`인지, 인용이 금지한 이벤트(`usageCaution.forbiddenEvents`)에 연결하지 않았는지 본다.
 * 형태(문자열·객체·사유 코드)는 `validateEventFiles`가 이미 봤다. 문제 목록(문장)을 돌려준다.
 */
export function citationLinkProblems(events: readonly EventDef[], table: readonly CitationRecord[] = CITATION_TABLE): string[] {
  const problems: string[] = [];
  const byId = new Map(table.map((c) => [c.id, c]));
  for (const ev of events) {
    if (ev.noCitation !== undefined && !(NO_CITATION_CODES as readonly string[]).includes(ev.noCitation)) problems.push(`이벤트 "${ev.id}": noCitation "${ev.noCitation}"은 사유 코드가 아니다`);
    for (const era of ERAS) {
      const id = citationIdFor(ev, era);
      if (id === null) continue;
      const c = byId.get(id);
      if (c === undefined) problems.push(`이벤트 "${ev.id}"(${era}): 인용 "${id}"가 citations.json에 없다`);
      else {
        if (c.verified !== true || c.usable !== true) problems.push(`이벤트 "${ev.id}"(${era}): 인용 "${id}"는 확인되지 않았거나 쓸 수 없다 (verified·usable)`);
        if (c.usageCaution?.forbiddenEvents?.includes(ev.id)) problems.push(`이벤트 "${ev.id}"(${era}): 인용 "${id}"는 이 이벤트에 붙일 수 없다 (usageCaution.forbiddenEvents)`);
      }
    }
  }
  return problems;
}
