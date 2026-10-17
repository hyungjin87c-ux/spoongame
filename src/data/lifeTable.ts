import type { Stage } from '../core/types';

/**
 * 인생 진행 상수 표 (게임 설계값, 통계가 아님). 코드가 아니라 이 표만 고치면 밸런스를 바꿀 수 있다.
 * 시대별 차이는 data/birthTable.ts#ERA_CONFIG(life 계수, priceIndex)와 이벤트 풀로만 만든다.
 * 특정 달력 연도나 실제 사건을 가정하지 않는다: 모든 기준은 나이다.
 */

// ---------- 생애 단계 ----------

export interface StageInfo {
  label: string;
  /** 이 단계가 시작되는 나이(포함). 다음 단계의 startAge - 1 까지가 이 단계. */
  startAge: number;
}

/** 나이 경계 표: 영유아 0~6 / 학창 7~19 / 청년 20~39 / 중년 40~64 / 노년 65~ */
export const STAGE_TABLE: Record<Stage, StageInfo> = {
  infant: { label: '영유아', startAge: 0 },
  school: { label: '학창', startAge: 7 },
  youth: { label: '청년', startAge: 20 },
  middle: { label: '중년', startAge: 40 },
  senior: { label: '노년', startAge: 65 },
};

/** 단계 진입 시 연표에 남기는 한 줄 (시대와 무관한 문구). 영유아는 출생 문구를 따로 쓴다. */
export const STAGE_ENTRY_TEXT: Record<Exclude<Stage, 'infant'>, string> = {
  school: '학교에 들어갈 나이가 되었다.',
  youth: '스무 살이 되었다. 이제 집안 형편이 아니라 내가 가진 것으로 살아가야 한다.',
  middle: '어느덧 마흔이 되었다.',
  senior: '예순다섯. 일에서 한 걸음 물러설 나이가 되었다.',
};

/** 부모가 모두 떠난 해 상속을 받으면 연표에 남기는 한 줄 (D10 변경, 금액 없음) */
export const INHERIT_NOTE_TEXT = '부모님이 남기신 재산을 물려받았습니다.';

// ---------- 이벤트 빈도 ----------

/**
 * 한 해마다 이벤트가 일어날 확률(생애 단계별). 선택지 빈도는 이 표가 정한다.
 * 해마다 먼저 choice 확률로 선택지 이벤트를 시도하고, 못 뽑으면 narrative 확률로 서술 이벤트를 시도한다.
 * (조건에 맞는 이벤트가 없으면 그 해는 조용히 지나간다.)
 * M4 조정: 판당 선택지를 약 12개(M3 표본 풀)에서 20~25개로 늘리라는 결정(R-037)에 맞춰 선택지 확률을 올렸다(이전: 영유아 0.2 / 학창·청년 0.35 / 중년·노년 0.3).
 * 중년을 낮추고 노년을 높인 것은 한 판의 선택지 수 조절(CHOICE_PACING)이 앞 단계에서 이미 상한 가까이 쓰고 나면 노년의 선택지가 굶는 문제를 막으려는 것이다
 * (단계별 평균: 영유아 1.8 · 학창 4.4 · 청년 6.4 · 중년 6.3 · 노년 4~5).
 * 실제 풀(EVENT_POOL) 기준 결과는 `npm run sim`과 tests/simulation.test.ts "목표 시간" 블록이 확인한다.
 */
export const EVENT_FREQUENCY: Record<Stage, { choice: number; narrative: number }> = {
  infant: { choice: 0.3, narrative: 0.3 },
  school: { choice: 0.55, narrative: 0.3 },
  youth: { choice: 0.5, narrative: 0.3 },
  middle: { choice: 0.36, narrative: 0.3 },
  senior: { choice: 0.6, narrative: 0.3 },
};

/** 선택지 이벤트와 다음 선택지 이벤트 사이에 최소로 두는 간격(년). 2면 "선택 → 한 해 이상 쉬고 → 다음 선택". */
export const MIN_YEARS_BETWEEN_CHOICES = 2;

