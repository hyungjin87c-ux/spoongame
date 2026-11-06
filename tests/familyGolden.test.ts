import { describe, expect, it } from 'vitest';
import golden from './fixtures/family-golden.json';
import {
  ADULT_SCENARIOS,
  L0F_ADULT_SEEDS,
  L0F_AGES,
  L0F_FEATURE_SEEDS,
  L0F_REQUIRED_TAGS,
  L0F_SPREAD_SEEDS,
  L0F_UPDATE_RULE,
  WIRING_READS,
  l0fAdultSample,
  l0fGolden,
  l0fSample,
  serializeL0f,
  type L0fGolden,
} from './helpers/familyL0f';
import { carriageReturnLines } from './helpers/lineEndings';
import { findLocalPathLeaks } from './helpers/localPathLeaks';
import { readRepoText } from './helpers/repoFiles';
import { GENERATION_IDS, eventPool } from '../src/core';

/**
 * L0F 가족 골든 (SPEC-009 K6 직전 · TODO 「L0F 가족 골든」 · FS2 예외 ① · REV-009-FM4a-2·FM4b-2·FM6-1이 바란 것).
 *
 * 왜: 가족 값 대부분은 **저장하지 않는다** — 출생 때 해시와 표에서 다시 계산한다(부모 별세·이혼 계획, 형제 별세(Q3), 자녀 독립 나이, 성인기 식구 — 배우자·자녀·친구의 이름·출생 연도·`at`).
 * 공개 배포 뒤에 표·해시 키·이름 풀·`design.*`·사건 풀의 `setFlags`를 무심코 고치면 이어하던 판의 가족이 소급해서 바뀐다(One-way). 이 골든은 그런 변경을 **시험에서 알아채게** 한다.
 * 알아채는 것만 한다 — 이미 저장된 판을 지켜 주지는 못한다(그건 「로드 때 `family.ad` 스냅샷」의 몫, 아래 갱신 규칙).
 *
 * 골든(`tests/fixtures/family-golden.json`)이 얼리는 것 — 실제 이름 풀·실제 사건 풀·고정 시드·고정 나이·고정 플래그/`seen`이고, 시간·환경·난수 상태에 기대지 않는다:
 *  - `births`(7세대 × 퍼진 시드 3 + 가지 시드 9 = 30판): ① 출생 때 `family` 저장값 전체(부모 별세 나이·이름, 조부모 나이·별세·이름, 함께 사는 쪽, 위·아래 형제 성별·나이 차·독립 나이·이름, 집, 로그) ② 파생 계획 —
 *    `familyScheduleOf`의 부모 별세 시점과 별세 나이(`parentGoneOwn` 포함)·먼저 떠나는 분·이혼·형제 별세(Q3)·조부모 별세, `childLeaveAgeOf`(자녀 독립 나이) ③ 대표 나이 0·1·7·19·20·40·65세의 가족 보기 요약(사람마다 함께/따로/떠남과 떠난 나이).
 *    가지 시드는 퍼진 시드로는 잘 안 닿는 가지(이혼 어머니·아버지, 어린 형제 별세 위·아래, 0세 해 별세 이동)를 일부러 채운다 — 「골든 안에 모든 가지가 있다」가 지킨다.
 *  - `adult`(7세대 × 3시드 × 시나리오 8): 플래그 `has_partner`·`married`·`divorced`·`has_child`·`child_late`·`close_friend`와 본 사건의 나이를 고정해 `adultSlotsOf`가 돌려주는 성인기 식구(역할·이름·성별·출생 연도·`at`) — 조건 ①.
 *  - `tables`(표 지문): 표본의 판들이 지나지 않는 값도 알아채려고 가족 값·성인기 식구를 만드는 **표·상수·이름 풀을 직접** 얼린다 — 코드 상수(`FAMILY_SALT`·`FAMILY_TAG`·`NAME_KEY`·나이 상한·`DIVORCE_AGES` …)는 값 그대로,
 *    가족 표(생존 곡선·어머니 나이·가구·이혼율·집)와 `FAMILY_DESIGN`의 가족 값 설계값(`adult`·`leaveAge`·`siblingLoss`·`highOrderContinue` …)·성씨 분포는 지문(FNV-1a)으로, 출생 연도별 이름 풀(남·여, 1940~2020·2026)은 같은 풀이 이어지는 연도 묶음의 지문으로 둔다 — 한 글자만 고쳐도 걸린다.
 *    (문구·사이·반려동물·가진 것·직업 줄·이른 부모 별세 효과 수치 표는 가족 값을 바꾸지 않아 뺐다.)
 *  - `wiring`: 성인기 식구 계산이 사건 풀에서 읽는 배선 — 어느 사건이 `has_partner`·`married`·`has_child`·`close_friend`·`parents_gone`을 켜고(`setFlags`) 어느 사건이 `close_friend`를 요구하는가(`conditions.flags`).
 *
 * 무엇이 바뀌면 걸리는가:
 *  - 출생 `family` 저장값: `rollFamilyBirth`·`rollGrandparents`·`rollParentLife`·`rollCohabit`·`rollOlderSiblings`·`rollYoungerSiblings`·`rollHome`·`rollFamilyNames`, `FAMILY_TAG`·`NAME_KEY` 값, 이름 풀·성씨 분포,
 *    `FAMILY_DESIGN`(`leaveAge`·`paternalSideShare`·`maleShare`·`continueCap`·`highOrderContinue`·집 표 …)·`family/tables.json`, `famSeedOf`·`famHash01`, 생존 곡선(`deathAgeGiven`), 부모 나이 모델.
 *  - 파생 계획: `parentGoneAtOf`(하한 1세, R-618)·`parentGoneOwnAgeOf`·`divorcePlan`·`DIVORCE_AGES`·`parentDivorceRate` 표·`divorceFatherLeaves`, `siblingLossPlan`(`design.siblingLoss`), `grandBirthYears`·`goneAtMyAge`, `childLeaveAgeOf`(`design.leaveAge`).
 *  - 가족 보기: `familyViewOf`의 동거·독립·이혼 뒤 조부모·떠난 사람 규칙, `GRAND_COHABIT_UNTIL`·`FAMILY_MAX_AGE`.
 *  - 성인기 식구: `adultSlotsOf`, `design.adult`(`spouseGap`·`spouseMinAge`·`childCount`·`childGap`·`childLastAge`·`friendCount`·`friendAgeOffset`·`fallbackAt`), `NAME_KEY`·`NameBook`, 이름 풀,
 *    사건 풀에서 위 다섯 플래그를 켜는 `setFlags`와 `close_friend`를 요구하는 `conditions.flags`(배선).
 *  - 걸리지 않는 것: 문구(`familyText`·`familyCardText`), 사건이 일어나는 시점을 정하는 그 밖의 `conditions`(저장된 판은 이미 `seen`을 갖고 있어 소급하지 않는다), 효과 수치, 그림,
 *    성인기 식구 이름을 거르는 금지 목록(`data/forbiddenNames`·`isRejectedName`) — 표본 이름이 그 목록에 닿지 않으면 알아채지 못한다,
 *    사이·직업 줄·가진 것·반려동물 이름(SPEC-009 FS2 표: 표시용 파생 값 — `familyCard.test.ts`·장면 골든이 일부만 잠근다).
 *
 * 갱신 규칙(One-way) — 골든 파일 머리 `updateRule`과 같은 말: 공개 배포(K6) 뒤에 이 골든을 다시 만드는 것은 이어하던 판의 가족이 바뀌는 One-way 변경이다 — 가족 값 대부분은 저장하지 않고 출생 때 해시와 표에서 다시 계산하기 때문이다.
 * 그래서 다시 만들기 전에 **마스터 승인과 형진 님 확인**이 필요하다. 성인 식구 표(이름 풀·`design.adult`·`NAME_KEY`·성인 플래그를 켜는 사건)를 바꿀 때는 SPEC-009 FS2 예외 ③대로 「로드 때 `family.ad` 스냅샷」을 **먼저 한 번 배포**한다.
 * 다시 만드는 명령은 한 곳뿐이다: `npm run golden:family -- --write` (`--write` 없이 돌리면 쓰지 않고 달라진 칸만 알려 준다). **이 시험과 helper는 골든 파일을 절대 쓰지 않는다**(「골든 갱신 규칙과 파일 위생」이 본다).
 */

