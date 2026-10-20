import { ERAS, type Era, type ParentWealth } from '../src/core';
import { PARENTING_LABEL } from '../src/data/birthText';
import { SELF_AREA_WEIGHT } from '../src/data/parentDecisionTable';
import { MONOTONE_CARDS, OFFICIAL, cardCounts, careRows, dominanceCells, familyPriorityAccept, monotoneRows, parentalLeaveShare, parentingGap, privateEducationRows, sampleYoung, sampleYoungByTier, type YoungLife } from './parentReportLib';
import type { Strategy } from './simulateLib';

/**
 * 어린 시절 부모님 결정 보고 (SPEC-005 PD12·PD13, 설계 문서 docs/data/parent-decision-model.md 5절 T5): **판정이 아니라 보고**다 — 손계산 칸(설계 문서 1-6·2-7·2-10절)을 실측으로 대체하고
 * `selfBefore19`(13~18세·19세까지 본인 카드 수와 0장 비율, PD13)를 낸다. 단언은 tests/parentDecisionSim.test.ts가 한다.
 * 실행: npm run report:parent [-- 판수=1000] [--tier=300] [--strategy=random|auto] [--only=counts,monotone,parenting,dominance,calibration,family,care]
 *   counts      시대별 판당 부모·흘러감·본인 카드 수, 13~18세 본인 카드 분포와 0장 비율(selfBefore19)
 *   monotone    카드별 수저 단조 표(비용 합 확률, 단계별 판 N개씩)
 *   parenting   양육 방식 방향(엄격·헬리콥터 대 자유·방임)
 *   dominance   (카드 × 수저 × 양육) 칸의 한 선택지 최대 확률 — 부모·흘러감
 *   calibration 통계 보정 판정 2곳(사교육 소득별 · 육아휴직 어머니 72.2%) + 학업 중단(family-priority) 보고
 *   care        돌봄 선택지(fever.dismiss · after-hours.alone · stories.alone · screen.free · noise.hush) 수저별·양육 방식별 선택 확률 — 낙인 점검(R-454, 설계 문서 6-3절)
 * 20세가 되기 전까지만 돌린다(한 판 0.5ms쯤). 시드 i × 7919 + 13.
 */
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const positional = args.find((a) => !a.startsWith('--'));
const lives = Number(positional ?? 1000);
const perTier = Number(flag('tier') ?? 300);
const strategy = (flag('strategy') ?? 'random') as Strategy;
const only = new Set((flag('only') ?? 'counts,monotone,parenting,dominance,calibration,family,care').split(','));
if (!Number.isInteger(lives) || lives < 1 || !Number.isInteger(perTier) || perTier < 1 || !['random', 'auto'].includes(strategy)) {
  console.error('사용법: npm run report:parent [-- 판수(1 이상 정수) --tier=단계당 판수 --strategy=random|auto --only=counts,monotone,parenting,dominance,calibration,family,care]');
  process.exit(2);
}

const f = (n: number | null, d = 1): string => (n === null ? '-' : n.toFixed(d));
const pct = (n: number | null, d = 1): string => (n === null ? '-' : (n * 100).toFixed(d));
const ERA_LABEL: Record<Era, string> = { past: '지난', present: '지금', future: '다가올' };

console.log(`# 부모님 결정 보고 (PD12·PD13) — 20세 전까지 · 시드 i×7919+13 · 전략 ${strategy} · 판수 ${lives} · 단계당 ${perTier}판`);

const natural: Record<Era, YoungLife[]> = { past: [], present: [], future: [] };
const tiered: Partial<Record<Era, Record<ParentWealth, YoungLife[]>>> = {};
if (only.has('counts') || only.has('parenting') || only.has('dominance')) for (const era of ERAS) natural[era] = sampleYoung(era, lives, strategy);
if (only.has('monotone') || only.has('calibration') || only.has('family') || only.has('dominance') || only.has('care')) for (const era of ERAS) tiered[era] = sampleYoungByTier(era, perTier, strategy);