/**
 * 한 판의 선택지 수 조절(M4). 판당 선택지는 약 20~25개가 목표인데, 확률만으로는 선택지가 몰린 판이 33개까지 늘어 1배속 수동 시간이 목표를 넘고
 * 25개를 넘는 판이 많아진다. 그래서 윗꼬리만 잘라 평균(약 23~24)은 그대로 둔다:
 *  - soft: 이만큼 푼 뒤부터는 선택지가 나올 확률(EVENT_FREQUENCY.choice)에 softFactor를 곱해 잦아들지 않게 한다.
 *  - hard: 이만큼 풀면 그 판에는 더 이상 선택지가 나오지 않는다(서술 이벤트와 조용한 해만 이어진다).
 * 지금까지 푼 선택지 수는 연표의 선택 기록 수다. 숫자는 `npm run sim`의 선택지 수 분포와 tests/simulation.test.ts가 확인한다.
 */
export const CHOICE_PACING = { soft: 23, softFactor: 0.3, hard: 26 };

/** 반복 가능한(once가 아닌) 이벤트가 cooldown을 안 적었을 때 같은 이벤트가 다시 나오기까지의 최소 년수 */
export const DEFAULT_COOLDOWN = 10;

// ---------- 자연 변화 ----------

/** 영유아~학창기 학력 성장: 가정의 교육 여건(재력·교육방식)이 연간 성장량을 정한다(R-025: 출생 학력은 낮게, 여건은 성장 속도로). */
export const EDUCATION_GROWTH = {
  /** 기본 연간 학력 증가(학창기) */
  schoolBase: 2,
  /** 재력 1~5단계별 보정 */
  byWealth: [-1, 0, 0, 1, 1] as const,
  /** 교육방식별 보정 */
  byParenting: { neglect: -1, free: 0, helicopter: 1, strict: 1 } as const,
  min: 1,
  max: 4,
  /** 영유아기 연간 학력 증가 */
  infant: 1,
  /** 청년기 학력 성장(짝수 나이마다 +1)이 이어지는 마지막 나이 */
  youthUntilAge: 29,
};

/**
 * 소득: 학력이 높을수록 재산이 자란다. [학력 하한, 재산 +1이 붙는 간격(년)] 을 위에서부터 처음 맞는 줄로 쓴다.
 * 청년기와 중년기가 따로 있고, 간격 0이면 늘지 않는다.
 */
export const INCOME_BY_EDUCATION: Record<'youth' | 'middle', ReadonlyArray<readonly [minEducation: number, everyYears: number]>> = {
  youth: [
    [70, 2],
    [40, 3],
    [0, 6],
  ],
  middle: [
    [70, 3],
    [40, 4],
    [0, 8],
  ],
};

/** 건강 자연 감소: 단계별 [나이 하한, 간격(년), 감소량]. 노년은 해마다 줄고 80세부터 더 빠르다. */
export const HEALTH_DECAY: Record<'youth' | 'middle' | 'senior', ReadonlyArray<{ fromAge: number; every: number; amount: number }>> = {
  youth: [{ fromAge: 30, every: 5, amount: 1 }],
  middle: [{ fromAge: 40, every: 3, amount: 1 }],
  senior: [
    { fromAge: 65, every: 1, amount: 1 },
    { fromAge: 80, every: 2, amount: 1 },
  ],
};

/**
 * 행복·관계가 출생값(부모 재력·교육방식이 정한 값)에 평생 묶이지 않게 하는 표 (R-045 b, R-063).
 *  - school(7~19세): **출생 편차만** 걷어 낸다. 출생 때 50에서 벗어난 만큼(출생 값 - 50)의 fadeShare를 fromAge~toAge 사이에 고르게 되돌린다
 *    (core/life.ts#birthFadeDelta). 이벤트(선택)의 효과는 건드리지 않는다.
 *    예전 방식은 "매년 49~51 밖의 값을 1씩 현재 값에서 되돌리기"였는데, 현재 값을 되돌리니 학창기의 선택(행복·관계 효과)까지 2~5년 안에 지워졌다(R-063).
 *    출생 편차를 값이 아니라 일정으로 걷어 내면 선택의 효과는 그대로 남고, 출생값과 최종값의 상관은 (1 - fadeShare)만큼의 출생 영향만 남아 낮게 유지된다.
 *  - adult(20세~): every살마다 값이 high보다 높으면 -1, low보다 낮으면 +1 한다 — 한참 벗어난 값만 천천히 돌아온다(좋은 일·나쁜 일의 효과가 평생 이어지게 하되 100·0에 붙지 않게).
 */
