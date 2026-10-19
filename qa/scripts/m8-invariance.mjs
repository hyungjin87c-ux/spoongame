// QA-003 M8 인생 불변 표본: 실제 화면(prod, 자동 모드·실시간 시계)으로 끝까지 산 판의 마지막 저장(qa/results/m8/hold/*.json)과, 같은 시드·세상을 개발 서버의 core(오라클: playToEnd 자동 성향)로 돌린 결과가 같은가.
// 플레이 시간 타이머(syncPlay)·저장 flush·시계가 인생(연표·스탯·자산·사망·난수 상태)에 끼어들지 않았는지 본다. 같지 않아야 하는 필드는 play·paused·seen(기록 카드를 소비하며 note-… 키가 더해진다)뿐이다.
// 사용: node qa/scripts/m8-invariance.mjs [tag ...]   (자동 모드 판만; manual·skip 판은 첫 선택지 선택자로 대조)
import fs from 'node:fs';
import path from 'node:path';
import { launch, openOracle, evalCore, writeJson, runCase, OUT } from './m8-lib.mjs';

const dir = path.join(OUT, 'hold');
const tags = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('smoke')).map((f) => f.replace(/\.json$/, ''));
const browser = await launch();
const { page: oracle } = await openOracle(browser);
const rows = [];
for (const tag of tags) {
  const run = JSON.parse(fs.readFileSync(path.join(dir, `${tag}.json`), 'utf8'));
  if (!run.save || run.save.phase !== 'ending') continue;
  const chooser = run.mode === 'auto' ? 'auto' : 'first';
  const oracleState = await evalCore(
    oracle,
    `const s0 = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg.seed), arg.era)));
     const r = core.playToEnd(s0, arg.chooser === 'auto' ? null : (s) => s.pending.choiceIds[0]);
     return r.state;`,
    { seed: run.seed, era: run.era, chooser },
  );
  const a = JSON.parse(JSON.stringify(run.save));
  const b = JSON.parse(JSON.stringify(oracleState));
  const diffKeys = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (['play', 'paused'].includes(k)) continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) diffKeys.push(k);
  }
  // seen은 기록 카드 키(note-…)만 다를 수 있다
  let seenOnlyNotes = true;
  if (diffKeys.includes('seen')) {
    const strip = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !k.startsWith('note-')));
    seenOnlyNotes = JSON.stringify(strip(a.seen)) === JSON.stringify(strip(b.seen));
  }
  const real = diffKeys.filter((k) => k !== 'seen');
  rows.push({ tag, era: run.era, seed: run.seed, mode: run.mode, speed: run.speed, diffKeys, seenOnlyNotes, same: real.length === 0 && seenOnlyNotes, history: a.history.length, age: a.age });
}
writeJson('invariance.json', rows);
await browser.close();
const bad = rows.filter((r) => !r.same);
console.log(rows.map((r) => `${r.tag} ${r.same ? 'same' : 'DIFF ' + r.diffKeys.join(',')}`).join('\n'));
await runCase({ id: 'IV01', title: `인생 불변: 실시간 화면으로 산 ${rows.length}판의 최종 저장 = 같은 시드의 core 결과(play·paused·기록 카드 seen 키 제외)` }, async () => ({
  verdict: bad.length === 0 && rows.length > 0 ? 'PASS' : 'FAIL',
  actual: `${rows.length}판 중 불일치 ${bad.length}${bad.length ? ': ' + bad.map((r) => `${r.tag}[${r.diffKeys.join(',')}]`).join(' ') : ''}`,
  shots: [],
}));
