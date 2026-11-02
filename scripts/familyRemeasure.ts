import '../src/data/installAll';
import { writeFileSync } from 'node:fs';
import { GENERATION_IDS, generateBirthFromSeed } from '../src/core';
import { spreadSeeds } from '../tests/helpers/familyGolden';
import {
  ADULT_PARENT_IDS,
  REPORT_NOTES,
  SENIOR_FLOOR,
  SENIOR_INDEPENDENT,
  SENIOR_WORLDS,
  VARIANTS,
  mean,
  meanSe,
  measureVariant,
  median,
  pairedDiff,
  seniorCards,
  seniorSamples,
  tierStats,
  type LifeRow,
  type Variant,
} from './familyRemeasureLib';

/**
 * 가족 변경(SPEC-009 FM4b)의 분포 재측정 보고 (설계 문서 12-1절 L2): `docs/data/family-remeasure.md`를 쓴다.
 * 실행: ./node_modules/.bin/vite-node scripts/familyRemeasure.ts [세대당 판수=600] [--write]
 *   (npm run report:family -- 600 --write)
 * 같은 시드·같은 자동 성향 선택으로 원인(K2 · K4 · 이른 부모 별세 효과 · K1)을 하나씩 켠 다섯 세계를 돌려 짝지어 견준다.
 * **이른 부모 별세 효과의 합격 기준은 설계 문서 4-7절 (1)** (마스터 결정 2026-11-02 — 처음의 「중앙값 변화 ≤ 3%」는 중앙값 한 칸(150만 원)이 15%로 읽히는 틀린 지표라 평균으로 바꿨다):
 *   ① 재력 단계별 최종 순자산 평균 변화 ≤ 3% · 20세 시작 평균의 절대 변화 ≤ 150만 원  ② 단계 순서 뒤바뀜 0  ③ 엔딩 방향 판정 분포 변화 ≤ 2%p  ④ 효과가 걸린 판 비율 보고.
 *   중앙값 변화·효과가 걸린 판만의 차이는 보고만 한다(판정에 쓰지 않는다).
 */
const argN = process.argv.slice(2).find((a) => /^\d+$/.test(a));
const PER_GEN = Number(argN ?? 600);
const WRITE = process.argv.includes('--write');

/** 이른 부모 별세 효과의 수용 기준 (4-7절 (1), 마스터 결정 2026-11-02) */
const NET20_MEAN_ABS_LIMIT = 150; // 20세 시작 순자산 평균의 절대 변화 (만 원)
const FINAL_MEAN_LIMIT = 3; // 최종 순자산 평균 변화 (%)
const MOVE_LIMIT = 2; // 엔딩 방향 판정 분포 변화 (%p)

const pct = (x: number, d = 1): string => `${x.toFixed(d)}%`;
const num = (x: number, d = 0): string => x.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (x: number, d = 0): string => `${x >= 0 ? '+' : ''}${num(x, d)}`;
/** 상대 변화(%): 분모는 |앞| 이되 최소 1,000만 원 — 값이 0에 가까운 낮은 단계에서 −150 → 0이 100%로 읽히지 않게 한다 */
const DENOM_FLOOR = 1000;
const rel = (a: number, b: number): number => ((b - a) / Math.max(Math.abs(a), DENOM_FLOOR)) * 100;
const TIERS = [1, 2, 3, 4, 5] as const;

const rowsOf = new Map<Variant['id'], LifeRow[]>();
for (const v of VARIANTS) {
  const t0 = Date.now();
  rowsOf.set(v.id, measureVariant(v, PER_GEN));
  console.error(`${v.id} ${v.label}: ${rowsOf.get(v.id)!.length}판 ${((Date.now() - t0) / 1000).toFixed(0)}초`);
}
const R = (id: Variant['id']): LifeRow[] => rowsOf.get(id)!;
const out: string[] = [];
const say = (s = ''): void => void out.push(s);

