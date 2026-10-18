import { ERAS, type Era } from '../src/core';
import { BANDS, CONDITION_TOLERANCE, KNOWN_GAPS, KNOWN_GUARD_GAPS, autoGuardsOf, deathNetMedians, judgeConditions, measureEconomy, movementShares, statsOfBand, type EconomyReport } from './economyCheckLib';

/**
 * 경제 모델 밸런스 점검 (SPEC-003 EC7, docs/data/economy-model.md 9절).  실행: npm run check:economy
 *
 * 시대 3 × 6000판(무작위 선택 = 수동 플레이 흉내) + 자동 모드 시대 3 × 2000판을 돌려
 *  ① 연령대별 순자산·부채·소득 표(4-5절 형식)  ② 지금 세상 목표 19개와 허용 폭 판정  ③ 설계 가드(G3·M-2·M-4)와 엔딩 가드(사망 시점 순자산 — 15-4절)  ④ 지난·다가올 세상의 40대 순자산 비율
 *  ⑤ 자동 모드 가드(40대 순자산이 수동의 1.5배 이하, 엔딩 「앞섬」 45% 이하)
 * 를 출력한다. 판정이 하나라도 어긋나면 종료 코드 1 — 단 허용 폭 밖으로 **보고한** 항목(economyCheckLib.ts#KNOWN_GAPS·KNOWN_GUARD_GAPS, 문서 9-4절)은 그 한계 안에서 어긋나 있는 동안 「알려진 차이」로 적고 불합격으로 세지 않는다.
 * 60세·65세 이상 비교는 통계와 같은 정의(그 나이 이상 전체, D21)이고, 60~64세·65~79세 표는 연령대별 표에 참고로 남는다.
 * 옵션: `--plays N`(무작위 판 수, 기본 6000) `--auto N`(자동 모드 판 수, 기본 2000).
 */

function argNumber(name: string, fallback: number): number {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? Number(process.argv[i + 1]) : fallback;
}

const PLAYS = argNumber('--plays', 6000);
const AUTO_PLAYS = argNumber('--auto', 2000);

const f0 = (x: number): string => (Number.isFinite(x) ? Math.round(x).toLocaleString('en-US') : '-');
const f1 = (x: number): string => (Number.isFinite(x) ? x.toFixed(1) : '-');

function printBandTable(era: Era, rep: EconomyReport): void {
  console.log(`\n### ${era} — ${rep.strategy} ${rep.plays}판 (연령대별, 만 원)`);
  console.log('| 연령 | 줄 수 | 순자산 중앙값 | 평균 | p10 | p90 | 부채 보유(%) | 부채 중앙값(보유자) | 순자산<0(%) | 소득 중앙값 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const b of BANDS) {
    const s = statsOfBand(rep.rows[era], b);
    console.log(`| ${b.label} | ${s.n} | ${f0(s.netMedian)} | ${f0(s.netMean)} | ${f0(s.netP10)} | ${f0(s.netP90)} | ${f1(s.debtShare)} | ${f0(s.debtMedianOfHolders)} | ${f1(s.netNegativeShare)} | ${f0(s.incomeMedian)} |`);
  }
}

function printWealthTable(era: Era, rep: EconomyReport): void {
  console.log(`\n### ${era} — 부모 재력 단계별 순자산 중앙값 (만 원)`);
  console.log('| 단계 | 20~29 | 30~39 | 40~49 | 50~59 | 60~64 | 65~79 | 80 이상 |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const w of [1, 2, 3, 4, 5] as const) {
    const rows = rep.rows[era].filter((r) => r.parentWealth === w);
    console.log(`| ${w} | ${BANDS.map((b) => f0(statsOfBand(rows, b).netMedian)).join(' | ')} |`);
  }
}

let failures = 0;
let knownGuardCount = 0;
const fail = (msg: string): void => {
  failures++;
  console.log(`  불합격: ${msg}`);
};

