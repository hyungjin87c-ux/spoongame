// SPEC-005 QA 3: 수저 5단계 × 양육 방식 표본에서 같은 카드의 부모 선택이 어떻게 갈리는가(눈으로 확인용 표). 개발 서버의 core로 판을 돌려 센다.
import fs from 'node:fs';
import path from 'node:path';
import { launchChromium, DEV, RES, oracle, run, ok, bad, note } from './q005-lib.mjs';
const b = await launchChromium();
const dev = await (await b.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });
const EVENTS = ['school-after-hours', 'infant-fever', 'infant-care', 'school-academy-night', 'infant-early-lessons'];
const res = await oracle(dev, `const mod = await import('/src/data/events/index.ts');
  const out = {};
  for (const id of arg.events) out[id] = {};
  for (let seed = 1; seed <= 9000; seed++) {
    let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
    const tier = s.character.parentWealth, style = s.character.parenting;
    for (let g = 0; g < 100 && s.phase === 'life' && s.age < 19; g++) {
      if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; }
      const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due);
      const r = core.stepYear(s);
      if (r.tick.kind === 'resolved' && r.tick.by === 'parent' && arg.events.includes(r.tick.eventId)) {
        const e = (out[r.tick.eventId][tier] ??= { n: 0, ch: {}, st: {} });
        e.n++; e.ch[r.tick.choiceId] = (e.ch[r.tick.choiceId] ?? 0) + 1;
      }
      s = r.state;
    }
  }
  return out;`, { events: EVENTS });
fs.writeFileSync(path.join(RES, 'tiers.json'), JSON.stringify(res, null, 1));
const rows = [];
for (const ev of EVENTS) {
  for (const t of [1, 2, 3, 4, 5]) {
    const e = res[ev][t];
    if (!e) { rows.push(`${ev} 재력${t}: 표본 없음`); continue; }
    rows.push(`${ev} 재력${t} n=${e.n}: ` + Object.entries(e.ch).map(([k, v]) => `${k} ${(v / e.n * 100).toFixed(0)}%`).join(' · '));
  }
}
await run({ id: 'PT-tiers', area: '부모 결정', title: '수저 5단계에 따라 같은 카드의 부모 선택 분포가 갈린다(엔진 표본 9000판, 눈으로 확인용 표)', steps: '지금 세상 9000판에서 부모 결정 카드별 재력 단계별 선택 비율', expected: '재력에 따라 돈이 드는 길의 비율이 달라짐(방향은 설계: 가난한 집일수록 돈 드는 길을 덜 고름) — 표 기록' }, async () => note(rows.join(' || ')));
await b.close();
console.log(rows.join('\n'));
