import { ERAS } from '../src/core';
import { isChoiceEvent } from '../src/core/events';
import { EVENT_POOL } from '../src/data/events';
import { eventCounts } from './spec003BaselineLib';
import { APPENDIX_A, BANDS, choiceEventsInBand, meanOf, seOf, tallyLife, underNineteenChoiceIds, type BandKey, type CardTally } from './spec005BaselineLib';
import { simulateMany, type Strategy } from './simulateLib';

/**
 * SPEC-005 QI0 기준선 측정 실행 스크립트. 실행: ./node_modules/.bin/vite-node scripts/spec005Baseline.ts [판수=1000]
 * 결과는 docs/data/spec-005-baseline.md에 옮겨 적는다. 게임 코드는 바꾸지 않는다.
 *  1) 선택지 이벤트(결정 카드) 정의 수: 나이 구간 4개 × 시대 3개 (단계·나이 범위·시대 제한만 본다 — 플래그·재력 조건은 보지 않는다)
 *  2) 부록 A 분류표가 데이터와 맞는지: 19세 미만에서 일어날 수 있는 선택지 이벤트 = 32장
 *  3) 판당 결정 카드 평균: 나이 구간별 · 규칙상 부모 소관(부록 A) · 순수 부모 결정 / M2 후보(아이 반응·행동·목소리) · 13~18세 본인 카드 — 시대 × 전략(수동 흉내 random / 자동 성향 auto)
 */

const lives = Number(process.argv[2] ?? 1000);
const fx = (n: number, d = 2) => n.toFixed(d);
const KEYS = BANDS.map((b) => b.key) as BandKey[];

// ---------- 1) 정의 수 ----------
const totalChoice = EVENT_POOL.events.filter(isChoiceEvent).length;
console.log(`## 1) 선택지 이벤트(결정 카드) 정의 수 — 전체 ${totalChoice}개 (이벤트 ${EVENT_POOL.events.length}개 중)`);
const byStage = eventCounts().byStage;
console.log(`단계(stage) 정의별 선택지 이벤트(여러 단계에 걸친 이벤트는 단계마다 센다): ${Object.entries(byStage).map(([k, v]) => `${k} ${v.choice}`).join(' · ')}`);
const firstStage: Record<string, number> = {};
const multi: string[] = [];
for (const ev of EVENT_POOL.events.filter(isChoiceEvent)) {
  firstStage[ev.stages[0]] = (firstStage[ev.stages[0]] ?? 0) + 1;
  if (ev.stages.length > 1) multi.push(`${ev.id}[${ev.stages.join('+')}]`);
}
console.log(`단계(stage) 정의별, 첫 단계로만 센 합계(= SPEC 90개): ${Object.entries(firstStage).map(([k, v]) => `${k} ${v}`).join(' · ')} / 여러 단계에 걸친 ${multi.length}개: ${multi.join(', ')}`);
console.log('구간 안 어느 한 해라도 일어날 수 있는 선택지 이벤트 수 (시대별). 한 이벤트가 두 구간에 걸치면 구간마다 센다.');
console.log(`| 구간 | ${ERAS.join(' | ')} | 시대 무관(합집합) |`);
for (const b of BANDS) {
  const per = ERAS.map((e) => choiceEventsInBand(b.key, e));
  const union = new Set(per.flatMap((s) => [...s]));
  console.log(`| ${b.label} | ${per.map((s) => s.size).join(' | ')} | ${union.size} |`);
}

// ---------- 2) 부록 A 대조 ----------
const under19 = underNineteenChoiceIds();
const table = new Set(Object.keys(APPENDIX_A));
const onlyData = [...under19].filter((id) => !table.has(id));
const onlyTable = [...table].filter((id) => !under19.has(id));
console.log(`\n## 2) 부록 A 대조 — 19세 미만에서 일어날 수 있는 선택지 이벤트(데이터) ${under19.size}개, 부록 A 표 ${table.size}개`);
console.log(`  데이터에만 있음: ${onlyData.length ? onlyData.join(', ') : '(없음)'} / 표에만 있음: ${onlyTable.length ? onlyTable.join(', ') : '(없음)'}`);
const all = new Set(EVENT_POOL.events.filter(isChoiceEvent).map((e) => e.id));
console.log(`  표의 id가 모두 실제 선택지 이벤트인가: ${[...table].every((id) => all.has(id))}`);

