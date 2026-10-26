import { ERAS, type Era } from '../src/core';
import { courseOf, playRecorded } from './baseline004Lib';
import {
  CHAIN_EVENTS,
  L0_SELECTORS,
  alive,
  chainOutcome,
  firstsOf,
  homePathOf,
  mean,
  playL0,
  pointAt,
  quantile,
  seOf,
  share,
  type L0Record,
  type L0Selector,
} from './realismL0Lib';
import { countBy } from './baseline004Lib';

/**
 * SPEC-004 현실성 보정 1단계 L0(측정 정정) 실행 스크립트.
 * 실행: ./node_modules/.bin/vite-node scripts/realismL0.ts [판수=1000]
 * 시대 past(지난 = X 대리) · present(지금 = 밀레니얼 대리) × 선택자 random · auto · course, 시드 i×7919+13 (기준선과 같다).
 * 결과는 docs/data/realism-calibration.md 「L0 측정 결과」에 옮겨 적는다. 게임 코드는 바꾸지 않는다.
 */
const args = process.argv.slice(2);
const lives = Number(args.find((a) => !a.startsWith('--')) ?? 1000);
const ERA_LIST: Era[] = ERAS.filter((e) => e === 'past' || e === 'present');
const eraLabel = (e: Era) => (e === 'past' ? '지난(X 대리)' : '지금(밀레니얼 대리)');
const pct = (n: number, d = 1) => (Number.isNaN(n) ? '–' : `${(n * 100).toFixed(d)}%`);
const fx = (n: number, d = 1) => (Number.isNaN(n) ? '–' : n.toFixed(d));

interface Group {
  era: Era;
  sel: L0Selector;
  recs: L0Record[];
}

// ---------- 0) 같은 판 점검: playL0(auto, random)이 기준선의 playRecorded와 같은가 ----------
{
  let bad = 0;
  let n = 0;
  for (const era of ERA_LIST)
    for (const sel of ['auto', 'random'] as const)
      for (let i = 1; i <= 25; i++) {
        const seed = i * 7919 + 13;
        const a = playL0(seed, era, sel);
        const b = playRecorded(seed, era, sel);
        n++;
        const fa = [...(a.at.get(a.deathAge)?.flags ?? [])].sort().join(',');
        const fb = [...(b.at.get(b.deathAge)?.flags ?? [])].sort().join(',');
        if (a.deathAge !== b.deathAge || fa !== fb || a.birthYear !== b.birthYear) bad++;
      }
  console.log(`# 0) 같은 판 점검 — playL0 대 기준선 playRecorded: ${n}판 중 다른 판 ${bad}개 (사망 나이·끝 플래그·출생 연도)`);
}

const groups: Group[] = [];
for (const sel of L0_SELECTORS)
  for (const era of ERA_LIST) {
    const recs: L0Record[] = [];
    for (let i = 1; i <= lives; i++) recs.push(playL0(i * 7919 + 13, era, sel));
    groups.push({ era, sel, recs });
  }
const gLabel = (g: Group) => `${g.sel} · ${eraLabel(g.era)}`;

const FIRSTS = new Map<L0Record, ReturnType<typeof firstsOf>>();
const firsts = (r: L0Record) => {
  let f = FIRSTS.get(r);
  if (!f) FIRSTS.set(r, (f = firstsOf(r)));
  return f;
};

// ---------- 1) 표본 ----------
console.log(`\n# 1) 표본 — 시대 × 선택자, 각 ${lives}판 (시드 i×7919+13)`);
console.log('| 선택자 · 시대 | 판 수 | 45세 이상 산 판 | 65세 이상 산 판 | 사망 나이 평균 | 20세 전 사망 | 출생 연도 범위 |');
console.log('|---|---:|---:|---:|---:|---:|---|');
for (const g of groups) {
  const by = g.recs.map((r) => r.birthYear);
  console.log(
    `| ${gLabel(g)} | ${g.recs.length} | ${alive(g.recs, 45).length} | ${alive(g.recs, 65).length} | ${fx(mean(g.recs.map((r) => r.deathAge)))} | ${pct(share(g.recs.map((r) => r.deathAge < 20)))} | ${Math.min(...by)}~${Math.max(...by)} |`,
  );
}

