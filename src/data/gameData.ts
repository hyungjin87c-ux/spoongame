import { installGameData, isGameDataReady } from '../core/gameData';

/**
 * 「태어나기」 뒤에 불러오는 게임 데이터 덩어리 (SPEC-004 MG8 — 지연 로드). 첫 화면(≤ 400,000B)이 이 데이터를 받지 않도록 **동적 import**로만 닿는다:
 * 이벤트 풀(5개 JSON, 검증 포함), 출생 연도 표(연도별 출생아 수·시·도 비율), 인용 테이블(citations.json), 이름 풀(names.json·법원 원자료 — 첫 화면은 출처 줄만 `titleText.ts`에 따로 갖는다, R-520). 앱 코드는 이 파일을 `import()`로만 부르고, 정적으로 `data/events`·`data/birthYearData`를 import하지 않는다
 * (`tests/lazyBoundary.test.ts`가 앱 쪽 import 그래프를 잠근다). 시험·스크립트는 같은 데이터를 `data/installAll.ts`가 정적으로 놓는다.
 *
 * 중복 요청 없음: 한 번 시작한 로드는 약속(Promise) 하나를 공유한다 — 「태어나기」 연타·새로고침 연타에도 같은 덩어리를 두 번 요청하지 않는다. 실패하면 다음 호출이 다시 시도한다(「다시 시도」).
 * 첫 화면 유휴 중 미리 받기(prefetch)는 없다 — 「태어나기」(또는 진행 중인 저장의 복원)가 부를 때만 시작한다.
 */
let pending: Promise<void> | null = null;

export function loadGameData(): Promise<void> {
  if (isGameDataReady()) return Promise.resolve();
  if (pending !== null) return pending;
  pending = Promise.all([import('./events'), import('./birthYearData'), import('./citationsAccess'), import('./names')])
    .then(([events, years, citations, names]) => {
      installGameData({ eventPool: events.EVENT_POOL, birthYears: years.BIRTH_YEAR_TABLES, citations: citations.CITATION_TABLE, names: names.NAMES_API });
    })
    .catch((e: unknown) => {
      pending = null; // 실패하면 다시 시도할 수 있게 푼다
      throw e;
    });
  return pending;
}
