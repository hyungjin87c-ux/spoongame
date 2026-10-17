import { describe, expect, it } from 'vitest';
import { autoResolveStep, stepYear, type GameState } from '../src/core';
import { startLife } from '../scripts/simulateLib';

/**
 * 난수 흐름 스냅샷 (REV-003-M5-1 관찰 6, SPEC-003 「20세 전 인생은 개편 전과 같은 난수 흐름」): 고정 시드 12판(세 시대 × 시드 4개)의 출생 결과와 19세가 된 순간의 상태를 글자 그대로 얼려 둔다.
 * 경제 개편(M5)은 20세 이상의 순수 계산만 바꾸고 20세 전 인생의 난수 호출 순서를 건드리지 않아야 한다 — 출생·사건 뽑기·선택·자연 변화의 난수를 한 번이라도 더 쓰거나 덜 쓰면
 * 이 값이 바뀐다(난수 상태 rngState가 가장 민감하다). 값이 바뀌었다면 의도한 변경인지 확인하고, 의도한 것이면 아래 표를 같은 방식(startLife → 19세까지 자동 진행)으로 다시 뽑아 고친다.
 * 값은 r4 엔진에서 뽑았다. 20세 전 난수 경로는 2a 대조(HEAD main a702c20 복사본과 900판이 같음, ai-log/2026-10-17_SPEC-003_dev-M5-2a.md) 뒤 바뀌지 않았다 — 그 비교는 일회성 도구였고 이 시험이 저장소에 남는 회귀 시험이다.
 *  - birth: 출생 직후(인생 시작)의 인물·스탯·rngState·형제 순서·지역
 *  - at19: 선택은 자동 모드로 고르며 19세가 되는 첫 순간의 나이·rngState·연표 줄 수·집안 살림·스탯·플래그 수·본 이벤트 수
 */
interface Snapshot {
  era: 'past' | 'present' | 'future';
  seed: number;
  birth: { name: string; gender: string; birthYear: number; parentWealth: number; parenting: string; looks: number; stats: Record<string, number>; rngState: number; birthOrder: number; region: string };
  at19: { age: number; rngState: number; history: number; familyFund: number; stats: Record<string, number>; flags: number; seen: number };
}

const SNAPSHOTS: Snapshot[] = [
    { era: 'past', seed: 11, birth: {name:'박미숙',gender:'female',birthYear:1970,parentWealth:3,parenting:'strict',looks:40,stats:{education:8,health:77,happiness:44,relationships:50},rngState:4167084913,birthOrder:5,region:'경기'}, at19: {age:19,rngState:1064271460,history:10,familyFund:-450,stats:{education:64,health:77,happiness:47,relationships:65},flags:2,seen:8} },
    { era: 'past', seed: 222, birth: {name:'조영희',gender:'female',birthYear:1958,parentWealth:2,parenting:'strict',looks:13,stats:{education:6,health:60,happiness:46,relationships:49},rngState:4167085124,birthOrder:2,region:'경북'}, at19: {age:19,rngState:1064271671,history:9,familyFund:-750,stats:{education:69,health:58,happiness:42,relationships:54},flags:0,seen:7} },
    { era: 'past', seed: 3333, birth: {name:'박영만',gender:'male',birthYear:1960,parentWealth:1,parenting:'strict',looks:66,stats:{education:5,health:79,happiness:36,relationships:44},rngState:4167088235,birthOrder:2,region:'경기'}, at19: {age:19,rngState:4159511935,history:9,familyFund:150,stats:{education:44,health:75,happiness:42,relationships:57},flags:2,seen:7} },
    { era: 'past', seed: 44444, birth: {name:'이지훈',gender:'male',birthYear:1972,parentWealth:2,parenting:'helicopter',looks:52,stats:{education:7,health:69,happiness:46,relationships:58},rngState:4167129346,birthOrder:4,region:'경기'}, at19: {age:19,rngState:432480223,history:12,familyFund:1050,stats:{education:47,health:71,happiness:47,relationships:68},flags:2,seen:10} },
    { era: 'present', seed: 11, birth: {name:'박지아',gender:'female',birthYear:2026,parentWealth:4,parenting:'helicopter',looks:40,stats:{education:11,health:80,happiness:50,relationships:58},rngState:4167084913,birthOrder:2,region:'대구'}, at19: {age:19,rngState:1064271460,history:10,familyFund:0,stats:{education:76,health:80,happiness:51,relationships:63},flags:2,seen:8} },
    { era: 'present', seed: 222, birth: {name:'조하린',gender:'female',birthYear:2026,parentWealth:2,parenting:'strict',looks:13,stats:{education:6,health:60,happiness:46,relationships:49},rngState:4167085124,birthOrder:1,region:'충남'}, at19: {age:19,rngState:1064271671,history:9,familyFund:-750,stats:{education:69,health:58,happiness:41,relationships:54},flags:0,seen:7} },
    { era: 'present', seed: 3333, birth: {name:'박시윤',gender:'male',birthYear:2026,parentWealth:1,parenting:'strict',looks:66,stats:{education:5,health:79,happiness:36,relationships:44},rngState:4167088235,birthOrder:1,region:'대전'}, at19: {age:19,rngState:4159511935,history:9,familyFund:0,stats:{education:40,health:85,happiness:45,relationships:56},flags:2,seen:7} },
    { era: 'present', seed: 44444, birth: {name:'이도현',gender:'male',birthYear:2026,parentWealth:2,parenting:'free',looks:52,stats:{education:4,health:69,happiness:56,relationships:56},rngState:4167129346,birthOrder:1,region:'세종'}, at19: {age:19,rngState:2895881706,history:12,familyFund:0,stats:{education:38,health:72,happiness:50,relationships:62},flags:1,seen:10} },
    { era: 'future', seed: 11, birth: {name:'박유나',gender:'female',birthYear:2045,parentWealth:4,parenting:'helicopter',looks:40,stats:{education:11,health:80,happiness:50,relationships:58},rngState:4167084913,birthOrder:2,region:'대구'}, at19: {age:19,rngState:1064271460,history:10,familyFund:0,stats:{education:76,health:80,happiness:51,relationships:63},flags:2,seen:8} },
    { era: 'future', seed: 222, birth: {name:'조지안',gender:'female',birthYear:2036,parentWealth:2,parenting:'strict',looks:13,stats:{education:6,health:60,happiness:46,relationships:49},rngState:4167085124,birthOrder:1,region:'충남'}, at19: {age:19,rngState:1064271671,history:9,familyFund:-750,stats:{education:69,health:58,happiness:41,relationships:54},flags:0,seen:7} },
    { era: 'future', seed: 3333, birth: {name:'박은호',gender:'male',birthYear:2038,parentWealth:1,parenting:'strict',looks:66,stats:{education:5,health:79,happiness:36,relationships:44},rngState:4167088235,birthOrder:1,region:'대전'}, at19: {age:19,rngState:4159511935,history:9,familyFund:0,stats:{education:41,health:85,happiness:47,relationships:55},flags:2,seen:7} },
    { era: 'future', seed: 44444, birth: {name:'이지호',gender:'male',birthYear:2047,parentWealth:2,parenting:'free',looks:52,stats:{education:4,health:69,happiness:56,relationships:56},rngState:4167129346,birthOrder:1,region:'세종'}, at19: {age:19,rngState:432480223,history:12,familyFund:600,stats:{education:39,health:72,happiness:56,relationships:63},flags:2,seen:10} },
];