// ---------- 2) 정석 4단과 단계 통과율 ----------
type Den = { label: string; pick: (g: Group) => L0Record[] };
const DENS: Den[] = [
  { label: '전체', pick: (g) => g.recs },
  { label: '45세 이상', pick: (g) => alive(g.recs, 45) },
  { label: '65세 이상', pick: (g) => alive(g.recs, 65) },
];
const funnel = (rs: L0Record[]) => {
  const F = rs.map(firsts);
  const C = rs.map((_, i) => F[i].career !== null);
  const P = rs.map((_, i) => F[i].partner !== null);
  const M = rs.map((_, i) => F[i].married !== null);
  const K = rs.map((_, i) => F[i].child !== null);
  const H = rs.map((_, i) => F[i].home !== null);
  const cm = rs.map((_, i) => C[i] && M[i]);
  const cmk = rs.map((_, i) => C[i] && M[i] && K[i]);
  const cmkh = rs.map((_, i) => C[i] && M[i] && K[i] && H[i]);
  const co = rs.map(courseOf);
  const cnt = (xs: boolean[]) => xs.filter(Boolean).length;
  return {
    n: rs.length,
    C: share(C), P: share(P), M: share(M), K: share(K), H: share(H),
    cmkh: share(cmkh),
    cmkhN: cnt(cmkh),
    ordered: share(co.map((x) => x.ordered4)),
    al10: share(co.map((x) => x.al10)),
    atLeast3: share(co.map((x) => x.atLeast3)),
    mc: cnt(cm) / (cnt(C) || 1),
    km: cnt(cmk) / (cnt(cm) || 1),
    hk: cnt(cmkh) / (cnt(cmk) || 1),
    pc: cnt(rs.map((_, i) => C[i] && P[i])) / (cnt(C) || 1),
    mp: cnt(rs.map((_, i) => C[i] && P[i] && M[i])) / (cnt(rs.map((_, i) => C[i] && P[i])) || 1),
  };
};

console.log('\n# 2-A) 정석 4단(취업·결혼·출산·내 집, 순서 무관) — 선택자 × 시대 × 분모');
console.log('| 선택자 · 시대 | 전체 | 45세 이상 | 65세 이상 (판 수) | 순서대로(65+) | AL10식(65+) | 4개 중 3개 이상(65+) |');
console.log('|---|---:|---:|---:|---:|---:|---:|');
for (const g of groups) {
  const f = DENS.map((d) => funnel(d.pick(g)));
  console.log(`| ${gLabel(g)} | ${pct(f[0].cmkh)} (±${pct(seOf(f[0].cmkh, f[0].n) * 2)}) | ${pct(f[1].cmkh)} | ${pct(f[2].cmkh)} (${f[2].cmkhN}/${f[2].n}) | ${pct(f[2].ordered)} | ${pct(f[2].al10)} | ${pct(f[2].atLeast3)} |`);
}
console.log('(괄호 ±는 전체 분모의 2 표준오차)');

console.log('\n# 2-B) 단계 통과율 (65세 이상 산 판 기준, 기준선 1절과 같은 분모) — C 취업(has_career) · P 파트너(has_partner 또는 married) · M 결혼 · K 출산 · H 내 집(own_home 또는 주거 자가)');
console.log('| 선택자 · 시대 | C | P | M | K | H | M÷C | K÷M(C·M 안에서) | H÷(CMK) | P÷C(C 안에서) | M÷P(C·P 안에서) |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const g of groups) {
  const f = funnel(alive(g.recs, 65));
  console.log(`| ${gLabel(g)} | ${pct(f.C)} | ${pct(f.P)} | ${pct(f.M)} | ${pct(f.K)} | ${pct(f.H)} | ${pct(f.mc)} | ${pct(f.km)} | ${pct(f.hk)} | ${pct(f.pc)} | ${pct(f.mp)} |`);
}
console.log('\n# 2-C) 같은 통과율을 전체 판 분모로 (일찍 죽은 판 포함)');
console.log('| 선택자 · 시대 | C | P | M | K | H | M÷C | K÷M | H÷(CMK) |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const g of groups) {
  const f = funnel(g.recs);
  console.log(`| ${gLabel(g)} | ${pct(f.C)} | ${pct(f.P)} | ${pct(f.M)} | ${pct(f.K)} | ${pct(f.H)} | ${pct(f.mc)} | ${pct(f.km)} | ${pct(f.hk)} |`);
}

