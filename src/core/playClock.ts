import type { PlayTime } from './types';

/**
 * 플레이 시간 타이머의 순수 부분 (SPEC-003 LM5·LM6, M8 — docs/data/content-M8.md 5절). 시계(Date·performance.now)는 만지지 않는다 — 시각은 UI(ui/usePlayTimer.ts)가 넣는다.
 *
 * 세 가지로 나뉜다:
 *  1. `playBucketOf` — 지금 상태에서 시간을 **어느 버킷에 쌓을지** 고르는 표(앞에서부터 처음 맞는 줄). 시계의 `running`·자동 선택 타이머와 같은 입력에서 만들어 서로 어긋나지 않는다.
 *  2. `accruePlay` — 흐른 시간을 버킷에 더하는 누적기. 한 번에 `PLAY_TICK_MAX_MS`(5초)를 넘게 건너뛴 틱은 5초만 센다(기기 절전·디버거 정지 방어).
 *  3. 저장 검증·표시 — `readPlay`(이상한 값이면 undefined = 그 필드만 버린다), `displaySeconds`·`formatPlayTime`(엔딩의 「mm:ss」·낭독·datetime), `isCleanRun`.
 */

// ---------- 1. 버킷 ----------

export const PLAY_BUCKETS = ['hold', 'decide', 'fold', 'note', 'idle', 'off'] as const;
/** hold 연출 / decide 결정 읽기 / fold 카드 접어 둠 / note 기록 시트 / idle 일시정지·탭 가림 등 / off 인생 단계가 아니거나 시간을 재지 않는 판(세지 않는다) */
export type PlayBucket = (typeof PLAY_BUCKETS)[number];

/** 표시값(플레이 시간)에 들어가는 버킷 (LD-7: 연출 + 결정 읽기) */
export const COUNTED_BUCKETS: readonly PlayBucket[] = ['hold', 'decide'];

export interface PlayInputs {
  /** 이 판에 시간 기록이 있다(`game.play !== undefined`) — M8 이전에 시작한 판은 재지 않는다 */
  timed: boolean;
  /** 인생 단계다(`game.phase === 'life'`) — 룰렛·출생신고·엔딩은 세지 않는다 */
  inLife: boolean;
  /** 다른 탭에 밀려 이 탭이 멈췄다 */
  superseded: boolean;
  /** 첫 화면을 다시 열어 둔 상태(「나가기」) */
  showTitle: boolean;
  /** 나가기 확인 단계가 열려 있다 */
  exitAsk: boolean;
  /** 탭이 보인다 */
  visible: boolean;
  /** 일시정지 중이다 */
  paused: boolean;
  /** 기록 시트(「생각 남기기」)가 열려 있다 */
  noteOpen: boolean;
  /** 결정 카드가 대기 중이다 */
  hasPending: boolean;
  /** 대기 중인 결정 카드를 접어 두었다 */
  folded: boolean;
}

/**
 * 지금 흐르는 시간을 쌓을 버킷 (content-M8.md 5-1절 표, 앞에서부터 처음 맞는 줄):
 * 1 밀린 화면·첫 화면 다시 열기·나가기 확인 → idle / 2 탭 가림 → idle / 3 일시정지 → idle / 4 기록 시트 → note / 5 결정 대기 + 접힘 → fold / 6 결정 대기 → decide / 7 그 밖(연출 시계가 흐르는 중) → hold.
 * 불변식(tests/playClock.test.ts): 연출 시계의 `running`이 참인 상태는 모두 hold이고, 자동 선택 타이머가 걸린 상태(`autoChooseArmed`)는 decide다.
 */
export function playBucketOf(i: PlayInputs): PlayBucket {
  if (!i.timed || !i.inLife) return 'off';
  if (i.superseded || i.showTitle || i.exitAsk) return 'idle';
  if (!i.visible) return 'idle';
  if (i.paused) return 'idle';
  if (i.noteOpen) return 'note';
  if (i.hasPending) return i.folded ? 'fold' : 'decide';
  return 'hold';
}

// ---------- 2. 누적기 ----------

/** 시계 틱 하나가 셀 수 있는 최대 시간(ms). 기기 절전·디버거 정지·가려진 탭의 늦은 타이머로 한 번에 크게 건너뛴 시간은 이만큼만 센다 */
export const PLAY_TICK_MAX_MS = 5000;

