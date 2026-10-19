// QA-003 M7b 2회차: lines.jsonl에서 사람이 읽을 줄 모양 표를 뽑는다 → r2/d66-lines.txt(c-097·098·099 전 틀), r2/cite-lines-all.txt(89칸 × 8틀 전부)
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './m7b-lib.mjs';
const m = new Map();
for (const l of fs.readFileSync(path.join(OUT, 'lines.jsonl'), 'utf8').trim().split('\n')) {
  const r = JSON.parse(l);
  m.set(`${r.era}|${r.ev}|${r.cfg}`, r);
}
const rows = [...m.values()].filter((r) => r.lines).sort((a, b) => a.cid.localeCompare(b.cid) || a.era.localeCompare(b.era) || a.cfg.localeCompare(b.cfg));
const fmt = (r) => `${r.cid} ${r.era}/${r.ev} ${r.cfg} (안쪽 ${r.lines.parts['요약'].innerW}px)\n  요약: ${r.lines.parts['요약'].lines.join(' / ')}\n  출처: ${r.lines.parts['출처'].lines.join(' / ')}${r.lines.issues.length ? '\n  지적: ' + r.lines.issues.join(' ; ') : ''}`;
fs.writeFileSync(path.join(OUT, 'd66-lines.txt'), rows.filter((r) => ['c-097', 'c-098', 'c-099'].includes(r.cid)).map(fmt).join('\n'));
fs.writeFileSync(path.join(OUT, 'cite-lines-all.txt'), rows.map(fmt).join('\n'));
console.log(rows.length);
