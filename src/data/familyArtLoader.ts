import type { EraDecadeData } from './eraWindows/types';
import type { FamilyArt } from './sceneTables';

/**
 * 그림 덩어리의 지연 로드 (SPEC-009 FM5, family-model.md A-10): `familyArt`(집과 가족 그림 조각)는 표 덩어리 `familyData`와 **따로**, 시대의 창 그림은 **10년 하위 덩어리**로 나뉘어 필요한 만큼만 동적 `import()`로 받는다.
 * 앱 코드는 이 파일의 함수로만 부르고 `data/familyArt`·`data/eraWindows`를 정적으로 import하지 않는다(`tests/lazyBoundary.test.ts`가 앱 쪽 import 그래프를 잠근다) — 첫 화면의 초기 로드(≤ 400,000B)에 들어가지 않는다.
 * 불러오는 시점은 집과 가족 그림 카드가 처음 그려질 때(= 「태어나기」 뒤 인생 화면, 또는 저장 복원 때)뿐이고 첫 화면 유휴 중 미리 받기(prefetch)는 없다.
 *
 * 중복 요청 없음: 한 번 시작한 로드는 약속(Promise) 하나를 공유한다. 실패하면 다음 호출이 다시 시도한다(「다시 불러오기」). 그림 덩어리 로드가 실패해도 게임은 계속되고 그림 칸만 빈다 — 모든 정보는 글에도 있다(FH6).
 */
let artLoaded: FamilyArt | null = null;
let artPending: Promise<FamilyArt> | null = null;

/** 이미 받은 그림 덩어리 (없으면 null) — 받은 뒤 다시 그리는 화면이 동기로 읽는다 */
export function familyArtIfLoaded(): FamilyArt | null {
  return artLoaded;
}

export function loadFamilyArt(): Promise<FamilyArt> {
  if (artLoaded !== null) return Promise.resolve(artLoaded);
  if (artPending !== null) return artPending;
  artPending = import('./familyArt')
    .then((m) => {
      artLoaded = m.FAMILY_ART;
      return m.FAMILY_ART;
    })
    .catch((e: unknown) => {
      artPending = null; // 실패하면 다시 시도할 수 있게 푼다
      throw e;
    });
  return artPending;
}

const decadeLoaded = new Map<number, EraDecadeData>();
const decadePending = new Map<number, Promise<EraDecadeData>>();

export function eraDecadeIfLoaded(decade: number): EraDecadeData | null {
  return decadeLoaded.get(decade) ?? null;
}

/** 시대의 창 10년 덩어리 하나. 그 10년대에 승인된 그림이 없으면 아무것도 받지 않고 빈 데이터를 돌려준다 */
export function loadEraDecade(decade: number): Promise<EraDecadeData> {
  const done = decadeLoaded.get(decade);
  if (done !== undefined) return Promise.resolve(done);
  const running = decadePending.get(decade);
  if (running !== undefined) return running;
  const p = import('./eraWindows')
    .then((m) => {
      const load = m.ERA_DECADES_WITH_DATA.includes(decade) ? m.ERA_DECADE_LOADERS[decade] : undefined;
      return load === undefined ? Promise.resolve<EraDecadeData>({ windows: [], art: {} }) : load();
    })
    .then((data) => {
      decadeLoaded.set(decade, data);
      return data;
    })
    .catch((e: unknown) => {
      decadePending.delete(decade);
      throw e;
    });
  decadePending.set(decade, p);
  return p;
}

/** 시험 전용: 받은 덩어리를 비운다(로드 전 상태를 시험할 때) */
export function resetFamilyArtForTest(): void {
  artLoaded = null;
  artPending = null;
  decadeLoaded.clear();
  decadePending.clear();
}
