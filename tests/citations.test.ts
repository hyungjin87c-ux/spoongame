import { describe, expect, it } from 'vitest';
import citationsJson from '../src/data/citations.json';
// 예비 지표(첫 화면 묶음에서 뺀 4개 + 격차 measures)까지 합친 전체 데이터 — 모든 지표를 훑는 시험은 합친 쪽을 본다 (SPEC-005 QI4 2단계, src/data/koreaStatsFull.ts)
import { FULL_STATS as statsJson } from '../src/data/koreaStatsFull';
import basisDoc from '../docs/data/events-stats-basis.md?raw';
import { EVENT_POOL } from '../src/data/events';
import { NOTE_CARDS } from '../src/data/noteCards';
import { createStatsAccess } from '../src/data/koreaStatsAccess';
import { usedByIndex } from '../src/core/citations';

/**
 * 인용 데이터(src/data/citations.json) 검증 — SPEC-003 M6a (EV1~EV6, MD3).
 * 이벤트가 인용하는 문장은 통계(stat)와 연구(research) 두 종류이며, 원문을 옮기지 않은 요약 문장과 서지 정보만 둔다.
 * - 수치는 koreaStats.json의 값과 refs로 대조한다. 값이 어긋나면 이 테스트가 실패한다.
 * - 연구 인용은 확인한 서지(PubMed 번호·DOI·공식 페이지 URL)가 있어야 하고, 확인하지 못한 것은 unverifiedCandidates에만 둔다.
 */

interface Ref {
  indicator: string;
  value: number;
  year?: number;
  label?: string;
  key?: string;
  field?: string;
  row?: Record<string, unknown>;
  extraSeriesIndex?: number;
}
interface Fact {
  token: string;
  kind: 'ref' | 'derived' | 'year' | 'label' | 'count' | 'source';
  a?: number;
  b?: number;
  op?: string;
  scale?: number;
  round?: number;
  factor?: number;
  evidence?: string;
  indicator?: string;
  list?: string;
}
interface Assertion {
  type: 'less' | 'positive' | 'ratioAbove' | 'extreme' | 'firstAbove' | 'lifecycle';
  claim: string;
  a?: number;
  b?: number;
  min?: number;
  which?: 'min' | 'max';
  indicator?: string;
  field?: string;
  among?: 'sido' | 'series';
  expect?: string | number;
  threshold?: number;
  expectYear?: number;
}
interface UsageCaution {
  forbiddenCardTypes: string[];
  forbiddenEvents: string[];
  framing?: string[];
  note: string;
}
interface Citation {
  id: string;
  kind: 'stat' | 'research';
  text: string;
  source: { org: string; title: string; year: number; yearKind?: 'accessed' | 'published'; venue?: string; doi?: string; pmid?: string; url?: string };
  evidenceType?: string;
  eraPrefix?: Record<string, string>;
  /** M7b(2단계) — 게임 속 연도가 이 해보다 이르면(validFromYear) / 늦으면(validUntilYear) 보이지 않는다 */
  validFromYear?: number;
  validUntilYear?: number;
  facts?: Fact[];
  assertions?: Assertion[];
  usageCaution?: UsageCaution;
  basisId: string;
  eras: string[];
  refs: Ref[];
  usedBy: string[];
  /** M7b에서 없어졌다(후보 기록의 역할이 usedBy 역색인으로 넘어갔다) — 남아 있으면 안 된다 */
  candidateEvents?: string[];
  candidateFor: string[];
  verified: boolean;
  usable: boolean;
  accessedOn: string;
  note?: string;
}
interface CitationFile {
  meta: { updatedOn: string; schemaVersion: number; rules: string; sourceLineFormat: string; sourceLineFormatAccessed?: string };
  citations: Citation[];
  unverifiedCandidates: Array<{ id: string; title: string; basisId: string; reason: string; usable: boolean }>;
}
type Point = { year?: number; label?: string; value: number };
interface Ind {
  id: string;
  series?: Point[];
  extraSeries?: Array<{ series: Point[] }>;
  rows?: Array<Record<string, unknown>>;
  usable: boolean;
  [k: string]: unknown;
}

const FILE = citationsJson as unknown as CitationFile;
const CITES = FILE.citations;
const INDS = (statsJson as unknown as { indicators: Ind[] }).indicators;
const ind = (id: string): Ind => {
  const found = INDS.find((i) => i.id === id);
  if (!found) throw new Error(`지표 없음: ${id}`);
  return found;
};
const EVENT_IDS = new Set(EVENT_POOL.events.map((e) => e.id));
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** 지난 세상(1970~89 공식 시계열) 통계 인용 */
const PAST_STAT_IDS = ['c-053', 'c-054', 'c-055', 'c-056', 'c-057', 'c-058', 'c-059', 'c-089', 'c-090', 'c-091', 'c-097', 'c-098', 'c-099', 'c-100', 'c-101'];

/** refs의 한 항목이 가리키는 값을 koreaStats.json에서 찾는다 (5가지 형식) */
function resolve(r: Ref): number | undefined {
  const i = ind(r.indicator);
  if (r.key !== undefined) {
    let cur: unknown = i;
    for (const part of r.key.split('.')) cur = (cur as Record<string, unknown> | undefined)?.[part];
    return typeof cur === 'number' ? cur : undefined;
  }
  if (r.row !== undefined && r.field !== undefined) {
    const entries = Object.entries(r.row);
    const row = (i.rows ?? []).find((x) => entries.every(([k, v]) => x[k] === v));
    const v = row?.[r.field];
    return typeof v === 'number' ? v : undefined;
  }
  if (r.extraSeriesIndex !== undefined) return i.extraSeries?.[r.extraSeriesIndex]?.series.find((p) => p.year === r.year)?.value;
  if (r.label !== undefined) return (i.series ?? []).find((p) => p.label === r.label)?.value;
  if (r.year !== undefined) {
    const p = (i.series ?? []).find((x) => x.year === r.year);
    if (p) return p.value;
    // 시계열이 아닌 표(시도 라벨 시리즈 등)의 전국 합계는 latest에 있다
    const latest = i.latest as { year: number; value: number } | null;
    return latest && latest.year === r.year ? latest.value : undefined;
  }
  return undefined;
}

