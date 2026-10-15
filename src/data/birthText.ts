import type { Standing } from '../core/birth';
import type { ParentingStyle, ParentWealth } from '../core/types';

/** 집안 형편 묘사. 등급명(흙·동·은·금·다이아 수저)을 화면에 그대로 쓰지 않는다. */
export const WEALTH_TEXT: Record<ParentWealth, string> = {
  1: '집안 살림은 늘 빠듯했다. 월말이면 부모님의 한숨이 길어졌다.',
  2: '넉넉하지는 않았지만, 끼니를 걱정할 정도는 아니었다.',
  3: '평범한 집이었다. 큰 걱정도, 큰 여유도 없었다.',
  4: '집에는 여유가 있었고, 부모님은 아이에게 쓰는 돈을 아끼지 않았다.',
  5: '돈 문제로 고민하는 어른을 본 적이 없는 집이었다.',
};

export const PARENTING_LABEL: Record<ParentingStyle, string> = {
  neglect: '방임',
  free: '자유',
  helicopter: '헬리콥터',
  strict: '엄격',
};

/**
 * 교육방식 묘사. 집안 형편 문구(WEALTH_TEXT)와 같은 화면에 이어서 나오므로(재력 5단계 × 교육방식 4종 = 20조합)
 * 형편과 어긋나는 말을 쓰지 않는다. 자유·헬리콥터·엄격은 재력과 무관하게 성립하는 문구 하나를 쓰고,
 * 방임은 "왜 돌보지 못했는가"가 형편에 따라 달라지므로 재력 단계별로 문구를 나눈다(R-013:
 * 재력 4·5단계에 "먹고사는 일에 쫓겨"가 붙으면 바로 위 문장과 모순).
 */
const PARENTING_BASE: Record<Exclude<ParentingStyle, 'neglect'>, string> = {
  free: '부모님은 아이가 하고 싶어 하는 일을 웬만하면 말리지 않았다.',
  helicopter: '부모님은 아이의 하루를 곁에서 챙겼다. 숙제부터 친구 관계까지 모르는 것이 없었다.',
  strict: '집에는 지켜야 할 규칙이 많았고, 부모님은 엄했다.',
};

const NEGLECT_BY_WEALTH: Record<ParentWealth, string> = {
  1: '부모님은 먹고사는 일에 쫓겨 아이를 돌볼 여유가 없었다. 아이는 대체로 스스로 자랐다.',
  2: '부모님은 일하느라 하루의 대부분을 밖에서 보냈다. 아이는 대체로 스스로 자랐다.',
  3: '부모님은 일에 매여 아이에게 시간을 내기 어려웠다. 아이는 대체로 스스로 자랐다.',
  4: '부모님은 각자의 일로 바빠 집에 있는 시간이 드물었다. 아이는 대체로 스스로 자랐다.',
  5: '부모님은 각자의 일로 바빠 집에 있는 시간이 드물었다. 아이는 대체로 스스로 자랐다.',
};

/** 교육방식 + 집안 형편에 맞는 묘사 한 단락. 20개 조합 모두에 문구가 있다. */
export function parentingText(parenting: ParentingStyle, wealth: ParentWealth): string {
  return parenting === 'neglect' ? NEGLECT_BY_WEALTH[wealth] : PARENTING_BASE[parenting];
}

/** 외모 점수(0~100) → 담담한 한 줄 */
export function looksText(looks: number): string {
  if (looks < 20) return '사람들의 눈에 잘 띄지 않는 얼굴이었다.';
  if (looks < 40) return '평범한 편에서 조금 아래였다.';
  if (looks < 60) return '평범한 얼굴이었다.';
  if (looks < 80) return '첫인상이 좋다는 말을 종종 들었다.';
  return '어디서든 한 번쯤 돌아보게 되는 얼굴이었다.';
}

// ---------- 순위 표현 문구 (R-018) ----------

/** 상위·하위 어느 쪽도 50% 안쪽이 아닌(중앙에 걸친) 경우의 전용 표현. 퍼센트를 말하지 않는다. */
export const MIDDLE_LABEL = '딱 중간쯤';

/**
 * Standing(core/birth.ts#standingOf의 결정) → 짧은 표현.
 * "상위 약 N%" / "하위 약 N%" / "상위·하위 1% 안쪽" / "딱 중간쯤". 문구는 이 함수가 유일한 출처다.
 */
export function standingLabel(s: Standing): string {
  if (s.kind === 'middle') return MIDDLE_LABEL;
  const side = s.kind === 'top' ? '상위' : '하위';
  return s.within ? `${side} ${s.percent}% 안쪽` : `${side} 약 ${s.percent}%`;
}

/** 출생 결과 화면의 집안 형편 순위 문장 */
export function wealthStandingText(s: Standing): string {
  return s.kind === 'middle'
    ? `우리나라 출생아 가운데 ${MIDDLE_LABEL}의 집안 형편이었다.`
    : `우리나라 출생아 중 ${standingLabel(s)}의 집안 형편이었다.`;
}

/** 출생 결과 화면의 외모 점수 + 순위 (뒤에 looksText 묘사가 이어진다) */
export function looksScoreText(looks: number, s: Standing): string {
  return `외모 ${looks}점 (${standingLabel(s)}).`;
}
