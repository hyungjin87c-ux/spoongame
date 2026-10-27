import type { GenerationChoice, GenerationId } from '../core/types';
import { GENERATION_CONFIG } from './generationConfig';
import { ALL_GENERATIONS_RANGE, GENERATIONS } from './generations';
import { CURRENT_REGION_NAMES, REGION_KEYS, type CurrentRegionName, type RegionKey } from './regionKeys';
import { FORMAL_SIDO_NOW } from './regionNames';

/**
 * 첫 화면 세대 선택·시도 선택·내 출신 시도 설정의 문구 (SPEC-004 GS1·GS2·GS4·GS10·RG1~RG3, 문구 기준 docs/design/copy.md 16-1·16-2·16-10·16-11 + 5차 변경: 「랜덤 세대」 줄은 오른쪽 메타가 없다).
 * 소개 문장은 사실 기반(연표 사건 이름만)이고 7줄이 같은 문장 구조(병렬)다(G-05) — 평가어 0(GD6, tests/generationWords.test.ts). 어체: 첫 화면 안내는 해요체, 줄 소개는 명사구.
 */

/** 「올해 N~M세」의 기준 연도 — 해가 바뀌면 올린다 (SPEC Q1 방식: 현재 해 상수, 자동으로 따라가지 않는다) */
export const NOW_YEAR = 2026;

export const GEN_TEXT = {
  /** 세대 선택 묶음 제목 (GS1 — 형진 님 10-15 원문 그대로) */
  question: '어느 세대로 살아보고 싶으세요?',
  /** 목록 전체의 접근 가능한 이름 (`role="radiogroup"`) */
  listLabel: '태어날 세대',
  /** 첫 줄 「랜덤 세대」(라디오 — 버튼 아님) */
  randomTitle: '랜덤 세대',
  randomDesc: '일곱 세대 가운데 하나를 같은 확률로 뽑아요',
  /** 이 기기에서 끝까지 살아본 세대의 표시 (GS10 — 색에만 의존하지 않는 체크 + 글자, 순위·점수·보상 없음) */
  lived: '살아봄',
  /** 알파 줄의 보조 문장 (G-06: 2013년생도 2026년에 13세라 「성인기」가 아니라 「2026년부터」) */
  alphaNote: '2026년부터는 공식 전망을 바탕으로 한 이야기예요',
  /** 접이식 설명 (GS2): 제목 + 본문. 본문 첫 문장은 GS1의 목적 안내 한 줄(해요체) */
  foldSummary: '세대 범위는 자료마다 조금씩 달라요',
  foldBody: '다른 세대의 시간을 살아 보며 서로의 사정을 이해해 봐요. 이 게임은 위 범위를 써요. 1960~1963년생은 베이비붐 세대와 86세대 어느 쪽으로도 살아볼 수 있어요. 출생 연도는 고른 세대의 범위 안에서 룰렛이 뽑아요.',
  /** 부제 (N30 — 이름은 「수저 게임」, 세대의 뜻은 부제가 맡는다). 뒤쪽 구절은 줄바꿈 묶음 */
  tagLead: '다른 세대, 다른 삶, ',
  tagKeep: '같은 대한민국',
  /** 체험 한 줄 (형진 님 답 2차 3 — 후보 ②) */
  span: '세대를 바꿔 가며 그 시절의 한 사람으로 살아 봐요.',
  // ----- 태어나는 시도 (RG1·RG2) -----
  regionTitle: '태어나는 시도',
  regionRoulette: '룰렛에 맡기기',
  regionPick: '직접 고르기',
  regionModeLabel: '태어나는 시도를 정하는 방법',
  regionHint: '룰렛은 그해 시·도별 출생아 비율대로 돌아요.',
  regionPickHint: '지금의 시·도 이름으로 골라요. 출생신고에는 그 해의 행정구역 이름이 적혀요.',
  regionChipsLabel: '태어나는 시도',
  /** 고를 수 없는 시·도의 이유 (RG2 b) — 이름은 데이터로 채우는 나열이라 쉼표 */
  regionNone: (names: string) => `이 세대가 태어난 해에는 ${names}가 없었어요.`,
  /** 「랜덤 세대」에서 고를 수 없는 시·도 (7세대 가운데 그 시·도가 없던 세대가 있다) */
  regionNoneRandom: (names: string) => `랜덤 세대에서는 ${names}를 고를 수 없어요. 세대를 직접 고르면 고를 수 있는 곳이 있어요.`,
  originChip: (short: string) => `내 출신 시도 · ${short}`,
  // ----- 내 출신 시도 설정 (RG3) -----
  originTitle: '내가 실제로 태어난 시도',
  originNone: '밝히지 않음',
  originClear: '지우기',
  originDesc: '이 기기에만 남고 밖으로 나가지 않아요. 인생이 끝난 뒤 「같은 사건, 다른 자리」를 견주는 데만 써요.',
} as const;

/** 한 줄의 접근 가능한 이름 재료: 세대 이름 + 메타(`{범위}년생 · 올해 N~M세`). 「랜덤 세대」 줄은 메타가 없다 */
export function genMetaText(from: number, to: number): { range: string; age: string } {
  return { range: `${from}~${to}년생`, age: `올해 ${NOW_YEAR - to}~${NOW_YEAR - from}세` };
}

export interface GenRowText {
  id: GenerationChoice;
  name: string;
  /** 메타 — 「랜덤 세대」는 없다 */
  meta: { range: string; age: string } | null;
  desc: string;
  /** 알파의 보조 문장 */
  note: string | null;
}

/** 목록 8줄의 글자 (첫 줄 「랜덤 세대」 + 세대 7종 — GD1 순서) */
export const GEN_ROWS: readonly GenRowText[] = [
  { id: 'random', name: GEN_TEXT.randomTitle, meta: null, desc: GEN_TEXT.randomDesc, note: null },
  ...GENERATIONS.map((g): GenRowText => ({
    id: g.id,
    name: g.label,
    meta: genMetaText(g.birth.from, g.birth.to),
    desc: GENERATION_CONFIG[g.id].introMeaning,
    note: g.id === 'alpha' ? GEN_TEXT.alphaNote : null,
  })),
];

/** 「랜덤 세대」 줄이 말하는 전체 범위 (일곱 세대 — 접근 가능한 이름이 아니라 설명 자리) */
export const RANDOM_RANGE = ALL_GENERATIONS_RANGE;

/** 직접 고르기 칩의 이름들 — 지금의 시·도 16개 (RG1) */
export const REGION_CHIP_NAMES: readonly CurrentRegionName[] = CURRENT_REGION_NAMES;

/** 고를 수 없는 시·도의 정식 이름 나열 (쉼표) */
export function formalNames(keys: readonly RegionKey[]): string {
  return keys.map((k) => FORMAL_SIDO_NOW[REGION_KEYS.find((r) => r.key === k)!.short] ?? k).join(', ');
}

export type { GenerationId };