describe('인용 구조 (EV1·EV6)', () => {
  it('meta: 갱신일 형식, 문장 규칙, 출처 줄 형식이 적혀 있다', () => {
    expect(FILE.meta.updatedOn).toMatch(DATE);
    expect(FILE.meta.rules).toContain('합쇼체');
    expect(FILE.meta.rules).toContain('100자');
    expect(FILE.meta.sourceLineFormat).toBe('{org}({year}), {title}');
  });

  it('인용이 30개 이상이고 통계(stat)와 연구(research)가 모두 있다(현재 102개 = 통계 84 + 연구 18 — r4 QI13이 5세 기록 카드용 연구 c-102를 더했고 경제학 논문 c-037은 연결 없이 남겼다)', () => {
    expect(CITES.length).toBeGreaterThanOrEqual(30);
    expect(CITES).toHaveLength(102);
    expect(CITES.filter((c) => c.kind === 'stat')).toHaveLength(84);
    expect(CITES.filter((c) => c.kind === 'research')).toHaveLength(18);
    expect(CITES.filter((c) => c.kind === 'stat').length).toBeGreaterThanOrEqual(20);
    expect(CITES.filter((c) => c.kind === 'research').length).toBeGreaterThanOrEqual(5);
    for (const c of CITES) expect(['stat', 'research'], c.id).toContain(c.kind);
  });

  it('id는 유일하고 c-숫자 형식이며, 필수 필드(text·source·basisId·eras·refs·usedBy·verified·usable·accessedOn)가 있고 후보 기록 candidateEvents는 없다(M7b)', () => {
    expect(new Set(CITES.map((c) => c.id)).size).toBe(CITES.length);
    for (const c of CITES) {
      expect(c.id).toMatch(/^c-\d{3}$/);
      expect(c.text.length, c.id).toBeGreaterThan(10);
      expect(c.source.org.length, c.id).toBeGreaterThan(1);
      expect(c.source.title.length, c.id).toBeGreaterThan(3);
      expect(Number.isInteger(c.source.year) && c.source.year >= 1990 && c.source.year <= 2027, `${c.id} 발행 연도`).toBe(true);
      expect(c.basisId, c.id).toMatch(/^s-\d{3}$/);
      expect(Array.isArray(c.eras) && c.eras.length > 0, c.id).toBe(true);
      expect(Array.isArray(c.refs), c.id).toBe(true);
      expect(Array.isArray(c.usedBy), c.id).toBe(true);
      expect(c.candidateEvents, `${c.id} candidateEvents는 M7b에서 없어졌다`).toBeUndefined();
      expect(c.accessedOn, c.id).toMatch(DATE);
      expect(typeof c.verified, c.id).toBe('boolean');
      expect(c.usable, c.id).toBe(c.verified);
    }
  });

  it('문장 규칙: 100자 이하, 합쇼체로 끝남(괄호 설명 앞의 마지막 서술어가 「~니다」), 느낌표·물음표·이모지 없음', () => {
    for (const c of CITES) {
      expect(c.text.length, `${c.id} ${c.text.length}자`).toBeLessThanOrEqual(100);
      const core = c.text.replace(/\([^)]*\)/g, '').replace(/\s+/g, '');
      expect(core, `${c.id} 합쇼체 종결`).toMatch(/니다\.$/);
      expect(c.text, c.id).not.toMatch(/[!?！？]/);
      expect(c.text, c.id).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('자살·자해 낱말은 인용 문장·출처 제목·메모 어디에도 없다 (게임 안 모든 글에 금지, C10) — 통계 자체는 koreaStats의 자살률 슬라이드만', () => {
    for (const c of CITES) expect(JSON.stringify([c.text, c.source.title, c.note ?? '']), c.id).not.toMatch(/자살|자해|극단적 선택|스스로 목숨/);
    expect(CITES.filter((c) => c.basisId === 's-005')).toHaveLength(0);
  });

  it('출처 줄(EV6): 기관(발행 연도), 제목 형식으로 만들 수 있고 외부 링크 텍스트가 https', () => {
    for (const c of CITES) {
      const line = `${c.source.org}(${c.source.year}), ${c.source.title}`;
      expect(line.length, c.id).toBeGreaterThan(10);
      if (c.source.url !== undefined) expect(c.source.url, c.id).toMatch(/^https:\/\/[^\s"<>]+$/);
    }
  });

  it('기관 명칭: 「통계청」이 나오면 「현 국가데이터처」가 같이 있다', () => {
    for (const c of CITES) if (c.source.org.includes('통계청')) expect(c.source.org, c.id).toContain('현 국가데이터처');
  });

  it('basisId가 events-stats-basis.md의 행이다', () => {
    for (const c of CITES) expect(basisDoc, `${c.id} ${c.basisId}`).toMatch(new RegExp(`### ${c.basisId} `));
  });
});

describe('연구 인용 서지 (MD3: 확인한 것만)', () => {
  const research = CITES.filter((c) => c.kind === 'research');

  it('연구 인용마다 PubMed 번호·DOI·공식 페이지 URL 중 하나 이상이 있고 PubMed 번호는 숫자, DOI는 10.으로 시작', () => {
    for (const c of research) {
      expect(c.source.pmid !== undefined || c.source.doi !== undefined || c.source.url !== undefined, c.id).toBe(true);
      if (c.source.pmid !== undefined) expect(c.source.pmid, c.id).toMatch(/^\d{6,9}$/);
      if (c.source.doi !== undefined) expect(c.source.doi, c.id).toMatch(/^10\.\d{4,9}\/\S+$/);
      expect(c.verified, c.id).toBe(true);
      expect(c.note ?? '', c.id).not.toBe('');
    }
  });

  it('대표 예시가 서지와 함께 들어 있다: Volling 2012(22289107), Teti 1996(8625729), WHO MGRS 2006(16817682), Shonkoff & Garner 2012(22201156), Heckman 2006(16809525), Felitti 1998(9635069)', () => {
    const pm = research.map((c) => c.source.pmid);
    for (const id of ['22289107', '8625729', '16817682', '22201156', '16809525', '9635069']) expect(pm, id).toContain(id);
    expect(research.find((c) => c.source.pmid === '22289107')!.source).toMatchObject({ year: 2012, doi: '10.1037/a0026921' });
  });

  it('질병관리청 예방접종·영유아 검진 안내와 WHO 5세 미만 신체활동 권고는 공식 페이지 URL로 인용한다', () => {
    const kdca = research.filter((c) => c.source.org === '질병관리청');
    expect(kdca.length).toBeGreaterThanOrEqual(3);
    for (const c of kdca) expect(c.source.url, c.id).toMatch(/^https:\/\/(nip|health)\.kdca\.go\.kr\//);
    expect(research.find((c) => c.source.org === '세계보건기구(WHO)')!.source.url).toContain('who.int');
  });

  it('확인하지 못한 문헌(애착 도서·메타분석 정정 가능성·검진 개월 구간·한국아동패널)은 unverifiedCandidates에만 있고 인용문으로 쓰이지 않는다', () => {
    const u = FILE.unverifiedCandidates;
    expect(u.length).toBeGreaterThanOrEqual(5);
    expect(new Set(u.map((x) => x.id)).size).toBe(u.length);
    for (const x of u) {
      expect(x.id).toMatch(/^u-\d{3}$/);
      expect(x.usable, x.id).toBe(false);
      expect(x.reason.length, x.id).toBeGreaterThan(15);
      expect(x.basisId).toMatch(/^s-\d{3}$/);
    }
    const titles = u.map((x) => x.title).join('\n');
    for (const kw of ['Ainsworth', 'Bowlby', 'Madigan', '한국아동패널']) expect(titles, kw).toContain(kw);
    const citedText = CITES.map((c) => `${c.text} ${c.source.title} ${c.source.org}`).join('\n');
    expect(citedText).not.toContain('Ainsworth');
    expect(citedText).not.toContain('Bowlby');
    expect(citedText).not.toContain('Madigan');
  });
});

describe('통계 인용의 수치 대조 (koreaStats.json과 refs)', () => {
  const stats = CITES.filter((c) => c.kind === 'stat');

  it('통계 인용의 시대(eras): 장래인구추계·기후 전망은 future만(다가올 세상 전용), 1970~89년 공식 시계열은 past만(지난 세상 전용), 나머지 현재 통계는 present이고 다가올 세상 카드에 쓰이는 것은 future를 함께 가진다 — 그때 머리말 「지금 기준으로는」이 있다 (M-2, M7b)', () => {
    for (const c of stats) {
      if (c.basisId === 's-054' || c.basisId === 's-071') expect(c.eras, c.id).toEqual(['future']);
      else if (PAST_STAT_IDS.includes(c.id)) expect(c.eras, c.id).toEqual(['past']);
      else {
        expect(c.eras[0], c.id).toBe('present');
        expect(c.eras.length <= 2, c.id).toBe(true);
        if (c.eras.includes('future')) expect(c.eraPrefix?.future, `${c.id} 다가올 세상 머리말`).toBe('지금 기준으로는');
        else expect(c.eras, c.id).toEqual(['present']);
      }
    }
    expect(stats.filter((c) => c.eras.length === 1 && c.eras[0] === 'future')).toHaveLength(3); // 장래인구추계 2건(c-051·c-052) + 기후 전망 1건(c-067)
    expect(stats.filter((c) => c.eras.includes('past'))).toHaveLength(15); // 기존 7건 + 진학률 2건·취업자 1건(P-01a·P-01b·P-02) + 짧은 변형 3건(S-6) + 1980년 값만 쓰는 변형 2건(c-100·c-101, R-396)
    // 지금 통계를 다가올 세상에 쓰는 것이 허용돼 있다(M-2): 전용 3건 말고도 present+future 통계가 있다
    expect(stats.filter((c) => c.eras.includes('present') && c.eras.includes('future')).length).toBeGreaterThanOrEqual(20);
  });

  it('refs가 있는 통계 인용은 모두 koreaStats.json에서 같은 값으로 찾아진다 (5가지 참조 형식)', () => {
    let checked = 0;
    for (const c of stats) {
      for (const r of c.refs) {
        const v = resolve(r);
        expect(v, `${c.id} ${JSON.stringify(r)} 참조를 찾을 수 없음`).not.toBeUndefined();
        expect(v, `${c.id} ${JSON.stringify(r)}`).toBe(r.value);
        expect(ind(r.indicator).usable, `${c.id} → ${r.indicator}는 확인된 지표여야 한다`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(30);
  });

  it('통계 인용마다 값 참조가 하나 이상 있다 (참조 없는 숫자 문장 금지)', () => {
    for (const c of stats) expect(c.refs.length, c.id).toBeGreaterThan(0);
  });

  it('통계 인용 문장에 나오는 숫자가 참조 값과 모순되지 않는다: 합계출산율 0.80·출생아 수 25만 4천 3백 명, 기대수명 83.7', () => {
    const c1 = CITES.find((c) => c.refs.some((r) => r.indicator === 'births' && r.year === 2025))!;
    expect(c1.text).toContain('0.80');
    expect(c1.text).toContain('25만 4천 3백 명');
    expect(c1.refs.find((r) => r.indicator === 'births')!.value).toBe(254341);
    const life = CITES.find((c) => c.refs.some((r) => r.indicator === 'life-expectancy'))!;
    expect(life.text).toContain('83.7');
    expect(life.text).toContain('86.6');
  });

  it('통계 인용은 확인된(usable) 지표만 참조하고, 미확인 지표(결혼 비용·양육비·가계신용 등)를 참조하는 인용은 없다', () => {
    const unusable = new Set(INDS.filter((i) => !i.usable).map((i) => i.id));
    for (const c of CITES) for (const r of c.refs) expect(unusable.has(r.indicator), `${c.id} → ${r.indicator}`).toBe(false);
    for (const c of CITES) expect(c.text, c.id).not.toMatch(/결혼 비용|양육비|가계신용/);
  });

  it('통계 인용 기관: 발표 기관 이름이 국가데이터처 출범(2025-10-01) 전후로 맞게 쓰여 있다(2025년 9월까지 발표 자료는 통계청(현 국가데이터처))', () => {
    for (const c of stats) {
      if (c.source.org === '국가데이터처') expect(c.source.year, c.id).toBeGreaterThanOrEqual(2025);
      if (c.source.org.startsWith('통계청')) expect(c.source.year, c.id).toBeLessThanOrEqual(2025);
    }
  });
});

describe('이벤트 연결 (usedBy — 이벤트 JSON의 citation 역색인, M7b)', () => {
  it('usedBy의 이벤트 id는 모두 실제 이벤트 풀(src/data/events)에 있는 선택지 이벤트다 — 단 기록 카드(note-…, src/data/notes.json, M7c)는 기록 카드 목록에 있는 카드다', () => {
    for (const c of CITES) {
      for (const id of c.usedBy) {
        if (id.startsWith('note-')) {
          expect(NOTE_CARDS.some((n) => n.id === id), `${c.id} usedBy ${id}는 기록 카드 목록에 없다`).toBe(true);
          continue;
        }
        expect(EVENT_IDS.has(id), `${c.id} usedBy ${id}`).toBe(true);
        expect(EVENT_POOL.byId.get(id)!.choices, `${c.id} usedBy ${id}는 선택지 이벤트(중대 결정 카드)다`).toBeDefined();
      }
    }
  });

  it('M7b: usedBy는 이벤트가 실제로 인용하는 카드 목록이다 — 비어 있지 않은 인용이 30개 이상이고, 연결을 가진 인용의 usedBy가 역색인과 같다 (자세한 양방향 대조는 tests/citationLink.test.ts)', () => {
    // 서로 다른 인용 ≥ 30은 중대 결정 카드(이벤트) 기준이다 — 기록 카드의 인용(c-102)은 MD2 판정에 넣지 않는다(M7c NC-9)
    expect(CITES.filter((c) => c.usedBy.some((id) => !id.startsWith('note-'))).length).toBeGreaterThanOrEqual(30);
    const index = usedByIndex(EVENT_POOL.events, NOTE_CARDS);
    for (const c of CITES) expect(c.usedBy, c.id).toEqual(index[c.id] ?? []);
  });

  it('연결된 카드와 인용의 단계가 어긋나지 않는다: 영유아 연구는 영유아 이벤트에, 학창 통계는 학창 이벤트에만 붙는다', () => {
    const stageOf = (id: string) => EVENT_POOL.events.find((e) => e.id === id)!.stages;
    for (const c of CITES) {
      if (c.basisId === 's-039') for (const id of c.usedBy) expect(stageOf(id), `${c.id} ${id}`).toContain('infant');
      if (c.basisId === 's-011') for (const id of c.usedBy) expect(stageOf(id), `${c.id} ${id}`).toContain('school');
    }
  });
});

// =====================================================================================================
// 검수 1회차(REV-003-M6a-1) 반영 — M6a-r2
// =====================================================================================================

const SIDO17 = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

/** 「25만 4천 3백 명」「3억 1,685만 원」「0.80명」 같은 수치 토큰을 숫자로 */
function parseKoreanNumber(token: string): number {
  const t = token.replace(/,/g, '');
  const mult: Record<string, number> = { 억: 1e8, 만: 1e4, 천: 1e3, 백: 100 };
  const re = /(\d+(?:\.\d+)?)\s*(억|만|천|백)?/g;
  let total = 0;
  let found = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    found = true;
    total += Number(m[1]) * (m[2] ? mult[m[2]] : 1);
  }
  return found ? total : Number.NaN;
}
/** 토큰의 소수 자릿수(반올림 허용 폭 계산용) */
const tokenDecimals = (token: string): number => {
  const m = /\d+\.(\d+)/.exec(token.replace(/,/g, ''));
  return m ? m[1].length : 0;
};
const refYear = (r: Ref): number | undefined => {
  if (r.year !== undefined) return r.year;
  const ry = r.row?.year;
  if (typeof ry === 'number') return ry;
  const latest = ind(r.indicator).latest as { year: number } | null;
  return latest?.year;
};
const refValues = (c: Citation): number[] =>
  c.refs.map((r) => {
    const v = resolve(r);
    if (v === undefined) throw new Error(`${c.id} 참조 없음`);
    return v;
  });
/** 문장에서 사실 토큰을 하나씩 지우고 남은 글 */
const afterRemovingFacts = (c: Citation): string => {
  let rest = c.text;
  for (const f of c.facts ?? []) {
    const at = rest.indexOf(f.token);
    if (at < 0) throw new Error(`${c.id} 문장에 없는 토큰: ${f.token}`);
    rest = rest.slice(0, at) + '§' + rest.slice(at + f.token.length);
  }
  return rest;
};

describe('문장 속 모든 수치 토큰 ↔ refs·파생값·원문 서술 매핑 (R-144)', () => {
  it('모든 인용에 facts가 있고(수치가 없는 연구 문장은 빈 목록), 문장에서 facts 토큰을 모두 지우면 숫자가 하나도 남지 않는다', () => {
    for (const c of CITES) {
      expect(Array.isArray(c.facts), `${c.id} facts`).toBe(true);
      const rest = afterRemovingFacts(c);
      expect(rest, `${c.id} 매핑되지 않은 수치가 남음: ${rest}`).not.toMatch(/\d/);
    }
    expect(CITES.flatMap((c) => c.facts ?? []).length).toBeGreaterThan(150);
  });

  it('kind ref: 토큰 값이 refs[a] 값 × scale과 같다(반올림 표기는 round 또는 토큰 소수 자릿수 안에서)', () => {
    let n = 0;
    for (const c of CITES) {
      const vals = refValues(c);
      for (const f of (c.facts ?? []).filter((x) => x.kind === 'ref')) {
        expect(f.a !== undefined && f.a >= 0 && f.a < vals.length, `${c.id} ${f.token} ref 번호`).toBe(true);
        const expected = vals[f.a!] * (f.scale ?? 1);
        const parsed = parseKoreanNumber(f.token);
        const tol = f.round !== undefined ? f.round / 2 : 0.5 * 10 ** -tokenDecimals(f.token) * (tokenDecimals(f.token) > 0 ? 1 : 0);
        expect(Math.abs(parsed - expected), `${c.id} 「${f.token}」(${parsed}) vs refs[${f.a}]×${f.scale ?? 1}=${expected}`).toBeLessThanOrEqual(tol + 1e-9);
        n++;
      }
    }
    expect(n).toBeGreaterThanOrEqual(90);
  });

  it('kind derived: 차(diff)·비율(pct)·곱(times)·1 뺀 값(minus1)·정수 배(ratioFloor)가 refs에서 다시 계산한 값과 같다', () => {
    let n = 0;
    for (const c of CITES) {
      const vals = refValues(c);
      for (const f of (c.facts ?? []).filter((x) => x.kind === 'derived')) {
        const a = vals[f.a!];
        const b = f.b === undefined ? undefined : vals[f.b];
        let expected: number;
        if (f.op === 'diff') expected = a - b!;
        else if (f.op === 'pct') expected = (a / b!) * 100;
        else if (f.op === 'times') expected = a * f.factor!;
        else if (f.op === 'minus1') expected = a - 1;
        else if (f.op === 'ratioFloor') expected = Math.floor(a / b!);
        else throw new Error(`${c.id} 알 수 없는 op ${f.op}`);
        const parsed = parseKoreanNumber(f.token);
        const tol = tokenDecimals(f.token) > 0 ? 0.5 * 10 ** -tokenDecimals(f.token) : 0;
        expect(Math.abs(parsed - expected), `${c.id} 「${f.token}」 ${f.op}`).toBeLessThanOrEqual(tol + 1e-9);
        n++;
      }
    }
    expect(n).toBeGreaterThanOrEqual(5);
  });

  it('kind year: 연도 토큰이 참조 값의 연도(없으면 지표의 기준 연도)와 같다', () => {
    let n = 0;
    for (const c of CITES) {
      for (const f of (c.facts ?? []).filter((x) => x.kind === 'year')) {
        const y = refYear(c.refs[f.a!]);
        expect(Number.parseInt(f.token, 10), `${c.id} ${f.token}`).toBe(y);
        n++;
      }
    }
    expect(n).toBeGreaterThanOrEqual(55);
  });

  it('kind label·count: 토큰이 참조한 지표·행의 글자에 있고, 개수 토큰(17개 시도)이 지표의 실제 개수와 같다', () => {
    for (const c of CITES) {
      for (const f of (c.facts ?? []).filter((x) => x.kind === 'label')) {
        const r = c.refs[f.a!];
        const i = ind(r.indicator) as Ind & { title?: string; seriesLabel?: string; latestLabel?: string };
        const hay = [i.title, i.seriesLabel, i.latestLabel, ...(i.extraSeries ?? []).map((e) => (e as { label?: string }).label), JSON.stringify(r)].join('\n');
        expect(hay, `${c.id} ${f.token}`).toContain(f.token);
      }
      for (const f of (c.facts ?? []).filter((x) => x.kind === 'count')) {
        const rows = ind(f.indicator!).rows as Array<{ label: string }>;
        const n = rows.filter((x) => SIDO17.includes(x.label)).length;
        expect(Number.parseInt(f.token, 10), `${c.id} ${f.token}`).toBe(n);
      }
    }
  });

  it('kind source(원문 서술·정의 상수): 근거(evidence)를 적었고, 통계 인용에서 쓰는 source는 기준 시점·단위·분위 정의 같은 상수뿐이다', () => {
    for (const c of CITES) {
      for (const f of (c.facts ?? []).filter((x) => x.kind === 'source')) {
        expect((f.evidence ?? '').length, `${c.id} ${f.token} 근거`).toBeGreaterThanOrEqual(6);
        if (c.kind === 'stat') expect(f.token, `${c.id}`).toMatch(/^(\d{4}년|\d+월말?|\d+(대|%|~\d+분위|분위)|상위 20%|하위 20%|1천 명당|2\.5kg|209시간|1차|1인당|1인|2~5분위)$/);
      }
    }
  });

  it('refs가 가리키는 지표는 usable이고 접근자로 돌려받을 수 있다(미확인 지표·하위 항목 참조 금지)', () => {
    // 인용이 가리키는 지표는 근거 수집용(research) 지표라 첫 화면 묶음 밖(예비)에 있다 — 예비까지 합친 접근자로 본다(SPEC-005 QI4 2단계)
    const full = createStatsAccess(statsJson);
    for (const c of CITES) for (const r of c.refs) expect(full.getUsableIndicator(r.indicator), `${c.id} → ${r.indicator}`).toBeDefined();
  });

  it('서술 단언: 「가장」「처음」「늘었」「줄었」「커졌」「올랐」「낮았」「넘었」이 있는 문장에는 assertions가 있고 데이터로 다시 확인된다', () => {
    // 「가장 오래 근무한(일한) 일자리」는 조사 항목 이름이지 순위 서술이 아니다 — 그 표현만 단언 대상에서 뺀다
    const claimWords = /가장(?! 오래 (?:일한|근무한))|처음|늘었|줄었|커졌|올랐|낮았|넘었/;
    let n = 0;
    for (const c of CITES) {
      // 통계 인용의 변화·순위 서술만 데이터로 확인한다(연구 문장의 「줄었다」는 논문 초록의 서술이라 refs가 없다)
      if (c.kind === 'stat' && claimWords.test(c.text)) expect((c.assertions ?? []).length,`${c.id} 단언 필요: ${c.text}`).toBeGreaterThan(0);
      const vals = c.refs.map((r) => resolve(r)!);
      for (const a of c.assertions ?? []) {
        expect(c.text, `${c.id} 단언 문구가 문장에 있어야 함`).toContain(a.claim.replace(/를 넘었습니다$/, '').split(' ')[0]);
        if (a.type === 'less') expect(vals[a.a!], `${c.id} ${a.claim}`).toBeLessThan(vals[a.b!]);
        else if (a.type === 'positive') expect(vals[a.a!], `${c.id} ${a.claim}`).toBeGreaterThan(0);
        else if (a.type === 'ratioAbove') expect(vals[a.a!] / vals[a.b!], `${c.id} ${a.claim}`).toBeGreaterThan(a.min!);
        else if (a.type === 'extreme') {
          const i = ind(a.indicator!);
          if (a.among === 'sido') {
            const rows = (i.rows as Array<Record<string, unknown>>).filter((r) => SIDO17.includes(String(r.label)));
            expect(rows).toHaveLength(17);
            const best = rows.reduce((p, q) => (a.which === 'min' ? (Number(q[a.field!]) < Number(p[a.field!]) ? q : p) : Number(q[a.field!]) > Number(p[a.field!]) ? q : p));
            expect(best.label, `${c.id} ${a.claim}`).toBe(a.expect);
          } else {
            const s = (i.series ?? []).filter((p) => p.year !== undefined);
            const best = s.reduce((p, q) => (a.which === 'min' ? (q.value < p.value ? q : p) : q.value > p.value ? q : p));
            expect(best.year, `${c.id} ${a.claim}`).toBe(a.expect);
          }
        } else if (a.type === 'firstAbove') {
          const s = ind(a.indicator!).series ?? [];
          const first = s.find((p) => p.value > a.threshold!);
          expect(first?.year, `${c.id} ${a.claim}`).toBe(a.expectYear);
          expect(s.filter((p) => p.year! < a.expectYear!).every((p) => p.value <= a.threshold!), `${c.id} 이전에는 넘지 않음`).toBe(true);
        } else if (a.type === 'lifecycle') {
          const rows = ind('lifecycle-account').rows as Array<{ ageLabel: string; consumption: number; laborIncome: number }>;
          const maxC = rows.reduce((p, q) => (q.consumption > p.consumption ? q : p));
          const maxL = rows.reduce((p, q) => (q.laborIncome > p.laborIncome ? q : p));
          expect(maxC.ageLabel).toBe('16세');
          expect(maxL.ageLabel).toBe('45세');
          const surplusAges = rows.filter((r) => r.laborIncome > r.consumption).map((r) => Number.parseInt(r.ageLabel, 10));
          expect([Math.min(...surplusAges), Math.max(...surplusAges)]).toEqual([28, 60]);
        }
        n++;
      }
    }
    expect(n).toBeGreaterThanOrEqual(12);
  });

  it('검수가 지적한 문장의 숫자가 모두 맞는다: c-006·c-013·c-017·c-022·c-023의 값·서술', () => {
    const t = (id: string) => CITES.find((c) => c.id === id)!;
    expect(t('c-006').text).toContain('45만 8천 원'); // 45.8만 원 ref가 추가됨
    expect(t('c-006').refs.map((r) => resolve(r))).toEqual([75.7, 45.8]);
    expect(t('c-013').refs.map((r) => resolve(r))).toEqual([33.85, 31.62]); // 남자·여자 두 값 모두 참조
    expect(t('c-017').facts!.map((f) => f.token)).toContain('215만 6,880원'); // C02 ⑨: 다른 인용(「45만 8천 원」) 꼴로 맞춤(수치 불변)
    expect(10320 * 209).toBe(2156880);
    // c-022: 서울 자가 비율이 17개 시도 가운데 가장 낮다
    const own = (ind('housing-tenure').rows as Array<{ label: string; own: number }>).filter((r) => SIDO17.includes(r.label));
    expect(own).toHaveLength(17);
    expect(own.reduce((p, q) => (q.own < p.own ? q : p)).label).toBe('서울');
    // c-023: 66세 이상 빈곤율 37.7%는 18~65세 10.3%의 3배를 넘는다
    expect(37.7 / 10.3).toBeGreaterThan(3);
  });
});

describe('정정된 문장 (R-140·R-141·R-143·R-153·R-154)', () => {
  const t = (id: string) => CITES.find((c) => c.id === id)!;

  it('c-048 육아휴직: 분모가 「육아휴직 대상인 부모」이고 아이가 태어난 해 안의 사용이다 — 「출생아 부모 가운데」 표현이 없다(R-140)', () => {
    const c = t('c-048');
    expect(c.text).toContain('육아휴직 대상인 사람');
    expect(c.text).toContain('그해');
    expect(c.text).not.toContain('출생아 부모 가운데');
    expect(c.text).toContain('잠정');
    expect(c.note).toContain('승인번호 101092');
    expect(c.note).toContain('군인');
  });

  it('c-033 Teti 1996: 표본 연령 범위를 바로잡았다 — 24개월 미만과 2~5세를 함께 비교하고 「2~5세 첫째 … 24개월 미만은」 모순 문장이 없다(R-141)', () => {
    const c = t('c-033');
    expect(c.text).toContain('24개월 미만');
    expect(c.text).toContain('2~5세');
    expect(c.text).not.toContain('2~5세 첫째 아이는');
    expect(c.note).toContain('모순');
    expect(c.note).toContain('PubMed');
    expect(c.source.pmid).toBe('8625729');
  });

  it('c-032 Volling 2012: 애정 표현이 줄어든 주체는 「첫째가 어머니에게 보이는」이고 PubMed 정오표 표시를 note에 적었다', () => {
    const c = t('c-032');
    expect(c.text).toContain('첫째가 어머니에게 보이는');
    expect(c.note).toContain('정오표');
    expect(c.note).toContain('2014;140(2):465');
    expect(c.source.pmid).toBe('22289107');
  });

  it('c-016: 부채 없는 가구를 포함한 평균을 부채 가구 평균처럼 쓰지 않고 「부채가 있는 가구의 중앙값」을 쓴다(R-143)', () => {
    const c = t('c-016');
    expect(c.text).toContain('중앙값');
    expect(c.text).not.toContain('평균 부채');
    expect(c.refs.map((r) => (r as { field?: string }).field)).toEqual(['debtHoldingPct', 'debtMedian']);
    expect(c.note).toContain('보유가구 중앙값');
  });

  it('c-042: 원문 범주(학력수준이 낮고 육체직에 종사하는 부모)를 그대로 담담하게 쓰고 「직업 계층」으로 넓히지 않는다(R-143)', () => {
    const c = t('c-042');
    expect(c.text).toContain('육체직');
    expect(c.text).toContain('학력이 낮고');
    expect(c.text).not.toMatch(/직업 계층|하층|낙인/);
    expect(c.note).toContain('「고학력, 비육체직에 종사하는 부모로부터 태어난 신생아에 비해');
    expect(c.usageCaution!.forbiddenCardTypes).toContain('stigma');
  });

  it('c-024: 인구주택총조사 기준임을 밝혀 주민등록 기준(2024년 말에 이미 20%)과 혼동하지 않는다(R-154)', () => {
    const c = t('c-024');
    expect(c.text).toContain('인구주택총조사 기준');
    expect(c.text).toContain('이 조사에서 처음');
    expect(c.note).toContain('주민등록');
  });

  it('c-030: 예상 은퇴 연령과 실제 은퇴 연령을 같은 사람의 기대와 현실로 읽히지 않게 「이미 은퇴한 가구주」를 밝힌다', () => {
    expect(t('c-030').text).toContain('이미 은퇴한 가구주');
    expect(t('c-030').text).not.toMatch(/예상.*(보다|와 달리|어긋)/);
  });

  it('c-044: 조혼인율 증감 건수(0.4건 — 표 반올림 값과 0.3건 차이)를 문장에 쓰지 않는다', () => {
    const c = t('c-044');
    expect(c.text).not.toContain('0.4건');
    expect(c.text).toContain('8.1%');
    expect(c.note).toContain('0.3건');
  });

  it('c-018: 기대수명은 「그해 생명표로 본 출생 시 기대수명」이라고 쓴다(2024년에 태어난 아이의 수명 예측이 아님)', () => {
    expect(t('c-018').text).toContain('생명표로 본 출생 시 기대수명');
  });

  it('yearKind: accessed 인용(c-039와 M7b 준비의 갱신 연도 없는 기관 안내 페이지)은 source.year가 열람 연도이고 출처 줄은 「년 열람」 형식이다(R-153)', () => {
    const accessed = CITES.filter((x) => x.source.yearKind === 'accessed').map((x) => x.id);
    // 갱신 연도가 화면에 없는 페이지: 예방접종도우미(c-039)·이웃사이센터(c-066)·국가건강정보포털(c-068~c-070)·국가기록원 해설(c-071~c-073)
    expect(accessed).toEqual(['c-039', 'c-066', 'c-068', 'c-069', 'c-070', 'c-071', 'c-072', 'c-073']);
    for (const c of CITES.filter((x) => accessed.includes(x.id))) expect(c.source.year, c.id).toBe(Number(c.accessedOn.slice(0, 4)));
    expect(FILE.meta.sourceLineFormatAccessed).toBe('{org}({year}년 열람), {title}');
  });

  it('u-003 미확인 문헌의 대체 인용 번호가 맞다: 화면 시간은 WHO 지침(c-035)이지 c-034(걸음마)가 아니다(R-153)', () => {
    const u = FILE.unverifiedCandidates.find((x) => x.id === 'u-003')!;
    expect(u.reason).toContain('c-035');
    expect(u.reason).not.toContain('c-034');
    expect(CITES.find((c) => c.id === 'c-035')!.source.org).toBe('세계보건기구(WHO)');
  });

  it('c-038 ACE 연구: 저자 8명을 모두 적었고(이전 「17명」은 화면 중복 표시를 센 오류) 메모에 응답 9,508명(70.5%)이 있다', () => {
    const c = t('c-038');
    const authors = c.source.org.split(/,\s*&?\s*/).filter((x) => /[A-Z]\./.test(x));
    expect(authors.length).toBe(8);
    expect(c.source.org).toContain('Marks, J. S.');
    expect(c.note).toContain('저자 8명');
    expect(c.note).not.toContain('저자 17명');
    expect(c.note).toContain('9,508명(70.5%)');
  });

  it('기관 명칭: 「국가통계연구원」이 나오면 현 명칭(국가데이터연구원)을 병기한다', () => {
    for (const c of CITES) if (c.source.org.includes('국가통계연구원')) expect(c.source.org, c.id).toContain('현 국가데이터연구원');
    expect(basisDoc).not.toMatch(/국가데이터처\(국가통계연구원\)(?!,)/);
  });
});

describe('지난 세상 인용과 시대 규칙 (R-150, 마스터 결정 2026-10-15)', () => {
  it('지난 세상 통계 인용 15건: 합계출산율·출생아·기대수명·조사망률·혼인·이혼·1인 가구(7건) + 진학률·연령별 취업자(3건) + 짧은 변형(3건) + 1980년 값만 쓰는 진학률 변형(2건), 모든 참조 연도가 1970~1989이고 문장에 달력 연도가 있다', () => {
    const past = CITES.filter((c) => c.eras.includes('past') && c.kind === 'stat');
    expect(past.map((c) => c.id)).toEqual(PAST_STAT_IDS);
    expect(new Set(past.map((c) => c.basisId))).toEqual(new Set(['s-001', 's-002', 's-007', 's-003', 's-058', 's-028', 's-008', 's-090', 's-091']));
    for (const c of past) {
      for (const r of c.refs) {
        const y = refYear(r)!;
        expect(y >= 1970 && y <= 1989, `${c.id} 참조 연도 ${y}`).toBe(true);
      }
      expect(c.text, c.id).toMatch(/19[78]\d년/);
      expect(c.eras, c.id).toEqual(['past']);
    }
  });

  it('지난 세상에 쓸 수 있는 연구는 시대와 무관한 발달 연구 5건(동생 출생 적응·애착·걸음마 창, M7c의 이른 시기 환경 c-037, r4 QI13의 가장 이른 기억 나이 c-102 — 「지금의 연구로는」 머리말 eraPrefix)과 지난 세상 제도 시기 해설 3건(국가기록원, eras가 past뿐·eraPrefix 없음)이다', () => {
    const research = CITES.filter((c) => c.kind === 'research');
    const withPast = research.filter((c) => c.eras.includes('past'));
    expect(withPast.map((c) => c.id)).toEqual(['c-032', 'c-033', 'c-034', 'c-037', 'c-071', 'c-072', 'c-073', 'c-102']);
    // 발달 연구(eraPrefix.past 「지금의 연구로는」)는 위 다섯, 제도 시기 해설(public-guidance, past 전용)은 c-071~c-073 — 번호 순이 아니라 성격으로 가른다(c-102는 번호가 뒤지만 발달 연구다)
    for (const c of withPast.filter((x) => x.eras.length > 1)) {
      expect(c.eraPrefix?.past, c.id).toBe('지금의 연구로는');
      expect(['study', 'review', 'reference-study'], c.id).toContain(c.evidenceType);
    }
    for (const c of withPast.filter((x) => x.eras.length === 1)) {
      expect(c.eras, c.id).toEqual(['past']);
      expect(c.evidenceType, c.id).toBe('public-guidance');
      expect(c.eraPrefix, c.id).toBeUndefined();
    }
    // 과거 머리말은 위의 인용뿐이다. 지금과 다가올 세상을 함께 가진 연구는 다가올 세상 머리말만 가진다(M-2)
    for (const c of research.filter((x) => !x.eras.includes('past'))) {
      expect(c.eraPrefix?.past, c.id).toBeUndefined();
      expect(c.eraPrefix?.future, c.id).toBe(c.eras.includes('present') && c.eras.includes('future') ? '지금 기준으로는' : undefined);
    }
  });

  it('인용 박스는 달력 연도 금지의 예외: 규칙(meta.rules)에 적혀 있고 통계 인용 대부분의 문장·출처에 연도가 있다 — 사건 본문·연표의 금지는 그대로', () => {
    expect(FILE.meta.rules).toContain('달력 연도');
    expect(FILE.meta.rules).toContain('예외');
    expect(FILE.meta.rules).toContain('사건 본문');
    const withYear = CITES.filter((c) => c.kind === 'stat' && /\d{4}(년|학년도)/.test(c.text));
    expect(withYear.length).toBeGreaterThanOrEqual(40);
    // 인용 문장은 사건 본문이 아니다: 어느 이벤트의 제목·본문·선택지·결과도 인용 문장을 그대로 쓰지 않는다(사건 글에 통계 문장이 섞이지 않는다)
    const eventTexts = EVENT_POOL.events.flatMap((e) => [e.title, e.text, ...(e.choices ?? []).flatMap((ch) => [ch.label, ch.result])]);
    for (const c of CITES) for (const t of eventTexts) expect(t.includes(c.text), `${c.id}`).toBe(false);
  });

  it('지금·다가올 세상 카드용 인용이 지난 세상 전용 인용보다 훨씬 많다(MD2 ≥70%는 지금·다가올 세상 카드 기준)', () => {
    const nowFuture = CITES.filter((c) => c.eras.includes('present') || c.eras.includes('future')).length;
    const pastOnly = CITES.filter((c) => c.eras.length === 1 && c.eras[0] === 'past').length;
    expect(nowFuture).toBeGreaterThanOrEqual(CITES.length - pastOnly);
    expect(pastOnly).toBe(18); // 지난 세상 전용 통계 15건 + 국가기록원 해설 3건
  });
});

describe('인용별 사용 주의 usageCaution (R-151)', () => {
  const TYPES = ['parent-blame', 'determinism', 'abuse-adjacent', 'self-blame', 'stigma', 'medical-advice', 'comparison-ranking'];
  const research = CITES.filter((c) => c.kind === 'research');

  it('연구 인용 18건 모두 evidenceType과 usageCaution(붙일 수 없는 카드 유형·이벤트, 주의 메모)이 있다', () => {
    expect(research).toHaveLength(18);
    for (const c of research) {
      expect(['study', 'review', 'reference-study', 'report', 'guideline', 'public-guidance'], c.id).toContain(c.evidenceType);
      const u = c.usageCaution!;
      expect(u, c.id).toBeDefined();
      expect(u.forbiddenCardTypes.length, c.id).toBeGreaterThan(0);
      for (const ty of u.forbiddenCardTypes) expect(TYPES, `${c.id} ${ty}`).toContain(ty);
      expect(Array.isArray(u.forbiddenEvents), c.id).toBe(true);
      expect(u.note.length, c.id).toBeGreaterThanOrEqual(20);
    }
  });

  it('연구 문장(study·review·reference-study·report)에는 「개인차」 또는 「연관」 표현이 있고 framing에 적은 표현이 문장에 실제로 있다', () => {
    const hedged = research.filter((c) => ['study', 'review', 'reference-study', 'report'].includes(c.evidenceType ?? ''));
    expect(hedged.map((c) => c.id)).toEqual(['c-032', 'c-033', 'c-034', 'c-036', 'c-037', 'c-038', 'c-042', 'c-102']);
    for (const c of hedged) {
      expect(c.text, c.id).toMatch(/개인차|연관/);
      for (const w of c.usageCaution!.framing ?? []) expect(c.text, `${c.id} ${w}`).toContain(w);
      expect(c.usageCaution!.framing?.length, `${c.id} framing 선언`).toBeGreaterThan(0);
    }
  });

  it('단정·결정론·부모 탓 표현이 연구 문장에 없다: 반드시·결정된다·좌우·무조건·틀림없이·잘못', () => {
    for (const c of CITES) expect(c.text, c.id).not.toMatch(/반드시|결정된다|결정됩니다|좌우|무조건|틀림없이|잘못|탓/);
  });

  it('forbiddenEvents에 적은 이벤트는 실제 이벤트이고 그 인용의 usedBy에 없다 — 부모 행동 사건(infant-neglect-night)에 붙일 때는 구조적 맥락 통계(c-048)의 주의 메모를 따른다', () => {
    for (const c of CITES) {
      for (const id of c.usageCaution?.forbiddenEvents ?? []) {
        expect(EVENT_IDS.has(id), `${c.id} forbiddenEvents ${id}`).toBe(true);
        expect(c.usedBy, c.id).not.toContain(id);
      }
    }
    const c036 = CITES.find((c) => c.id === 'c-036')!;
    expect(c036.usageCaution!.forbiddenEvents).toEqual(['infant-neglect-night']);
    expect(c036.usageCaution!.forbiddenCardTypes).toEqual(expect.arrayContaining(['parent-blame', 'abuse-adjacent']));
    // c-036이 막은 사건에 붙는 인용은 없다(서술 사건은 M7b의 카드 인용 대상이 아니다). 붙인다면 c-048 한 건이고 부모 개인이 아니라 일과 돌봄의 구조를 말해야 한다
    expect(CITES.filter((c) => c.usedBy.includes('infant-neglect-night'))).toEqual([]);
    expect(CITES.find((c) => c.id === 'c-048')!.usageCaution!.note).toContain('방치·소홀 사건에 붙일 때는 부모 개인이 아니라 일과 돌봄의 구조');
    // c-037(Heckman)·c-038(ACE)은 결정론·부모 탓으로 읽히지 않게 막았다
    expect(CITES.find((c) => c.id === 'c-037')!.usageCaution!.forbiddenCardTypes).toContain('determinism');
    // r4 QI13: 5세 카드의 새 인용 c-102(평균 나이)는 결정론·자책·견줌으로 읽히지 않게 막았다 — 평균을 「정상」 기준으로 쓰지 않는다(dc15-memory-research.md 4절)
    expect(CITES.find((c) => c.id === 'c-102')!.usageCaution!.forbiddenCardTypes).toEqual(expect.arrayContaining(['determinism', 'self-blame', 'comparison-ranking']));
    expect(CITES.find((c) => c.id === 'c-102')!.usageCaution!.framing).toEqual(['개인차']);
    expect(CITES.find((c) => c.id === 'c-038')!.usageCaution!.forbiddenCardTypes).toEqual(expect.arrayContaining(['abuse-adjacent', 'parent-blame', 'determinism']));
  });

  it('민감한 통계(이혼·소득·빈곤·계층 이동·육아휴직·학교폭력)에도 usageCaution이 있다', () => {
    for (const id of ['c-014', 'c-016', 'c-018', 'c-019', 'c-023', 'c-030', 'c-045', 'c-046', 'c-048', 'c-049', 'c-050', 'c-055', 'c-058']) {
      const c = CITES.find((x) => x.id === id)!;
      expect(c.usageCaution, id).toBeDefined();
      expect(c.usageCaution!.note.length, id).toBeGreaterThanOrEqual(20);
    }
  });
});
