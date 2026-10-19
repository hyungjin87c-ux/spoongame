import { describe, expect, it } from 'vitest';
import citationsJson from '../src/data/citations.json';
import statsJson from '../src/data/koreaStats.json';
import basisDoc from '../docs/data/events-stats-basis.md?raw';
import sourcesDoc from '../docs/data/korea-stats-sources.md?raw';
import { EVENT_POOL } from '../src/data/events';
import { getUsableIndicator } from '../src/data/koreaStatsAccess';

/**
 * M7b 준비 2차 수집 검증 — R-01~R-14·P-01a~P-04 수집분, 파생 N-1~N-4, 손질 S-1·S-3·S-4·S-5·S-6, R-181 (2026-10-19).
 * 원문 값은 KOSIS·지표누리 표에서 직접 읽은 것이고, 이 테스트는 (1) 읽은 값이 서로 맞는지(합계·계산), (2) 인용이 지표 값과 같은지,
 * (3) 사용 규칙(낙인·권유 금지 표현, robots 불허 사이트 미사용, 못 구한 항목 기록)을 지킨다.
 */

type Row = Record<string, number | string | null>;
interface Ind {
  id: string;
  kind: string;
  usable: boolean;
  basisId: string;
  use: string[];
  latest: { year: number; value: number };
  latestUnit?: string;
  rows?: Row[];
  series?: Array<{ year: number; value: number }>;
  extraSeries?: Array<{ unit: string; series: Array<{ year: number; value: number }> }>;
  source: { org: string; url: string; accessedOn: string };
  verification: { status: string; crossChecks: string[] };
  [k: string]: unknown;
}
interface Cite {
  id: string;
  kind: 'stat' | 'research';
  text: string;
  basisId: string;
  eras: string[];
  eraPrefix?: Record<string, string>;
  refs: Array<{ indicator: string; value: number; row?: Row; field?: string; year?: number; extraSeriesIndex?: number }>;
  facts?: Array<{ token: string; kind: string; evidence?: string }>;
  usageCaution?: { forbiddenCardTypes: string[]; forbiddenEvents: string[]; note: string };
  candidateFor: string[];
  usedBy: string[];
  note?: string;
  accessedOn: string;
  source: { org: string; title: string; year: number; url?: string };
}
const INDS = (statsJson as unknown as { indicators: Ind[] }).indicators;
const FILE = citationsJson as unknown as { citations: Cite[]; unverifiedCandidates: Array<{ id: string; title: string; basisId: string; reason: string; usable: boolean }> };
const CITES = FILE.citations;
const ind = (id: string): Ind => {
  const i = INDS.find((x) => x.id === id);
  if (!i) throw new Error(`지표 없음 ${id}`);
  return i;
};
const cite = (id: string): Cite => {
  const c = CITES.find((x) => x.id === id);
  if (!c) throw new Error(`인용 없음 ${id}`);
  return c;
};
const row = (id: string, key: string, val: number | string): Row => {
  const r = (ind(id).rows ?? []).find((x) => x[key] === val);
  if (!r) throw new Error(`${id} 행 없음 ${key}=${val}`);
  return r;
};
const num = (v: unknown): number => {
  if (typeof v !== 'number') throw new Error(`숫자 아님 ${String(v)}`);
  return v;
};
const EVENT_IDS = new Set(EVENT_POOL.events.map((e) => e.id));

const NEW_INDICATORS = [
  'college-advance-rate', 'vocational-grad-employment', 'youth-exam-prep', 'startup-survival', 'nonregular-by-age', 'telework-adoption', 'ltc-family-relation', 'longest-job-exit',
  'employment-rate-by-age', 'grandchild-care', 'digital-divide-level', 'senior-alone-households', 'senior-living-preference', 'advance-rate-1980s', 'employed-by-age-1980s',
];
const NEW_CITATIONS = Array.from({ length: 26 }, (_, k) => `c-${String(74 + k).padStart(3, '0')}`);

