import '../src/data/installAll';
import { writeFileSync } from 'node:fs';
import { GENERATION_IDS } from '../src/core';
import { REPORT_NOTES, VARIANTS, mean, measureVariant, tierStats, type LifeRow, type Variant } from './familyRemeasureLib';

/**
 * 가족 변경(SPEC-009 FM4b)의 분포 재측정 보고 (설계 문서 12-1절 L2): `docs/data/family-remeasure.md`를 쓴다.
 * 실행: ./node_modules/.bin/vite-node scripts/familyRemeasure.ts [세대당 판수=600] [--write]
 *   (npm run report:family -- 600 --write)
 * 같은 시드·같은 자동 성향 선택으로 원인(K2 · K4 · 이른 부모 별세 효과 · K1)을 하나씩 켠 다섯 세계를 돌려 짝지어 견준다. 합격 기준은 설계 문서 4-7절 (1):
 *   ① 재력 단계별 20세 시작 자산·최종 순자산 중앙값 변화 ≤ 3%  ② 단계 순서 뒤바뀜 0  ③ 엔딩 방향 판정 분포 변화 ≤ 2%p  ④ 효과가 걸린 판 비율 보고
 */
const argN = process.argv.slice(2).find((a) => /^\d+$/.test(a));
const PER_GEN = Number(argN ?? 600);
const WRITE = process.argv.includes('--write');

const pct = (x: number, d = 1): string => `${x.toFixed(d)}%`;
const num = (x: number, d = 0): string => x.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
/** 상대 변화(%): 분모는 |앞| 이되 최소 1,000만 원 — 중앙값이 0에 가까운 낮은 단계에서 −150 → 0이 100%로 읽히지 않게 한다 */
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
  maxNet20: number;
  maxFinal: number;
  maxMovePp: number;
  orderFlips: number;
}
function compare(from: LifeRow[], to: LifeRow[], title: string): Cmp {
  say(`#### ${title}`);
  say();
  say('| 재력 | 판 수 | 20세 시작 순자산 중앙값 (만 원) | 변화 | 평균 (만 원) | 최종 순자산 중앙값 (만 원) | 변화 | 평균 (만 원) | 앞섬 / 비슷함 / 뒤쪽 (%p 변화) |');
  say('|---:|---:|---|---:|---|---|---:|---|---|');
  let maxNet20 = 0;
  let maxFinal = 0;
  let maxMovePp = 0;
  const f = TIERS.map((t) => tierStats(from, t));
  const g = TIERS.map((t) => tierStats(to, t));
  TIERS.forEach((t, i) => {
    const a = f[i];
    const b = g[i];
    const d20 = rel(a.medianNet20, b.medianNet20);
    const dF = rel(a.medianFinalNet, b.medianFinalNet);
    maxNet20 = Math.max(maxNet20, Math.abs(d20));
    maxFinal = Math.max(maxFinal, Math.abs(dF));
    const share = (s: typeof a, k: 'up' | 'same' | 'down') => (100 * s.movement[k]) / Math.max(1, s.movement.up + s.movement.same + s.movement.down);
    const dm = (['up', 'same', 'down'] as const).map((k) => share(b, k) - share(a, k));
    maxMovePp = Math.max(maxMovePp, ...dm.map(Math.abs));
    say(`| ${t} | ${a.n} | ${num(a.medianNet20)} → ${num(b.medianNet20)} | ${pct(d20, 2)} | ${num(a.meanNet20)} → ${num(b.meanNet20)} | ${num(a.medianFinalNet)} → ${num(b.medianFinalNet)} | ${pct(dF, 2)} | ${num(a.meanFinalNet)} → ${num(b.meanFinalNet)} | ${dm.map((x) => `${x >= 0 ? '+' : ''}${x.toFixed(2)}`).join(' / ')} |`);
  });
  // 단계 순서 뒤바뀜: 앞 세계에서 낮은 단계 중앙값 ≤ 높은 단계 중앙값이었는데 뒤 세계에서 뒤집힌 쌍
  let flips = 0;
  for (let i = 0; i < TIERS.length; i++) {
    for (let j = i + 1; j < TIERS.length; j++) {
      for (const key of ['medianNet20', 'medianFinalNet'] as const) if (f[i][key] <= f[j][key] && g[i][key] > g[j][key]) flips++;
    }
  }
  say();
  say(`- 가장 큰 변화: 20세 시작 ${pct(maxNet20, 2)} · 최종 ${pct(maxFinal, 2)} · 판정 ${maxMovePp.toFixed(2)}%p · 단계 순서 뒤바뀜 ${flips}쌍`);
  say();
  return { maxNet20, maxFinal, maxMovePp, orderFlips: flips };
}

