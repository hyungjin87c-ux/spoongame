import { describe, expect, it } from 'vitest';
import statsJson from '../src/data/koreaStats.json';
import basisDoc from '../docs/data/events-stats-basis.md?raw';
import sourcesDoc from '../docs/data/korea-stats-sources.md?raw';
import { formatHeadlines, formatIndicatorValue, getSeriesGaps, getUsableIndicator, type UsableIndicator } from '../src/data/koreaStatsAccess';

/**
 * 한국 통계 데이터(src/data/koreaStats.json) 검증 — SPEC-003 M6a (SC3·EV1~EV3).
 * 1) 구조: 필수 필드·출처 URL 형식·기준 연도·미확인 값이 게임에 쓰이지 않게 하는 플래그
 * 2) 근거 문서 연결: 모든 basisId가 docs/data/events-stats-basis.md의 행, 모든 지표 id가 docs/data/korea-stats-sources.md에 있음
 * 3) 값 교차 검증: 원문(보도자료·KOSIS 화면)에서 읽은 값이 합계·다른 표·본문 서술과 서로 맞는지
 */

type Rec = Record<string, unknown>;
interface Point {
  year?: number;
  label?: string;
  value: number;
}
interface Indicator {
  id: string;
  title: string;
  unit: string | null;
  kind: 'line' | 'bar' | 'number' | 'table';
  use: string[];
  latest: { year: number; value: number } | null;
  series?: Point[];
  extraSeries?: Array<{ label: string; latest?: { year: number; value: number }; series: Point[] }>;
  rows?: Rec[];
  columns?: Array<{ key: string; label: string }>;
  definition: string;
  basisId: string;
  source: { org: string; table: string; url: string; accessedOn: string } | null;
  verification: { status: 'verified' | 'unverified'; method?: string; crossChecks?: string[]; reason?: string };
  safety: string | null;
  usable: boolean;
  helpLine?: { name: string; number: string; hours: string; source: { url: string; org: string } };
  notes?: string;
  [k: string]: unknown;
}
interface StatsFile {
  meta: Rec & { updatedOn: string; agencyNote: string };
  indicators: Indicator[];
}