/** 저장되는 시간 필드 하나의 상한(ms) = 24시간. 이를 넘는 값은 이상한 값이다 */
export const PLAY_MAX_MS = 24 * 60 * 60 * 1000;
/** 저장되는 횟수 필드(skips·resumes)의 상한 */
export const PLAY_MAX_COUNT = 100_000;

export function emptyPlay(): PlayTime {
  return { hold: 0, decide: 0, fold: 0, note: 0, idle: 0, offSpeed: 0, auto: 0, skips: 0, resumes: 0 };
}

const TIME_FIELDS = ['hold', 'decide', 'fold', 'note', 'idle', 'offSpeed', 'auto'] as const;
const COUNT_FIELDS = ['skips', 'resumes'] as const;
const PLAY_KEYS: readonly string[] = [...TIME_FIELDS, ...COUNT_FIELDS];

export interface AccrueContext {
  /** 지금 배속이 1배속인가 (아니면 hold가 offSpeed에도 쌓인다) */
  speedOne: boolean;
  /** 자동 모드인가 (켜져 있으면 hold·decide가 auto에도 쌓인다) */
  auto: boolean;
  /**
   * 개발 서버의 `?__timescale=N`(연출을 N배 빠르게 — e2e가 30분을 기다리지 않게): 연출 시계가 N배 빠르게 흐르므로 **hold만** 흐른 시간에 N을 곱해 모델 시간으로 센다.
   * 사람이 읽는 시간(decide)은 빨라지지 않으므로 곱하지 않는다. 배포 번들에서는 늘 1이다.
   */
  timeScale?: number;
}

/**
 * 흐른 시간 elapsedMs를 bucket에 더한 새 기록을 돌려준다(원본은 바꾸지 않는다). 세는 시간 = min(elapsedMs, 5초) (hold는 timeScale 배), 정수 ms로 반올림, 필드 상한 24시간.
 * 'off'이거나 시간이 음수·NaN·0이면 같은 객체를 돌려준다. offSpeed = 1배속이 아닌 hold, auto = 자동 모드 중의 hold·decide.
 */
export function accruePlay(play: PlayTime, bucket: PlayBucket, elapsedMs: number, ctx: AccrueContext): PlayTime {
  if (bucket === 'off' || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return play;
  const clamped = Math.min(elapsedMs, PLAY_TICK_MAX_MS);
  const scale = bucket === 'hold' && ctx.timeScale !== undefined && Number.isFinite(ctx.timeScale) && ctx.timeScale > 0 ? ctx.timeScale : 1;
  const add = Math.round(clamped * scale);
  if (add <= 0) return play;
  const next: PlayTime = { ...play };
  const bump = (k: (typeof TIME_FIELDS)[number]) => {
    next[k] = Math.min(PLAY_MAX_MS, next[k] + add);
  };
  bump(bucket);
  if (bucket === 'hold' && !ctx.speedOne) bump('offSpeed');
  if ((bucket === 'hold' || bucket === 'decide') && ctx.auto) bump('auto');
  return next;
}

/** 「다음 결정으로」 한 번 */
export function addSkip(play: PlayTime): PlayTime {
  return { ...play, skips: Math.min(PLAY_MAX_COUNT, play.skips + 1) };
}

/** 새로고침·탭 닫기 뒤 이어하기 한 번 — core/playTimer.ts가 그 탭에서 hold·decide가 처음 쌓일 때 부른다(앱이 뜨는 순간이 아니다, R-417) */
export function addResume(play: PlayTime): PlayTime {
  return { ...play, resumes: Math.min(PLAY_MAX_COUNT, play.resumes + 1) };
}

export function playEqual(a: PlayTime, b: PlayTime): boolean {
  return PLAY_KEYS.every((k) => a[k as keyof PlayTime] === b[k as keyof PlayTime]);
}

/** 같은 판의 오래된 기록이 새 기록을 되돌리지 못하게: 모든 필드가 줄지 않았는가 */
export function playNotBehind(next: PlayTime, current: PlayTime): boolean {
  return PLAY_KEYS.every((k) => next[k as keyof PlayTime] >= current[k as keyof PlayTime]);
}

// ---------- 3. 저장 검증·표시 ----------

const isCount = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;

/**
 * 저장에서 읽은 `play` 값을 검증한다. 모양이 맞으면(키 아홉 개, 시간 일곱 개는 0~24시간 정수 ms, 횟수 둘은 0~10만 정수) 같은 값을, 아니면 undefined를 돌려준다 —
 * 호출하는 쪽(`parseGame`)이 **그 필드만 버리고 판은 그대로 연다**(NC-2 「거부하지 않고 걷어 낸다」). 음수·문자열·소수·NaN(JSON에서는 null)·상한 초과(1e308)·배열·키 모자람/넘침이 모두 undefined다.
 */
export function readPlay(v: unknown): PlayTime | undefined {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== PLAY_KEYS.length || !PLAY_KEYS.every((k) => Object.prototype.hasOwnProperty.call(o, k))) return undefined;
  for (const k of TIME_FIELDS) if (!isCount(o[k], PLAY_MAX_MS)) return undefined;
  for (const k of COUNT_FIELDS) if (!isCount(o[k], PLAY_MAX_COUNT)) return undefined;
  const out = {} as PlayTime;
  for (const k of PLAY_KEYS) out[k as keyof PlayTime] = (o[k] as number) === 0 ? 0 : (o[k] as number); // -0 → 0
  return out;
}

