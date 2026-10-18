// QA-003 M7a 측정기 자체 시험(R05): impact.jsonl의 실제 측정값에 화면 영향 줄을 일부러 틀리게 바꿔(방향 뒤집기·항목 숨기기·칸 수 바꾸기) 같은 대조를 돌리고 위반이 잡히는지 본다(진짜는 0).
// 사용: node qa/scripts/m7a-impact-selftest.mjs     결과: 케이스 M7a-R05b
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';

const recs = fs.readFileSync(path.join(OUT, RP + 'impact.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => !r.err);
const RANGE = { 1: [1, 2], 2: [3, 6], 3: [7, 1e9] };
const STATS = ['education', 'health', 'happiness', 'relationships'];

function judge(mutate) {
  let viol = 0;
  let pairs = 0;
  for (const rec of recs) {
    const rs = rec.runs.filter((r) => r.after);
    if (rs.length !== rec.card.choices.length) continue;
    const items = rec.card.choices.map((c) => mutate(c.items.map((i) => ({ ...i }))));
    const dStat = rs.map((r) => Object.fromEntries(STATS.map((s) => [s, r.after.stats[s] - r.before.stats[s]])));
    const rng = items.map((its) => Object.fromEntries(STATS.map((s) => {
      const it = its.find((i) => i.key === s);
      if (!it) return [s, [0, 0]];
      const [lo, hi] = RANGE[it.steps];
      return [s, it.direction === 'up' ? [lo, hi] : [-hi, -lo]];
    })));
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) for (const s of STATS) {
      const bi = rs[i].before.stats[s];
      if (bi <= 2 || bi >= 98) continue;
      pairs++;
      const d = dStat[i][s] - dStat[j][s];
      if (d < rng[i][s][0] - rng[j][s][1] - 1 || d > rng[i][s][1] - rng[j][s][0] + 1) viol++;
    }
  }
  return { viol, pairs };
}
const real = judge((x) => x);
const flip = judge((x) => x.map((i) => ({ ...i, direction: i.direction === 'up' ? 'down' : 'up' })));
const hide = judge((x) => x.filter((i) => !STATS.includes(i.key) || i.key === 'happiness' ? true : false));
const steps = judge((x) => x.map((i) => ({ ...i, steps: i.steps === 3 ? 1 : Math.min(3, i.steps + 1) })));
const ok = real.viol === 0 && flip.viol > 0 && hide.viol > 0 && steps.viol > 0;
const rec = {
  id: 'M7a-R05b',
  cat: '회귀',
  title: 'R05 측정기 자체 시험: 영향 줄을 일부러 틀리게 바꿔 같은 대조를 돌리면 위반이 잡힌다(방향 뒤집기·스탯 항목 숨기기·칸 수 바꾸기), 진짜는 0',
  steps: 'impact.jsonl의 실제 선택 전후 값에 변조한 영향 줄을 넣어 쌍 대조를 다시 돌림',
  expected: '진짜 위반 0, 변조 3종 모두 위반 > 0',
  verdict: ok ? 'PASS' : 'FAIL',
  actual: `진짜 ${real.viol}/${real.pairs}쌍 · 방향 뒤집기 ${flip.viol} · 항목 숨기기 ${hide.viol} · 칸 수 바꾸기 ${steps.viol}건을 위반으로 잡음`,
  shots: [],
  console: [],
  externalRequests: [],
  at: new Date().toISOString(),
};
fs.appendFileSync(path.join(OUT, RP + 'cases.jsonl'), JSON.stringify(rec) + '\n');
console.log(`[${rec.verdict}] ${rec.id} :: ${rec.actual}`);
