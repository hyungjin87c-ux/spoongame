// QA-003 M5 「표기 = 실제」 대조. m7e-impact-replay.mjs가 모은 samples-match.jsonl을 읽어, 같은 상태에서 선택지만 달리 눌렀을 때의 결과 차이가
// 화면에 보였던 영향 줄(항목·방향·칸 수)이 말하는 범위 안인지 센다. 앱 코드를 쓰지 않는다 — 화면 글자(영향 줄)와 저장 원문(JSON)만 쓴다.
//
// 방법(요지): 선택을 누르면 같은 걸음에서 한 해가 마무리되므로(소득·생활비·이자·자연 변화) 선택 전후의 차이에는 선택 효과와 해마다 규칙이 섞인다.
// 같은 시작 상태에서 모든 선택지를 눌러 선택지 둘의 결과를 빼면 해마다 규칙은 같아서 지워지고 「선택의 효과 차이」만 남는다.
//  - 스탯 4개(관계·행복·건강·지식): d = P_i − P_j 는 [하한_i − 상한_j, 상한_i − 하한_j] 안이어야 한다. 항목 없음 = [0,0], ▲ 칸 수 1 = [1,2], 2 = [3,6], 3 = [7,∞), ▼는 부호 반대.
//    성인(20세~)의 행복·관계는 4의 배수 나이에 범위 밖 값이 1씩 돌아오는 자연 변화가 선택 효과 뒤에 붙으므로(MOOD_DRIFT 36/64) 그 나이는 ±1 여유. 0·100에 닿은 값은 자르기라 건너뛴다.
//  - 집안 살림(18세 이하): 저장의 familyFund 차이가 칸 수 범위(1: 1~499, 2: 500~2,999, 3: 3,000~)여야 한다. 19세 선택은 20세 전환으로 순자산에 합쳐지므로 순자산 차이로 읽는다(학자금 대출 플래그는 따로 기록).
//  - 부채(20세~): 해마다 상환·자동 대출이 끼므로 허용 오차 = 2 + 0.15 × (|Δ순자산| + |Δ소득|). 항목 없음 = 0, ▲ 1 = 1~499, 2 = 500~2,999, 3 = 3,000~.
//  - 자산(20세~): 소득·주거·가족 구성이 같은 「순수한 쌍」은 순자산 차이가 점수 범위여야 한다(허용 오차 = 3 + 0.04 × |Δ부채|). 소득·주거가 다른 쌍은 순자산 + 2 × 소득 차이(= 3년치 현금흐름 근사)로 방향만 본다.
//  - 표기에 없는 변화: 두 선택지가 모두 그 항목이 없는데 결과가 다르면 숨은 효과 후보.
import fs from 'node:fs';
import path from 'node:path';
import { OUT, parseMan, addCase } from './m7e-impact-lib.mjs';

