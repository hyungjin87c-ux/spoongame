import type { Era, LifeLength } from '../core/types';

/**
 * 연출 시간·시간 모델 상수 표 (1배속 기준). UI의 타이머와 헤드리스 시간 모델(core/timing.ts, scripts/simulate.ts·timeReport.ts)이 같은 표를 쓴다.
 * 코드가 아니라 이 표만 고치면 한 판의 길이를 바꿀 수 있다.
 *
 * 한 걸음(한 해)을 화면에 보여 준 뒤 다음 해로 넘어가기까지 기다리는 시간(`HOLD_MS`, 기본 표):
 *  - quiet: 아무 일 없이 지나간 해(나이 숫자만 바뀐다)
 *  - narrative: 서술 이벤트가 있던 해(문장을 읽을 시간)
 *  - resolved: 선택지에서 고른 뒤 결과 문구를 읽을 시간
 * 선택지 이벤트(choice)는 타이머가 아니라 사람이 정한다 → 읽는 시간 모델(`READ_MODEL`)을 쓴다. 사망은 곧바로 엔딩 화면으로 넘어가므로 기다리지 않는다.
 *
 * 인생 길이 모드(SPEC-003 LM2, M8 — docs/data/content-M8.md): 기본 표에 **모드 계수**(`holdScale`)를 곱한 값이 그 판의 연출 대기다. 표(`HOLD_MS`)를 직접 고치지 않고 계수만 움직인다.
 * 한 판의 시간 T = Σ연출(HOLD_MS × 계수 + 한 해 둘째 줄부터의 줄 대기) ÷ 배속 + Σ결정 읽기 r (기록 카드 입력 시간·접어 둔 시간·기록 시트가 열린 시간은 목표 밖 — LD-1).
 *
 * 이력: M4(콘텐츠) 조정으로 M3 QA 실측(1배속 약 7분)이 SPEC-001 목표에 못 미쳐 판당 선택지를 늘리고 연출을 늘렸다(SPEC-001 추가 결정 2026-10-14, R-037; 이전 값 quiet 4000 / narrative 10000 / resolved 8000).
 */
export const HOLD_MS = {
  quiet: 7000,
  narrative: 17000,
  resolved: 13000,
} as const;

/** 가정치: "다음 결정으로"를 누르고 새 선택지 화면을 알아보는 데 드는 시간(초). */
export const JUMP_OVERHEAD_SEC = 1;

/** 자동 모드가 선택지 화면을 보여 준 뒤 자동으로 고르기까지의 시간(ms, 1배속 기준). */
export const AUTO_CHOICE_MS = 3000;

/**
 * 한 판의 결정 카드 수 조절. 평균은 `EVENT_FREQUENCY`와 이벤트 풀이 만들고, 이 장치는 **윗꼬리만 자른다**(M4 원칙):
 *  - soft: 이만큼 푼 뒤부터는 선택지가 나올 확률(EVENT_FREQUENCY.choice)에 softFactor를 곱해 잦아들게 한다.
 *  - hard: 이만큼 풀면 그 판에는 더 이상 선택지가 나오지 않는다(서술 이벤트와 조용한 해만 이어진다).
 * 지금까지 푼 선택지 수는 연표의 선택 기록 수다.
 */
export interface ChoicePacing {
  soft: number;
  softFactor: number;
  hard: number;
}

/**
 * 인생 길이 모드 한 줄 (SPEC-003 LM2). 엔진은 판의 모드(`GameState.lifeLength`)로 페이싱을, 시계는 연출 계수를 고른다(LM3 — 첫 화면에서 설정을 바꿔도 진행 중인 판은 흔들리지 않는다).
 */
