/**
 * 출발점의 수저 구간 문구(`bandLabel` — 룰렛·출생신고·프로필의 「하위 25% 안쪽」)를 **화면에 적힌 숫자만으로** 다시 읽는 독립 기준 (R-091·R-096). core/ending.ts의 계산(startBandOf)을 부르지 않고 문구에서 구간을 다시 구한다.
 * tests/ending.test.ts(5151가지 구간 전수)가 쓴다 — 문구와 구간이 어긋나면 여기서 갈린다.
 * 2026-11-13: 엔딩 「출발선 대비」 삭제(결정 후속 256)로 도착 점수(`readEnd`)·이동 판정(`expectedMovement`)은 걷었다.
 *
 * 점수는 아래에서부터 센 백분위다(클수록 부유): 상위 N% → 100 - N, 하위 N% → N.
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
