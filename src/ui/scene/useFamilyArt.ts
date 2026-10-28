import { useCallback, useEffect, useRef, useState } from 'react';
import { eraDecadeOf, type EraWindow } from '../../core/eraWindow';
import { eraDecadeIfLoaded, familyArtIfLoaded, loadEraDecade, loadFamilyArt } from '../../data/familyArtLoader';
import type { EraDecadeData } from '../../data/eraWindows/types';
import type { FamilyArt } from '../../data/sceneTables';

/**
 * 그림 덩어리 훅 (SPEC-009 FM5, FH9): 집과 가족 그림 카드가 처음 그려질 때 `familyArt`를 받는다(= 「태어나기」 뒤 인생 화면, 또는 저장 복원 때 — 첫 화면에서는 받지 않는다).
 *  - 로딩 중: `status: 'loading'` — 카드는 그림 자리 틀(크기 고정, 레이아웃 이동 0)과 **아래 한 줄·펼침을 먼저** 보인다. 도착하면 그림으로 바꾼다.
 *  - 실패: `status: 'failed'` — 게임은 계속되고 그림 칸만 빈다. `retry()`가 「다시 불러오기」다. 같은 덩어리를 두 번 요청하지 않는다(`data/familyArtLoader.ts`가 약속 하나를 공유한다).
 *  - 이미 받은 덩어리는 첫 렌더부터 `ready`다(새 판·새로고침 뒤 카드가 다시 뜰 때 깜박이지 않는다).
 */
export type ArtStatus = 'loading' | 'ready' | 'failed';

export function useFamilyArt(): { art: FamilyArt | null; status: ArtStatus; retry: () => void } {
  const [art, setArt] = useState<FamilyArt | null>(() => familyArtIfLoaded());
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (art !== null) return;
    let alive = true;
    setFailed(false);
    loadFamilyArt().then(
      (a) => {
        if (alive) setArt(a);
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [art, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { art, status: art !== null ? 'ready' : failed ? 'failed' : 'loading', retry };
}

/** 이 10년대 번호들(오름차순)에서 받아야 하는 것: 그림이 있는 10년대만 */
function neededDecades(art: FamilyArt | null, birthYear: number, calYear: number): number[] {
  if (art === null) return [];
  const from = eraDecadeOf(birthYear);
  const to = eraDecadeOf(calYear);
  return art.eraDecades.filter((d) => d >= from && d <= to);
}

export interface EraData {
  /** 지금까지 받은 승인된 장면 전부(10년 덩어리의 합) */
  windows: readonly EraWindow[];
  /** 장면 id → 그림 마크업(그 10년 덩어리의 defs + 조각 도형) */
  art: Readonly<Record<string, string>>;
}
const NONE: EraData = { windows: [], art: {} };

/**
 * 시대의 창 10년 하위 덩어리를 필요한 만큼 이어받는다 (family-model.md 9-5절): 출생 10년대부터 지금 10년대까지 승인된 그림이 있는 덩어리를 **하나씩 차례로** 받는다(한 번에 받는 양을 줄이려고).
 * 승인된 그림이 있는 10년대가 없으면(지금) 아무것도 요청하지 않는다. 받지 못한 덩어리는 건너뛴다(그 해의 창이 빈 틀로 남고 게임은 계속된다).
 */
export function useEraData(art: FamilyArt | null, birthYear: number, calYear: number): EraData {
  const decades = neededDecades(art, birthYear, calYear);
  const key = decades.join(',');
  const read = (): EraData => mergeEraData(decades.map((d) => eraDecadeIfLoaded(d)));
  const [data, setData] = useState<EraData>(read);
  const seq = useRef(0);
  useEffect(() => {
    const mine = ++seq.current;
    const wanted = key === '' ? [] : key.split(',').map(Number);
    if (wanted.length === 0) {
      setData(NONE);
      return;
    }
    setData(mergeEraData(wanted.map((d) => eraDecadeIfLoaded(d))));
    let alive = true;
    (async () => {
      for (const d of wanted) {
        if (eraDecadeIfLoaded(d) !== null) continue;
        try {
          await loadEraDecade(d);
        } catch {
          continue; // 이 덩어리는 건너뛴다
        }
        if (!alive || mine !== seq.current) return;
        setData(mergeEraData(wanted.map((x) => eraDecadeIfLoaded(x))));
      }
    })();
    return () => {
      alive = false;
    };
  }, [key]);
  return data;
}

/** 받은 10년 덩어리들을 한 묶음으로 (그림 하나 = 그 덩어리의 defs + 조각 도형). 시험도 같은 함수를 쓴다 */
export function mergeEraData(parts: readonly (EraDecadeData | null)[]): EraData {
  const windows: EraWindow[] = [];
  const art: Record<string, string> = {};
  let any = false;
  for (const p of parts) {
    if (p === null) continue;
    any = true;
    windows.push(...p.windows);
    // 그림 하나 = 그 10년 덩어리의 공유 defs(무늬·사람 심볼, 덩어리에 한 번 저장) + 조각 도형 — 한 SVG 안에서 같이 쓰인다
    const defs = p.defs ?? '';
    for (const [id, body] of Object.entries(p.art)) art[id] = defs + body;
  }
  return any ? { windows, art } : NONE;
}

/** 집과 가족 그림 카드와 인생 기록 시대 줄이 함께 쓰는 그림 상태 한 묶음 — 인생 화면이 한 번 부르고 둘에게 나눠 준다(덩어리를 두 번 요청하지 않는다) */
export interface SceneArt {
  art: FamilyArt | null;
  status: ArtStatus;
  retry: () => void;
  era: EraData;
}

export function useSceneArt(birthYear: number, calYear: number): SceneArt {
  const { art, status, retry } = useFamilyArt();
  const era = useEraData(art, birthYear, calYear);
  return { art, status, retry, era };
}
