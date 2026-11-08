import type { EventDef } from '../../src/core';
import { ASK_EFFECTS, ASK_KIND_INFO, type AskKind } from '../../src/data/askTable';

/**
 * 조르기 사건의 합성 데이터 (SPEC-011 AK1~AK3 시험 도우미). 실제 사건 9개는 AK7(데이터·문장)이라 아직 없다 — 코어(분류·검증·lint·판정)는 이 합성 사건으로 시험한다.
 * 기본값은 lint를 모두 통과하는 모양이다(제목·라벨 한글만, 합쇼체, 가족 낱말·이유 없음, 가중은 사다리 안, `noCitation: 'D'`).
 * `over`로 필드를 바꾸면 한 가지씩 어기게 만들 수 있다 (선택지 문장은 `choiceOver`).
 */
export function askEvent(id: string, kind: AskKind, over: Partial<EventDef> = {}, choiceOver: Partial<Record<'beg' | 'tantrum' | 'endure', Record<string, unknown>>> = {}): EventDef {
  const info = ASK_KIND_INFO[kind];
  const ev: Record<string, unknown> = {
    id,
    title: '갖고 싶은 것',
    text: '가게 앞에서 갖고 싶은 물건을 오래 바라보았습니다.',
    stages: ['infant', 'school'],
    ageRange: { min: info.ageMin, max: info.ageMax },
    track: 'common',
    weight: kind === 'pet' ? 30 : 45,
    once: true,
    noCitation: 'D',
    ask: { kind },
    ...(kind === 'pet' ? { conditions: { notFlags: ['pet_dog', 'pet_cat', 'pet_other'] } } : {}),
    choices: [
      { id: 'beg', label: '조른다', result: '졸라서 끝내 갖게 되었습니다.', askDenied: '졸랐지만 그대로 돌아섰습니다.', ...choiceOver.beg },
      { id: 'tantrum', label: '떼를 쓴다', result: '울며 버티자 갖게 되었습니다.', askDenied: '울며 버텼지만 그대로 돌아섰습니다.', askStrained: '울며 버텼지만 그대로 돌아섰고 한동안 서먹했습니다.', ...choiceOver.tantrum },
      { id: 'endure', label: '참는다', result: '말을 꺼내지 않고 돌아섰습니다.', effects: ASK_EFFECTS.endure, ...choiceOver.endure },
    ],
    ...over,
  };
  return ev as unknown as EventDef;
}
