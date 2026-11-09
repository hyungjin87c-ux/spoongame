import { GENERATION_IDS as ERAS, profileLabel, type ProfileId } from '../src/core';
import { ASK_KINDS, ASK_PET_ENABLED } from '../src/data/askTable';
import { EVENT_POOL } from '../src/data/events';
import { cardMoveOf, choiceShare, dominanceOf, exposureOf, grantRows, poolWithoutAsk, sampleAsk, strainStats, type AskLife, type AskStrategy } from './askReportLib';

/**
 * 어린 시절 조르기 보고 (SPEC-011 AK10, 결정 AQ8·AQ9 — 설계 문서 `docs/data/ask-model.md` 5-1·11·12절): **판정이 아니라 보고**다. 단언은 tests/askSim.test.ts가 한다.
 * 실행: npm run report:ask [-- 판수=1000] [--only=exposure,grant,strain,share,dominance,cards]
 *   exposure   판당 조르기 장수 분포 0/1/2/3 · 종류별 등장 · 첫 조르기 카드 나이 (완료 기준 1·2)
 *   grant      재력 × 종류 × 선택의 들어줌 비율과 식의 기대값(4σ), 5단계 − 1단계 (완료 기준 6)
 *   strain     떼쓰다 거절당한 가운데 사이 나빠짐 비율과 s(C)의 기대값(완료 기준 7)
 *   share      선택 비율 — 자동 성향 / 무작위 / 기대 행복 최대 전략(AQ9: 떼쓰기가 60%를 넘으면 마스터가 11절 사다리 사용 여부를 정한다)
 *   dominance  (종류 × 재력 × 양육 × 사이) 칸의 한 선택지 최대 비율(완료 기준 10, 자동 성향)
 *   cards      부모+흘러감 카드·본인 카드의 이동(조르기 사건을 뺀 풀과 같은 시드로 견준다, 완료 기준 2)
 * 20세가 되기 전까지만 돌린다. 시드 i × 7919 + 13(세대마다 구간을 100000씩 띄운다 — 같은 시드는 세대가 달라도 같은 가족 해시라 표본이 독립이 아니게 된다). 7세대 × 판수(기본 1000 = 7000판) × 전략 셋.
 */
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const lives = Number(args.find((a) => !a.startsWith('--')) ?? 1000);
const only = new Set((flag('only') ?? 'exposure,grant,strain,share,dominance,cards').split(','));
if (!Number.isInteger(lives) || lives < 1) {
  console.error('사용법: npm run report:ask [-- 판수(1 이상 정수) --only=exposure,grant,strain,share,dominance,cards]');
  process.exit(2);
}
const f = (n: number | null, d = 2): string => (n === null ? '-' : n.toFixed(d));
const pct = (n: number | null, d = 1): string => (n === null ? '-' : (n * 100).toFixed(d));
const KIND_LABEL = { toy: '장난감·게임기', lessons: '예체능·배움', pet: '강아지' } as const;

console.log(`# 어린 시절 조르기 보고 (AK10) — 20세 전까지 · 시드 i×7919+13 · 7세대 × ${lives}판 = ${ERAS.length * lives}판 · 반려동물 ${ASK_PET_ENABLED ? '켜짐' : '꺼짐'} · 조르기 사건 ${EVENT_POOL.events.filter((e) => e.ask !== undefined).length}개`);

const STRATEGIES: AskStrategy[] = ['auto', 'random', 'evmax'];
const sample = {} as Record<AskStrategy, Record<ProfileId, AskLife[]>>;
for (const st of STRATEGIES) {
  sample[st] = {} as Record<ProfileId, AskLife[]>;
  ERAS.forEach((era, gi) => (sample[st][era] = sampleAsk(era, lives, st, EVENT_POOL, gi)));
}
const allOf = (st: AskStrategy): AskLife[] => ERAS.flatMap((e) => sample[st][e]);