const G = golden as unknown as L0fGolden;
const now = l0fGolden();
const files = import.meta.glob(['./helpers/familyL0f.ts', '../scripts/familyL0fGolden.ts', './fixtures/family-golden.json', '../package.json'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
/** 다른 파일은 glob으로, 이 시험 파일 자신은(glob이 자기를 빼므로) 저장소에서 읽는다 */
const raw = (path: string): string => (path === './familyGolden.test.ts' ? (readRepoText('tests/familyGolden.test.ts') ?? '') : (files[path] ?? ''));

/** 칸마다 글로 견줘 달라진 칸을 「칸 / 골든 / 지금」으로 돌려준다 */
function diffOf<T>(before: Record<string, T>, after: Record<string, T>, show: (v: T | undefined) => string): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => show(before[k]) !== show(after[k])).map((k) => `${k}\n  골든 ${show(before[k])}\n  지금 ${show(after[k])}`);
}
const ADVICE = '의도한 변경이면 마스터 승인·형진 님 확인 뒤 npm run golden:family -- --write (공개 뒤라면 One-way — 이 파일 머리 주석의 갱신 규칙)';

describe('L0F 가족 값 골든 — 출생 family 저장값 · 파생 계획 · 대표 나이 가족 보기 (7세대 × 퍼진 시드 + 가지 시드)', () => {
  it('골든이 정한 표본(대표 나이·시드 수·가지 시드·가지 목록)과 지금 시험이 도는 표본이 같다', () => {
    expect(G.meta.ages).toEqual([...L0F_AGES]);
    expect(G.meta.spreadSeeds).toBe(L0F_SPREAD_SEEDS);
    expect(G.meta.featureSeeds).toEqual(L0F_FEATURE_SEEDS.map((f) => ({ ...f })));
    expect(G.meta.requiredTags).toEqual(Object.keys(L0F_REQUIRED_TAGS));
    expect(Object.keys(G.births)).toEqual(l0fSample().map((s) => s.key));
    expect(l0fSample()).toHaveLength(7 * L0F_SPREAD_SEEDS + L0F_FEATURE_SEEDS.length);
    // 세대마다 퍼진 시드가 있다
    for (const gen of GENERATION_IDS) expect(Object.keys(G.births).filter((k) => k.startsWith(`${gen}/`)).length, gen).toBeGreaterThanOrEqual(L0F_SPREAD_SEEDS);
  });

  it('모든 판의 출생 때 family 저장값(부모 별세 나이·조부모·형제 구성·독립 나이·이름·집·로그)이 골든과 같다', () => {
    const diff = diffOf(G.births, now.births, (c) => (c === undefined ? '(없음)' : `${c.head}\n  ${JSON.stringify(c.family)}`));
    expect(diff.slice(0, 3), `달라진 판 ${diff.length}개 — ${ADVICE}`).toEqual([]);
  });

  it('모든 판의 파생 계획(부모 별세 시점·별세 나이·이혼·형제 별세 Q3·조부모 별세·자녀 독립 나이)이 골든과 같다', () => {
    const diff = diffOf(G.births, now.births, (c) => c?.plan ?? '(없음)');
    expect(diff.slice(0, 3), `달라진 판 ${diff.length}개 — ${ADVICE}`).toEqual([]);
  });

  it('모든 판의 대표 나이(0·1·7·19·20·40·65세) 가족 보기 요약이 골든과 같다', () => {
    const diff = diffOf(G.births, now.births, (c) => c?.view.join('\n  ') ?? '(없음)');
    expect(diff.slice(0, 3), `달라진 판 ${diff.length}개 — ${ADVICE}`).toEqual([]);
  });

  it('골든 자체가 공허하지 않다: 모든 가지(이혼 어머니·아버지, 어린 형제 별세 위·아래, 이른 부모 별세, 0세 해 별세 이동, 조부모 동거 …)가 골든 안에 있고 모든 식구에게 이름이 있다', () => {
    const tags = new Set(Object.values(G.births).flatMap((c) => c.tags.split(' ').filter((t) => t !== '')));
    expect(Object.keys(L0F_REQUIRED_TAGS).filter((t) => !tags.has(t)), '골든 안에 없는 가지 — npm run golden:family -- --scan 으로 시드를 다시 골라 L0F_FEATURE_SEEDS에 옮긴다').toEqual([]);
    // 지금 규칙이 만든 판에도 같은 가지가 있다(골든 글만 믿지 않는다)
    const nowTags = new Set(Object.values(now.births).flatMap((c) => c.tags.split(' ').filter((t) => t !== '')));
    expect(Object.keys(L0F_REQUIRED_TAGS).filter((t) => !nowTags.has(t))).toEqual([]);
    // 가지 시드는 적힌 가지를 정말 지난다
    for (const f of L0F_FEATURE_SEEDS) expect(G.births[`${f.gen}/${f.seed}`].tags.split(' '), `${f.gen} ${f.seed} (${L0F_REQUIRED_TAGS[f.tag]})`).toContain(f.tag);
    // 모든 식구에게 이름이 있다(저장된 이름이 비면 골든이 이름을 얼리지 못한다)
    for (const [k, c] of Object.entries(G.births)) {
      const f = c.family;
      const names = [...f.p.map((p) => p.n), ...f.g.map((g) => g.n), ...f.o.map((s) => s.n), ...f.y.map((s) => s.n)];
      expect(names.every((n) => typeof n === 'string' && /^[가-힣]{2,5}$/.test(n)), `${k} 이름`).toBe(true);
      expect(c.view).toHaveLength(L0F_AGES.length);
    }
    // 판마다 값이 다르다(한 판만 복사된 골든이 아니다)
    expect(new Set(Object.values(G.births).map((c) => JSON.stringify(c.family))).size).toBe(Object.keys(G.births).length);
    // 지금 규칙의 가족 보기가 가지를 실제로 그린다: 이혼 판은 이혼 뒤 「따로 삶(s)」, 형제 별세 판은 떠난 동생, 별세 판은 떠난 부모가 보기에 있다
    const views = Object.values(G.births);
    expect(views.some((c) => c.tags.includes('div-f') && c.view.some((v) => / fathers/.test(v))), '아버지가 떠난 이혼 — 보기에 fathers').toBe(true);
    expect(views.some((c) => c.tags.includes('div-m') && c.view.some((v) => /mothers/.test(v))), '어머니가 떠난 이혼 — 보기에 mothers').toBe(true);
    expect(views.some((c) => c.tags.includes('loss-y') && c.view.some((v) => /y\dg\d/.test(v))), '어린 동생 별세 — 보기에 떠난 y').toBe(true);
    expect(views.some((c) => c.tags.includes('loss-o') && c.view.some((v) => /o\dg\d/.test(v))), '어린 형 별세 — 보기에 떠난 o').toBe(true);
    expect(views.some((c) => c.tags.includes('gone1-m') && c.view.some((v) => /motherg\d/.test(v))), '이른 어머니 별세 — 보기에 떠난 어머니').toBe(true);
  });
});

