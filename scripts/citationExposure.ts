import { exposureReport } from './citationExposureLib';

/**
 * 인용 박스 노출률 보고 (npm run report:citations [판수=1000]): 시대별 정적 연결률(MD2 1차 게이트 판정)과 자동 성향 N판의 노출률(보고)을 나란히 적는다.
 * 보고 전용이라 실패 코드를 내지 않는다 — 게이트는 tests/citationLink.test.ts가 판정한다.
 */
const lives = Number(process.argv[2] ?? 1000);
console.log(exposureReport(Number.isInteger(lives) && lives > 0 ? lives : 1000));
