import fs from 'node:fs';
import path from 'node:path';
import { RES_DIR } from './lib.mjs';
const last = new Map();
for (const f of fs.readdirSync(RES_DIR).filter((x) => x.endsWith('.jsonl'))) {
  for (const line of fs.readFileSync(path.join(RES_DIR, f), 'utf8').trim().split('\n')) {
    const r = JSON.parse(line);
    const prev = last.get(r.id);
    if (!prev || prev.at <= r.at) last.set(r.id, r);
  }
}
const ids = [...last.keys()].sort();
const cnt = {};
for (const id of ids) cnt[last.get(id).verdict] = (cnt[last.get(id).verdict] || 0) + 1;
console.log(ids.length, JSON.stringify(cnt));
for (const id of ids) { const r = last.get(id); if (r.verdict !== 'PASS') console.log(id, r.verdict, r.title.slice(0, 60), '::', String(r.actual).slice(0, 160)); }
const nums = ids.filter((i) => /^M3-A\d+$/.test(i)).map((i) => Number(i.slice(4)));
const miss = []; for (let i = 1; i <= Math.max(...nums); i++) if (!nums.includes(i)) miss.push(i);
console.log('missing A ids:', miss.join(','));
