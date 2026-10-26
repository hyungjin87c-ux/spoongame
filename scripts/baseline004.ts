import { ERAS, type Era } from '../src/core';
import { isChoiceEvent } from '../src/core/events';
import { EVENT_POOL } from '../src/data/events';
import {
  AGE_BANDS,
  AXES,
  GENERATIONS,
  PATH_AGES,
  THIN,
  TIMELINE_CANDIDATES,
  candidatesAt,
  cellStat,
  countBy,
  emCell,
  courseOf,
  courseRows,
  courseWordHits,
  emptyRuns,
  entropyBits,
  njobOf,
  parseEm,
  pathSignature,
  playRecorded,
  rangesOf,
  snapshotAt,
  taggedEventFate,
  timelineCell,
  timelineLifetime,
  type LifeRecord,
  type Rule,
} from './baseline004Lib';
import { readFileSync } from 'node:fs';
import type { Strategy } from './simulateLib';

/**
 * SPEC-004 GM0 기준선 측정 실행 스크립트. 실행: ./node_modules/.bin/vite-node scripts/baseline004.ts [판수=1000] [--only=cells,course,timeline,paths]
 * 결과는 docs/data/spec-004-baseline.md에 옮겨 적는다. 게임 코드는 바꾸지 않는다.
 *   cells    1) 이벤트 140개 × 세대 7 × 나이대 8 후보 칸 (시대 제한을 세대로 옮기는 규칙 U / L / R)
 *   course   2) 정석 코스 이벤트 목록 (플래그 게이트 기준)
 *   timeline 연표 후보(부록 A+A-2+A-3) × 세대 × 나이대, 비는 해
 *   paths    3) X·밀레니얼 대리(지난 세상·지금 세상) 경로 다양도·N잡·정석 4단, 5) 나이대별 조용한 해
 */
const args = process.argv.slice(2);
const positional = args.find((a) => !a.startsWith('--'));
const lives = Number(positional ?? 1000);
const only = new Set((args.find((a) => a.startsWith('--only='))?.slice(7) ?? 'cells,course,timeline,paths,motifs').split(','));
const fx = (n: number, d = 2) => n.toFixed(d);
const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;

const ruleName = (r: Rule) => (r === 'U' ? 'U(시대 제한 무시)' : r === 'L' ? 'L(글자 그대로)' : `R(달력 연도 ≤ ${r.rule === 'R' ? r.cut : ''}=지난)`);

