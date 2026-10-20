// QA-003 M9: m8-hold-analyze.mjs의 사본 — 폴더(HOLD_DIR)·결과 파일(HOLD_ANALYSIS)을 환경변수로 바꿀 수 있게 했다(P1 데스크톱 판 분석용). 분석 로직은 같다.
// QA-003 M8 Q1·Q2 분석: qa/results/m8/hold/<tag>.json 들을 읽어 해마다 연출 대기(나이 숫자가 바뀌는 간격)를 모델(holdMsFor, 계수 1.2)과 견준다.
// 사용: node qa/scripts/m8-hold-analyze.mjs [tag ...]   (태그 없으면 hold/*.json 전부) → qa/results/m8/hold-analysis.json
import fs from 'node:fs';
import path from 'node:path';
import { OUT, MODEL, holdModel, tol } from './m8-lib.mjs';

const dir = path.join(OUT, process.env.HOLD_DIR || 'hold');
const tags = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));

const stat = (a) => (a.length ? { n: a.length, mean: Math.round(a.reduce((x, y) => x + y, 0) / a.length), min: Math.round(Math.min(...a)), max: Math.round(Math.max(...a)) } : { n: 0 });

/** 한 판의 해마다 간격을 분류한다 */
export function analyzeRun(run, modeOverride = null) {
  const save = run.save;
  const lifeMode = modeOverride || save.lifeLength || 'short30';
  const speed = run.speed;
  const hist = save.history || [];
  const byAge = new Map();
  for (const h of hist) {
    if (!byAge.has(h.age)) byAge.set(h.age, []);
    byAge.get(h.age).push(h);
  }
  const kindOf = (prevAge) => {
    const es = byAge.get(prevAge) || [];
    const lines = es.filter((h) => h.kind === 'event' || h.kind === 'choice').length;
    if (es.some((h) => h.kind === 'choice')) return { kind: 'resolved', lines };
    if (es.some((h) => h.kind === 'event' && h.eventId !== undefined)) return { kind: 'narrative', lines };
    return { kind: 'quiet', lines: 0 };
  };
  const ev = run.events.slice().sort((a, b) => a.t - b.t);
  const ages = ev.filter((e) => e.k === 'age');
  const endEv = ev.find((e) => e.k === 'ending');
  const cards = ev.filter((e) => e.k === 'card');
  const cardGone = ev.filter((e) => e.k === 'cardGone');
  const samples = []; // { age, kind, lines, measured, model, cardPre, decide }
  for (let i = 0; i < ages.length; i++) {
    const cur = ages[i];
    const next = ages[i + 1];
    const tEnd = next ? next.t : endEv ? endEv.t : null;
    if (tEnd === null) continue;
    if (next && next.age !== cur.age + 1) continue; // 건너뛰기로 나이가 뛴 구간은 연출 대기가 아니다
    const { kind, lines } = i === 0 ? { kind: 'quiet', lines: 0 } : kindOf(cur.age - 1);
    // 이 구간 안의 카드
    const inCard = cards.filter((c) => c.t > cur.t && c.t < tEnd);
    const fromSkip = i > 0 && cur.age !== ages[i - 1].age + 1; // 「다음 결정으로」로 건너뛰어 도착한 나이: 앞쪽 대기가 없다
    if (fromSkip && inCard.length > 0) {
      const c0 = inCard[0];
      const gone0 = cardGone.find((g) => g.t > c0.t);
      samples.push({ age: cur.age, kind: 'skip-landing', lines: 0, measured: c0.t - cur.t, model: 0, card: true, decide: (gone0 ? gone0.t : tEnd) - c0.t, skipLanding: true });
      continue;
    }
    const model = holdModel(lifeMode, kind, lines) / speed;
    if (inCard.length === 0) {
      samples.push({ age: cur.age, kind, lines, measured: tEnd - cur.t, model, card: false });
    } else {
      const c = inCard[0];
      const gone = cardGone.find((g) => g.t > c.t);
      samples.push({ age: cur.age, kind, lines, measured: c.t - cur.t, model, card: true, decide: (gone ? gone.t : tEnd) - c.t });
    }
  }
  return { lifeMode, speed, samples };
}