export const MOOD_DRIFT = {
  school: { fadeShare: 0.8, fromAge: 7, toAge: 19 },
  adult: { low: 36, high: 64, every: 4 },
};

/** 노년기 관계 자연 감소(년 간격). 오래 곁에 있던 사람들이 하나둘 줄어든다. */
export const SENIOR_RELATIONSHIP_DECAY_EVERY = 4;

/** 노년기 생활비로 재산이 줄어드는 간격 = max(2, round(이 값 / ERA_CONFIG.priceIndex)) 년마다 -1 */
export const SENIOR_WEALTH_DRAIN_BASE = 4;

/**
 * 독립(청년 진입, 20세): 재산이 "집안 형편"에서 "내가 가진 것"으로 바뀐다(R-025와 같은 맥락).
 * 새 재산 = round(familyShare × 집안 재산 + educationShare × 학력 + base). 부모 재력의 영향은 남지만 그대로 이어지진 않는다.
 */
export const INDEPENDENCE = { familyShare: 0.5, educationShare: 0.2, base: 10 };

// ---------- 사망 ----------

/**
 * 연간 사망 확률 = (baseline + A·exp(B·나이)) × 건강 계수 × 시대 계수(ERA_CONFIG.life.mortalityScale),
 * 건강이 criticalBelow 미만이면 모자란 만큼 criticalStep씩 더한다. 절대 상한 나이(ERA_CONFIG.life.maxAge)에서는 반드시 사망.
 * 건강 계수 = 2^((50 - 건강) / healthDoubling): 건강 50이면 1, 25 모자랄 때마다 두 배, 25 넘칠 때마다 반.
 */
export const MORTALITY = {
  baseline: 0.00015,
  gompertzA: 1.03e-6,
  gompertzB: 0.132,
  healthDoubling: 25,
  criticalBelow: 15,
  criticalStep: 0.01,
};

// ---------- 연표 저장 상한 ----------

/**
 * 연표 상한/요약 정책: 한 판에 이벤트는 해마다 최대 하나라서 지금은 정상 플레이에서 상한에 닿지 않는다
 * (가장 긴 다가올 세상 기준 111해 + 단계 문구 5줄(출생 포함) + 사망 1줄 = 117줄). 상한은 손상된 저장이나 데이터 변경이
 * 저장 용량을 무한히 키우지 못하게 두는 안전장치다.
 * 넘치면 core/history.ts#appendHistory가 가장 오래된 "서술 이벤트(선택이 없는 것)"부터 버리고, 그다음 오래된 선택지 기록,
 * 그다음 단계 기록 순으로 버린다. 출생(맨 앞)과 사망 기록은 끝까지 남긴다(엔딩 연표용).
 * 상한 300 (SPEC-003 DB12 ▲, M4): 해마다 이벤트가 둘 이상 생기는 새 콘텐츠(영유아 사건·자유 기록 — M7)와 인생 기록 화면의 「쌓이는 줄」에 맞춰 160에서 올렸다.
 * 최악 판 저장 크기(모든 줄이 이 파일의 길이 상한을 꽉 채운 300줄)는 tests/storageLife.test.ts가 200KB 이하임을 단언한다.
 */
export const HISTORY_LIMITS = { maxEntries: 300, maxTextLength: 400, maxTitleLength: 60, maxChoiceLength: 80 };

/** 저장 검증 한도: 본 이벤트 목록 / 플래그 개수 */
export const STATE_LIMITS = { maxSeen: 400, maxFlags: 200, maxFlagLength: 40, maxCauseLength: 40 };
