import { BASE_STATS_FILE, createStatsAccess, type RawIndicator, type StatsAccess, type StatsFile } from './koreaStatsAccess';

/**
 * 첫 화면 묶음에서 뺀 예비 지표 (SPEC-005 QI4 2단계, QI6·QI7 뒤 마스터 결정 ② (b) — 초기 로드 ≤ 400,000B를 모든 브라우저에서).
 *
 * `koreaStats.json`은 첫 화면과 게임 코드가 id로 읽는 지표만 담고, 지금 어떤 화면도 읽지 않는 값은 `koreaStatsReserve.json`에 따로 둔다:
 *  - 예비 전망 3개(`projection-working-age`·`projection-tfr`·`projection-life-expectancy` — SPEC-004 PJ가 재사용할 자리, 마스터 결정 1·4)
 *  - 연령 세부 빈곤율 `poverty-by-age-band`
 *  - 격차 지표 `income-gap-by-age`의 시장소득·지니계수 `measures`(슬라이드는 처분가능소득 5분위배율만 읽는다, 마스터 결정 5)
 * 합쳐서 gzip 약 11KB다. 기본 접근자(`koreaStatsAccess.ts`의 `getUsableIndicator` 등)는 이 값을 **돌려주지 않는다** — 필요한 곳은 아래 `loadReserveStats()`로 **그때** 불러온다
 * (`import()`라 빌드가 별도 청크로 내보내고 `index.html`은 그 청크를 미리 받지 않는다). 시험·점검 도구처럼 동기로 전체를 보려면 `koreaStatsFull.ts`의 `FULL_STATS`를 쓴다 —
 * **앱 코드(`src/`)는 `koreaStatsFull`을 가져오지 않는다**(가져오면 예비 지표가 첫 화면 묶음으로 돌아온다, tests/koreaStatsReserve.test.ts가 소스를 훑어 잠근다).
 *
 * 예비 파일 모양: `entries` = 통째로 옮긴 지표(`after` = 원래 바로 앞에 있던 지표 id — 합칠 때 그 뒤에 끼워 원래 순서가 된다), `overlays` = 지표 안의 큰 필드만 옮긴 것(`id`의 지표에 `fields`를 덧붙인다).
 */

export interface ReserveEntry {
  /** 이 지표 바로 뒤에 끼운다 */
  after: string;
  indicator: RawIndicator;
}
export interface ReserveOverlay {
  id: string;
  fields: Record<string, unknown>;
}
export interface ReserveFile {
  note: string;
  entries: ReserveEntry[];
  overlays: ReserveOverlay[];
}

/** 기본 데이터에 예비 지표를 합친 전체 데이터(원래 한 파일일 때와 같은 지표 순서·같은 필드). 원본을 고치지 않고 복사본을 돌려준다. */
export function mergeReserve(core: StatsFile, reserve: ReserveFile): StatsFile {
  const indicators = [...core.indicators];
  for (const e of reserve.entries) {
    const at = indicators.findIndex((i) => i.id === e.after);
    if (at < 0) throw new Error(`예비 지표 ${e.indicator.id}를 끼울 자리(${e.after})가 기본 데이터에 없다`);
    indicators.splice(at + 1, 0, e.indicator);
  }
  for (const o of reserve.overlays) {
    const at = indicators.findIndex((i) => i.id === o.id);
    if (at < 0) throw new Error(`예비 필드를 덧붙일 지표(${o.id})가 없다`);
    indicators[at] = { ...indicators[at], ...o.fields };
  }
  return { ...core, indicators };
}

/** 예비 지표까지 담은 접근자. 처음 부를 때 예비 파일을 내려받는다(별도 청크). 첫 화면은 부르지 않는다. */
export async function loadReserveStats(): Promise<StatsAccess> {
  const reserve = (await import('./koreaStatsReserve.json')).default as unknown as ReserveFile;
  return createStatsAccess(mergeReserve(BASE_STATS_FILE, reserve));
}
