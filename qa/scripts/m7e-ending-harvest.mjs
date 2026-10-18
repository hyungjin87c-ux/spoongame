// QA-003 M7e 엔딩 문장 표본(수확·플레이 전체): 엔딩 글에서 출발선 문장·방향 문장을 읽어 (a) 최종 자리가 「가운데쯤」인 판 (b) 0원 판의 방향 (c) 시대·재력별 방향 분포 (d) 글에서 푼 기대(구간·점수)와 방향 문장의 일치를 센다.
// 사용: node qa/scripts/m7e-ending-harvest.mjs   결과: qa/results/m7e/ending-harvest.json
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './m7e-lib.mjs';
import { parseBand, parseEnd, expectMovement, MV_TEXT } from './m7e-ending-lib.mjs';

const lives = [];
for (const f of fs.readdirSync(OUT).filter((f) => /^samples-harvest-(past|present|future)-[a-z]\d?\.jsonl$/.test(f))) {
  for (const line of fs.readFileSync(path.join(OUT, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (r.final && r.endingText) lives.push(r);
  }
}
const inv = Object.fromEntries(Object.entries(MV_TEXT).map(([k, v]) => [v, k]));
const out = { lives: lives.length, middleFinal: 0, mismatch: 0, unparsed: 0, zero: {}, dist: {}, zeroFuture1Up: 0, early: 0, examples: [] };
for (const l of lives) {
  const t = l.endingText.split('\n').map((s) => s.trim()).filter(Boolean);
  const j = t.find((s) => /의 집에서 태어/.test(s));
  const mv = t.find((s) => /^출발선(보다|과) /.test(s));
  const tier = l.final.character.parentWealth;
  const k = `${l.era}-t${tier}`;
  if (!j) { out.unparsed++; continue; }
  if (!mv) { out.early++; continue; }
  const m = /^(.+)의 집에서 태어나, (.+)의 형편으로 생을 마쳤습니다\.$/.exec(j);
  if (!m) { out.unparsed++; continue; }
  const band = parseBand(m[1]);
  const e = parseEnd(m[2]);
  if (m[2] === '가운데쯤') out.middleFinal++;
  if (!band || e === null) { out.unparsed++; continue; }
  const want = expectMovement(band, e);
  if (MV_TEXT[want] !== mv) { out.mismatch++; if (out.examples.length < 5) out.examples.push(`${l.era}-${l.seed}: ${j} / ${mv}`); }
  (out.dist[k] ??= { up: 0, same: 0, down: 0 })[inv[mv]]++;
  if (l.final.assets && l.final.assets.net === 0) {
    (out.zero[k] ??= { up: 0, same: 0, down: 0 })[inv[mv]]++;
    if (l.era === 'future' && tier === 1 && inv[mv] === 'up') out.zeroFuture1Up++;
  }
}
fs.writeFileSync(path.join(OUT, 'ending-harvest.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