describe('L0F 조건 ① — adultSlotsOf 골든 (실제 이름 풀 · 고정 seen·플래그 · 7세대 × 3시드 × 시나리오 8)', () => {
  it('골든이 정한 표본(시드 수·시나리오의 나이·플래그·본 사건)과 지금 시험이 도는 표본이 같다', () => {
    expect(G.meta.adultSeeds).toBe(L0F_ADULT_SEEDS);
    expect(G.meta.adultScenarios).toEqual(ADULT_SCENARIOS.map((s) => ({ ...s, flags: [...s.flags], seen: { ...s.seen } })));
    expect(G.meta.wiringReads).toEqual(WIRING_READS.map((w) => ({ ...w })));
    expect(Object.keys(G.adult)).toEqual(l0fAdultSample().map((s) => s.key));
    expect(Object.keys(G.adult)).toHaveLength(7 * L0F_ADULT_SEEDS);
    // 시나리오가 쓰는 플래그 여섯 가지가 모두 든다: 배우자 has_partner·married·divorced, 자녀 has_child·child_late, 친구 close_friend
    const flags = new Set(ADULT_SCENARIOS.flatMap((s) => s.flags));
    for (const f of ['has_partner', 'married', 'divorced', 'has_child', 'child_late', 'close_friend']) expect(flags.has(f), f).toBe(true);
  });

  it('사건 풀 배선(어느 사건이 has_partner·married·has_child·close_friend·parents_gone을 켜고 어느 사건이 close_friend를 요구하는가)이 골든과 같다', () => {
    const diff = diffOf(G.wiring, now.wiring, (v) => (v === undefined ? '(없음)' : v.join(', ')));
    expect(diff, `사건 풀의 setFlags·conditions.flags가 바뀌었다 — 성인기 식구의 at·친구가 이어하던 판에서 달라질 수 있다. ${ADVICE}`).toEqual([]);
  });

  it('시나리오가 고정한 사건 id는 모두 지금 풀에 있다 (사건이 사라지거나 이름이 바뀌면 여기서 알린다)', () => {
    const ids = new Set(eventPool().events.map((e) => e.id));
    const missing = ADULT_SCENARIOS.flatMap((s) => Object.keys(s.seen)).filter((id) => !ids.has(id));
    expect(missing, '풀에 없는 사건 id').toEqual([]);
    // 첫 자녀·미룬 자녀·친구·만남·혼인 사건이 실제로 그 플래그를 켠다 — 배선 줄(wiring)과 같은 말이지만 시나리오 입력 쪽에서 한 번 더 잠근다
    const wiring = now.wiring;
    expect(wiring['has_partner:set']).toContain('youth-meeting');
    expect(wiring['married:set']).toContain('youth-marriage');
    expect(wiring['has_child:set']).toEqual(expect.arrayContaining(['youth-child', 'youth-child-again']));
    expect(wiring['close_friend:set']).toContain('school-friend');
    expect(wiring['close_friend:req']).toContain('youth-friend-wedding');
  });

  it('모든 판 × 시나리오의 성인기 식구(역할·이름·성별·출생 연도·at)가 골든과 같다', () => {
    const flat = (g: L0fGolden): Record<string, string> => Object.fromEntries(Object.entries(g.adult).flatMap(([k, row]) => Object.entries(row).map(([sc, line]) => [`${k} · ${sc}`, line])));
    const diff = diffOf(flat(G), flat(now), (v) => v ?? '(없음)');
    expect(diff.slice(0, 5), `달라진 칸 ${diff.length}개 — ${ADVICE}`).toEqual([]);
  });

  it('골든 자체가 공허하지 않다: 시나리오마다 식구가 나오고, 자녀 1~4명·친구 1~3명이 모두 나오며, 미룬 자녀·본 나이 없음(fallbackAt)·만난 나이 고정 경로가 시나리오마다 다른 at를 낸다', () => {
    const rows = Object.entries(G.adult);
    const slotsOf = (line: string): Array<{ id: string; at: number }> => (line === '-' ? [] : line.split(' | ').map((s) => ({ id: s.split(' ')[0], at: Number(s.split('@')[1]) })));
    for (const sc of ADULT_SCENARIOS) expect(rows.some(([, row]) => row[sc.id] !== '-'), sc.id).toBe(true);
    const kidCounts = new Set<number>();
    const friendCounts = new Set<number>();
    for (const [k, row] of rows) {
      for (const sc of ['kids', 'late', 'bare']) kidCounts.add(slotsOf(row[sc]).filter((s) => s.id.startsWith('c')).length);
      for (const sc of ['friend', 'late', 'faded', 'bare']) friendCounts.add(slotsOf(row[sc]).filter((s) => s.id.startsWith('f')).length);
      // 경로별 at: 첫 자녀는 child_late가 켜지면 마지막으로 본 사건(36), 아니면 처음 본 사건(27), 본 사건이 없으면 fallbackAt.child(28)
      expect(slotsOf(row.late).find((s) => s.id === 'c1')?.at, `${k} late`).toBe(36);
      expect(slotsOf(row.kids).find((s) => s.id === 'c1')?.at, `${k} kids`).toBe(27);
      expect(slotsOf(row.bare).find((s) => s.id === 'c1')?.at, `${k} bare 자녀`).toBe(28);
      expect(slotsOf(row.bare).find((s) => s.id === 'spouse')?.at, `${k} bare 배우자`).toBe(24);
      expect(slotsOf(row.bare).find((s) => s.id === 'f1')?.at, `${k} bare 친구`).toBe(12);
      // 친구는 close_friend가 꺼져도(faded) 요구 사건을 본 판은 남고, 처음 만난 나이는 가장 이른 본 사건(13)
      expect(slotsOf(row.faded).find((s) => s.id === 'f1')?.at, `${k} faded`).toBe(13);
      // 나이를 낮춰 본 판(young, 33세)은 그때까지 태어난 자녀만 있다
      expect(slotsOf(row.young).filter((s) => s.id.startsWith('c')).every((s) => s.at <= 33), `${k} young`).toBe(true);
      // 이혼·연인·혼인 플래그는 모두 배우자 한 명을 낳는다
      for (const sc of ['partner', 'ex', 'kids']) expect(slotsOf(row[sc]).filter((s) => s.id === 'spouse'), `${k} ${sc}`).toHaveLength(1);
    }
    expect([...kidCounts].sort(), '골든 안의 자녀 수 — 하나라도 빠지면 L0F_ADULT_SEEDS를 늘려 다시 고른다').toEqual([1, 2, 3, 4]);
    expect([...friendCounts].sort(), '골든 안의 친구 수').toEqual([1, 2, 3]);
    // 판마다 이름이 다르다(한 판 값이 복사된 골든이 아니다)
    expect(new Set(rows.map(([, row]) => row.late)).size).toBe(rows.length);
  });
});