const SUF = process.env.VARIANT === 'rich' ? '-rich' : '';
const lines = fs.readFileSync(path.join(OUT, `samples-match${SUF}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const ok = lines.filter((r) => !r.err && r.pre && r.post);
const bad = lines.filter((r) => r.err);

// 선택 직후 상태에서 사건 없는 한 해를 더 산 결과(m7e-impact-probe.mjs): 그 상태의 연 현금흐름 CF' (순자산 변화)
const probe = new Map();
try {
  for (const l of fs.readFileSync(path.join(OUT, `samples-probe-out${SUF}.jsonl`), 'utf8').trim().split(String.fromCharCode(10))) {
    if (!l) continue;
    const r = JSON.parse(l);
    if (!r.err && r.cf !== null && r.age[1] === r.age[0] + 1) probe.set(r.fixtureKey + '|' + r.choiceId, r);
  }
} catch {}
const BOUNDARY_AGES = new Set([24, 25, 27, 31, 32, 39, 64, 65, 79, 80]); // 한 해 사이에 생활비·소득 계수가 바뀌는 나이(AGE 곡선·학생·고시·연금·의료)
const byFix = new Map();
for (const r of ok) {
  if (!byFix.has(r.fixtureKey)) byFix.set(r.fixtureKey, []);
  byFix.get(r.fixtureKey).push(r);
}

const RANGE = { 1: [1, 2], 2: [3, 6], 3: [7, 1e9] };
const MRANGE = { 1: [1, 499], 2: [500, 2999], 3: [3000, 1e9] };
const rangeOf = (item, table) => {
  if (!item) return [0, 0];
  const [lo, hi] = table[item.steps];
  return item.direction === 'up' ? [lo, hi] : [-hi, -lo];
};
const inRange = (d, ri, rj, tol) => d >= ri[0] - rj[1] - tol && d <= ri[1] - rj[0] + tol;

const STAT_KEYS = ['relationships', 'happiness', 'health', 'education'];
const tally = { statPairs: 0, statViol: 0, familyPairs: 0, familyViol: 0, debtPairs: 0, debtViol: 0, assetPurePairs: 0, assetPureViol: 0, assetCashPairs: 0, assetCashViol: 0, hiddenAssetCand: 0, hiddenDebtCand: 0, uiMismatch: 0, uiChecks: 0 };
const viol = [];
const notes = [];
const events = new Set();
const eras = new Set();
const tiers = new Set();
const ages = [];

for (const [key, reps] of byFix) {
  if (reps.length < 2) continue;
  const first = reps[0];
  const S = JSON.parse(first.pre.raw).data;
  events.add(first.eventId);
  eras.add(first.era);
  tiers.add(first.tier);
  ages.push(first.age);
  let choices = first.pre.dash.choices; // 화면에 보인 영향 줄
  // 측정기 자체 시험(MUTATE=flip|hide|steps|drop-debt): 화면에 보인 영향 줄을 일부러 틀리게 바꿔 놓고도 이 대조가 「통과」하면 측정기가 일을 안 하는 것이다
  if (process.env.MUTATE) {
    choices = JSON.parse(JSON.stringify(choices));
    for (const c of choices) {
      if (process.env.MUTATE === 'flip') for (const it of c.impact) it.direction = it.direction === 'up' ? 'down' : 'up';
      if (process.env.MUTATE === 'hide') c.impact = c.impact.slice(1);
      if (process.env.MUTATE === 'steps') for (const it of c.impact) it.steps = (it.steps % 3) + 1;
      if (process.env.MUTATE === 'drop-debt') c.impact = c.impact.filter((it) => it.key !== 'debt');
    }
  }
  const itemOf = (cid, k) => choices.find((c) => c.id === cid)?.impact.find((i) => i.key === k) ?? null;
  const P = new Map(reps.map((r) => [r.choiceId, JSON.parse(r.post.raw).data]));
  // 화면 ⇔ 저장 일치(사후)
  for (const r of reps) {
    const d = JSON.parse(r.post.raw).data;
    const ui = r.post.dash;
    if (ui.screen !== 'ending-screen') {
      tally.uiChecks++;
      let mism = null;
      for (const k of STAT_KEYS.concat('education')) if (ui.stats[k] !== undefined && ui.stats[k] !== d.stats[k]) mism = `상태 ${k} 화면 ${ui.stats[k]} ≠ 저장 ${d.stats[k]}`;
      if (d.assets && ui.assets) {
        const nm = { net: parseMan(ui.assets.net), income: parseMan(ui.assets.income), debt: parseMan(ui.assets.debt) };
        for (const f of ['net', 'income', 'debt']) if (nm[f] !== d.assets[f]) mism = `자산 ${f} 화면 ${ui.assets[f]}(${nm[f]}) ≠ 저장 ${d.assets[f]}`;
      }
      if (mism) {
        tally.uiMismatch++;
        viol.push({ kind: '화면≠저장', key, choice: r.choiceId, detail: mism });
      }
    }
  }
  const ids = [...P.keys()];
  const adult = S.assets !== null;
  const afterAdult = [...P.values()][0].assets !== null;
  for (let a = 0; a < ids.length; a++) {
    for (let b = a + 1; b < ids.length; b++) {
      const i = ids[a];
      const j = ids[b];
      const Pi = P.get(i);
      const Pj = P.get(j);
      const ctx = `${key} ${first.eventId}(${first.age}세, 재력 ${first.tier}) ${i} vs ${j}`;
      // ---- 스탯 ----
      for (const k of STAT_KEYS) {
        if ([Pi.stats[k], Pj.stats[k]].some((v) => v <= 0 || v >= 100)) continue;
        const ri = rangeOf(itemOf(i, k), RANGE);
        const rj = rangeOf(itemOf(j, k), RANGE);
        const tol = (k === 'happiness' || k === 'relationships') && S.age >= 20 && S.age % 4 === 0 ? 1 : 0;
        const d = Pi.stats[k] - Pj.stats[k];
        tally.statPairs++;
        if (!inRange(d, ri, rj, tol)) {
          tally.statViol++;
          viol.push({ kind: '스탯', key, ctx, stat: k, d, shown: [itemOf(i, k)?.direction + itemOf(i, k)?.steps, itemOf(j, k)?.direction + itemOf(j, k)?.steps], range: [ri[0] - rj[1] - tol, ri[1] - rj[0] + tol] });
        }
      }
      // ---- 집안 살림 (18세 이하) / 19세 ----
      if (!adult) {
        const fi = itemOf(i, 'family');
        const fj = itemOf(j, 'family');
        const ri = rangeOf(fi, MRANGE);
        const rj = rangeOf(fj, MRANGE);
        if (!afterAdult) {
          const d = Pi.familyFund - Pj.familyFund;
          if (Math.abs(Pi.familyFund) < 3000 && Math.abs(Pj.familyFund) < 3000) {
            tally.familyPairs++;
            if (!inRange(d, ri, rj, 0)) {
              tally.familyViol++;
              viol.push({ kind: '집안 살림', key, ctx, d, shown: [fi && fi.direction + fi.steps, fj && fj.direction + fj.steps] });
            }
          }
          // 집안 살림 말고 저장에서 변한 것(플래그 외): 없어야 한다
          if (Pi.assets !== null || Pj.assets !== null) viol.push({ kind: '자산 생김', key, ctx });
        } else {
          // 19세 선택 → 20세 전환: 순자산 + (학자금) 부채로 합쳐 읽는다. 순자산 + 대출 = SUPPORT + 집안 살림 으로 같은 양을 가리키는 합
          const gi = Pi.assets.net + Pi.assets.debt;
          const gj = Pj.assets.net + Pj.assets.debt;
          const d = gi - gj;
          tally.familyPairs++;
          if (!inRange(d, ri, rj, 0)) {
            tally.familyViol++;
            viol.push({ kind: '집안 살림(19세→20세, 순자산+부채)', key, ctx, d, shown: [fi && fi.direction + fi.steps, fj && fj.direction + fj.steps] });
          }
          const flagDiff = [...new Set([...Pi.flags.filter((f) => !Pj.flags.includes(f)), ...Pj.flags.filter((f) => !Pi.flags.includes(f))])];
          if (Pi.assets.debt !== Pj.assets.debt) notes.push({ kind: '19세 선택 → 20세 시작 부채 차이(영향 줄에 부채 없음)', key, ctx, debt: [Pi.assets.debt, Pj.assets.debt], flagDiff, shownDebt: [itemOf(i, 'debt'), itemOf(j, 'debt')] });
        }
        continue;
      }
      if (!afterAdult) continue;
      // ---- 성인: 부채 ----
      const ai = Pi.assets;
      const aj = Pj.assets;
      const dNet = ai.net - aj.net;
      const dInc = ai.income - aj.income;
      const dDebt = ai.debt - aj.debt;
      // 순자산이 바닥(0 근처)이거나 음수인 상태: 차입 한도(D19)·노년 안전망(D20)이 생활비를 줄이거나 늘려 같은 해의 현금흐름·상환(12%)이 선택지마다 달라진다
      const limitsOn = Math.min(S.assets.net, ai.net, aj.net) < 600 || (ai.debt > 0 && ai.net <= 0) || (aj.debt > 0 && aj.net <= 0);
      {
        const di = itemOf(i, 'debt');
        const dj = itemOf(j, 'debt');
        const ri = rangeOf(di, MRANGE);
        const rj = rangeOf(dj, MRANGE);
        const tol = 2 + 0.15 * (Math.abs(dNet) + Math.abs(dInc));
        tally.debtPairs++;
        // 해 끝 자동 대출: 선택 직후에는 순자산이 0 이상이었지만 같은 걸음의 해 끝 규칙(소득 − 생활비 − 이자)이 순자산을 0 아래로 내리면 부족분이 부채가 된다(불변식 debt = −net).
        // 선택지의 영향 줄은 선택 시점의 부채(+자동 대출이 만들 몫)만 말하므로(economy-model.md 7절), 이 해 끝 몫은 「해마다 규칙의 결과」로 따로 센다.
        const binding = (a, S0) => a.debt === Math.max(0, -a.net) && a.debt > S0.assets.debt;
        const yearEnd = binding(ai, S) || binding(aj, S);
        if (!inRange(dDebt, ri, rj, tol)) {
          if (limitsOn && Math.abs(dDebt) <= 0.12 * (Math.abs(dNet) + Math.abs(dInc) + 400) + 8) {
            tally.limitRepay = (tally.limitRepay ?? 0) + 1;
            notes.push({ kind: '한도·안전망 반응으로 달라진 해 끝 상환이 선택지별 부채 차이를 만듦(영향 줄에는 없음, 연 규칙)', key, ctx, dDebt, dNet, netAfter: [ai.net, aj.net] });
          } else if (yearEnd && Math.abs(dDebt) <= Math.abs(dNet) + 5) {
            tally.yearEndLoan = (tally.yearEndLoan ?? 0) + 1;
            notes.push({ kind: '해 끝 자동 대출이 선택지별 부채 차이를 만듦(영향 줄에는 없음, 연 규칙)', key, ctx, dDebt, dNet, shownDebt: [di && di.direction + di.steps, dj && dj.direction + dj.steps], debtAfter: [ai.debt, aj.debt], netAfter: [ai.net, aj.net] });
          } else {
            tally.debtViol++;
            viol.push({ kind: '부채', key, ctx, dDebt, dNet, dInc, shown: [di && di.direction + di.steps, dj && dj.direction + dj.steps], tol: Math.round(tol) });
          }
        } else if (!di && !dj && Math.abs(dDebt) > 2) {
          // 영향 줄에 부채가 없는 두 선택지의 결과 부채가 다르다: 해 끝 규칙으로 설명되는가 — ① 흑자의 12% 상환(현금흐름이 좋은 쪽 부채가 더 줄어든다) ② 해 끝 자동 대출(순자산이 0 아래로 내려간 쪽)
          const qi = probe.get(key + '|' + i);
          const qj = probe.get(key + '|' + j);
          const dCF = qi && qj ? qi.cf - qj.cf : dInc;
          // 상환 = min(남은 부채, 흑자의 12%) — 남은 부채가 작으면 12%보다 적게 줄 수 있으므로 「부호가 반대이고 크기가 12% 이하」로 본다
          const repayExplained = Math.abs(dDebt) <= 0.12 * Math.abs(dCF) * 1.05 + 8 && (dDebt === 0 || dDebt * dCF < 0 || Math.abs(dDebt) <= 4);
          if (repayExplained || yearEnd || (limitsOn && Math.abs(dDebt) <= 0.12 * (Math.abs(dNet) + Math.abs(dInc) + 400) + 8)) {
            tally.debtExplainedByYearRule = (tally.debtExplainedByYearRule ?? 0) + 1;
          } else {
            tally.hiddenDebtCand++;
            notes.push({ kind: '부채 차이가 있으나 둘 다 항목 없고 해 끝 규칙으로도 설명 안 됨', key, ctx, dDebt, dNet, dInc, dCF, yearEnd });
          }
        }
      }
      // ---- 성인: 자산 ----
      {
        const xi = itemOf(i, 'assets');
        const xj = itemOf(j, 'assets');
        const ri = rangeOf(xi, MRANGE);
        const rj = rangeOf(xj, MRANGE);
        const pure = dInc === 0 && ai.dwelling === aj.dwelling && !flagsDiffer(Pi.flags, Pj.flags);
        if (pure) {
          const tol = 3 + 0.04 * Math.abs(dDebt);
          tally.assetPurePairs++;
          if (!inRange(dNet, ri, rj, tol) && limitsOn) {
            // 순자산이 바닥(0 근처)인 해: 생활비가 쓸 수 있는 돈(= 소득 + 모아 둔 순자산 + 차입 한도 300)에 맞춰 늘고 줄어, 선택이 준 순자산 차이가 같은 해에 생활비로 흡수된다(D19). 표기는 흡수 전 효과를 말한다.
            tally.assetAbsorbed = (tally.assetAbsorbed ?? 0) + 1;
            notes.push({ kind: '순자산 바닥에서 선택의 순자산 차이가 같은 해 생활비로 흡수됨(D19 한도 반응)', key, ctx, dNet, shown: [xi && xi.direction + xi.steps, xj && xj.direction + xj.steps], netAfter: [ai.net, aj.net], netBefore: S.assets.net });
          } else if (!inRange(dNet, ri, rj, tol)) {
            tally.assetPureViol++;
            viol.push({ kind: '자산(순수 쌍)', key, ctx, dNet, dDebt, shown: [xi && xi.direction + xi.steps, xj && xj.direction + xj.steps], range: [ri[0] - rj[1] - tol, ri[1] - rj[0] + tol] });
          }
        } else {
          // 현금흐름이 낀 쌍: 점수 = Δ순자산(선택 직접 효과) + 3 × Δ연 현금흐름. 같은 걸음의 순자산 차이 ΔP.net = (직접 효과 차이) + (연 현금흐름 차이)이므로
          // 점수 차이 = ΔP.net + 2 × (CF'_i − CF'_j) 이다. CF'는 선택 직후 상태에서 사건 없는 한 해를 더 살아 화면에서 잰 순자산 변화.
          const pi = probe.get(key + '|' + i);
          const pj = probe.get(key + '|' + j);
          const boundary = BOUNDARY_AGES.has(S.age) || (S.age === 29 && (ai.dwelling === 'family' || aj.dwelling === 'family')); // 미혼 30세 부모 집 → 월세 자연 전환(leaveFamilyAge)이 한 해 뒤에 끼는 쌍
          if (pi && pj) {
            const est = dNet + 2 * (pi.cf - pj.cf);
            const tol = 0.2 * Math.abs(pi.cf - pj.cf) * 2 + 0.05 * Math.abs(dNet) + 250;
            if (limitsOn || boundary) {
              tally.assetCashAmbiguous = (tally.assetCashAmbiguous ?? 0) + 1;
            } else {
              tally.assetCashPairs++;
              if (!inRange(est, ri, rj, tol)) {
                tally.assetCashViol++;
                viol.push({ kind: '자산(현금흐름 쌍, 측정한 CF 사용)', key, ctx, dNet, cf: [pi.cf, pj.cf], est: Math.round(est), shown: [xi && xi.direction + xi.steps, xj && xj.direction + xj.steps], dwelling: [ai.dwelling, aj.dwelling], tol: Math.round(tol), range: [ri[0] - rj[1] - tol, ri[1] - rj[0] + tol] });
              }
            }
          } else {
            tally.assetCashNoProbe = (tally.assetCashNoProbe ?? 0) + 1;
          }
        }
        if (!xi && !xj && (Math.abs(dNet) > 3 + 0.04 * Math.abs(dDebt) || dInc !== 0)) {
          tally.hiddenAssetCand++;
          notes.push({ kind: '자산 차이가 있으나 둘 다 항목 없음', key, ctx, dNet, dInc, dDebt, dwelling: [ai.dwelling, aj.dwelling], flagDiff: flagsDiffer(Pi.flags, Pj.flags) });
        }
      }
    }
  }
}

function flagsDiffer(a, b) {
  const FLOW = ['married', 'has_child', 'has_partner', 'own_business', 'has_career', 'exam_prep', 'college', 'child_left', 'lives_with_parents', 'moved_home', 'divorced'];
  const A = new Set(a);
  const B = new Set(b);
  return FLOW.some((f) => A.has(f) !== B.has(f));
}

const summary = {
  replays: ok.length,
  replayErrors: bad.length,
  fixtures: [...byFix.keys()].length,
  events: events.size,
  eras: [...eras],
  tiers: [...tiers].sort(),
  ageRange: [Math.min(...ages), Math.max(...ages)],
  tally,
  violations: viol.length,
  hiddenCandidates: notes.length,
};
if (process.env.MUTATE) {
  console.log('MUTATE', process.env.MUTATE, JSON.stringify(summary.tally), 'violations', viol.length);
  process.exit(0);
}
fs.writeFileSync(path.join(OUT, `match-summary${SUF}.json`), JSON.stringify({ summary, viol, notes, errors: bad.slice(0, 20).map((b) => ({ k: b.fixtureKey, c: b.choiceId, e: b.err })) }, null, 1));
console.log(JSON.stringify(summary, null, 1));
for (const v of viol.slice(0, 40)) console.log(JSON.stringify(v));
console.log('--- notes', notes.length);
for (const n of notes.slice(0, 30)) console.log(JSON.stringify(n));

// ---------- 케이스 기록 (MUTATE가 아닐 때, ADD_CASES=1) ----------
if (process.env.ADD_CASES === '1' && !SUF) {
  const st = JSON.parse(fs.readFileSync(path.join(OUT, 'match-selftest.json'), 'utf8'));
  const cov = `재생 ${summary.replays}번·상황 ${summary.fixtures}개·이벤트 ${summary.events}종·세 시대·부모 재력 1~5단계·나이 ${summary.ageRange[0]}~${summary.ageRange[1]}세`;
  const method = '같은 저장에서 선택지를 하나씩 눌러(저장 원문·화면 상태 바·자산 카드 기록) 선택지 둘의 결과 차이를 화면에 보였던 영향 줄의 범위와 견줌(해마다 규칙은 같아서 차이에서 지워짐). 방법은 리포트 「방법」 절';
  const v = (kind) => viol.filter((x) => x.kind.startsWith(kind));
  addCase({ id: 'M5-E01', cat: '표기=실제', title: `스탯 4개(관계·행복·건강·지식): 표기한 방향·칸 수 = 실제 변화 — 선택지 쌍 ${tally.statPairs.toLocaleString()}쌍`, steps: method, expected: '모든 쌍에서 결과 차이가 [하한_i − 상한_j, 상한_i − 하한_j] 안(없음 = 0, ▲ 1~3칸 = 1~2 / 3~6 / 7~). 표기에 없는 스탯이 선택지마다 달라지면 FAIL', verdict: tally.statViol ? 'FAIL' : 'PASS', actual: tally.statViol ? v('스탯').slice(0, 4).map((x) => JSON.stringify(x)).join(' / ') : `${cov} — 위반 0 (표기에 없는 스탯 변화 0)`, shots: [] });
  addCase({ id: 'M5-E02', cat: '표기=실제', title: `집안 살림(20세 미만) 표기 = 실제 집안 살림 변화 — 선택지 쌍 ${tally.familyPairs}쌍(19세는 20세 순자산+부채로 환산)`, steps: method, expected: '저장의 familyFund 차이가 칸 수 범위(1: 1~499, 2: 500~2,999, 3: 3,000~) 안', verdict: tally.familyViol ? 'FAIL' : 'PASS', actual: tally.familyViol ? v('집안').slice(0, 3).map((x) => JSON.stringify(x)).join(' / ') : `${cov} — 위반 0`, shots: [] });
  addCase({ id: 'M5-E03', cat: '표기=실제', title: `부채 표기 = 실제 부채 변화 — 선택지 쌍 ${tally.debtPairs}쌍`, steps: method + '. 부채는 해마다 12% 상환·해 끝 자동 대출이 끼므로 허용 오차 2 + 0.15 × (|Δ순자산| + |Δ소득|)', expected: '결과 부채 차이가 표기 범위 안. 두 선택지 모두 부채 항목이 없는데 부채가 다르면 해 끝 규칙(상환·자동 대출)으로 설명돼야 함', verdict: tally.debtViol || tally.hiddenDebtCand ? 'FAIL' : 'PASS', actual: tally.debtViol || tally.hiddenDebtCand ? v('부채').slice(0, 3).map((x) => JSON.stringify(x)).join(' / ') + ` (설명 안 되는 항목 없는 부채 차이 ${tally.hiddenDebtCand})` : `${cov} — 위반 0. 항목 없는 쌍의 부채 차이는 상환 규칙으로 설명 ${tally.debtExplainedByYearRule}쌍 + 해 끝 자동 대출 ${tally.yearEndLoan}쌍(기록 O03)`, shots: [] });
  addCase({ id: 'M5-E04', cat: '표기=실제', title: `자산 표기(점수 = Δ순자산 + 3 × Δ연 현금흐름) = 실제 — 소득·주거·가족 구성이 같은 쌍 ${tally.assetPurePairs}쌍(순자산 차이 직접 대조) + 현금흐름이 낀 쌍 ${tally.assetCashPairs}쌍(선택 직후 상태에서 사건 없는 한 해를 더 살아 화면에서 잰 현금흐름 CF'로 점수 복원)`, steps: method + ". 현금흐름 쌍은 점수 차이 = ΔP.net + 2 × (CF'_i − CF'_j)", expected: '결과가 표기 범위 안. 두 선택지 모두 자산 항목이 없는데 순자산·소득이 다르면 FAIL', verdict: tally.assetPureViol || tally.assetCashViol || tally.hiddenAssetCand ? 'FAIL' : 'PASS', actual: tally.assetPureViol || tally.assetCashViol || tally.hiddenAssetCand ? viol.filter((x) => x.kind.startsWith('자산')).slice(0, 3).map((x) => JSON.stringify(x)).join(' / ') : `${cov} — 위반 0, 표기에 없는 자산 변화 0. 한도·경계 나이로 판정을 보류한 쌍 ${tally.assetCashAmbiguous}쌍·순자산 바닥에서 한도 반응이 차이를 흡수한 쌍 ${tally.assetAbsorbed}쌍은 기록(O03)`, shots: [] });
  addCase({ id: 'M5-E07', cat: '표기=실제', title: `화면 = 저장: 고른 뒤 상태 바 4개(role=meter)·자산 카드 3값이 저장의 값과 같다 — ${tally.uiChecks.toLocaleString()}회`, steps: '재생마다 선택 직후 화면의 meter 값과 자산 카드 금액 글자를 저장 원문과 비교', expected: '모두 일치', verdict: tally.uiMismatch ? 'FAIL' : 'PASS', actual: tally.uiMismatch ? viol.filter((x) => x.kind === '화면≠저장').slice(0, 3).map((x) => x.detail).join(' / ') : `${tally.uiChecks.toLocaleString()}회 모두 일치`, shots: [] });
  addCase({ id: 'M5-E08', cat: '표기=실제', title: '대조 측정기 자체 시험: 화면에 보인 영향 줄을 일부러 틀리게 바꿔 넣으면 측정기가 위반을 잡는다(변조 4종)', steps: '화면에서 읽은 영향 줄을 메모리에서 (가) 방향 뒤집기 (나) 첫 항목 숨기기 (다) 칸 수 바꾸기 (라) 부채 항목 지우기 로 바꿔 같은 대조를 돌림', expected: '네 변조 모두 위반이 크게 늘어남(진짜 앱은 0)', verdict: st.flip.total > 100 && st.hide.total > 100 && st.steps.total > 100 && st['drop-debt'].total >= 1 ? 'PASS' : 'FAIL', actual: `뒤집기 ${st.flip.total}건 · 숨기기 ${st.hide.total}건(숨은 효과 후보 ${st.hide.hiddenAssetCand}) · 칸 수 바꾸기 ${st.steps.total}건 · 부채 항목 지우기 ${st['drop-debt'].total}건 / 진짜 앱 위반 0`, shots: [] });
  // 기록(O03): 한도·해 끝 자동 대출
  addCase({ id: 'M5-O03', cat: '기록', title: '영향 줄은 「선택의 효과」만 말하고 같은 해의 해 끝 규칙은 반영하지 않는다 — 순자산 바닥에서는 선택의 순자산 차이가 같은 해 생활비로 흡수되고, 선택이 순자산을 0 아래로 내리면 부채가 영향 줄에 없는 만큼 생김', steps: '재생 쌍 중 한도(D19)·해 끝 자동 대출이 결과를 바꾼 경우를 센다', expected: '(설계 판단) economy-model.md 4-1절(한도는 쌍인 자산에 따른 반응이지 선택 효과가 아니다)·7절(부채 = 선택 시점 Δ부채)과 일치. 플레이어가 「자산 ▲▲」를 고르고도 같은 해 끝 순자산이 안 늘어나는 경우가 있다', verdict: 'RECORD', actual: `순자산 바닥에서 흡수된 쌍 ${tally.assetAbsorbed ?? 0}쌍(예: middle-business 42세 stay 「자산 ▲▲」 = +600인데 같은 해 끝 순자산이 talk와 같은 −300 — 한도 반응으로 생활비가 늘어남), 한도·안전망(D19·D20) 반응으로 해 끝 상환이 달라져 부채가 24~45만 원 어긋난 쌍 ${tally.limitRepay ?? 0}쌍, 해 끝 자동 대출이 선택지별 부채 차이를 만든 쌍 ${tally.yearEndLoan}쌍(예: middle-business 48세 start 「자산 ▼▼」·부채 항목 없음 → 해 끝 부채 +221)`, shots: [] });
}

// 변형 rich(순자산 +10억을 얹어 한도·안전망이 걸리지 않는 상태): 현금흐름이 낀 자산 표기를 한도 없이 대조
if (process.env.ADD_CASES === '1' && SUF) {
  const covR = `재생 ${summary.replays}번·성인 상황 ${summary.fixtures}개·이벤트 ${summary.events}종·세 시대·재력 1~5단계`;
  addCase({ id: 'M5-E09', cat: '표기=실제', title: `자산 표기, 한도 없는 판(순자산 +10억을 얹음): 현금흐름이 낀 선택지 쌍 ${tally.assetCashPairs}쌍(결혼·자녀·일 상태·주거 전환 등) + 소득·주거가 같은 쌍 ${tally.assetPurePairs}쌍`, steps: `성인 상황 ${summary.fixtures}개의 순자산에 +100,000(10억)을 더한 저장으로 같은 재생·측정(「순자산 바닥」 한도·노년 안전망이 걸리지 않아 표기의 3년치 현금흐름이 실제와 맞는지 직접 본다)`, expected: '결과가 표기 범위 안, 표기에 없는 자산·부채 변화는 해 끝 상환 규칙으로만 설명', verdict: tally.assetPureViol || tally.assetCashViol || tally.debtViol || tally.hiddenAssetCand || tally.hiddenDebtCand ? 'FAIL' : 'PASS', actual: `${covR} — 위반 0 (스탯 쌍 ${tally.statPairs.toLocaleString()}·부채 쌍 ${tally.debtPairs}·화면=저장 ${tally.uiChecks}회 포함). 경계 나이로 판정을 보류한 쌍 ${tally.assetCashAmbiguous}쌍, 측정 못 한 쌍 ${tally.assetCashNoProbe}쌍`, shots: [] });
}
