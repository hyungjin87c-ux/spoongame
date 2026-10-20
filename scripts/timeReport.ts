import { ERAS, STAGES, type Era, type LifeLength } from '../src/core';
import { STAGE_TABLE } from '../src/data/lifeTable';
import { INFANT_CHOICE_MEAN_MIN, LIFE_LENGTH_MODES, READ_MODEL, SENIOR_CHOICE_MEAN_MIN } from '../src/data/timingTable';
import { NOTE_CARDS } from '../src/data/noteCards';
import { EVENT_POOL } from '../src/data/events';
import { infantLives, summarizeInfant } from './infantMetricsLib';
import { infantMargins, marginReport } from './marginsLib';
import { runNoteSchedule } from './noteScheduleLib';
import { chooserFor, type Strategy } from './simulateLib';
import {
  LEGACY_MODEL,
  NATURAL,
  charStatsOf,
  extraLineMsFor,
  holdMsFor,
  measureMany,
  parseCandidates,
  poolCharStats,
  readSecFor,
  summarize,
  withCandidate,
  type Candidate,
  type EraSummary,
  type LifeMeasure,
} from './timeReportLib';

/**
 * 시간 모델 보고 (SPEC-003 LM2·LM4·LM7, M8 — docs/data/content-M8.md 6-5절): **판정이 아니라 보고**다. 불변식 위반(해 수 합·카드 수·인생 길이 고정·하드 상한)이 하나라도 있으면 종료 코드 1.
 * 실행: npm run report:time [-- 판수=1000] [--strategy=random|auto] [--mode=short30|long60|both] [--only=current,natural,legacy,chars,notes,infant,margins,candidates] [--cands=soft:hard[:빈도+],…]
 *   current    현재 설정(모드 표의 페이싱)의 판당 결정 카드 수 분포와 시간 (시대별 · 읽기 수준별)
 *   natural    페이싱을 끈 자연 분포 (soft = hard = 무한) — 이 풀·빈도의 한계
 *   legacy     M8 이전 모델 재현 (페이싱 23/0.3/26, 연출 계수 1, 읽기 18초) — 문서 1-3절 표와 맞는지
 *   chars      실제 글자 수(제목·본문·선택지·결과·영향 줄·인용) 실측과 READ_MODEL 대조, 카드별 정밀 합계와 시대 상수의 차
 *   notes      기록 카드(M7c) 참고 시간 — 목표 밖의 참고 항 (LD-1)
 *   infant     영유아(0~7세) 수치 (sim:infant와 같은 정의)
 *   margins    판정 여유 표 (REV-003-M8-1 R-415, LD-9) — 시대 × 전략(수동 흉내·자동 성향) × 시드 줄(시험 / sim:1000)별 모델 시간·카드 평균(± SE)과 새 판정 지표 전부의 여유(표준오차 배수). 기본에서 빠진다(오래 걸림)
 *   hold       연출 계수 k별 1배속 수동 예상(읽기 중앙, 시대별·세 시대 평균) — 부모님이 정한·흘러간 해의 연출 대기(카드 읽기 필요량)를 센 새 모델의 손계산 표(설계 문서 4-4절·SPEC TM2)를 실측으로 대체한다. 기본에서 빠진다(k마다 다시 잰다)
 *   candidates 페이싱 후보 비교 표 (content-M8.md 2-4절 ③) — 오래 걸려 기본에서 빠진다. --cands=25:28,29:33:0.05 처럼 후보를 직접 주면 그것만 잰다(soft:hard[:청년·중년·노년 빈도에 더할 값], 소프트 계수는 0.3)
 */
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const positional = args.find((a) => !a.startsWith('--'));
const lives = Number(positional ?? 1000);
const strategy = (flag('strategy') ?? 'random') as Strategy;
const modeArg = flag('mode') ?? 'short30';
const modes: LifeLength[] = modeArg === 'both' ? ['short30', 'long60'] : [modeArg as LifeLength];
const only = new Set((flag('only') ?? 'current,natural,legacy,chars,notes,infant').split(','));
if (!Number.isInteger(lives) || lives < 1 || !['random', 'auto', 'first'].includes(strategy) || modes.some((m) => !Object.prototype.hasOwnProperty.call(LIFE_LENGTH_MODES, m))) {
  console.error('사용법: npm run report:time [-- 판수(1 이상 정수) --strategy=random|auto --mode=short30|long60|both --only=...]');
  process.exit(2);
}