// ---------- 비교 표 ----------
interface Cmp {
  /** 20세 시작 평균의 절대 변화 (만 원) · 최종 평균 변화 (%) — 판정에 쓴다 */
  maxNet20MeanAbs: number;
  maxFinalMean: number;
  /** 중앙값 변화 (%) — 보고만 */
  maxNet20Median: number;
  maxFinalMedian: number;
  maxMovePp: number;
  /** 단계 순서 뒤바뀜 쌍 수 (평균·중앙값 모두 센다) */
  orderFlips: number;
}
function compare(from: LifeRow[], to: LifeRow[], title: string): Cmp {
  say(`#### ${title}`);
  say();
  say('| 재력 | 판 수 | 20세 시작 순자산 평균 (만 원) | 절대 변화 | 최종 순자산 평균 (만 원) | 변화 | 20세 시작 중앙값 (보고) | 변화 | 최종 중앙값 (보고) | 변화 | 앞섬 / 비슷함 / 뒤쪽 (%p 변화) |');
  say('|---:|---:|---|---:|---|---:|---|---:|---|---:|---|');
  let maxNet20MeanAbs = 0;
  let maxFinalMean = 0;
  let maxNet20Median = 0;
  let maxFinalMedian = 0;
  let maxMovePp = 0;
  const f = TIERS.map((t) => tierStats(from, t));
  const g = TIERS.map((t) => tierStats(to, t));
  TIERS.forEach((t, i) => {
    const a = f[i];
    const b = g[i];
    const d20Abs = b.meanNet20 - a.meanNet20;
    const dFMean = rel(a.meanFinalNet, b.meanFinalNet);
    const d20Med = rel(a.medianNet20, b.medianNet20);
    const dFMed = rel(a.medianFinalNet, b.medianFinalNet);
    maxNet20MeanAbs = Math.max(maxNet20MeanAbs, Math.abs(d20Abs));
    maxFinalMean = Math.max(maxFinalMean, Math.abs(dFMean));
    maxNet20Median = Math.max(maxNet20Median, Math.abs(d20Med));
    maxFinalMedian = Math.max(maxFinalMedian, Math.abs(dFMed));
    const share = (s: typeof a, k: 'up' | 'same' | 'down') => (100 * s.movement[k]) / Math.max(1, s.movement.up + s.movement.same + s.movement.down);
    const dm = (['up', 'same', 'down'] as const).map((k) => share(b, k) - share(a, k));
    maxMovePp = Math.max(maxMovePp, ...dm.map(Math.abs));
    say(
      `| ${t} | ${a.n} | ${num(a.meanNet20)} → ${num(b.meanNet20)} | ${signed(d20Abs)} | ${num(a.meanFinalNet)} → ${num(b.meanFinalNet)} | ${pct(dFMean, 2)} | ${num(a.medianNet20)} → ${num(b.medianNet20)} | ${pct(d20Med, 2)} | ${num(a.medianFinalNet)} → ${num(b.medianFinalNet)} | ${pct(dFMed, 2)} | ${dm.map((x) => `${x >= 0 ? '+' : ''}${x.toFixed(2)}`).join(' / ')} |`,
    );
  });
  // 단계 순서 뒤바뀜: 앞 세계에서 낮은 단계 값 ≤ 높은 단계 값이었는데 뒤 세계에서 뒤집힌 쌍 (평균·중앙값 모두)
  let flips = 0;
  for (let i = 0; i < TIERS.length; i++) {
    for (let j = i + 1; j < TIERS.length; j++) {
      for (const key of ['meanNet20', 'meanFinalNet', 'medianNet20', 'medianFinalNet'] as const) if (f[i][key] <= f[j][key] && g[i][key] > g[j][key]) flips++;
    }
  }
  say();
  say(
    `- 가장 큰 변화(판정): 20세 시작 평균 ${num(maxNet20MeanAbs)}만 원 · 최종 평균 ${pct(maxFinalMean, 2)} · 판정 ${maxMovePp.toFixed(2)}%p · 단계 순서 뒤바뀜 ${flips}쌍 / (보고만) 중앙값 20세 시작 ${pct(maxNet20Median, 2)} · 최종 ${pct(maxFinalMedian, 2)}`,
  );
  say();
  return { maxNet20MeanAbs, maxFinalMean, maxNet20Median, maxFinalMedian, maxMovePp, orderFlips: flips };
}

