import { describe, expect, it } from 'vitest';
import { PARENT_WEALTHS, PEER_COUNT, PEER_STATUSES, PEER_STATUS_AGES, PEER_STATUS_LABEL, PEER_STATUS_TABLE, peerBandOf, peerStatusAt, peerStatusOf, peerStatusSeries, peersNow, peersOf, stepYear, type PeerStatus } from '../src/core';
import { DASH_TEXT } from '../src/data/dashText';
import { startLife } from '../scripts/simulateLib';

/**
 * 같은 해 태어난 사람들의 요즘 모습 (SPEC-003 VP4): 나이 × 수저 단계 규칙표(설계값)에서 결정적으로 뽑고, 나이와 모순되는 라벨(5세의 「일하는 사람」)이 0개다.
 * 허용 나이(`PEER_STATUS_AGES`)는 표와 따로 정의된 독립 기준이고, 이 시험이 표의 모든 구간·모든 수저·인생 운 전수에서 대조한다.
 * R-328(REV-003-M4-1): 평생 고정 인생 운 하나가 하위 꼬리를 평생으로 만들던 결함을, 나이대(4년 블록)마다 이전 값과 상관 있게 다시 뽑아 고쳤다 — 맨 아래 「대량 표본」이 마스터 기준
 * (흙수저 또래 19~64세 평생 미취업 ≤ 5%, 「구직 중」 최장 연속 ≤ 4년)을 잰다.
 */
const inAges = (s: PeerStatus, age: number) => age >= PEER_STATUS_AGES[s].min && age <= PEER_STATUS_AGES[s].max;

describe('규칙표 구조', () => {
  it('표는 0~120세를 빈틈·겹침 없이 덮고, 구간마다 수저 5단계 × 가중치 합이 정확히 100이다', () => {
    let next = 0;
    for (const band of PEER_STATUS_TABLE) {
      expect(band.from, '빈틈·겹침 없음').toBe(next);
      expect(band.to).toBeGreaterThanOrEqual(band.from);
      next = band.to + 1;
      expect(band.byWealth).toHaveLength(5);
      band.byWealth.forEach((w, i) => {
        const sum = PEER_STATUSES.reduce((a, s) => a + (w[s] ?? 0), 0);
        expect(sum, `${band.from}~${band.to}세 수저 ${i + 1}단계`).toBe(100);
        for (const s of PEER_STATUSES) expect(w[s] ?? 0, `${s}`).toBeGreaterThanOrEqual(0);
      });
    }
    expect(next - 1, '표의 끝 나이').toBe(120);
  });

  it('가중치가 0이 아닌 라벨은 모두 그 나이에 있을 수 있다 — 표 안의 모순 0 (구간의 모든 나이 × 수저 5단계)', () => {
    for (const band of PEER_STATUS_TABLE) {
      band.byWealth.forEach((w, i) => {
        for (const s of PEER_STATUSES) {
          if ((w[s] ?? 0) === 0) continue;
          for (let age = band.from; age <= band.to; age++) expect(inAges(s, age), `${age}세 수저 ${i + 1}단계 「${PEER_STATUS_LABEL[s]}」`).toBe(true);
        }
      });
    }
  });

  it('독립 기준이 실제로 잡는다(공허 통과 방지): 5세에 「일하는 사람」·70세에 「학교에 다님」은 허용되지 않는다', () => {
    expect(inAges('working', 5)).toBe(false);
    expect(inAges('school', 70)).toBe(false);
    expect(inAges('child', 7)).toBe(false);
    expect(inAges('retired', 30)).toBe(false);
    expect(inAges('caring', 95)).toBe(false);
    expect(inAges('seeking', 70)).toBe(false);
  });

  it('라벨 글자는 copy.md의 여섯 개이고 담담한 글이다', () => {
    expect(Object.values(PEER_STATUS_LABEL).sort()).toEqual(['구직 중', '어린 시절', '은퇴', '일하는 사람', '학교에 다님', '돌봄'].sort());
    for (const label of Object.values(PEER_STATUS_LABEL)) expect(label).not.toMatch(/[!！]|\p{Extended_Pictographic}/u);
  });
});

