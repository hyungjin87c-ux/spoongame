import type { Death, Stage } from '../core/types';
import type { Movement, StartBand, WealthJourney } from '../core/ending';
import { stageRangeOf } from '../core/ending';
import { yearMonthText } from './birthReportText';
import { standingLabel } from './birthText';
import { causeSentenceText } from './lifeText';
import { STAGE_TABLE } from './lifeTable';

/**
 * 엔딩 회고 문구. 원작처럼 담담하게 — 감탄사·이모지·과장·설교를 쓰지 않고, 등급명(흙·동·은·금·다이아 수저)을 직접 쓰지 않는다.
 * 본문 어체는 합쇼체다(SPEC-003 M7e-3, 마스터 결정 C1 — docs/design/copy.md 5-3). 도착 자리(상위/하위/중앙)의 표현은 출생 결과 화면과 같은 함수(data/birthText.ts#standingLabel)를 그대로 쓰고, 출발선은 재력 단계의 구간(R-091)이라 아래 bandLabel이 말한다.
 * 둘 다 R-018 규칙을 지킨다: 퍼센트는 50을 넘지 않고 "약 0%"·"약 100%"·"0~"·"~100"이 나오지 않는다.
 */

export const ENDING_HEADINGS = {
  journey: '출발선에서 마지막까지',
  stats: '최종 스탯',
  timeline: '생애 연표',
} as const;

/** "83세에 세상을 떠났습니다. 원인은 노환이었습니다." (원인 낱말의 받침에 따라 「이었습니다」·「였습니다」, lifeText.ts#causeSentenceText) */
export function deathLineText(death: Death): string {
  return `${death.age}세에 세상을 떠났습니다. ${causeSentenceText(death.cause)}`;
}

/** 선택의 순간 수 한 줄 */
export function choiceCountText(count: number): string {
  return count === 0 ? '선택을 내려야 하는 순간이 오기 전이었습니다.' : `살아오며 ${count}번의 선택을 했습니다.`;
}

/**
 * 출발선(재력 단계 구간)의 표현 — "…의 집에서 태어나" 앞에 온다 (R-091). 숫자는 모두 core/ending.ts#bandFromRange가 정한 1~50이다.
 *  - 맨 아래 단계 "하위 40% 안쪽" / 맨 위 단계 "상위 3% 안쪽"
 *  - 한쪽 절반 안의 단계 "상위 8~28% 사이" (또는 "하위 A~B% 사이")
 *  - 50%를 걸친 단계 "하위 25% 선과 상위 45% 선 사이" (가운데쯤. 어느 쪽 숫자도 50을 넘지 않게 양쪽 끝에서 센다. 두 숫자에 「선」을 붙여 각각이 눈금으로 읽히게 한다 — M7e-3, copy.md 5-1)
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
      return `하위 ${band.bottom}% 선과 상위 ${band.top}% 선 사이`;
    case 'whole':
      return '모두가 같은 자리';
  }
}

/**
 * 재산의 출발선 대비 한 줄. 출발선(집안 형편의 구간)과 도착(내가 가진 것)을 원값이 아니라 같은 세상 안의 자리로 말한다.
 * 예: "상위 17~45% 사이의 집에서 태어나, 상위 약 23%의 형편으로 생을 마쳤습니다."
 */
export function journeyText(j: WealthJourney): string {
  if (j.kind === 'early') {
    // 스무 살 전: 재산이 아직 집안 형편이라 도착 자리를 말하지 않는다. 출발선만 담담하게 — 윗줄(사망·선택 수)이 이미 말한 "생이 끝났다"를 되풀이하지 않고 게임 용어도 쓰지 않는다 (R-083).
    return `${bandLabel(j.start)}의 집에서 태어났습니다.`;
  }
  return `${bandLabel(j.start)}의 집에서 태어나, ${standingLabel(j.end)}의 형편으로 생을 마쳤습니다.`;
}

