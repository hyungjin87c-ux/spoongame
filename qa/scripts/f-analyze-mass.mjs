// 대량 플레이 결과(mass-*.json) 분석: 이름 풀 대조(원자료 직접), 선택지 수, 밸런스, 방향 분포, 문구 반복, 글자 수 통계
import fs from 'node:fs';
import path from 'node:path';
import { FIN, ROOT } from './f-lib.mjs';
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const scourt = read(path.join(ROOT, 'src/data/sources/scourt-birth-names.json')).years;
const names = read(path.join(ROOT, 'src/data/names.json'));
const fb = read(path.join(ROOT, 'src/data/forbiddenNames.json'));
const forbidden = new Set(Array.isArray(fb) ? fb : fb.names ?? Object.values(fb).flat().filter((x) => typeof x === 'string'));
const SUR = names.surnames.items.map((s) => s.name);
const RANGE = { past: [1950, 1989], present: [2008, 2025], future: [2030, 2060] };
const all = [];
for (const e of ['past', 'present', 'future']) {
  const d = read(path.join(FIN, `mass-${e}.json`));
  all.push(...d.plays);
  if (d.problems.length) console.log('문제', e, d.problems.slice(0, 5));
}
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const r1 = (x) => Math.round(x * 10) / 10;
const out = { total: all.length, forbiddenCount: forbidden.size };

// 1) 이름
const nameBad = [];
for (const p of all) {
  const sur = p.name.slice(0, 1);
  const given = p.name.slice(1);
  const g = p.gender === 'male' ? 'M' : 'F';
  const [lo, hi] = RANGE[p.era];
  let pool = [];
  if (p.era === 'past') {
    const dec = names.decades[String(Math.floor(p.birthYear / 10) * 10)];
    const side = dec[p.gender === 'male' ? 'male' : 'female'];
    pool = [...side.verified, ...side.estimated];
  } else if (p.era === 'present') pool = (scourt[String(p.birthYear)]?.[g] || []).map((r) => r.name);
  else for (const y of [2021, 2022, 2023, 2024, 2025]) pool.push(...scourt[String(y)][g].map((r) => r.name));
  const probs = [];
  if (!SUR.includes(sur)) probs.push('성씨가 상위 10개 밖');
  if (!pool.includes(given)) probs.push(`이름 ${given}이 ${p.era} ${p.birthYear}년 ${p.gender} 풀에 없음`);
  if (p.birthYear < lo || p.birthYear > hi) probs.push('출생 연도가 시대 범위 밖');
  if (forbidden.has(p.name)) probs.push('금지 이름');
  if (given[0] === sur) probs.push('성과 이름 첫 글자 같음');
  if (!p.birth.year.includes(`${p.birthYear}년`) || !p.birth.year.includes(p.gender === 'male' ? '남자' : '여자')) probs.push('출생 화면 연도·성별 불일치');
  if (p.birth.name !== p.name) probs.push('출생 화면 이름 != 저장 이름');
  if (p.end.journey === null) probs.push('엔딩 문장 없음');
  if (probs.length) nameBad.push({ name: p.name, era: p.era, year: p.birthYear, probs });
}
out.names = { checked: all.length, bad: nameBad.length, examples: nameBad.slice(0, 5), uniqueNames: new Set(all.map((p) => p.name)).size };

// 2) 선택지 수·사망 나이
const cell = (f) => {
  const o = {};
  for (const era of ['past', 'present', 'future'])
    for (const mode of ['random', 'auto']) {
      const ps = all.filter((p) => p.era === era && p.mode === mode);
      if (ps.length) o[`${era}/${mode}`] = f(ps);
    }
  return o;
};
const nChoice = (p) => p.history.filter((h) => h.kind === 'choice').length;
out.choices = cell((ps) => ({ n: ps.length, mean: r1(mean(ps.map(nChoice))), min: Math.min(...ps.map(nChoice)), max: Math.max(...ps.map(nChoice)), share20to25: r1((100 * ps.filter((p) => nChoice(p) >= 20 && nChoice(p) <= 25).length) / ps.length), under20: ps.filter((p) => nChoice(p) < 20).length, over25: ps.filter((p) => nChoice(p) > 25).length }));
out.deathAge = cell((ps) => ({ mean: r1(mean(ps.map((p) => p.deathAge))), min: Math.min(...ps.map((p) => p.deathAge)), max: Math.max(...ps.map((p) => p.deathAge)), under20: ps.filter((p) => p.deathAge < 20).length }));
const mism = all.filter((p) => p.mode === 'random' && p.panels.length !== nChoice(p));
out.panelVsHistory = { randomPlays: all.filter((p) => p.mode === 'random').length, mismatch: mism.length };

// 3) 밸런스: 재력 단계별 평균
const byPw = {};
for (const era of ['past', 'present', 'future']) {
  byPw[era] = {};
  for (let pw = 1; pw <= 5; pw++) {
    const ps = all.filter((p) => p.era === era && p.pw === pw && p.deathAge >= 20);
    byPw[era][pw] = { n: ps.length, wealth: r1(mean(ps.map((p) => p.stats.wealth))), education: r1(mean(ps.map((p) => p.stats.education))), relationships: r1(mean(ps.map((p) => p.stats.relationships))), happiness: r1(mean(ps.map((p) => p.stats.happiness))), health: r1(mean(ps.map((p) => p.stats.health))) };
  }
}
out.balanceByPw = byPw;
const rel = all.filter((p) => p.deathAge >= 20).map((p) => p.stats.relationships);
const hist = {};
for (const v of rel) hist[Math.floor(v / 5) * 5] = (hist[Math.floor(v / 5) * 5] || 0) + 1;
out.relationshipsHist = { n: rel.length, mean: r1(mean(rel)), bins5: hist, within54to64: r1((100 * rel.filter((v) => v >= 54 && v <= 64).length) / rel.length) };