const passes = (c: Cmp): boolean => c.maxNet20MeanAbs <= NET20_MEAN_ABS_LIMIT && c.maxFinalMean <= FINAL_MEAN_LIMIT && c.orderFlips === 0 && c.maxMovePp <= MOVE_LIMIT;
const describe = (c: Cmp): string => `20세 시작 평균 ${num(c.maxNet20MeanAbs)}만 원 · 최종 평균 ${pct(c.maxFinalMean, 2)} · 판정 ${c.maxMovePp.toFixed(2)}%p · 뒤바뀜 ${c.orderFlips}쌍`;
const CRITERIA = `① 최종 순자산 평균 변화 ≤ ${FINAL_MEAN_LIMIT}% · 20세 시작 평균의 절대 변화 ≤ ${NET20_MEAN_ABS_LIMIT}만 원 ② 단계 순서 뒤바뀜 0 ③ 판정 변화 ≤ ${MOVE_LIMIT}%p (중앙값은 보고만)`;

say('# 가족 변경의 분포 재측정 (SPEC-009 FM4b)');
say();
say('- 생성: `npm run report:family -- ' + PER_GEN + ' --write` (scripts/familyRemeasure.ts) — **직접 고치지 않는다.** 설계 문서 `family-model.md` 12-1절 L2, 4-7절 (1) 합격 기준, 7-1절 K1.');
say(`- 표본: 7세대 × ${PER_GEN}판 = ${PER_GEN * 7}판을 변이마다 돌렸다(세대마다 다른 시드 열, 같은 시드·같은 자동 성향 선택 → 짝지은 표본). 변화 = (뒤 − 앞) ÷ max(|앞|, 1,000만 원). 판정은 엔딩 방향(앞섬·비슷함·뒤쪽)이고 20세 전에 끝난 판은 센다에서 뺐다.`);
say('- 세계: ' + VARIANTS.map((v) => `**${v.id}** ${v.label}`).join(' · '));
say();

say('## 1. 이른 부모 별세 효과 (V2 → V3) — 합격 기준 ①~④');
say();
say(`합격 기준(마스터 결정 2026-11-02): ${CRITERIA} ④ 효과가 걸린 판 비율은 보고.`);
say();
const earlyCmp = compare(R('V2'), R('V3'), '재력 단계별 (7세대 합친)');
{
  const rows = R('V3');
  say('**④ 효과가 걸린 판 비율**(19세 이하에 부모 한 분이 떠난 판):');
  say();
  say('| 세대 | 판 수 | 걸린 판 | 비율 |');
  say('|---|---:|---:|---:|');
  for (const gen of GENERATION_IDS) {
    const g = rows.filter((r) => r.gen === gen);
    const hit = g.filter((r) => r.earlyLoss).length;
    say(`| ${gen} | ${g.length} | ${hit} | ${pct((100 * hit) / g.length)} |`);
  }
  const hit = rows.filter((r) => r.earlyLoss).length;
  say(`| 전체 | ${rows.length} | ${hit} | ${pct((100 * hit) / rows.length)} |`);
  say();
  say('**효과가 걸린 판만 본 차이**(같은 시드의 V2와 짝지음, 보고만):');
  say();
  const v2 = new Map(R('V2').map((r) => [`${r.gen}/${r.seed}`, r]));
  const pairs = rows.filter((r) => r.earlyLoss).map((r) => [v2.get(`${r.gen}/${r.seed}`)!, r] as const);
  const d20 = pairs.filter(([a, b]) => a.net20 !== null && b.net20 !== null).map(([a, b]) => b.net20! - a.net20!);
  const dFin = pairs.filter(([a, b]) => a.finalNet !== null && b.finalNet !== null).map(([a, b]) => b.finalNet! - a.finalNet!);
  const earlyDeath = pairs.filter(([a, b]) => b.deathAge < a.deathAge).length;
  say(
    `- 판 ${pairs.length}개: 20세 시작 순자산 평균 ${num(mean(d20), 1)}만 원(중앙값 ${num(median(d20), 1)}) · 최종 순자산 평균 ${num(mean(dFin), 1)}만 원(중앙값 ${num(median(dFin), 1)}) · 사망 나이 평균 ${mean(pairs.map(([a, b]) => b.deathAge - a.deathAge)).toFixed(2)}세(효과 때문에 더 일찍 죽은 판 ${earlyDeath}개)`,
  );
  say();
}
say(`판정: ${passes(earlyCmp) ? '**합격**' : '**기준 초과**'} (${describe(earlyCmp)}) — ${CRITERIA}.`);
say();