// ---------- 3) 시점 값 (규칙 M2·M4: 그 나이까지 산 판만) ----------
const POINT_AGES = [25, 30, 35, 40, 45, 50, 55, 65];
console.log('\n# 3) 시점 값 — 그 나이까지 산 판 중 비율. ever = 그 나이까지 한 번이라도, at = 그 나이의 상태 (M2·M4)');
const point = (title: string, f: (r: L0Record, a: number) => boolean) => {
  console.log(`\n## ${title}`);
  console.log(`| 선택자 · 시대 | ${POINT_AGES.map((a) => `${a}세`).join(' | ')} |`);
  console.log(`|---|${POINT_AGES.map(() => '---:').join('|')}|`);
  for (const g of groups) console.log(`| ${gLabel(g)} | ${POINT_AGES.map((a) => pct(share(alive(g.recs, a).map((r) => f(r, a))))).join(' | ')} |`);
};
point('3-1 ever_married(a) (R01 생애미혼율 = 1 − ever_married(50))', (r, a) => (firsts(r).married ?? 999) <= a);
point('3-2 at_married(a) (현재 결혼 상태 — 이혼하면 꺼진다)', (r, a) => pointAt(r, a)!.married);
point('3-3 ever_child(a) (전체 기준; 결혼한 판만 보는 표는 3-3b)', (r, a) => (firsts(r).child ?? 999) <= a);
console.log('\n## 3-3b 결혼한 판(그 나이까지 처음 결혼) 중 ever_child(a) (R03 무자녀 비율의 게임 쪽, 분모 = ever_married(a))');
console.log(`| 선택자 · 시대 | ${POINT_AGES.slice(1, 7).map((a) => `${a}세`).join(' | ')} |`);
console.log(`|---|${POINT_AGES.slice(1, 7).map(() => '---:').join('|')}|`);
for (const g of groups)
  console.log(
    `| ${gLabel(g)} | ${POINT_AGES.slice(1, 7)
      .map((a) => {
        const m = alive(g.recs, a).filter((r) => (firsts(r).married ?? 999) <= a);
        return `${pct(share(m.map((r) => (firsts(r).child ?? 999) <= a)))} (n=${m.length})`;
      })
      .join(' | ')} |`,
  );
point('3-4 at_own — 주거 own (R04 자가점유율의 게임 쪽 첫 정의)', (r, a) => pointAt(r, a)!.ownDwelling);
point('3-5 at_own — 주거 own 또는 own_home 플래그 (합친 정의)', (r, a) => pointAt(r, a)!.ownUnion);
point('3-6 ever_home(a) (내 집을 한 번이라도, 합친 정의 — 기준선 H와 같은 뜻)', (r, a) => (firsts(r).home ?? 999) <= a);
point('3-7 at_employed(a) (R06 has_career 또는 own_business, 은퇴 전)', (r, a) => pointAt(r, a)!.employed);
point('3-8 at_business(a) (R11 own_business, 은퇴 전)', (r, a) => pointAt(r, a)!.business);
point('3-9 at_solo(a) (R12 파트너도 결혼도 아님)', (r, a) => pointAt(r, a)!.solo);
point('3-10 ever_divorced(a) (R09 divorced)', (r, a) => (firsts(r).divorced ?? 999) <= a);

// ---------- 4) 처음 밟은 나이 ----------
console.log('\n# 4) 처음 밟은 나이 (그 단계를 밟은 판만; 65세 이상 산 판) — 중앙값 [25%~75%] 평균, 밟은 판 수');
console.log('| 선택자 · 시대 | 취업 | 파트너 | 결혼 | 출산 | 내 집 |');
console.log('|---|---|---|---|---|---|');
for (const g of groups) {
  const rs = alive(g.recs, 65);
  const cell = (k: 'career' | 'partner' | 'married' | 'child' | 'home') => {
    const v = rs.map((r) => firsts(r)[k]).filter((x): x is number => x !== null);
    return `${quantile(v, 0.5)} [${quantile(v, 0.25)}~${quantile(v, 0.75)}] ${fx(mean(v))} (n=${v.length})`;
  };
  console.log(`| ${gLabel(g)} | ${cell('career')} | ${cell('partner')} | ${cell('married')} | ${cell('child')} | ${cell('home')} |`);
}
console.log('\n성별 구분(M5): 처음 결혼한 나이 평균 (65세 이상 산 판)');
console.log('| 선택자 · 시대 | 성별 값 | 평균 (n) |');
console.log('|---|---|---|');
for (const g of groups) {
  const rs = alive(g.recs, 65);
  const by = countBy(rs, (r) => r.gender);
  const parts = [...by.keys()].sort().map((k) => {
    const v = rs.filter((r) => r.gender === k).map((r) => firsts(r).married).filter((x): x is number => x !== null);
    return `${k} ${fx(mean(v))} (n=${v.length}/${by.get(k)})`;
  });
  console.log(`| ${gLabel(g)} | ${[...by.keys()].sort().join('/')} | ${parts.join(' · ')} |`);
}

