// SPEC-005 r4(v0.2.1) QA 공용 라이브러리. q005-lib의 도우미를 그대로 쓰고, 기록 위치만 qa/results/005-r4/로 바꾼다.
// 앱 코드(src·tests·e2e)는 건드리지 않는다. 상태는 개발 서버(5391)의 core로 만들고(오라클) 프로덕션 번들(4391)에 심어 연다.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SHOT_DIR } from './q005-lib.mjs';
export * from './q005-lib.mjs';

export const RES4 = path.join(ROOT, 'qa', 'results', process.env.QA_RES_NAME || '005-r4'); // r4b 회귀: QA_RES_NAME=005-r4b
fs.mkdirSync(RES4, { recursive: true });
export const CASES4 = path.join(RES4, 'cases.jsonl');
export function record(c, r) {
  const rec = { ...c, ...r, at: new Date().toISOString() };
  fs.appendFileSync(CASES4, JSON.stringify(rec) + '\n');
  const mark = r.verdict === 'PASS' ? 'PASS  ' : r.verdict === 'FAIL' ? 'FAIL !!' : r.verdict;
  console.log(`[${mark}] ${c.id} ${c.title} :: ${String(r.actual ?? '').slice(0, 260)}`);
  return rec;
}
export async function run(c, fn) {
  let r;
  try {
    r = await fn();
  } catch (e) {
    r = { verdict: 'ERROR', actual: `스크립트 오류: ${String(e && e.message ? e.message : e).slice(0, 300)}` };
  }
  return record(c, r);
}
export function writeJson(name, obj) {
  fs.writeFileSync(path.join(RES4, name), JSON.stringify(obj, null, 1));
}
export { SHOT_DIR };

/** 이벤트 eventId의 결정 카드가 대기 중인 인생 상태(오라클). age를 주면 그 나이, 아니면 가능한 나이의 가운데. */
export const pendingState = (dev, eventId, { era = 'present', age = null, minChoices = 2 } = {}) =>
  import('./q005-lib.mjs').then(({ oracle, withoutPlay }) =>
    oracle(
      dev,
      `const mod = await import('/src/data/events/index.ts');
    const ev = mod.EVENT_POOL.byId.get(arg.eventId);
    if (!ev) return null;
    const ages = core.possibleAgesOf(ev);
    const target = arg.age ?? ages[Math.floor(ages.length / 2)];
    for (let seed = 1; seed <= 1500; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
      while (s.phase === 'life' && s.age < target) { if (s.pending !== null) s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state; else s = core.stepYear(s).state; }
      if (s.phase !== 'life' || s.age !== target) continue;
      const visible = core.visibleChoices(ev, core.condContextOf(s));
      if (visible.length < arg.minChoices) continue;
      return { ...s, seen: { ...s.seen, [arg.eventId]: target }, lastChoiceAge: target, pending: { eventId: arg.eventId, key: arg.eventId + '@' + target, age: target, choiceIds: visible.map((c) => c.id) } };
    }
    return null;`,
      { eventId, era, age, minChoices },
    ).then((s) => (s ? withoutPlay(s) : null)),
  );