if (only.has('counts')) {
  console.log('\n## 판당 카드 수 (자연 분포)');
  console.log('| 시대 | 부모 | 흘러감 | 합(사람이 안 고름) | 13~18세 본인 | 13~18세 0장 비율 | 19세까지 본인 | 19세까지 0장 | 13~18세 분포 0/1/2/3+ | 20세 전 사망 |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---|---:|');
  for (const era of ERAS) {
    const c = cardCounts(natural[era]);
    console.log(
      `| ${ERA_LABEL[era]} | ${f(c.parent, 2)} ± ${f(c.parentSE, 2)} | ${f(c.child, 2)} ± ${f(c.childSE, 2)} | ${f(c.parent + c.child, 2)} | ${f(c.self13to18, 2)} | **${pct(c.self13to18Zero)}%** | ${f(c.selfUpTo19, 2)} | ${pct(c.selfUpTo19Zero)}% | ${c.dist13to18.map((x) => pct(x, 0)).join(' / ')} | ${pct(c.diedYoung, 2)}% |`,
    );
  }
  const all = ERAS.flatMap((e) => natural[e]);
  const c = cardCounts(all);
  console.log(`| 세 시대 평균 | ${f(c.parent, 2)} | ${f(c.child, 2)} | ${f(c.parent + c.child, 2)} | ${f(c.self13to18, 2)} | **${pct(c.self13to18Zero)}%** | ${f(c.selfUpTo19, 2)} | ${pct(c.selfUpTo19Zero)}% | ${c.dist13to18.map((x) => pct(x, 0)).join(' / ')} | |`);
  const worst = Math.max(...ERAS.map((e) => cardCounts(natural[e]).self13to18Zero));
  console.log(`\nPD13: 13~18세 본인 카드 0장인 판 비율 최댓값 ${pct(worst)}% — 현재 13~18세 본인 영역 가중 ×${SELF_AREA_WEIGHT} — ${worst > 0.25 ? '25% 초과 (1000판 표본의 잡음 폭은 약 ±1.4%p — 3000판으로 다시 재고, 계속 넘으면 가중을 더 올릴지 마스터 결정 + EK 재측정)' : '25% 이하 → 그대로'}`);
  const bad = all.reduce((n, l) => n + l.pendingLeak + l.byMismatch, 0);
  console.log(`구조 점검: pending 누수 + by 표지 불일치 = ${bad} (0이어야 한다)`);
  console.log(`부모님이 정한 카드의 인용 박스 노출률(PD12 ⑪): ${ERAS.map((e) => `${ERA_LABEL[e]} ${pct(cardCounts(natural[e]).parentCiteShare)}%`).join(' · ')}`);
}

if (only.has('monotone')) {
  console.log('\n## 수저 단조 (비용 합 = 집안 살림 효과 ≤ −300인 선택지의 확률 합, 고르기 직전 확률의 평균 %)');
  for (const era of ERAS) {
    const rows = monotoneRows(era, tiered[era]!);
    console.log(`\n### ${ERA_LABEL[era]} 세상`);
    console.log('| 카드 | 1단계 | 2단계 | 3단계 | 4단계 | 5단계 | 비교(높 − 낮, %p) | 인접 최소 격차 |');
    console.log('|---|---:|---:|---:|---:|---:|---:|---:|');
    for (const r of rows) {
      console.log(`| ${r.id} | ${r.byTier.map((t) => `${pct(t.share)} (${t.n})`).join(' | ')} | ${f(r.gap)} (${r.low}→${r.high}) | ${f(r.minAdjacent)} |`);
    }
    const ok = rows.filter((r) => r.gap !== null && r.gap >= 10).length;
    const flipped = rows.filter((r) => r.gap !== null && r.gap <= -5).map((r) => r.id);
    console.log(`\n비교 가능 ${rows.filter((r) => r.gap !== null).length}장 중 ≥ +10%p ${ok}장 / 역전(≤ −5%p) ${flipped.length}장 ${flipped.join(', ')} / 인접 −8%p 이하 ${rows.filter((r) => r.minAdjacent !== null && r.minAdjacent <= -8).map((r) => r.id).join(', ') || '없음'}`);
  }
  console.log(`\n(비교 대상 ${MONOTONE_CARDS.length}장은 설계 문서 5절 T5-④ — 시대 제한이 있는 카드는 일어나는 시대에서만)`);
}

