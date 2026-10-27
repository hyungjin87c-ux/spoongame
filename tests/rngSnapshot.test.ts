import { describe, expect, it } from 'vitest';
import { R1_PRESENT, autoResolveStep, stepYear, type GameState, type ProfileId } from '../src/core';
import { poolOf, startLife } from '../scripts/simulateLib';

/**
 * 난수 흐름 스냅샷 (REV-003-M5-1 관찰 6, SPEC-003 「20세 전 인생은 개편 전과 같은 난수 흐름」): 고정 시드 12판(세 시대 × 시드 4개)의 출생 결과와 19세가 된 순간의 상태를 글자 그대로 얼려 둔다.
 * 경제 개편(M5)은 20세 이상의 순수 계산만 바꾸고 20세 전 인생의 난수 호출 순서를 건드리지 않아야 한다 — 출생·사건 뽑기·선택·자연 변화의 난수를 한 번이라도 더 쓰거나 덜 쓰면
 * 이 값이 바뀐다(난수 상태 rngState가 가장 민감하다). 값이 바뀌었다면 의도한 변경인지 확인하고, 의도한 것이면 아래 표를 같은 방식(startLife → 19세까지 자동 진행)으로 다시 뽑아 고친다.
 * **M7a 갱신(2026-10-18, 마스터 결정 M-1: 마일스톤 슬롯으로 난수 흐름이 바뀌는 것은 수용 — 사유와 함께 갱신)**: `at19`를 새로 뽑았다. 사유 셋 — ① 마일스톤 슬롯이 0~3세에 난수를 더 쓴다(확률 1보다 작은 마일스톤 후보를 따질 때마다 한 번) ② 영유아 빈도표가 0.3/0.3 → 0.55/0.75로 바뀌고 7세도 그 표를 쓴다 ③ 영유아 이벤트 28개가 풀에 더해져 가중 추첨이 달라진다. `birth`(출생 직후의 인물·스탯·rngState·형제 순서·지역)는 그대로다 — 출생 난수 경로는 바뀌지 않았다(이 시험이 그것을 계속 지킨다).
 * **M7a r2 갱신(2026-10-18)**: `at19`를 다시 뽑았다. 사유 둘 — ① 신규 서술 이벤트·마일스톤·일부 선택지의 양수 스탯 효과를 줄였다(20세 평균 스탯이 HEAD 대비 +2 이하가 되도록 — 경제 재보정 원인 제거, 마스터 결정 r2-1) ② `infant-new-sibling`의 가중치를 올려(동생 맞이가 첫째 판에서 통계대로 자주 일어나게, r2-2) 같은 시드의 이벤트 뽑기·상속 몫이 달라진다. `birth`(출생 직후의 인물·스탯·rngState·형제 순서·지역)는 그대로다.
 * **M7a r3 갱신(2026-10-18)**: `at19`를 다시 뽑았다. 사유 — 마일스톤을 한 해에 여러 개 일으키는 슬롯(걸음마·첫 말이 모두 1세)·영유아 서술 빈도 0.75 → 0.78·`conditions.housing`(이삿짐)·`childcare_set`(맡김 장면 닫힘)·동생 맞이 선택지 4개·영유아 기존 9개·마일스톤의 효과·문구 변경으로 같은 시드의 이벤트 뽑기·스탯이 달라진다. `birth`는 그대로다.
 * **M7e-4 추가(2026-10-18, R-383)**: 지난 세상 첫째·재력 3 시드 247을 더해 13판이 되었다 — E-9의 `school-family-priority` `birthOrder ≥ 2` 조건(지난 세상 12~17세 후보 풀)이 바뀐 것을 스냅샷이 보게 한다. 기존 12판의 값은 바뀌지 않았다(그 시드 4개는 모두 둘째 이상). M7e-3 로그의 「스냅샷 변경 없음 — E-4는 20~28세」는 E-4만의 설명이었다.
 * 값은 r4 엔진에서 뽑았다(`birth`는 지금도 같다). 20세 전 난수 경로는 2a 대조(HEAD main a702c20 복사본과 900판이 같음, ai-log/2026-10-17_SPEC-003_dev-M5-2a.md) 뒤 바뀌지 않았다 — 그 비교는 일회성 도구였고 이 시험이 저장소에 남는 회귀 시험이다.
 * **SPEC-005 QI5 갱신(2026-10-20, EK5 · PD13 가중을 ×1.5에서 ×2.0으로 올린 뒤 다시 뽑음 — 마스터 결정 9절 3번)**: 19세 상태의 `rngState`는 13판 **모두 그대로**다 — 부모·흘러감 해도 본인 선택과 같은 난수 하나(`next()` 한 번)를 같은 자리에서 쓰기 때문이다(`core/life.ts#resolveDelegated`, 같은 시드 → 같은 인생·난수 호출 수). 값이 달라진 것은 *고른 선택지*가 달라진 판뿐이다
 * (부모 확률 모델 `PARENT_PRIORITY` 가중치가 자동 모드 가중치와 달라 같은 난수로 다른 칸이 뽑힌 경우, 그리고 ×2.0으로 13~18세 본인 영역 카드의 추첨 가중이 바뀌어 다른 카드가 뽑힌 경우): 지난 세상 시드 11(집안 살림 300→−300·지식 57→58·행복 52→51·플래그 2→1),
 * 미래 시드 11(지식 80→77·관계 63→65·플래그 3→2), 지난 세상 시드 222(집안 살림 −300→−450·지식 63→62·행복 52→53·플래그 1→2), 지난 세상 시드 3333(지식 41→38·건강 80→83·관계 54→57·플래그 1→2), 미래 시드 222(행복 57→56). 나머지 8판의 스탯·집안 살림·플래그는 그대로다. 이 두 줄은 `autoResolveStep`(본인 카드) + `stepYear`(부모·흘러감 해 자동 해결)로 다시 뽑았다.
 *  - birth: 출생 직후(인생 시작)의 인물·스탯·rngState·형제 순서·지역
 *  - at19: 선택은 자동 모드로 고르며 19세가 되는 첫 순간의 나이·rngState·연표 줄 수·집안 살림·스탯·플래그 수·본 이벤트 수
 * **SPEC-004 GM4 갱신(2026-10-27, 세대 모델)**: 세 시대(past·present·future)가 일곱 세대로 바뀌어 표를 **프로필 17판**으로 다시 짰다 — 시험 전용 R1 프로필(2026년생) 4판 + 산업화 5판(옛 지난 세상 5판과 같은 시드) + X세대 4판 + 알파 4판.
 *  - **R1 4판은 옛 「지금 세상」 4판과 출생·19세 상태가 글자 그대로 같다**(이름·스탯·rngState·형제 순서·지역, 19세의 rngState·연표 줄 수·집안 살림·스탯·플래그 수·본 이벤트 수 모두) — R1 프로필은 R1 때 이벤트 풀(`tests/fixtures/r1-event-pool`, `poolOf(R1)`)로 돌려 항등을 잠근다(EY17).
 *  - 세대 판 13판은 GM4에서 처음 얼린 값이다: 출생 연도를 룰렛 몰래 뽑는 한 번의 난수(GS6)가 더해졌어도 출생 직후 `rngState`는 R1·세대 모두 같다(연도·성별·성씨·이름·재력·교육방식·외모·스탯의 소비 횟수가 R1과 같다 — 연도 뽑기가 R1의 `rng.int` 대신 `weightedIndex` 한 번).
 *    이 표본은 이벤트 풀(`yearRange` 33개 · `track`)과 연도 축 인구 표가 바뀌면 함께 바뀐다 — 의도한 변경이면 같은 방식(`startLife` → 19세까지 자동 진행, 풀은 `poolOf(프로필)`)으로 다시 뽑아 이 표를 갱신하고 사유를 여기에 적는다.
 */
