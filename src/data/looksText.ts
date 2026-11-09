import { looksTierOf } from '../assets/faces/faceLayers';
import { createRng, forkRng } from '../core/rng';
import type { Character } from '../core/types';

/**
 * 외모 서술 (SPEC-015 AP2 — 「상위·하위 N%」 대신 이목구비 글, 출생신고·프로필·엔딩 세 곳에 같은 글).
 * 낱말은 형진 님이 승인한 표(`docs/design/appearance-words-r1.md`, 2026-11-08 + 1단계 「수수한 인상의」)를 그대로 옮겼다.
 *
 * **글은 저장하지 않는다** — `looksText(c, slot, age, seed)`는 같은 입력이면 같은 문자열을 돌려주는 순수 함수이고, 판의 최초 시드(`Game.seed`)에서 **갈라낸**(`forkRng`) 별도 수열을 쓴다.
 * 인생 진행 난수(`rngState`)·저장 필드·출생 결과(`generateBirth`)는 건드리지 않는다. 그래서 옛 저장도 새 서술로 보이고 `save → load → save`는 바이트 그대로다.
 *
 * 구조: 첫 문장 = 첫인상(외모 단계 `looksTierOf` + 5단계만 성별) + 명사·어미(자리가 정한다). 둘째 문장 = 특징 하나.
 *  - 첫 문장의 수식구는 (단계, 성별)로만 정해진다 — 난수·나이·자리에 따라 바뀌지 않는다(단계 ↔ 첫 문장 1:1).
 *  - 둘째 문장의 **피부 낱말은 단계와 독립**이다: 쓸지·무엇을 쓸지를 외모값·단계를 읽지 않는 별도 난수(시드만)로 **먼저** 정하고, 뽑히면 둘째 문장 자리를 피부 낱말이 차지한다(약 25%).
 *    뽑히지 않으면 단계 규칙대로 B군(단계와 무관한 개성 낱말) + 5·1단계의 A군 둘째 축(얼굴 그림이 바꾸는 신호와 같은 방향)에서 하나를 고른다.
 *  - 프로필(`'profile'`)은 첫 문장만, 출생신고(`'birth'`)·엔딩(`'ending'`)은 첫 문장 + 둘째 문장이다.
 *
 * 둘째 문장 후보 풀은 **나이와 무관**하다 — 출생신고(0세)와 엔딩(회고)이 같은 인물의 같은 글이어야 하므로(완료 기준 4), 0~6세에도 쓸 수 있는 낱말만 풀에 둔다.
 * 승인표의 광대·얼굴형(턱선·갸름) 행은 0~6세에 쓰지 않는 낱말이라 이 풀에서 빠진다(아기의 출생신고 글에 나올 수 없고, 엔딩만 다르게 쓰면 같은 인물이 달라진다).
 */

export type LooksSlot = 'birth' | 'profile' | 'ending';

/** 피부 낱말을 둘째 문장에 쓰는 비율 (SPEC-015 결정 Q1 (가) 약 25%) — 단계·외모값과 무관하다 */
export const SKIN_RATE = 0.25;

/** 갈래마다 다른 난수 소금(salt): 피부 선택 / 둘째 문장 특징 선택. 인생 진행 난수와는 따로 갈라낸 수열이다 */
const SALT_SKIN = 0x4c4f4b31; // 'LOK1'
const SALT_TRAIT = 0x4c4f4b32; // 'LOK2'

/** 외모 단계(`looksTierOf`) → 첫인상 수식구. 5단계만 성별로 갈린다(「잘생긴」 남 · 「예쁜」 여), 1~4단계는 성별과 무관하다. 평가 낱말은 5단계 한 자리뿐이다 */
export const LEADS = {
  5: { male: '이목구비가 뚜렷하고 잘생긴', female: '이목구비가 뚜렷하고 예쁜' },
  4: '이목구비가 반듯한',
  3: '편안한 인상의',
  2: '순한 인상의',
  1: '수수한 인상의',
} as const;

