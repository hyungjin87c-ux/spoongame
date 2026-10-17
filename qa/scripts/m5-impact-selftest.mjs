// QA-003 M5: 표기 = 실제 대조 측정기의 자체 시험 — 화면에 보인 영향 줄을 일부러 틀리게 바꿔 놓고(방향 뒤집기·항목 숨기기·칸 수 바꾸기·부채 항목 지우기) 대조가 위반을 잡는지 본다.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './m5-lib.mjs';
const res = {};
for (const m of ['flip', 'hide', 'steps', 'drop-debt']) {
  const out = execFileSync('node', [path.join(import.meta.dirname, 'm5-impact-analyze.mjs')], { env: { ...process.env, MUTATE: m }, encoding: 'utf8' });
  const line = out.split('\n').find((l) => l.startsWith('MUTATE'));
  const t = JSON.parse(line.slice(line.indexOf('{'), line.lastIndexOf('}') + 1));
  res[m] = { statViol: t.statViol, familyViol: t.familyViol, debtViol: t.debtViol, assetPureViol: t.assetPureViol, assetCashViol: t.assetCashViol, hiddenAssetCand: t.hiddenAssetCand, total: line.split('violations ')[1].trim() };
}
fs.writeFileSync(path.join(OUT, 'match-selftest.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res));