interface Snapshot {
  profile: ProfileId;
  seed: number;
  birth: { name: string; gender: string; birthYear: number; parentWealth: number; parenting: string; looks: number; stats: Record<string, number>; rngState: number; birthOrder: number; region: string };
  at19: { age: number; rngState: number; history: number; familyFund: number; stats: Record<string, number>; flags: number; seen: number };
}

const SNAPSHOTS: Snapshot[] = [
    { profile: 'r1-present', seed: 11, birth: {name:'박지아',gender:'female',birthYear:2026,parentWealth:4,parenting:'helicopter',looks:40,stats:{education:11,health:80,happiness:50,relationships:58},rngState:4167084913,birthOrder:2,region:'대구'}, at19: {age:19,rngState:1632165933,history:17,familyFund:-1650,stats:{education:78,health:83,happiness:51,relationships:67},flags:0,seen:15} },
    { profile: 'r1-present', seed: 222, birth: {name:'조하린',gender:'female',birthYear:2026,parentWealth:2,parenting:'strict',looks:13,stats:{education:6,health:60,happiness:46,relationships:49},rngState:4167085124,birthOrder:1,region:'충남'}, at19: {age:19,rngState:4095567627,history:18,familyFund:-750,stats:{education:70,health:59,happiness:47,relationships:59},flags:4,seen:16} },
    { profile: 'r1-present', seed: 3333, birth: {name:'박시윤',gender:'male',birthYear:2026,parentWealth:1,parenting:'strict',looks:66,stats:{education:5,health:79,happiness:36,relationships:44},rngState:4167088235,birthOrder:1,region:'대전'}, at19: {age:19,rngState:2831899398,history:19,familyFund:1350,stats:{education:44,health:79,happiness:39,relationships:55},flags:5,seen:17} },
    { profile: 'r1-present', seed: 44444, birth: {name:'이도현',gender:'male',birthYear:2026,parentWealth:2,parenting:'free',looks:52,stats:{education:4,health:69,happiness:56,relationships:56},rngState:4167129346,birthOrder:1,region:'세종'}, at19: {age:19,rngState:1632210366,history:18,familyFund:300,stats:{education:41,health:72,happiness:63,relationships:68},flags:4,seen:16} },
    { profile: 'industrial', seed: 11, birth: {name:'박옥순',gender:'female',birthYear:1947,parentWealth:3,parenting:'strict',looks:40,stats:{education:8,health:77,happiness:44,relationships:50},rngState:4167084913,birthOrder:2,region:'강원'}, at19: {age:19,rngState:368494593,history:21,familyFund:-300,stats:{education:58,health:82,happiness:52,relationships:71},flags:1,seen:19} },
    { profile: 'industrial', seed: 222, birth: {name:'조정자',gender:'female',birthYear:1943,parentWealth:2,parenting:'strict',looks:13,stats:{education:6,health:60,happiness:46,relationships:49},rngState:4167085124,birthOrder:3,region:'경북'}, at19: {age:19,rngState:4095567627,history:17,familyFund:-450,stats:{education:62,health:62,happiness:53,relationships:64},flags:2,seen:15} },
    { profile: 'industrial', seed: 3333, birth: {name:'박학수',gender:'male',birthYear:1943,parentWealth:1,parenting:'strict',looks:66,stats:{education:5,health:79,happiness:36,relationships:44},rngState:4167088235,birthOrder:2,region:'충남'}, at19: {age:19,rngState:2831899398,history:19,familyFund:600,stats:{education:38,health:84,happiness:44,relationships:58},flags:2,seen:17} },
    { profile: 'industrial', seed: 44444, birth: {name:'이정수',gender:'male',birthYear:1948,parentWealth:2,parenting:'helicopter',looks:52,stats:{education:7,health:69,happiness:46,relationships:58},rngState:4167129346,birthOrder:2,region:'전북'}, at19: {age:19,rngState:1632210366,history:18,familyFund:300,stats:{education:63,health:74,happiness:60,relationships:69},flags:5,seen:16} },
    { profile: 'industrial', seed: 247, birth: {name:'박경자',gender:'female',birthYear:1940,parentWealth:3,parenting:'helicopter',looks:43,stats:{education:7,health:61,happiness:46,relationships:56},rngState:4167085149,birthOrder:3,region:'전남'}, at19: {age:19,rngState:2264001839,history:16,familyFund:0,stats:{education:47,health:66,happiness:49,relationships:68},flags:4,seen:14} },
    { profile: 'genx', seed: 11, birth: {name:'박미숙',gender:'female',birthYear:1975,parentWealth:3,parenting:'helicopter',looks:40,stats:{education:9,health:77,happiness:47,relationships:58},rngState:4167084913,birthOrder:2,region:'부산'}, at19: {age:19,rngState:368494593,history:21,familyFund:-300,stats:{education:58,health:82,happiness:54,relationships:75},flags:1,seen:19} },
    { profile: 'genx', seed: 222, birth: {name:'조미영',gender:'female',birthYear:1972,parentWealth:2,parenting:'strict',looks:13,stats:{education:6,health:60,happiness:46,relationships:49},rngState:4167085124,birthOrder:3,region:'경북'}, at19: {age:19,rngState:4095567627,history:17,familyFund:-450,stats:{education:62,health:62,happiness:53,relationships:64},flags:2,seen:15} },
    { profile: 'genx', seed: 3333, birth: {name:'박상철',gender:'male',birthYear:1972,parentWealth:1,parenting:'strict',looks:66,stats:{education:5,health:79,happiness:36,relationships:44},rngState:4167088235,birthOrder:2,region:'충북'}, at19: {age:19,rngState:2831899398,history:19,familyFund:600,stats:{education:38,health:84,happiness:43,relationships:58},flags:2,seen:17} },
    { profile: 'genx', seed: 44444, birth: {name:'이지훈',gender:'male',birthYear:1975,parentWealth:2,parenting:'free',looks:52,stats:{education:4,health:69,happiness:56,relationships:56},rngState:4167129346,birthOrder:2,region:'충북'}, at19: {age:19,rngState:1632210366,history:18,familyFund:300,stats:{education:47,health:75,happiness:66,relationships:70},flags:5,seen:16} },
    { profile: 'alpha', seed: 11, birth: {name:'박다은',gender:'female',birthYear:2016,parentWealth:4,parenting:'helicopter',looks:40,stats:{education:11,health:80,happiness:50,relationships:58},rngState:4167084913,birthOrder:1,region:'대구'}, at19: {age:19,rngState:1632165933,history:17,familyFund:-1650,stats:{education:78,health:82,happiness:49,relationships:65},flags:0,seen:15} },
    { profile: 'alpha', seed: 222, birth: {name:'조하윤',gender:'female',birthYear:2014,parentWealth:2,parenting:'strict',looks:13,stats:{education:6,health:60,happiness:46,relationships:49},rngState:4167085124,birthOrder:2,region:'전남'}, at19: {age:19,rngState:4095567627,history:17,familyFund:0,stats:{education:70,health:61,happiness:56,relationships:61},flags:4,seen:15} },
    { profile: 'alpha', seed: 3333, birth: {name:'박우진',gender:'male',birthYear:2014,parentWealth:1,parenting:'strict',looks:66,stats:{education:5,health:79,happiness:36,relationships:44},rngState:4167088235,birthOrder:1,region:'대전'}, at19: {age:19,rngState:2831899398,history:19,familyFund:1050,stats:{education:43,health:79,happiness:43,relationships:59},flags:6,seen:17} },
    { profile: 'alpha', seed: 44444, birth: {name:'이예준',gender:'male',birthYear:2016,parentWealth:2,parenting:'free',looks:52,stats:{education:4,health:69,happiness:56,relationships:56},rngState:4167129346,birthOrder:1,region:'경기'}, at19: {age:19,rngState:1632210366,history:18,familyFund:300,stats:{education:41,health:73,happiness:64,relationships:67},flags:4,seen:16} },
];

