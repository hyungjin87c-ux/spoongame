import type { Death, Stage } from '../core/types';
import type { Movement, StartBand, WealthJourney } from '../core/ending';
import { stageRangeOf } from '../core/ending';
import type { Standing } from '../core/standing';
import { standingLabel } from './birthText';
import { STAGE_TABLE } from './lifeTable';

/**
 * 엔딩 회고 문구. 원작처럼 담담하게 — 감탄사·이모지·과장·설교를 쓰지 않고, 등급명(흙·동·은·금·다이아 수저)을 직접 쓰지 않는다.
 * 도착 자리(상위/하위/중앙)의 표현은 출생 결과 화면과 같은 함수(data/birthText.ts#standingLabel)를 그대로 쓰고, 출발선은 재력 단계의 구간(R-091)이라 아래 bandLabel이 말한다.
 * 둘 다 R-018 규칙을 지킨다: 퍼센트는 50을 넘지 않고 "약 0%"·"약 100%"·"0~"·"~100"이 나오지 않는다.
 */

export const ENDING_HEADINGS = {
  journey: '출발선에서 마지막까지',
  stats: '최종 스탯',
  timeline: '생애 연표',
} as const;

/** "83세에 세상을 떠났다. 원인: 노환." */
export function deathLineText(death: Death): string {
  return `${death.age}세에 세상을 떠났다. 원인: ${death.cause}.`;
}

/** 선택의 순간 수 한 줄 */
export function choiceCountText(count: number): string {
  return count === 0 ? '선택을 내려야 하는 순간이 오기 전에 생이 끝났다.' : `살아오며 ${count}번의 선택을 했다.`;
}

/**
 * 출발선(재력 단계 구간)의 표현 — "…의 집에서 태어나" 앞에 온다 (R-091). 숫자는 모두 core/ending.ts#bandFromRange가 정한 1~50이다.
 *  - 맨 아래 단계 "하위 40% 안쪽" / 맨 위 단계 "상위 3% 안쪽"
 *  - 한쪽 절반 안의 단계 "상위 8~28% 사이" (또는 "하위 A~B% 사이")
 *  - 50%를 걸친 단계 "하위 25%와 상위 45% 사이" (가운데쯤. 어느 쪽 숫자도 50을 넘지 않게 양쪽 끝에서 센다)
 * 출생 화면의 "하위 약 40%"·"상위 약 28%"는 이 구간의 한쪽 끝값이다.
 */
export function bandLabel(band: StartBand): string {
  switch (band.kind) {
    case 'bottom':
      return `하위 ${band.percent}% 안쪽`;
    case 'top':
      return `상위 ${band.percent}% 안쪽`;
    case 'outsideTop':
      return `상위 ${band.percent}% 밖`;
    case 'outsideBottom':
      return `하위 ${band.percent}% 밖`;
    case 'lower':
      return band.from === band.to ? `하위 약 ${band.from}%` : `하위 ${band.from}~${band.to}% 사이`;
    case 'upper':
      return band.from === band.to ? `상위 약 ${band.from}%` : `상위 ${band.from}~${band.to}% 사이`;
    case 'center':
      return `하위 ${band.bottom}%와 상위 ${band.top}% 사이`;
    case 'whole':
      return '모두가 같은 자리';
  }
}

/**
 * 재산의 출발선 대비 한 줄. 출발선(집안 형편의 구간)과 도착(내가 가진 것)을 원값이 아니라 같은 세상 안의 자리로 말한다.
 * 예: "상위 17~45% 사이의 집에서 태어나, 상위 약 23%의 형편으로 생을 마쳤다."
 */
export function journeyText(j: WealthJourney): string {
  if (j.kind === 'early') {
    // 스무 살 전: 재산이 아직 집안 형편이라 도착 자리를 말하지 않는다. 출발선만 담담하게 — 윗줄(사망·선택 수)이 이미 말한 "생이 끝났다"를 되풀이하지 않고 게임 용어도 쓰지 않는다 (R-083).
    return `${bandLabel(j.start)}의 집에서 태어났다.`;
  }
  return `${bandLabel(j.start)}의 집에서 태어나, ${standingLabel(j.end)}의 형편으로 생을 마쳤다.`;
}

/** 출발선보다 앞섰는지·비슷한지·뒤쪽인지 한 줄 (앞 문장이 "…형편으로 생을 마쳤다."로 끝나므로 뒤쪽 문장은 "마쳤다"를 되풀이하지 않는다, R-083) */
export const MOVEMENT_TEXT: Record<Movement, string> = {
  up: '출발선보다 앞선 자리에 이르렀다.',
  same: '출발선과 비슷한 자리에 머물렀다.',
  down: '출발선보다 뒤쪽에 서 있었다.',
};

/** 왜 숫자를 빼서 견주지 않았는가 (R-045 c) */
export const JOURNEY_NOTE = '재산은 어릴 때는 집안 형편이고 스무 살부터는 내가 가진 것이라, 숫자를 빼서 견주지 않고 같은 세상 안의 자리로 견주었습니다.';

/**
 * 엔딩 「최종 순자산」 줄의 문구 (SPEC-003 M5, docs/design/copy.md 4-6절): M4의 「재산」 미터(0~100)와 스무 살 전의 이름 「집안 형편」을 대신한다. 금액은 `formatWon` 출력 그대로(「약」 없음, 음수 U+2212),
 * 자리는 `standingLabel(finalWealthStanding(era, 순자산))` 출력 그대로다(「딱 중간쯤」「상위 1% 안쪽」도 그대로 붙는다).
 */
export const FINAL_NET_TEXT = {
  label: '최종 순자산',
  /** 지난·다가올 세상에서만 금액 바로 아래에 붙는 태그 */
  basis: '지금 가치로 환산',
  /** 스무 살 전에 끝난 인생: 자리를 말하지 않는다 */
  early: '스무 살이 되기 전이라 자산을 세지 않았습니다.',
} as const;

/** 최종 순자산의 자리 한 줄: 「같은 세상 안에서 상위 약 38%」 (출발선 카드 주석 「같은 세상 안의 자리로 견주었습니다」와 같은 말) */
export function finalNetStandingText(end: Standing): string {
  return `같은 세상 안에서 ${standingLabel(end)}`;
}

/** 학력·행복·관계 옆에 붙이는 출발선 값 */
export function startedAtText(from: number): string {
  return `처음 ${from}`;
}

/** 연표 단계 제목: "학창 · 7~19세", "노년 · 65세~" */
export function stageHeadingText(stage: Stage): string {
  const { from, to } = stageRangeOf(stage);
  return `${STAGE_TABLE[stage].label} · ${to === null ? `${from}세~` : `${from}~${to}세`}`;
}

export const REBIRTH_LABEL = '다시 태어나기';
export const REBIRTH_NOTE = '다시 태어나면 이 인생의 기록은 사라집니다.';