if (only.has('exposure')) {
  for (const st of ['auto', 'random'] as const) {
    console.log(`\n## 노출 — 전략 ${st} (목표: 1장 이상 ≥ 80%▲ · 판당 평균 1.5~2.5장▲, 세대별)`);
    console.log('| 세대 | 0장 | 1장 | 2장 | 3장+ | 평균 | 1장 이상 | 장난감 | 예체능 | 강아지 | 첫 카드 평균 나이 | 6세까지 | 8세까지 | 같은 해 2장 | 종류당 최대 | 판당 최대 |');
    console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const era of [...ERAS, 'all' as const]) {
      const e = exposureOf(era === 'all' ? allOf(st) : sample[st][era]);
      console.log(`| ${era === 'all' ? '**전체**' : profileLabel(era)} | ${e.dist.map((x) => pct(x, 1)).join(' | ')} | **${f(e.mean)}** | **${pct(e.shareAtLeast1)}%** | ${ASK_KINDS.map((k) => pct(e.kindShare[k], 0)).join(' | ')} | ${f(e.firstAgeMean, 1)} | ${pct(e.firstAgeShare.upTo6, 0)}% | ${pct(e.firstAgeShare.upTo8, 0)}% | ${e.sameYear} | ${e.maxPerKind} | ${e.max} |`);
    }
  }
  console.log(`\n종류 표기: ${ASK_KINDS.map((k) => `${k} = ${KIND_LABEL[k]}`).join(' · ')}`);
}

if (only.has('grant')) {
  console.log('\n## 들어줌 비율 — 재력 단계 × 종류 (무작위 전략 — 세 선택이 고르게 나와 표본이 가장 고르다) — 실측 / 식의 기대값(고르기 직전 p의 평균) / 4σ 안인가');
  const rows = grantRows(allOf('random'));
  console.log('| 종류 | 선택 | 1단계 | 2단계 | 3단계 | 4단계 | 5단계 | 5−1단계(%p) |');
  console.log('|---|---|---:|---:|---:|---:|---:|---:|');
  for (const kind of ASK_KINDS) {
    for (const choice of ['beg', 'tantrum'] as const) {
      const r = [1, 2, 3, 4, 5].map((w) => rows.find((x) => x.kind === kind && x.wealth === w && x.choice === choice));
      if (r.some((x) => x === undefined)) continue;
      const cell = (x: (typeof rows)[number]) => `${pct(x.granted, 1)} / ${pct(x.expected, 1)}${Math.abs(x.granted - x.expected) <= 4 * x.sd ? '' : ' ✗'}`;
      console.log(`| ${KIND_LABEL[kind]} | ${choice === 'beg' ? '조른다' : '떼쓴다'} | ${r.map((x) => cell(x!)).join(' | ')} | ${f((r[4]!.granted - r[0]!.granted) * 100, 1)} |`);
    }
  }
  console.log('(✗ = 식의 기대값에서 4σ 밖)');
}

if (only.has('strain')) {
  console.log('\n## 사이 비용 — 떼쓰다 거절당한 가운데 사이 나빠짐 (기대값 = Σ s(C), 4σ)');
  console.log('| 전략 | 떼쓰기 거절 | 사이 나빠짐 | 비율 | 기대 비율 | 4σ 안 | 사이 나빠진 판 | 이미 서먹한데 또 거절 | 떼쓰기 거절 밖의 사이 나빠짐 |');
  console.log('|---|---:|---:|---:|---:|---|---:|---:|---:|');
  for (const st of STRATEGIES) {
    const s = strainStats(allOf(st));
    console.log(`| ${st} | ${s.tantrumDenied} | ${s.strained} | ${pct(s.strained / s.tantrumDenied)}% | ${pct(s.expected / s.tantrumDenied)}% | ${Math.abs(s.strained - s.expected) <= 4 * s.sd ? '예' : '**아니오**'} | ${pct(s.livesStrained)}% | ${s.alreadyStrained} | ${s.strainedOutsideTantrumDenied} |`);
  }
}

