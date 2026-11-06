import '../src/data/installAll';
import { writeFileSync } from 'node:fs';
import { GENERATION_IDS, generateBirthFromSeed } from '../src/core';
import { spreadSeeds } from '../tests/helpers/familyGolden';
import {
  ADULT_PARENT_IDS,
  CLEARED_READER_IDS,
  GONE_READER_IDS,
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
 * 같은 시드·같은 자동 성향 선택으로 원인(K2 · K4 · 이른 부모 별세 효과 · K1 · R-562 · FM7a의 변형 사건 · R-561 · 별세 해 notFlags 규칙 · R-631·R-632 · R-586 · Q3)을 하나씩 켠 세계를 돌려 짝지어 견준다.
 * **이른 부모 별세 효과의 합격 기준은 설계 문서 4-7절 (1)** (마스터 결정 2026-11-02 — 처음의 「중앙값 변화 ≤ 3%」는 중앙값 한 칸(150만 원)이 15%로 읽히는 틀린 지표라 평균으로 바꿨다):
 *   ① 재력 단계별 최종 순자산 평균 변화 ≤ 3% · 20세 시작 평균의 절대 변화 ≤ 150만 원(**1~4단계만** — 5단계는 표본이 작아(세대당 1000판에서 약 146판, 걸린 판 약 25판, 표준오차 약 34만 원) 보고만, 마스터 결정 2026-11-03)  ② 단계 순서 뒤바뀜 0  ③ 엔딩 방향 판정 분포 변화 ≤ 2%p  ④ 효과가 걸린 판 비율 보고.
 *   중앙값 변화·효과가 걸린 판만의 차이는 보고만 한다(판정에 쓰지 않는다).
 * K1·R-562 수용 기준의 5단계 판정 변화는 표본(n=146)이 작아 기준선 부근이면 「합격」 대신 「기준선 부근(약 N~M%p, n=…)」으로 적는다(REV-009-FM6-1 2절, 마스터 결정 2026-11-03).
 */
const argN = process.argv.slice(2).find((a) => /^\d+$/.test(a));
const PER_GEN = Number(argN ?? 600);
const WRITE = process.argv.includes('--write');

/** 이른 부모 별세 효과의 수용 기준 (4-7절 (1), 마스터 결정 2026-11-02) */
const NET20_MEAN_ABS_LIMIT = 150; // 20세 시작 순자산 평균의 절대 변화 (만 원)
const FINAL_MEAN_LIMIT = 3; // 최종 순자산 평균 변화 (%)
const MOVE_LIMIT = 2; // 엔딩 방향 판정 분포 변화 (%p)
/** K1(형제 수 새 정의로 상속)의 수용 기준 (마스터 지시 2026-11-02, REV-009-FM4b-1 3절): 단계 순서 뒤바뀜 0 · 최종 순자산 평균 변화 ≤ 8% · 판정 변화 ≤ 5%p. INHERIT 값은 다시 맞추지 않는다 */
const K1_FINAL_MEAN_LIMIT = 8;
const K1_MOVE_LIMIT = 5;

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
/** 모형이 부모 한 분 별세를 알린 판 수 */
const lostCount = (rows: LifeRow[]): number => rows.filter((r) => r.lossAge !== null).length;

// ---------- 비교 표 ----------
interface Cmp {
  /** 20세 시작 평균의 절대 변화 (만 원): 1~4단계의 최댓값은 판정에 쓰고(`maxNet20MeanAbs`), 5단계는 표본이 작아 보고만 한다(`net20MeanAbsTier5`, 2026-11-03) · 최종 평균 변화 (%) — 판정에 쓴다 */
  maxNet20MeanAbs: number;
  net20MeanAbsTier5: number;
  /** 5단계의 판정 변화 (%p, 세 방향 중 가장 큰 것) · 5단계 표본 수 — K1 판정 문구가 「기준선 부근」을 가리는 데 쓴다 */
  movePpTier5: number;
  nTier5: number;
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
  let net20MeanAbsTier5 = 0;
  let movePpTier5 = 0;
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
    if (t === 5) net20MeanAbsTier5 = Math.abs(d20Abs);
    else maxNet20MeanAbs = Math.max(maxNet20MeanAbs, Math.abs(d20Abs));
    maxFinalMean = Math.max(maxFinalMean, Math.abs(dFMean));
    maxNet20Median = Math.max(maxNet20Median, Math.abs(d20Med));
    maxFinalMedian = Math.max(maxFinalMedian, Math.abs(dFMed));
    const share = (s: typeof a, k: 'up' | 'same' | 'down') => (100 * s.movement[k]) / Math.max(1, s.movement.up + s.movement.same + s.movement.down);
    const dm = (['up', 'same', 'down'] as const).map((k) => share(b, k) - share(a, k));
    maxMovePp = Math.max(maxMovePp, ...dm.map(Math.abs));
    if (t === 5) movePpTier5 = Math.max(...dm.map(Math.abs));
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
    `- 가장 큰 변화(판정): 20세 시작 평균 ${num(maxNet20MeanAbs)}만 원(1~4단계; 5단계 ${num(net20MeanAbsTier5)}만 원은 보고만) · 최종 평균 ${pct(maxFinalMean, 2)} · 판정 ${maxMovePp.toFixed(2)}%p · 단계 순서 뒤바뀜 ${flips}쌍 / (보고만) 중앙값 20세 시작 ${pct(maxNet20Median, 2)} · 최종 ${pct(maxFinalMedian, 2)}`,
  );
  say();
  return { maxNet20MeanAbs, net20MeanAbsTier5, movePpTier5, nTier5: g[4].n, maxFinalMean, maxNet20Median, maxFinalMedian, maxMovePp, orderFlips: flips };
}