/**
 * 화면에 보이는 플레이 시간(초) = **버킷별로 초를 버린 뒤 더한 값** ⌊hold/1000⌋ + ⌊decide/1000⌋ (LD-7 연출 + 결정 읽기, D-94 — docs/design/copy.md 8-2).
 * 엔딩 보조 문장의 분해 두 값(각각 버림)을 더하면 늘 이 값과 같다(⌊hold + decide⌋로 하면 1초 어긋나는 판이 생긴다 — 참값과의 차는 최대 1초).
 * 접어 둔 시간·기록 시트·일시정지·탭 가림·나가기는 뺀다.
 */
export function displaySeconds(play: PlayTime): number {
  return Math.floor(play.hold / 1000) + Math.floor(play.decide / 1000);
}

/** 화면에 보이는 플레이 시간(ms) = displaySeconds × 1000 (초 미만은 보이지 않으므로 이미 버려진 값) */
export function playDisplayMs(play: PlayTime): number {
  return displaySeconds(play) * 1000;
}

/** 깨끗한 판 = 배속을 바꾸지 않고 자동 모드·「다음 결정으로」를 쓰지 않은 판 — 사람 실측은 이 판만 쓴다 (LM7) */
export function isCleanRun(play: PlayTime): boolean {
  return play.offSpeed === 0 && play.auto === 0 && play.skips === 0;
}

export interface PlayTimeText {
  /** 눈에 보이는 꼴 mm:ss — 분은 두 자리 이상·상한 없음(61분 5초 = 61:05, 100분 = 100:00) */
  text: string;
  /** 낭독 글자 「{m}분 {s}초」 — 0분도 「0분 59초」(규칙 하나) */
  spoken: string;
  /** time 요소의 datetime 값(ISO 8601 기간): PT27M46S */
  iso: string;
}

/**
 * 시간 값 하나의 세 꼴(copy.md 8-2): 눈에 보이는 mm:ss(aria-hidden) · 낭독 「{m}분 {s}초」(sr-only) · datetime PT…. 초 미만은 버리고 음수·NaN·Infinity는 0으로 읽는다.
 * 화면은 세 자리(표시값·분해 둘)에 같은 부품(ui/PlayTime.tsx)으로 이 값을 그린다. 시간 값 바로 뒤에는 조사를 두지 않는다(design-system.md 11-4 — 눈에 보이는 글자와 낭독 글자의 받침이 다르다).
 */
export function formatPlayTime(seconds: number): PlayTimeText {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return { text: `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`, spoken: `${minutes}분 ${rest}초`, iso: `PT${minutes}M${rest}S` };
}

/** mm:ss (밀리초로 받는다) */
export function formatPlayClock(ms: number): string {
  return formatPlayTime(ms / 1000).text;
}

/** 낭독 글자 「{m}분 {s}초」 (밀리초로 받는다) */
export function spokenPlayClock(ms: number): string {
  return formatPlayTime(ms / 1000).spoken;
}

/** time 요소의 datetime 값(ISO 8601 기간): 27분 46초 = PT27M46S (밀리초로 받는다) */
export function playClockDatetime(ms: number): string {
  return formatPlayTime(ms / 1000).iso;
}
