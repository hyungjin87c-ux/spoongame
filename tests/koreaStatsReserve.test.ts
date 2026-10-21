import { describe, expect, it } from 'vitest';
import reserveJson from '../src/data/koreaStatsReserve.json';
import { BASE_STATS_FILE, CAROUSEL_ORDER, createStatsAccess, getUsableIndicator, type RawIndicator, type StatsFile } from '../src/data/koreaStatsAccess';
import { FULL_STATS } from '../src/data/koreaStatsFull';
import { loadReserveStats, mergeReserve, type ReserveFile } from '../src/data/koreaStatsReserve';

/**
 * 첫 화면 묶음에서 뺀 예비 지표 (SPEC-005 QI4 2단계, QI6·QI7 뒤 마스터 결정 ② (b) — 초기 로드 ≤ 400,000B를 모든 브라우저에서, CM-A 코드·데이터 증가 ≤ +30KB).
 * 방식(기록: ai-log/2026-10-21_SPEC-005_dev-QI4-2.md 번들 절): `koreaStats.json`에는 첫 화면·게임 코드가 id로 읽는 지표만 두고, **앱 코드가 id로 읽지 않는** 값 —
 * 예비 전망 3개(SPEC-004 PJ 재사용 자리)·옛 전망 요약 future-projection·연령 세부 빈곤율·근거 수집용(research) 지표 23개·격차 지표의 시장소득/지니계수 measures — 은
 * `koreaStatsReserve.json`으로 옮겼다. 앱은 정적으로 가져오지 않고(`loadReserveStats()`의 `import()` 지연 로드), 시험·점검 도구는 합친 전체(`koreaStatsFull.ts`)를 본다.
 * 이 시험은 (1) 합치면 원래 한 파일일 때와 같은 지표·순서·필드가 되는지 (2) 첫 화면 묶음에 예비가 새어 들어가지 않는지 (3) 예비로 옮긴 지표를 앱 코드가 id로 읽기 시작하면 걸리는지를 잠근다.
 */

const reserve = reserveJson as unknown as ReserveFile;
const RESERVE_IDS = reserve.entries.map((e) => e.indicator.id);
/** 처음 옮긴 넷(예비 전망 3개 + 연령 세부 빈곤율) — 이름으로 못 박아 두는 것 */
const FIRST_FOUR = ['projection-working-age', 'projection-tfr', 'projection-life-expectancy', 'poverty-by-age-band'];