const passes = (c: Cmp): boolean => c.maxNet20MeanAbs <= NET20_MEAN_ABS_LIMIT && c.maxFinalMean <= FINAL_MEAN_LIMIT && c.orderFlips === 0 && c.maxMovePp <= MOVE_LIMIT;
const describe = (c: Cmp): string => `20세 시작 평균 ${num(c.maxNet20MeanAbs)}만 원(1~4단계; 5단계 ${num(c.net20MeanAbsTier5)}만 원은 보고만) · 최종 평균 ${pct(c.maxFinalMean, 2)} · 판정 ${c.maxMovePp.toFixed(2)}%p · 뒤바뀜 ${c.orderFlips}쌍`;
const CRITERIA = `① 최종 순자산 평균 변화 ≤ ${FINAL_MEAN_LIMIT}% · 20세 시작 평균의 절대 변화 ≤ ${NET20_MEAN_ABS_LIMIT}만 원(1~4단계만 — 5단계는 표본이 작아 보고만, 마스터 결정 2026-11-03) ② 단계 순서 뒤바뀜 0 ③ 판정 변화 ≤ ${MOVE_LIMIT}%p (중앙값은 보고만)`;

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

const passesK1 = (c: Cmp): boolean => c.maxFinalMean <= K1_FINAL_MEAN_LIMIT && c.orderFlips === 0 && c.maxMovePp <= K1_MOVE_LIMIT;
/** K1 판정 문구: 기준 안이어도 5단계(표본이 작다)의 판정 변화가 기준선 부근이면 「합격」 대신 「기준선 부근(약 N~M%p, n=…)」으로 적는다 (REV-009-FM6-1 2절, 2026-11-03) */
const NEAR_LIMIT_PP = 1.5;
const verdictK1 = (c: Cmp): string => {
  if (!passesK1(c)) return '**기준 초과**';
  if (c.movePpTier5 < K1_MOVE_LIMIT - NEAR_LIMIT_PP) return '**합격**';
  const lo = Math.floor(c.movePpTier5);
  return `1~4단계 **합격**, 5단계 판정 변화 **기준선 부근(약 ${lo}~${lo + 1}%p, n=${c.nTier5})** — 표본이 작아 한두 판에 1~2%p가 움직인다(측정 ${c.movePpTier5.toFixed(2)}%p, 기준 ${K1_MOVE_LIMIT}%p)`;
};
const describeK1 = (c: Cmp): string => `최종 평균 ${pct(c.maxFinalMean, 2)} · 판정 ${c.maxMovePp.toFixed(2)}%p · 뒤바뀜 ${c.orderFlips}쌍 (참고: 20세 시작 평균 ${num(c.maxNet20MeanAbs)}만 원)`;
const K1_CRITERIA = `① 재력 단계 순서 뒤바뀜 0 ② 재력 단계별 최종 순자산 평균 변화 ≤ ${K1_FINAL_MEAN_LIMIT}% ③ 엔딩 방향 판정 변화 ≤ ${K1_MOVE_LIMIT}%p (중앙값은 보고만, INHERIT 값은 다시 맞추지 않는다)`;