// ---------- 3) 판당 평균 ----------
console.log(`\n## 3) 판당 결정 카드 평균 (시대 × 전략, ${lives}판, 시드 i×7919+13)`);
const STRATEGIES: Array<[Strategy, string]> = [
  ['random', '수동 흉내(무작위)'],
  ['auto', '자동 성향'],
];
for (const [strategy, sLabel] of STRATEGIES) {
  console.log(`\n### 전략: ${sLabel} (${strategy})`);
  console.log(`| 시대 | 총 카드 | ${BANDS.map((b) => b.label).join(' | ')} | 규칙상 부모 소관 | 그중 순수 부모 | 그중 M2 후보(R / P / V) | 13~18세 본인 | 본인이 고르는 카드(총 − 부모 소관) |`);
  const rows: Array<{ era: string; t: CardTally[] }> = [];
  for (const era of ERAS) {
    const sims = simulateMany(era, lives, strategy);
    const t = sims.map((l) => tallyLife(l.final.history, era, l.final.character!.birthYear));
    rows.push({ era, t });
    const m = (f: (x: CardTally) => number) => meanOf(t.map(f));
    const byBand = KEYS.map((k) => m((x) => x.band[k]));
    console.log(
      `| ${era} | ${fx(m((x) => x.total))} ± ${fx(seOf(t.map((x) => x.total)), 2)} | ${byBand.map((v) => fx(v)).join(' | ')} | **${fx(m((x) => x.parentRule))}** ± ${fx(seOf(t.map((x) => x.parentRule)), 2)} | ${fx(m((x) => x.parentPure))} | ${fx(m((x) => x.child.R + x.child.P + x.child.V))} (${fx(m((x) => x.child.R))} / ${fx(m((x) => x.child.P))} / ${fx(m((x) => x.child.V))}) | ${fx(m((x) => x.self13to18))} | ${fx(m((x) => x.total - x.parentRule))} |`,
    );
  }
  const flat = rows.flatMap((r) => r.t);
  const mf = (f: (x: CardTally) => number) => meanOf(flat.map(f));
  console.log(`| 세 시대 평균 | ${fx(mf((x) => x.total))} | ${KEYS.map((k) => fx(mf((x) => x.band[k]))).join(' | ')} | **${fx(mf((x) => x.parentRule))}** | ${fx(mf((x) => x.parentPure))} | ${fx(mf((x) => x.child.R + x.child.P + x.child.V))} | ${fx(mf((x) => x.self13to18))} | ${fx(mf((x) => x.total - x.parentRule))} |`);
  console.log(`  구간별 규칙상 부모 소관(세 시대 평균): ${KEYS.map((k, i) => `${BANDS[i].label} ${fx(mf((x) => x.parentByBand[k]))}`).join(' / ')}`);

  // PD0 설계 문서 승인안 분류(부모 / 흘러감 / 본인) — docs/data/parent-decision-model.md 1-2절
  console.log(`
#### PD0 승인안 분류 (${sLabel})`);
  console.log('| 시대 | 총 카드 | 부모가 정함 | 흘러감(아이의 일) | 사람이 안 고름(합) | 사람이 고름(c_self) | 부모: 영유아 / 8~12 / 13~18 | 흘러감: 영유아 / 8~12 / 13~18 | 13~18세 본인 |');
  for (const r of rows) {
    const m = (f: (x: CardTally) => number) => meanOf(r.t.map(f));
    console.log(
      `| ${r.era} | ${fx(m((x) => x.total))} | **${fx(m((x) => x.pd0.parent))}** | ${fx(m((x) => x.pd0.child))} | ${fx(m((x) => x.pd0.notChosen))} ± ${fx(seOf(r.t.map((x) => x.pd0.notChosen)), 2)} | ${fx(m((x) => x.total - x.pd0.notChosen))} | ${fx(m((x) => x.pd0.parentByBand.infant))} / ${fx(m((x) => x.pd0.parentByBand.age8to12))} / ${fx(m((x) => x.pd0.parentByBand.age13to18))} | ${fx(m((x) => x.pd0.childByBand.infant))} / ${fx(m((x) => x.pd0.childByBand.age8to12))} / ${fx(m((x) => x.pd0.childByBand.age13to18))} | ${fx(m((x) => x.pd0.self13to18))} |`,
    );
  }
  console.log(`| 세 시대 평균 | ${fx(mf((x) => x.total))} | **${fx(mf((x) => x.pd0.parent))}** | ${fx(mf((x) => x.pd0.child))} | ${fx(mf((x) => x.pd0.notChosen))} | ${fx(mf((x) => x.total - x.pd0.notChosen))} | ${fx(mf((x) => x.pd0.parentByBand.infant))} / ${fx(mf((x) => x.pd0.parentByBand.age8to12))} / ${fx(mf((x) => x.pd0.parentByBand.age13to18))} | ${fx(mf((x) => x.pd0.childByBand.infant))} / ${fx(mf((x) => x.pd0.childByBand.age8to12))} / ${fx(mf((x) => x.pd0.childByBand.age13to18))} | ${fx(mf((x) => x.pd0.self13to18))} |`);

  // 인용 박스 노출률(카드 기준: 카드가 뜬 횟수 가운데 인용 박스가 보인 몫) — 결정자별. 전체 노출률은 READ_MODEL.citeExposure(자동 성향 1000판)와 같은 방법이다
  console.log(`
#### 인용 박스 노출률 (${sLabel}, PD0 승인안 분류)`);
  console.log('| 시대 | 전체 | 부모가 정하는 카드 | 흘러감 카드 | 본인이 고르는 카드 |');
  const rate = (t: CardTally[], key: 'parent' | 'child' | 'self' | 'all') => {
    const shown = t.reduce((a, x) => a + x.cite[key].shown, 0);
    const cited = t.reduce((a, x) => a + x.cite[key].cited, 0);
    return shown === 0 ? '-' : `${fx(cited / shown, 3)} (${cited}/${shown})`;
  };
  for (const r of rows) console.log(`| ${r.era} | ${rate(r.t, 'all')} | ${rate(r.t, 'parent')} | ${rate(r.t, 'child')} | ${rate(r.t, 'self')} |`);
}