if (only.has('parenting')) {
  console.log('\n## 양육 방식 방향 (T5-⑤): 학력 효과가 가장 큰 선택지(최대 Δ학력 ≥ 3, 동률 제외)의 선택 확률 평균');
  console.log('| 시대 | 엄격·헬리콥터 | 자유·방임 | 차(%p) | 관측 | 카드 수 |');
  console.log('|---|---:|---:|---:|---:|---:|');
  for (const era of ERAS) {
    const g = parentingGap(natural[era]);
    console.log(`| ${ERA_LABEL[era]} | ${pct(g.front)}% | ${pct(g.back)}% | **${f(g.gap)}** | ${g.n} | ${g.cards} |`);
  }
}

if (only.has('dominance')) {
  console.log('\n## 지배 방지 (T5-⑥·⑩): (카드 × 수저 × 양육) 칸의 한 선택지 최대 평균 확률 (관측 ≥ 8인 칸)');
  for (const by of ['parent', 'child'] as const) {
    for (const era of ERAS) {
      const cells = dominanceCells(
        [...Object.values(tiered[era]!).flat(), ...natural[era]],
        8,
      ).filter((c) => c.by === by);
      const top = [...cells].sort((a, b) => b.maxShare - a.maxShare).slice(0, 3);
      console.log(`- ${by === 'parent' ? '부모' : '흘러감'} · ${ERA_LABEL[era]}: 칸 ${cells.length}개, 최대 ${top.map((c) => `${c.eventId}/${c.maxId} 수저${c.tier} ${PARENTING_LABEL[c.parenting] ?? c.parenting} ${pct(c.maxShare)}% (n=${c.n})`).join(' · ')}`);
    }
  }
}

if (only.has('calibration')) {
  console.log('\n## 통계 보정 판정 (지금 세상) — 차 ≤ 15%p');
  const present = tiered.present!;
  for (const r of privateEducationRows(present)) {
    console.log(`\n### 사교육 참여: ${r.label}`);
    console.log('| 단계 | 시뮬(%) | 공식(%) | 차(%p) | 카드 관측 |');
    console.log('|---|---:|---:|---:|---:|');
    r.byTier.forEach((t, i) => console.log(`| ${t.tier} | ${f(t.share)} | ${r.official[i]} | ${f(r.diffs[i])} | ${t.n} |`));
  }
  const leave = parentalLeaveShare(present);
  console.log(`\n### 육아휴직: one + share (수저 비율 가중) = ${f(leave.share)}% — 어머니 사용률 ${OFFICIAL.parentalLeaveMother}% ±${OFFICIAL.tolerancePp}%p → 차 ${f(Math.abs(leave.share - OFFICIAL.parentalLeaveMother))}%p`);
  console.log(`단계별: ${leave.byTier.map((t) => `${t.tier}단계 ${f(t.share)}% (n=${t.n})`).join(' · ')}`);
}

if (only.has('family')) {
  console.log('\n## 학업 중단(school-family-priority) accept 비율 — 보고(대역 5~35%▲, 재력 1단계 ≥ 3단계)');
  for (const era of ERAS) {
    const rows = familyPriorityAccept(tiered[era]!);
    console.log(`- ${ERA_LABEL[era]}: ${rows.map((r) => `${r.tier}단계 ${f(r.share)}% (n=${r.n})`).join(' · ')}`);
  }
}

if (only.has('care')) {
  console.log(`\n## 돌봄 선택지 낙인 점검 (R-454): 선택 확률 평균(%) — 수저 단계별 · 양육 방식별 (괄호 = 관측 수, 단계당 ${perTier}판)`);
  console.log('fever.dismiss의 1단계 − 5단계 격차는 측정 5.0~6.1%p이고 상한 8%p, 세 카드(after-hours.alone·noise.hush·stories.alone)는 25%p다(설계 문서 10-9, tests/parentDecisionSim.test.ts가 상한을 지킨다).');
  for (const era of ERAS) {
    const rows = careRows(tiered[era]!);
    console.log(`\n### ${ERA_LABEL[era]} 세상`);
    console.log('| 선택지 | 1단계 | 2단계 | 3단계 | 4단계 | 5단계 | 1단계 − 5단계(%p) | 방임 | 자유 | 헬리콥터 | 엄격 |');
    console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const r of rows) {
      const cell = (x: { share: number | null; n: number }): string => (x.share === null ? '-' : `${f(x.share)} (${x.n})`);
      console.log(`| ${r.name} | ${r.byTier.map(cell).join(' | ')} | ${r.gap1to5 === null ? '-' : f(r.gap1to5)} | ${r.byParenting.map(cell).join(' | ')} |`);
    }
  }
}