export interface LifeLengthMode {
  label: string;
  /** 첫 화면에서 고를 수 있는가 — `core/types.ts#SELECTABLE_LIFE_LENGTHS`와 같아야 한다(tests/lifeLengthModes.test.ts). 1차(M8)는 short30만 true다(LD-4). */
  selectable: boolean;
  /** 연출 대기 계수 k — HOLD_MS × k (1배속 기준) */
  holdScale: number;
  /** 한 해 둘째 줄부터 줄마다 더하는 대기(ms, 1배속 · × k) — 줄 하나의 읽기(본문 평균 52자 ÷ 600자/분 ≈ 5.2초)에 맞춘다 */
  extraLineMs: number;
  pacing: ChoicePacing;
  /** 판당 결정 카드 수 판정: 평균 구간, 하드 상한 −1 이상인 판의 비율 한계 (short30만 판정, long60은 보고) */
  cards: { meanLow: number; meanHigh: number; nearCapShareMax: number };
  /** 시간 목표(분): 사람 실측 허용 구간 / 헤드리스 모델 평균 허용 구간 (long60은 2차 판정) */
  timeMin: { humanLow: number; humanHigh: number; modelLow: number; modelHigh: number };
}

/**
 * 모드 표. short30 값은 content-M8.md 2-3·2-4·2-6절 + 11절(마스터 결정 LD-1~LD-12)과 M8 측정(ai-log/2026-10-19_SPEC-003_dev-M8.md)에서 왔다.
 * long60(「약 1시간」)은 **1차에서 닫아 둔다**(LD-4 — 지금 풀로는 약 38~41분이라 「1시간」이라는 약속이 거짓이 된다, REV-003-M2-1 R-202와 같은 원칙): 표·시험·시뮬레이션만 준비하고 `selectable`은 false다.
 * long60의 페이싱은 2차 착수 때 정한다(지금은 short30과 같은 값을 임시로 둔다 — 결정 카드 45~55장과 최소 간격 2년의 충돌, LD-5). 다른 값으로 바꾸면 같은 시드의 카드 수가 갈리므로 2차에서 한꺼번에 정한다.
 * 이 객체는 시험이 일부러 값을 바꿔 끼우는 데도 쓰이므로 불변으로 얼리지 않는다(tests/pacing.test.ts).
 */
