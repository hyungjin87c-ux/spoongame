import { installGameData } from '../core/gameData';
import { BIRTH_YEAR_TABLES } from './birthYearData';
import { CITATION_TABLE } from './citationsAccess';
import { EVENT_POOL } from './events';

/**
 * 시험·스크립트 전용: 지연 로드 덩어리(`data/gameData.ts`)가 놓는 것과 **같은 데이터**를 정적으로 놓는다 (MG8). 앱은 이 파일을 import하지 않는다 —
 * import하면 이벤트 풀이 첫 화면 덩어리에 들어가기 때문이다(`tests/lazyBoundary.test.ts`가 앱 쪽 import 그래프를 잠근다).
 * vitest는 `tests/setup.ts`가, 스크립트는 `scripts/*`가 import한다.
 */
installGameData({ eventPool: EVENT_POOL, birthYears: BIRTH_YEAR_TABLES, citations: CITATION_TABLE });