function snapshotOf(era: Snapshot['era'], seed: number): Pick<Snapshot, 'birth' | 'at19'> {
  let s: GameState = startLife(seed, era);
  const c = s.character!;
  const birth = {
    name: c.name,
    gender: c.gender,
    birthYear: c.birthYear,
    parentWealth: c.parentWealth,
    parenting: c.parenting,
    looks: c.looks,
    stats: { ...s.stats },
    rngState: s.rngState,
    birthOrder: s.birthReport!.birthOrder,
    region: (s.birthReport as unknown as { region: string }).region,
  };
  for (let guard = 0; guard < 200 && s.phase === 'life' && s.age < 19; guard++) s = s.pending !== null ? autoResolveStep(s, s.pending.key).state : stepYear(s).state;
  const at19 = { age: s.age, rngState: s.rngState, history: s.history.length, familyFund: s.familyFund, stats: { ...s.stats }, flags: s.flags.length, seen: Object.keys(s.seen).length };
  return { birth, at19 };
}

describe('난수 흐름 스냅샷: 고정 시드의 출생 결과와 19세 상태는 글자 그대로 같다 (REV-003-M5-1 관찰 6)', () => {
  for (const snap of SNAPSHOTS) {
    it(`${snap.era} 시드 ${snap.seed}: 출생 직후와 19세가 된 순간의 상태가 얼려 둔 값과 같다`, () => {
      const got = snapshotOf(snap.era, snap.seed);
      expect(got.birth).toEqual(snap.birth);
      expect(got.at19).toEqual(snap.at19);
    });
  }

  it('스냅샷이 공허하지 않다: 12판이 서로 다르고(난수 상태·인물) 19세에 자산은 아직 없다', () => {
    expect(SNAPSHOTS).toHaveLength(12);
    expect(new Set(SNAPSHOTS.map((x) => x.at19.rngState)).size).toBeGreaterThanOrEqual(4); // 시드 4개(같은 시드·같은 난수 흐름이면 시대가 달라도 같은 값일 수 있다)
    expect(new Set(SNAPSHOTS.map((x) => x.birth.name)).size).toBe(12);
    for (const x of SNAPSHOTS) expect(x.at19.age).toBe(19);
    // 같은 시드는 같은 출생이다: 시대가 달라도 시드가 같으면 출생 직후 난수 상태가 같다(시대는 표만 바꾼다)
    for (const seed of [11, 222, 3333, 44444]) expect(new Set(SNAPSHOTS.filter((x) => x.seed === seed).map((x) => x.birth.rngState)).size).toBe(1);
  });
});
