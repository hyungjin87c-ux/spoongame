import reserveJson from './koreaStatsReserve.json';
import { BASE_STATS_FILE, type StatsFile } from './koreaStatsAccess';
import { mergeReserve, type ReserveFile } from './koreaStatsReserve';

/**
 * 예비 지표까지 합친 **전체** 통계 데이터(동기) — 시험·점검 도구(`scripts/checkBasis.ts` 등)가 「모든 지표」를 훑을 때 쓴다.
 * 원래 한 파일(`koreaStats.json`)이던 때와 같은 지표 순서·같은 필드다(tests/koreaStatsReserve.test.ts가 지표 수·순서·예비 필드를 대조한다).
 *
 * **앱 코드(`src/`)는 이 파일을 가져오지 않는다**: 가져오면 `koreaStatsReserve.json`이 첫 화면 묶음으로 돌아와 초기 로드가 약 11KB 늘어난다
 * (SPEC-005 QI4 2단계 마스터 결정 ② (b)). 앱에서 예비 지표가 필요하면 `koreaStatsReserve.ts`의 `loadReserveStats()`(지연 로드)를 쓴다.
 */
export const FULL_STATS: StatsFile = mergeReserve(BASE_STATS_FILE, reserveJson as unknown as ReserveFile);
