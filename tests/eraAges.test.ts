import { describe, expect, it } from 'vitest';
import { eraOf, eraRowsOf, type EraBand, type EraContext, type EraWindow } from '../src/core/eraWindow';
import { REAL_WINDOWS } from './helpers/eraEventsTable';

/**
 * 시대의 창 나이 규칙 (SPEC-013 T1 2·4·T7 — 이전 SPEC-012 QF3 「전 해·나이 `ages` 점검」을 「사건 `ages` 0건 · `secondAges` 점검」으로 줄였다).
 * 개정 사유: QF3의 `ages`(사건·일상이 나이대 밖이면 후보가 아니다)·부록 A 「A 표」 18줄 `AGES_FIX`는 SPEC-013이 없앴다 — 일상이 데이터에서 빠졌고, 사건 문장은 사회 사실이라 어느 나이에도 읽힌다
 * (「태어난 해에 있었던 일」 — QA-012 RECORD 2). 나이는 **둘째 문장**에만 닿는다: 아이·어른 행동이 들어간 둘째 문장은 `secondAges`가 나이 밖일 때 둘째 문장만 빠진다.
 * 지금 승인된 둘째 문장 51개에는 아이 행동이 없어 `secondAges`가 0건이다(모든 나이에 나온다). 규칙의 동작은 합성 데이터로 잠근다(`tests/eraWindows.test.ts`와 같은 규칙, 여기서는 전 구간·나이로 넓혔다).
 */

const BANDS: readonly EraBand[] = ['low', 'mid', 'high'];
const ctxOf = (windows: readonly EraWindow[], over: Partial<EraContext> = {}): EraContext => ({ regionKey: '서울', gentle: false, seed: 777, windows, ...over });

describe('사건 ages 0건 · secondAges 점검 (SPEC-013 완료 기준 3·8)', () => {
  it('데이터에 ages가 있는 장면 0건 · secondAges가 있는 장면 0건 (둘째 문장에 아이 행동이 없다)', () => {
    for (const w of REAL_WINDOWS) {
      expect('ages' in w, `${w.id}: 사건 ages 0건`).toBe(false);
      expect(w.secondAges, `${w.id}: secondAges는 아이 행동이 있는 둘째 문장에만(지금 0건)`).toBeUndefined();
    }
  });

  it('어느 사건 해·나이·구간·가리기에서도 첫 문장이 나온다(0세 포함) — 사건 문장은 나이와 무관하다 (QA-012 RECORD 2 정리)', () => {
    let checked = 0;
    for (const w of REAL_WINDOWS.filter((x) => x.kind === 'event' && x.id !== 'era-1987-polling-station-r3')) {
      const y = w.years[0];
      for (const age of [0, 1, 6, 7, 12, 13, 19, 20, 40, 85]) {
        for (const band of BANDS) {
          for (const gentle of [false, true]) {
            const p = eraOf(y, ctxOf(REAL_WINDOWS, { band, gentle, birthYear: y - age }));
            expect(p.line?.id, `${w.id} ${age}세 ${band}/${gentle}`).toBe(w.id);
            checked++;
          }
        }
      }
    }
    expect(checked).toBe(49 * 10 * 3 * 2);
  });

  it('★ 둘째 문장은 어느 나이에도 구간의 것이 나온다(0세 포함) — secondAges가 없으므로 나이로 빠지지 않는다', () => {
    for (const w of REAL_WINDOWS.filter((x) => x.second !== undefined)) {
      const y = w.years[0];
      for (const age of [0, 3, 8, 15, 30, 70]) for (const band of BANDS) expect(eraOf(y, ctxOf(REAL_WINDOWS, { band, birthYear: y - age })).second, `${w.id} ${age}세 ${band}`).toBe(w.second![band]);
    }
    // 0세 기록: 출생 해가 ★ 사건의 해면 0세 줄에 첫 문장 + 둘째 문장이 같이 있다
    const row = eraRowsOf(1997, 3, ctxOf(REAL_WINDOWS, { band: 'low' }))[0];
    expect(row).toMatchObject({ age: 0, year: 1997, line: '11월, 외환위기가 닥쳐 나라가 구제금융을 요청했습니다.', second: '집에서는 다니던 일터가 문을 닫았습니다.' });
  });
});

describe('secondAges의 동작 — 합성 데이터 (규칙이 일하는 증거)', () => {
  const second = { low: '집에서는 가 문장입니다.', mid: '집에서는 나 문장입니다.', high: '집에서는 다 문장입니다.' };
  const kid = (ages: [number, number]): EraWindow => ({ id: '교복', years: [1997, 1997], kind: 'event', topic: '시험', line: '교복 문장입니다.', heavy: false, approved: true, draw: '교복', caption: '교복 캡션', second, secondAges: ages });

  it('나이 밖(0~6세·어른)에서는 둘째 문장만 빠지고 첫 문장·그림·캡션은 그대로다 · 나이 안(7~19세)에서는 나온다 — 전 나이 0~99세', () => {
    const win = kid([7, 19]);
    for (let age = 0; age <= 99; age++) {
      const p = eraOf(1997, ctxOf([win], { band: 'low', birthYear: 1997 - age }));
      expect(p.pic?.id, `${age}세`).toBe('교복');
      expect(p.line?.line, `${age}세`).toBe('교복 문장입니다.');
      expect(p.caption, `${age}세`).toBe('교복 캡션');
      expect(p.second, `${age}세`).toBe(age >= 7 && age <= 19 ? second.low : null);
    }
  });

  it('인생 기록 줄(eraRowsOf)도 같다: 0세 줄은 첫 문장만, 10세 줄은 첫 문장 + 둘째 문장', () => {
    const win = kid([7, 19]);
    expect(eraRowsOf(1997, 0, ctxOf([win], { band: 'mid' }))).toEqual([{ year: 1997, age: 0, line: '교복 문장입니다.', heavy: false, veiled: false, forecast: false }]);
    expect(eraRowsOf(1987, 10, ctxOf([win], { band: 'mid' }))).toEqual([{ year: 1997, age: 10, line: '교복 문장입니다.', second: second.mid, heavy: false, veiled: false, forecast: false }]);
  });
});