/** 한 낱말: 출생신고(현재형)와 엔딩(과거형). 프로필에는 둘째 문장이 없다 */
interface Trait {
  now: string;
  past: string;
}

const t = (now: string, past: string): Trait => ({ now, past });

/** B군 — 단계와 무관한 개성 낱말(눈·코·입·볼·머리카락·이마·점·움직임). 모두 0~6세에 쓸 수 있는 낱말이다 */
export const COMMON_TRAITS: readonly Trait[] = [
  // 눈
  t('눈이 큽니다.', '눈이 컸습니다.'),
  t('눈이 작은 편입니다.', '눈이 작은 편이었습니다.'),
  t('눈이 깁니다.', '눈이 길었습니다.'),
  t('눈이 동그랗습니다.', '눈이 동그랬습니다.'),
  t('눈꼬리가 조금 올라갔습니다.', '눈꼬리가 조금 올라가 있었습니다.'),
  t('눈꼬리가 조금 처졌습니다.', '눈꼬리가 조금 처져 있었습니다.'),
  // 코
  t('콧대가 높은 편입니다.', '콧대가 높은 편이었습니다.'),
  t('코가 낮고 둥급니다.', '코가 낮고 둥글었습니다.'),
  t('코끝이 둥근 복코입니다.', '코끝이 둥근 복코였습니다.'),
  t('코가 깁니다.', '코가 길었습니다.'),
  t('코가 작습니다.', '코가 작았습니다.'),
  // 입
  t('입술이 도톰합니다.', '입술이 도톰했습니다.'),
  t('입술이 얇습니다.', '입술이 얇았습니다.'),
  t('입이 큰 편입니다.', '입이 큰 편이었습니다.'),
  t('입이 작습니다.', '입이 작았습니다.'),
  t('입꼬리가 올라가 있습니다.', '입꼬리가 올라가 있었습니다.'),
  // 볼
  t('볼이 둥급니다.', '볼이 둥글었습니다.'),
  t('볼살이 통통합니다.', '볼살이 통통했습니다.'),
  // 머리카락
  t('곱슬머리입니다.', '곱슬머리였습니다.'),
  t('머리카락이 굵고 곧습니다.', '머리카락이 굵고 곧았습니다.'),
  t('머리카락이 곧습니다.', '머리카락이 곧았습니다.'),
  // 이마(모양)
  t('이마가 둥급니다.', '이마가 둥글었습니다.'),
  t('이마가 반듯합니다.', '이마가 반듯했습니다.'),
  // 점
  t('눈가에 작은 점이 있습니다.', '눈가에 작은 점이 있었습니다.'),
  t('입가에 점이 하나 있습니다.', '입가에 점이 하나 있었습니다.'),
  // 보조개·움직임
  t('웃을 때 보조개가 집니다.', '웃을 때 보조개가 졌습니다.'),
  t('웃으면 눈이 반달이 됩니다.', '웃으면 눈이 반달이 되었습니다.'),
  t('말할 때 눈썹이 먼저 움직입니다.', '말할 때 눈썹이 먼저 움직였습니다.'),
  t('웃으면 입꼬리가 한쪽만 올라갑니다.', '웃으면 입꼬리가 한쪽만 올라갔습니다.'),
];

/** A군 둘째 축 — 5·1단계만(얼굴 그림이 바꾸는 신호와 같은 방향). 「머리숱이 적다」는 어디에도 없다 */
export const AXIS_TRAITS: { readonly 5: readonly Trait[]; readonly 1: readonly Trait[] } = {
  5: [
    t('눈썹이 짙고 또렷합니다.', '눈썹이 짙고 또렷했습니다.'),
    t('눈빛이 또렷합니다.', '눈빛이 또렷했습니다.'),
    t('머리숱이 많고 윤기가 돕니다.', '머리숱이 많고 윤기가 돌았습니다.'),
  ],
  1: [
    t('눈썹이 옅고 가늡니다.', '눈썹이 옅고 가늘었습니다.'),
    t('눈매가 부드럽습니다.', '눈매가 부드러웠습니다.'),
    t('이마가 넓은 편입니다.', '이마가 넓은 편이었습니다.'),
  ],
};