say('# 가족 변경의 분포 재측정 (SPEC-009 FM4b)');
say();
say('- 생성: `npm run report:family -- ' + PER_GEN + ' --write` (scripts/familyRemeasure.ts) — **직접 고치지 않는다.** 설계 문서 `family-model.md` 12-1절 L2, 4-7절 (1) 합격 기준, 7-1절 K1.');
say(`- 표본: 7세대 × ${PER_GEN}판 = ${PER_GEN * 7}판을 변이마다 돌렸다(세대마다 다른 시드 열, 같은 시드·같은 자동 성향 선택 → 짝지은 표본). 변화 = (뒤 − 앞) ÷ max(|앞|, 1,000만 원). 판정은 엔딩 방향(앞섬·비슷함·뒤쪽)이고 20세 전에 끝난 판은 센다에서 뺐다.`);
say('- 세계: ' + VARIANTS.map((v) => `**${v.id}** ${v.label}`).join(' · '));
say();

say('## 1. 이른 부모 별세 효과 (V2 → V3) — 합격 기준 ①~④');
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
  say('**효과가 걸린 판만 본 차이**(같은 시드의 V2와 짝지음):');
  say();
  const v2 = new Map(R('V2').map((r) => [`${r.gen}/${r.seed}`, r]));
  const pairs = rows.filter((r) => r.earlyLoss).map((r) => [v2.get(`${r.gen}/${r.seed}`)!, r] as const);
  const d20 = pairs.filter(([a, b]) => a.net20 !== null && b.net20 !== null).map(([a, b]) => b.net20! - a.net20!);
  const dFin = pairs.filter(([a, b]) => a.finalNet !== null && b.finalNet !== null).map(([a, b]) => b.finalNet! - a.finalNet!);
  const earlyDeath = pairs.filter(([a, b]) => b.deathAge < a.deathAge).length;
  say(`- 판 ${pairs.length}개: 20세 시작 순자산 평균 ${num(mean(d20), 1)}만 원 · 최종 순자산 평균 ${num(mean(dFin), 1)}만 원 · 사망 나이 평균 ${mean(pairs.map(([a, b]) => b.deathAge - a.deathAge)).toFixed(2)}세(효과 때문에 더 일찍 죽은 판 ${earlyDeath}개)`);
  say();
}
const verdict =
  earlyCmp.maxNet20 <= 3 && earlyCmp.maxFinal <= 3 && earlyCmp.orderFlips === 0 && earlyCmp.maxMovePp <= 2
    ? '**합격**'
    : `**기준 초과** (20세 ${earlyCmp.maxNet20.toFixed(2)}% · 최종 ${earlyCmp.maxFinal.toFixed(2)}% · 판정 ${earlyCmp.maxMovePp.toFixed(2)}%p · 뒤바뀜 ${earlyCmp.orderFlips}쌍)`;
say(`판정: ${verdict} — ① 중앙값 변화 ≤ 3% ② 순서 뒤바뀜 0 ③ 판정 변화 ≤ 2%p.`);
say();

say('#### 대안: 효과를 절반으로 줄이면 (V2 → V3h: 행복 −4 · 관계 −1 · 건강 −1, 집안 살림 아버지 −250 · 어머니 −150 · 집안일 −75)');
say();
const halfCmp = compare(R('V2'), R('V3h'), '재력 단계별 (7세대 합친)');
say(`- 절반으로 줄여도 중앙값 변화 기준(≤ 3%)을 못 지키는 칸이 있다면 중앙값의 성질 때문이다: 낮은 단계의 20세 시작 순자산은 학자금 대출 바닥(−150) 근처에 모여 있어 한 칸(150만 원) 옮겨가면 중앙값이 한 번에 옮겨 간다 — 평균 칸을 함께 봐 달라(위 표).`);
say(`- 대안 판정: ${halfCmp.maxNet20 <= 3 && halfCmp.maxFinal <= 3 && halfCmp.orderFlips === 0 && halfCmp.maxMovePp <= 2 ? '합격' : `20세 ${halfCmp.maxNet20.toFixed(2)}% · 최종 ${halfCmp.maxFinal.toFixed(2)}% · 판정 ${halfCmp.maxMovePp.toFixed(2)}%p · 뒤바뀜 ${halfCmp.orderFlips}쌍`}`);
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

say(REPORT_NOTES);
const text = out.join('\n') + '\n';
if (WRITE) {
  writeFileSync('docs/data/family-remeasure.md', text, 'utf-8');
  console.error('docs/data/family-remeasure.md를 썼다');
} else console.log(text);
