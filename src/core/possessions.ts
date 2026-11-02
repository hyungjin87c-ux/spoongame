import { FAMILY_TAG } from './familyModel';
import { famHash01, famSeedOf } from './familyRng';
import { familyTables, type PossessionItem } from './gameData';
import { wealthFor } from './generationMixture';
import type { GameState } from './types';

/**
 * 가진 것 (SPEC-009 FK2, 설계 문서 5-2절): 집에 시대별 가전·물건이 있는가.
 * **판정은 시드 임계값 하나**로 한다 — 이 집의 「순위」 `rank`(0~1, 작을수록 일찍 들이는 집)를 판 시드와 수저 단계로 정하고, 항목의 **가구 보급률이 `rank` 이상이 되는 첫 해**부터 그 집은 그것을 가진다.
 * 그래서 ① 한 번 가지면 유지된다(단조 — 보급률이 늘어나는 곡선이고, 첫 해 이후는 계속 가진 것으로 센다) ② 판 전체의 가진 비율은 보급률과 맞는다(`rank`가 전체 집에서 0~1 균등).
 * 수저 기울임은 **평균 보존** 방식이다(WS4 ⓐ): 부유한 단계일수록 일찍 들이지만(`wealthTilt`), 순위를 전체 분포의 누적으로 되돌려 가중 평균이 보급률 그대로가 되게 한다. 소득계층별 자료(FD23)가 없어 기울임 세기는 설계값이다.
 * 성인은 부모 집 것을 이어받고 이후도 같은 순위·같은 표를 쓴다. 2025년 뒤에는 새 물건이 없고(보급률 마지막 값 유지) 2025년 세트가 그대로다(출처 없는 미래 수치 금지).
 * 보급률 숫자·상호는 화면 본문에 쓰지 않는다 — 항목 이름은 일반 명사다. 순수 함수, 난수는 `famHash01`(POSSESS 태그)뿐이다.
 */

export type PropTieId = NonNullable<PossessionItem['tie']>;

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** 항목의 그 해 가구 보급률(0~1). 보급이 시작되기 전은 0, 점 사이는 선형, 마지막 점 뒤는 마지막 값 */
export function possessionRate(item: PossessionItem, year: number): number {
  if (year < item.start) return 0;
  const pts = item.points;
  if (year <= pts[0][0]) return pts[0][1] / 100;
  const last = pts[pts.length - 1];
  if (year >= last[0]) return last[1] / 100;
  let i = 0;
  while (pts[i + 1][0] < year) i++;
  const [x0, y0] = pts[i];
  const [x1, y1] = pts[i + 1];
  return (y0 + ((y1 - y0) * (year - x0)) / (x1 - x0)) / 100;
}

/**
 * 이 집의 순위 `rank`(0~1, 작을수록 일찍). 수저 단계 `tier`(1~5)의 집은 부유할수록 앞쪽으로 기울고, 같은 단계 안은 시드 `u`로 흩어진다:
 *   X = λ·q(tier) + (1−λ)·u,  rank = G(X)   (q = 더 부유한 단계의 비중 + 자기 비중의 절반, G = 모든 단계의 X 분포를 합친 누적분포)
 * G를 거치므로 `rank`는 전체 집에서 0~1 균등이다 → 어느 해에나 가진 집의 비율이 보급률이다(평균 보존).
 */
export function householdRank(famSeed: number, birthYear: number, tier: number, tilt: number): number {
  const lam = clamp(tilt, 0, 0.9);
  const shares = wealthFor(birthYear).map((w) => w / 100); // 1단계 … 5단계
  const q = (t: number): number => shares.slice(t + 1).reduce((a, b) => a + b, 0) + shares[t] / 2;
  const u = famHash01(famSeed, FAMILY_TAG.POSSESS, 1, 0);
  const x = lam * q(tier - 1) + (1 - lam) * u;
  let g = 0;
  for (let t = 0; t < shares.length; t++) g += shares[t] * clamp((x - lam * q(t)) / (1 - lam), 0, 1);
  return clamp(g, 0, 1);
}

const sinceCache = new Map<string, number>();

/** 이 순위의 집이 항목을 처음 가지는 연도 (한 번도 못 가지면 Infinity) */
export function ownedSince(item: PossessionItem, rank: number): number {
  const key = `${item.id}|${rank}`;
  const hit = sinceCache.get(key);
  if (hit !== undefined) return hit;
  const lastYear = Math.max(2025, item.points[item.points.length - 1][0]);
  let found = Infinity;
  for (let y = item.start; y <= lastYear; y++) {
    if (possessionRate(item, y) >= rank) {
      found = y;
      break;
    }
  }
  if (sinceCache.size > 20000) sinceCache.clear();
  sinceCache.set(key, found);
  return found;
}

export interface OwnedItem {
  id: string;
  name: string;
  /** 처음 들어온 해 (달력 연도) */
  since: number;
  tie?: PropTieId;
}

type Source = Pick<GameState, 'age' | 'character' | 'peerSeed' | 'seed'>;

/** 달력 연도 `year`까지 이 집이 가진 모든 항목 (처음 들어온 해가 빠른 순). 출생 전 상태는 빈 목록 */
export function ownedPossessions(game: Source, year: number = game.character === null ? 0 : game.character.birthYear + game.age): OwnedItem[] {
  const { character } = game;
  if (character === null) return [];
  const d = familyTables().design.possessions.value;
  const rank = householdRank(famSeedOf(game.peerSeed ?? game.seed), character.birthYear, character.parentWealth, d.wealthTilt);
  const out: OwnedItem[] = [];
  for (const item of d.items) {
    const since = ownedSince(item, rank);
    if (since <= year) out.push({ id: item.id, name: item.name, since, ...(item.tie === undefined ? {} : { tie: item.tie }) });
  }
  return out.sort((a, b) => a.since - b.since || (a.id < b.id ? -1 : 1));
}

/** 카드 「집에 있는 것」에 글자로 보이는 항목: 새 물건이 앞세대 물건을 대신하면(컬러 텔레비전 → 흑백 텔레비전) 앞세대는 가리고, 가장 최근에 들인 순으로 `displayMax`개 */
export function shownPossessions(game: Source, year?: number): OwnedItem[] {
  const owned = ownedPossessions(game, year);
  const d = familyTables().design.possessions.value;
  const replaced = new Set(d.items.filter((i) => i.supersedes !== undefined && owned.some((o) => o.id === i.id)).map((i) => i.supersedes));
  return owned
    .filter((o) => !replaced.has(o.id))
    .sort((a, b) => b.since - a.since || (a.id < b.id ? -1 : 1))
    .slice(0, d.displayMax);
}

/** 그림의 소품과 묶인 항목을 가졌는가 (안테나 · 에어컨 실외기 · 승용차) — `sceneInputOf`가 읽는다 */
export function possessionTiesOf(game: Source, year?: number): Set<PropTieId> {
  const ties = new Set<PropTieId>();
  for (const o of ownedPossessions(game, year)) if (o.tie !== undefined) ties.add(o.tie);
  return ties;
}
