import { ERA_ACTUAL_LAST_YEAR, eraDecadeOf, type EraWindow } from '../core';
import { loadEraDecade } from '../data/familyArtLoader';

/**
 * 「이 삶의 이름들」 덩어리의 지연 로더 (SPEC-022 EC1 9항). **회고 화면이 버튼을 누른 뒤에만** 부른다 — 첫 화면·유휴 중 미리 받기는 없다(`tests/lazyBoundary.test.ts`가 호출처를 잠근다).
 *  - 화면 덩어리(`CreditsScreen` + 줄 모델 + 허용 목록 + `credits.css`)와 시대의 창 10년 덩어리(출생 + 20세의 10년대부터 min(사망 연도, 2026)의 10년대까지)를 **모두** 받은 다음에야 돌려준다 —
 *    받은 것만으로 줄을 고르거나 시대 장이 빠진 전문을 내지 않는다.
 *  - 화면 덩어리는 약속 하나를 공유한다(연타해도 한 번). 실패하면 약속을 풀어 「다시 시도」가 새 요청을 보낸다(`data/gameData.ts`·`familyArtLoader.ts`와 같은 방식). 10년 덩어리는 `loadEraDecade`가 같은 방식으로 한 번만 받는다.
 *  - 이 파일은 첫 덩어리에 들어가므로 작게 둔다 — 화면·모델·허용 목록은 동적 `import()` 안에만 있다.
 */

type ScreenModule = typeof import('./CreditsScreen');

export interface CreditsLoaded {
  Screen: ScreenModule['CreditsScreen'];
  /** 받은 10년 덩어리들의 장면 합 */
  windows: EraWindow[];
}

let screenPending: Promise<ScreenModule> | null = null;

/** 화면 덩어리 하나(공유 약속) */
export function loadCreditsScreen(): Promise<ScreenModule> {
  if (screenPending === null) {
    screenPending = import('./CreditsScreen').catch((e: unknown) => {
      screenPending = null;
      throw e;
    });
  }
  return screenPending;
}

/** 시대 줄에 필요한 10년 덩어리 번호: 게임 나이 20이 되는 해의 10년대부터 min(사망 연도, 2026)의 10년대까지. 20세 전 사망·범위가 빈 판(출생 2007 이상)·출생신고가 없는 판은 비어 있다 */
export function creditsDecadesOf(birthYear: number, deathAge: number, hasReport: boolean): number[] {
  const from = birthYear + 20;
  const to = Math.min(birthYear + deathAge, ERA_ACTUAL_LAST_YEAR);
  if (!hasReport || deathAge < 20 || from > to) return [];
  const out: number[] = [];
  for (let d = eraDecadeOf(from); d <= eraDecadeOf(to); d += 10) out.push(d);
  return out;
}

/** 화면 덩어리와 필요한 10년 덩어리를 모두 받는다 */
export function loadCredits(birthYear: number, deathAge: number, hasReport: boolean): Promise<CreditsLoaded> {
  return Promise.all([loadCreditsScreen(), Promise.all(creditsDecadesOf(birthYear, deathAge, hasReport).map(loadEraDecade))]).then(([m, parts]) => ({
    Screen: m.CreditsScreen,
    windows: parts.flatMap((p) => [...p.windows]),
  }));
}