describe('L0F 표 지문 — 표·상수·이름 풀을 직접 얼린다 (표본의 판이 지나지 않는 값도 알아챈다)', () => {
  const flatT = (g: L0fGolden): Record<string, string> => ({
    ...Object.fromEntries(Object.entries(g.tables.constants).map(([k, v]) => [`constants/${k}`, JSON.stringify(v)])),
    ...g.tables.fingerprints,
    ...Object.fromEntries(g.tables.namePools.map((v, i) => [`namePools/${i}`, v])),
  });

  it('코드 상수(해시 소금·태그·사람 번호·나이 상한·계획 경계)·가족 표·설계값·성씨·이름 풀의 지문이 골든과 같다', () => {
    const diff = diffOf(flatT(G), flatT(now), (v) => v ?? '(없음)');
    expect(diff, `가족 값을 만드는 표·상수·이름 풀이 바뀌었다 — 이어하던 판의 가족이 달라질 수 있다. ${ADVICE}`).toEqual([]);
  });

  it('골든 자체가 공허하지 않다: 상수·지문이 충분하고, 이름 풀은 남·여 모두 1940~2026을 틈 없이 덮으며, 지문은 서로 다르다', () => {
    const t = G.tables;
    expect(t.constants.FAMILY_SALT, '해시 소금 — 바꾸면 알려진 시드의 가족이 모두 달라진다').toBe(0x46414d49);
    expect(Object.keys(t.constants).length).toBeGreaterThanOrEqual(18);
    expect(Object.keys(t.fingerprints).sort()).toEqual(['design.adult', 'design.continueCap', 'design.divorceFatherLeaves', 'design.highOrderContinue', 'design.home', 'design.leaveAge', 'design.maleShare', 'design.paternalSideShare', 'design.siblingLoss', 'divorce', 'household', 'housing', 'mortality', 'motherAge', 'surnames']);
    for (const v of Object.values(t.fingerprints)) expect(v).toMatch(/^[0-9a-f]{8}$/);
    expect(new Set(Object.values(t.fingerprints)).size, '지문이 서로 다르다').toBe(Object.keys(t.fingerprints).length);
    for (const sex of ['남', '여']) {
      const rows = t.namePools.filter((l) => l.startsWith(`${sex} `)).map((l) => /^. (\d+)-(\d+) ([0-9a-f]{8}) n(\d+)$/.exec(l));
      expect(rows.length, `${sex} 이름 풀 묶음`).toBeGreaterThanOrEqual(15);
      expect(rows.every((r) => r !== null), `${sex} 줄 모양`).toBe(true);
      const spans = rows.map((r) => [Number(r![1]), Number(r![2])]);
      expect(spans[0][0]).toBe(1940);
      expect(spans[spans.length - 1][1]).toBe(2026);
      spans.slice(1).forEach(([from], i) => expect(from, `${sex} 묶음 사이 틈`).toBe(spans[i][1] + (spans[i][1] === 2020 ? 6 : 1)));
      expect(rows.every((r) => Number(r![4]) >= 15), `${sex} 풀 크기`).toBe(true);
    }
  });
});