const f = (n: number, d = 1) => n.toFixed(d);
let violations = 0;
const record = (s: EraSummary) => {
  violations += s.problems.length;
  for (const p of s.problems.slice(0, 5)) console.log(`  위반: ${p}`);
};

/** 현재 모드 표의 하드 상한(스크립트가 시작할 때 값) — 자연 분포에서 「하드−1 이상」을 볼 때의 기준 */
const HARD_REF = Object.fromEntries(Object.entries(LIFE_LENGTH_MODES).map(([k, m]) => [k, m.pacing.hard])) as Record<LifeLength, number>;

/** 후보(또는 현재 설정)를 적용한 채 측정하고 집계까지 그 안에서 한다 — 집계가 모드 표의 페이싱(하드 상한)을 읽기 때문이다 */
function summarizeAll(mode: LifeLength, cand?: Candidate): EraSummary[] {
  const run = () => {
    const all = Object.fromEntries(ERAS.map((era) => [era, measureMany(era, lives, strategy, mode)])) as Record<Era, LifeMeasure[]>;
    return ERAS.map((era) => summarize(era, mode, all[era], HARD_REF[mode]));
  };
  return cand === undefined ? run() : withCandidate(mode, cand, run);
}

function measureAll(mode: LifeLength, cand?: Candidate): Record<Era, LifeMeasure[]> {
  const run = () => Object.fromEntries(ERAS.map((era) => [era, measureMany(era, lives, strategy, mode)])) as Record<Era, LifeMeasure[]>;
  return cand === undefined ? run() : withCandidate(mode, cand, run);
}

function printCards(title: string, sums: EraSummary[]) {
  console.log(`\n### ${title}`);
  console.log('| 시대 | 사망 나이 | 결정 카드 평균 (표준오차) | 표준편차 | 5% / 중앙 / 95% / 최대 | 하드−1↑ % | 상한에 닿은 % | 영유아(0~7세) | 단계별 평균 영유아·학창·청년·중년·노년 | 70세+ 중 20장 미만 % |');
  console.log('|---|---:|---:|---:|---|---:|---:|---:|---|---:|');
  for (const s of sums) {
    console.log(
      `| ${s.era} | ${f(s.deathAge)} | ${f(s.cards.mean, 2)} (${f(s.cards.se, 2)}) | ${f(s.cards.sd, 2)} | ${s.cards.p05} / ${s.cards.p50} / ${s.cards.p95} / ${s.cards.max} | ${f(s.nearCapPct)} | ${f(s.atCapPct)} | ${f(s.upTo7, 2)} | ${STAGES.map((st) => f(s.byStage[st], 2)).join(' · ')} | ${f(s.under20Of70PlusPct)} |`,
    );
  }
}

function printTimes(title: string, sums: EraSummary[]) {
  console.log(`\n### ${title}`);
  console.log('| 시대 | 해 수 q · n · 결과 · 부모 · 흘러감 · 둘째 줄 | c_self · c_total | 부모 해 연장(초) | 연출 합(분) | 옛 모델 1배속(분) | 읽기 낮음 | **중앙** | 높음 | 상한 | 중앙 5% / 95% / 최대 | 8배속+다음결정(중앙) |');
  console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|');
  for (const s of sums) {
    console.log(
      `| ${s.era} | ${f(s.q)} · ${f(s.n)} · ${f(s.r)} · ${f(s.cParent)} · ${f(s.cChild)} · ${f(s.extraLines, 2)} | ${f(s.cSelf, 2)} · ${f(s.c, 2)} | ${f(s.delegatedExtraSec, 1)} | ${f(s.holdMin, 2)} | ${f(s.legacyMin.mean)} | ${f(s.low.mean)} | **${f(s.median.mean)}** | ${f(s.high.mean)} | ${f(s.upper.mean)} | ${f(s.median.p05)} / ${f(s.median.p95)} / ${f(s.median.max)} | ${f(s.fastMin.mean)} |`,
    );
  }
  const avg = (k: 'low' | 'median' | 'high' | 'upper') => sums.reduce((a, s) => a + s[k].mean, 0) / sums.length;
  console.log(`\n세 시대 평균 (읽기 낮음 / 중앙 / 높음 / 상한): ${f(avg('low'))} / **${f(avg('median'))}** / ${f(avg('high'))} / ${f(avg('upper'))} 분`);
}