say('#### 대안: 효과를 절반으로 줄이면 (V2 → V3h: 행복 −4 · 관계 −1 · 건강 −1, 집안 살림 아버지 −250 · 어머니 −150 · 집안일 −75)');
say();
const halfCmp = compare(R('V2'), R('V3h'), '재력 단계별 (7세대 합친)');
say(`- 대안 판정: ${passes(halfCmp) ? '합격' : '기준 초과'} (${describe(halfCmp)})`);
say();

say('## 2. K2 · K4 (사건 풀 변경, V0 → V1 → V2)');
say();
compare(R('V0'), R('V1'), 'K2: 동생 반응 카드를 구성이 정한 해에 강제 (V0 → V1)');
compare(R('V1'), R('V2'), 'K4: 가족 낱말 사건에 가족 조건 (V1 → V2)');
compare(R('V0'), R('V2'), 'K2 + K4 합계 (V0 → V2)');

say('## 3. K1 형제 수 새 정의 (V3 → V4, 켜지 않는다)');
say();
compare(R('V3'), R('V4'), '재력 단계별 (V3 배포 값 → V4 K1 켬)');
{
  const rows = R('V4');
  say('| 재력 | 판 수 | 형제 수 평균 (옛 → 새 정의) | 상속액 평균 (만 원, 옛 → 새) | 변화 |');
  say('|---:|---:|---|---|---:|');
  for (const t of TIERS) {
    const g = rows.filter((r) => r.tier === t);
    const a = mean(g.map((r) => r.inheritLegacy));
    const b = mean(g.map((r) => r.inheritView));
    say(`| ${t} | ${g.length} | ${mean(g.map((r) => r.siblingsLegacy)).toFixed(2)} → ${mean(g.map((r) => r.siblingsView)).toFixed(2)} | ${num(a, 0)} → ${num(b, 0)} | ${pct(rel(a, b), 1)} |`);
  }
  say();
  say('| 세대 | 형제 수 평균 (옛 → 새) | 상속액 평균 (만 원, 옛 → 새) | 변화 |');
  say('|---|---|---|---:|');
  for (const gen of GENERATION_IDS) {
    const g = rows.filter((r) => r.gen === gen);
    const a = mean(g.map((r) => r.inheritLegacy));
    const b = mean(g.map((r) => r.inheritView));
    say(`| ${gen} | ${mean(g.map((r) => r.siblingsLegacy)).toFixed(2)} → ${mean(g.map((r) => r.siblingsView)).toFixed(2)} | ${num(a, 0)} → ${num(b, 0)} | ${pct(rel(a, b), 1)} |`);
  }
  say();
}

say('## 4. 판 길이 (FA0-7: 가족 변화 줄은 연표 줄과 같은 규칙으로 센다)');
say();
{
  const rows = R('V3');
  say('| 세대 | 판당 가족 줄 | 한 판 시간 (분, 1배속 수동·읽기 중앙) 가족 줄 포함 | 가족 줄 뺀 | 차이 (초) |');
  say('|---|---:|---:|---:|---:|');
  for (const gen of GENERATION_IDS) {
    const g = rows.filter((r) => r.gen === gen);
    const a = mean(g.map((r) => r.seconds1x)) / 60;
    const b = mean(g.map((r) => r.seconds1xNoFam)) / 60;
    say(`| ${gen} | ${mean(g.map((r) => r.famLines)).toFixed(2)} | ${a.toFixed(2)} | ${b.toFixed(2)} | ${((a - b) * 60).toFixed(1)} |`);
  }
  const a = mean(rows.map((r) => r.seconds1x)) / 60;
  const b = mean(rows.map((r) => r.seconds1xNoFam)) / 60;
  say(`| 전체 | ${mean(rows.map((r) => r.famLines)).toFixed(2)} | ${a.toFixed(2)} | ${b.toFixed(2)} | ${((a - b) * 60).toFixed(1)} |`);
  say();
  say('- 가족 줄은 줄당 둘째 줄 대기(`extraLineMs` × 모드 계수)로 센다. 가족 줄만 있는 해는 조용한 해에서 서술 해가 되는 만큼이 더해진다. 판정 임계(평균 ≤ 35분, 세대별 ≤ 36.5분)는 바꾸지 않았다 — 위 숫자가 임계를 넘으면 마스터가 형진 님께 보고한다(FA0-7).');
  say();
}