// 4) 방향 분포 (자동/무작위, 시대별)
const mv = (p) => (p.end.movement ? (p.end.movement.includes('앞선') ? 'up' : p.end.movement.includes('비슷한') ? 'same' : 'down') : 'none');
out.movement = cell((ps) => {
  const c = { up: 0, same: 0, down: 0, none: 0 };
  for (const p of ps) c[mv(p)]++;
  const n = ps.length;
  return { n, up: r1((100 * c.up) / n), same: r1((100 * c.same) / n), down: r1((100 * c.down) / n), none: c.none };
});
out.movementByPw = {};
for (const era of ['past', 'present', 'future']) {
  out.movementByPw[era] = {};
  for (let pw = 1; pw <= 5; pw++) {
    const ps = all.filter((p) => p.era === era && p.pw === pw && p.deathAge >= 20);
    const c = { up: 0, same: 0, down: 0 };
    for (const p of ps) c[mv(p)]++;
    out.movementByPw[era][pw] = `${ps.length}판 앞섬${c.up}/비슷${c.same}/뒤쪽${c.down}`;
  }
}
// 5) 문구 반복 (한 판 안에서 같은 문장이 두 번 이상)
const sentences = (t) => t.split(/(?<=[.?])\s+/).map((s) => s.trim()).filter((s) => s.length >= 8);
let playsWithRep = 0;
const repCount = {};
for (const p of all) {
  const cnt = {};
  for (const h of p.history) {
    if (h.kind === 'stage' || h.kind === 'death') continue;
    for (const s of sentences(`${h.text}`)) cnt[s] = (cnt[s] || 0) + 1;
  }
  const reps = Object.entries(cnt).filter(([, c]) => c >= 2);
  if (reps.length) playsWithRep++;
  for (const [s] of reps) repCount[s] = (repCount[s] || 0) + 1;
}
out.repeats = { playsWithRepeatedSentence: playsWithRep, of: all.length, top: Object.entries(repCount).sort((a, b) => b[1] - a[1]).slice(0, 8) };
// 6) 금지 표현
const BAN = [/(흙|동|은|금|다이아)\s*수저/, /[!！]/, /\p{Extended_Pictographic}/u, /(19|20)\d{2}년/];
const banHits = [];
for (const p of all) {
  for (const h of p.history) {
    if (h.kind === 'stage' && h.age === 0) continue; // 출생 연도 표시는 예외
    const t = `${h.title || ''} ${h.text || ''} ${h.choice || ''}`;
    BAN.forEach((re, k) => { if (re.test(t)) banHits.push([k, h.age, t.slice(0, 50)]); });
  }
  for (const pa of p.panels) {
    const t = `${pa.title} ${pa.text} ${pa.labels.join(' ')}`;
    BAN.forEach((re, k) => { if (re.test(t)) banHits.push([k, pa.age, t.slice(0, 50)]); });
  }
  for (const f of [p.end.journey, p.end.movement, p.end.death, p.end.choices]) BAN.forEach((re, k) => { if (f && re.test(f)) banHits.push([k, 'end', f.slice(0, 50)]); });
  if (p.birth) for (const f of [p.birth.wealth, p.birth.standing, p.birth.parenting, p.birth.looks]) BAN.forEach((re, k) => { if (re.test(f)) banHits.push([k, 'birth', f.slice(0, 50)]); });
}
out.banned = { hits: banHits.length, sample: banHits.slice(0, 5) };
// 7) 글자 수 통계 (수동 판의 패널, 모든 판의 선택 결과)
const panels = all.filter((p) => p.mode === 'random').flatMap((p) => p.panels);
const panelChars = panels.map((x) => x.title.length + x.text.length + x.labels.join('').length);
const bodyChars = panels.map((x) => x.text.length);
const results = all.flatMap((p) => p.history.filter((h) => h.kind === 'choice').map((h) => h.text.length));
const narr = all.flatMap((p) => p.history.filter((h) => h.kind === 'event').map((h) => h.text.length));
const st = (a) => ({ n: a.length, mean: r1(mean(a)), min: Math.min(...a), max: Math.max(...a) });
out.chars = { panel_title_body_labels: st(panelChars), panel_body: st(bodyChars), result: st(results), narrativeEvent: st(narr), labelsEach: st(panels.flatMap((x) => x.labels.map((l) => l.length))) };
const perPlay = all.filter((p) => p.mode === 'random').map((p) => {
  const pc = p.panels.reduce((a, x) => a + x.title.length + x.text.length + x.labels.join('').length, 0);
  const rc = p.history.filter((h) => h.kind === 'choice').reduce((a, h) => a + h.text.length, 0);
  const nc = p.history.filter((h) => h.kind === 'event').reduce((a, h) => a + h.text.length, 0);
  return { choices: nChoice(p), pc, rc, nc };
});
out.perPlay = { choices: st(perPlay.map((x) => x.choices)), panelChars: st(perPlay.map((x) => x.pc)), resultChars: st(perPlay.map((x) => x.rc)), narrativeChars: st(perPlay.map((x) => x.nc)) };
fs.writeFileSync(path.join(FIN, 'mass-analysis.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