/** 피부 낱말 — 색·햇볕 반응을 중립으로 말하는 네 가지(S1~S4). 단계와 독립이다 */
export const SKIN_TRAITS: readonly Trait[] = [
  t('피부가 흰 편입니다.', '피부가 흰 편이었습니다.'),
  t('피부가 가무잡잡합니다.', '피부가 가무잡잡했습니다.'),
  t('햇볕에 잘 타는 피부입니다.', '햇볕에 잘 타는 피부였습니다.'),
  t('햇볕에 잘 타지 않는 피부입니다.', '햇볕에 잘 타지 않는 피부였습니다.'),
];

/** 어른이 되는 나이: 프로필의 명사가 「아이」에서 「얼굴」로 바뀐다 (프로필 0~6세 「아이」 · 7세~ 「얼굴」) */
const SCHOOL_AGE = 7;

/** 첫 문장: 첫인상 + 자리가 정하는 명사·어미 (출생신고 「아기입니다」 · 프로필 「아이입니다」/「얼굴입니다」 · 엔딩 「얼굴이었습니다」) */
function firstSentence(c: Pick<Character, 'looks' | 'gender'>, slot: LooksSlot, age: number): string {
  const tier = looksTierOf(c.looks);
  const lead = tier === 5 ? LEADS[5][c.gender] : LEADS[tier];
  const tail = slot === 'birth' ? '아기입니다.' : slot === 'ending' ? '얼굴이었습니다.' : age < SCHOOL_AGE ? '아이입니다.' : '얼굴입니다.';
  return `${lead} ${tail}`;
}

/**
 * 둘째 문장의 특징 하나. **피부 선택은 시드만 읽는다**(외모값·단계·성별을 읽지 않는다 — 구조로 보장되는 단계 독립):
 * 시드에서 갈라낸 수열의 첫 값이 `SKIN_RATE` 미만이면 둘째 값으로 피부 낱말 하나를 고르고, 아니면 단계 규칙의 풀(B군 + 5·1단계의 A군 둘째 축)에서 별도 수열로 하나를 고른다.
 */
export function traitOf(looks: number, seed: number): Trait {
  const skin = forkRng(createRng(seed), SALT_SKIN);
  if (skin.next() < SKIN_RATE) return SKIN_TRAITS[Math.floor(skin.next() * SKIN_TRAITS.length)];
  const tier = looksTierOf(looks);
  const pool = tier === 5 ? [...COMMON_TRAITS, ...AXIS_TRAITS[5]] : tier === 1 ? [...COMMON_TRAITS, ...AXIS_TRAITS[1]] : COMMON_TRAITS;
  const rng = forkRng(createRng(seed), SALT_TRAIT);
  return pool[Math.floor(rng.next() * pool.length)];
}

/**
 * 외모 글 (SPEC-015 AP2). `slot`: `'birth'` 출생신고(첫 문장 + 둘째 문장, 현재형) · `'profile'` 프로필 카드(첫 문장만) · `'ending'` 엔딩 최종 스탯(첫 문장 + 둘째 문장, 과거형).
 * `age`는 프로필의 명사(0~6세 「아이」 · 7세~ 「얼굴」)만 정한다. `seed`는 판의 최초 시드(`Game.seed`) — 같은 인물은 어느 자리에서도 같은 낱말이다(바뀌는 것은 명사·어미·둘째 문장의 유무뿐).
 */
export function looksText(c: Pick<Character, 'looks' | 'gender'>, slot: LooksSlot, age: number, seed: number): string {
  const first = firstSentence(c, slot, age);
  if (slot === 'profile') return first;
  const trait = traitOf(c.looks, seed);
  return `${first} ${slot === 'ending' ? trait.past : trait.now}`;
}