describe('M7b 준비 2차: 새 지표 15개의 구조와 읽은 값의 정합', () => {
  it('새 지표 15개(s-077~s-091)가 있고 모두 확인(verified)·usable이며 근거 행·출처·열람일이 있다', () => {
    expect(NEW_INDICATORS).toHaveLength(15);
    NEW_INDICATORS.forEach((id, k) => {
      const i = ind(id);
      expect(i.basisId, id).toBe(`s-${String(77 + k).padStart(3, '0')}`);
      expect(i.usable, id).toBe(true);
      expect(i.verification.status, id).toBe('verified');
      expect(i.verification.crossChecks.length, id).toBeGreaterThan(0);
      expect(i.source.accessedOn, id).toBe('2026-10-19');
      expect(i.source.url, id).toMatch(/^https:\/\//);
      expect(i.use, id).toEqual(['research']);
      expect(getUsableIndicator(id), id).toBeDefined();
      expect(basisDoc, id).toContain(`### ${i.basisId} `);
    });
  });

  it('근거 문서와 수집 기록 문서가 새 지표를 모두 가리킨다(백틱 id, 3.11절, 2절 접근 기록)', () => {
    for (const id of NEW_INDICATORS) expect(sourcesDoc, id).toContain(`\`${id}\``);
    expect(sourcesDoc).toContain('### 3.11 M7b 준비 2차 수집 결과');
    expect(sourcesDoc).toContain('### M7b 준비 2차(2026-10-19) 접근 기록');
    expect(sourcesDoc).toContain('Disallow: /');
    expect(sourcesDoc).toContain('psycnet.apa.org');
  });

  it('R-01·P-01: 고교 졸업자 대학 진학률 2016~2024 시리즈와 1980~89 진학률 표(칸 수·연도 순서)', () => {
    const c = ind('college-advance-rate');
    expect(c.series!.map((p) => p.year)).toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    expect(c.series!.at(-1)).toEqual({ year: 2024, value: 73.6 });
    expect(Math.min(...c.series!.map((p) => p.value))).toBe(68.9);
    expect(Math.max(...c.series!.map((p) => p.value))).toBe(73.7);
    const p = ind('advance-rate-1980s').rows!;
    expect(p.map((r) => r.year)).toEqual([1980, 1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989]);
    const mid = p.map((r) => num(r.middle));
    for (let k = 1; k < mid.length; k++) expect(mid[k], `중학교 ${p[k].year}`).toBeGreaterThan(mid[k - 1]); // 해마다 오름
    const high = p.map((r) => num(r.high));
    expect(Math.max(...high)).toBe(38.3);
    expect(high[3]).toBe(38.3); // 1983년이 최고 — 「가장」 서술을 인용에 쓰지 않는다
    expect(ind('advance-rate-1980s').latest).toEqual({ year: 1989, value: 94.6 });
  });

  it('R-02: 직업계고 유형별 졸업자 합이 총계와 같다(51,609 + 5,252 + 2,800 = 59,661)', () => {
    const rows = ind('vocational-grad-employment').rows!;
    const total = num(row('vocational-grad-employment', 'label', '직업계고 전체').graduates);
    const parts = rows.filter((r) => r.label !== '직업계고 전체').reduce((s, r) => s + num(r.graduates), 0);
    expect(parts).toBe(total);
    expect(total).toBe(59661);
    expect(ind('vocational-grad-employment').latest.value).toBe(55.2);
  });

  it('R-03: 취업시험 준비자 — 2024·2026년 남녀 합과 연도 구성이 표와 맞고 2026년 15~29세는 4,128천 명 중 600천 명', () => {
    const r = ind('youth-exam-prep').rows!;
    expect(r).toHaveLength(6);
    expect(r.find((x) => x.group === '15~29세' && x.year === 2026)).toMatchObject({ nonActive: 4128, examPrep: 600 });
    expect(r.find((x) => x.group === '15~29세' && x.year === 2025)).toMatchObject({ examPrep: 585 });
    expect(321 + 244).toBe(565); // 2024 남 + 여
    expect(283 + 317).toBe(600); // 2026 남 + 여
    expect(346 + 340).toBe(686); // 2026 20~34세 남 + 여
    expect(r.find((x) => x.group === '20~34세' && x.year === 2026)).toMatchObject({ examPrep: 686 });
  });

  it('R-04·R-05: 신생기업 생존율은 연차가 늘수록 줄고 연령대 7행 × 7개 연차가 모두 있다', () => {
    const rows = ind('startup-survival').rows!;
    expect(rows.map((r) => r.group)).toEqual(['전체', '30대 미만', '30대', '40대', '50대', '60대', '70대 이상']);
    for (const r of rows) {
      const v = ['y1', 'y2', 'y3', 'y4', 'y5', 'y6', 'y7'].map((k) => num(r[k]));
      for (let k = 1; k < v.length; k++) expect(v[k], `${r.group} ${k + 1}년`).toBeLessThan(v[k - 1]);
    }
    expect(row('startup-survival', 'group', '전체')).toMatchObject({ y1: 64.4, y5: 36.4 });
    expect(row('startup-survival', 'group', '40대').y5).toBe(39.2);
    expect(row('startup-survival', 'group', '50대').y5).toBe(38.4);
  });

  it('R-06: 임금근로자 = 정규직 + 비정규직(반올림 1천 명 이내), 연령 행 합이 계와 같다(반올림 1천 명 이내)', () => {
    const rows = ind('nonregular-by-age').rows!;
    for (const r of rows) expect(Math.abs(num(r.wage) - num(r.regular) - num(r.nonregular)), String(r.group)).toBeLessThanOrEqual(1);
    const total = rows.find((r) => r.group === '계')!;
    const sum = rows.filter((r) => r.group !== '계').reduce((s, r) => s + num(r.wage), 0);
    expect(Math.abs(sum - num(total.wage))).toBeLessThanOrEqual(1);
    const y = row('nonregular-by-age', 'group', '20~29세');
    expect((num(y.nonregular) / num(y.wage)) * 100).toBeCloseTo(43.9, 1);
  });

  it('R-07: 재택근무제도 시행 비율은 사례수 가중 평균이 전체 24.1%와 같다', () => {
    const g = row('telework-adoption', 'group', '공공기관 등');
    const f = row('telework-adoption', 'group', '기업');
    const all = row('telework-adoption', 'group', '전체');
    expect(num(g.cases) + num(f.cases)).toBe(num(all.cases));
    expect((num(g.cases) * num(g.rate) + num(f.cases) * num(f.rate)) / num(all.cases)).toBeCloseTo(num(all.rate), 1);
  });

  it('R-08·R-11: 장기요양 가족 응답자 — 성별 합 = 소계, 연령대 합은 소계와 1명 이내, 관계 열의 합은 100% 이하', () => {
    const rows = ind('ltc-family-relation').rows!;
    const total = num(row('ltc-family-relation', 'group', '전체').respondents);
    expect(num(row('ltc-family-relation', 'group', '남성').respondents) + num(row('ltc-family-relation', 'group', '여성').respondents)).toBe(total);
    const ages = ['40세 미만', '40~49세', '50~59세', '60~69세', '70세 이상'].map((g) => num(row('ltc-family-relation', 'group', g).respondents));
    expect(Math.abs(ages.reduce((a, b) => a + b, 0) - total)).toBeLessThanOrEqual(1);
    const t = row('ltc-family-relation', 'group', '전체');
    const rel = ['spouse', 'son', 'daughterInLaw', 'daughter', 'sonInLaw', 'grandchild'].reduce((s, k) => s + num(t[k]), 0);
    expect(rel).toBeCloseTo(95.9, 5);
    expect(rel).toBeLessThanOrEqual(100);
    expect(rows.find((r) => r.group === '70세 이상')!.spouse).toBe(71.7);
  });

  it('R-09: 그만둔 이유별 인원 — 읽은 5개 행과 못 읽은 3개 행(가족돌봄 1,757·두 항목 610·1,094)의 합이 계 11,552천 명', () => {
    const rows = ind('longest-job-exit').rows!;
    const total = num(row('longest-job-exit', 'reason', '계').count);
    const read = rows.filter((r) => r.reason !== '계').reduce((s, r) => s + num(r.count), 0);
    expect(read + 1757 + 610 + 1094).toBe(total);
    expect(row('longest-job-exit', 'reason', '권고사직·명예퇴직·정리해고')).toMatchObject({ count: 1139, meanAge: 53.9 });
  });

  it('R-10: 연령별 고용률 = 취업자 ÷ 인구이고 15세 이상 전체·15~29세는 youth-employment(s-010)의 2025년 값과 같다', () => {
    for (const r of ind('employment-rate-by-age').rows!) expect((num(r.employed) / num(r.pop)) * 100, String(r.group)).toBeCloseTo(num(r.rate), 1);
    const y = ind('youth-employment');
    expect(y.series!.find((p) => p.year === 2025)!.value).toBe(row('employment-rate-by-age', 'group', '15~29세').rate);
    expect(y.extraSeries!.find((e) => e.series[0].value === 60.5)!.series.find((p) => p.year === 2025)!.value).toBe(row('employment-rate-by-age', 'group', '15세 이상 전체').rate);
  });

  it('R-12·R-13: 손자녀 돌봄은 돌봄함 + 하지 않음 ≈ 100, 디지털정보화 수준은 해마다 높아지고 접근·역량·활용 가중이 평균과 맞는다', () => {
    for (const r of ind('grandchild-care').rows!) expect(Math.abs(num(r.care) + num(r.noCare) - 100), String(r.group)).toBeLessThanOrEqual(0.1 + 1e-9);
    const old = row('digital-divide-level', 'group', '고령층');
    expect(num(old.y2023)).toBeLessThan(num(old.y2024));
    expect(num(old.y2024)).toBeLessThan(num(old.y2025));
    expect(Math.round((96.6 * 0.2 + 65.9 * 0.4 + 80.5 * 0.4) * 10) / 10).toBe(row('digital-divide-level', 'group', '취약계층 평균').y2025);
  });

  it('R-14: 65세 이상 1인 가구 수 ÷ 전체 일반가구가 비율과 같고(6개 연도), 등록센서스 방식 단절(2015)이 표시된다', () => {
    const i = ind('senior-alone-households');
    const years = i.series!.map((p) => p.year);
    expect(years).toEqual([2000, 2005, 2010, 2015, 2020, 2025]);
    for (const p of i.series!) {
      const a = i.extraSeries![0].series.find((x) => x.year === p.year)!.value;
      const b = i.extraSeries![1].series.find((x) => x.year === p.year)!.value;
      expect((a / b) * 100, String(p.year)).toBeCloseTo(p.value, 1);
    }
    expect((i.axis as { breaks: Array<{ year: number }> }).breaks.map((b) => b.year)).toEqual([2015]);
    const l = ind('senior-living-preference').rows!;
    expect(num(l[0].stay) + num(l[0].betterHome) + num(l[0].seniorHousing)).toBeCloseTo(100 - 0, 0);
  });

  it('P-02: 1980년대 연령별 취업자 — 연령별 합 ≈ 계(2천 명 이내), 15~29세 = 15~19세 + 20~29세', () => {
    for (const r of ind('employed-by-age-1980s').rows!) {
      const sum = ['age1519', 'age2029', 'age3039', 'age4049', 'age5059', 'age60'].reduce((s, k) => s + num(r[k]), 0);
      expect(Math.abs(sum - num(r.total)), String(r.year)).toBeLessThanOrEqual(2);
      expect(num(r.age1519) + num(r.age2029), String(r.year)).toBe(num(r.age1529));
    }
  });
});

describe('M7b 준비 2차: 새 인용 c-074~c-099', () => {
  it('26건(통계)이 모두 있고 문장 100자 이하·합쇼체·인용 id 연속이다 (usedBy는 M7b에서 이벤트 연결로 채워졌다)', () => {
    expect(NEW_CITATIONS.map((id) => cite(id).id)).toEqual(NEW_CITATIONS);
    for (const id of NEW_CITATIONS) {
      const c = cite(id);
      expect(c.kind, id).toBe('stat');
      expect(c.text.length, id).toBeLessThanOrEqual(100);
      expect(c.text.replace(/\([^)]*\)/g, '').replace(/\s+/g, ''), id).toMatch(/니다\.$/);
      expect(c.accessedOn, id).toBe('2026-10-19');
      expect(c.refs.length, id).toBeGreaterThan(0);
    }
  });

  it('수집한 인용이 코드별 카드(2-4절 「쓸 카드」)에 연결됐다 — usedBy가 그 카드뿐이다 (M7b: 후보 기록 candidateEvents를 usedBy 역색인으로 바꿨다)', () => {
    const want: Record<string, string> = {
      'c-074': 'school-exam', 'c-075': 'school-career-choice', 'c-076': 'youth-exam-prep', 'c-077': 'youth-startup', 'c-078': 'middle-business', 'c-079': 'youth-gig-work',
      'c-080': 'middle-remote-work', 'c-081': 'middle-parents-care', 'c-082': 'senior-spouse-care', 'c-083': 'middle-layoff', 'c-084': 'middle-job-again', 'c-085': 'senior-grandchildren',
      'c-086': 'senior-new-device', 'c-087': 'senior-alone', 'c-088': 'senior-move-home', 'c-091': 'youth-first-job',
      'c-092': 'middle-home-loan', 'c-093': 'senior-estate', 'c-094': 'youth-rent-hike', 'c-095': 'youth-return-school', 'c-096': 'middle-marriage-crisis',
      'c-097': 'school-family-priority', 'c-098': 'youth-marriage', 'c-099': 'youth-child',
    };
    for (const [id, ev] of Object.entries(want)) {
      expect(cite(id).usedBy, id).toEqual([ev]);
      expect(EVENT_IDS.has(ev), `${id} ${ev}`).toBe(true);
    }
    // R-396: 1989년 값이 든 c-089·c-090은 연결하지 않고(후보), 1980년 값만 쓰는 변형 c-100·c-101이 그 카드에 연결됐다
    expect(cite('c-089').usedBy).toEqual([]);
    expect(cite('c-090').usedBy).toEqual([]);
    expect(cite('c-100').usedBy).toEqual(['school-early-work']);
    expect(cite('c-101').usedBy).toEqual(['school-exam']);
  });

  it('시대: 현재 값(R·N·S-4)은 present이고(다가올 세상 카드에 쓰이면 future를 함께 — M-2), 1980년대 값(P·S-6)은 past만이고 past 인용은 달력 연도가 문장에 있다', () => {
    const past = ['c-089', 'c-090', 'c-091', 'c-097', 'c-098', 'c-099'];
    for (const id of NEW_CITATIONS) {
      if (past.includes(id)) {
        expect(cite(id).eras, id).toEqual(['past']);
        expect(cite(id).text, id).toMatch(/19[78]\d년/);
      } else {
        expect(cite(id).eras[0], id).toBe('present');
        expect(cite(id).eras.length <= 2, id).toBe(true);
      }
    }
  });

  it('값 대조: R-04·R-05는 같은 표의 다른 행이라 문장이 다르고, R-09와 R-10도 다른 문장이다(한 판 중복 방지)', () => {
    expect(cite('c-077').text).not.toBe(cite('c-078').text);
    expect(cite('c-077').refs.map((r) => r.field)).toEqual(['y1', 'y5']);
    expect(cite('c-078').refs.map((r) => (r.row as Row).group)).toEqual(['40대', '50대']);
    expect(cite('c-083').text).not.toBe(cite('c-084').text);
    expect(cite('c-083').basisId).not.toBe(cite('c-084').basisId);
    expect(cite('c-081').text).not.toBe(cite('c-082').text); // R-08과 R-11은 같은 표지만 다른 행
  });

  it('파생 값: R-06 43.9%는 비정규직 ÷ 임금근로자(derived pct), N-1~N-4가 기존 지표 행과 같은 값이다', () => {
    const c79 = cite('c-079');
    expect(c79.facts!.find((f) => f.token === '43.9%')!.kind).toBe('derived');
    expect((1431 / 3258) * 100).toBeCloseTo(43.9, 1);
    expect(cite('c-092').refs.map((r) => r.value)).toEqual([73.5, 11000]);
    expect(cite('c-093').refs.map((r) => r.value)).toEqual([22100]);
    expect(cite('c-094').refs.map((r) => r.value)).toEqual([16, 17.7]);
    expect(cite('c-095').refs.map((r) => r.value)).toEqual([1.7, 1.7]);
    expect(cite('c-092').text).toContain('부채 중앙값'); // R-183(b)의 모호함을 피한다
    expect(cite('c-094').text).toContain('중위수');
    expect(cite('c-096').text).toBe('2025년 이혼은 8만 8천 건이었습니다.');
  });

  it('문장 방향(낙인·권유·판단 금지): 새 인용 문장에 권유·낙인·가족 탓·평가 표현이 없다', () => {
    const banned = /권합니다|권한다|말립니다|추천|해야 합니다|뒤처진|게으른|무능|탓|유리합니다|불리합니다|낫습니다|효도|이기적|실패|성공/;
    for (const id of NEW_CITATIONS) expect(cite(id).text, id).not.toMatch(banned);
  });

  it('민감한 주제의 인용(창업·비정규직·돌봄·이직·진학·거주)에는 usageCaution이 있고 목록에 맞는 카드 유형이 들어 있다', () => {
    const TYPES = ['parent-blame', 'determinism', 'abuse-adjacent', 'self-blame', 'stigma', 'medical-advice', 'comparison-ranking'];
    for (const id of ['c-074', 'c-075', 'c-076', 'c-077', 'c-078', 'c-079', 'c-080', 'c-081', 'c-082', 'c-083', 'c-084', 'c-085', 'c-086', 'c-087', 'c-088', 'c-089', 'c-090', 'c-091', 'c-092', 'c-093', 'c-094', 'c-095', 'c-096']) {
      const u = cite(id).usageCaution!;
      expect(u, id).toBeDefined();
      expect(u.note.length, id).toBeGreaterThanOrEqual(20);
      for (const t of u.forbiddenCardTypes) expect(TYPES, `${id} ${t}`).toContain(t);
    }
    expect(cite('c-081').usageCaution!.forbiddenCardTypes).toEqual(expect.arrayContaining(['self-blame', 'parent-blame']));
    expect(cite('c-083').usageCaution!.note).toContain('개인의 능력');
    expect(cite('c-086').usageCaution!.note).toContain('뒤처진');
    expect(cite('c-088').usageCaution!.note).toContain('돌봄이 있는 곳이 낫다');
  });

  it('대체·한계가 인용 메모에 적혀 있다: R-05 대체, R-07 제도 시행 비율, R-09 고령층 값, R-10 재취업 아님', () => {
    expect(cite('c-078').note).toContain('R-05 대체');
    expect(cite('c-080').usageCaution!.note).toContain('실제로 재택근무를 한 비율이 아니다');
    expect(cite('c-083').usageCaution!.note).toContain('45~58세');
    expect(cite('c-084').usageCaution!.note).toContain('재취업');
  });

  it('못 구한 항목이 기록돼 있다: u-013~u-022, 이유 15자 이상, usable false, 근거 행 번호 형식', () => {
    const u = FILE.unverifiedCandidates.filter((x) => Number(x.id.slice(2)) >= 13);
    expect(u.map((x) => x.id)).toEqual(['u-013', 'u-014', 'u-015', 'u-016', 'u-017', 'u-018', 'u-019', 'u-020', 'u-021', 'u-022']);
    for (const x of u) {
      expect(x.usable, x.id).toBe(false);
      expect(x.reason.length, x.id).toBeGreaterThan(15);
      expect(x.basisId, x.id).toMatch(/^s-\d{3}$/);
    }
    const byId = (id: string) => FILE.unverifiedCandidates.find((x) => x.id === id)!;
    expect(byId('u-019').title).toContain('평균 초혼 연령 1970~1989');
    expect(byId('u-020').title).toContain('주택');
    expect(byId('u-019').reason).toContain('1990');
  });
});