console.log(`# 경제 모델 밸런스 점검 (EC7): 무작위 선택 ${PLAYS}판 × 3시대`);
const random = measureEconomy(PLAYS, 'random');
for (const era of ERAS) {
  printBandTable(era, random);
  printWealthTable(era, random);
}

console.log('\n## 지금 세상 목표와 허용 폭');
console.log('| 지표 | 모델 | 목표 | 허용 범위 | 판정 | 근거 |');
console.log('|---|---|---|---|---|---|');
for (const r of random.targets) {
  const t = r.target;
  const gap = KNOWN_GAPS[t.id];
  const known = !r.ok && gap !== undefined && gap.limit(r.value);
  console.log(`| ${t.label} | ${f1(r.value)} | ${t.target} | ${f1(r.lo)} ~ ${f1(r.hi)} | ${r.ok ? '통과' : known ? '알려진 차이(보고함)' : '불합격'} | ${t.basis} |`);
  if (known) console.log(`  알려진 차이: ${gap.why}`);
  else if (!r.ok) fail(`${t.label} ${f1(r.value)} (허용 ${f1(r.lo)} ~ ${f1(r.hi)})`);
}

// 사망 시점 순자산(엔딩이 읽는 값) 분포: 재력 단계별 중앙값·음수 비율과 엔딩 방향 (15-4절)
for (const era of ERAS) {
  const lives = random.lives[era].filter((l) => l.reached);
  console.log(`\n### ${era} — 사망 시점 순자산 (스무 살 넘어 마친 ${lives.length}판, 만 원)`);
  console.log('| 재력 | 판 수 | 중앙값 | p10 | p90 | 순자산<0(%) | 앞섬(%) | 비슷함(%) | 뒤쪽(%) |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  const med = deathNetMedians(random.lives[era]);
  for (const w of [1, 2, 3, 4, 5] as const) {
    const l = lives.filter((x) => x.parentWealth === w);
    const nets = l.map((x) => x.net).sort((p, q) => p - q);
    const at = (p: number): number => (nets.length === 0 ? NaN : nets[Math.round((p / 100) * (nets.length - 1))]);
    const m = movementShares(l);
    console.log(`| ${w} | ${l.length} | ${f0(med[w - 1])} | ${f0(at(10))} | ${f0(at(90))} | ${f1((l.filter((x) => x.net < 0).length * 100) / l.length)} | ${f1(m.up)} | ${f1(m.same)} | ${f1(m.down)} |`);
  }
  const all = movementShares(lives);
  console.log(`| 전체 | ${lives.length} | ${f0(lives.map((x) => x.net).sort((p, q) => p - q)[lives.length >> 1])} | | | ${f1((lives.filter((x) => x.net < 0).length * 100) / lives.length)} | ${f1(all.up)} | ${f1(all.same)} | ${f1(all.down)} |`);
}

console.log('\n## 설계 가드');
for (const era of ERAS) {
  for (const g of random.guards[era]) {
    // G3는 세 시대 모두 본다(지난·다가올 세상도 방향은 같아야 한다). M-2는 지금 세상만 판정하고(통계가 지금 세상 것), M-4는 다가올 세상에만 있다.
    const gap = KNOWN_GUARD_GAPS[`${era}:${g.id}`];
    const known = !g.ok && g.reference !== true && gap !== undefined && gap.limit(g.metric);
    console.log(`- [${era}] ${g.label}: ${g.value} — ${g.ok ? '통과' : g.reference === true ? '어긋남(참고, 판정 아님)' : known ? '알려진 차이(보고함)' : '불합격'}`);
    if (known) console.log(`  알려진 차이: ${gap.why}`);
    else if (!g.ok && g.reference !== true) fail(`[${era}] ${g.label}: ${g.value}`);
    if (known) knownGuardCount++;
  }
}

console.log('\n## 지난·다가올 세상의 40대 순자산 중앙값 (지금 세상 대비)');
for (const r of random.ratios) {
  console.log(`- ${r.era}: ${r.ratio.toFixed(2)}배 (목표 ${r.lo}~${r.hi}배) — ${r.ok ? '통과' : '불합격'}`);
  if (!r.ok) fail(`${r.era} 40대 순자산 비율 ${r.ratio.toFixed(2)}배 (목표 ${r.lo}~${r.hi}배)`);
}

// 옛 재산 조건 7곳의 「같은 통과율」(R-354, 문서 5-A): 지금 모델에서 같은 나이의 통과율이 옛 통과율의 ±15% 안이어야 한다
console.log('\n## 조건 변환 7곳의 통과율 (지금 세상, R-354 — 옛 재산 조건의 통과율과 같아야 한다)');
console.log(`| 위치 | 나이 | 조건(순자산, 만 원) | 옛 통과율 | 지금 통과율 | 허용 범위(±${CONDITION_TOLERANCE * 100}%) | 판정 |`);
console.log('|---|---|---|---|---|---|---|');
for (const r of judgeConditions(random.rows.present)) {
  const c = r.check.condition;
  const cond = [c.netMin !== undefined ? `≥ ${f0(c.netMin)}` : '', c.netMax !== undefined ? `≤ ${f0(c.netMax)}` : ''].filter(Boolean).join(' ');
  console.log(`| ${r.check.where} | ${r.check.age}세 | ${cond} | ${r.check.oldRate}% | ${f1(r.rate)}% | ${f1(r.lo)} ~ ${f1(r.hi)}% | ${r.check.accepted !== undefined ? '수용(문구 우선)' : r.known ? '알려진 차이(보고함)' : r.ok ? '통과' : '불합격'} |`);
  if (r.check.accepted !== undefined) console.log(`  수용: ${r.check.accepted}`);
  else if (r.known) console.log(`  알려진 차이: ${r.check.reported!.why}`);
  else if (!r.ok) fail(`조건 ${r.check.where} ${r.check.age}세 통과율 ${f1(r.rate)}% (옛 ${r.check.oldRate}%, 허용 ${f1(r.lo)} ~ ${f1(r.hi)}%)`);
}

if (AUTO_PLAYS > 0) {
  console.log(`\n# 자동 모드 ${AUTO_PLAYS}판 × 3시대 (참고 — 판정하지 않는다)`);
  const auto = measureEconomy(AUTO_PLAYS, 'auto');
  for (const era of ERAS) printBandTable(era, auto);
  for (const era of ERAS) for (const g of auto.guards[era]) console.log(`- [${era}] ${g.label}: ${g.value} — ${g.ok ? '통과' : '어긋남(참고)'}`);
  for (const r of auto.ratios) console.log(`- ${r.era} 40대 비율: ${r.ratio.toFixed(2)}배`);
  console.log('\n## 자동 모드 가드 (15-4절, EC6 우선)');
  for (const era of ERAS) {
    for (const g of autoGuardsOf({ rows: random.rows[era], lives: random.lives[era] }, { rows: auto.rows[era], lives: auto.lives[era] })) {
      console.log(`- [${era}] ${g.label}: ${g.value} — ${g.ok ? '통과' : '불합격'}`);
      if (!g.ok) fail(`[${era}] ${g.label}: ${g.value}`);
    }
  }
}

const knownCount = random.targets.filter((r) => !r.ok && KNOWN_GAPS[r.target.id]?.limit(r.value) === true).length;
console.log(`\n${failures === 0 ? `통과했다${knownCount + knownGuardCount > 0 ? ` (허용 폭 밖으로 보고한 「알려진 차이」 목표 ${knownCount}건·가드 ${knownGuardCount}건 — 문서 9-4절)` : ''}.` : `불합격 ${failures}건 — 위 목록을 문서 9절·로그에 옮겨 적는다.`}`);
process.exit(failures === 0 ? 0 : 1);