function snapshotOf(profile: ProfileId, seed: number): Pick<Snapshot, 'birth' | 'at19'> {
  const pool = poolOf(profile); // R1은 R1 때 이벤트 풀, 세대는 현재 풀
  let s: GameState = startLife(seed, profile);
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
  for (let guard = 0; guard < 200 && s.phase === 'life' && s.age < 19; guard++) s = s.pending !== null ? autoResolveStep(s, s.pending.key, pool).state : stepYear(s, pool).state;
  const at19 = { age: s.age, rngState: s.rngState, history: s.history.length, familyFund: s.familyFund, stats: { ...s.stats }, flags: s.flags.length, seen: Object.keys(s.seen).length };
  return { birth, at19 };
}

describe('난수 흐름 스냅샷: 고정 시드의 출생 결과와 19세 상태는 글자 그대로 같다 (REV-003-M5-1 관찰 6)', () => {
  for (const snap of SNAPSHOTS) {
    it(`${snap.profile} 시드 ${snap.seed}: 출생 직후와 19세가 된 순간의 상태가 얼려 둔 값과 같다`, () => {
      const got = snapshotOf(snap.profile, snap.seed);
      expect(got.birth).toEqual(snap.birth);
      expect(got.at19).toEqual(snap.at19);
    });
  }

  it('스냅샷이 공허하지 않다: 17판이 서로 다르고(난수 상태·인물) 19세에 자산은 아직 없다', () => {
    expect(SNAPSHOTS).toHaveLength(17);
    expect(new Set(SNAPSHOTS.map((x) => x.at19.rngState)).size).toBeGreaterThanOrEqual(4); // 시드 4개(같은 시드·같은 난수 흐름이면 프로필이 달라도 같은 값일 수 있다)
    expect(new Set(SNAPSHOTS.map((x) => x.birth.name)).size).toBe(17);
    for (const x of SNAPSHOTS) expect(x.at19.age).toBe(19);
    // 같은 시드는 같은 출생이다: 프로필이 달라도 시드가 같으면 출생 직후 난수 상태가 같다(프로필은 표만 바꾼다)
    for (const seed of [11, 222, 3333, 44444]) expect(new Set(SNAPSHOTS.filter((x) => x.seed === seed).map((x) => x.birth.rngState)).size).toBe(1);
    // 시험 전용 R1은 옛 「지금 세상」과 같은 값이다(항등): 출생 연도는 2026 한 해
    expect(SNAPSHOTS.filter((x) => x.profile === R1_PRESENT).map((x) => x.birth.birthYear)).toEqual([2026, 2026, 2026, 2026]);
  });
});