if (only.has('share')) {
  console.log('\n## 선택 비율 (조르기 카드 전체) — AQ9: 기대 행복 최대 전략에서 떼쓰기가 60%를 넘으면 마스터가 11절 사다리(떼쓰기 보너스 0.10 → 0.08 또는 떼쓰기 거절 행복 −3 → −4) 사용 여부를 정한다');
  console.log('| 전략 | 카드 수 | 조른다 | 떼를 쓴다 | 참는다 |');
  console.log('|---|---:|---:|---:|---:|');
  for (const st of STRATEGIES) {
    const c = choiceShare(allOf(st));
    console.log(`| ${st} | ${c.n} | ${pct(c.beg)}% | ${pct(c.tantrum)}% | ${pct(c.endure)}% |`);
  }
  const ev = choiceShare(allOf('evmax'));
  console.log(`\nAQ9 판정 재료: 기대 행복 최대 전략의 떼쓰기 비율 **${pct(ev.tantrum)}%** — ${ev.tantrum > 0.6 ? '60% 초과 → 마스터가 사다리 사용 여부를 정한다' : '60% 이하 → 사다리를 쓰지 않는다'}`);
  console.log('\n### 자동 성향 — 재력 단계별 선택 비율');
  console.log('| 재력 | 조른다 | 떼를 쓴다 | 참는다 | n |');
  console.log('|---|---:|---:|---:|---:|');
  for (const w of [1, 2, 3, 4, 5]) {
    const c = choiceShare(allOf('auto'), (a) => a.wealth === w);
    console.log(`| ${w}단계 | ${pct(c.beg)}% | ${pct(c.tantrum)}% | ${pct(c.endure)}% | ${c.n} |`);
  }
  console.log('\n### 기대 행복 최대 전략 — 종류별 선택 비율');
  console.log('| 종류 | 조른다 | 떼를 쓴다 | 참는다 | n |');
  console.log('|---|---:|---:|---:|---:|');
  for (const k of ASK_KINDS) {
    const c = choiceShare(allOf('evmax'), (a) => a.kind === k);
    if (c.n > 0) console.log(`| ${KIND_LABEL[k]} | ${pct(c.beg)}% | ${pct(c.tantrum)}% | ${pct(c.endure)}% | ${c.n} |`);
  }
  console.log('\n### 기대 행복 최대 전략 — 재력 단계별 떼쓰기 비율 (부유한 칸에서 떼쓰기가 거의 공짜로 보이는지)');
  console.log('| 재력 | 조른다 | 떼를 쓴다 | 참는다 | n |');
  console.log('|---|---:|---:|---:|---:|');
  for (const w of [1, 2, 3, 4, 5]) {
    const c = choiceShare(allOf('evmax'), (a) => a.wealth === w);
    console.log(`| ${w}단계 | ${pct(c.beg)}% | ${pct(c.tantrum)}% | ${pct(c.endure)}% | ${c.n} |`);
  }
}

if (only.has('dominance')) {
  console.log('\n## 지배 방지 — 자동 성향, (종류 × 재력 × 양육 방식 × 사이 C) 칸(표본 ≥ 30)의 한 선택지 최대 비율 (완료 기준 10: ≤ 90%▲, 손계산 최대 약 42%)');
  const cells = dominanceOf(allOf('auto'));
  const worst = cells.reduce((b, x) => (x.max > b.max ? x : b), cells[0]);
  console.log(`칸 ${cells.length}개 · 최대 ${pct(worst.max)}% (${worst.cell}, ${worst.top}, n=${worst.n}) · 90% 초과 ${cells.filter((c) => c.max > 0.9).length}칸`);
}

if (only.has('cards')) {
  console.log('\n## 카드 이동 (같은 시드 · 같은 전략으로 조르기 사건을 뺀 풀과 견준다) — 20세 전 판당 평균');
  const base = poolWithoutAsk();
  console.log('| 전략 | 조르기 사건 | 부모 | 흘러감 | 부모+흘러감 | 본인(조르기 포함) | 조르기 | 20세 전 사망 |');
  console.log('|---|---|---:|---:|---:|---:|---:|---:|');
  for (const st of ['auto', 'random'] as const) {
    const without = ERAS.flatMap((era, gi) => sampleAsk(era, lives, st, base, gi));
    for (const [name, l] of [['없음(기준선)', without], ['있음', allOf(st)]] as const) {
      const c = cardMoveOf(l);
      console.log(`| ${st} | ${name} | ${f(c.parent)} | ${f(c.child)} | **${f(c.parent + c.child)}** | ${f(c.self)} | ${f(exposureOf(l).mean)} | ${pct(c.diedYoung, 2)}% |`);
    }
  }
}