const FILE = statsJson as unknown as StatsFile;
const ALL = FILE.indicators;
const USABLE = ALL.filter((i) => i.usable);
const UNVERIFIED = ALL.filter((i) => !i.usable);
const get = (id: string): Indicator => {
  const found = ALL.find((i) => i.id === id);
  if (!found) throw new Error(`지표 없음: ${id}`);
  return found;
};
const rowsOf = (id: string): Rec[] => get(id).rows ?? [];
const seriesOf = (id: string): Point[] => get(id).series ?? [];
const at = (id: string, year: number): number => {
  const p = seriesOf(id).find((x) => x.year === year);
  if (!p) throw new Error(`${id} ${year}년 값 없음`);
  return p.value;
};
const byLabel = (id: string, label: string): number => {
  const p = seriesOf(id).find((x) => x.label === label);
  if (!p) throw new Error(`${id} ${label} 값 없음`);
  return p.value;
};
const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);
const num = (v: unknown): number => {
  if (typeof v !== 'number') throw new Error(`숫자 아님: ${String(v)}`);
  return v;
};
const SIDO = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https:\/\/[^\s"<>]+$/;
const USES = new Set(['carousel', 'roulette', 'birth', 'economy', 'death', 'satire', 'future', 'research']);

describe('구조 검증 (SC3: 필수 필드·출처 형식·기준 연도)', () => {
  it('meta: 갱신일 형식, 기관 명칭 안내(2025-10-01 국가데이터처 출범)·접근 규칙이 있다', () => {
    expect(FILE.meta.updatedOn).toMatch(DATE);
    expect(FILE.meta.agencyNote).toContain('국가데이터처');
    expect(FILE.meta.agencyNote).toContain('2025년 10월 1일');
    expect(FILE.meta.agencyNote).toContain('통계청(현 국가데이터처)');
    expect(String(FILE.meta.accessRule)).toContain('robots.txt');
  });

  it('지표 id는 유일하고 kebab-case이며 지표가 30개 미만으로 줄어들지 않는다(현재 51개)', () => {
    const ids = ALL.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id, id).toMatch(/^[a-z][a-z0-9-]{2,40}$/);
    expect(ALL.length).toBeGreaterThanOrEqual(40);
    expect(ALL).toHaveLength(51);
  });

  it('모든 지표에 필수 필드가 있다: id·title·kind·use·latest(또는 null)·definition(미확인은 빈 문자열 허용)·basisId·verification·usable', () => {
    for (const i of ALL) {
      expect(i.title.length, i.id).toBeGreaterThan(1);
      expect(['line', 'bar', 'number', 'table'], i.id).toContain(i.kind);
      expect(Array.isArray(i.use) && i.use.length > 0, i.id).toBe(true);
      for (const u of i.use) expect(USES.has(u), `${i.id} use ${u}`).toBe(true);
      expect(i.basisId, i.id).toMatch(/^s-\d{3}$/);
      expect(['verified', 'unverified'], i.id).toContain(i.verification.status);
      expect(typeof i.usable, i.id).toBe('boolean');
      expect('latest' in i, i.id).toBe(true);
    }
  });

  it('확인된(usable) 지표: 단위·정의 문장(마침표로 끝, 느낌표 없음)·기준 연도 정수·값 유한수·출처 기관·통계표·https URL·열람일·교차 확인 목록', () => {
    for (const i of USABLE) {
      expect(i.verification.status, i.id).toBe('verified');
      expect(i.unit === null || i.unit.length > 0, i.id).toBe(true);
      expect(i.definition.length, i.id).toBeGreaterThan(10);
      expect(i.definition.trim().endsWith('.'), `${i.id} 정의는 마침표로 끝난다`).toBe(true);
      expect(i.definition, i.id).not.toMatch(/[!！]/);
      expect(i.latest, i.id).not.toBeNull();
      const l = i.latest!;
      expect(Number.isInteger(l.year) && l.year >= 1970 && l.year <= 2072, `${i.id} 기준 연도 ${l.year}`).toBe(true);
      expect(Number.isFinite(l.value), i.id).toBe(true);
      const s = i.source!;
      expect(s, i.id).not.toBeNull();
      expect(s.org.length, i.id).toBeGreaterThan(1);
      expect(s.table.length, i.id).toBeGreaterThan(5);
      expect(s.url, i.id).toMatch(URL_RE);
      expect(s.accessedOn, i.id).toMatch(DATE);
      expect((i.verification.method ?? '').length, i.id).toBeGreaterThan(5);
      expect((i.verification.crossChecks ?? []).length, i.id).toBeGreaterThan(0);
    }
  });

  it('시계열(line·bar)에는 값 유한수와 연도(또는 라벨)가 있고 연도는 오름차순·중복 없음', () => {
    for (const i of USABLE.filter((x) => x.kind === 'line' || x.kind === 'bar')) {
      const s = i.series ?? [];
      expect(s.length, i.id).toBeGreaterThanOrEqual(2);
      for (const p of s) {
        expect(Number.isFinite(p.value), `${i.id} ${p.year ?? p.label}`).toBe(true);
        expect(p.year !== undefined || p.label !== undefined, i.id).toBe(true);
      }
      const years = s.map((p) => p.year).filter((y): y is number => y !== undefined);
      if (years.length === s.length) {
        for (let k = 1; k < years.length; k++) expect(years[k], `${i.id} 연도 오름차순`).toBeGreaterThan(years[k - 1]);
      }
      for (const ex of i.extraSeries ?? []) {
        expect(ex.label.length, i.id).toBeGreaterThan(0);
        for (const p of ex.series) expect(Number.isFinite(p.value), `${i.id}/${ex.label}`).toBe(true);
      }
    }
  });

  it('연도 시계열의 latest는 시계열의 마지막 연도 값과 같다(캐러셀 큰 숫자와 그래프 끝점이 어긋나지 않는다), 보조 시리즈의 latest도 같다', () => {
    let checked = 0;
    for (const i of USABLE.filter((x) => (x.series ?? []).length > 0 && x.series![0].year !== undefined)) {
      const s = i.series!;
      expect(s.at(-1)!.year, `${i.id} 마지막 연도`).toBe(i.latest!.year);
      expect(s.at(-1)!.value, `${i.id} 마지막 값`).toBe(i.latest!.value);
      for (const e of i.extraSeries ?? []) {
        if (e.latest === undefined) continue;
        expect(e.series.find((p) => p.year === e.latest!.year)?.value, `${i.id}/${e.label} latest`).toBe(e.latest.value);
      }
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(15);
  });

  it('표(table)에는 columns와 rows가 있고 행마다 columns의 key가 모두 있다', () => {
    for (const i of USABLE.filter((x) => x.kind === 'table')) {
      expect((i.columns ?? []).length, i.id).toBeGreaterThan(1);
      expect((i.rows ?? []).length, i.id).toBeGreaterThan(1);
      for (const r of i.rows ?? []) for (const c of i.columns ?? []) expect(c.key in r, `${i.id} 행 ${JSON.stringify(r).slice(0, 40)} 열 ${c.key}`).toBe(true);
    }
  });

  it('기관 명칭: 「통계청」이 나오면 「현 국가데이터처」가 같이 있다(2025년 9월까지 발표 자료는 당시 명칭 병기)', () => {
    for (const i of USABLE) {
      const org = i.source!.org;
      if (org.includes('통계청')) expect(org, i.id).toContain('현 국가데이터처');
    }
  });
});

describe('미확인 항목은 게임에 쓰이지 않는다 (usable 플래그)', () => {
  it('usable true ⇔ verification.status가 verified (어긋남 0)', () => {
    for (const i of ALL) expect(i.usable, i.id).toBe(i.verification.status === 'verified');
  });

  it('미확인 항목: usable false, latest null, 값(series·rows) 없음, 사유 있음, 출처 null — 값이 새어 들어가지 않는다', () => {
    expect(UNVERIFIED.map((i) => i.id).sort()).toEqual(['childcare-cost', 'household-credit', 'household-loan-rate', 'income-college-gap', 'korean-children-panel', 'wedding-cost']);
    for (const i of UNVERIFIED) {
      expect(i.latest, i.id).toBeNull();
      expect(i.series ?? [], i.id).toHaveLength(0);
      expect(i.rows, i.id).toBeUndefined();
      expect(i.source, i.id).toBeNull();
      expect((i.verification.reason ?? '').length, `${i.id} 사유`).toBeGreaterThan(20);
    }
  });

  it('미확인 항목의 이유에 접근 원칙(robots 불허·인증키 API 불가·원문 미확인)이 적혀 있다', () => {
    expect(get('wedding-cost').verification.reason).toContain('robots');
    expect(get('korean-children-panel').verification.reason).toContain('인증키');
    expect(get('household-credit').verification.reason).toContain('원문');
  });
});

describe('근거 문서 연결 (SC3: basisId로 근거 행과 연결)', () => {
  it('모든 basisId가 events-stats-basis.md의 행(### s-###)이다', () => {
    for (const i of ALL) expect(basisDoc, `${i.id} ${i.basisId}`).toMatch(new RegExp(`### ${i.basisId} `));
  });

  it('근거 문서에 모든 행이 s-001부터 s-058까지 이어지고 항목(지표·정의·출처·수치·한계·시대 보정·반영 이벤트·반영 방식·상태)이 채워져 있다', () => {
    const blocks = basisDoc.split(/\n### /).slice(1);
    expect(blocks.length).toBeGreaterThanOrEqual(50);
    for (const b of blocks) {
      const head = b.split('\n')[0];
      for (const label of ['지표·정의', '출처', '수치', '한계', '시대 보정(S4)', '반영 이벤트·필드', '반영 방식', '상태']) expect(b, `${head} ${label}`).toContain(`**${label}**:`);
      expect(b, head).toMatch(/\*\*상태\*\*: \*\*(확인|미확인)\*\*/);
    }
    for (let n = 1; n <= 58; n++) expect(basisDoc, `s-${String(n).padStart(3, '0')}`).toContain(`### s-${String(n).padStart(3, '0')} `);
  });

  it('확인된 지표의 출처 URL이 근거 문서에 그대로 적혀 있다', () => {
    for (const i of USABLE) expect(basisDoc, i.id).toContain(i.source!.url);
  });

  it('확인된 지표 id가 수집 기록(korea-stats-sources.md)에 적혀 있다', () => {
    for (const i of ALL) expect(sourcesDoc, i.id).toContain(`\`${i.id}\``);
  });

  it('수집 기록에 제외한 출처(robots.txt 불허)와 우회 금지 원칙이 적혀 있다', () => {
    for (const host of ['www.kca.go.kr', 'www.academyinfo.go.kr', 'www.nhis.or.kr', 'www.kicce.re.kr', 'www.kli.re.kr']) expect(sourcesDoc, host).toContain(host);
    expect(sourcesDoc).toContain('우회 도구(insane-search 포함)');
    expect(sourcesDoc).toContain('국가데이터처 출범');
  });
});

describe('캐러셀 지표 (SC1: 요청의 5개 포함 10개 이상, 모든 값에 기준 연도·출처)', () => {
  const carousel = ALL.filter((i) => i.use.includes('carousel'));

  it('use: carousel이 10개 이상이고 요청의 5개(출생률·사망률·노인빈곤율·자살률·지역별 인구수)를 포함한다', () => {
    expect(carousel.length).toBeGreaterThanOrEqual(10);
    // 지역별 인구수 카드는 2026 주민등록 16개 시·도(마스터 결정 2026-10-15) — 2025 인구주택총조사 17개 시도 지표는 캐러셀에 없다
    for (const id of ['tfr', 'cdr', 'elderly-poverty', 'suicide-rate', 'region-population-registered']) expect(carousel.map((i) => i.id), id).toContain(id);
    expect(carousel.map((i) => i.id)).not.toContain('region-population');
    expect(carousel).toHaveLength(14);
    for (const i of carousel) expect(i.usable, i.id).toBe(true);
  });

  it('캐러셀 슬라이드마다 제목·값+단위·기준 연도·출처(기관·통계표)·그래프 값·한 줄 정의가 있다', () => {
    for (const i of carousel) {
      expect(i.title, i.id).toBeTruthy();
      expect(i.unit, i.id).toBeTruthy();
      expect(i.latest!.year, i.id).toBeGreaterThan(1969);
      expect(i.source!.org && i.source!.table, i.id).toBeTruthy();
      expect((i.series ?? []).length, i.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('지역별 인구는 17개 시도(2025)와 16개 시도(2026.09 주민등록) 두 가지가 있고 각각 합이 전국과 맞는다', () => {
    const p25 = seriesOf('region-population');
    expect(p25.map((p) => p.label)).toEqual(SIDO);
    expect(Math.abs(sum(p25.map((p) => p.value)) - get('region-population').latest!.value), '천 명 반올림 차이').toBeLessThanOrEqual(5);
    const reg = seriesOf('region-population-registered');
    expect(reg).toHaveLength(16);
    expect(reg.map((p) => p.label)).toContain('전남광주통합특별시');
    expect(reg.map((p) => p.label)).not.toContain('광주');
    expect(sum(reg.map((p) => p.value))).toBe(get('region-population-registered').latest!.value);
  });

  it('수도권(서울+인천+경기) 인구가 보도자료 값 26,377천 명(50.9%)과 같다', () => {
    const cap = get('region-population').capitalRegion as { valueThousand: number; sharePct: number; members: string[] };
    expect(cap.members).toEqual(['서울', '인천', '경기']);
    expect(sum(cap.members.map((m) => byLabel('region-population', m)))).toBe(cap.valueThousand);
    expect(Math.round((cap.valueThousand / get('region-population').latest!.value) * 1000) / 10).toBe(cap.sharePct);
  });
});

describe('자살률 슬라이드 안전 규칙 (SC6, C10)', () => {
  it('자살률 지표만 safety가 suicide-help이고 상담전화 109(24시간)와 공식 출처가 같은 항목 안에 있다', () => {
    expect(ALL.filter((i) => i.safety !== null).map((i) => i.id)).toEqual(['suicide-rate']);
    const s = get('suicide-rate');
    expect(s.safety).toBe('suicide-help');
    expect(s.helpLine!.number).toBe('109');
    expect(s.helpLine!.hours).toBe('24시간');
    expect(s.helpLine!.name).toContain('자살예방 상담전화');
    expect(s.helpLine!.source.org).toBe('한국생명존중희망재단');
    expect(s.helpLine!.source.url).toMatch(URL_RE);
  });

  it('자살률은 값·기준 연도·출처를 갖고 열 머리(연도) 확인 결과대로 2015·2017·2019·2021·2023·2024·2025년 값이다', () => {
    const s = get('suicide-rate');
    expect(s.latest).toEqual({ year: 2025, value: 27.8 });
    expect(seriesOf('suicide-rate').map((p) => p.year)).toEqual([2015, 2017, 2019, 2021, 2023, 2024, 2025]);
    expect(seriesOf('suicide-rate').map((p) => p.value)).toEqual([26.5, 24.3, 26.9, 26.0, 27.3, 29.1, 27.8]);
    // 본문 「전년 대비 1.4명(-4.7%) 감소」: 표의 반올림 값끼리 빼면 1.3 — 0.1 차이는 반올림(원자료 기준 계산)
    const diff = at('suicide-rate', 2025) - at('suicide-rate', 2024);
    expect(Math.abs(Math.abs(diff) - 1.4), '본문 1.4명과 표 값 차이').toBeLessThanOrEqual(0.1 + 1e-9);
    expect(diff).toBeLessThan(0);
  });

  it('자살·자해 낱말은 자살률 지표 밖(제목·정의·시리즈 라벨·열 이름·행 값)에 나오지 않는다', () => {
    for (const i of ALL.filter((x) => x.id !== 'suicide-rate' && x.usable)) {
      const visible = JSON.stringify([i.title, i.definition, (i.series ?? []).map((p) => p.label), (i.extraSeries ?? []).map((e) => e.label), (i.columns ?? []).map((c) => c.label), i.rows]);
      expect(visible, i.id).not.toMatch(/자살|자해|극단적 선택/);
    }
    expect(seriesOf('top-causes').map((p) => p.label)).not.toContain('고의적 자해(자살)');
  });
});

describe('값 교차 검증 — 출생 통계 (RL·BR)', () => {
  it('합계출산율·출생아 수 시리즈는 1970~2025 연속이고 2025년 값이 본문(0.80명·254,341명)과 같다', () => {
    for (const id of ['tfr', 'births']) {
      const years = seriesOf(id).map((p) => p.year);
      expect(years[0], id).toBe(1970);
      expect(years.at(-1), id).toBe(2025);
      expect(years, id).toHaveLength(56);
    }
    expect(at('tfr', 2025)).toBe(0.8);
    expect(at('tfr', 2015)).toBe(1.24);
    expect(at('tfr', 2023)).toBe(0.72);
    expect(at('births', 2025)).toBe(254341);
    expect(at('births', 2015)).toBe(438420);
  });

  it('월별 출생아 합계가 연간 출생아 수와 같다(2023·2024·2025)', () => {
    const months = rowsOf('birth-by-month');
    expect(months.map((r) => r.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(sum(months.map((r) => num(r.y2025)))).toBe(at('births', 2025));
    expect(sum(months.map((r) => num(r.y2024)))).toBe(at('births', 2024));
    expect(sum(months.map((r) => num(r.y2023)))).toBe(at('births', 2023));
  });

  it('시도별 출생아: 17개 시도, 합 254,341, 비율 합 100.0(소수 1자리), 비율 = 출생아/전국(±0.1)', () => {
    const rows = rowsOf('birth-by-sido');
    expect(rows.map((r) => r.sido)).toEqual(SIDO);
    const births = rows.map((r) => num(r.births));
    expect(sum(births)).toBe(254341);
    const shares = rows.map((r) => num(r.sharePct));
    expect(Math.round(sum(shares) * 10) / 10).toBe(100);
    shares.forEach((s, k) => {
      expect(Math.abs(s - (births[k] / 254341) * 100), SIDO[k]).toBeLessThanOrEqual(0.1);
      expect(Math.round(s * 10) / 10, SIDO[k]).toBe(s);
    });
    expect(births[SIDO.indexOf('서울')]).toBe(45516);
    expect(births[SIDO.indexOf('경기')]).toBe(76309);
  });

  it('시도별 합계출산율이 본문 서술(전남 1.09·세종 1.06 높고 서울 0.63·부산 0.74 낮음)과 같다', () => {
    const t = seriesOf('tfr-by-sido');
    expect(t.map((p) => p.label)).toEqual(SIDO);
    expect(byLabel('tfr-by-sido', '전남')).toBe(1.09);
    expect(byLabel('tfr-by-sido', '세종')).toBe(1.06);
    expect(byLabel('tfr-by-sido', '서울')).toBe(0.63);
    expect(byLabel('tfr-by-sido', '부산')).toBe(0.74);
    expect(Math.max(...t.map((p) => p.value))).toBe(1.09);
    expect(Math.min(...t.map((p) => p.value))).toBe(0.63);
  });

  describe('시군구별 출생아·합계출산율 (보도자료 통계표 12)', () => {
    const rows = rowsOf('birth-by-sigungu') as Array<{ sido: string; name: string; births: number; tfr: number }>;
    const parents = get('birth-by-sigungu').parentCities as Array<{ sido: string; name: string; births: number; tfr: number }>;
    const sidoBirths = Object.fromEntries(rowsOf('birth-by-sido').map((r) => [String(r.sido), num(r.births)]));

    it('252행(일반구가 있는 12개 시는 구 35행 + 세종 1행)이고 전국 합 254,341, 시도 안 합이 시도 행과 같다', () => {
      expect(rows).toHaveLength(252);
      expect(parents).toHaveLength(12);
      expect(sum(rows.map((r) => r.births))).toBe(254341);
      for (const s of SIDO) expect(sum(rows.filter((r) => r.sido === s).map((r) => r.births)), s).toBe(sidoBirths[s]);
      expect(new Set(rows.map((r) => `${r.sido} ${r.name}`)).size, '시도+이름 중복 없음').toBe(252);
      for (const r of rows) {
        expect(SIDO).toContain(r.sido);
        expect(r.name.length).toBeGreaterThan(1);
        expect(r.births).toBeGreaterThan(0);
        expect(r.tfr).toBeGreaterThan(0.2);
        expect(r.tfr).toBeLessThan(2.1);
      }
    });

    it('일반구의 합이 시 전체 값과 같다(12개 시 전부)', () => {
      for (const p of parents) {
        const gu = rows.filter((r) => r.sido === p.sido && r.name.startsWith(`${p.name} `));
        expect(gu.length, p.name).toBeGreaterThanOrEqual(2);
        expect(sum(gu.map((g) => g.births)), p.name).toBe(p.births);
      }
      expect(rows.filter((r) => parents.some((p) => r.sido === p.sido && r.name.startsWith(`${p.name} `)))).toHaveLength(35);
    });

    it('본문에 적힌 값과 같다: 영광군 420명·1.79, 장성군 261명·1.69, 부산 중구 69명·0.36, 서울 관악구 1,649명·0.43, 화성시 8,012명', () => {
      const f = (sido: string, name: string) => {
        const r = rows.find((x) => x.sido === sido && x.name === name) ?? parents.find((x) => x.sido === sido && x.name === name);
        if (!r) throw new Error(`${sido} ${name} 없음`);
        return r;
      };
      expect(f('전남', '영광군')).toMatchObject({ births: 420, tfr: 1.79 });
      expect(f('전남', '장성군')).toMatchObject({ births: 261, tfr: 1.69 });
      expect(f('부산', '중구')).toMatchObject({ births: 69, tfr: 0.36 });
      expect(f('서울', '관악구')).toMatchObject({ births: 1649, tfr: 0.43 });
      expect(f('경기', '화성시')).toMatchObject({ births: 8012, tfr: 1.09 });
      expect(f('경북', '영양군').births).toBe(24);
    });

    it('228개 시군구(시 단위 12개 포함, 구 35개·세종 제외): 출생아 상위 10곳 합 53,709명(21.1%), 합계출산율 1.0 이상 61~62곳(1.00 반올림 경계)', () => {
      const set228 = [...rows.filter((r) => r.name !== '세종특별자치시' && !parents.some((p) => r.sido === p.sido && r.name.startsWith(`${p.name} `))), ...parents];
      expect(set228).toHaveLength(228);
      const top10 = [...set228].sort((a, b) => b.births - a.births).slice(0, 10);
      expect(sum(top10.map((r) => r.births))).toBe(53709);
      expect(Math.round((sum(top10.map((r) => r.births)) / 254341) * 1000) / 10).toBe(21.1);
      expect(top10.filter((r) => r.sido === '경기')).toHaveLength(7);
      const strictlyAbove = set228.filter((r) => r.tfr > 1.0).length;
      const atOrAbove = set228.filter((r) => r.tfr >= 1.0).length;
      expect(strictlyAbove).toBeLessThanOrEqual(61);
      expect(atOrAbove).toBeGreaterThanOrEqual(61);
      expect(atOrAbove).toBeLessThanOrEqual(62);
    });
  });

  it('출생 체중: 남+여=전체(구간별), 구간 합 = 성별 총계, 2.5kg 미만·4.0kg 이상이 보도자료 [표 18]과 같다', () => {
    const rows = rowsOf('birth-weight') as Array<{ bin: string; male: number; female: number; all: number }>;
    expect(rows).toHaveLength(9);
    for (const r of rows) expect(r.male + r.female, r.bin).toBe(r.all);
    expect(sum(rows.map((r) => r.male))).toBe(130749);
    expect(sum(rows.map((r) => r.female))).toBe(123592);
    expect(sum(rows.map((r) => r.all))).toBe(254341);
    const bin = (label: string) => rows.find((r) => r.bin === label)!;
    const under25 = bin('1.5kg 미만').all + bin('1.5~1.9kg').all + bin('2.0~2.4kg').all;
    expect(under25).toBe(20418);
    expect(bin('4.0~4.4kg').all + bin('4.5kg 이상').all).toBe(4089);
    const known = 254341 - bin('미상').all;
    const w = get('birth-weight') as unknown as { shares: { under25kg: number; over40kg: number }; meanWeightKg: { male: number; female: number; all: number } };
    expect(Math.round((under25 / known) * 1000) / 10).toBe(w.shares.under25kg);
    expect(Math.round(((bin('4.0~4.4kg').all + bin('4.5kg 이상').all) / known) * 1000) / 10).toBe(w.shares.over40kg);
    expect(w.meanWeightKg).toMatchObject({ male: 3.2, female: 3.1, all: 3.1 });
    expect(Math.round((130749 / 123592) * 1000) / 10, '출생 성비 105.8').toBe(105.8);
  });

  it('부모 나이·출산 순위: 어머니 연령별 출생아 합 254.3천, 아버지 비중 합 ≈100, 첫째·둘째·셋째 비중 합 ≈100, 평균 연령이 본문과 같다', () => {
    expect(Math.abs(sum(seriesOf('birth-mother-age').map((p) => p.value)) - 254.3)).toBeLessThan(0.1);
    expect(Math.abs(sum(seriesOf('birth-father-age').map((p) => p.value)) - 100)).toBeLessThan(0.3);
    const m = get('birth-mother-age').averages as { all: number; all2015: number; first: number; second: number; thirdPlus: number; bySido: Record<string, number> };
    expect(m).toMatchObject({ all: 33.8, first: 33.2, second: 34.7, thirdPlus: 35.8 });
    expect(Math.round((m.all - m.all2015) * 10) / 10, '10년 전보다 1.6세').toBe(1.6);
    expect(Object.keys(m.bySido)).toEqual(SIDO);
    expect(m.bySido['서울']).toBe(34.8);
    expect(get('birth-father-age').averages).toMatchObject({ all: 36.1, first: 35.4 });
    const order = rowsOf('birth-order') as Array<{ label: string; first: number; second: number; thirdPlus: number }>;
    expect(order[0]).toMatchObject({ label: '전국', first: 62.4, second: 31.2, thirdPlus: 6.4 });
    for (const r of order) expect(Math.abs(r.first + r.second + r.thirdPlus - 100), r.label).toBeLessThanOrEqual(0.3);
    expect(order.find((r) => r.label === '서울')!.first).toBe(69.8);
    expect(order.find((r) => r.label === '제주')!.thirdPlus).toBe(10.1);
  });

  it('점유형태: 행마다 자가+임차+무상 ≈ 100, 17개 시도·전국·소득계층이 있다', () => {
    const rows = rowsOf('housing-tenure') as Array<{ label: string; own: number; rent: number; free: number }>;
    for (const r of rows) expect(Math.abs(r.own + r.rent + r.free - 100), r.label).toBeLessThanOrEqual(0.15);
    for (const s of SIDO) expect(rows.map((r) => r.label), s).toContain(s);
    expect(rows.find((r) => r.label === '전국')).toMatchObject({ own: 58.4, rent: 38.0, free: 3.6 });
    expect(rows.find((r) => r.label === '서울')!.own).toBe(44.1);
    expect(Math.min(...rows.filter((r) => SIDO.includes(r.label)).map((r) => r.own))).toBe(44.1);
    expect(rows.find((r) => r.label === '전국·저소득층')!.own).toBeLessThan(rows.find((r) => r.label === '전국·고소득층')!.own);
  });

  it('직업 대분류(근사): 30대 9개 분류 합 = 계 5,444천 명, 40대는 6,203(±2)', () => {
    const rows = rowsOf('occupation-proxy') as Array<{ label: string; a30: number; a40: number }>;
    expect(rows).toHaveLength(9);
    expect(sum(rows.map((r) => r.a30))).toBe(get('occupation-proxy').latest!.value);
    expect(Math.abs(sum(rows.map((r) => r.a40)) - 6203)).toBeLessThanOrEqual(2);
    expect(get('occupation-proxy').notes).toContain('부모 직업 항목이 없어');
  });

  it('BR5 비교 행(출처가 확인된 행 3개 이상): 소득별 사교육 참여율·비용, 소득계층별 자가, 기대수명 소득 차이', () => {
    const edu = rowsOf('private-education-by-income') as Array<{ band: string; participationPct: number; monthlyCostMan: number }>;
    expect(edu).toHaveLength(8);
    const bands = edu.slice(1);
    for (let k = 1; k < bands.length; k++) {
      expect(bands[k].participationPct, bands[k].band).toBeGreaterThan(bands[k - 1].participationPct);
      expect(bands[k].monthlyCostMan, bands[k].band).toBeGreaterThan(bands[k - 1].monthlyCostMan);
    }
    expect(edu[0]).toMatchObject({ band: '전체', participationPct: 75.7, monthlyCostMan: 45.8 });
    expect(edu.find((r) => r.band === '800만 원 이상')).toMatchObject({ participationPct: 84.9, monthlyCostMan: 66.2 });
    expect(edu.find((r) => r.band === '300만 원 미만')).toMatchObject({ participationPct: 52.8, monthlyCostMan: 19.2 });
    expect(get('life-expectancy-income-gap').latest).toEqual({ year: 2017, value: 6.48 });
    expect(at('life-expectancy-income-gap', 2004)).toBe(6.24);
  });
});

describe('값 교차 검증 — 사망·인구·가구·사교육 (SC1)', () => {
  it('조사망률: 2025년 7.1명/천 명 = 사망자 362,968명 ÷ 인구(712.6명/10만 명)의 1/100, 1983년 사망자 수가 보도자료 표와 같다', () => {
    const c = get('cdr') as unknown as { deaths2025: number; crudeDeathRatePer100k2025: number; perDay2025: number };
    expect(at('cdr', 2025)).toBe(7.1);
    expect(Math.round(c.crudeDeathRatePer100k2025 / 10) / 10).toBe(7.1);
    expect(c.deaths2025).toBe(362968);
    expect(Math.round(c.deaths2025 / 365)).toBe(c.perDay2025);
    expect(Math.round((get('births') as unknown as { perDay2025: number }).perDay2025)).toBe(Math.round(254341 / 365));
  });

  it('연령별 사망자 합 + 연령미상 25 = 362,968, 80세 이상 54.7%', () => {
    const d = seriesOf('death-age');
    expect(sum(d.map((p) => p.value)) + 25).toBe(362968);
    expect(Math.round((byLabel('death-age', '80세 이상') / 362968) * 1000) / 10).toBe(54.7);
  });

  it('10대 사인은 사망률 내림차순이고 암 177.1·심장 66.3·폐렴 60.8 순이다', () => {
    const s = seriesOf('top-causes').map((p) => p.value);
    expect([...s].sort((a, b) => b - a)).toEqual(s);
    expect(seriesOf('top-causes').slice(0, 3).map((p) => p.label)).toEqual(['악성신생물(암)', '심장 질환', '폐렴']);
    expect(s.slice(0, 3)).toEqual([177.1, 66.3, 60.8]);
  });

  it('66세 이상 상대적 빈곤율: 2024년 37.7%, 전년(39.8%)보다 2.1%p 감소, 18~65세(10.3%)의 3배 이상', () => {
    expect(at('elderly-poverty', 2024)).toBe(37.7);
    expect(Math.round((at('elderly-poverty', 2024) - at('elderly-poverty', 2023)) * 10) / 10).toBe(-2.1);
    const work = get('elderly-poverty').extraSeries![0].series.find((p) => p.year === 2024)!.value;
    expect(at('elderly-poverty', 2024) / work).toBeGreaterThan(3);
  });

  it('기대수명: 1970~2024 55개 값, 2024년 83.7(남 80.8·여 86.6), 남녀 값이 모두 있고 전체는 남자와 여자 사이', () => {
    const l = get('life-expectancy');
    expect(seriesOf('life-expectancy')).toHaveLength(55);
    expect(l.latest).toEqual({ year: 2024, value: 83.7 });
    const male = l.extraSeries!.find((e) => e.label === '남자')!.series;
    const female = l.extraSeries!.find((e) => e.label === '여자')!.series;
    expect(male.find((p) => p.year === 2024)!.value).toBe(80.8);
    expect(female.find((p) => p.year === 2024)!.value).toBe(86.6);
    for (const p of seriesOf('life-expectancy')) {
      const m = male.find((x) => x.year === p.year)!.value;
      const f = female.find((x) => x.year === p.year)!.value;
      expect(p.value, String(p.year)).toBeGreaterThanOrEqual(m);
      expect(p.value, String(p.year)).toBeLessThanOrEqual(f);
    }
    expect(at('life-expectancy', 1970)).toBe(62.3);
  });

  it('1인 가구 비율: 2025년 36.6% = 8,244천 가구 ÷ 22,495천 일반가구', () => {
    expect(at('single-household', 2025)).toBe(36.6);
    expect(Math.round((8244 / 22495) * 1000) / 10).toBe(36.6);
  });

  it('평균 초혼 연령: 2025년 남편 33.85·아내 31.62, 남녀 차이 2.2세(보도자료 [표 3])', () => {
    const f = get('first-marriage-age');
    expect(f.latest).toEqual({ year: 2025, value: 33.85 });
    expect(f.extraSeries![0].latest).toEqual({ year: 2025, value: 31.62 });
    expect(Math.round((33.85 - 31.62) * 10) / 10).toBe(2.2);
    expect(seriesOf('first-marriage-age')).toHaveLength(21);
  });

  it('청년(15~29세) 고용률: 2025년 45.0% = 취업자 3,578천 ÷ 인구 7,953천, 15세 이상 전체 62.9%', () => {
    expect(at('youth-employment', 2025)).toBe(45);
    expect(Math.round((3578 / 7953) * 1000) / 10).toBe(45);
    expect(get('youth-employment').extraSeries!.find((e) => e.label === '15세 이상 전체')!.series.find((p) => p.year === 2025)!.value).toBe(62.9);
  });

  it('사교육: 2024년 80.0%에서 2025년 75.7%로 4.3%p 감소, 월평균 사교육비 22.2만 원(2007)→45.8만 원(2025), 시리즈 19개 연도', () => {
    expect(seriesOf('private-education')).toHaveLength(19);
    expect(Math.round((at('private-education', 2024) - at('private-education', 2025)) * 10) / 10).toBe(4.3);
    const cost = get('private-education').extraSeries![0].series;
    expect(cost.find((p) => p.year === 2007)!.value).toBe(22.2);
    expect(cost.find((p) => p.year === 2025)!.value).toBe(45.8);
  });

  it('고령인구 비율: 2020~2025 상승, 2025년 20.7%(처음 20% 초과)', () => {
    const s = seriesOf('aging-rate');
    for (let k = 1; k < s.length; k++) expect(s[k].value).toBeGreaterThan(s[k - 1].value);
    expect(at('aging-rate', 2025)).toBe(20.7);
    expect(at('aging-rate', 2024)).toBeLessThan(20);
  });

  it('혼인·이혼: 이혼 88,130건 = 미성년 자녀 있음 37.4천 + 없음 49.4천 + 미상, 미성년 자녀 있는 비중 42.5%', () => {
    const d = get('divorce') as unknown as { shares: { withMinorChildren2025Pct: number }; crudeDivorceRate2025: number };
    expect(at('divorce', 2025)).toBe(88130);
    const withMinor = get('divorce').extraSeries![0].series.find((p) => p.year === 2025)!.value;
    expect(withMinor).toBe(37.4);
    expect(withMinor + 49.4).toBeLessThanOrEqual(88.13);
    // 37.4천 건은 반올림 값이라 비중은 42.4~42.5 사이(보도자료 42.5%)
    expect(Math.abs((withMinor / 88.13) * 100 - 42.5)).toBeLessThanOrEqual(0.1);
    expect(d.shares.withMinorChildren2025Pct).toBe(42.5);
    expect(d.crudeDivorceRate2025).toBe(1.7);
    const m = get('marriage-count') as unknown as { crudeMarriageRate: { value: number; releaseChange: number }; change: { vsPreviousPct: number } };
    expect(get('marriage-count').latest).toEqual({ year: 2025, value: 240326 });
    expect(m.crudeMarriageRate).toMatchObject({ value: 4.7, releaseChange: 0.4 });
    expect(m.change.vsPreviousPct).toBe(8.1);
  });
});

describe('값 교차 검증 — 경제 모델 근거 (EC)', () => {
  it('가구주 연령대별: 자산 평균 − 부채 평균 = 순자산 평균(±1만 원), 가구 분포 합 100%, 전체 평균이 보도자료와 같다', () => {
    const rows = rowsOf('household-by-age') as Array<{ group: string; households: number; assetMean: number; debtMean: number; netWorthMean: number; netWorthMedian: number; debtHoldingPct: number; incomeMean: number }>;
    expect(rows.map((r) => r.group)).toEqual(['전체', '29세 이하', '30~39세', '40~49세', '50~59세', '60세 이상', '65세 이상']);
    for (const r of rows) expect(Math.abs(r.assetMean - r.debtMean - r.netWorthMean), r.group).toBeLessThanOrEqual(1);
    const parts = rows.filter((r) => ['29세 이하', '30~39세', '40~49세', '50~59세', '60세 이상'].includes(r.group));
    expect(Math.round(sum(parts.map((r) => r.households)) * 10) / 10).toBe(100);
    expect(rows[0]).toMatchObject({ assetMean: 56678, debtMean: 9534, netWorthMean: 47144, incomeMean: 7427, debtHoldingPct: 58.9 });
    expect(rows.find((r) => r.group === '29세 이하')!.netWorthMedian).toBe(5000);
    expect(rows.find((r) => r.group === '50~59세')!.netWorthMedian).toBe(31685);
  });

  it('최저임금: 2015~2026 오름차순, 2026년 10,320원 × 209시간 = 2,156,880원(월 환산), 2027년 10,700원은 별도 의결값', () => {
    const s = seriesOf('minimum-wage');
    for (let k = 1; k < s.length; k++) expect(s[k].value).toBeGreaterThan(s[k - 1].value);
    expect(get('minimum-wage').latest).toEqual({ year: 2026, value: 10320 });
    expect(10320 * 209).toBe(2156880);
    expect(get('minimum-wage').definition).toContain('2,156,880원');
    expect(get('minimum-wage').decided).toMatchObject({ appliesFrom: 2027, value: 10700 });
    expect(Math.round(((at('minimum-wage', 2026) - at('minimum-wage', 2025)) / at('minimum-wage', 2025)) * 1000) / 10, '인상률 2.9%').toBe(2.9);
  });

  it('등록금: 4년제 평균 7,270.3천 원이 전년(7,123.1천 원)보다 약 147천 원(2.1%) 많다, 사립 > 평균 > 국공립, 의학이 가장 비싸다', () => {
    const rows = rowsOf('university-tuition') as Array<{ label: string; value: number; prev: number | null }>;
    const all = rows[0];
    expect(all.value).toBe(7270.3);
    // 본문 「147.1천 원(2.1%) 상승」: 표의 반올림 값끼리 빼면 147.2 — 0.1 차이는 반올림
    expect(Math.abs(all.value - all.prev! - 147.1)).toBeLessThanOrEqual(0.1 + 1e-9);
    expect(Math.round(((all.value - all.prev!) / all.prev!) * 1000) / 10).toBe(2.1);
    const v = (label: string) => rows.find((r) => r.label === label)!.value;
    expect(v('4년제·사립')).toBeGreaterThan(all.value);
    expect(v('4년제·국공립')).toBeLessThan(all.value);
    expect(v('4년제·의학')).toBe(Math.max(...rows.filter((r) => r.label.startsWith('4년제·') && !r.label.includes('사립') && !r.label.includes('국공립') && !r.label.includes('수도권')).map((r) => r.value)));
  });

  it('국민이전계정: 86행(0~84세·85세 이상), 소비 − 노동소득 = 생애주기적자(±2천 원), 28세 흑자 진입·61세 적자 전환·16세 소비 최대·45세 노동소득 최대', () => {
    const rows = rowsOf('lifecycle-account') as Array<{ ageLabel: string; consumption: number; laborIncome: number; lifeCycleDeficit: number }>;
    expect(rows).toHaveLength(86);
    for (const r of rows) expect(Math.abs(r.consumption - r.laborIncome - r.lifeCycleDeficit), r.ageLabel).toBeLessThanOrEqual(2);
    const ms = get('lifecycle-account').milestones as { surplusFromAge: number; deficitAgainFromAge: number; consumptionPeakAge: number; consumptionPeak: number; laborIncomePeakAge: number; laborIncomePeak: number };
    expect(rows.find((r) => r.lifeCycleDeficit < 0)!.ageLabel).toBe(`${ms.surplusFromAge}세`);
    const after = rows.filter((r) => Number.parseInt(r.ageLabel, 10) > ms.surplusFromAge && r.lifeCycleDeficit > 0)[0];
    expect(Number.parseInt(after.ageLabel, 10)).toBe(ms.deficitAgainFromAge);
    const maxC = rows.reduce((a, b) => (b.consumption > a.consumption ? b : a));
    const maxL = rows.reduce((a, b) => (b.laborIncome > a.laborIncome ? b : a));
    expect(maxC.ageLabel).toBe(`${ms.consumptionPeakAge}세`);
    expect(maxC.consumption).toBe(ms.consumptionPeak);
    expect(maxL.ageLabel).toBe(`${ms.laborIncomePeakAge}세`);
    expect(maxL.laborIncome).toBe(ms.laborIncomePeak);
    expect(rows[0]).toMatchObject({ ageLabel: '0세', consumption: 17040, laborIncome: 0 });
  });

  it('소득이동성: 상향+하향 ≈ 이동성(±0.2), 1분위 유지율+탈출률 = 100', () => {
    for (const r of rowsOf('income-mobility') as Array<{ group: string; mobility: number; up: number; down: number }>) expect(Math.abs(r.up + r.down - r.mobility), r.group).toBeLessThanOrEqual(0.2);
    const p = get('income-mobility').persistence as { firstQuintileExitRate2023: number; firstQuintileStayRate2023: number; fifthQuintileStayRate2023: number; firstQuintile2017StillFirst2023: number; fifthQuintile2017StillFifth2023: number };
    expect(p.firstQuintileExitRate2023 + p.firstQuintileStayRate2023).toBe(100);
    expect(p).toMatchObject({ fifthQuintileStayRate2023: 85.9, firstQuintile2017StillFirst2023: 27.8, fifthQuintile2017StillFifth2023: 59.3 });
    expect(get('income-mobility').notes).toContain('세대 간');
  });

  it('육아휴직: 계·아버지·어머니 10개 연도, 2015~2024 아버지 사용률 0.6→10.2, 2024는 잠정', () => {
    const p = get('parental-leave');
    expect(seriesOf('parental-leave')).toHaveLength(10);
    expect(p.extraSeries!.map((e) => e.label)).toEqual(['아버지', '어머니']);
    expect(p.extraSeries![0].series.map((x) => x.value)[0]).toBe(0.6);
    expect(p.extraSeries![0].latest!.value).toBe(10.2);
    expect(p.extraSeries![1].latest!.value).toBe(72.2);
    expect(p.provisionalYears).toEqual([2024]);
  });

  it('청소년 건강·학교폭력: 값이 보도자료 본문과 같고 우울감·자살 지표는 없다', () => {
    const h = rowsOf('youth-health') as Array<{ key: string; male: number; female: number }>;
    expect(h.find((r) => r.key === '스트레스 인지율')).toMatchObject({ male: 32.9, female: 50.3 });
    expect(h.find((r) => r.key === '주중 평균 수면시간')).toMatchObject({ male: 6.6, female: 5.9 });
    expect(JSON.stringify(h)).not.toMatch(/우울|자살/);
    const v = rowsOf('school-violence') as Array<{ level: string; rate: number }>;
    expect(v.map((r) => r.rate)).toEqual([2.5, 5.0, 2.1, 0.7]);
    expect(v[0].rate).toBeLessThan(v[1].rate);
  });

  it('장래인구추계(다가올 세상용): 2022년 기준 중위 추계이고 실제와 어긋남을 notes에 밝힌다', () => {
    const p = get('future-projection');
    expect(p.use).toEqual(['future']);
    expect(p.notes).toContain('2022년 기준');
    expect(p.notes).toContain('실제와 어긋난다');
    const rows = rowsOf('future-projection') as Array<{ year: number; populationThousand: number; tfr: number; lifeExpectancy: number; lifeExpectancyMale: number; lifeExpectancyFemale: number }>;
    expect(rows.map((r) => r.year)).toEqual([2025, 2026, 2030, 2040, 2050, 2060, 2072]);
    for (const r of rows) {
      expect(r.lifeExpectancyMale, String(r.year)).toBeLessThan(r.lifeExpectancy);
      expect(r.lifeExpectancyFemale, String(r.year)).toBeGreaterThan(r.lifeExpectancy);
    }
    expect(rows.find((r) => r.year === 2025)!.tfr).toBe(0.65);
    expect(at('tfr', 2025)).toBe(0.8);
    expect(rows.find((r) => r.year === 2050)!.populationThousand).toBeLessThan(rows.find((r) => r.year === 2030)!.populationThousand);
  });
});

// =====================================================================================================
// 검수 1회차(REV-003-M6a-1) 반영 — M6a-r2
// =====================================================================================================

const getAny = (id: string): Record<string, unknown> & Indicator => get(id) as Record<string, unknown> & Indicator;
const usable = (id: string): UsableIndicator => {
  const found = getUsableIndicator(id);
  if (!found) throw new Error(`확인된 지표 아님: ${id}`);
  return found;
};
const basisBlock = (basisId: string): string => {
  const found = basisDoc.split('\n### ').find((b) => b.startsWith(`${basisId} `));
  if (!found) throw new Error(`근거 행 없음: ${basisId}`);
  return found;
};
/** 가장 큰 나머지 방식 정수 배분(합 = total) — 생성기와 같은 규칙을 테스트가 다시 계산한다 */
function apportion(total: number, weights: readonly number[]): number[] {
  const sw = sum(weights);
  const q = weights.map((w) => (w / sw) * total);
  const fl = q.map(Math.floor);
  let rest = total - sum(fl);
  const order = q.map((x, i) => ({ i, frac: x - Math.floor(x), w: weights[i] })).sort((a, b) => b.frac - a.frac || b.w - a.w || a.i - b.i);
  for (const o of order) {
    if (rest <= 0) break;
    fl[o.i]++;
    rest--;
  }
  return fl;
}

describe('표기 정보: 단위·소수 자릿수·큰 숫자 (R-142·R-147)', () => {
  it('확인된 지표마다 latestUnit(큰 숫자의 단위)과 decimals(공식 표기 자릿수)가 있고, latestLabel이 있으면 latestUnit도 반드시 있다', () => {
    for (const i of USABLE) {
      const a = i as Record<string, unknown>;
      expect(typeof a.latestUnit === 'string' && (a.latestUnit as string).length > 0, `${i.id} latestUnit`).toBe(true);
      expect(Number.isInteger(a.decimals) && (a.decimals as number) >= 0 && (a.decimals as number) <= 3, `${i.id} decimals`).toBe(true);
      if (a.latestLabel !== undefined) expect(a.latestUnit, `${i.id} latestLabel이 있으면 latestUnit 필수`).toBeTruthy();
    }
  });

  it('line 지표는 latestUnit = unit, 단위가 다르거나 표·막대의 큰 숫자는 latestLabel로 무엇인지 적고 표는 unit이 null이다', () => {
    for (const i of USABLE) {
      const a = i as Record<string, unknown>;
      if (i.kind === 'line') expect(a.latestUnit, `${i.id}`).toBe(i.unit);
      if (i.kind === 'table') {
        expect(i.unit, `${i.id} 표의 unit은 null(열·행이 단위를 가짐)`).toBeNull();
        expect(typeof a.latestLabel === 'string' && (a.latestLabel as string).length > 3, `${i.id} 표는 latestLabel 필수`).toBe(true);
      }
      if (i.kind === 'bar') expect(typeof a.latestLabel === 'string', `${i.id} 막대의 큰 숫자는 latestLabel 필수(전국 값 등)`).toBe(true);
      if (a.latestUnit !== i.unit) expect(typeof a.latestLabel === 'string', `${i.id} latestUnit이 unit과 다르면 latestLabel 필수`).toBe(true);
    }
    // 검수가 지적한 「천 명」 33.8세 같은 불일치: 막대 단위와 큰 숫자 단위를 분리했다
    expect(getAny('birth-mother-age')).toMatchObject({ unit: '천 명', latestUnit: '세', latestLabel: '모의 평균 출산연령' });
    expect(getAny('birth-father-age')).toMatchObject({ unit: '%', latestUnit: '세', latestLabel: '부의 평균 연령' });
    expect(getAny('birth-by-sido')).toMatchObject({ unit: null, latestUnit: '명' });
    expect(getAny('housing-tenure')).toMatchObject({ unit: null, latestUnit: '%' });
    expect(get('housing-tenure').latest).toEqual({ year: 2024, value: 58.4 });
  });

  it('큰 숫자 표기는 공식 표기를 따른다: 0.80명·254,341명·인구 1천 명당 7.1명·36.6%·남자 33.9세/여자 31.6세·51,082,431명', () => {
    expect(formatIndicatorValue(usable('tfr')).text).toBe('0.80명');
    expect(formatIndicatorValue(usable('births')).text).toBe('254,341명');
    expect(formatIndicatorValue(usable('cdr')).text).toBe('인구 1천 명당 7.1명');
    expect(formatIndicatorValue(usable('single-household')).text).toBe('36.6%');
    expect(formatIndicatorValue(usable('life-expectancy')).text).toBe('83.7년');
    expect(formatIndicatorValue(usable('region-population-registered')).text).toBe('51,082,431명');
    expect(formatIndicatorValue(usable('minimum-wage')).text).toBe('10,320원');
    expect(formatIndicatorValue(usable('household-by-age')).text).toBe('47,144만 원');
    expect(formatIndicatorValue(usable('birth-mother-age')).text).toBe('33.8세');
    expect(formatHeadlines(usable('first-marriage-age')).map((h) => `${h.label} ${h.text}`)).toEqual(['남자 33.9세', '여자 31.6세']);
    expect(formatIndicatorValue(usable('suicide-rate')).text).toBe('인구 10만 명당 27.8명');
  });

  it('초혼 연령은 남자·여자 두 값(headline)과 제목의 성별로 보이고 큰 숫자는 남자 값이다', () => {
    const f = getAny('first-marriage-age');
    expect(f.title).toContain('남자');
    expect(f.title).toContain('여자');
    expect(f.headline).toEqual([
      { label: '남자', year: 2025, value: 33.85 },
      { label: '여자', year: 2025, value: 31.62 },
    ]);
    expect(get('first-marriage-age').latest).toEqual({ year: 2025, value: 33.85 });
  });

  it('연도 시계열 axis: gaps·step·regular이 시리즈에서 계산한 값과 같고, 단절(breaks) 연도는 시리즈 안에 있다', () => {
    let checked = 0;
    for (const i of USABLE.filter((x) => x.kind === 'line' && (x.series ?? []).length > 0 && x.series![0].year !== undefined)) {
      const axis = i.axis as { scale: string; step: number | null; regular: boolean; gaps: Array<{ from: number; to: number }>; breaks: Array<{ year: number; note: string }> } | undefined;
      expect(axis, `${i.id} axis`).toBeDefined();
      const years = seriesOf(i.id).map((p) => p.year!);
      const gaps = getSeriesGaps(seriesOf(i.id) as Parameters<typeof getSeriesGaps>[0]);
      expect(axis!.scale).toBe('year');
      expect(axis!.gaps, `${i.id} gaps`).toEqual(gaps);
      expect(axis!.regular, `${i.id} regular`).toBe(gaps.length === 0);
      const diffs = years.slice(1).map((y, k) => y - years[k]);
      const same = years.length >= 3 && diffs.every((d) => d === diffs[0]);
      expect(axis!.step, `${i.id} step`).toBe(same ? diffs[0] : null);
      for (const b of axis!.breaks) {
        expect(years, `${i.id} 단절 연도`).toContain(b.year);
        expect(b.note.length).toBeGreaterThan(10);
      }
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(16);
    // 알려진 불규칙 시계열
    expect((getAny('suicide-rate').axis as { regular: boolean }).regular).toBe(false);
    expect((getAny('single-household').axis as { breaks: Array<{ year: number }> }).breaks.map((b) => b.year)).toEqual([2015]);
    expect((getAny('life-expectancy-income-gap').axis as { gaps: unknown[] }).gaps).toEqual([{ from: 2004, to: 2017 }]);
    expect((getAny('marriage-count').axis as { regular: boolean }).regular).toBe(true);
  });

  it('근거 문서(생성)의 「수치」 칸에 큰 숫자의 기준 연도와 값(단위 포함)이 있고 latestLabel이 있으면 그 글도 있다 — 단위·값 어긋남이 문서로 새지 않는다', () => {
    for (const i of USABLE) {
      const line = basisBlock(i.basisId)
        .split('\n')
        .find((l) => l.startsWith('- **수치**:'));
      expect(line, `${i.id} 수치 칸`).toBeDefined();
      const f = formatIndicatorValue(usable(i.id));
      expect(line, `${i.id} 연도`).toContain(`${i.latest!.year}년`);
      expect(line, `${i.id} 값`).toContain(f.text);
      const label = (i as Record<string, unknown>).latestLabel;
      if (typeof label === 'string') expect(line, `${i.id} 라벨`).toContain(label);
    }
  });
});

describe('육아휴직 분모와 미확인 하위 항목 규칙 (R-140)', () => {
  it('사용률 정의가 「육아휴직 대상 조건을 충족한 부모」를 분모로 적고 「출생아 부모 전체」로 읽히지 않는다', () => {
    const p = get('parental-leave');
    expect(p.definition).toContain('육아휴직 대상 조건을 충족한');
    expect(p.definition).not.toContain('부모 중 육아휴직을 사용한 사람의 비율');
    expect(p.title).toContain('대상자 기준');
    expect(String(p.notes)).toContain('분모');
    expect(String(p.notes)).toContain('군인');
    expect(p.verification.method).toContain('승인번호 101092');
    expect(p.verification.crossChecks!.join('\n')).toContain('육아휴직 대상 조건을 충족시키는 사람');
  });

  it('계(34.7)가 아버지(10.2)·어머니(72.2)의 단순 평균(41.2)과 다르다 — 분모(대상자 수)가 성별로 달라 합친 비율이기 때문', () => {
    const s = get('parental-leave');
    const father = s.extraSeries![0].latest!.value;
    const mother = s.extraSeries![1].latest!.value;
    expect(s.latest!.value).toBe(34.7);
    expect(Math.round(((father + mother) / 2) * 10) / 10).toBe(41.2);
    expect(s.latest!.value).not.toBeCloseTo((father + mother) / 2, 0);
    // 합친 비율은 두 값 사이에 있다
    expect(s.latest!.value).toBeGreaterThan(father);
    expect(s.latest!.value).toBeLessThan(mother);
  });

  it('unverifiedParts 형식: 있다면 {part, reason}이고 part는 extraSeries:·series:·row:·field: 중 하나다(현재 데이터에는 해당 항목 없음)', () => {
    for (const i of ALL) {
      const parts = (i.verification as { unverifiedParts?: Array<{ part: string; reason: string }> }).unverifiedParts ?? [];
      for (const p of parts) {
        expect(p.part, i.id).toMatch(/^(extraSeries|series|row|field):.+/);
        expect(p.reason.length, i.id).toBeGreaterThan(10);
      }
    }
  });
});

describe('값 정정·재대조 기록 (R-143·R-147(c)·검수 표본 5개)', () => {
  it('재대조한 지표에 verification.recheckedOn(2026-10-15)이 있다', () => {
    for (const id of ['parental-leave', 'youth-employment', 'marriage-count', 'divorce', 'household-finance-misc', 'household-by-age', 'tfr', 'births', 'cdr', 'life-expectancy']) {
      expect((get(id).verification as { recheckedOn?: string }).recheckedOn, id).toBe('2026-10-15');
    }
  });

  it('가구주 연령별 표: 평균은 부채 없는 가구를 포함한 전 가구 평균, 부채 중앙값은 부채가 있는 가구만 — 열 이름과 정의에 적혀 있다(R-143)', () => {
    const h = get('household-by-age');
    expect(h.definition).toContain('부채가 없는 가구까지 포함한 전 가구 평균');
    expect(h.definition).toContain('부채가 있는 가구만');
    const cols = Object.fromEntries((h.columns ?? []).map((c) => [c.key, c.label]));
    expect(cols.debtMean).toContain('부채가 없는 가구를 포함한');
    expect(cols.debtMedian).toContain('부채가 있는 가구만');
    // 30대: 보유 비율 69.0%라 부채 보유 가구 평균은 전 가구 평균(10,899)보다 크다 — 두 값을 섞어 말하면 안 되는 이유
    const r = rowsOf('household-by-age').find((x) => x.group === '30~39세') as { debtMean: number; debtHoldingPct: number; debtMedian: number };
    expect(r.debtMean / (r.debtHoldingPct / 100)).toBeGreaterThan(r.debtMean * 1.4);
    expect(r.debtMedian).toBe(10732);
  });

  it('15~29세 고용률(KOSIS 재열람 2026-10-15): 취업자 ÷ 인구 직접 계산이 시리즈 값과 같다(2015 3,864÷9,380·2016 3,908÷9,363·2024 3,755÷8,152·2025 3,578÷7,953)', () => {
    const calc: Array<[number, number, number]> = [
      [2015, 3864, 9380],
      [2016, 3908, 9363],
      [2024, 3755, 8152],
      [2025, 3578, 7953],
    ];
    for (const [year, employed, pop] of calc) expect(at('youth-employment', year), String(year)).toBe(Math.round((employed / pop) * 1000) / 10);
    expect([at('youth-employment', 2015), at('youth-employment', 2016), at('youth-employment', 2024)]).toEqual([41.2, 41.7, 46.1]);
    expect(String(get('youth-employment').verification.crossChecks!.join('\n'))).toContain('재열람');
  });

  it('혼인: KOSIS 연속 시리즈 1970~2025(56개), 그래프 판독 6개 값과 반올림 일치, 2025 = 2024 + 17,914건(+8.1%), 조혼인율 2023 3.8·2024 4.4·2025 4.7', () => {
    const m = get('marriage-count');
    const years = seriesOf('marriage-count').map((p) => p.year);
    expect(years[0]).toBe(1970);
    expect(years.at(-1)).toBe(2025);
    expect(years).toHaveLength(56);
    expect(new Set(years).size).toBe(56);
    const graph: Array<[number, number]> = [
      [1970, 295],
      [1980, 403],
      [1996, 435],
      [2003, 303],
      [2013, 323],
      [2025, 240],
    ];
    for (const [y, thousand] of graph) expect(Math.round(at('marriage-count', y) / 1000), String(y)).toBe(thousand);
    expect([at('marriage-count', 2023), at('marriage-count', 2024), at('marriage-count', 2025)]).toEqual([193657, 222412, 240326]);
    expect(at('marriage-count', 2025) - at('marriage-count', 2024)).toBe(17914);
    expect(Math.round((at('marriage-count', 2025) / at('marriage-count', 2024) - 1) * 1000) / 10).toBe(8.1);
    const rate = m.extraSeries![0].series;
    expect(rate).toHaveLength(56);
    expect([2023, 2024, 2025].map((y) => rate.find((p) => p.year === y)!.value)).toEqual([3.8, 4.4, 4.7]);
    expect(String((m as Record<string, unknown>).notes)).toContain('이혼 건수를 혼인 건수와 나누어');
  });

  it('혼인 보도자료 「조혼인율 전년대비 0.4건 증가」는 표 반올림 값(4.4→4.7)으로는 0.3건 — 그 차이를 note에 밝히고 증감 건수는 데이터 문장에 쓰지 않는다', () => {
    const c = getAny('marriage-count').crudeMarriageRate as { value: number; releaseChange: number; note: string };
    const rate = get('marriage-count').extraSeries![0].series;
    const diff = Math.round((rate.find((p) => p.year === 2025)!.value - rate.find((p) => p.year === 2024)!.value) * 10) / 10;
    expect(diff).toBe(0.3);
    expect(c.releaseChange).toBe(0.4);
    expect(c.note).toContain('0.3건');
  });

  it('이혼: KOSIS 연속 시리즈 1970~2025(56개), 2015~2025 값은 기존 천 건 단위 값을 반올림하면 같다, 조이혼율 1.7(2025)', () => {
    const years = seriesOf('divorce').map((p) => p.year);
    expect(years).toHaveLength(56);
    expect(years[0]).toBe(1970);
    const old2015to2025 = [109.2, 107.3, 106, 108.7, 110.8, 106.5, 101.7, 93.2, 92.4, 91.2, 88.1];
    old2015to2025.forEach((v, k) => expect(Math.round(at('divorce', 2015 + k) / 100) / 10, String(2015 + k)).toBe(v));
    expect(get('divorce').extraSeries![1].latest).toEqual({ year: 2025, value: 1.7 });
    expect(String(getAny('divorce').notes)).toContain('이혼율');
  });

  it('가계금융복지조사 요약 이미지 재판독 값(11개)이 표와 서로 맞는다: 자산 대비 부채 = 9,534 ÷ 56,678 = 16.8%, 소득 원천 합 ≤ 소득', () => {
    const rows = rowsOf('household-finance-misc') as Array<{ key: string; value: number; decimals: number }>;
    const v = (k: string) => rows.find((r) => r.key.startsWith(k))!.value;
    expect(v('자산 대비 부채 비율')).toBe(Math.round((9534 / 56678) * 1000) / 10);
    expect(v('근로소득(평균)') + v('사업소득(평균)') + v('공적이전소득(평균)')).toBeLessThanOrEqual(v('가구 평균 소득'));
    expect(v('가구주 예상 은퇴 연령')).toBe(68.6);
    expect(v('가구주 실제 은퇴 연령')).toBe(62.7);
    expect(String(getAny('household-finance-misc').notes)).toContain('같은 사람의 기대와 현실을 비교한 값이 아니다');
    expect(rows.map((r) => r.decimals)).toHaveLength(11);
  });
});

describe('정의·표기 정정 (R-152·R-153·R-154)', () => {
  it('조사망률·자살률 정의는 「인구 N명당 사망자 수」이고 「나눈 값」 오서술이 없다(R-152)', () => {
    expect(get('cdr').definition).toBe('조사망률은 인구 1천 명당 그해 사망자 수입니다.');
    expect(get('suicide-rate').definition).toBe('자살률은 인구 10만 명당 그해 고의적 자해(자살)로 숨진 사람의 수입니다.');
    for (const i of USABLE) expect(i.definition, i.id).not.toMatch(/사망자 수를 인구 1천 명으로 나눈|명으로 나눈 값/);
  });

  it('시도별 출생 정의는 인구동향조사 통계설명자료대로 출생자의 주소지 기준이다 — 근거 없는 「신고·집계 기준」을 쓰지 않는다(R-154)', () => {
    const d = get('birth-by-sido').definition;
    expect(d).toContain('주소지');
    expect(d).not.toContain('신고·집계');
    expect(String(get('birth-by-sido').notes)).toContain('출생자의 주소지');
    expect(basisDoc).not.toContain('어머니 거주지 기준이 아니라 신고·집계 기준');
  });

  it('교차 참조·기관 명칭 정정: 임차 전세·월세 사유는 s-024를 가리키고, 국가통계연구원은 현 명칭(국가데이터연구원)을 병기한다(R-153)', () => {
    // s-037은 2026-10-17에 2019년 값으로 확인됐다(R-267) — 이제 사유(reason) 대신 notes·근거 문서가 s-024를 가리킨다
    const notes = String(get('rent-type-split').notes);
    expect(notes).toContain('2019');
    expect(notes).not.toContain('(s-025)');
    expect(basisDoc).toContain('임차의 전세·월세 구분은 2024년 값이 없고 2019년 값만 있다(s-037)');
    expect(basisDoc).not.toContain('자가·임차·무상(s-025)');
    for (const i of ALL) {
      const org = i.source?.org ?? '';
      if (org.includes('국가통계연구원')) expect(org, i.id).toContain('현 국가데이터연구원');
    }
    expect(get('income-mobility').source!.org).toBe('국가데이터처(국가통계연구원, 현 국가데이터연구원)');
    expect(sourcesDoc).toContain('현 국가데이터연구원');
  });
});

describe('2026년 행정구역 변경과 룰렛 16개 시·도 (R-145·R-146)', () => {
  const rc = (statsJson as unknown as { meta: { regionChanges2026: { source: { org: string; url: string }; sido: Array<{ name: string; shortName: string; effectiveOn: string; mergedFrom: string[] }>; sigungu: Array<{ sido: string; effectiveOn: string; retired?: string[]; created: string[]; parent?: string }>; footnoteText: string }; birthStatsBasisFootnote: string } }).meta;

  it('meta.regionChanges2026: 행정안전부 주민등록인구현황 주석정보로 확인한 변경(전남광주 2026-07-01, 인천 구 개편 2026-07-01, 화성 일반구 2026-02-01)과 표기 문구가 있다', () => {
    const r = rc.regionChanges2026;
    expect(r.source.org).toBe('행정안전부');
    expect(r.source.url).toContain('DT_1B040A3');
    expect(r.sido[0]).toMatchObject({ name: '전남광주통합특별시', shortName: '전남광주', effectiveOn: '2026-07-01', mergedFrom: ['광주', '전남'] });
    const incheon = r.sigungu.find((x) => x.sido === '인천')!;
    expect(incheon.effectiveOn).toBe('2026-07-01');
    expect(incheon.retired).toEqual(['중구', '동구', '서구']);
    expect(incheon.created).toEqual(['제물포구', '영종구', '서해구', '검단구']);
    const hw = r.sigungu.find((x) => x.parent === '화성시')!;
    expect(hw.effectiveOn).toBe('2026-02-01');
    expect(hw.created).toEqual(['만세구', '효행구', '병점구', '동탄구']);
    expect(rc.birthStatsBasisFootnote).toContain('2025년 행정구역 기준');
    expect(rc.birthStatsBasisFootnote).toContain('설계값');
  });

  it('룰렛 2026: 16개 시·도(광주 + 전남 = 전남광주 15,214명), 합 254,341, 비율 합 100.0(가장 큰 나머지 방식)', () => {
    const rows16 = getAny('birth-by-sido').rows16 as Array<{ sido: string; births: number; sharePct: number; from: string[] }>;
    expect(rows16).toHaveLength(16);
    expect(rows16.map((r) => r.sido)).not.toContain('광주');
    expect(rows16.map((r) => r.sido)).not.toContain('전남');
    const g = rows16.find((r) => r.sido === '전남광주')!;
    expect(g.from).toEqual(['광주', '전남']);
    expect(g.births).toBe(6495 + 8719);
    expect(sum(rows16.map((r) => r.births))).toBe(254341);
    expect(Math.round(sum(rows16.map((r) => r.sharePct)) * 10) / 10).toBe(100);
    // 가장 큰 나머지 방식: 0.1% 단위 정수 배분이 출생아 비율과 0.1 이내
    for (const r of rows16) {
      expect(Math.abs(r.sharePct - (r.births / 254341) * 100), r.sido).toBeLessThan(0.1 + 1e-9);
      expect(Math.round(r.sharePct * 10) / 10, r.sido).toBe(r.sharePct);
    }
  });

  it('지난 세상 시대별 시·도 목록(설계값): 10·11·13·14·15개 + 지금·다가올 16개, 시대마다 현재 17개 시도가 정확히 한 번씩 대응되고 합 254,341·비율 합 100.0', () => {
    const eras = getAny('birth-by-sido').eraRegions as Array<{ id: string; kind: string; birthYears: [number, number]; regions: Array<{ name: string; from: string[]; births: number; sharePct: number }> }>;
    expect(eras.map((e) => e.regions.length)).toEqual([10, 11, 13, 14, 15, 16]);
    expect(eras.map((e) => e.birthYears)).toEqual([
      [1950, 1962],
      [1963, 1980],
      [1981, 1985],
      [1986, 1988],
      [1989, 1989],
      [2026, 2060],
    ]);
    const births = Object.fromEntries(rowsOf('birth-by-sido').map((r) => [String(r.sido), num(r.births)]));
    for (const e of eras) {
      const used = e.regions.flatMap((r) => r.from).sort();
      expect(used, e.id).toEqual([...SIDO].sort());
      for (const r of e.regions) expect(r.births, `${e.id} ${r.name}`).toBe(sum(r.from.map((f) => births[f])));
      expect(sum(e.regions.map((r) => r.births)), e.id).toBe(254341);
      expect(Math.round(sum(e.regions.map((r) => r.sharePct)) * 10) / 10, e.id).toBe(100);
    }
    // 당시 없던 시·도는 목록에 없다: 울산(1997)·세종(2012)은 지난 세상 어느 목록에도 없다
    for (const e of eras.filter((x) => x.kind === 'past')) {
      expect(e.regions.map((r) => r.name), e.id).not.toContain('울산');
      expect(e.regions.map((r) => r.name), e.id).not.toContain('세종');
    }
    expect(eras[0].regions.map((r) => r.name)).not.toContain('부산');
    expect(eras[1].regions.map((r) => r.name)).toContain('부산');
    expect(eras[2].regions.map((r) => r.name)).toEqual(expect.arrayContaining(['대구', '인천']));
    expect(eras[3].regions.map((r) => r.name)).toContain('광주');
    expect(eras[4].regions.map((r) => r.name)).toContain('대전');
    expect(String(getAny('birth-by-sido').eraRegionsNote)).toContain('설계값');
  });

  it('2026 시군구 재배분: 옛 구(인천 중·동·서구, 화성시)를 뺀 자리에 새 구 8개, 시도별 합과 전국 합 254,341이 그대로이고 규칙(인구 비례)을 다시 계산해도 같다', () => {
    const s = getAny('birth-by-sigungu');
    const ch = s.regionChanges2026 as {
      status: string;
      retired: string[];
      populationBasis: Record<string, number>;
      rows: Array<{ sido: string; name: string; births: number; tfr: number; from: string[]; parent?: string }>;
    };
    expect(ch.status).toBe('design');
    expect(ch.retired).toEqual(['인천 중구', '인천 동구', '인천 서구', '경기 화성시']);
    expect(ch.rows.map((r) => r.name)).toEqual(['제물포구', '영종구', '서해구', '검단구', '만세구', '효행구', '병점구', '동탄구']);
    const rows = rowsOf('birth-by-sigungu') as Array<{ sido: string; name: string; births: number; tfr: number }>;
    const old = (sido: string, name: string) => rows.find((r) => r.sido === sido && r.name === name)!;
    const pb = ch.populationBasis;
    const yeongjong = Math.round((old('인천', '중구').births * pb['영종구_2026_07']) / pb['인천중구_2026_06']);
    const [seohae, geomdan] = apportion(old('인천', '서구').births, [pb['서해구_2026_07'], pb['검단구_2026_07']]);
    const hw = apportion(old('경기', '화성시').births, [pb['만세구_2026_07'], pb['효행구_2026_07'], pb['병점구_2026_07'], pb['동탄구_2026_07']]);
    const byName = Object.fromEntries(ch.rows.map((r) => [r.name, r]));
    expect(byName['영종구'].births).toBe(yeongjong);
    expect(byName['제물포구'].births).toBe(old('인천', '중구').births - yeongjong + old('인천', '동구').births);
    expect(byName['서해구'].births).toBe(seohae);
    expect(byName['검단구'].births).toBe(geomdan);
    expect(['만세구', '효행구', '병점구', '동탄구'].map((n) => byName[n].births)).toEqual(hw);
    // 합 보존
    expect(byName['제물포구'].births + byName['영종구'].births).toBe(old('인천', '중구').births + old('인천', '동구').births);
    expect(byName['서해구'].births + byName['검단구'].births).toBe(old('인천', '서구').births);
    expect(sum(hw)).toBe(old('경기', '화성시').births);
    // 합계출산율은 옮겨 온 구의 값(설계값)
    expect(byName['영종구'].tfr).toBe(old('인천', '중구').tfr);
    expect(byName['검단구'].tfr).toBe(old('인천', '서구').tfr);
    expect(byName['동탄구'].tfr).toBe(old('경기', '화성시').tfr);
    expect(byName['제물포구'].tfr).toBeGreaterThanOrEqual(Math.min(old('인천', '중구').tfr, old('인천', '동구').tfr));
    expect(byName['제물포구'].tfr).toBeLessThanOrEqual(Math.max(old('인천', '중구').tfr, old('인천', '동구').tfr));
    // 인구 기준 값은 KOSIS 표(행정안전부 주민등록)에서 읽은 값: 새 4개 구 합 = 서구 2026.06 인구와 2026.07 합 근접, 화성시 4개 구 합 = 화성시 2026.07
    expect(pb['만세구_2026_07'] + pb['효행구_2026_07'] + pb['병점구_2026_07'] + pb['동탄구_2026_07']).toBe(999673);
    expect(pb['영종구_2026_07']).toBeLessThan(pb['인천중구_2026_06']);
  });

  it('기관 문구: sources 문서가 인천·화성 변경 확인과 설계값 규칙을 적는다', () => {
    for (const w of ['제물포구', '영종구', '서해구', '검단구', '만세구', '동탄구', '2026.7.1', '2026.2.1', '설계값']) expect(sourcesDoc, w).toContain(w);
  });
});

describe('경제 근거 보충: 생활비·금리 (R-157)', () => {
  it('가구당 월평균 소비지출(2025 전국 1인 이상): 12개 항목 합 = 소비지출(±2원), 분위가 높을수록 가구원 수·소비지출 증가, 큰 숫자 = 전체 평균 행', () => {
    const c = getAny('household-consumption');
    const items = c.items2025 as Record<string, number | string>;
    const parts = Object.entries(items)
      .filter(([k]) => k !== 'unit')
      .map(([, v]) => Number(v));
    expect(parts).toHaveLength(12);
    const rows = rowsOf('household-consumption') as Array<{ group: string; householdSize: number; expenditure: number; consumption: number }>;
    expect(rows.map((r) => r.group)).toEqual(['전체 평균', '1분위', '2분위', '3분위', '4분위', '5분위']);
    expect(Math.abs(sum(parts) - rows[0].consumption)).toBeLessThanOrEqual(2);
    expect(get('household-consumption').latest).toEqual({ year: 2025, value: rows[0].consumption });
    expect(rows[0].consumption).toBe(2939091);
    const q = rows.slice(1);
    for (let k = 1; k < q.length; k++) {
      expect(q[k].householdSize).toBeGreaterThan(q[k - 1].householdSize);
      expect(q[k].consumption).toBeGreaterThan(q[k - 1].consumption);
    }
    for (const r of rows) expect(r.consumption).toBeLessThan(r.expenditure);
    expect(c.unit).toBeNull();
    expect(c.notes).toContain('명목');
  });

  it('한국은행 기준금리: 변경일 내림차순, 값은 0.25%p 단위, 큰 숫자 = 최근 변경(2026-08-27 3.00%), 출처는 /portal/ 허용 경로', () => {
    const rows = rowsOf('base-rate') as Array<{ changedOn: string; ratePct: number }>;
    expect(rows).toHaveLength(25);
    for (let k = 1; k < rows.length; k++) expect(rows[k].changedOn < rows[k - 1].changedOn, rows[k].changedOn).toBe(true);
    for (const r of rows) expect(Math.round(r.ratePct * 4), r.changedOn).toBe(r.ratePct * 4);
    expect(rows[0]).toEqual({ changedOn: '2026-08-27', ratePct: 3 });
    expect(get('base-rate').latest).toEqual({ year: 2026, value: 3 });
    expect(get('base-rate').source!.url).toContain('www.bok.or.kr/portal/');
    expect(get('base-rate').definition).toContain('정책금리');
  });

  it('학자금대출 금리(2026년 2학기): 일반 상환 고정 1.7%·취업 후 상환 변동 1.7%', () => {
    const rows = rowsOf('student-loan-rate') as Array<{ type: string; rateType: string; ratePct: number }>;
    expect(rows.map((r) => [r.rateType, r.ratePct])).toEqual([
      ['고정금리', 1.7],
      ['변동금리', 1.7],
    ]);
    expect(get('student-loan-rate').source!.org).toBe('한국장학재단');
  });

  it('은행 대출금리(주택담보·신용)는 미확인이고 사유가 ECOS 인증키 API(C4)임을 적는다 — 설계값으로 표기하라는 안내 포함', () => {
    const u = get('household-loan-rate');
    expect(u.usable).toBe(false);
    expect(u.verification.reason).toContain('인증키');
    expect(u.verification.reason).toContain('설계값');
  });

  it('직업 근사값(occupation-proxy)이 2024 상반기인 이유: KOSIS 표 수록 기간이 거기까지(자료갱신 2024-10-08)임을 문서가 밝힌다', () => {
    expect(basisBlock('s-025')).toContain('수록 기간이 2024 상반기까지');
    expect(sourcesDoc).toContain('2024-10-08');
  });
});

describe('임차 전세·월세 구분 s-037 (R-267, M5 착수 조건, 2019년 값)', () => {
  type RentRow = { label: string; own: number; jeonse: number; depositMonthly: number; plainMonthly: number; free: number };
  const rent = rowsOf('rent-type-split') as unknown as RentRow[];
  const byRow = (label: string): RentRow => {
    const r = rent.find((x) => x.label === label);
    if (!r) throw new Error(`행 없음: ${label}`);
    return r;
  };
  const total = (r: RentRow): number => r.own + r.jeonse + r.depositMonthly + r.plainMonthly + r.free;

  it('확인된 표다: usable·verified, 기준 연도 2019, 출처가 종료된 점유형태 표(DT_MLTM_5402)이고 두 사이트 대조가 방법에 적혀 있다', () => {
    const i = get('rent-type-split');
    expect(i.usable).toBe(true);
    expect(i.verification.status).toBe('verified');
    expect(i.latest).toEqual({ year: 2019, value: 15.1 });
    expect(i.source!.url).toContain('DT_MLTM_5402');
    expect(i.source!.accessedOn).toBe('2026-10-17');
    expect(i.verification.method).toContain('통계누리');
    expect(i.verification.method).toContain('KOSIS');
    expect(i.basisId).toBe('s-037');
  });

  it('행 33개: 전국 + 17개 시도 + 소득계층(전국 저·중·고) + 수도권·광역시 등·도지역 × (전체·저·중·고). 행마다 합이 100.0±0.25(5개 열 각각 반올림, 전국·고소득층은 99.8)', () => {
    expect(rent).toHaveLength(33);
    expect(rent.slice(0, 18).map((r) => r.label)).toEqual(['전국', ...SIDO]);
    for (const r of rent) expect(Math.abs(total(r) - 100), r.label).toBeLessThanOrEqual(0.25);
  });

  it('전국 행은 원문 값 그대로다: 자가 58.0·전세 15.1·보증금 있는 월세 19.7·월세 3.3·무상 3.9 — 임차 합 38.1%는 2024년 임차 38.0%(s-024)와 거의 같다', () => {
    expect(byRow('전국')).toMatchObject({ own: 58, jeonse: 15.1, depositMonthly: 19.7, plainMonthly: 3.3, free: 3.9 });
    const r = byRow('전국');
    const rentTotal = r.jeonse + r.depositMonthly + r.plainMonthly;
    expect(Math.round(rentTotal * 10) / 10).toBe(38.1);
    const housing = rowsOf('housing-tenure') as Array<{ label: string; own: number; rent: number; free: number }>;
    const national2024 = housing.find((h) => h.label === '전국')!;
    expect(national2024.rent).toBe(38);
    expect(Math.abs(rentTotal - national2024.rent), '2019 임차 합 ↔ 2024 임차').toBeLessThanOrEqual(0.3);
  });

  it('서로 다른 두 표가 일치한다: 소득계층별 표에 전국 전체 행이 없어도, 저·중·고 가구 비중으로 가중한 전국 값이 시도별 표의 전국 행과 크게 다르지 않다(자가 ±1.0%p)', () => {
    // 소득 1~4분위 40%·5~8분위 40%·9~10분위 20%(주석정보) — 가구 수 가중이 아닌 분위 비중 근사
    const w = { '전국·저소득층': 0.4, '전국·중소득층': 0.4, '전국·고소득층': 0.2 } as const;
    const own = (Object.entries(w) as Array<[keyof typeof w, number]>).reduce((s, [k, v]) => s + byRow(k).own * v, 0);
    expect(Math.abs(own - byRow('전국').own)).toBeLessThanOrEqual(1);
  });

  it('G3 방향: 저소득층일수록 자가가 낮고 월세(보증금 있는 월세+월세) 비중이 높다 — 전국·수도권·광역시 등·도지역에서 모두', () => {
    for (const area of ['전국', '수도권', '광역시 등', '도지역']) {
      const low = byRow(area === '전국' ? '전국·저소득층' : `${area}·저소득층`);
      const high = byRow(area === '전국' ? '전국·고소득층' : `${area}·고소득층`);
      expect(low.own, area).toBeLessThan(high.own);
      expect(low.depositMonthly + low.plainMonthly, area).toBeGreaterThan(high.depositMonthly + high.plainMonthly);
    }
  });

  it('임차 안의 구성비(파생값): 전국 전세 39.6%·월세 60.4%, 저소득층 전세 22.9%·고소득층 69.9% — 설계 문서가 쓰는 값이 원자료에서 그대로 계산된다', () => {
    const share = (r: RentRow): { jeonse: number; monthly: number } => {
      const rt = r.jeonse + r.depositMonthly + r.plainMonthly;
      return { jeonse: r.jeonse / rt, monthly: (r.depositMonthly + r.plainMonthly) / rt };
    };
    expect(Math.round(share(byRow('전국')).jeonse * 1000) / 10).toBe(39.6);
    expect(Math.round(share(byRow('전국')).monthly * 1000) / 10).toBe(60.4);
    expect(Math.round(share(byRow('전국·저소득층')).jeonse * 1000) / 10).toBe(22.9);
    expect(Math.round(share(byRow('전국·중소득층')).jeonse * 1000) / 10).toBe(50.1);
    expect(Math.round(share(byRow('전국·고소득층')).jeonse * 1000) / 10).toBe(69.9);
  });

  it('한계가 데이터·근거 문서·수집 기록에 적혀 있다: 2019년 값(종료된 표)이고 2024 구성과 같다고 단정하지 않으며, 2024 보고서 PDF는 열람하지 않았다', () => {
    const notes = String(get('rent-type-split').notes);
    expect(notes).toContain('2019');
    expect(notes).toContain('단정하지 않는다');
    expect(notes).toContain('내려받지 않아');
    const block = basisBlock('s-037');
    expect(block).toContain('2019년 값이다');
    expect(block).toContain('**상태**: **확인**');
    expect(sourcesDoc).toContain('rent-type-split');
    expect(sourcesDoc).toContain('DT_MLTM_5402');
    expect(sourcesDoc).toContain('DT_MLTM_5405');
  });
});

describe('extraSeries 단위 (R-185): 주 단위와 다른 extraSeries는 unit이 필수', () => {
  // 라벨에 단위 풀이가 있는 보조 계열 — 「만 원」「천 건」「천 명」「인구 N명당 …」은 주 시리즈 단위(%·명·건 등)와 다르다.
  const UNIT_HINT = /(만 원|천 건|천 명|인구 [^,)]*당[^,)]*)/;
  const extras = USABLE.flatMap((i) => (i.extraSeries ?? []).map((e) => ({ id: i.id, main: i.unit, e: e as { label: string; unit?: string; decimals?: number } })));

  it('보조 계열이 있는 지표를 읽는다(공허 통과 방지)', () => {
    expect(extras.length).toBeGreaterThanOrEqual(10);
  });

  it('라벨에 단위 풀이(만 원·천 건·천 명·인구 N명당)가 있으면 unit이 있고, 그 unit이 라벨 안에 그대로 있다 — 주 시리즈 단위로 잘못 읽히지 않는다', () => {
    let checked = 0;
    for (const { id, e } of extras) {
      const hint = UNIT_HINT.exec(e.label);
      if (hint === null) continue;
      checked++;
      expect(typeof e.unit, `${id}/${e.label}: unit 필수`).toBe('string');
      expect(e.label, `${id}/${e.label}: 라벨 안 단위`).toContain(e.unit!);
      expect(Number.isInteger(e.decimals), `${id}/${e.label}: decimals`).toBe(true);
    }
    expect(checked).toBeGreaterThanOrEqual(5); // 사교육비·연령별 사망률·이혼 건수·조이혼율·조혼인율
  });

  it('private-education 월평균 사교육비 보조 계열: unit 「만 원」·decimals 1 — 주 시리즈 「%」로 읽히지 않는다', () => {
    const p = get('private-education');
    const cost = p.extraSeries![0] as { unit?: string; decimals?: number; label: string };
    expect(p.unit).toBe('%');
    expect(cost.unit).toBe('만 원');
    expect(cost.decimals).toBe(1);
  });

  it('unit을 적은 보조 계열은 주 단위와 같은 말을 되풀이하지 않는다(적은 이유가 있다): unit ≠ 주 시리즈 unit', () => {
    for (const { id, main, e } of extras) {
      if (e.unit !== undefined) expect(e.unit, `${id}/${e.label}`).not.toBe(main);
    }
  });
});

describe('주거비 부담 s-063 (M5 2a, 2024 주거실태조사 보도자료)', () => {
  type Row = { label: string; rirPct: number; rirPrev: number; pir: number; pirPrev: number };
  const rows = rowsOf('housing-cost-burden') as unknown as Row[];
  const row = (label: string): Row => {
    const r = rows.find((x) => x.label === label);
    if (!r) throw new Error(`행 없음: ${label}`);
    return r;
  };

  it('확인된 표다: usable, 2024, 출처가 국토교통부 보도자료 본문, 첨부 파일을 내려받지 않았다고 방법에 적혀 있다', () => {
    const i = get('housing-cost-burden');
    expect(i.usable).toBe(true);
    expect(i.latest).toEqual({ year: 2024, value: 15.8 });
    expect(i.basisId).toBe('s-063');
    expect(i.source!.org).toBe('국토교통부');
    expect(i.source!.url).toContain('molit.go.kr');
    expect(i.verification.method).toContain('내려받지 않');
    expect(rows).toHaveLength(7);
  });

  it('값이 보도자료와 같다: 전국 15.8%·6.3배, 수도권 18.4·8.7, 광역시 등 15.2·6.3, 도지역 12.7·4.0, 청년 16.0·6.0, 신혼 17.7·6.0, 고령 25.4·9.1', () => {
    expect([row('전국').rirPct, row('전국').pir]).toEqual([15.8, 6.3]);
    expect([row('수도권').rirPct, row('수도권').pir]).toEqual([18.4, 8.7]);
    expect([row('광역시 등').rirPct, row('광역시 등').pir]).toEqual([15.2, 6.3]);
    expect([row('도지역').rirPct, row('도지역').pir]).toEqual([12.7, 4]);
    expect([row('청년 가구').rirPct, row('청년 가구').pir]).toEqual([16, 6]);
    expect([row('신혼부부 가구').rirPct, row('신혼부부 가구').pir]).toEqual([17.7, 6]);
    expect([row('고령 가구').rirPct, row('고령 가구').pir]).toEqual([25.4, 9.1]);
  });

  it('본문의 서술과 맞는다: 수도권 > 광역시 등 > 도지역(월임대료 비율·주택가격 배수), 지역 RIR은 모두 전년보다 줄었고, 청년 RIR은 1.4%p 낮아졌다(17.4 → 16.0)', () => {
    expect(row('수도권').rirPct).toBeGreaterThan(row('광역시 등').rirPct);
    expect(row('광역시 등').rirPct).toBeGreaterThan(row('도지역').rirPct);
    expect(row('수도권').pir).toBeGreaterThan(row('광역시 등').pir);
    expect(row('광역시 등').pir).toBeGreaterThan(row('도지역').pir);
    for (const k of ['수도권', '광역시 등', '도지역']) expect(row(k).rirPct, k).toBeLessThan(row(k).rirPrev);
    expect(Math.round((row('청년 가구').rirPrev - row('청년 가구').rirPct) * 10) / 10).toBe(1.4);
  });

  it('경제 모델이 쓰는 월세 비율(src/data/economyTable.ts)은 이 표의 전국 15.8%에서 온다', async () => {
    const { ECONOMY } = await import('../src/data/economyTable');
    expect(ECONOMY.housing.rentRate).toBe(row('전국').rirPct / 100);
  });
});