describe('L0F 골든 갱신 규칙과 파일 위생', () => {
  it('골든 파일 머리(updateRule)에 갱신 규칙이 있고 이 시험 머리 주석과 같은 뜻이다', () => {
    expect(G.updateRule).toBe(L0F_UPDATE_RULE);
    // 이 시험의 단언 줄(아래 배열)에도 같은 글이 있어 파일 전체를 보면 늘 통과한다 — 첫 블록 주석(머리 주석)만 본다
    const source = raw('./familyGolden.test.ts');
    const head = source.slice(source.indexOf('/**'), source.indexOf('*/') + 2);
    expect(head.length, '머리 주석을 읽었다(공허 통과 방지)').toBeGreaterThan(1000);
    for (const phrase of ['One-way', '마스터 승인', '형진 님', 'family.ad', '로드 때', 'npm run golden:family -- --write', '절대 쓰지 않는다']) {
      expect(G.updateRule, phrase).toContain(phrase);
      expect(head, `시험 머리 주석: ${phrase}`).toContain(phrase);
    }
  });

  it('다시 만드는 명령은 한 곳(package.json의 golden:family)뿐이고, 시험·helper는 파일을 쓰지 않으며, 스크립트는 --write가 있어야만 쓴다', () => {
    const pkg = JSON.parse(raw('../package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['golden:family']).toMatch(/familyL0fGolden/);
    // 글자 그대로 적으면 이 줄이 스스로 걸리므로 조각을 이어 만든다
    const writers = ['write' + 'File', 'append' + 'File', 'create' + 'WriteStream', 'rm' + 'Sync', 'unlink' + 'Sync'].map((w) => new RegExp(`\\b${w}`));
    for (const path of ['./familyGolden.test.ts', './helpers/familyL0f.ts']) {
      expect(raw(path).length, `${path}를 읽었다(공허 통과 방지)`).toBeGreaterThan(1000);
      for (const re of writers) expect(raw(path), `${path} 에 ${re.source}`).not.toMatch(re);
    }
    const script = raw('../scripts/familyL0fGolden.ts');
    expect(script.length, '스크립트를 읽었다').toBeGreaterThan(1000);
    expect(script).toContain("process.argv.slice(2)");
    expect(script).toMatch(/args\.includes\('--write'\)/);
    // 쓰는 줄은 --write 판 안에 하나뿐이다
    expect(script.match(new RegExp('write' + 'FileSync\\(', 'g'))).toHaveLength(1);
    // 그리고 그 줄이 `if (args.includes('--write')) {` 바로 안쪽이다 (판 밖으로 옮기면 알린다)
    expect(script).toMatch(new RegExp("if \\(args\\.includes\\('--write'\\)\\) \\{\\s*" + 'write' + 'FileSync\\('));
  });

  it('픽스처는 LF만 쓰고 사용자 경로가 없으며 작다(≤ 80KB)', () => {
    const text = raw('./fixtures/family-golden.json');
    expect(text.length).toBeGreaterThan(0);
    expect(carriageReturnLines(text)).toEqual([]);
    expect(findLocalPathLeaks(text)).toEqual([]);
    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(80_000);
    expect(text.endsWith('\n')).toBe(true);
  });

  it('파일의 글은 `npm run golden:family -- --write`가 쓸 글과 한 글자도 다르지 않다 (손으로 고친 흔적·읽는 순서만 바뀐 값이 없다)', () => {
    expect(raw('./fixtures/family-golden.json')).toBe(serializeL0f(now));
  });
});