describe('예비 지표 분리 — 합치면 원래 한 파일이다', () => {
  it('기본 파일 55개 + 예비 28개 = 전체 83개이고, 끝 9개의 순서가 원래와 같다 (총인구 · 65세 이상 · 생산연령 · 아기 · 출산율 · 기대수명 · 1인 가구 · 격차 · 연령 세부 빈곤율)', () => {
    expect(BASE_STATS_FILE.indicators).toHaveLength(55);
    expect(RESERVE_IDS).toHaveLength(28);
    expect(RESERVE_IDS).toEqual(expect.arrayContaining(FIRST_FOUR));
    expect(FULL_STATS.indicators).toHaveLength(83);
    expect(FULL_STATS.indicators.slice(-9).map((i) => i.id)).toEqual([
      'projection-population-total',
      'projection-aging-share',
      'projection-working-age',
      'projection-newborn-age-structure',
      'projection-tfr',
      'projection-life-expectancy',
      'projection-one-person-households',
      'income-gap-by-age',
      'poverty-by-age-band',
    ]);
    // 기본 파일에 남은 지표의 상대 순서는 원래와 같다(합친 전체에서 예비를 빼면 기본 파일 순서)
    expect(FULL_STATS.indicators.filter((i) => !RESERVE_IDS.includes(i.id)).map((i) => i.id)).toEqual(BASE_STATS_FILE.indicators.map((i) => i.id));
    expect(new Set(FULL_STATS.indicators.map((i) => i.id)).size).toBe(83);
    expect(new Set(FULL_STATS.indicators.map((i) => i.basisId)).size).toBe(83);
  });

  it('기본 파일에는 예비 지표 id와 격차 measures가 없고, 합친 전체에는 있다 — 예비는 캐러셀 지표가 아니다', () => {
    const baseIds = BASE_STATS_FILE.indicators.map((i) => i.id);
    for (const id of RESERVE_IDS) expect(baseIds, id).not.toContain(id);
    const baseGap = BASE_STATS_FILE.indicators.find((i) => i.id === 'income-gap-by-age')!;
    const fullGap = FULL_STATS.indicators.find((i) => i.id === 'income-gap-by-age')!;
    expect(baseGap.measures).toBeUndefined();
    expect(Array.isArray(fullGap.measures)).toBe(true);
    expect((fullGap.measures as unknown[]).length).toBe(4); // 소득 5분위배율·지니계수 × 처분가능소득·시장소득
    // measures를 뺀 나머지 필드는 같다
    const { measures: _m, ...rest } = fullGap;
    expect(JSON.stringify(rest)).toBe(JSON.stringify(baseGap));
    for (const e of reserve.entries) expect(e.indicator.use, e.indicator.id).not.toContain('carousel');
    // 예비 지표의 use는 근거 수집용(research)·예비 전망(future)뿐이다 — 경제·출생·사망·풍자용 지표는 게임 기능이 읽을 수 있어 첫 화면 묶음에 둔다
    for (const e of reserve.entries) for (const u of e.indicator.use) expect(['research', 'future'], `${e.indicator.id} use ${u}`).toContain(u);
  });

  it('기본 접근자는 예비를 돌려주지 않고, 지연 로드 접근자(loadReserveStats)는 돌려준다', async () => {
    for (const id of RESERVE_IDS) expect(getUsableIndicator(id), id).toBeUndefined();
    const full = await loadReserveStats();
    // 미확인(usable: false)이 아닌 예비 지표는 접근자가 돌려준다. 미확인 하나(korean-children-panel)는 합친 접근자도 돌려주지 않는다(R-147 e)
    for (const e of reserve.entries) expect(full.getUsableIndicator(e.indicator.id) !== undefined, e.indicator.id).toBe(e.indicator.usable);
    expect(full.getUsableIndicator('income-gap-by-age')!.measures).toBeDefined();
    // 캐러셀 지표는 둘이 같다 — 예비는 캐러셀에 없다
    expect(full.getCarouselIndicators().map((i) => i.id)).toEqual([...CAROUSEL_ORDER]);
    expect(full.getUsableIndicators().length).toBe(createStatsAccess(FULL_STATS).getUsableIndicators().length);
  });

  it('mergeReserve는 원본을 고치지 않고, 끼울 자리·덧붙일 지표가 없으면 멈춘다(조용히 틀린 데이터를 만들지 않는다)', () => {
    const before = JSON.stringify(BASE_STATS_FILE);
    const merged = mergeReserve(BASE_STATS_FILE, reserve);
    expect(JSON.stringify(BASE_STATS_FILE)).toBe(before);
    expect(merged.indicators).toHaveLength(83);
    const noAnchor: ReserveFile = { ...reserve, entries: [{ after: 'no-such-id', indicator: { id: 'x' } as RawIndicator }] };
    expect(() => mergeReserve(BASE_STATS_FILE, noAnchor)).toThrow(/끼울 자리/);
    const noTarget: ReserveFile = { ...reserve, entries: [], overlays: [{ id: 'no-such-id', fields: {} }] };
    expect(() => mergeReserve(BASE_STATS_FILE, noTarget)).toThrow(/덧붙일 지표/);
    // 같은 데이터를 두 번 합쳐도 같다
    expect(JSON.stringify(mergeReserve(BASE_STATS_FILE as StatsFile, reserve))).toBe(JSON.stringify(merged));
  });
});

