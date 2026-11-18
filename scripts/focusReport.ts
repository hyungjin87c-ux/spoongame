import { FOCUS_K, FOCUS_MODEL, FOCUS_SECTIONS, FOCUS_TOPICS } from '../src/data/focusTable';
import type { ProfileId } from '../src/core';
import { ARM_NAMES, cardRows, dominanceRows, exposureCells, harmRows, maxPickWeight, offInvariant, runArms, timeRows } from './focusReportLib';

/**
 * 올해의 초점 보고 출력 (SPEC-018 PL10, 설계 2-5절 ①~⑧ · 7절) — `report:persona --only=focus` · `report:time --only=focus`가 부른다.
 * **판정이 아니라 보고**다: 기준(▲)에 못 미치는 칸은 「미달」로 적을 뿐 곱을 비틀지 않는다(M2·M5는 측정 뒤 마스터가 정한다).
 */
const f = (x: number, d = 2): string => (Number.isFinite(x) ? x.toFixed(d) : '-');
const pct = (x: number, d = 1): string => (x * 100).toFixed(d);
const armName = (a: number | null): string => (a === null ? '없음' : ARM_NAMES[a]);
const SECTION_LABEL = ['13~19', '20~39', '40~64', '65+'];

export function printFocusPersona(eras: readonly ProfileId[], n: number): void {
  console.log(`# 올해의 초점 측정 (report:persona --only=focus) — 팔 7(없음 + 주제 6) × ${n}판 · 시드 i×7919+13 · 자동 성향 선택 · K=${FOCUS_K}\n`);
  for (const era of eras) {
    console.log(`## 시대 ${era}\n`);
    const arms = runArms(era, n, 'auto');

    const cells = exposureCells(arms);
    console.log('### ① 구간×주제 노출 비 (목록에 주제가 있는 판만 · 초점 없음 팔의 같은 시드 판 대비) · ③ 목록-노출 어긋남\n');
    console.log(`| 구간 | 주제 | 판 | 노출 평균(초점) | 노출 평균(없음) | 비 [95% 구간] | 몫 s(없음 팔 카드 중) | 판정(비 ≥ ${FOCUS_MODEL.exposureMin}, s < ${FOCUS_MODEL.exposureBigShare}) | ③ 어긋남 % (≤ 10) |`);
    console.log('|---|---|---:|---:|---:|---|---:|---|---:|');
    for (const c of cells) {
      const big = c.share >= FOCUS_MODEL.exposureBigShare;
      const verdict = c.ratio >= FOCUS_MODEL.exposureMin ? '통과' : big ? '몫이 큰 주제(보고)' : '**미달**';
      console.log(`| ${SECTION_LABEL[c.section]} | ${ARM_NAMES[c.topic]} | ${c.games} | ${f(c.armMean)} | ${f(c.noneMean)} | ${f(c.ratio)} [${f(c.ratioLo)}, ${f(c.ratioHi)}] | ${f(c.share)} | ${verdict} | ${pct(c.mismatch)}${c.mismatch > 0.1 ? ' **초과**' : ''} |`);
    }

    console.log('\n### ② 구간별 보이는 초점 — `scripts/focusCount.ts`가 센다 (출생 연도별 목록은 `npm exec -- vite-node scripts/focusCount.ts`)\n');

    console.log(`### ④ 판당 카드 수 (결정 = 본인 + 부모·흘러감, 서술) — 초점 없음과의 차 ≤ ${FOCUS_MODEL.cardDiffMax}장\n`);
    console.log('| 팔 | 결정 | 서술 | 합 | Δ결정 | Δ서술 | Δ합 | 판정 |');
    console.log('|---|---:|---:|---:|---:|---:|---:|---|');
    for (const r of cardRows(arms)) {
      const bad = r.arm !== null && (Math.abs(r.dChoice) > FOCUS_MODEL.cardDiffMax || Math.abs(r.dNarrative) > FOCUS_MODEL.cardDiffMax || Math.abs(r.dTotal) > FOCUS_MODEL.cardDiffMax);
      console.log(`| ${armName(r.arm)} | ${f(r.choice)} | ${f(r.narrative)} | ${f(r.total)} | ${f(r.dChoice, 3)} | ${f(r.dNarrative, 3)} | ${f(r.dTotal, 3)} | ${r.arm === null ? '(기준)' : bad ? '**미달**' : '통과'} |`);
    }

    const dom = dominanceRows(arms);
    console.log(`\n### ⑤ 20세 스탯 지배 — (a) 3스탯 이상 최고 (b) 합 +${FOCUS_MODEL.dominanceSumDiff} 이상 (c) 차이 > SE의 ${FOCUS_MODEL.dominanceSEMul}배; 7팔 합 폭 ${f(dom.sumBand)} (경보 > ${FOCUS_MODEL.dominanceSumBand})\n`);
    console.log('| 팔 | 지식 | 건강 | 행복 | 관계 | 합 ± SE | 최고 스탯 수 | 합 − 7팔 평균 | 지배 |');
    console.log('|---|---:|---:|---:|---:|---|---:|---:|---|');
    for (const r of dom.rows) console.log(`| ${armName(r.arm)} | ${f(r.stats.education)} | ${f(r.stats.health)} | ${f(r.stats.happiness)} | ${f(r.stats.relationships)} | ${f(r.sum)} ± ${f(r.sumSe)} | ${r.best} | ${f(r.diffFromMean)} | ${r.dominant ? '**지배**' : '아니오'} |`);

    const mp = maxPickWeight();
    console.log(`\n### ⑥ 최대 합성 추첨 가중 (표지 대상 전부, × 자기 영역 ${2} × 초점 ${FOCUS_MODEL.focusKMax}) — 최댓값 ${f(mp.max, 0)} (${mp.id}) · 상한 ${FOCUS_MODEL.pickWeightMax} 초과 사건 ${mp.over}개\n`);

    const inv = offInvariant(era, Math.min(n, 300), 'auto');
    console.log(`### ⑦ 초점 없음 불변 — 초점 없음 팔 ≡ 「스위치 끔 + 초점을 고르려 함」 (같은 시드 ${inv.n}판 중 ${inv.same}판 같음). 변경 전 코드와의 바이트 동일은 골든 \`tests/focusRng.test.ts\`·\`tests/focusRngOff.test.ts\`가 증명한다.\n`);

    console.log('### ⑧ 고른 주제의 손해 — 팔의 주제 값이 초점 없음 팔보다 낮아지는가 (평균 차 ± SE, 낮고 SE의 2배 초과면 보고)\n');
    console.log('| 팔 | 지표 | 평균 차 | SE | 손해 |');
    console.log('|---|---|---:|---:|---|');
    for (const r of harmRows(arms)) console.log(`| ${ARM_NAMES[r.arm]} | ${r.label} | ${f(r.diff, 2)} | ${f(r.diffSe, 2)} | ${r.harmed ? '**손해**' : '아니오'} |`);
    console.log('');
  }
  console.log(`(구간 시작 나이 ${FOCUS_SECTIONS.join('·')}, 주제 ${FOCUS_TOPICS.join('·')})`);
}

export function printFocusTime(eras: readonly ProfileId[], n: number): void {
  console.log(`\n### 올해의 초점 판 길이 (설계 7절) — 팔 7 × ${n}판 · 시드 무작위 선택(report:time 기본) · 1배속 중앙 읽기 모델(분) · 기준 ±${FOCUS_MODEL.timeDiffMax}분\n`);
  console.log('| 시대 | 팔 | 평균(분) | 95% 분위(분) | Δ평균(분) | 판정 |');
  console.log('|---|---|---:|---:|---:|---|');
  for (const era of eras) {
    const arms = runArms(era, n, 'random');
    for (const r of timeRows(arms)) console.log(`| ${era} | ${armName(r.arm)} | ${f(r.mean)} | ${f(r.p95)} | ${f(r.dMean, 3)} | ${r.arm === null ? '(기준)' : Math.abs(r.dMean) > FOCUS_MODEL.timeDiffMax ? '**미달**' : '통과'} |`);
  }
}