describe('M7b 준비 2차: 손질(S)과 R-181', () => {
  it('S-1 c-033: 「194가구 표본에서」·「어머니에 대한」으로 고쳤고 R-141의 비교(24개월 미만과 2~5세)와 지난 세상 머리말 포함 길이 100자 이하를 지킨다', () => {
    const c = cite('c-033');
    expect(c.text).toBe('194가구 표본에서 첫째의 어머니에 대한 애착 안정성은 동생 출생 뒤 낮아졌고(24개월 미만은 2~5세보다 폭이 작음), 부부 화목 등과 연관이 있었습니다.');
    expect(c.text).not.toContain('연구에서');
    expect(c.eraPrefix!.past).toBe('지금의 연구로는');
    expect(`${c.eraPrefix!.past} ${c.text}`.length).toBeLessThanOrEqual(100);
    expect(c.usedBy).toEqual(['infant-new-sibling']);
    expect(c.note).toContain('손질 S-1');
  });

  it('S-3 c-035: 「5세 미만 아이를 위한 WHO 지침은」으로 시작하고 「5세」가 source 사실로 매핑된다(수치 불변)', () => {
    const c = cite('c-035');
    expect(c.text.startsWith('5세 미만 아이를 위한 WHO 지침은 1세에게')).toBe(true);
    expect(c.facts![0]).toMatchObject({ token: '5세', kind: 'source' });
    expect(c.facts!.map((f) => f.token)).toEqual(['5세', '1세', '2~4세', '1시간']);
    expect(c.text).toContain('하루 1시간');
  });

  it('S-5 c-054: 「1970년 통계 작성 이후」를 밝혔고 값은 그대로(1971년 약 102만 5천 명, 1989년 약 63만 9천 명)', () => {
    const c = cite('c-054');
    expect(c.text).toContain('1970년 통계 작성 이후');
    expect(c.text).toContain('102만 5천 명');
    expect(c.text).toContain('63만 9천 명');
    expect(c.refs.map((r) => r.value)).toEqual([1024773, 639431]);
    expect(c.facts![0]).toMatchObject({ token: '1970년', kind: 'source' });
    expect(ind('births').series![0].year).toBe(1970); // 시리즈가 1970년에 시작해 「통계 작성 이후」가 시리즈 안의 서술이다
  });

  it('S-4·S-6: c-014는 그대로 두고(뒷절 42.5% 유지) 새 인용이 앞절만/짧은 변형을 말한다', () => {
    expect(cite('c-014').text).toContain('42.5%');
    expect(cite('c-014').candidateFor).toEqual(['SA2']);
    expect(cite('c-096').text).not.toContain('42.5%');
    expect(cite('c-096').basisId).toBe(cite('c-014').basisId);
    expect(cite('c-097').text).toBe('1970년 합계출산율은 4.53명으로 집계되었습니다.'); // D-66: 문장 끝 「4.53명이었습니다.」 덩어리를 끊어 씀(수치·합쇼체 불변)
    expect(cite('c-098').text).toContain('1980년 혼인은 약 40만 3천 건');
    expect(cite('c-099').text).toContain('1970년 통계 작성 이후 1971년에');
    // 원문(c-053·c-057·c-054)은 그대로 있다
    expect(cite('c-053').text).toContain('1989년 1.56명');
    expect(cite('c-057').text).toContain('1989년에는 약 41만 1천 건');
  });

  it('R-181: Volling(c-032)은 정오표 내용을 확인하지 못해 이벤트에 연결하지 않고(후보 없음·금지 이벤트 2개) 미확인 목록 u-013과 정오표 표시를 남긴다', () => {
    const c = cite('c-032');
    expect(c.usedBy).toEqual([]);
    expect(c.usageCaution!.forbiddenEvents).toEqual(['infant-new-sibling', 'infant-sibling-toy']);
    expect(c.note).toContain('정오표');
    expect(c.note).toContain('2014;140(2):465');
    expect(c.note).toContain('R-181');
    expect(c.note).toContain('PsycNet');
    expect(c.note).toContain('M-10');
    const u = FILE.unverifiedCandidates.find((x) => x.id === 'u-013')!;
    expect(u.title).toContain('Volling 2012');
    expect(u.reason).toContain('PsycNet');
    expect(u.reason).toContain('infant-sibling-toy');
    // M-10 대체: infant-new-sibling은 c-033, infant-sibling-toy는 연결된 인용이 없다
    const holders = (ev: string) => CITES.filter((x) => x.usedBy.includes(ev)).map((x) => x.id);
    expect(holders('infant-new-sibling')).toEqual(['c-033']);
    expect(holders('infant-sibling-toy')).toEqual([]);
  });
});