// ---------- 1) 후보 칸 ----------
if (only.has('cells')) {
  const total = EVENT_POOL.events.length;
  const choice = EVENT_POOL.events.filter(isChoiceEvent).length;
  const tagged = EVENT_POOL.events.filter((e) => e.eras);
  console.log(`# 1) 이벤트 후보 칸 — 이벤트 ${total}개 (결정 ${choice} + 서술 ${total - choice}), 시대 제한 붙은 것 ${tagged.length}개, 안 붙은 것 ${total - tagged.length}개`);
  const tagCount: Record<string, number> = {};
  for (const e of tagged) tagCount[e.eras!.join('+')] = (tagCount[e.eras!.join('+')] ?? 0) + 1;
  console.log(`시대 제한 조합: ${Object.entries(tagCount).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  console.log(`세대 표(측정용): ${GENERATIONS.map((g) => `${g.label} ${g.from}~${g.to}`).join(' / ')}`);

  const R = (cut: number): Rule => ({ rule: 'R', cut });
  const RULES: Rule[] = ['U', 'L', R(1995), R(2000), R(2005)];

  // 1-A 규칙별 한눈에
  console.log('\n## 1-A 규칙별: 세대 평균 후보 수(전체) / 임계(<4) 미만인 (출생 연도, 나이) 쌍의 비율 / 후보 0인 쌍의 비율');
  console.log(`| 규칙 | ${GENERATIONS.map((g) => g.label).join(' | ')} |`);
  console.log(`|---|${GENERATIONS.map(() => '---:').join('|')}|`);
  for (const rule of RULES) {
    const cells = GENERATIONS.map((g) => {
      let pairs = 0;
      let all = 0;
      let thin = 0;
      let empty = 0;
      for (const band of AGE_BANDS) {
        const c = cellStat(g, band, rule);
        pairs += c.pairs;
        all += c.meanAll * c.pairs;
        thin += c.thinShare * c.pairs;
        empty += c.emptyShare * c.pairs;
      }
      return `${fx(all / pairs, 1)} / ${pct(thin / pairs, 0)} / ${pct(empty / pairs, 0)}`;
    });
    console.log(`| ${ruleName(rule)} | ${cells.join(' | ')} |`);
  }

  // 1-A-2 56칸(세대 7 × 나이대 8) 중 몇 칸이 채워지는가
  console.log(`\n## 1-A-2 56칸(세대 7 × 나이대 8) 중 — 칸 안 모든 나이에서 후보 ≥ ${THIN}인 칸 / 어느 나이에서 ${THIN} 미만이 되는 칸 / 어느 나이에서 0이 되는 칸 (전체 후보 기준 → 플래그 없는 후보 기준)`);
  console.log('| 규칙 | 전부 채워짐 | 얇은 나이가 있음 | 빈 나이가 있음 | (플래그 없는 후보 기준) 전부 채워짐 | 얇은 나이가 있음 |');
  console.log('|---|---:|---:|---:|---:|---:|');
  for (const rule of RULES) {
    let ok = 0;
    let thin = 0;
    let empty = 0;
    let okFree = 0;
    let thinFree = 0;
    for (const g of GENERATIONS)
      for (const band of AGE_BANDS) {
        const c = cellStat(g, band, rule);
        if (c.thinShare === 0) ok++;
        else thin++;
        if (c.emptyShare > 0) empty++;
        if (c.thinFreeShare === 0) okFree++;
        else thinFree++;
      }
    console.log(`| ${ruleName(rule)} | ${ok} | ${thin} | ${empty} | ${okFree} | ${thinFree} |`);
  }

  // 1-B 주 규칙 R(2000): 세대 × 나이대 표
  const MAIN: Rule = R(2000);
  console.log(`\n## 1-B 세대 × 나이대 — 규칙 ${ruleName(MAIN)}, 전망 구간(달력 2026~)은 시대 제한 「다가올」만 열린다`);
  const header = `| 세대 | ${AGE_BANDS.map((b) => b.label).join(' | ')} |`;
  const sep = `|---|${AGE_BANDS.map(() => '---:').join('|')}|`;
  const grid = (title: string, f: (c: ReturnType<typeof cellStat>) => string) => {
    console.log(`\n### ${title}`);
    console.log(header);
    console.log(sep);
    for (const g of GENERATIONS) console.log(`| ${g.label} ${g.from}~${g.to} | ${AGE_BANDS.map((b) => f(cellStat(g, b, MAIN))).join(' | ')} |`);
  };
  grid('후보 수 평균 — 전체(결정+서술) / 그중 결정 / 앞선 사건 없이 열리는 것(플래그 없음)', (c) => `${fx(c.meanAll, 1)} / ${fx(c.meanChoice, 1)} / ${fx(c.meanFree, 1)}`);
  grid(`후보가 ${THIN} 미만인 (출생 연도, 나이) 쌍의 비율 — 전체 / 플래그 없는 후보 기준`, (c) => `${pct(c.thinShare, 0)} / ${pct(c.thinFreeShare, 0)}`);
  grid('시대 제한이 붙은 「시대색」 후보 평균 개수', (c) => fx(c.meanTagged, 1));
  grid('칸 안 가장 적은 후보 수(전체)', (c) => `${c.minAll}`);

  // 1-B' 전망 구간(달력 2026~) 비율 — PJ9 「세대 × 연령 칸의 표시 종류」의 기초
  console.log('\n### 1-B-2 칸 안 (출생 연도, 나이) 쌍 중 전망 구간(달력 연도 ≥ 2026)의 비율 — 0%는 전부 실제, 100%는 전부 전망');
  console.log(header);
  console.log(sep);
  for (const g of GENERATIONS) {
    const cells = AGE_BANDS.map((band) => {
      let pairs = 0;
      let proj = 0;
      for (let b = g.from; b <= g.to; b++)
        for (let a = band.min; a <= band.max; a++) {
          pairs++;
          if (b + a > 2025) proj++;
        }
      return pct(proj / pairs, 0);
    });
    console.log(`| ${g.label} ${g.from}~${g.to} | ${cells.join(' | ')} |`);
  }

  // 1-C 얇은 나이 목록 (규칙 R2000)
  console.log(`\n## 1-C 후보가 ${THIN} 미만인 나이 (규칙 ${ruleName(MAIN)}; 세대 안 어느 출생 연도에서든)`);
  console.log('| 세대 | 전체 후보 기준 | 플래그 없이 열리는 후보 기준 |');
  console.log('|---|---|---|');
  for (const g of GENERATIONS) {
    const all = new Set<number>();
    const free = new Set<number>();
    for (let b = g.from; b <= g.to; b++)
      for (let a = 0; a <= 100; a++) {
        const c = candidatesAt(b, a, MAIN);
        if (c.all < THIN) all.add(a);
        if (c.free < THIN) free.add(a);
      }
    console.log(`| ${g.label} | ${rangesOf([...all].sort((x, y) => x - y))} | ${rangesOf([...free].sort((x, y) => x - y))} |`);
  }

  // 1-D 규칙 U의 나이별 후보 수 (세대 무관 바닥)
  console.log('\n## 1-D 나이별 후보 수 (시대 제한 무시 = 세대와 무관한 바닥): 전체 / 결정 / 플래그 없는 것');
  const rows: string[] = [];
  for (let a = 0; a <= 100; a++) {
    const c = candidatesAt(1980, a, 'U');
    rows.push(`${a}:${c.all}/${c.choice}/${c.free}`);
  }
  for (let i = 0; i < rows.length; i += 10) console.log(rows.slice(i, i + 10).join('  '));

  // 1-E 시대 제한이 붙은 이벤트의 운명
  console.log('\n## 1-E 시대 제한이 붙은 이벤트 33개 — 규칙별로 후보가 되는 세대');
  const fateL = new Map(taggedEventFate('L').map((x) => [x.ev.id, x.gens]));
  const fateR = new Map(taggedEventFate(R(2000)).map((x) => [x.ev.id, x.gens]));
  console.log('| id | 제한 | 단계·나이 | 종류 | L: 후보 세대 | R(2000): 후보 세대 |');
  console.log('|---|---|---|---|---|---|');
  for (const e of tagged) {
    const short = (gs: string[] | undefined) => (gs && gs.length ? gs.map((g) => GENERATIONS.find((x) => x.id === g)!.label).join('·') : '**없음**');
    console.log(`| ${e.id} | ${e.eras!.join('/')} | ${e.stages.join('+')} ${e.ageRange ? `${e.ageRange.min}~${e.ageRange.max}` : ''} | ${isChoiceEvent(e) ? '결정' : '서술'} | ${short(fateL.get(e.id))} | ${short(fateR.get(e.id))} |`);
  }
  const orphanL = tagged.filter((e) => (fateL.get(e.id) ?? []).length === 0);
  const orphanR = tagged.filter((e) => (fateR.get(e.id) ?? []).length === 0);
  console.log(`\nL에서 어느 세대에도 후보가 아닌 이벤트: ${orphanL.length}개 (${orphanL.map((e) => e.id).join(', ')})`);
  console.log(`R(2000)에서 어느 세대에도 후보가 아닌 이벤트: ${orphanR.length}개 (${orphanR.map((e) => e.id).join(', ') || '-'})`);
}

// ---------- 2) 정석 코스 ----------
if (only.has('course')) {
  console.log('\n# 2) 정석 코스 이벤트 — 문(게이트) 플래그를 켜거나 요구하거나 막는 이벤트');
  const rows = courseRows();
  const setters = rows.filter((r) => r.sets.length > 0);
  console.log(`전체 ${rows.length}개: 문을 여는(켜는) 이벤트 ${setters.length}개 · 문에 기대는(요구·배제만) 이벤트 ${rows.length - setters.length}개`);
  console.log('\n| id | 단계 | 나이 | 시대 | 종류 | 켜는 플래그 | 요구 | 배제 |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.id} | ${r.stages} | ${r.ages} | ${r.eras} | ${r.kind} | ${r.sets.join(', ') || '-'} | ${r.needs.join(', ') || '-'} | ${r.excludes.join(', ') || '-'} |`);
  console.log('\n문구에 정석 코스 낱말이 든 이벤트 (게이트 이벤트 제외, AL3 알파용 변형·닫기 검토 참고):');
  const gateIds = new Set(rows.map((r) => r.id));
  for (const ev of EVENT_POOL.events) {
    const hits = courseWordHits(ev);
    if (hits.length === 0 || gateIds.has(ev.id)) continue;
    console.log(`- ${ev.id} [${ev.stages.join('+')} ${ev.ageRange ? `${ev.ageRange.min}~${ev.ageRange.max}` : ''}] ${hits.join(', ')}`);
  }
}

// ---------- 연표 후보 ----------
if (only.has('timeline')) {
  console.log(`\n# 연표 후보(부록 A+A-2+A-3, ${TIMELINE_CANDIDATES.length}건 — H-G01 「모든 해」 제외) × 세대 × 나이대`);
  const cats: Record<string, number> = {};
  for (const t of TIMELINE_CANDIDATES) cats[t.cat] = (cats[t.cat] ?? 0) + 1;
  console.log(`범주: ${Object.entries(cats).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  console.log('\n## 한 사람이 그 나이대(실제 구간 2025까지)에 걸치는 서로 다른 연표 후보 사건 수 — 출생 연도 평균 [최소]  (여러 해에 걸친 사건도 한 건. 실제 줄 수는 나이대 변형(TL4)이 있어야 나오므로 이보다 적다)');
  console.log(`| 세대 | ${AGE_BANDS.map((b) => b.label).join(' | ')} |`);
  console.log(`|---|${AGE_BANDS.map(() => '---:').join('|')}|`);
  for (const g of GENERATIONS) {
    const cells = AGE_BANDS.map((band) => {
      const c = timelineCell(g, band);
      return c.years < 0.5 ? '(전망)' : `${fx(c.mean, 1)} [${c.min}]`;
    });
    console.log(`| ${g.label} ${g.from}~${g.to} | ${cells.join(' | ')} |`);
  }
  console.log('\n## 평생(출생~82세, 실제 구간 2025까지)에 걸치는 연표 후보 수 — 출생 연도별 최소 / 평균 / 최대  (SPEC 완료 기준 10: 판당 연표 줄 평균 ≥ 12, 산업화 ≥ 10, 알파 ≥ 6)');
  for (const g of GENERATIONS) {
    const t = timelineLifetime(g, 82);
    console.log(`- ${g.label}: ${t.min} / ${fx(t.mean, 1)} / ${t.max}`);
  }
  console.log('\n## 연표 후보가 하나도 없는 달력 연도의 연속 구간 (TL6: 연속 5년 넘으면 후보 보강)');
  const e1 = emptyRuns(1940, 2025, 3);
  console.log(`길이 3년 이상: ${e1.map(([s, e]) => `${s}~${e}(${e - s + 1}년)`).join(', ')}`);
  const early = TIMELINE_CANDIDATES.filter((t) => t.years.some(([s]) => s < 1950)).map((t) => t.id);
  console.log(`1950년 이전에 시작하는 후보: ${early.join(', ')}`);
  // 세대별 출생 연도에서 겪는 연속 빈 해 최대
  console.log('\n## 세대별: 한 사람이 겪는 연표 후보 없는 연속 해 최대 길이(실제 구간)');
  for (const g of GENERATIONS) {
    let worst = 0;
    let worstB = g.from;
    for (let b = g.from; b <= g.to; b++) {
      let run = 0;
      for (let a = 0; a <= 100 && b + a <= 2025; a++) {
        const n = TIMELINE_CANDIDATES.filter((t) => t.years.some(([s, e]) => b + a >= s && b + a <= e)).length;
        run = n === 0 ? run + 1 : 0;
        if (run > worst) {
          worst = run;
          worstB = b;
        }
      }
    }
    console.log(`- ${g.label}: ${worst}년 (예: ${worstB}년생)`);
  }
}

// ---------- 3) 경로 ----------
if (only.has('paths')) {
  const STRATS: Strategy[] = ['random', 'auto'];
  const BANDS_TL = AGE_BANDS;
  type Group = { era: Era; strategy: Strategy; recs: LifeRecord[] };
  const groups: Group[] = [];
  for (const strategy of STRATS) {
    for (const era of ERAS) {
      const recs: LifeRecord[] = [];
      for (let i = 1; i <= lives; i++) recs.push(playRecorded(i * 7919 + 13, era, strategy));
      groups.push({ era, strategy, recs });
    }
  }

  const sig = (r: LifeRecord) => pathSignature(r);
  console.log(`\n# 3) X·밀레니얼 대리 경로 측정 — 시대 ${ERAS.join('·')} × 전략 ${STRATS.join('·')} × ${lives}판 (시드 i×7919+13)`);
  console.log('축 상태 정의 v0: 배움{정규·재교육·독학·수험·쉼} 일{학생·고용 1곳·사업·고용+사업·수험·임시·쉼·은퇴} 거처{부모 집·월세·전세·자가·돌봄 시설} 관계{혼자·파트너·결혼·결혼+자녀} 돌봄{없음·자녀·부모·자신}');

  for (const strategy of STRATS) {
    const gs = groups.filter((g) => g.strategy === strategy);
    const sigs = gs.map((g) => g.recs.map(sig).filter((s): s is string => s !== null));
    const nCommon = Math.min(...sigs.map((s) => s.length));
    console.log(`\n## 3-A 경로 다양도 (${strategy}) — 25·35·45·55·65세 5축 상태를 모두 찍은 판만, 같은 표본 수 ${nCommon}판으로 맞춰 계산 (상한 log2 n = ${fx(Math.log2(nCommon), 2)} 비트)`);
    console.log('| 시대 | 65세까지 산 판 | 서로 다른 경로 수(맞춘 표본) | 경로 엔트로피 H(비트) | H / log2 n | 나이별 5축 벡터 엔트로피 평균 | 축별 엔트로피 평균(배움·일·거처·관계·돌봄) |');
    console.log('|---|---:|---:|---:|---:|---:|---|');
    gs.forEach((g, gi) => {
      const use = sigs[gi].slice(0, nCommon);
      const counts = countBy(use, (s) => s);
      const H = entropyBits(counts.values());
      // 나이별 5축 벡터와 축별 엔트로피
      const perAge: number[] = [];
      const perAxis: number[][] = AXES.map(() => []);
      const aliveRecs = g.recs.filter((r) => sig(r) !== null).slice(0, nCommon);
      for (const a of PATH_AGES) {
        const vecs = aliveRecs.map((r) => AXES.map(([, f]) => f(snapshotAt(r, a)!)).join('/'));
        perAge.push(entropyBits(countBy(vecs, (v) => v).values()));
        AXES.forEach(([, f], ai) => perAxis[ai].push(entropyBits(countBy(aliveRecs, (r) => f(snapshotAt(r, a)!)).values())));
      }
      const mean = (xs: number[]) => xs.reduce((x, y) => x + y, 0) / xs.length;
      console.log(
        `| ${g.era} | ${sigs[gi].length} | ${counts.size} | ${fx(H, 2)} | ${fx(H / Math.log2(nCommon), 3)} | ${fx(mean(perAge), 2)} | ${perAxis.map((p) => fx(mean(p), 2)).join(' · ')} |`,
      );
    });
  }

  for (const strategy of STRATS) {
    const gs = groups.filter((g) => g.strategy === strategy);
    console.log(`\n## 3-B N잡·정석 4단 (${strategy}) — 분모는 전체 ${lives}판(괄호: 65세 이상 산 판)`);
    console.log('| 시대 | 사망 나이 평균 | N잡(엄격) | N잡(겸업 플래그, 참고·부풀려짐) | N잡(넓게: +일하며 시험 준비) | 정석 4단(취업·결혼·출산·내 집, 순서 무관) | 4단 이 순서대로 | 4개 중 3개 이상 | AL10식(입사→결혼→자가→정년퇴직 순서대로) |');
    console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const g of gs) {
      const old = g.recs.filter((r) => r.deathAge >= 65);
      const nj = g.recs.map(njobOf);
      const njOld = old.map(njobOf);
      const co = g.recs.map(courseOf);
      const coOld = old.map(courseOf);
      const share = (xs: boolean[]) => xs.filter(Boolean).length / (xs.length || 1);
      const both = (a: boolean[], b: boolean[]) => `${pct(share(a))} (${pct(share(b))})`;
      console.log(
        `| ${g.era} | ${fx(g.recs.reduce((a, r) => a + r.deathAge, 0) / g.recs.length, 1)} | ${both(nj.map((x) => x.strict), njOld.map((x) => x.strict))} | ${both(nj.map((x) => x.overlap), njOld.map((x) => x.overlap))} | ${both(nj.map((x) => x.broad), njOld.map((x) => x.broad))} | ${both(co.map((x) => x.any4), coOld.map((x) => x.any4))} | ${both(co.map((x) => x.ordered4), coOld.map((x) => x.ordered4))} | ${both(co.map((x) => x.atLeast3), coOld.map((x) => x.atLeast3))} | ${both(co.map((x) => x.al10), coOld.map((x) => x.al10))} |`,
      );
    }
  }

  for (const strategy of STRATS) {
    const gs = groups.filter((g) => g.strategy === strategy);
    console.log(`\n## 3-A' 나이별 가장 흔한 5축 벡터의 점유율 (${strategy}) — 정석 쏠림 정도 (그 나이에 살아 있는 판 기준)`);
    console.log(`| 시대 | ${PATH_AGES.map((a) => `${a}세`).join(' | ')} |`);
    console.log(`|---|${PATH_AGES.map(() => '---:').join('|')}|`);
    for (const g of gs) {
      const cells = PATH_AGES.map((a) => {
        const alive = g.recs.filter((r) => r.deathAge >= a);
        const vecs = countBy(alive, (r) => AXES.map(([, f]) => f(snapshotAt(r, a)!)).join('/'));
        const top = [...vecs.entries()].sort((x, y) => y[1] - x[1])[0];
        return `${pct(top[1] / alive.length, 0)} ${top[0]} (서로 다른 벡터 ${vecs.size})`;
      });
      console.log(`| ${g.era} | ${cells.join(' | ')} |`);
    }
  }

  // 3-C 문 조합 분포 (random)
  {
    const gs = groups.filter((g) => g.strategy === 'random');
    console.log('\n## 3-C 정석 문 조합 분포 (random, 65세 이상 산 판) — 취업(C)·결혼(M)·출산(K)·내 집(H)을 밟았는가');
    console.log('| 조합 | ' + gs.map((g) => g.era).join(' | ') + ' |');
    console.log('|---|' + gs.map(() => '---:').join('|') + '|');
    const key = (r: LifeRecord) => {
      const f = courseOf(r).first;
      return `${f.career !== null ? 'C' : '-'}${f.married !== null ? 'M' : '-'}${f.child !== null ? 'K' : '-'}${f.home !== null ? 'H' : '-'}`;
    };
    const tallies = gs.map((g) => countBy(g.recs.filter((r) => r.deathAge >= 65), key));
    const all = new Set(tallies.flatMap((t) => [...t.keys()]));
    const totals = gs.map((g) => g.recs.filter((r) => r.deathAge >= 65).length);
    const order = [...all].sort((a, b) => (tallies[0].get(b) ?? 0) - (tallies[0].get(a) ?? 0));
    for (const k of order.slice(0, 10)) console.log(`| ${k} | ${tallies.map((t, i) => pct((t.get(k) ?? 0) / totals[i])).join(' | ')} |`);
    // 처음 밟은 나이 중앙값
    const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : NaN);
    console.log('\n처음 밟은 나이 중앙값 (65세 이상 산 판, 밟은 판만):');
    gs.forEach((g) => {
      const f = g.recs.filter((r) => r.deathAge >= 65).map((r) => courseOf(r).first);
      const m = (k: string) => med(f.map((x) => x[k]).filter((v): v is number => v !== null));
      console.log(`- ${g.era}: 취업 ${m('career')} · 결혼 ${m('married')} · 출산 ${m('child')} · 내 집 ${m('home')} · 정년퇴직(senior-retire) ${m('retired')}`);
    });
  }

  // 5) 나이대별 조용한 해
  {
    console.log('\n# 5) 나이대별 연표가 빈 「조용한 해」 (random) — 연표 줄이 하나도 없는 해의 수와 비율 (판당 평균)');
    const gs = groups.filter((g) => g.strategy === 'random');
    console.log(`| 시대 | ${BANDS_TL.map((b) => b.label).join(' | ')} | 전체 |`);
    console.log(`|---|${BANDS_TL.map(() => '---:').join('|')}|---:|`);
    for (const g of gs) {
      const cells = BANDS_TL.map((b) => {
        let quiet = 0;
        let years = 0;
        for (const r of g.recs)
          for (let a = b.min; a <= Math.min(b.max, r.deathAge); a++) {
            years++;
            if ((r.lines.get(a) ?? 0) === 0) quiet++;
          }
        return `${fx(quiet / g.recs.length, 1)} (${pct(quiet / (years || 1), 0)})`;
      });
      let q = 0;
      let y = 0;
      for (const r of g.recs)
        for (let a = 0; a <= r.deathAge; a++) {
          y++;
          if ((r.lines.get(a) ?? 0) === 0) q++;
        }
      console.log(`| ${g.era} | ${cells.join(' | ')} | ${fx(q / g.recs.length, 1)} (${pct(q / y, 0)}) |`);
    }
    console.log('\n나이대별 판당 연표 줄(event+choice) 수 평균 (random):');
    console.log(`| 시대 | ${BANDS_TL.map((b) => b.label).join(' | ')} |`);
    console.log(`|---|${BANDS_TL.map(() => '---:').join('|')}|`);
    for (const g of gs) {
      const cells = BANDS_TL.map((b) => {
        let n = 0;
        for (const r of g.recs) for (let a = b.min; a <= Math.min(b.max, r.deathAge); a++) n += r.lines.get(a) ?? 0;
        return fx(n / g.recs.length, 1);
      });
      console.log(`| ${g.era} | ${cells.join(' | ')} |`);
    }
  }
}

// ---------- 소재 창고 가공본(EM) × 세대 × 나이대, 세 렌즈 교차 ----------
if (only.has('motifs')) {
  const em = parseEm(readFileSync('docs/data/era-motifs-7090.md', 'utf-8'));
  console.log(`\n# 소재 창고 가공본 EM — 사용 후보 중 시기·나이대를 읽은 ${em.length}건 (측정용 근사: 나이대 문장을 TL3 나이대로, 시기를 달력 연도로 옮김)`);
  const gridEm = (title: string, shape?: RegExp) => {
    console.log(`\n## ${title}`);
    console.log(`| 세대 | ${AGE_BANDS.map((b) => b.label).join(' | ')} |`);
    console.log(`|---|${AGE_BANDS.map(() => '---:').join('|')}|`);
    for (const g of GENERATIONS) console.log(`| ${g.label} ${g.from}~${g.to} | ${AGE_BANDS.map((b) => emCell(em, g, b, shape)).join(' | ')} |`);
  };
  gridEm('세대 × 나이대에 닿는 EM 항목 수 (모양 무관)');
  gridEm('그중 ② 새 사연·결정 카드', /②/);
  gridEm('그중 ④ 나이대별 역사 체험 줄', /④/);

  // 교차: 세 렌즈 모두 얇은 칸
  const MAIN: Rule = { rule: 'R', cut: 2000 };
  console.log('\n## 세 렌즈 교차 — 이벤트 시대색 후보 / 연표 후보(서로 다른 사건, 실제 구간) / EM 항목 (얇음 표시: 시대색 < 1.0 · 연표 평균 < 6(전부 실제 구간인 칸은 최소 ≤ 1도) · EM ≤ 2)');
  console.log('| 세대 | 나이대 | 시대색(이벤트) | 연표 후보 평균 [최소] | 전망 구간 비율 | EM 항목 | 얇은 렌즈 수 |');
  console.log('|---|---|---:|---:|---:|---:|---:|');
  const thinCells: string[] = [];
  for (const g of GENERATIONS)
    for (const band of AGE_BANDS) {
      const ev = cellStat(g, band, MAIN);
      const tl = timelineCell(g, band);
      const emN = emCell(em, g, band);
      let pairs = 0;
      let proj = 0;
      for (let b = g.from; b <= g.to; b++)
        for (let a = band.min; a <= band.max; a++) {
          pairs++;
          if (b + a > 2025) proj++;
        }
      const projShare = proj / pairs;
      // 전망 구간이 대부분인 칸은 연표 후보가 실제 구간만 센 값이라 연표 렌즈 판정에서 뺀다(전망 사건 PJ가 채울 칸)
      const tlThin = projShare < 0.5 && (tl.mean < 6 || (projShare === 0 && tl.min <= 1));
      const evThin = ev.meanTagged < 1.0;
      const emThin = emN <= 2;
      const lenses = [evThin, tlThin, emThin].filter(Boolean).length;
      if (lenses >= 2) thinCells.push(`${g.label} ${band.label} (${lenses}렌즈: ${[evThin && '시대색', tlThin && '연표', emThin && 'EM'].filter(Boolean).join('·')})`);
      console.log(`| ${g.label} | ${band.label} | ${fx(ev.meanTagged, 1)}${evThin ? ' ▼' : ''} | ${tl.years < 0.5 ? '(전망)' : `${fx(tl.mean, 1)} [${tl.min}]`}${tlThin ? ' ▼' : ''} | ${pct(projShare, 0)} | ${emN}${emThin ? ' ▼' : ''} | ${lenses} |`);
    }
  console.log(`\n두 렌즈 이상 얇은 칸 ${thinCells.length}개:`);
  for (const c of thinCells) console.log(`- ${c}`);
}