describe('peerStatusOf(나이, 수저, 인생 운): 모순 없이 결정적으로', () => {
  it('모든 나이 0~120 × 수저 1~5 × 인생 운 0~1(1001칸)에서 그 나이에 있을 수 없는 라벨이 나오지 않는다', () => {
    let checked = 0;
    for (let age = 0; age <= 120; age++) {
      for (const w of PARENT_WEALTHS) {
        for (let k = 0; k <= 1000; k += 7) {
          const s = peerStatusOf(age, w, k / 1000);
          expect(inAges(s, age), `${age}세 수저 ${w} u=${k / 1000} → ${PEER_STATUS_LABEL[s]}`).toBe(true);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(50_000);
  });

  it('어린 나이는 단일 라벨이다: 0~6세 「어린 시절」, 7~18세 「학교에 다님」 (수저와 운에 상관없이)', () => {
    for (const w of PARENT_WEALTHS) {
      for (const u of [0, 0.3, 0.7, 0.999]) {
        for (let age = 0; age <= 6; age++) expect(peerStatusOf(age, w, u)).toBe('child');
        for (let age = 7; age <= 18; age++) expect(peerStatusOf(age, w, u)).toBe('school');
      }
    }
  });

  it('인생 운이 같으면 나이가 들어도 구간 안에서는 라벨이 바뀌지 않는다 — 해마다 뒤죽박죽 바뀌지 않는다 (구간 경계에서만)', () => {
    for (const w of PARENT_WEALTHS) {
      for (const u of [0.05, 0.4, 0.8]) {
        let flips = 0;
        let prev = peerStatusOf(0, w, u);
        for (let age = 1; age <= 100; age++) {
          const s = peerStatusOf(age, w, u);
          if (s !== prev) {
            expect(peerBandOf(age).from === age || peerBandOf(age - 1) !== peerBandOf(age), `${age}세에서 구간 경계가 아닌데 바뀜`).toBe(true);
            flips++;
          }
          prev = s;
        }
        expect(flips, `수저 ${w} u=${u}`).toBeLessThanOrEqual(PEER_STATUS_TABLE.length);
      }
    }
  });

  it('수저가 높을수록 20대 초반에 학교에 다닐 확률이 높고(대학 이후가 길다), 구직 중의 몫이 작다 (G3: 같은 나이라도 수저에 따라 요즘 모습이 다르다)', () => {
    const share = (age: number, w: 1 | 2 | 3 | 4 | 5, s: PeerStatus) => {
      let n = 0;
      for (let k = 0; k < 1000; k++) if (peerStatusOf(age, w, k / 1000) === s) n++;
      return n / 10;
    };
    const school = PARENT_WEALTHS.map((w) => share(21, w, 'school'));
    const seeking = PARENT_WEALTHS.map((w) => share(21, w, 'seeking'));
    for (let i = 1; i < 5; i++) {
      expect(school[i], '학교').toBeGreaterThan(school[i - 1]);
      expect(seeking[i], '구직').toBeLessThan(seeking[i - 1]);
    }
    // 고령에서는 수저가 낮을수록 일을 계속하는 몫이 크다
    const working70 = PARENT_WEALTHS.map((w) => share(70, w, 'working'));
    for (let i = 1; i < 5; i++) expect(working70[i]).toBeLessThan(working70[i - 1]);
  });

  it('결정적이다: 같은 입력은 같은 라벨이고 범위 밖 입력(NaN·음수·1 초과)도 안전하다', () => {
    expect(peerStatusOf(33, 2, 0.5)).toBe(peerStatusOf(33, 2, 0.5));
    expect(peerStatusOf(33, 2, Number.NaN)).toBe(peerStatusOf(33, 2, 0));
    expect(peerStatusOf(33, 2, -1)).toBe(peerStatusOf(33, 2, 0));
    expect(peerStatusOf(33, 2, 7)).toBe(peerStatusOf(33, 2, 0.999999999));
    expect(peerStatusOf(-5, 3, 0.5)).toBe('child');
    expect(peerStatusOf(500, 3, 0.5)).toBe(peerStatusOf(120, 3, 0.5));
  });
});

describe('peersNow: 대시보드 또래 칸', () => {
  const game = startLife(31, 'alpha');

  it('출생신고와 같은 또래 4명이다(이름·성별·장소·수저) — 라벨만 더해진다', () => {
    const now = peersNow(game);
    const born = peersOf(game.peerSeed!, game.character!.birthYear, game.birthReport!.month, game.character!.name);
    expect(now).toHaveLength(PEER_COUNT);
    now.forEach((p, i) => {
      expect(p).toMatchObject(born[i]);
      expect(p.label).toBe(PEER_STATUS_LABEL[p.status]);
    });
  });

  it('새로고침(같은 상태 다시 계산)해도 같고, 또래의 줄기는 시드·순번·수저에서만 정해진다 — 순번이 다르면 줄기도 다르다', () => {
    expect(peersNow(game)).toEqual(peersNow(game));
    const same = peerStatusSeries(game.peerSeed!, 0, 3, 100);
    expect(peerStatusSeries(game.peerSeed!, 0, 3, 100)).toEqual(same);
    expect(same).toHaveLength(101);
    // 순번마다 다른 줄기: 시드를 바꿔 가며 보면 두 순번이 늘 같은 줄기일 수는 없다
    let differ = 0;
    for (let seed = 1; seed <= 40; seed++) if (peerStatusSeries(seed, 0, 3, 100).join() !== peerStatusSeries(seed, 1, 3, 100).join()) differ++;
    expect(differ, '40개 시드 중 두 순번의 줄기가 다른 시드').toBeGreaterThan(30);
  });

  it('줄기의 앞부분은 뒤 나이에 영향받지 않는다 — 어느 나이에서 멈춰도 같고, peerStatusAt은 줄기의 그 나이 칸이다 (나이를 아무 순서로 물어도 같다)', () => {
    for (const w of PARENT_WEALTHS) {
      for (let seed = 1; seed <= 20; seed++) {
        const full = peerStatusSeries(seed * 31, 2, w, 120);
        expect(full).toHaveLength(121);
        for (const age of [0, 6, 7, 19, 33, 64, 90, 120]) {
          expect(peerStatusSeries(seed * 31, 2, w, age), `수저 ${w} 시드 ${seed} ${age}세까지`).toEqual(full.slice(0, age + 1));
          expect(peerStatusAt(seed * 31, 2, w, age)).toBe(full[age]);
        }
      }
    }
    // 범위 밖 나이는 끝으로 맞춘다
    expect(peerStatusSeries(5, 0, 2, 500)).toHaveLength(121);
    expect(peerStatusSeries(5, 0, 2, -3)).toEqual(['child']);
    expect(peerStatusSeries(5, 0, 2, Number.NaN)).toEqual(['child']);
  });

  it('실제 판 전수(세 시대 × 30판 × 한 해씩): 어떤 나이에도 모순되는 라벨이 0개이고 라벨은 해마다 크게 흔들리지 않는다', () => {
    let points = 0;
    for (const era of ['industrial', 'alpha', 'alpha'] as const) {
      for (let seed = 1; seed <= 30; seed++) {
        let g = startLife(seed, era);
        const last: Array<PeerStatus | null> = [null, null, null, null];
        const flips = [0, 0, 0, 0];
        for (let i = 0; i < 130 && g.phase === 'life'; i++) {
          if (g.age % 3 === 0) {
            peersNow(g).forEach((p, k) => {
              expect(inAges(p.status, g.age), `${era} ${seed} ${g.age}세 ${p.name}: ${p.label}`).toBe(true);
              if (last[k] !== null && last[k] !== p.status) flips[k]++;
              last[k] = p.status;
              points++;
            });
          }
          g = g.pending ? { ...g, pending: null } : stepYear(g).state;
        }
        for (const f of flips) expect(f, `${era} ${seed}: 평생 라벨이 바뀐 횟수(3살마다 잰 표본 — 4년 블록이라 해마다 뒤죽박죽 바뀌지 않는다)`).toBeLessThanOrEqual(20);
      }
    }
    expect(points, '공허 통과 방지').toBeGreaterThan(3000);
  });

  it('출생 전 상태에서는 만들 수 없다', () => {
    expect(() => peersNow({ ...game, peerSeed: null })).toThrow();
    expect(() => peersNow({ ...game, character: null })).toThrow();
  });

  it('카드 문구: 제목은 출생신고의 또래 제목과 같은 글자이고 끝 안내는 「설계값, 통계가 아님」을 밝힌다', () => {
    expect(DASH_TEXT.peersTitle).toBe('같은 해 태어난 사람들');
    expect(DASH_TEXT.peersNote).toMatch(/설계값/);
    expect(DASH_TEXT.peersNote).toMatch(/통계가 아님/);
  });
});
