import { AUTO_CHOICE_MS, HOLD_MS, JUMP_OVERHEAD_SEC, READ_MODEL, lifeModeOf } from '../data/timingTable';
import type { TickCounts, TickKind } from './life';
import type { Era, LifeLength, Speed } from './types';

/** 시간 모델과 연출 시간 계산(순수 함수). 타이머 자체는 UI 계층에만 있다. */

/** 연출 대기를 정할 때 더 알아야 하는 것: 판의 인생 길이(없으면 기본 모드)와 그 해의 줄 수(없으면 1줄) */
export interface HoldOptions {
  mode?: LifeLength | null;
  /** 그 해 연표에 남은 사건·선택 줄 수(`TickInfo.lines`). 둘째 줄부터 줄마다 `extraLineMs`가 더해진다. */
  lines?: number;
  /**
   * 부모님이 정한·흘러간 해(`TickInfo.readNeedMs`)의 카드 읽기 필요량(ms). 결과 해(`resolved`)의 연출 대기는 `max(기본 대기 + 줄 대기, 필요량)`이 된다 —
   * 느린 독자가 카드와 결과 문장을 다 읽기 전에 해가 넘어가지 않는다 (SPEC-005 PD5-d, 설계 문서 4-3절). 사람이 고른 결과 해에는 없다.
   */
  readNeedMs?: number;
}

/** 부모 카드 읽기 필요량의 가정 (SPEC-005 PD5-d): 느린 독자(`READ_MODEL.cpm.high`, 500자/분) + 여유 3초 + 인용 박스가 있으면 `READ_MODEL.citeSec.high`(13초) */
export const CARD_NEED = { marginSec: 3 } as const;

/**
 * 부모님이 정한·흘러간 카드를 느린 독자가 읽는 데 드는 시간(ms) = 카드의 모든 글 + 그 해 결과 문장의 글자 수 ÷ 500자/분 + 여유 3초 + 인용 박스 13초(있으면). 정수 ms로 반올림한다.
 * 글자 수는 호출하는 쪽이 센다(`life.ts#resolveDelegated`: 칩·제목·상황·고른 길·도장·영향 줄·결과 문장, 첫 부모 카드는 안내 한 줄까지).
 */
export function cardReadNeedMs(chars: number, cited: boolean): number {
  const sec = (Math.max(0, chars) / READ_MODEL.cpm.high) * 60 + CARD_NEED.marginSec + (cited ? READ_MODEL.citeSec.high : 0);
  return Math.round(sec * 1000);
}

/** 한 줄 더할 때마다 더하는 대기(ms, 1배속) = extraLineMs × 모드 계수 */
export function extraLineMsFor(mode?: LifeLength | null): number {
  const m = lifeModeOf(mode);
  return Math.round(m.extraLineMs * m.holdScale);
}

/**
 * 한 걸음을 보여 준 뒤 다음 해로 넘어가기까지의 대기(ms, 1배속). 선택지·사망·진행 불가에는 타이머 대기가 없어 null.
 * 대기 = HOLD_MS(종류별 기본 표) × 모드 계수 + (줄 수 − 1) × 줄 대기 (서술 해·결과 해만 — 조용한 해는 줄이 없다). 정수 ms로 반올림한다.
 */
export function holdMsFor(kind: TickKind | null, opts: HoldOptions = {}): number | null {
  const m = lifeModeOf(opts.mode);
  const scaled = (base: number) => Math.round(base * m.holdScale);
  const extra = () => {
    const lines = opts.lines;
    const extraLines = lines !== undefined && Number.isFinite(lines) ? Math.max(0, Math.floor(lines) - 1) : 0;
    return extraLines * extraLineMsFor(opts.mode);
  };
  switch (kind) {
    case 'narrative':
      return scaled(HOLD_MS.narrative) + extra();
    case 'resolved': {
      const base = scaled(HOLD_MS.resolved) + extra();
      const need = opts.readNeedMs;
      return need !== undefined && Number.isFinite(need) ? Math.max(base, Math.round(need)) : base;
    }
    case 'choice':
    case 'death':
      return null;
    default:
      return scaled(HOLD_MS.quiet); // quiet, none, null(복원 직후)
  }
}

/** 실제 타이머 지연(ms) = 대기 / 배속 / 시간 배율(개발 서버 전용 탐침). 최소 0. */
export function holdDelayMs(kind: TickKind | null, speed: Speed, timeScale = 1, opts: HoldOptions = {}): number | null {
  const base = holdMsFor(kind, opts);
  if (base === null) return null;
  return Math.max(0, base / speed / timeScale);
}

