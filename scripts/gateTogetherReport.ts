import {
  autoResolveStep,
  calendarYear,
  condContextOf,
  estimatePlaySeconds,
  familyChangesFor,
  isEventEligible,
  militaryDueOf,
  playToEnd,
  resolveChoiceStep,
  stepYear,
  timingEraOf,
  totalCards,
  withGateTogether,
  type GameState,
  type ProfileId,
} from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { withEarlyLoss } from './familyRulesLib';
import { chooserFor, startLife } from './simulateLib';

/**
 * G2 「같은 해에 함께」(결정 후속 255) 전후 짝 측정 — `npm run report:gate -- [판수] [--only=cards,stat20,exposure]` 대신 `vite-node scripts/gateTogetherReport.ts`로 돈다.
 * 「전」 = 같은 프로세스의 `withGateTogether(false)`(= 엔진 변경 전, 얼린 해시가 증명), 「후」 = 켬. 시드 `i × 7919 + 13`. **판정이 아니라 보고**다 — 임계는 마스터가 형진 님 보고 뒤 정한다.
 *  - cards: 세대 3종 × 무작위 선택 판수(기본 1000)의 c_self · 13~18세 본인 카드 · 65세 이상 카드 · 총 카드 · 판당 leadCards · 모델 시간(중앙·높음)의 같은 시드 짝 차(평균 ± SE)
 *  - stat20: `tests/stat20Guard.test.ts`의 `meansAt20`과 같은 식(시드 `(i×7919+13)>>>0`, 3000판, 무작위, 이른 별세 효과 끈 세계)의 20세 평균 전·후
 *  - exposure: 네 세대 × 3000판의 G2 노출(20세까지 산 판 기준)과 미노출 사유
 */

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const n = Number(args.find((a) => !a.startsWith('--')) ?? 1000);
const only = new Set((flag('only') ?? 'cards,stat20,exposure').split(','));
const seedOf = (i: number): number => i * 7919 + 13;
const G2 = 'school-high-pick';
const GENS3: readonly ProfileId[] = ['industrial', 'genx', 'alpha'];
const f = (x: number, d = 2): string => x.toFixed(d);

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const sd = (xs: readonly number[]): number => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const se = (xs: readonly number[]): number => sd(xs) / Math.sqrt(Math.max(1, xs.length));

interface LifeRow {
  cSelf: number;
  own1318: number;
  cards65: number;
  total: number;
  lead: number;
  leadSelf: number;
  secMedian: number;
  secHigh: number;
  deathAge: number;
}

function lifeRow(seed: number, gen: ProfileId): LifeRow {
  const start = startLife(seed, gen);
  const run = playToEnd(start, chooserFor('random', seed));
  const final = run.state;
  const rows = final.history.filter((h) => h.kind === 'choice');
  const era = timingEraOf(final.generation, final.character?.birthYear ?? 2000);
  const slow = { speed: 1 as const, skipToDecision: false };
  return {
    cSelf: run.counts.choice,
    own1318: rows.filter((h) => h.by === undefined && h.age >= 13 && h.age <= 18).length,
    cards65: rows.filter((h) => h.age >= 65).length,
    total: totalCards(run.counts),
    lead: run.counts.leadCards ?? 0,
    leadSelf: run.counts.leadReadMs === undefined ? 0 : 1,
    secMedian: estimatePlaySeconds(run.counts, slow, final.lifeLength, era, 'median'),
    secHigh: estimatePlaySeconds(run.counts, slow, final.lifeLength, era, 'high'),
    deathAge: final.death?.age ?? final.age,
  };
}

function cardsReport(): void {
  console.log(`\n## cards — 같은 시드 짝(전 = 표지 끔, 후 = 켬) · 무작위 선택 · ${n}판 × 세대 3종\n`);
  console.log('| 세대 | 항목 | 전 평균 | 후 평균 | 짝 차 평균 | 짝 차 SE | 차/SE |');
  console.log('|---|---|---:|---:|---:|---:|---:|');
  const pooled: Record<string, number[]> = {};
  for (const gen of GENS3) {
    const before: LifeRow[] = [];
    const after: LifeRow[] = [];
    for (let i = 1; i <= n; i++) {
      const seed = seedOf(i);
      before.push(withGateTogether(false, () => lifeRow(seed, gen)));
      after.push(lifeRow(seed, gen));
    }
    const cols: Array<[string, (r: LifeRow) => number]> = [
      ['c_self(본인 카드)', (r) => r.cSelf],
      ['13~18세 본인 카드', (r) => r.own1318],
      ['13~18세 0장 판 비율(%)', (r) => (r.own1318 === 0 ? 100 : 0)],
      ['65세 이상 카드', (r) => r.cards65],
      ['총 카드', (r) => r.total],
      ['판당 leadCards', (r) => r.lead],
      ['본인 동반 판 비율(%)', (r) => r.leadSelf * 100],
      ['모델 시간 중앙(분)', (r) => r.secMedian / 60],
      ['모델 시간 높음(분)', (r) => r.secHigh / 60],
    ];
    for (const [name, pick] of cols) {
      const a = before.map(pick);
      const b = after.map(pick);
      const d = b.map((x, i) => x - a[i]);
      (pooled[name] ??= []).push(...d);
      console.log(`| ${gen} | ${name} | ${f(mean(a), 3)} | ${f(mean(b), 3)} | ${f(mean(d), 3)} | ${f(se(d), 3)} | ${se(d) > 0 ? f(mean(d) / se(d), 1) : '-'} |`);
    }
    const dead = after.filter((r) => r.deathAge < 16).length;
    console.log(`| ${gen} | (참고) 후 판 중 16세 전 사망 | | ${dead} | | | |`);
  }
  console.log('\n세 세대 합친 짝 차(평균 ± SE):');
  for (const [name, d] of Object.entries(pooled)) console.log(`- ${name}: ${f(mean(d), 3)} ± ${f(se(d), 3)}`);
}