// ---------- 5) H2: 설정 경로·나이 창 ----------
console.log('\n# 5) H2 — 설정 경로와 나이 창');
console.log('\n## 5-1 처음 결혼한 나이대별 자녀 도달 (45세 이상 산 판 중 결혼한 판; K = has_child를 한 번이라도)');
const BANDS: Array<[string, number, number]> = [['~29세', 0, 29], ['30~34세', 30, 34], ['35~38세', 35, 38], ['39세', 39, 39], ['40세 이상', 40, 200]];
console.log(`| 선택자 · 시대 | 결혼한 판 | ${BANDS.map((b) => b[0]).join(' | ')} |`);
console.log(`|---|---:|${BANDS.map(() => '---:').join('|')}|`);
for (const g of groups) {
  const m = alive(g.recs, 45).filter((r) => firsts(r).married !== null);
  const cells = BANDS.map(([, lo, hi]) => {
    const b = m.filter((r) => firsts(r).married! >= lo && firsts(r).married! <= hi);
    return `${pct(share(b.map((r) => firsts(r).child !== null)))} (n=${b.length}, 분포 ${pct(b.length / (m.length || 1), 0)})`;
  });
  console.log(`| ${gLabel(g)} | ${m.length} | ${cells.join(' | ')} |`);
}
console.log('\n## 5-2 이중 진실 — 주거 own인데 own_home 플래그가 한 번도 켜지지 않은 판 (H5)');
console.log('| 선택자 · 시대 | 주거 own을 한 번이라도 한 판 | 그중 own_home 플래그 없음 | 전체 판 중 플래그 없는 자가 | 그중 middle-home-loan을 만난 판 | 만난 판 중 move 선택 |');
console.log('|---|---:|---:|---:|---:|---:|');
for (const g of groups) {
  const ownD = g.recs.filter((r) => firsts(r).homeDwelling !== null);
  const noFlag = ownD.filter((r) => firsts(r).homeFlag === null);
  const metMid = noFlag.filter((r) => 'middle-home-loan' in r.finalSeen);
  const moved = metMid.filter((r) => r.pickLog.some((p) => p.eventId === 'middle-home-loan' && p.choiceId === 'move'));
  console.log(`| ${gLabel(g)} | ${ownD.length} | ${noFlag.length} (${pct(noFlag.length / (ownD.length || 1))}) | ${pct(noFlag.length / g.recs.length)} | ${metMid.length} | ${moved.length} |`);
}
console.log('\n## 5-3 내 집이 처음 켜진 경로 (내 집을 가진 판 중 비율; 합친 정의)');
const paths = groups.map((g) => countBy(g.recs.map((r) => homePathOf(r)).filter((x): x is string => x !== null), (x) => x));
const allPaths = [...new Set(paths.flatMap((p) => [...p.keys()]))].sort((a, b) => Math.max(...paths.map((p) => p.get(b) ?? 0)) - Math.max(...paths.map((p) => p.get(a) ?? 0)));
console.log(`| 경로 | ${groups.map(gLabel).join(' | ')} |`);
console.log(`|---|${groups.map(() => '---:').join('|')}|`);
for (const k of allPaths) console.log(`| ${k} | ${paths.map((p) => `${p.get(k) ?? 0} (${pct((p.get(k) ?? 0) / (Array.from(p.values()).reduce((a, b) => a + b, 0) || 1), 0)})`).join(' | ')} |`);
console.log(`| (내 집을 가진 판 합계 / 전체) | ${paths.map((p, i) => `${Array.from(p.values()).reduce((a, b) => a + b, 0)} / ${groups[i].recs.length}`).join(' | ')} |`);

