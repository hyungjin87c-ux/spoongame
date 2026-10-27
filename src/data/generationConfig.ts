import type { GenerationId, ParentingStyle } from '../core/types';
import { GENERATIONS, type BgmGenreId } from './generations';

/**
 * 세대별 설정 한 곳 `GENERATION_CONFIG` (SPEC-004 NR6, `docs/data/generations.md` 3절). 코드가 아니라 이 표만 고치면 출생 분포가 바뀐다(게임 설계값 — 통계가 아니다).
 * 시대 3종 `ERA_CONFIG`의 `priceIndex`·`life`는 여기로 옮기지 않는다(G-08 — 연도 축 표로 간다, GM10).
 *
 * ## 수저 비율은 출생 연도별 설계값 (NR1, N29)
 * `wealthWeights`는 **그 세대 출생 범위의 가운데 해(닻)** 에서의 값이다. 출생 연도 `y`의 가중은 `core/generationMixture.ts#wealthFor(y)`가 이웃한 두 닻 사이를 직선으로 이어 정한다.
 * 연도별 값은 통계가 아니라 설계값이다.
 */

export interface GenerationConfig {
  id: GenerationId;
  /** 표시 이름 (GD1) */
  label: string;
  /** 출생 연도(포함) */
  birth: { readonly from: number; readonly to: number };
  /** BGM 참고 장르(표시용 — 전환 입력 아님, BG3) */
  bgmReference: BgmGenreId;
  /** 부모 재력 1~5단계 출생 비율(%) 합 100 — 이 세대 범위 **가운데 해**에서의 값(닻, N29) */
  wealthWeights: readonly [number, number, number, number, number];
  /** 교육방식 비율(%) 합 100 (G-02) */
  parentingWeights: Readonly<Record<ParentingStyle, number>>;
  /** 이 세대가 쓰는 이름 풀 id들 (NR4·G-03 — `data/namePools.ts#namePoolIdOf`와 일치를 시험이 잠근다) */
  namePool: readonly string[];
  /** 소개 문장의 뜻(사실 기반, 사건 셋 병렬 — 최종 문장은 copy.md/`data/generationText.ts`) */
  introMeaning: string;
  /** 알파만 `assembled`(정석 코스 이벤트를 알파 변형으로 바꾸거나 닫는다, AL3 — GM9). 나머지는 `standard-capable` */
  trackMode: 'standard-capable' | 'assembled';
  /** 「랜덤 세대」가 이 세대를 뽑을 확률 — 7세대 모두 1/7 (GS3·G-07, 인구 비례가 아니다) */
  randomWeight: number;
}

const W_PAST: GenerationConfig['wealthWeights'] = [40, 32, 20, 7, 1];
const W_X: GenerationConfig['wealthWeights'] = [33, 31, 24, 10, 2];
const W_NOW: GenerationConfig['wealthWeights'] = [25, 30, 28, 14, 3];
const P_PAST = { neglect: 25, free: 10, helicopter: 10, strict: 55 } as const;
const P_X = { neglect: 20, free: 20, helicopter: 20, strict: 40 } as const;
const P_NOW = { neglect: 15, free: 30, helicopter: 30, strict: 25 } as const;

type Rest = Omit<GenerationConfig, 'label' | 'birth' | 'bgmReference'>;

const courtPools = (from: number, to: number): string[] => Array.from({ length: to - from + 1 }, (_, i) => `court-${from + i}`);

const REST: Record<GenerationId, Rest> = {
  industrial: { id: 'industrial', wealthWeights: W_PAST, parentingWeights: P_PAST, namePool: ['decade-1940', 'decade-1950'], introMeaning: '6·25전쟁, 전후 복구, 산업화의 시기를 지나온 세대', trackMode: 'standard-capable', randomWeight: 1 / 7 },
  boomer: { id: 'boomer', wealthWeights: W_PAST, parentingWeights: P_PAST, namePool: ['decade-1950', 'decade-1960'], introMeaning: '과밀 학급, 고교 평준화, 산업화의 시기를 지나온 세대', trackMode: 'standard-capable', randomWeight: 1 / 7 },
  g86: { id: 'g86', wealthWeights: W_PAST, parentingWeights: P_PAST, namePool: ['decade-1960'], introMeaning: '직선제 개헌, 3저 호황, 신도시의 시기를 지나온 세대', trackMode: 'standard-capable', randomWeight: 1 / 7 },
  genx: { id: 'genx', wealthWeights: W_X, parentingWeights: P_X, namePool: ['decade-1970', 'decade-1980'], introMeaning: '노래방, PC통신, 외환위기의 시기를 지나온 세대', trackMode: 'standard-capable', randomWeight: 1 / 7 },
  millennial: { id: 'millennial', wealthWeights: W_NOW, parentingWeights: P_NOW, namePool: ['decade-1980', 'decade-1990'], introMeaning: '개인 홈페이지, 스마트폰, 글로벌 금융위기의 시기를 지나온 세대', trackMode: 'standard-capable', randomWeight: 1 / 7 },
  genz: { id: 'genz', wealthWeights: W_NOW, parentingWeights: P_NOW, namePool: ['decade-1990', 'decade-2000', ...courtPools(2008, 2012)], introMeaning: '스마트폰, 숏폼 영상, 코로나19의 시기를 지나온 세대', trackMode: 'standard-capable', randomWeight: 1 / 7 },
  alpha: { id: 'alpha', wealthWeights: W_NOW, parentingWeights: P_NOW, namePool: courtPools(2013, 2020), introMeaning: '대화형 인공지능, 학령인구 감소, 고교학점제의 시기에 자라는 세대', trackMode: 'assembled', randomWeight: 1 / 7 },
};

export const GENERATION_CONFIG: Readonly<Record<GenerationId, GenerationConfig>> = Object.freeze(
  Object.fromEntries(GENERATIONS.map((g) => [g.id, Object.freeze({ ...REST[g.id], label: g.label, birth: g.birth, bgmReference: g.bgm })])) as Record<GenerationId, GenerationConfig>,
);

/** 세대 설정 한 벌. 모르는 id면 throw */
export function generationConfig(id: GenerationId): GenerationConfig {
  const c = GENERATION_CONFIG[id];
  if (c === undefined) throw new RangeError(`generationConfig: 알 수 없는 세대 ${String(id)}`);
  return c;
}

/** 수저 닻 해: 세대 출생 범위의 가운데 해 (산업화 1947 · 베이비붐 1959 · 86 1964.5 · X 1975 · 밀레니얼 1988.5 · Z 2004.5 · 알파 2016.5) */
export function anchorYearOf(id: GenerationId): number {
  const { from, to } = generationConfig(id).birth;
  return (from + to) / 2;
}
