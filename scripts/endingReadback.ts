import type { Movement } from '../src/core';

/**
 * 엔딩 문장을 "다시 읽는" 독립 기준 (R-091·R-095·R-096). core/ending.ts의 계산(startBandOf·movementOf·standingScore)을 부르지 않고
 * **화면에 적힌 숫자만으로** 출발선 구간·도착 점수·방향을 다시 구한다. tests/ending.test.ts(5151가지 구간 전수·11990판 전수)와
 * 1000판 파이프라인(scripts/pipelineLib.ts)이 함께 쓴다 — 문장과 판정이 어긋나면 여기서 갈린다.
 *
 * 점수는 아래에서부터 센 백분위다(클수록 부유): 상위 N% → 100 - N, 하위 N% → N, 가운데쯤 → 50.
 */

/** 문장 속 모든 숫자 */
export function numbersIn(text: string): number[] {
  return [...text.matchAll(/\d+/g)].map((m) => Number(m[0]));
}

/**
 * 엔딩 문장의 출발선 부분(bandLabel이 만든 문구) → [low, high] (아래에서부터 센 백분위). 문구가 말할 수 있는 모든 모양을 읽는다:
 * 안쪽(맨 아래·맨 위) / 밖(한쪽에 붙었지만 반대편이 50%를 넘음) / 한쪽 절반 안의 A~B% 사이 / 약 N%(폭 0) / 50%를 걸친 "하위 A% 선과 상위 B% 선 사이" (M7e-3: 「선」) / 모두가 같은 자리.
 */
export function readBand(label: string): [number, number] {
  let m: RegExpExecArray | null;
  if ((m = /^하위 (\d+)% 안쪽$/.exec(label))) return [0, Number(m[1])];
  if ((m = /^상위 (\d+)% 안쪽$/.exec(label))) return [100 - Number(m[1]), 100];
  if ((m = /^상위 (\d+)% 밖$/.exec(label))) return [0, 100 - Number(m[1])]; // 위쪽 N%의 바깥 = 맨 아래부터 100-N까지
  if ((m = /^하위 (\d+)% 밖$/.exec(label))) return [Number(m[1]), 100]; // 아래쪽 N%의 바깥 = N부터 맨 위까지
  if ((m = /^상위 (\d+)~(\d+)% 사이$/.exec(label))) return [100 - Number(m[2]), 100 - Number(m[1])];
  if ((m = /^하위 (\d+)~(\d+)% 사이$/.exec(label))) return [Number(m[1]), Number(m[2])];
  if ((m = /^상위 약 (\d+)%$/.exec(label))) return [100 - Number(m[1]), 100 - Number(m[1])]; // 폭 0
  if ((m = /^하위 약 (\d+)%$/.exec(label))) return [Number(m[1]), Number(m[1])];
  if ((m = /^하위 (\d+)% 선과 상위 (\d+)% 선 사이$/.exec(label))) return [Number(m[1]), 100 - Number(m[2])];
  if (label === '모두가 같은 자리') return [0, 100];
  throw new Error(`출발선 문구를 읽지 못했다: ${label}`);
}

/** 엔딩 문장의 도착 부분(standingLabel이 만든 문구) → 점수: 상위 약 N% / 하위 약 N% / N% 안쪽 / 가운데쯤 */
export function readEnd(label: string): number {
  let m: RegExpExecArray | null;
  if ((m = /^상위 (?:약 )?(\d+)%(?: 안쪽)?$/.exec(label))) return 100 - Number(m[1]);
  if ((m = /^하위 (?:약 )?(\d+)%(?: 안쪽)?$/.exec(label))) return Number(m[1]);
  if (label === '가운데쯤') return 50;
  throw new Error(`도착 문구를 읽지 못했다: ${label}`);
}

/**
 * 구간(low, high)과 도착 점수만으로 방향을 정하는 규칙을 다시 적은 것. core/ending.ts#movementOf를 호출하지 않는다.
 *  - 구간 안(low <= 점수 <= high)은 비슷함.
 *  - 구간 밖은 그 쪽의 여유(grace) 이내까지 비슷함, 그보다 더 부유하면 앞섬·더 가난하면 뒤쪽.
 *  - 단 (R-095) 구간 바깥에 점수로 가질 수 있는 칸(위쪽 high+1..99, 아래쪽 1..low-1)이 여유보다 넓지 않은 쪽은 그 쪽의 여유가 0이다
 *    — 안 그러면 그 칸이 전부 여유 안이라 그 방향이 영영 나올 수 없다.
 * 칸의 수로 적었다(core는 `high + grace >= 99`로 적는다): 같은 규칙을 다른 식으로 적어 서로를 확인한다.
 */
export function expectedMovement(low: number, high: number, score: number, grace: number): Movement {
  const cellsAbove = Math.max(0, 99 - high);
  const cellsBelow = Math.max(0, low - 1);
  const upGrace = cellsAbove <= grace ? 0 : grace;
  const downGrace = cellsBelow <= grace ? 0 : grace;
  if (score >= low && score <= high) return 'same';
  if (score > high) return score - high <= upGrace ? 'same' : 'up';
  return low - score <= downGrace ? 'same' : 'down';
}