console.log('\n## 5-4 결혼 때 youth-housing을 아직 못 본 판 (결혼하면 닫힌다) — 결혼한 판(45세 이상) 중');
console.log('| 선택자 · 시대 | 결혼한 판 | 결혼 때 내 집 없음 | 그중 youth-housing을 이미 본 판 | 그중 못 본 판(경로 잃음) | 못 본 판의 내 집 도달 | 본 판의 내 집 도달 |');
console.log('|---|---:|---:|---:|---:|---:|---:|');
for (const g of groups) {
  const m = alive(g.recs, 45).filter((r) => firsts(r).married !== null);
  const noHome = m.filter((r) => (firsts(r).home ?? 999) > firsts(r).married!);
  const seenHousing = noHome.filter((r) => 'youth-housing' in r.finalSeen && r.finalSeen['youth-housing'] <= firsts(r).married!);
  const lost = noHome.filter((r) => !seenHousing.includes(r));
  console.log(`| ${gLabel(g)} | ${m.length} | ${noHome.length} | ${seenHousing.length} | ${lost.length} | ${pct(share(lost.map((r) => firsts(r).home !== null)))} | ${pct(share(seenHousing.map((r) => firsts(r).home !== null)))} |`);
}

// ---------- 6) H3: 노출 병목 ----------
console.log('\n# 6) H3 — 사슬 이벤트 노출 (전체 판 기준; 열림 = 그 이벤트가 나온 판의 비율, 정석 선택 = 열린 판 중 정석 쪽 선택지를 고른 비율)');
console.log(`| 문 | 이벤트 | ${groups.map(gLabel).join(' | ')} |`);
console.log(`|---|---|${groups.map(() => '---:').join('|')}|`);
for (const ev of CHAIN_EVENTS) {
  const cells = groups.map((g) => {
    const out = g.recs.map((r) => chainOutcome(r, ev));
    const seen = out.filter((o) => o.seen);
    return `${pct(seen.length / g.recs.length, 0)} / ${pct(share(seen.map((o) => o.yes)), 0)}`;
  });
  console.log(`| ${ev.door} | ${ev.id} | ${cells.join(' | ')} |`);
}
console.log('(칸 = 열림 / 정석 선택)');
console.log('\n## 6-2 파트너 문(미팅·소개·고백·사내연애·재회·다시 만남)을 하나도 못 본 판 — 38세 이상 산 판 기준');
console.log('| 선택자 · 시대 | 38세 이상 산 판 | 파트너 문을 하나라도 만난 판 | 못 만난 판 | 문마다 평균 몇 개 만났나 |');
console.log('|---|---:|---:|---:|---:|');
const DOORS = CHAIN_EVENTS.filter((e) => e.door === '파트너');
for (const g of groups) {
  const rs = alive(g.recs, 38);
  const nSeen = rs.map((r) => DOORS.filter((d) => d.id in r.finalSeen).length);
  console.log(`| ${gLabel(g)} | ${rs.length} | ${pct(share(nSeen.map((x) => x > 0)))} | ${pct(share(nSeen.map((x) => x === 0)))} | ${fx(mean(nSeen), 2)} |`);
}

// ---------- 7) H7: 외모 ----------
console.log('\n# 7) H7 — 외모 구간별 파트너(has_partner 또는 married) 도달 (38세 이상 산 판)');
console.log('| 선택자 · 시대 | 낮음(≤30) | 보통(31~69) | 높음(≥70) |');
console.log('|---|---:|---:|---:|');
for (const g of groups) {
  const rs = alive(g.recs, 38);
  const band = (f: (r: L0Record) => boolean) => {
    const b = rs.filter(f);
    return `${pct(share(b.map((r) => firsts(r).partner !== null)))} (n=${b.length})`;
  };
  console.log(`| ${gLabel(g)} | ${band((r) => r.looks <= 30)} | ${band((r) => r.looks > 30 && r.looks < 70)} | ${band((r) => r.looks >= 70)} |`);
}

// ---------- 8) P4: 수저(부모 재력)별 격차 — 보존 기준 ----------
console.log('\n# 8) P4 — 수저(부모 재력 1~5단계)별 값. 보정 전후로 격차의 방향·크기를 지키는지 볼 기준 (50세 이상 산 판)');
for (const g of groups) {
  console.log(`\n## ${gLabel(g)}`);
  console.log('| 재력 단계 | 판 수 | ever_married(50) | ever_child(50) | ever_home(50) | at_own 주거(50) | at_employed(50) | college |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (let t = 1; t <= 5; t++) {
    const rs = alive(g.recs, 50).filter((r) => r.parentWealth === t);
    const all = g.recs.filter((r) => r.parentWealth === t);
    console.log(
      `| ${t} | ${rs.length} | ${pct(share(rs.map((r) => (firsts(r).married ?? 999) <= 50)))} | ${pct(share(rs.map((r) => (firsts(r).child ?? 999) <= 50)))} | ${pct(share(rs.map((r) => (firsts(r).home ?? 999) <= 50)))} | ${pct(share(rs.map((r) => pointAt(r, 50)!.ownDwelling)))} | ${pct(share(rs.map((r) => pointAt(r, 50)!.employed)))} | ${pct(share(all.map((r) => firsts(r).college !== null)))} (전체 ${all.length}) |`,
    );
  }
}