say('## 3. K1 형제 수 새 정의 (V3 → V4, FM6에서 켰다 — 형진 님 결정 「실제 형제 수로 나누기」)');
say();
say(`수용 기준(마스터 지시 2026-11-02, REV-009-FM4b-1 3절): ${K1_CRITERIA}. 기준을 넘으면 값을 맞추지 않고 이 표와 함께 보고한다.`);
say();
const k1Cmp = compare(R('V3'), R('V4'), '재력 단계별 (V3 K1 켜기 전 → V4 K1 켬)');
say(`판정: ${verdictK1(k1Cmp)} (${describeK1(k1Cmp)}) — ${K1_CRITERIA}.`);
say();
{
  const rows = R('V4');
  say('**세대별·재력별 형제 수와 상속액**(끝난 판의 형제 수 평균과 `INHERIT[재력] ÷ (형제 수 + 1)`의 평균, 만 원 — 옛 규칙 → 새 정의):');
  say();
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

say('### 3-2. R-562: 「두 분 모두 떠남」 규칙 (V4 → V5, FM6 판단 — 상속·월세 전환을 가족 보기와 같은 해에)');
say();
say('한 분은 모델이 먼저 별세시키고 다른 분이 100세를 넘으면 가족 보기는 「두 분 모두 떠남」인데 옛 규칙의 `parentsAllGone`은 먼저 떠난 분의 **실제 나이**가 100을 넘을 때까지 거짓이었다 (`scripts/familyParentsGone.ts`: 7세대 × 300판의 8.1%, 평균 3.5년, 최대 13년, 주인공 47~82세). 상속·월세 전환을 보기와 같은 해로 맞췄다. 같은 기준(위 K1용)으로 견준다.');
say();
const goneCmp = compare(R('V4'), R('V5'), '재력 단계별 (V4 K1만 → V5 K1 + R-562)');
say(`판정: ${verdictK1(goneCmp)} (${describeK1(goneCmp)}) — ${K1_CRITERIA}.`);
say();
{
  const rows = R('V5');
  const hit = rows.filter((r, i) => r.finalNet !== R('V4')[i].finalNet).length;
  say(`- 최종 순자산이 달라진 판: ${hit} / ${rows.length} (${pct((100 * hit) / rows.length)}).`);
  say();
}

say('### 3-3. 합계 (V3 → V5): 이번 회차에 배포 값이 바뀐 만큼');
say();
const totalCmp = compare(R('V3'), R('V5'), '재력 단계별 (V3 켜기 전 → V5 배포 값)');
say(`판정: ${verdictK1(totalCmp)} (${describeK1(totalCmp)}) — ${K1_CRITERIA}.`);
say();

say('## 4. 판 길이 (FA0-7: 가족 변화 줄은 연표 줄과 같은 규칙으로 센다) — FM7a 배포 값(V11)');
say();
{
  const rows = R('V11');
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
say('## 7. 성인기 「부모님」 사건이 부모 한 분 별세 뒤에도 나오는 비율 (R-564 → FM7a 해소)');
say();
{
  const after = (r: LifeRow, i: number): boolean => r.adultParent[i] !== null && r.lossAge !== null && r.adultParent[i]! >= r.lossAge;
  const afterVariant = (r: LifeRow, i: number): boolean => r.variantSeen[i] !== null && r.lossAge !== null && r.variantSeen[i]! >= r.lossAge;
  const names = ADULT_PARENT_IDS.slice(0, 3).map((x) => '`' + x + '`').join(' · ');
  say(
    `- 「한 분 별세 판」 = 모형이 부모 한 분 별세(\`family.log\` 종류 5)를 알린 판. 「나온다」 = 별세 나이 이후(같은 해 포함)에 사건이 일어났다(\`seen\`). **FM7a는 열을 원본 둘(\`middle-parents-care\` · \`middle-parents-farewell\`)로 다시 정의했다** — \`youth-housing\`은 「본가」로 낱말이 중립이 되었고 글감 \`note-parents-aging\`은 기록 카드라 \`seen\`의 사건 집계에 따로 센다(별세 판 대비 0.0%는 글감이 \`seen\`에 사건 id로 남지 않기 때문이다 — 문장은 변형이 맡는다, tests/noteCards.test.ts).`,
  );
  say(`- **두 가지 분모를 함께 싣는다**: 「전체 판 대비」는 FM4b 보고(ai-log)의 「약 80.6% 판에서 나온다」와 같은 읽기이고, 「별세 판 대비」는 한 분이 떠난 판만 분모로 한 것이다. 앞 표(V5)가 FM7a **전**(원본이 별세 뒤에도 나온다), 뒤 표(V11)가 FM7a **뒤**(배포 값)다. 사건 셋 = ${names}.`);
  say();
  const table = (title: string, all: LifeRow[], variants: boolean): void => {
    say(`#### ${title}`);
    say();
    // 「나온다」는 별세 줄이 난 그 해를 포함한다(마스터 결정 후속 199 — 완료 기준 3 「켜진 해부터」). 같은 해에 겹친 원본은 따로 센다(0이어야 한다)
    const sameYear = (r: LifeRow, i: number): boolean => r.adultParent[i] !== null && r.lossAge !== null && r.adultParent[i]! === r.lossAge;
    const later = (r: LifeRow, i: number): boolean => after(r, i);
    say(
      '| 세대 | 전체 판 | 한 분 별세 판 | 원본 둘 중 하나라도 별세 뒤(같은 해 포함) 나온 판 | 전체 판 대비 | 별세 판 대비 | parents-care (원본) | parents-farewell (원본) |' +
        (variants ? ' 별세 줄과 같은 해에 겹친 원본 (병환 · 임종 — 0이어야 한다) | 변형 병환 · 임종이 별세 뒤에 나온 판 (별세 판 대비) |' : ' housing (별세 판 대비) |'),
    );
    say('|---|---:|---:|---:|---:|---:|---:|---:|' + (variants ? '---:|---:|' : '---:|'));
    const line = (label: string, g: LifeRow[]): void => {
      const lost = g.filter((r) => r.lossAge !== null);
      const o2 = lost.filter((r) => later(r, 0) || later(r, 1)).length;
      const tail = variants
        ? `${lost.filter((r) => sameYear(r, 0)).length} · ${lost.filter((r) => sameYear(r, 1)).length} | ${pct((100 * lost.filter((r) => afterVariant(r, 0) || afterVariant(r, 1)).length) / Math.max(1, lost.length))} · ${pct((100 * lost.filter((r) => afterVariant(r, 2) || afterVariant(r, 3)).length) / Math.max(1, lost.length))}`
        : pct((100 * lost.filter((r) => after(r, 2)).length) / Math.max(1, lost.length));
      say(`| ${label} | ${g.length} | ${lost.length} | ${o2} | ${pct((100 * o2) / Math.max(1, g.length))} | ${pct((100 * o2) / Math.max(1, lost.length))} | ${pct((100 * lost.filter((r) => later(r, 0)).length) / Math.max(1, lost.length))} | ${pct((100 * lost.filter((r) => later(r, 1)).length) / Math.max(1, lost.length))} | ${tail} |`);
    };
    for (const gen of GENERATION_IDS) line(gen, all.filter((r) => r.gen === gen));
    line('전체', all);
    say();
  };
  table('FM7a 전 (V5: 문장이 두 분을 말한다 — 원본 두 사건이 별세 뒤에도 나온다, 같은 해 포함)', R('V5'), false);
  table('FM7a 뒤 (V11, 배포 값: 원본에 한 분이 떠난 판 제외 조건 · 별세 해 notFlags 규칙, 변형 4개가 맡는다 — 같은 해 포함 원본 열이 0%여야 한다)', R('V11'), true);
  const v11 = R('V11');
  const origAt = (rows: LifeRow[], sameOnly: boolean): number =>
    rows.filter((r) => r.lossAge !== null && ([0, 1] as const).some((i) => r.adultParent[i] !== null && (sameOnly ? r.adultParent[i]! === r.lossAge! : r.adultParent[i]! >= r.lossAge!))).length;
  const origAll = origAt(v11, false);
  const origSame = origAt(v11, true);
  const origSame7 = origAt(R('V7'), true);
  const lost7 = lostCount(R('V7'));
  const v5Lost = R('V5').filter((r) => r.lossAge !== null);
  const v5Pct = (i: 0 | 1): string => pct((100 * v5Lost.filter((r) => after(r, i)).length) / Math.max(1, v5Lost.length));
  say(
    `- **판정(완료 기준 3, 마스터 결정 후속 199 — 「켜진 해부터」는 별세 줄이 난 그 해를 포함): 별세 줄이 난 해를 포함해 원본 사건이 나온 판 ${origAll}건 ${origAll === 0 ? `— 합격(${v5Pct(0)}·${v5Pct(1)} → 0%)` : '— **불합격**'}** (그중 별세 줄과 같은 해에 겹친 원본 ${origSame}건, 한 분 별세 판 ${lostCount(v11)}판 중). 변형은 한 분이 떠난 판에서만 일어난다(tests/familyText.test.ts).`,
  );
  say(
    `- **같은 해 겹침의 원인 구분**: R-561만 켠 세계(V7)에서는 별세 줄과 같은 해에 병환·임종 원본이 겹친 판이 ${origSame7}건(한 분 별세 판 ${lost7}판의 ${pct((100 * origSame7) / Math.max(1, lost7), 2)})이었다. 임종 원본은 \`parents_gone\`을 켜서 R-561이 막았지만, 병환 원본은 \`parents_gone\`을 켜지 않아 줄이 난 해에도 뽑혔다(원본의 \`notFlags\`는 줄이 난 해 끝에 켜지는 플래그를 읽고 그 해 안의 후보는 해 시작의 플래그로 가려지는 FA7 시간 규칙 때문이다). 별세 해 notFlags 규칙(후속 199, V8)이 줄이 난 해에 그 한 분의 \`mother_gone\`·\`father_gone\`을 \`notFlags\`로 읽는 사건을 그 해 후보에서 빼 0건이 된다(원인 열은 아래 8절 V7 → V8).`,
  );
  say();
}

// ---------- 8. FM7a ----------
say('## 8. FM7a 원인별 재측정 (SPEC-009 「FM7 나눔」 완료 기준 5·11, V5 → V11)');
say();
{
  say(`수용 기준(이른 별세 효과의 기존 합격선을 그대로 쓴다, 완료 기준 11): ${CRITERIA}. 넘으면 임계를 올리지 않고 마스터에게 올린다.`);
  say();
  const steps: Array<[Variant['id'], Variant['id'], string]> = [
    ['V5', 'V6', '「남은 한 분」 변형 사건 4개 · 원본 제외 조건 (V5 → V6)'],
    ['V6', 'V7', 'R-561 같은 해 겹침 정리: parents_gone을 켜는 사건을 별세 해 후보에서 뺀다 (V6 → V7)'],
    ['V7', 'V8', '별세 해 notFlags 규칙(후속 199): 그 해 별세한 한 분의 플래그를 notFlags로 읽는 사건도 별세 해 후보에서 뺀다 (V7 → V8)'],
    ['V8', 'V9', 'R-631·R-632: 가족 줄이 난 해, 줄 뒤 꺼지는 플래그를 요구하는 사건을 빼고 보이는 선택지를 해 시작 ∩ 줄 뒤로 줄인다 (V8 → V9)'],
    ['V9', 'V10', 'R-586 senior-alone이 함께 사는 자녀가 있는 판을 거른다 (V9 → V10)'],
    ['V10', 'V11', 'Q3 어린 형제의 이른 별세 → 상속의 형제 수 · 형제 줄이 난 해의 R-631·R-632 · 청년 「본가」 (V10 → V11)'],
  ];
  const cmps: Array<{ label: string; c: Cmp }> = [];
  for (const [from, to, label] of steps) {
    const c = compare(R(from), R(to), label);
    cmps.push({ label, c });
    say(`판정: ${passes(c) ? '**합격**' : '**기준 초과**'} (${describe(c)})`);
    say();
  }
  const total = compare(R('V5'), R('V11'), '합계: FM6 배포 값 → FM7a 배포 값 (V5 → V11)');
  say(`**합계 판정 (완료 기준 11): ${passes(total) ? '합격' : '기준 초과'}** (${describe(total)}).`);
  say();

  const key = (r: LifeRow): string => `${r.gen}/${r.seed}`;
  const v6 = R('V6');
  const v7 = R('V7');
  const v8 = R('V8');
  const v9 = R('V9');
  const v10 = R('V10');
  const v11b = R('V11');

  // 별세 해 후보 정리로 놓친 판
  say('### 8-1. 별세 해 후보 정리로 임종 사건을 놓친 판 (완료 기준 5)');
  say();
  const same = v6.filter((r) => r.sameYearGone);
  const missedIn = (to: LifeRow[]): LifeRow[] => {
    const by = new Map(to.map((r) => [key(r), r]));
    return same.filter((r) => by.get(key(r))!.farewellAge === null);
  };
  const missed7 = missedIn(v7);
  const missed8 = missedIn(v8);
  const missed9 = missedIn(v9);
  say('| 세계 | 판 수 | 한 분 별세 판 | 임종 사건이 일어난 판 | 한 분 별세와 같은 해에 임종이 겹친 판 |');
  say('|---|---:|---:|---:|---:|');
  for (const [label, rows] of [['V6 (겹침 정리 전)', v6], ['V7 (R-561)', v7], ['V8 (R-561 + 별세 해 notFlags 규칙)', v8], ['V9 (+ R-631·R-632)', v9]] as const) {
    say(`| ${label} | ${rows.length} | ${lostCount(rows)} | ${rows.filter((r) => r.farewellAge !== null).length} | ${rows.filter((r) => r.sameYearGone).length} |`);
  }
  say();
  say(
    `- 같은 해 겹침은 V6에서 ${same.length}판(한 분 별세 판의 ${pct((100 * same.length) / Math.max(1, lostCount(v6)), 2)}, 전체 판의 ${pct((100 * same.length) / v6.length, 2)})이고 V7 이후에는 0판이다. 이 겹침 판 중 **같은 시드의 V7 판에서 임종 사건을 아예 놓친 판은 ${missed7.length}판**(${pct((100 * missed7.length) / Math.max(1, same.length))}), **V8 판에서는 ${missed8.length}판**(${pct((100 * missed8.length) / Math.max(1, same.length))}), **V9 판에서는 ${missed9.length}판**(${pct((100 * missed9.length) / Math.max(1, same.length))})이고, 나머지는 이듬해 이후에 임종 사건이 일어났다(별세 나이가 가족 나이 상한 앞에서 끝나면 \`parents_gone\`을 나이 상한이 맡는다, R-562).`,
  );
  say(
    `- **「마지막 인사를 놓친 판」 비율(완료 기준 5, 전체 판 대비)**: V6 → V7 ${pct((100 * missed7.length) / v6.length, 2)}, V6 → V8 ${pct((100 * missed8.length) / v6.length, 2)}, V6 → V9 ${pct((100 * missed9.length) / v6.length, 2)}(한 분 별세 판 대비 ${pct((100 * missed7.length) / Math.max(1, lostCount(v6)), 2)} · ${pct((100 * missed8.length) / Math.max(1, lostCount(v6)), 2)} · ${pct((100 * missed9.length) / Math.max(1, lostCount(v6)), 2)}). 별세 해 notFlags 규칙이 새로 거르는 사건 중 임종 원본은 이미 R-561이 막고 있고, R-631은 형제·조부모 줄이 난 해에만, R-632는 그에 더해 한 분 별세 줄이 난 해의 선택지에만 닿고, 임종 사건은 그 해에 이미 R-561이 빼므로 이 규칙들로 임종을 놓치는 판이 늘지는 않는다(V7 → V8 → V9 차이는 난수 흐름이 옮겨 간 판 수준).`,
  );
  say();

  // 병환 원본과 변형
  say('### 8-2. 병환 원본과 변형이 한 판에 둘 다 나오는 판 (같은 인용 c-081을 두 번 보는 판 — P5, 마스터 수용: 후속 199)');
  say();
  const careStat = (rows: LifeRow[]): { both: number; ever: number } => ({
    both: rows.filter((r) => r.careBoth).length,
    ever: rows.filter((r) => r.adultParent[0] !== null || r.variantSeen[0] !== null || r.variantSeen[1] !== null).length,
  });
  say('| 세계 | 판 수 | 병환 사건(원본 또는 변형)이 일어난 판 | 원본을 본 뒤 변형이 이어진 판 | 전체 판 대비 | 병환이 일어난 판 대비 |');
  say('|---|---:|---:|---:|---:|---:|');
  for (const [label, rows] of [['V7 (R-561)', v7], ['V8 (+ 별세 해 notFlags 규칙)', v8], ['V9 (+ R-631·R-632)', v9], ['V11 (배포 값)', v11b]] as const) {
    const c = careStat(rows);
    say(`| ${label} | ${rows.length} | ${c.ever} | ${c.both} | ${pct((100 * c.both) / rows.length, 2)} | ${pct((100 * c.both) / Math.max(1, c.ever), 2)} |`);
  }
  say();
  say(
    `- 변형은 원본의 인용(c-081)을 그대로 쓰므로 원본을 본 뒤 한 분이 떠나 변형이 이어진 판에서는 같은 인용이 두 번 보인다. **마스터 결정(후속 199)으로 수용한다** — 코드 변경 없이 지켜보는 시험(허용 쌍, 상한 6%: tests/citationExposure.test.ts)은 그대로 둔다.`,
  );
  say();

  // 별세 해 notFlags 규칙의 영향
  say('### 8-3. 별세 해 notFlags 규칙(후속 199)의 영향 — 바뀐 판 · 어린 시절 사건의 발생 변화 (V7 → V8)');
  say();
  const by7 = new Map(v7.map((r) => [key(r), r]));
  const rulePairs = v8.map((r) => [by7.get(key(r))!, r] as const);
  const changed = rulePairs.filter(([a, b]) => a.seenSig !== b.seenSig);
  say('| 세대 | 판 수 | 한 분 별세 판 | 규칙으로 바뀐 판 | 전체 판 대비 | 별세 판 대비 |');
  say('|---|---:|---:|---:|---:|---:|');
  const changedIn = (g: LifeRow[]): number => g.filter((r) => changed.some(([, b]) => b === r)).length;
  for (const gen of GENERATION_IDS) {
    const g = v8.filter((r) => r.gen === gen);
    const ch = changedIn(g);
    say(`| ${gen} | ${g.length} | ${lostCount(g)} | ${ch} | ${pct((100 * ch) / Math.max(1, g.length), 2)} | ${pct((100 * ch) / Math.max(1, lostCount(g)), 2)} |`);
  }
  say(`| 전체 | ${v8.length} | ${lostCount(v8)} | ${changed.length} | ${pct((100 * changed.length) / v8.length, 2)} | ${pct((100 * changed.length) / Math.max(1, lostCount(v8)), 2)} |`);
  say();
  const changedEarly = changed.filter(([, b]) => b.lossAge !== null && b.lossAge <= 19).length;
  const changedNoLoss = changed.filter(([, b]) => b.lossAge === null).length;
  say(
    `- 바뀐 판 ${changed.length}판 중 별세 나이가 19세 이하(어린 시절·청소년기)인 판 ${changedEarly}판, 20세 이상(성인기)인 판 ${changed.length - changedEarly - changedNoLoss}판, 별세 줄이 없는 판 ${changedNoLoss}판(0이어야 한다 — 규칙은 별세 줄이 난 해에만 켜진다). 바뀐 판의 \`seen\`(본 사건 전체)이 V7과 달라진 판을 센 것이라 후보 정리로 바뀐 해 뒤의 흐름 변화도 포함한다.`,
  );
  say();
  say('| 사건 (notFlags가 mother_gone·father_gone) | 층 | V7 일어난 판 | V8 일어난 판 | 변화 | V7 별세 해에 일어난 판 | V8 별세 해에 일어난 판 (0이어야 한다) |');
  say('|---|---|---:|---:|---:|---:|---:|');
  const childhood = new Set(['infant-care', 'infant-neglect-night', 'school-early-work']);
  GONE_READER_IDS.forEach((id, i) => {
    const seenN = (rows: LifeRow[]): number => rows.filter((r) => r.readerSeen[i] !== null).length;
    const sameN = (rows: LifeRow[]): number => rows.filter((r) => r.lossAge !== null && r.readerSeen[i] === r.lossAge).length;
    const a = seenN(v7);
    const b = seenN(v8);
    say(`| \`${id}\` | ${childhood.has(id) ? '어린 시절' : '성인기 원본'} | ${a} | ${b} | ${signed(b - a)} | ${sameN(v7)} | ${sameN(v8)} |`);
  });
  say();
  say(
    `- 어린 시절 사건은 풀에서 \`notFlags\`로 \`mother_gone\`·\`father_gone\`을 읽는 것을 찾으면 3개다(\`infant-care\` · \`infant-neglect-night\` · \`school-early-work\`) (tests/familyFm7a.test.ts가 이 다섯 사건이 풀과 같음을 지킨다). 이 규칙은 한 방향이다: \`mother_gone\`·\`father_gone\`을 **요구하는** 사건(변형)은 별세 해에 새로 뽑히지 않는다(해 시작 상태 그대로).`,
  );
  say();

  // R-631·R-632
  say('### 8-4. R-631·R-632: 가족 줄(형제·조부모 별세 · 부모 한 분 별세)이 난 해의 후보·선택지 정리의 영향 — 바뀐 판 · 같은 해 점검 (V8 → V9, 형제 줄은 V11)');
  say();
  const by8 = new Map(v8.map((r) => [key(r), r]));
  const lineChanged = v9.filter((r) => by8.get(key(r))!.histSig !== r.histSig);
  say('| 세대 | 판 수 | 규칙으로 인생 기록(연표)이 달라진 판 | 전체 판 대비 |');
  say('|---|---:|---:|---:|');
  for (const gen of GENERATION_IDS) {
    const g = v9.filter((r) => r.gen === gen);
    const ch = g.filter((r) => lineChanged.includes(r)).length;
    say(`| ${gen} | ${g.length} | ${ch} | ${pct((100 * ch) / Math.max(1, g.length), 2)} |`);
  }
  say(`| 전체 | ${v9.length} | ${lineChanged.length} | ${pct((100 * lineChanged.length) / v9.length, 2)} |`);
  say();
  const sumLen = (rows: LifeRow[], f: (r: LifeRow) => unknown[]): number => rows.reduce((n, r) => n + f(r).length, 0);
  const livesWith = (rows: LifeRow[], f: (r: LifeRow) => unknown[]): number => rows.filter((r) => f(r).length > 0).length;
  say('| 점검 (가족 줄이 난 해 · 줄 뒤 플래그 기준) | V8 (R-631·R-632 없음) | V9 | V11 (배포 값, 형제 줄 포함) | 0이어야 한다 |');
  say('|---|---:|---:|---:|---|');
  say(`| 줄 뒤 꺼지는 플래그를 요구하는 사건이 같은 해에 일어난 판 (R-631, 건수) | ${livesWith(v8, (r) => r.sameYearCleared)} (${sumLen(v8, (r) => r.sameYearCleared)}건) | ${livesWith(v9, (r) => r.sameYearCleared)} (${sumLen(v9, (r) => r.sameYearCleared)}건) | ${livesWith(v11b, (r) => r.sameYearCleared)} (${sumLen(v11b, (r) => r.sameYearCleared)}건) | V9 · V11 |`);
  say(`| 줄 뒤 ctx로는 안 보이는 선택지가 골라진 판 (R-632, 건수) | ${livesWith(v8, (r) => r.lineChoiceBad)} (${sumLen(v8, (r) => r.lineChoiceBad)}건) | ${livesWith(v9, (r) => r.lineChoiceBad)} (${sumLen(v9, (r) => r.lineChoiceBad)}건) | ${livesWith(v11b, (r) => r.lineChoiceBad)} (${sumLen(v11b, (r) => r.lineChoiceBad)}건) | V9 · V11 |`);
  say(`| 점검한 선택(가족 줄이 난 해에 보이거나 골라진 선택지 수) | ${v8.reduce((n, r) => n + r.lineChoiceN, 0)} | ${v9.reduce((n, r) => n + r.lineChoiceN, 0)} | ${v11b.reduce((n, r) => n + r.lineChoiceN, 0)} | – |`);
  say();
  const tally = (rows: LifeRow[], f: (r: LifeRow) => string[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const r of rows) for (const x of f(r)) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const sy8 = tally(v8, (r) => r.sameYearCleared);
  const sy9 = tally(v9, (r) => r.sameYearCleared);
  const cb8 = tally(v8, (r) => [...new Set(r.lineChoiceBad)]);
  const cb9 = tally(v9, (r) => [...new Set(r.lineChoiceBad)]);
  say('| 걸린 것 | 구분 | V8 일어난 판 | V9 일어난 판 |');
  say('|---|---|---:|---:|');
  for (const id of [...new Set([...sy8.keys(), ...sy9.keys()])].sort()) say(`| \`${id}\` | 사건 (R-631) | ${sy8.get(id) ?? 0} | ${sy9.get(id) ?? 0} |`);
  for (const id of [...new Set([...cb8.keys(), ...cb9.keys()])].sort()) say(`| \`${id}\` | 선택지 (R-632) | ${cb8.get(id) ?? 0} | ${cb9.get(id) ?? 0} |`);
  say();
  say('| 사건 (조건 flags가 형제·조부모 플래그) | V8 일어난 판 | V9 일어난 판 | 변화 |');
  say('|---|---:|---:|---:|');
  CLEARED_READER_IDS.forEach((id, i) => {
    const seenN = (rows: LifeRow[]): number => rows.filter((r) => r.clearedSeen[i] !== null).length;
    say(`| \`${id}\` | ${seenN(v8)} | ${seenN(v9)} | ${signed(seenN(v9) - seenN(v8))} |`);
  });
  say();
  say(
    `- 「인생 기록이 달라진 판」은 연표(나이 · 사건 · 고른 선택지)의 해시가 V8과 다른 판이다 — 줄 해의 후보·선택지가 바뀐 판과, 그 뒤 흐름이 옮겨 간 판을 함께 센다. 이름을 적은 배열(\`familyTick.ts#SIBLING_LINE_FLAGS·GRANDPARENT_LINE_FLAGS\`) 밖의 플래그는 보지 않는다. R-632의 교집합은 새로 열리는 선택지가 없다(한 방향).`,
  );
  say();
  say('- **V8·V9에는 형제 줄이 없다**(Q3는 V11에서 켠다 — `sibLoss: false`). 그래서 위 V8 → V9의 바뀐 판·사건 표는 조부모 줄과 부모 한 분 별세 줄(R-632)만의 영향이고, 형제 쪽 사건(`infant-follow-sibling`·`infant-sibling-toy`·`school-family-priority`)의 「+0」은 측정값이 아니다. 형제 줄이 난 해의 R-631·R-632 영향은 V10 → V11 표에 함께 들어 있고, 같은 해 점검은 위 V11 열과 tests/familyConsistency.test.ts(7000판 INV)·tests/familyFm7a.test.ts 「R-631: …」 합성 시험이 본다.');
  say();

  // senior-alone
  say('### 8-5. senior-alone과 함께 사는 자녀 (R-586)');
  say();
  const sa9 = v9.filter((r) => r.seniorAlone).length;
  const sa10 = v10.filter((r) => r.seniorAlone).length;
  say(`- \`senior-alone\`이 일어난 판: V9 ${sa9} → V10 ${sa10} (판의 ${pct((100 * sa9) / v9.length, 2)} → ${pct((100 * sa10) / v10.length, 2)}). 자녀는 늦어도 주인공 45세에 태어나 75세에는 30세 이상이라 \`leaveAge\`(20~30)에 모두 닿아, 이 조건이 거르는 것은 70~74세의 늦둥이 판뿐이다.`);
  say();

  // Q3
  say('### 8-6. Q3 어린 형제의 이른 별세와 상속');
  say();
  const by10 = new Map(v10.map((r) => [key(r), r]));
  say('| 세대 | 판 수 | 형제가 떠난 판 | 비율 |');
  say('|---|---:|---:|---:|');
  for (const gen of GENERATION_IDS) {
    const g = v11b.filter((r) => r.gen === gen);
    const hit = g.filter((r) => r.siblingLost).length;
    say(`| ${gen} | ${g.length} | ${hit} | ${pct((100 * hit) / Math.max(1, g.length))} |`);
  }
  const q3 = v11b.filter((r) => r.siblingLost);
  say(`| 전체 | ${v11b.length} | ${q3.length} | ${pct((100 * q3.length) / v11b.length)} |`);
  say();
  const q3pairs = q3.map((r) => [by10.get(key(r))!, r] as const);
  const dSib = q3pairs.map(([a, b]) => b.siblingsView - a.siblingsView);
  const dInh = q3pairs.map(([a, b]) => b.inheritView - a.inheritView);
  const dFin = q3pairs.filter(([a, b]) => a.finalNet !== null && b.finalNet !== null).map(([a, b]) => b.finalNet! - a.finalNet!);
  say(
    `- **형제가 떠난 판만 본 차이**(같은 시드의 V10과 짝지음, 보고만): 판 ${q3pairs.length}개 · 끝난 판의 형제 수 평균 ${num(mean(dSib), 2)} · 상속액 평균 ${num(mean(dInh), 0)}만 원(상속식 \`INHERIT ÷ (형제 수 + 1)\`의 형제 수가 하나 줄어든다 — 두 분이 모두 떠난 해 한 번) · 최종 순자산 평균 ${num(mean(dFin), 0)}만 원. 전체 판의 평균으로 풀면 재력 단계별 변화는 위 8절 V10 → V11 표가 보인다.`,
  );
  say();
}

say(REPORT_NOTES);
const text = out.join('\n') + '\n';
if (WRITE) {
  writeFileSync('docs/data/family-remeasure.md', text, 'utf-8');
  console.error('docs/data/family-remeasure.md를 썼다');
} else console.log(text);