const out = { runs: {}, byKind: {} };
const agg = {};
for (const tag of tags) {
  const f = path.join(dir, `${tag}.json`);
  if (!fs.existsSync(f)) continue;
  const run = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!run.save || !run.events) continue;
  const a = analyzeRun(run);
  const play = run.save.play;
  const total = a.samples.filter((x) => !x.skipLanding).reduce((s, x) => s + x.model, 0);
  const measuredSum = a.samples.filter((x) => !x.skipLanding).reduce((s, x) => s + x.measured, 0);
  const cardsN = (run.save.history || []).filter((h) => h.kind === 'choice').length;
  const rec = {
    tag,
    era: run.era,
    seed: run.seed,
    speed: run.speed,
    mode: run.mode,
    wallSec: run.wallSec,
    lifeLength: a.lifeMode,
    age: run.save.age,
    phase: run.save.phase,
    cards: cardsN,
    play,
    modelHoldSum: Math.round(total),
    domHoldSum: Math.round(measuredSum),
    holdRatio: play ? +(play.hold / total).toFixed(4) : null,
    domRatio: +(measuredSum / total).toFixed(4),
    decideModel: run.mode === 'auto' ? Math.round(cardsN * (MODEL[a.lifeMode].autoChoice / run.speed)) : null,
    decideRatio: run.mode === 'auto' && play ? +(play.decide / (cardsN * (MODEL[a.lifeMode].autoChoice / run.speed))).toFixed(4) : null,
    lat: run.lat ? { n: run.lat.n, meanLate: +(run.lat.sum / Math.max(1, run.lat.n)).toFixed(2), max: Math.round(run.lat.max), over50: run.lat.over50, over100: run.lat.over100 } : null,
    errors: run.errors.length,
    ext: run.ext.length,
    endText: run.endText,
  };
  // 종류별
  const kinds = {};
  for (const s of a.samples.filter((x) => !x.skipLanding)) {
    // 「다음 결정으로」 판은 결과 해만 자연스러운 대기다(나머지 간격은 건너뛰기 직후라 대기가 아니다)
    if ((run.mode === 'skip' && s.kind !== 'resolved') || tag.startsWith('skipfast')) continue;
    const key = `${s.kind}${s.kind === 'quiet' ? '' : '-L' + Math.min(s.lines, 4)}`;
    (kinds[key] ||= []).push(s);
  }
  rec.kinds = {};
  for (const [k, arr] of Object.entries(kinds)) {
    const m = arr[0].model;
    const lo = m * 0.98;
    const hi = m * 1.03 + 250; // 0.25초는 절대값
    const bad = arr.filter((s) => s.measured < lo || s.measured > hi);
    rec.kinds[k] = { model: Math.round(m), ...stat(arr.map((s) => s.measured)), outside: bad.length, outsideAges: bad.map((s) => `${s.age}:${Math.round(s.measured)}`).slice(0, 6), lo: Math.round(lo), hi: Math.round(hi) };
    (agg[`${run.mode === 'skip' ? 'skip-' : ''}x${run.speed}|${k}`] ||= []).push(...arr.map((s) => ({ ...s, tag })));
  }
  rec.cardDecide = stat(a.samples.filter((s) => s.card).map((s) => s.decide));
  out.runs[tag] = rec;
}
out.byKind = {};
for (const [k, arr] of Object.entries(agg)) {
  const [sp, kind] = k.split('|');
  const speed = Number(sp.replace('skip-', '').slice(1));
  const m = arr[0].model;
  const lo = m * 0.98;
  const hi = m * 1.03 + 250;
  const bad = arr.filter((s) => s.measured < lo || s.measured > hi);
  out.byKind[k] = { model: Math.round(m), ...stat(arr.map((s) => s.measured)), ratio: +(arr.reduce((x, y) => x + y.measured, 0) / arr.length / m).toFixed(4), outside: bad.length, lo: Math.round(lo), hi: Math.round(hi) };
}
fs.writeFileSync(path.join(OUT, process.env.HOLD_ANALYSIS || 'hold-analysis.json'), JSON.stringify(out, null, 1));
for (const r of Object.values(out.runs)) {
  console.log(`${r.tag}: x${r.speed} ${r.mode} age ${r.age} 카드 ${r.cards} | 모델 연출합 ${r.modelHoldSum}ms DOM합 ${r.domHoldSum}ms (${r.domRatio}) 저장 hold ${r.play?.hold} (${r.holdRatio}) decide ${r.play?.decide} (모델 ${r.decideModel}, ${r.decideRatio}) | 지연 평균 ${r.lat?.meanLate}ms 최대 ${r.lat?.max}ms`);
  for (const [k, v] of Object.entries(r.kinds)) console.log(`   ${k}: 모델 ${v.model} 측정 n=${v.n} 평균 ${v.mean} [${v.min}~${v.max}] 허용 ${v.lo}~${v.hi} 밖 ${v.outside}${v.outsideAges.length ? ' ' + v.outsideAges.join(',') : ''}`);
}
console.log('--- 합계(배속·종류별) ---');
for (const [k, v] of Object.entries(out.byKind)) console.log(`${k}: 모델 ${v.model} n=${v.n} 평균 ${v.mean} (비 ${v.ratio}) [${v.min}~${v.max}] 허용 ${v.lo}~${v.hi} 밖 ${v.outside}`);