/**
 * 출발선보다 앞섰는지·비슷한지·뒤쪽인지 한 줄 (막대의 설명문 꼴 — 앞 문장이 「…마쳤습니다.」로 끝나므로 되풀이하지 않는다, R-083). 「이르렀다」는 성취의 어감이라 0원·안전망 판에서 어긋나
 * 중립형 「…자리입니다.」로 쓴다 (M7e-3, copy.md 5-2 ① 2).
 */
export const MOVEMENT_TEXT: Record<Movement, string> = {
  up: '출발선보다 앞선 자리입니다.',
  same: '출발선과 비슷한 자리입니다.',
  down: '출발선보다 뒤쪽 자리입니다.',
};

/** 왜 숫자를 빼서 견주지 않았는가 (R-045 c) */
export const JOURNEY_NOTE = '재산은 어릴 때는 집안 형편이고 스무 살부터는 내가 가진 것이라, 숫자를 빼서 견주지 않고 같은 세상 안의 자리로 견주었습니다.';

/**
 * 엔딩 「최종 순자산」 줄의 문구 (SPEC-003 M5, docs/design/copy.md 4-6절): M4의 「재산」 미터(0~100)와 스무 살 전의 이름 「집안 형편」을 대신한다. 금액은 `formatWon` 출력 그대로(「약」 없음, 음수 U+2212),
 * M7e-3(copy.md 5-2 ① 1): 금액 옆의 자리 글자(「같은 세상 안에서 {자리}」)는 없앴다 — 금액(절대값)과 백분위(상대 자리)가 한 줄에서 부딪쳐 「0원 = 하위 42%」처럼 읽혔다. 자리는 출발선 카드 한 곳에서만 말한다.
 */
export const FINAL_NET_TEXT = {
  label: '최종 순자산',
  /** 지난·다가올 세상에서만 금액 바로 아래에 붙는 태그 */
  basis: '지금 가치로 환산',
  /** 스무 살 전에 끝난 인생: 자리를 말하지 않는다 */
  early: '스무 살이 되기 전이라 자산을 세지 않았습니다.',
} as const;

/** 엔딩 머리 (M7e-3, R-327, copy.md 5-4): 라벨 「{세상} · 생애 기록」과 셋째 줄 「{출생 연월} ~ {사망 연도}년 · {나이}세」 */
export const ENDING_HEAD_LABEL = '생애 기록';
export function endingSpanText(birthYear: number, month: number | null, deathYear: number, age: number): string {
  return `${month === null ? `${birthYear}년` : yearMonthText(birthYear, month)} ~ ${deathYear}년 · ${age}세`;
}

/** 출발선 막대의 범례·축 글자 (copy.md 5-4): 막대 안의 축은 aria-hidden이고 막대의 aria-label이 글로 말한다 */
export const JOURNEY_BAR_LEGEND = { start: '출발선', end: '마지막', axisLow: '하위', axisHigh: '상위' } as const;

/**
 * 출발선 막대의 읽기용 이름 (role="img" aria-label): 「출발선 하위 25% 안쪽, 마지막 상위 약 48%.」 — 스무 살 전은 「출발선 {구간}.」. 손으로 적지 않고 함수 조합이다(R-191(d)).
 * **방향 문장(「출발선보다 앞선 자리입니다.」)은 넣지 않는다**(M7e-4, REV-003-M7e-1 관찰 7 — 마스터 결정): 바로 아래 `ending-movement` 문장이 방향을 읽으므로 스크린리더가 같은 말을 두 번 듣지 않게 한다.
 * 범례(`dl`)는 수저 등급 이름을 전하는 유일한 곳이라 그대로 둔다.
 */
export function journeyBarLabel(j: WealthJourney): string {
  if (j.kind === 'early') return `출발선 ${bandLabel(j.start)}.`;
  return `출발선 ${bandLabel(j.start)}, 마지막 ${standingLabel(j.end)}.`;
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