function stat20Report(): void {
  const LIVES = 3000;
  const run = (gen: ProfileId): { n: number; mean: number[] } => {
    const sums = [0, 0, 0, 0];
    let cnt = 0;
    for (let i = 1; i <= LIVES; i++) {
      const seed = (i * 7919 + 13) >>> 0;
      let s: GameState = startLife(seed, gen);
      const chooser = chooserFor('random', seed);
      for (let g = 0; s.phase === 'life' && s.age < 20; g++) {
        if (g >= 3000) throw new Error('진행이 끝나지 않는다');
        const r =
          s.pending !== null
            ? (() => {
                const picked = chooser === null ? null : chooser(s);
                return picked === null ? autoResolveStep(s, s.pending.key) : resolveChoiceStep(s, s.pending.key, picked);
              })()
            : stepYear(s);
        s = r.state;
      }
      if (s.phase !== 'life' || s.age < 20) continue;
      cnt++;
      sums[0] += s.stats.education;
      sums[1] += s.stats.health;
      sums[2] += s.stats.happiness;
      sums[3] += s.stats.relationships;
    }
    return { n: cnt, mean: sums.map((x) => x / cnt) };
  };
  console.log(`\n## stat20 — 20세 평균 스탯(지식·건강·행복·관계), 3000판 × 세대 3종, 무작위, 이른 별세 효과 끔(\`tests/stat20Guard.test.ts\`의 meansAt20과 같은 식)\n`);
  console.log('| 세대 | 전(끔) n | 전 [지식, 건강, 행복, 관계] | 후(켬) n | 후 [지식, 건강, 행복, 관계] | 후 − 전 |');
  console.log('|---|---:|---|---:|---|---|');
  for (const gen of GENS3) {
    const before = withEarlyLoss(false, () => withGateTogether(false, () => run(gen)));
    const after = withEarlyLoss(false, () => run(gen));
    console.log(`| ${gen} | ${before.n} | [${before.mean.map((x) => f(x, 4)).join(', ')}] | ${after.n} | [${after.mean.map((x) => f(x, 4)).join(', ')}] | [${after.mean.map((x, i) => (x - before.mean[i] >= 0 ? '+' : '') + f(x - before.mean[i], 4)).join(', ')}] |`);
  }
}

function exposureReport(): void {
  const N = 3000;
  console.log(`\n## exposure — G2 노출(20세까지 산 판 기준), 네 세대 × ${N}판 (시드 i×7919+13, 자동 선택, 20세까지)\n`);
  console.log('| 세대 | 20세까지 산 판 | G2 노출 | 노출 % | 자격 있고 슬롯 비었는데 안 난 판 | 미노출 사유: 15세 전 left_school | 그 밖 |');
  console.log('|---|---:|---:|---:|---:|---:|---:|');
  const ev = EVENT_POOL.byId.get(G2)!;
  for (const gen of ['industrial', 'genx', 'millennial', 'alpha'] as const) {
    let alive20 = 0;
    let shown = 0;
    let missedEligible = 0;
    let left = 0;
    let other = 0;
    for (let i = 1; i <= N; i++) {
      let s: GameState = startLife(seedOf(i), gen);
      let pre15: GameState | null = null;
      let seen15 = false;
      for (let g = 0; s.phase === 'life' && s.age <= 20 && g < 200; g++) {
        if (s.pending !== null) {
          s = autoResolveStep(s, s.pending.key).state;
          continue;
        }
        if (s.age === 15 && pre15 === null) pre15 = s;
        const r = stepYear(s);
        if (s.age === 15 && r.state.seen[G2] === 15) seen15 = true;
        s = r.state;
      }
      if (!(s.phase === 'life' && s.age >= 20)) continue;
      alive20++;
      if (seen15) {
        shown++;
        continue;
      }
      const pre = pre15!;
      const view = { ...condContextOf(pre), age: 15, year: calendarYear(pre.character!.birthYear, 15), seen: pre.seen };
      const eligible = isEventEligible(ev, view);
      const slotFree = familyChangesFor(pre, 15, EVENT_POOL).forcedEvent === undefined && militaryDueOf(pre, EVENT_POOL, 15) === null;
      if (eligible && slotFree) missedEligible++;
      else if (pre.flags.includes('left_school')) left++;
      else other++;
    }
    console.log(`| ${gen} | ${alive20} | ${shown} | ${f((shown / alive20) * 100, 2)} | ${missedEligible} | ${left} | ${other} |`);
  }
}

console.log(`# G2 같은 해에 함께 — 전후 짝 측정 (판수 ${n} · 시드 i×7919+13)`);
if (only.has('cards')) cardsReport();
if (only.has('stat20')) stat20Report();
if (only.has('exposure')) exposureReport();
