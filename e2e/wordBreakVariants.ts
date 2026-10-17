import type { BirthReport, GameState, ParentWealth } from '../src/core/types';
import { KNOWN_SEED, PEER_SEED, birthState } from './saves';

/**
 * 낱말 끊김 감사(QM3-1)의 출생신고 표본 2가지를 더한다 (QA-003-M3 M3-L02가 끊김을 찾은 낱말들).
 * `e2e/m3Variants.ts`의 5가지는 「가장 긴 내용」 표본이라 부모 직업이 모두 가장 긴 이름 「기계 조작직」이었다 — 그래서 한 줄 전체보다 짧은 직업 이름이 반쪽 칸에서 끊기는 결함
 * (「단순노무직」「서비스직」)을 아무도 못 봤다. 이 표본은 직업 이름이 5글자 낱말(단순노무직·농림어업직)·4글자 낱말(서비스직)인 부모와
 * 7글자 지명 낱말(제주특별자치도·강원특별자치도)을 쓴다.
 *  - birth-labor-jeju       지금 세상·동수저·제주특별자치도 제주시, 어머니 단순노무직·아버지 농림어업직(5글자 낱말 둘), 무상 거주, 셋째
 *  - birth-service-gangwon  지금 세상·금수저·강원특별자치도 원주시, 어머니 서비스직(4글자 낱말)·아버지 판매직, 자가, 둘째
 * 표본이 의도한 내용을 담는지는 tests/m3Variants.test.tsx가 화면 마크업으로 대조한다.
 */
export type WordBreakExtraId = 'birth-labor-jeju' | 'birth-service-gangwon';

export interface WordBreakExtra {
  wealth: ParentWealth;
  looks: number;
  report: Partial<BirthReport>;
  /** 「태어난 곳」에 보여야 할 가장 긴 낱말 */
  placeWord: string;
  /** 어머니·아버지 칸에 보여야 할 직업 이름 */
  jobs: readonly [string, string];
  why: string;
}

export const WORD_BREAK_EXTRAS: Readonly<Record<WordBreakExtraId, WordBreakExtra>> = {
  'birth-labor-jeju': {
    wealth: 2,
    looks: 50,
    report: { region: '제주', sigunguSido: '제주', sigungu: '제주시', mother: { age: 27, job: 'labor' }, father: { age: 30, job: 'agri' }, housing: 'free', birthOrder: 3, birthWeightKg: 3.2 },
    placeWord: '제주특별자치도',
    jobs: ['단순노무직', '농림어업직'],
    why: 'QA M3-L02: 반쪽 칸의 「단순노무직」(5글자)과 서류 서술문의 「제주특별자치도」(7글자)가 글자 150~200%에서 끊기던 조합',
  },
  'birth-service-gangwon': {
    wealth: 4,
    looks: 50,
    report: { region: '강원', sigunguSido: '강원', sigungu: '원주시', mother: { age: 35, job: 'service' }, father: { age: 38, job: 'sales' }, housing: 'own', birthOrder: 2, birthWeightKg: 3.3 },
    placeWord: '강원특별자치도',
    jobs: ['서비스직', '판매직'],
    why: 'QA M3-L02: 반쪽 칸의 「서비스직」(4글자)이 글자 200%에서 끊기던 조합 + 7글자 지명 「강원특별자치도」, 금수저',
  },
};

export const WORD_BREAK_EXTRA_IDS = Object.keys(WORD_BREAK_EXTRAS) as WordBreakExtraId[];

/** 표본의 저장 상태 (출생신고 화면) */
export function wordBreakExtraState(id: WordBreakExtraId, seed = KNOWN_SEED): GameState {
  const v = WORD_BREAK_EXTRAS[id];
  return { ...birthState(seed, 'present', v.wealth, v.looks, v.report), peerSeed: PEER_SEED };
}