export const LIFE_LENGTH_MODES: Record<LifeLength, LifeLengthMode> = {
  short30: {
    label: '약 30분',
    selectable: true,
    // 연출 계수 1.25 — 마스터 결정 ⓐ(2026-10-20, REV-003-M8-1 R-415): 처음 값 1.2에서 1.25로 옮겼다. 근거: 1.2에서는 1배속 수동 모델 예상이 25.5 / 28.0 / 28.3분(평균 27.3)으로 목표 「약 30분」보다 짧은 쪽이었고 지난 세상은 시대별 하한 25.5분(modelLow − 1.5)에 붙어 있었다(여유 0 SE).
    // 1.25에서는 약 26.2 / 28.7 / 29.0분(평균 28.0)으로 하한과의 여유가 3 SE를 넘는다(측정표·SE 표: ai-log/2026-10-19_SPEC-003_dev-M8.md 11절). 실측 전에 옮긴 것이지만 모델이 지금 가진 가장 좋은 정보이고 목표는 「약 30분」이다.
    // 형진 님 실측 뒤 보정 레버 순서(연출 계수 1.1~1.3 → 카드 수 → 마스터, LD-3)는 그대로이며 1.25가 새 초기값이다.
    holdScale: 1.25,
    extraLineMs: 5000,
    // 페이싱 — soft 24 / hard 30으로 **확정**(마스터 결정 2026-10-20, ai-log/2026-10-19_SPEC-003_dev-M8.md 10절). 목표는 판 길이(약 30분)이고 카드 수는 수단이다: 이 값(연출 계수 1.25)에서 1배속 수동 모델 예상이 약 26.2 / 28.7 / 29.0분(평균 28.0)으로 시간 목표 안이다.
    // 옛 값(soft 23 / hard 26)은 판의 17.5 / 24.3 / 30.2%가 하드 상한에 닿고 노년 평균을 3.87 / 4.35 / 4.54로 굶겼다(M7a 이전 4.27 / 5.02 / 5.33). 이 값은 노년을 4.33 / 5.02 / 5.31로 돌려놓고 하드−1 이상 판이 5% 이하이며 경제·엔딩 가드가 기존 보고 한계 안이다
    // (새로 보고하고 마스터가 승인한 하나: 지금 세상 사망 시점 중앙값 1·2단계 동률 0 = 0 — economyCheckLib.ts의 KNOWN_GUARD_GAPS `present:end-g3`).
    // 하지 않기로 한 것: soft 29 / hard 33(content-M8 2-4절 제안 — 사망 시점 순자산<0이 31 / 31 / 44%로 올라 경제 가드 셋과 「0원 판」 e2e를 깬다)과 빈도를 올리는 안(다른 가드를 깬다). 후보 표는 `npm run report:time -- 1000 --only=candidates`.
    pacing: { soft: 24, softFactor: 0.3, hard: 30 },
    // 카드 수 판정 구간(마스터 결정 2026-10-20, M-3으로 하한을 내림): 상한 29는 그대로. SPEC의 26~30·LD-2의 25.5~29는 수단이던 카드 수 목표라 판 길이로 대신한다.
    // 하한 계산(LD-9: 임계는 측정값에서 표준오차(SE) 3배 이상 — 여유 표 `npm run report:time -- 1000 --only=margins`, 시험 tests/judgeMargins.test.ts): 지난 세상 카드 평균이 가장 낮다.
    //   1000판 줄 네 개(시험·sim:1000 × 수동 흉내·자동 성향)의 (측정값 − 3 SE) = 23.58 / 23.58 / 23.40 / 23.49, 5000판 줄 네 개(가장 큰 표본)는 23.69 / 23.71 / 23.64 / 23.71.
    //   가장 불리한 줄은 sim:1000 수동 흉내(23.690 ± 0.097 → 23.40)다. 처음 하한 23.5는 그 줄에서 2.0 SE(자동 성향 줄 2.9 SE)라 3 SE에 못 미쳤다 → 23.40 이하로 내려 0.1 단위로 **23.3**(그 줄 4.0 SE, 시험 줄 6.0 SE, 5000판 줄 10 SE 이상).
    //   기준의 뜻(카드 수 범위)은 그대로다: 평균이 24~25장 중심이고 상한 29까지 4 SE 이상 떨어져 있어 「약 30분」을 맞추는 수단으로서의 범위(23.3~29)가 유지된다. 하한을 내려도 노년 회복은 아래 노년 하한이 따로 지킨다.
    cards: { meanLow: 23.3, meanHigh: 29, nearCapShareMax: 0.1 },
    timeMin: { humanLow: 25, humanHigh: 35, modelLow: 27, modelHigh: 33 },
  },
  long60: {
    label: '약 1시간',
    selectable: false,
    holdScale: 2.0,
    extraLineMs: 5000,
    pacing: { soft: 24, softFactor: 0.3, hard: 30 }, // 2차 착수 때 정한다 — 1차는 30분 모드와 같은 값(임시)
    cards: { meanLow: 45, meanHigh: 55, nearCapShareMax: 0.1 },
    timeMin: { humanLow: 50, humanHigh: 70, modelLow: 52, modelHigh: 68 },
  },
};

/** 모드를 알 수 없을 때(출생 전 상태·변조된 값) 쓰는 모드 — `core/state.ts#DEFAULT_LIFE_LENGTH`와 같다 */
const FALLBACK_LIFE_LENGTH: LifeLength = 'short30';

/** 판의 인생 길이 → 모드 한 줄. 출생 전(null)이거나 모르는 값이면 기본 모드다. */
export function lifeModeOf(lifeLength: LifeLength | null | undefined): LifeLengthMode {
  const key = lifeLength !== null && lifeLength !== undefined && Object.prototype.hasOwnProperty.call(LIFE_LENGTH_MODES, lifeLength) ? lifeLength : FALLBACK_LIFE_LENGTH;
  return LIFE_LENGTH_MODES[key];
}