// ---------- 5. 알파 노년 결정 카드 평균 (R-555) ----------
say('## 5. 알파 노년(65세+) 결정 카드 평균 — 허용치(judgeMargins −2.5 SE · simulation 0.05)의 근거 (R-555)');
say();
say(
  `- 알파의 노년 카드 평균 하한은 ${SENIOR_FLOOR.toFixed(2)}(마스터 결정 M-3, 옛 「다가올 세상」 구간)이다. 세 세계를 **같은 시드끼리 짝지어** 재고, 판정 표본(합친 4줄 × 1000판)과 겹치지 않는 **독립 줄**(시험 시드 줄 i = ${SENIOR_INDEPENDENT.from}~${SENIOR_INDEPENDENT.to}, 수동·자동)을 함께 재서 잡음과 구조적 이동을 가른다(QI5 때와 같은 방식). 세계: S0 FM4b 전 풀·효과 끔 / S2 지금 풀(K2·K4)·효과 끔 / S3 지금 풀·효과 켬(배포 값).`,
);
say();
{
  const samples = seniorSamples();
  const cards = new Map<string, number[]>();
  for (const sm of samples) {
    for (const w of SENIOR_WORLDS) {
      const t0 = Date.now();
      cards.set(`${sm.id}/${w.id}`, seniorCards(w, sm));
      console.error(`노년 ${sm.id}/${w.id}: ${sm.seeds.length}판 ${((Date.now() - t0) / 1000).toFixed(0)}초`);
    }
  }
  say('| 표본 | 세계 | 판 수 | 노년 카드 평균 | 표준오차 | 하한까지 여유 (SE, 안쪽 +) |');
  say('|---|---|---:|---:|---:|---:|');
  for (const sm of samples) {
    for (const w of SENIOR_WORLDS) {
      const xs = cards.get(`${sm.id}/${w.id}`)!;
      const m = mean(xs);
      const se = meanSe(xs);
      say(`| ${sm.label} | ${w.id} ${w.label} | ${xs.length} | ${m.toFixed(3)} | ${se.toFixed(3)} | ${((m - SENIOR_FLOOR) / se).toFixed(2)} |`);
    }
  }
  say();
  say('**세계 사이 이동**(같은 시드끼리 짝지은 판별 차이의 평균 ± 표준오차):');
  say();
  say('| 표본 | 비교 | 평균 차 | 표준오차 | 차 (SE 배수) |');
  say('|---|---|---:|---:|---:|');
  const shift = new Map<string, { diff: number; se: number }>();
  for (const sm of samples) {
    for (const [from, to, label] of [['S0', 'S2', 'K2·K4 (S0 → S2)'], ['S2', 'S3', '이른 별세 효과 (S2 → S3)'], ['S0', 'S3', '합계 (S0 → S3)']] as const) {
      const d = pairedDiff(cards.get(`${sm.id}/${from}`)!, cards.get(`${sm.id}/${to}`)!);
      shift.set(`${sm.id}/${from}${to}`, d);
      say(`| ${sm.label} | ${label} | ${signed(d.diff, 3)} | ${d.se.toFixed(3)} | ${(d.diff / d.se).toFixed(2)} |`);
    }
  }
  say();
  const judged = shift.get('judged/S0S3')!;
  const indep = shift.get('independent/S0S3')!;
  const ind3 = cards.get('independent/S3')!;
  const indM = mean(ind3);
  const indSe = meanSe(ind3);
  const sameSign = Math.sign(judged.diff) === Math.sign(indep.diff);
  const verdict = Math.abs(indep.diff / indep.se) >= 2 && sameSign ? '독립 줄에서도 같은 방향으로 유의하게 움직였다 → **구조적 이동**이다(잡음이 아니다)' : Math.abs(indep.diff / indep.se) < 2 ? '독립 줄에서는 유의한 이동이 없다 → 판정 표본의 이동은 **잡음 쪽**이다' : '독립 줄의 이동이 판정 표본과 반대 방향이다 → 판정 표본의 이동은 **잡음 쪽**이다';
  say(
    `- 판정 표본의 합계 이동 ${signed(judged.diff, 3)}(${(judged.diff / judged.se).toFixed(1)} SE) · 독립 줄의 합계 이동 ${signed(indep.diff, 3)}(${(indep.diff / indep.se).toFixed(1)} SE): ${verdict}.`,
  );
  say(
    `- 독립 줄의 배포 값 세계(S3) 평균 ${indM.toFixed(3)} ± ${indSe.toFixed(3)} — 하한 ${SENIOR_FLOOR.toFixed(2)}까지 ${((indM - SENIOR_FLOOR) / indSe).toFixed(1)} SE(안쪽 +). ${indM < SENIOR_FLOOR ? '평균이 하한 **아래**에 있다.' : '평균은 하한 위에 있다.'}`,
  );
  say(`- 이 표는 \`tests/judgeMargins.test.ts\`(알파 노년 한계 −2.5 SE)·\`tests/simulation.test.ts\`(알파 노이즈 0.05)의 근거다. 하한 5.00 자체는 마스터 결정(M-3)이라 바꾸지 않고, 세대별 시간 모델(GM10)에서 알파의 하한을 다시 정한다(TODO).`);
  say();
}

