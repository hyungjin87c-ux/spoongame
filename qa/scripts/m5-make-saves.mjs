// QA-003 M5 감사용 저장 만들기: 수확한 실제 저장(samples-fix-*.jsonl)에서 화면 상태별 저장 원문을 골라 qa/results/m5/saves/<세상>-<태그>.json ({ game: 원문 })으로 둔다.
// 태그: young-choice(20세 전 선택지·집안 살림) adult-choice(성인 선택지, 영향 줄 가장 긴 것) adult-dash(성인, 선택지 없음) neg-dash(순자산 음수) extreme-neg(범위 끝 음수) extreme-big(범위 끝 큰 값)
//       ending(성인 엔딩) ending-neg ending-zero ending-early(20세 전 엔딩, 변조)
import fs from 'node:fs';
import path from 'node:path';
import { OUT, editSave } from './m5-lib.mjs';

const SAVES = path.join(OUT, 'saves');
fs.mkdirSync(SAVES, { recursive: true });
const runs = [];
for (const f of fs.readdirSync(OUT).filter((x) => /^samples-fix-.*\.jsonl$/.test(x))) for (const l of fs.readFileSync(path.join(OUT, f), 'utf8').trim().split('\n')) if (l) runs.push(JSON.parse(l));
const put = (era, tag, raw) => fs.writeFileSync(path.join(SAVES, `${era}-${tag}.json`), JSON.stringify({ game: raw }));
const itemsOf = (fx) => Math.max(...fx.dash.choices.map((c) => c.impact.length));
const labelLen = (fx) => Math.max(...fx.dash.choices.map((c) => c.label.length));

for (const era of ['past', 'present', 'future']) {
  const fx = [];
  for (const r of runs.filter((x) => x.era === era && x.fixtures)) for (const f of r.fixtures) fx.push({ ...f, seed: r.seed, d: JSON.parse(f.raw).data });
  const endings = runs.filter((x) => x.era === era && x.ending).map((x) => x.ending);
  const young = fx.filter((f) => f.d.assets === null && f.dash.choices.some((c) => c.impact.some((i) => i.key === 'family')));
  young.sort((a, b) => itemsOf(b) - itemsOf(a) || labelLen(b) - labelLen(a));
  put(era, 'young-choice', young[0].raw);
  const adult = fx.filter((f) => f.d.assets !== null);
  adult.sort((a, b) => itemsOf(b) - itemsOf(a) || labelLen(b) - labelLen(a));
  put(era, 'adult-choice', adult[0].raw);
  console.log(era, 'young', young[0].seed, young[0].d.age, young[0].dash.choiceTitle, itemsOf(young[0]), '| adult', adult[0].seed, adult[0].d.age, adult[0].dash.choiceTitle, itemsOf(adult[0]));
  const mid = adult.filter((f) => f.d.age >= 30 && f.d.age <= 50).sort((a, b) => b.d.assets.net - a.d.assets.net)[0] ?? adult[0];
  const noPending = (raw, mod) =>
    editSave(raw, (d) => {
      const ev = d.pending?.eventId;
      d.pending = null;
      if (ev) delete d.seen[ev];
      d.paused = true;
      if (mod) mod(d);
    });
  put(era, 'adult-dash', noPending(mid.raw));
  put(era, 'neg-dash', noPending(mid.raw, (d) => { d.assets.net = -3000; d.assets.debt = 3000; d.assets.income = 2400; }));
  put(era, 'extreme-neg', noPending(mid.raw, (d) => { d.assets.net = -200000; d.assets.debt = 200000; d.assets.income = 0; }));
  put(era, 'extreme-big', noPending(mid.raw, (d) => { d.assets.net = 2000000; d.assets.debt = 1000000; d.assets.income = 100000; }));
  const ed = endings.find((raw) => JSON.parse(raw).data.assets !== null && JSON.parse(raw).data.assets.net > 0) ?? endings[0];
  put(era, 'ending', ed);
  put(era, 'ending-neg', editSave(ed, (d) => { d.assets.net = -3000; d.assets.debt = 3000; }));
  put(era, 'ending-zero', editSave(ed, (d) => { d.assets.net = 0; d.assets.debt = 0; }));
  put(era, 'ending-early', editSave(ed, (d) => {
    d.age = 15;
    d.death = { age: 15, cause: '병' };
    d.assets = null;
    d.familyFund = 0;
    d.history = d.history.filter((h) => h.age <= 15);
    d.seen = Object.fromEntries(Object.entries(d.seen).filter(([, a]) => a <= 15));
    d.lastChoiceAge = null;
    d.flags = d.flags.filter((f) => !['married', 'has_child', 'has_career'].includes(f));
  }));
}
console.log('saves', fs.readdirSync(SAVES).length);