/** 자동 모드가 선택지를 고르기까지의 지연(ms) */
export function autoChoiceDelayMs(speed: Speed, timeScale = 1): number {
  return Math.max(0, AUTO_CHOICE_MS / speed / timeScale);
}

export interface PlayMode {
  speed: Speed;
  /** "다음 결정으로"로 연출을 건너뛰는가 */
  skipToDecision: boolean;
}

/** 읽는 시간 가정의 수준: 낮음(빠른 독자) / 중앙 / 높음(느린 독자) / 상한(첫 플레이·좁은 화면 스크롤까지 본 보수 가정 = 높음 × upperFactor) */
export const READ_LEVELS = ['low', 'median', 'high', 'upper'] as const;
export type ReadLevel = (typeof READ_LEVELS)[number];

/** 결정 카드 한 장이 읽는 글자 수(제목 + 본문 + 보이는 선택지 라벨 + 영향 줄 × 가중치) — READ_MODEL.chars */
export function cardReadChars(): number {
  const c = READ_MODEL.chars;
  return c.title + c.body + c.visibleLabels * c.label + c.visibleLabels * c.impactPerChoice * c.impactWeight;
}

/**
 * 결정 카드 한 장을 읽고 고르는 시간 r(초) = 글자 읽기 + 고르는 시간 + 인용 읽기(그 세상의 노출률 × 인용 읽기 시간) (SPEC-003 LM2, content-M8.md 2-2절).
 * level 'upper'는 'high' 계산에 upperFactor를 곱한 값이다.
 */
export function readSecFor(era: Era, level: ReadLevel = 'median'): number {
  const lv = level === 'upper' ? 'high' : level;
  const seconds = (cardReadChars() / READ_MODEL.cpm[lv]) * 60 + READ_MODEL.chooseSec[lv] + READ_MODEL.citeExposure[era] * READ_MODEL.citeSec[lv];
  return level === 'upper' ? seconds * READ_MODEL.upperFactor : seconds;
}

/** 해 수 집계의 연출 합(ms, 1배속) = Σ 종류별 해 수 × 대기 + 둘째 줄부터의 줄 대기 — 모드 계수 포함, 배속 나누기 전 */
export function holdTotalMs(counts: TickCounts, mode?: LifeLength | null): number {
  const q = holdMsFor('quiet', { mode }) as number;
  const n = holdMsFor('narrative', { mode }) as number;
  const r = holdMsFor('resolved', { mode }) as number;
  // 부모님이 정한 해·흘러간 해도 결과 해와 같은 기본 대기를 쓰고(`parent`·`child`), 카드 읽기 필요량이 기본 대기(+ 줄 대기)보다 긴 몫은 `delegatedExtraMs`가 더한다 (PD5-d)
  return counts.quiet * q + counts.narrative * n + (counts.resolved + counts.parent + counts.child) * r + counts.extraLines * extraLineMsFor(mode) + counts.delegatedExtraMs;
}

/**
 * 한 판이 걸리는 시간 추정(초) — 시간 목표 판정의 모델 (SPEC-003 LM2, 기준의 교체: SPEC-001의 `READ_SEC`·`TIME_TARGET_MIN`을 대체한다, LD-12).
 * **결정 카드 수는 본인이 고르는 카드(`counts.choice` = c_self)다** (SPEC-005 TM1): 부모님이 정한·흘러간 해는 읽고 고르는 시간 r이 없고 연출 대기(카드 읽기 필요량 포함)만 센다.
 *  - 건너뛰지 않으면: 연출 합 ÷ 배속 + c_self × r (읽는 시간은 사람이 하는 일이라 배속과 무관)
 *  - 다음 결정으로: 연출 없음. (c_self + 마지막 사망까지의 이동 1회) × JUMP_OVERHEAD_SEC + c_self × r
 *  - extraSec: 기록 카드 입력 시간 같은 **참고 항**(목표 밖 — LD-1). 판정에는 0으로 두고, 값을 주면 합에 더해 돌려준다.
 * mode는 판의 인생 길이, era는 읽는 시간의 인용 노출률을 고른다.
 */
export function estimatePlaySeconds(counts: TickCounts, play: PlayMode, mode: LifeLength | null | undefined, era: Era, level: ReadLevel = 'median', extraSec = 0): number {
  const reading = counts.choice * readSecFor(era, level);
  if (play.skipToDecision) return reading + (counts.choice + 1) * JUMP_OVERHEAD_SEC + extraSec;
  return holdTotalMs(counts, mode) / 1000 / play.speed + reading + extraSec;
}