// ---------- 6. 어머니 출생 코호트별 총 자녀 수 (R-565, T-FA3c) ----------
say('## 6. 어머니 출생 코호트별 총 자녀 수 — FD6 대조 (R-565, tests/familyBirth.test.ts T-FA3c)');
say();
{
  // FD6 어머니 출생 코호트 → 센서스 연령 계급 평균 출생아 수 (fd6_mean_children_by_age_calc). 1946~50은 FD6 값이 없어 모형만 싣는다
  const cohorts: Array<[number, number, number | null]> = [[1911, 1915, 5.42], [1916, 1920, 5.65], [1921, 1925, 5.62], [1926, 1930, 5.23], [1931, 1935, 4.69], [1936, 1940, 4.07], [1941, 1945, 3.43], [1946, 1950, null], [1951, 1955, 2.31], [1956, 1960, 2.0]];
  const inv = cohorts.map(() => 0);
  const cnt = cohorts.map(() => 0);
  // 어머니 코호트당 표본을 늘리려고 이른 세대는 시드를 더 쓴다 (T-FA3c와 같은 표본)
  const draws: Array<[(typeof GENERATION_IDS)[number], number]> = [['industrial', 12000], ['boomer', 12000], ['g86', 8000], ['genx', 6000], ['millennial', 6000]];
  for (const [gen, n] of draws) {
    for (const seed of spreadSeeds(n, GENERATION_IDS.indexOf(gen))) {
      const b = generateBirthFromSeed(seed, gen);
      const mby = b.character.birthYear - b.report.mother.age;
      cohorts.forEach(([lo, hi], k) => {
        if (mby >= lo && mby <= hi) {
          inv[k] += 1 / (Math.min(b.report.birthOrder, 5) + b.family.y.length);
          cnt[k]++;
        }
      });
    }
  }
  say('- 총 자녀 수 = 어머니 가중 1/N 환산 평균(주인공 한 명당 1/N을 더해 표본 수 ÷ 합, 형제 순서 5는 「다섯째 이상」이지만 5명으로 센다). 허용은 FD6 ±0.45(마스터 결정, 12-4절 T-FA3c). 1945년 이전 어머니는 코호트 보정(`design.highOrderContinue`)을 쓴다 — 1941~45는 검수 R-565로 더했다.');
  say();
  say('| 어머니 출생 코호트 | 표본 | 모형 | FD6 | 차이 | 허용 ±0.45 |');
  say('|---|---:|---:|---:|---:|---|');
  cohorts.forEach(([lo, hi, fd6], k) => {
    const model = cnt[k] / inv[k];
    const diff = fd6 === null ? null : model - fd6;
    say(`| ${lo}~${hi} | ${cnt[k]} | ${model.toFixed(2)} | ${fd6 === null ? '–' : fd6.toFixed(2)} | ${diff === null ? '–' : signed(diff, 2)} | ${diff === null ? '목표 없음' : Math.abs(diff) <= 0.45 ? '통과' : '초과'} |`);
  });
  say();
}