/**
 * 읽는 시간 모델 (SPEC-003 LM2, content-M8.md 2-2절): 결정 카드 한 장을 읽고 고르는 시간 r(초) = 글자 읽기 + 고르는 시간 + 인용 읽기(인용이 보일 때만).
 *  - 글자 수는 합쇼체 실제 글자 수다(`npm run report:time`이 이벤트·인용 데이터와 대조한다 — 시험 tests/timeModel.test.ts가 ±10%). 카드 한 장이 읽는 글자 = 제목 + 본문 + 보이는 선택지 라벨 + 영향 줄(기호를 훑는 것이라 가중 0.5).
 *    영향 줄 안내 한 줄(선택지 아래, 매 카드)은 처음 세 장만 읽는다고 보아 평균에서 뺐다.
 *  - 분당 글자 수·고르는 시간은 SPEC LM2의 가정 그대로(묵독 500/600/700자/분 · 고르기 5/10/15초). 인용 읽기는 M7b 6절 메모: 요약 전부 + 출처 줄 절반 + 숫자 해석 약 1.5초.
 *  - 시대별 노출률(`citeExposure`)은 `npm run report:citations`로 센 값이다(인용 박스가 뜬 카드의 비율).
 *  - upper = high × upperFactor: 첫 플레이의 망설임과 좁은 화면 스크롤까지 본 보수 가정.
 * 사람의 r은 사람 실측이 정한다(LM7) — 이 값은 출발점이고 실측 뒤 `median`을 보정한다(content-M8.md 6-3절).
 */
export const READ_MODEL = {
  chars: { title: 8.1, body: 52.0, label: 12.4, visibleLabels: 2.7, impactPerChoice: 9.3, impactWeight: 0.5 },
  cpm: { low: 700, median: 600, high: 500 },
  chooseSec: { low: 5, median: 10, high: 15 },
  citeSec: { low: 7, median: 10, high: 13 },
  citeExposure: { past: 0.1, present: 0.51, future: 0.47 } as Readonly<Record<Era, number>>,
  upperFactor: 1.2,
};

/**
 * 판당 노년(65세 이상) 결정 카드 평균의 하한 — 지난 / 지금 / 다가올 세상 (content-M8.md 2-4절: M7a가 굶긴 몫을 돌려받는다).
 * 처음 값은 M7a 이전 HEAD 4.27 / 5.02 / 5.33 − 0.3 = 3.97 / 4.72 / 5.03이었다. 마스터 결정 M-3(2026-10-20, LD-9: 임계는 측정값에서 3 SE 이상)으로 **가장 불리한 표본 줄의 (측정값 − 3 SE) 이하로 내렸다**:
 *   지난: 1000판 줄 네 개의 (측정값 − 3 SE) = 4.13 / 4.07 / 3.96 / 3.99, 5000판 줄 4.15 / 4.16 / 4.15 / 4.22 → 최솟값 3.963(sim:1000 수동 흉내 4.171 ± 0.069)이라 0.05 단위로 **3.95**(그 줄 3.2 SE, 처음 3.97은 2.9 SE).
 *   지금: 최솟값 4.770(sim:1000 수동 흉내 4.989 ± 0.073) ≥ 4.72라 **그대로 4.72**(그 줄 3.7 SE).
 *   다가올: 최솟값 5.009(sim:1000 자동 5.211 ± 0.067)라 0.05 단위로 **5.00**(그 줄 3.1 SE, 처음 5.03은 2.7 SE).
 * 기준의 뜻(노년 회복)은 유지된다: M7a가 굶긴 상태(옛 페이싱 23 / 26)의 노년 평균 3.87 / 4.35 / 4.54는 새 하한 3.95 / 4.72 / 5.00 아래이고(지난 세상은 0.08 차이), 회복한 값 4.33 / 5.02 / 5.31은 하한 위 3 SE 이상이다. 여유 시험: tests/judgeMargins.test.ts.
 */
export const SENIOR_CHOICE_MEAN_MIN: Readonly<Record<Era, number>> = { past: 3.95, present: 4.72, future: 5.0 };

/** 영유아(0~7세) 결정 카드 평균의 하한 (SPEC-003 IN2) */
export const INFANT_CHOICE_MEAN_MIN = 2.8;