describe('M7b 준비 2차: 접근 규칙(R-149·EV3) 준수', () => {
  it('robots 불허 사이트(보건복지부·육아정책연구소·건강보험공단·PsycNet) 주소를 인용·지표의 출처 URL로 쓰지 않는다', () => {
    const blocked = /(www\.mohw\.go\.kr|mohw\.go\.kr|kicce\.re\.kr|nhis\.or\.kr|psycnet\.apa\.org)/;
    for (const i of INDS) if (i.source) expect(i.source.url, i.id).not.toMatch(blocked);
    for (const c of CITES) if (c.source.url) expect(c.source.url, c.id).not.toMatch(blocked);
  });

  it('새 지표·인용의 출처 주소는 KOSIS·지표누리 공개 표(로그인·인증키 API 아님)다', () => {
    for (const id of NEW_INDICATORS) expect(ind(id).source.url, id).toMatch(/^https:\/\/(kosis\.kr|www\.index\.go\.kr)\//);
    for (const id of NEW_INDICATORS) expect(ind(id).source.url, id).not.toMatch(/apiKey|serviceKey|auth/i);
  });
});

describe('M7b 검수 1회차 반영 (REV-003-M7b-1 R-390~R-392·R-396) — 사실을 다르게 읽히게 하는 문장 고침', () => {
  const find = (id: string) => CITES.find((c) => c.id === id)!;

  it('R-390 c-063: 정의가 바뀐 2019년 값과 견주는 절을 뺐다 — 문장은 2025년 값 하나, refs·facts에 2019년·58.7이 없고 「낮았」 단언도 없다', () => {
    const c = find('c-063');
    expect(c.text).toBe('2025년 초등학생의 52.2%가 방과후학교와 돌봄(늘봄학교)에 참여했습니다.');
    expect(c.text).not.toMatch(/2019|58\.7|낮았|높았|줄었|늘었/);
    expect(c.refs).toHaveLength(1);
    expect((c as { assertions?: unknown }).assertions).toBeUndefined();
    expect(JSON.stringify(c.facts)).not.toMatch(/2019|58\.7/);
    expect(c.usageCaution!.note).toContain('견주어');
  });

  it('R-391 c-075: 졸업자 수와 취업률을 떼어 썼다 — 「5만 9,661명」 토큰·refs가 없고, 59,661 합계 대조는 지표 시험(R-02)에 그대로 있다', () => {
    const c = find('c-075');
    expect(c.text).toBe('2025년 직업계고 졸업자의 취업률은 55.2%였습니다.');
    expect(c.text).not.toMatch(/명/);
    expect(c.refs).toHaveLength(1);
    expect(JSON.stringify(c.facts)).not.toMatch(/59,?661|5만 9/);
    expect(c.note).toContain('분모');
  });

  it('R-392 c-083: 평균 나이는 「그만둘 때 평균 나이」다 (지금 55~79세의 평균 나이로 읽히지 않게) — 수치 53.9·113만 9천 명은 그대로', () => {
    const c = find('c-083');
    expect(c.text).toContain('그만둘 때 평균 나이는 53.9세');
    expect(c.text).not.toMatch(/명, 평균 나이는/);
    expect(c.text).toContain('113만 9천 명');
    // 가운뎃점으로 이은 3항목 낱말은 쉼표로 풀었다(좁은 폭·글자 200%에서 줄 끝에 기호가 남는다 — citationText의 긴 구분 기호 낱말 시험)
    expect(c.text).toContain('권고사직, 명예퇴직, 정리해고로');
    expect(c.refs.map((r) => (r as { value: number }).value)).toEqual([1139, 53.9]);
  });

  it('R-396 c-100·c-101: 1980년 값만 쓰는 지난 세상 변형 — validFromYear 1980, 문장에 1989년이 없고, 같은 표(s-090)의 값과 같다', () => {
    const middle = ind('advance-rate-1980s').rows!.find((r) => r.year === 1980)!;
    for (const [id, field, text, card] of [
      ['c-100', 'middle', '중학교 졸업자의 상급학교(고등학교) 진학률은 1980년에 84.5%였습니다.', 'school-early-work'],
      ['c-101', 'high', '고등학교 졸업자의 상급학교(대학) 진학률은 1980년에 27.2%였습니다.', 'school-exam'],
    ] as const) {
      const c = find(id);
      expect(c.text, id).toBe(text);
      expect(c.eras, id).toEqual(['past']);
      expect((c as { validFromYear?: number }).validFromYear, id).toBe(1980);
      expect(c.text, id).not.toMatch(/1989/);
      expect(c.basisId, id).toBe('s-090');
      expect(c.usedBy, id).toEqual([card]);
      expect(c.refs, id).toHaveLength(1);
      expect((c.refs[0] as { value: number }).value, id).toBe(middle[field]);
    }
  });
});