// ---------- 7. 성인기 「부모님」 사건 (R-564) ----------
say('## 7. 성인기 「부모님」 사건이 부모 한 분 별세 뒤에도 나오는 비율 (R-564, FM7 변형의 근거)');
say();
{
  const all = R('V3');
  const after = (r: LifeRow, i: number): boolean => r.adultParent[i] !== null && r.adultParent[i]! >= r.lossAge!;
  const events = [0, 1, 2]; // 사건 셋(middle-parents-care · middle-parents-farewell · youth-housing)
  const any3 = (r: LifeRow): boolean => events.some((i) => after(r, i));
  const any4 = (r: LifeRow): boolean => [0, 1, 2, 3].some((i) => after(r, i));
  const names = ADULT_PARENT_IDS.slice(0, 3).map((x) => '`' + x + '`').join(' · ');
  say(
    `- 대상: 배포 값 세계(V3)의 ${all.length}판. 「한 분 별세 판」 = 모형이 부모 한 분 별세(\`family.log\` 종류 5)를 알린 판. 「나온다」 = 별세 나이 이후(같은 해 포함)에 사건이 일어났다(\`seen\`). 사건 ${names} 셋의 어느 하나를 「사건 셋」으로 센다. 글감 \`${ADULT_PARENT_IDS[3]}\`은 따로 센다(자동 선택 판에서는 글감 카드가 나오지 않는다).`,
  );
  say('- **두 가지 분모를 함께 싣는다**: 「전체 판 대비」는 FM4b 보고(ai-log)의 「약 80.6% 판에서 나온다」와 같은 읽기(판 전체 중 몇 %에서 별세 뒤에 사건이 일어났나)이고, 「별세 판 대비」는 한 분이 떠난 판만 분모로 한 것이다. 80.6%는 그때 스크립트가 없던 수치라 이 표가 그 숫자의 출처다.');
  say();
  say('| 세대 | 전체 판 | 한 분 별세 판 | 사건 셋 중 하나라도 별세 뒤에 나온 판 | 전체 판 대비 | 별세 판 대비 | ' + ADULT_PARENT_IDS.map((x) => x.replace('middle-', '').replace('youth-', '')).join(' | ') + ' (별세 판 대비) | 넷 중 하나라도 (별세 판 대비) |');
  say('|---|---:|---:|---:|---:|---:|' + ADULT_PARENT_IDS.map(() => '---:|').join('') + '---:|');
  const line = (label: string, g: LifeRow[]): void => {
    const lost = g.filter((r) => r.lossAge !== null);
    const a3 = lost.filter(any3).length;
    const a4 = lost.filter(any4).length;
    say(
      `| ${label} | ${g.length} | ${lost.length} | ${a3} | ${pct((100 * a3) / Math.max(1, g.length))} | ${pct((100 * a3) / Math.max(1, lost.length))} | ${ADULT_PARENT_IDS.map((_, i) => pct((100 * lost.filter((r) => after(r, i)).length) / Math.max(1, lost.length))).join(' | ')} | ${pct((100 * a4) / Math.max(1, lost.length))} |`,
    );
  };
  for (const gen of GENERATION_IDS) line(gen, all.filter((r) => r.gen === gen));
  line('전체', all);
  say();
  say('- 이 숫자가 높은 것은 사건 문장이 아직 「부모님」(두 분)을 말하기 때문이다 — 설계 문서 13-2절의 FM7 변형이 한 분 별세 판의 문장을 바꾼다. 그 전까지 성인기 「부모님」 사건은 공개 배포 차단 조건이다(TODO).');
  say();
}

say(REPORT_NOTES);
const text = out.join('\n') + '\n';
if (WRITE) {
  writeFileSync('docs/data/family-remeasure.md', text, 'utf-8');
  console.error('docs/data/family-remeasure.md를 썼다');
} else console.log(text);