// ---------- 본문 ----------

console.log(`# 시간 모델 보고 — 시대 ${ERAS.length} × ${lives}판 (전략 ${strategy}, 모드 ${modes.join('·')}, 소비 모드 — 기록 시트 없음)`);
for (const mode of modes) {
  const m = LIFE_LENGTH_MODES[mode];
  console.log(`\n## 모드 ${m.label} (${mode}) — 연출 계수 ${m.holdScale}, 페이싱 soft ${m.pacing.soft} / ×${m.pacing.softFactor} / hard ${m.pacing.hard}`);
  console.log(
    `연출 대기(1배속): 조용한 해 ${(holdMsFor('quiet', { mode }) as number) / 1000}초 · 서술 해 ${(holdMsFor('narrative', { mode }) as number) / 1000}초 · 결과 ${(holdMsFor('resolved', { mode }) as number) / 1000}초 · 한 줄 더할 때마다 +${extraLineMsFor(mode) / 1000}초`,
  );
  console.log(`결정 카드 1장 읽기 r(낮음 / 중앙 / 높음 / 상한, 초): ${ERAS.map((e) => `${e} ${(['low', 'median', 'high', 'upper'] as const).map((l) => f(readSecFor(e, l))).join(' / ')}`).join(' · ')}`);

  if (only.has('current')) {
    const sums = summarizeAll(mode);
    sums.forEach(record);
    printCards(`현재 설정 — 판당 결정 카드 (판정 구간 ${m.cards.meanLow}~${m.cards.meanHigh}장, 하드−1↑ ≤ ${m.cards.nearCapShareMax * 100}%)`, sums);
    printTimes('현재 설정 — 판 시간 모델 (분, 1배속 수동)', sums);
    console.log(`\n노년 평균 하한(${ERAS.map((e) => `${e} ${SENIOR_CHOICE_MEAN_MIN[e]}`).join(' / ')}) 대비: ${sums.map((s) => `${s.era} ${f(s.byStage.senior, 2)}`).join(' / ')} · 영유아(0~7세) 하한 ${INFANT_CHOICE_MEAN_MIN}: ${sums.map((s) => `${s.era} ${f(s.upTo7, 2)}`).join(' / ')}`);
  }

  if (only.has('hold')) {
    // 연출 계수 k별 모델 시간: k는 count() 안의 `delegatedExtraMs`(필요량이 기본 대기보다 긴 몫)에도 들어가므로 k마다 다시 잰다. 모드 표를 잠시 덮어쓰고 되돌린다.
    const saved = LIFE_LENGTH_MODES[mode].holdScale;
    try {
      console.log('\n### 연출 계수 k별 1배속 수동 예상 (분, 읽기 중앙) — 판정: 시대별 ≥ 25.5 · 세 시대 평균 27~33');
      console.log('| k | 지난 | 지금 | 다가올 | 세 시대 평균 | 부모 해 연장(초/판) 지·지·다 | 판정 |');
      console.log('|---|---:|---:|---:|---:|---|---|');
      for (const k of [1.25, 1.3, 1.35, 1.4, 1.45]) {
        LIFE_LENGTH_MODES[mode].holdScale = k;
        const sums = summarizeAll(mode);
        const meds = sums.map((x) => x.median.mean);
        const avg = meds.reduce((a, b) => a + b, 0) / meds.length;
        const ok = meds.every((x) => x >= m.timeMin.modelLow - 1.5) && avg >= m.timeMin.modelLow && avg <= m.timeMin.modelHigh;
        console.log(`| ${k}${k === saved ? ' (현재)' : ''} | ${meds.map((x) => f(x, 2)).join(' | ')} | ${f(avg, 2)} | ${sums.map((x) => f(x.delegatedExtraSec, 0)).join(' · ')} | ${ok ? '통과' : '**미달**'} |`);
      }
    } finally {
      LIFE_LENGTH_MODES[mode].holdScale = saved;
    }
  }

  if (only.has('natural')) {
    const sums = summarizeAll(mode, NATURAL);
    sums.forEach(record);
    printCards('자연 분포 (페이싱 끔 — soft = hard = 무한): 이 풀·빈도의 한계', sums);
    printTimes('자연 분포 — 판 시간 모델 (분)', sums);
  }

  if (only.has('legacy')) {
    const legacyCand: Candidate = { label: '옛 설정', pacing: LEGACY_MODEL.pacing };
    const sums = summarizeAll(mode, legacyCand);
    sums.forEach(record);
    printCards('옛 설정 재현 (페이싱 23 / 0.3 / 26, M8 이전)', sums);
    console.log('\n### 옛 모델 재현 (content-M8.md 1-3절 표와 맞는지) — 옛 모델: HOLD_MS 그대로, 읽기 18초, 줄 대기 없음');
    console.log('| 시대 | A (사망 나이) | c (결정 카드) | n (서술) | q (조용) | 결과 해 | 연출 합 H(7q+17n+13·결과, 분) | 읽기 합 18초×c (분) | **현 모델 1배속 수동(분)** | 문서 값(분) |');
    console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    const docT: Record<Era, string> = { past: '20.7', present: '21.3', future: '21.7' };
    for (const s of sums) {
      const h = (7 * s.q + 17 * s.n + 13 * s.r) / 60;
      console.log(`| ${s.era} | ${f(s.deathAge)} | ${f(s.c)} | ${f(s.n)} | ${f(s.q)} | ${f(s.r)} | ${f(h)} | ${f((18 * s.c) / 60)} | **${f(s.legacyMin.mean)}** | ${docT[s.era]} |`);
    }
  }

  if (only.has('chars')) {
    const all = measureAll(mode);
    const stats = ERAS.map((e) => charStatsOf(all[e]));
    const pool = poolCharStats();
    const c = READ_MODEL.chars;
    console.log('\n### 글자 수 실측 (합쇼체) — 뜬 카드 기준 시대별 · 풀 기준 정적 평균 · READ_MODEL 상수');
    console.log('| 항목 | READ_MODEL | 풀(정적) | 지난 | 지금 | 다가올 | 문서 ◇ 값 |');
    console.log('|---|---:|---:|---:|---:|---:|---:|');
    const row = (label: string, model: string, stat: string, get: (s: (typeof stats)[number]) => number, doc: string, d = 1) =>
      console.log(`| ${label} | ${model} | ${stat} | ${stats.map((s) => f(get(s), d)).join(' | ')} | ${doc} |`);
    row('뜬 카드 수(합)', '-', '-', (s) => s.cards, '-', 0);
    row('결정 카드 제목(자)', f(c.title), f(pool.title), (s) => s.title, '8.1(전체 140개 기준)');
    row('결정 카드 본문(자)', f(c.body), f(pool.body), (s) => s.body, '52.0');
    row('보인 선택지 수(카드당)', f(c.visibleLabels), f(pool.labels, 2) + '(정의)', (s) => s.visibleLabels, '2.7▲', 2);
    row('선택지 라벨(자)', f(c.label), f(pool.label), (s) => s.label, '12.4');
    row('결과 문구(자)', '-', f(pool.result), (s) => s.result, '50.2');
    row('영향 줄(선택지당 자)', f(c.impactPerChoice), '-', (s) => s.impactPerChoice, '11▲');
    row('영향 줄(선택지당 항목 수)', '-', '-', (s) => s.impactItemsPerChoice, '2.5▲', 2);
    row('인용 노출률', f(READ_MODEL.citeExposure.past, 2) + ' / ' + f(READ_MODEL.citeExposure.present, 2) + ' / ' + f(READ_MODEL.citeExposure.future, 2), '-', (s) => s.exposure, '0.10 / 0.53 / 0.49', 3);
    row('인용 요약(자, 시대 머리말 포함)', '-', '-', (s) => s.citeText, '61.3(머리말 제외)');
    row('인용 출처 줄(자)', '-', '-', (s) => s.citeSrc, '약 45▲');
    console.log(`\n서술 이벤트 본문(풀, 마일스톤 제외): ${f(pool.narrativeBody)}자 (문서 52.1)`);
    const sums = ERAS.map((e) => summarize(e, mode, all[e], HARD_REF[mode]));
    sums.forEach(record);
    console.log('\n### 카드별 정밀 합계(실제 글자 수·인용) 대 시대 상수 모델 (중앙)');
    console.log('| 시대 | 시대 상수 모델 T(분) | 카드별 정밀 합계 T(분) | 차이 % |');
    console.log('|---|---:|---:|---:|');
    for (const s of sums) console.log(`| ${s.era} | ${f(s.constantMin, 2)} | ${f(s.preciseMin, 2)} | ${f(((s.constantMin - s.preciseMin) / s.preciseMin) * 100, 1)} |`);
  }

  if (only.has('notes')) {
    console.log('\n### 기록 카드(M7c) 참고 시간 — 목표 밖의 참고 항 (LD-1)');
    console.log('| 시대 | 판당 기록 카드 평균 | 건너뛰기 6~9초(분) | 한두 줄 20~60초(분) | 140자까지 90초(분) |');
    console.log('|---|---:|---:|---:|---:|');
    for (const e of ERAS) {
      const r = runNoteSchedule(e, Math.min(lives, 1000), (seed) => chooserFor(strategy, seed), 1, NOTE_CARDS);
      const n = r.meanCards;
      console.log(`| ${e} | ${f(n, 2)} | ${f((n * 6) / 60)}~${f((n * 9) / 60)} | ${f((n * 20) / 60)}~${f((n * 60) / 60)} | ${f((n * 90) / 60)} |`);
      violations += r.problems.length;
    }
  }

  if (only.has('margins')) {
    if (mode !== 'short30') {
      console.log('\n(판정 여유 표는 30분 모드만 낸다 — 1시간 모드는 1차에서 닫혀 있고 카드 수·시간은 보고만 한다)');
    } else {
      const t0 = Date.now();
      const rep = marginReport(lives, undefined, (msg) => console.error(`  [margins] ${msg}`));
      console.log(`\n## 판정 여유 표 (${lives}판, ${f((Date.now() - t0) / 1000, 0)}초)\n`);
      console.log(rep.text);
      for (const p of rep.problems.slice(0, 5)) console.log(`  위반: ${p}`);
      violations += rep.problems.length;
      const infantN = Math.max(lives, 4000);
      console.log(`\n### IN2 (영유아 0~7세) 판정 여유 — 시대 × 전략마다 ${infantN}판 (tests/infantContent.test.ts와 같은 줄)`);
      console.log('| 전략 | 시대 | 빈 해 5개 이상인 판 (한계 0.5%) | 4개 이상인 판 (보고) | 빈 해 평균 (≤ 1.5) | 선택지 평균 0~7세 (≥ 2.8) |');
      console.log('|---|---|---|---:|---|---|');
      for (const r of infantMargins(infantN)) {
        console.log(`| ${r.strategy} | ${r.era} | ${r.five.hits}/${r.five.n} (${f((r.five.hits / r.five.n) * 100, 2)}%, 여유 ${f(r.five.margin, 1)} SE) | ${r.four.hits}/${r.four.n} (${f((r.four.hits / r.four.n) * 100, 2)}%) | ${f(r.emptyMean.value, 2)} ±${f(r.emptyMean.se, 2)} (${f(r.emptyMean.margin, 1)} SE) | ${f(r.choices.value, 2)} ±${f(r.choices.se, 2)} (${f(r.choices.margin, 1)} SE) |`);
      }
    }
  }

  if (only.has('infant')) {
    console.log('\n### 영유아(0~7세) 수치 (sim:infant와 같은 정의, 전략 auto / random)');
    for (const st of ['auto', 'random'] as const) {
      for (const e of ERAS) {
        const s = summarizeInfant(infantLives(e, lives, st));
        console.log(`- [${st}/${e}] 빈 해 평균 ${f(s.emptyMean, 2)} 최대 ${s.emptyMax} (4개 이상 판 ${f(s.emptyGe4Pct, 2)}% · 5개 이상 판 ${f(s.emptyGe5Pct, 2)}% — IN2 판정은 5개 이상 ≤ 0.5%) / 줄 평균 ${f(s.linesMean, 2)} / 선택지(0~7세) ${f(s.choicesMean, 2)} (0~6세 단계 ${f(s.choicesInfantStageMean, 2)}) / 한 해 두 줄 ${f(s.doubleYearsMean, 2)}해`);
      }
    }
  }

  if (only.has('candidates')) {
    const given = flag('cands');
    let parsedGiven: Candidate[] | null = null;
    if (given !== undefined) {
      const parsed = parseCandidates(given);
      if (typeof parsed === 'string') {
        console.error(parsed);
        process.exit(2);
      }
      parsedGiven = parsed;
    }
    const cands: Candidate[] =
      parsedGiven !== null
        ? parsedGiven
        : [
            { label: '지금(23/26)', pacing: LEGACY_MODEL.pacing },
            ...[[24, 29], [24, 30], [26, 30]].map(([soft, hard]) => ({ label: `soft ${soft} / hard ${hard}${soft === 24 && hard === 30 ? ' (확정 — 노년 회복만, 마스터 2026-10-20)' : ''}`, pacing: { soft, softFactor: 0.3, hard } })),
            ...[27, 29, 31].flatMap((soft) => [31, 33, 35].map((hard) => ({ label: `soft ${soft} / hard ${hard}`, pacing: { soft, softFactor: 0.3, hard } }))),
            ...[0.05, 0.1].map((d) => ({ label: `soft 29 / hard 33 + 빈도 +${d}`, pacing: { soft: 29, softFactor: 0.3, hard: 33 }, freq: { youth: d, middle: d, senior: d } })),
          ];
    console.log('\n### 페이싱 후보 비교 (content-M8.md 2-4절 ③)');
    console.log('| 후보 | 지난 카드 | 지금 카드 | 다가올 카드 | 노년 평균 지/지/다 | 하드−1↑ % 지/지/다 | 상한에 닿은 % | 중앙 T(분) 지/지/다 |');
    console.log('|---|---:|---:|---:|---|---|---|---|');
    for (const cand of cands) {
      const sums = summarizeAll(mode, cand);
      sums.forEach(record);
      console.log(
        `| ${cand.label} | ${sums.map((s) => f(s.cards.mean, 2)).join(' | ')} | ${sums.map((s) => f(s.byStage.senior, 2)).join(' / ')} | ${sums.map((s) => f(s.nearCapPct)).join(' / ')} | ${sums.map((s) => f(s.atCapPct)).join(' / ')} | ${sums.map((s) => f(s.median.mean)).join(' / ')} |`,
      );
    }
  }
}

console.log('\n(풀 이벤트 수:', EVENT_POOL.events.length, '/ 단계 이름:', STAGES.map((s) => STAGE_TABLE[s].label).join('·'), ')');
if (violations > 0) {
  console.error(`불변식 위반 ${violations}건`);
  process.exit(1);
}
console.log('불변식 위반 0건');
