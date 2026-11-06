// QA(SPEC-009 FM7a) T10 글감 변형(note-parents-aging)이 뜰 차례인 판 — 한 분이 먼저 떠난 판(mother_gone / father_gone)에서 멈춘 상태
import '../../../src/data/installAll';
import { writeFileSync, mkdirSync } from 'node:fs';
import { GENERATION_IDS, autoResolveStep, consumeNote, dueNote, stepYear, type GameState, type ProfileId } from '../../../src/core';
import { startLife } from '../../../scripts/simulateLib';

const OUT = process.env.QA_OUT ?? 'qa/scripts/009/fm7a-states5';
mkdirSync(OUT, { recursive: true });
const got: Record<string, number> = {};
for (const [gi, gen] of GENERATION_IDS.entries()) {
  for (let i = 0; i < 400 && Object.keys(got).length < 6; i++) {
    const seed = 111_000_000 + gi * 1_000_003 + i * 71;
    let s: GameState = startLife(seed, gen as ProfileId);
    for (let guard = 0; guard < 400 && s.phase === 'life'; guard++) {
      if (s.pending !== null) { s = autoResolveStep(s, s.pending.key).state; continue; }
      const due = dueNote(s);
      if (due !== null) {
        if (due.id === 'note-parents-aging') {
          const kind = s.flags.includes('mother_gone') ? 'mother_gone' : s.flags.includes('father_gone') ? 'father_gone' : s.flags.includes('parents_gone') ? 'both' : 'none';
          const key = `NOTE-${kind}-${gen}`;
          if (!got[key] && (kind === 'mother_gone' || kind === 'father_gone' || kind === 'none')) {
            got[key] = seed;
            writeFileSync(`${OUT}/${key}.json`, JSON.stringify({ version: 9, data: { ...s, paused: true } }));
            console.log(key, 'seed', seed, 'age', s.age, 'name', s.character?.name);
          }
        }
        s = consumeNote(s, due);
      }
      s = stepYear(s).state;
    }
  }
}