describe('앱 코드는 예비 파일을 첫 화면 묶음에 끌어들이지 않는다 (초기 로드 ≤ 400,000B)', () => {
  const sources = import.meta.glob('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const strip = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  const files = Object.entries(sources).map(([path, raw]) => ({ file: path.replace('../', ''), code: strip(raw) }));

  it('src에서 koreaStatsFull(합친 전체)을 가져오는 파일이 없다 — 시험·점검 도구 전용이다', () => {
    expect(files.length, '공허 통과 방지: src를 읽었다').toBeGreaterThan(40);
    const importers = files.filter((f) => f.file !== 'src/data/koreaStatsFull.ts' && /koreaStatsFull/.test(f.code)).map((f) => f.file);
    expect(importers).toEqual([]);
  });

  it('koreaStatsReserve.json을 말하는 파일은 koreaStatsFull.ts(정적)와 koreaStatsReserve.ts(지연 import() 하나)뿐이다', () => {
    const mention = files.filter((f) => /koreaStatsReserve\.json/.test(f.code)).map((f) => f.file).sort();
    expect(mention).toEqual(['src/data/koreaStatsFull.ts', 'src/data/koreaStatsReserve.ts']);
    const reserveTs = files.find((f) => f.file === 'src/data/koreaStatsReserve.ts')!.code;
    expect(reserveTs).toMatch(/await import\('\.\/koreaStatsReserve\.json'\)/);
    expect(reserveTs, '정적 가져오기가 없다').not.toMatch(/^\s*import\s[^;]*koreaStatsReserve\.json/m);
  });

  it('앱 화면·핵심 코드가 loadReserveStats를 부르지 않는다 — 지금은 쓰는 곳이 없어 빌드에서 별도 청크도 만들어지지 않는다(예비는 초기 로드 0B)', () => {
    const users = files.filter((f) => f.file !== 'src/data/koreaStatsReserve.ts' && /loadReserveStats/.test(f.code)).map((f) => f.file);
    expect(users).toEqual([]);
  });

  /**
   * 예비로 옮긴 지표를 앱 코드가 id로 읽기 시작하면 첫 화면 묶음에서는 undefined가 된다 — 그때 이 시험이 걸려 (a) 그 지표를 기본 파일로 되돌리거나 (b) 그 코드를 loadReserveStats로 바꾸게 한다.
   * 훑는 곳: src 전체의 코드(주석 제외)에서 따옴표로 감싼 id. 예비 파일을 다루는 두 모듈(koreaStatsReserve.ts·koreaStatsFull.ts)은 제외한다.
   */
  it('예비 지표 id를 따옴표 글자로 읽는 앱 코드가 없다 (예: getUsableIndicator(\'daycare\') 같은 호출이 생기면 걸린다)', () => {
    const app = files.filter((f) => !/koreaStatsReserve|koreaStatsFull/.test(f.file));
    const hits: string[] = [];
    for (const id of RESERVE_IDS) {
      const re = new RegExp(`['"\`]${id.replace(/-/g, '\\-')}['"\`]`);
      for (const f of app) if (re.test(f.code)) hits.push(`${f.file}: ${id}`);
    }
    expect(hits).toEqual([]);
    // 시험이 실제로 잡는다: 기본 파일에 있는 지표(births)는 앱 코드가 읽는 것이 보인다
    const re = /['"`]births['"`]/;
    expect(app.some((f) => re.test(f.code))).toBe(true);
  });

  it('예비 파일의 크기: 합쳐서 gzip 약 28KB — 첫 화면 묶음에서 빠진 만큼이다 (기본 파일은 그만큼 작다)', async () => {
    const spec = 'node:zlib'; // 브라우저용 타입에는 node:zlib이 없어 변수로 가져온다(tests/carousel.test.ts의 readText와 같은 방법)
    const { gzipSync } = (await import(/* @vite-ignore */ spec)) as { gzipSync(data: string, options: { level: number }): { length: number } };
    const gz = (v: unknown) => gzipSync(JSON.stringify(v), { level: 9 }).length;
    expect(gz(reserve)).toBeGreaterThan(25_000);
    expect(gz(reserve)).toBeLessThan(31_000);
    expect(gz(BASE_STATS_FILE)).toBeLessThan(55_000);
  });
});