// ---------- 9) 기타: 진학 ----------
console.log('\n# 9) R05 — 대학 진학 플래그(college = school-exam의 지원·재수 선택) (20세 이상 산 판). 구조 상한 = school-exam이 열린 판의 비율(열린 판이 전부 지원·재수를 고르면 college가 켜진다). 「본인이 고른」 열은 pickLog 기준이라 부모님이 정한·흘러간 카드는 빠진다');
console.log('| 선택자 · 시대 | 20세 이상 산 판 | school-exam이 열린 판(구조 상한) | 열린 판 중 college | 본인이 지원 고른 판 | 본인이 재수 | 본인이 일 먼저 | college 켜진 판(전체 대비) |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|');
for (const g of groups) {
  const rs = alive(g.recs, 20);
  const seen = rs.filter((r) => 'school-exam' in r.finalSeen);
  const pick = (id: string) => share(seen.map((r) => r.pickLog.some((p) => p.eventId === 'school-exam' && p.choiceId === id)));
  console.log(
    `| ${gLabel(g)} | ${rs.length} | ${pct(seen.length / rs.length)} | ${pct(share(seen.map((r) => firsts(r).college !== null)))} | ${pct(pick('apply'))} | ${pct(pick('retry'))} | ${pct(pick('work'))} | ${pct(share(rs.map((r) => firsts(r).college !== null)))} |`,
  );
}

// ---------- 10) 5세 연령대 평균 (공식 통계의 연령대 칸과 같은 모양으로 비교하려고) ----------
// 한 연령대(예: 30~34세) 안의 다섯 나이 값의 단순 평균이다. 각 나이는 그 나이까지 산 판만 분모로 센다(M4). 통계의 연령대 칸은 그 안의 사람들을 합친 값이라 이 평균이 가장 가깝다.
const BAND_STARTS = [20, 25, 30, 35, 40, 45, 50, 55, 60];
console.log('\n# 10) 5세 연령대 평균 — 연령대 안 다섯 나이의 평균 (예: 30~34 = 30·31·32·33·34세 값의 평균)');
const bandTable = (title: string, f: (r: L0Record, a: number) => boolean, conditional?: (r: L0Record, a: number) => boolean) => {
  console.log(`\n## ${title}`);
  console.log(`| 선택자 · 시대 | ${BAND_STARTS.map((s) => `${s}~${s + 4}`).join(' | ')} |`);
  console.log(`|---|${BAND_STARTS.map(() => '---:').join('|')}|`);
  for (const g of groups) {
    const cells = BAND_STARTS.map((s) => {
      const vals: number[] = [];
      for (let a = s; a <= s + 4; a++) {
        let pool = alive(g.recs, a);
        if (conditional) pool = pool.filter((r) => conditional(r, a));
        vals.push(share(pool.map((r) => f(r, a))));
      }
      return pct(mean(vals));
    });
    console.log(`| ${gLabel(g)} | ${cells.join(' | ')} |`);
  }
};
bandTable('10-1 미혼 비율 = 1 − ever_married (R01·DC20 대응)', (r, a) => (firsts(r).married ?? 999) > a);
bandTable('10-2 자녀 없음 비율 (결혼 경험이 있는 판 중, R03·DC22 「기혼여성 출생자녀 0명」 대응)', (r, a) => (firsts(r).child ?? 999) > a, (r, a) => (firsts(r).married ?? 999) <= a);
bandTable('10-3 자가 비율 — 주거 own (R04·DC23 대응, 가구주 연령대별 자가점유율)', (r, a) => pointAt(r, a)!.ownDwelling);
bandTable('10-4 취업 비율 — has_career 또는 own_business (R06·DC25 고용률 대응)', (r, a) => pointAt(r, a)!.employed);
bandTable('10-5 자영 비율 — own_business (취업 중, R11·DC25 대응: 통계는 자영업자 / 취업자)', (r, a) => pointAt(r, a)!.business, (r, a) => pointAt(r, a)!.employed);
