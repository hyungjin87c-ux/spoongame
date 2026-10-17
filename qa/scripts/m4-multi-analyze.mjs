// QA-003 M4: m4-multi.mjs 표본(여러 판)으로 또래 요즘 모습 통계(VP4·R-328)와 식구 ⇔ 저장 플래그(DB13·CM9)를 판정한다.
import fs from 'node:fs';
import path from 'node:path';
import { OUT, CASES } from './m4-lib.mjs';

const files = fs.readdirSync(OUT).filter((f) => /^samples-multi-.*\.jsonl$/.test(f));
const games = files.map((f) => {
  const [, era, seed] = /^samples-multi-(\w+)-(\d+)\.jsonl$/.exec(f);
  const S = fs.readFileSync(path.join(OUT, f), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return { era, seed: Number(seed), S };
}).filter((g) => g.S.length > 20);
const append = (rec) => {
  fs.appendFileSync(CASES, JSON.stringify({ ...rec, console: [], externalRequests: [], at: new Date().toISOString() }) + '\n');
  console.log(`[${rec.verdict}] ${rec.id} :: ${String(rec.actual).slice(0, 900)}`);
};
const RANGE = { '어린 시절': [0, 6], '학교에 다님': [7, 29], '일하는 사람': [18, 120], '구직 중': [19, 64], 돌봄: [30, 89], 은퇴: [55, 120] };

// ----- 또래 -----
const peerLives = []; // {game, name, grade, seq:[label by age]}
const contradictions = [];
for (const g of games) {
  const byName = new Map();
  for (const s of g.S) {
    for (const p of s.peers ?? []) {
      if (!byName.has(p.name)) byName.set(p.name, { grade: p.grade, labels: [] });
      byName.get(p.name).labels[s.age] = p.label;
      const r = RANGE[p.label];
      if (!r || s.age < r[0] || s.age > r[1]) contradictions.push(`${g.era}-${g.seed} ${p.name} ${s.age}세 ${p.label}`);
    }
  }
  for (const [name, v] of byName) peerLives.push({ game: `${g.era}-${g.seed}`, era: g.era, name, grade: v.grade, labels: v.labels });
}
const byGrade = {};
for (const pl of peerLives) {
  const o = (byGrade[pl.grade] = byGrade[pl.grade] ?? { n: 0, noWork1964: 0, maxSeek: 0, seekGt4: 0, retireThenWork: 0, retireThenOther: 0, changes: [], workShare3044: [0, 0, 0, 0], samples3044: 0 });
  o.n++;
  let anyWork = false;
  let streak = 0;
  let maxSeek = 0;
  let changes = 0;
  for (let a = 0; a < pl.labels.length; a++) {
    const l = pl.labels[a];
    if (l === undefined) continue;
    if (a >= 19 && a <= 64 && l === '일하는 사람') anyWork = true;
    if (l === '구직 중') {
      streak++;
      maxSeek = Math.max(maxSeek, streak);
    } else streak = 0;
    if (a > 0 && pl.labels[a - 1] !== undefined && pl.labels[a - 1] !== l) changes++;
    if (a > 0 && pl.labels[a - 1] === '은퇴') {
      if (l === '일하는 사람') o.retireThenWork++;
      else if (l !== '은퇴') o.retireThenOther++;
    }
    if (a >= 30 && a <= 44) {
      o.samples3044++;
      if (l === '일하는 사람') o.workShare3044[0]++;
      else if (l === '구직 중') o.workShare3044[1]++;
      else if (l === '돌봄') o.workShare3044[2]++;
      else o.workShare3044[3]++;
    }
  }
  if (!anyWork) o.noWork1964++;
  o.maxSeek = Math.max(o.maxSeek, maxSeek);
  if (maxSeek > 4) o.seekGt4++;
  o.changes.push(changes);
}
const gradeNames = ['흙수저', '동수저', '은수저', '금수저', '다이아몬드수저'];
const lines = gradeNames.filter((g) => byGrade[g]).map((g) => {
  const o = byGrade[g];
  const mean = o.changes.reduce((s, x) => s + x, 0) / o.changes.length;
  const ws = o.workShare3044.map((x) => Math.round((100 * x) / Math.max(1, o.samples3044)));
  return `${g}: ${o.n}명, 19~64세 미취업 ${o.noWork1964}명(${Math.round((100 * o.noWork1964) / o.n)}%), 구직 최장 ${o.maxSeek}년(5년↑ ${o.seekGt4}명), 은퇴 뒤 다시 일 ${o.retireThenWork}건/ 은퇴 뒤 다른 상태 ${o.retireThenOther}건, 평생 라벨 변화 평균 ${mean.toFixed(1)}회, 30~44세 일/구직/돌봄/그외 ${ws.join('/')}%`;
});
fs.writeFileSync(path.join(OUT, 'peers-multi-stats.txt'), lines.join('\n') + '\n\n모순: ' + contradictions.length);
const dirt = byGrade['흙수저'];
const bad = [];
if (contradictions.length) bad.push(`나이와 모순되는 라벨 ${contradictions.length}건 ${contradictions.slice(0, 3)}`);
if (dirt && dirt.noWork1964 / dirt.n > 0.05) bad.push(`흙수저 또래 평생 미취업 ${Math.round((100 * dirt.noWork1964) / dirt.n)}% > 5%`);
if (dirt && dirt.maxSeek > 4) bad.push(`흙수저 「구직 중」 최장 연속 ${dirt.maxSeek}년 > 4`);
for (const g of gradeNames) if (byGrade[g] && byGrade[g].maxSeek > 4) bad.push(`${g} 「구직 중」 최장 ${byGrade[g].maxSeek}년`);
// (재실행 시 중복 방지를 위해 같은 ID는 마지막 기록을 쓴다)
append({ id: 'M4-N10b', cat: '정상', title: `또래 요즘 모습 여러 판 관찰(${games.length}판·또래 ${peerLives.length}명): 나이와 모순되는 라벨 0, 흙수저 또래가 평생 구직 중으로 고정되지 않음(평생 미취업 ≤ 5%·「구직 중」 최장 연속 ≤ 4년)`, steps: `세 세상 × ${Math.round(games.length / 3)}판(시드 고정, 개발 서버 시간 배율 ×${process.env.QA_SCALE || 20}·자동 모드)에서 매 해 또래 4명의 라벨을 기록`, expected: 'M4 범위 정리 마스터 결정 기준 충족', verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + lines.join(' || '), shots: [] });

// 은퇴 뒤 다시 일하는 사람이 되는 것(인상)
const totRW = Object.values(byGrade).reduce((s, o) => s + o.retireThenWork, 0);
const totLives = peerLives.length;
const livesWithRW = peerLives.filter((pl) => {
  for (let a = 1; a < pl.labels.length; a++) if (pl.labels[a - 1] === '은퇴' && pl.labels[a] === '일하는 사람') return true;
  return false;
}).length;
const sampleRW = peerLives.find((pl) => {
  for (let a = 1; a < pl.labels.length; a++) if (pl.labels[a - 1] === '은퇴' && pl.labels[a] === '일하는 사람') return true;
  return false;
});
let ex = '';
if (sampleRW) {
  const runs = [];
  for (let a = 0; a < sampleRW.labels.length; a++) if (sampleRW.labels[a] && (!runs.length || runs[runs.length - 1].l !== sampleRW.labels[a])) runs.push({ l: sampleRW.labels[a], a });
  ex = `${sampleRW.game} ${sampleRW.name}(${sampleRW.grade}): ${runs.map((r) => `${r.a}세 ${r.l}`).join(' → ')}`;
}
const flicker1 = peerLives.reduce((s, pl) => {
  let n = 0;
  for (let a = 2; a < pl.labels.length; a++) if (pl.labels[a] !== pl.labels[a - 1] && pl.labels[a - 1] !== pl.labels[a - 2] && pl.labels[a - 2] === pl.labels[a]) n++;
  return s + n;
}, 0);
append({ id: 'M4-N10c', cat: '인상', title: '또래 라벨의 어색한 되돌림(RECORD): 「은퇴」한 또래가 뒤에 다시 「일하는 사람」이 됨, 한 해만 다른 라벨이 끼는 A→B→A 흔들림', steps: '여러 판 표본의 또래 평생 라벨 순서 분석', expected: '(기록) 판정 아님 — 마스터·디자이너 판단 자료', verdict: 'RECORD', severity: '낮음(인상)', actual: `은퇴 다음 해 「일하는 사람」인 전이 ${totRW}건(또래 ${totLives}명 중 ${livesWithRW}명, ${Math.round((100 * livesWithRW) / totLives)}%). 한 해만 끼는 A→B→A 흔들림 ${flicker1}건. 예: ${ex}`, shots: [] });

// ----- 식구 ⇔ 플래그 -----
const bad2 = [];
let lagged = 0;
const cover = { partner: 0, married: 0, divorced: 0, none: 0, child: 0, gone: 0 };
let checks = 0;
for (const g of games) {
  let prev = null;
  for (let si = 0; si < g.S.length; si++) {
    const s = g.S[si];
    const nxt = g.S[si + 1];
    if (!s.flags) continue;
    checks++;
    const f = s.flags;
    if (s.age >= 20) {
      const sOf = (fl) => (fl.includes('married') ? '있음' : fl.includes('divorced') ? '이혼' : fl.includes('has_partner') ? '연인' : '없음');
      const cOf = (fl) => (fl.includes('has_child') ? '있음' : '없음');
      const wantS = sOf(f);
      const wantC = cOf(f);
      if (s.spouse !== wantS && !(nxt && nxt.flags && s.spouse === sOf(nxt.flags))) bad2.push(`${g.era}-${g.seed} ${s.age}세 배우자 「${s.spouse}」 ⇔ 플래그 ${wantS}`);
      else if (s.spouse !== wantS) lagged++;
      if (s.child !== wantC && !(nxt && nxt.flags && s.child === cOf(nxt.flags))) bad2.push(`${g.era}-${g.seed} ${s.age}세 자녀 「${s.child}」 ⇔ 플래그 ${wantC}`);
      else if (s.child !== wantC) lagged++;
      cover[wantS === '있음' ? 'married' : wantS === '이혼' ? 'divorced' : wantS === '연인' ? 'partner' : 'none']++;
      if (wantC === '있음') cover.child++;
    } else if (s.spouse !== null || s.child !== null) bad2.push(`${g.era}-${g.seed} ${s.age}세(20세 미만)에 배우자/자녀 줄이 있음`);
    const motherGone = /세상을 떠남/.test(s.mother ?? '');
    const fatherGone = /세상을 떠남/.test(s.father ?? '');
    const mAge = Number(/(\d+)세/.exec(s.mother ?? '')?.[1]);
    const fAge = Number(/(\d+)세/.exec(s.father ?? '')?.[1]);
    const gone = f.includes('parents_gone');
    if (gone && (!motherGone || !fatherGone)) bad2.push(`${g.era}-${g.seed} ${s.age}세 parents_gone인데 표시 어머니 「${s.mother}」 아버지 「${s.father}」`);
    if (!gone && (motherGone || fatherGone) && prev) {
      // 플래그 없이 사별 표시: 나이 상한(100세)을 넘긴 경우뿐이어야 한다 — 직전 해 나이가 100 미만이면 이상
      const pm = Number(/(\d+)세/.exec(prev.mother ?? '')?.[1]);
      const pf = Number(/(\d+)세/.exec(prev.father ?? '')?.[1]);
      if (motherGone && pm && pm < 100 && !(nxt && nxt.flags && nxt.flags.includes('parents_gone'))) bad2.push(`${g.era}-${g.seed} ${s.age}세 플래그 없이 어머니 사별 표시(직전 ${pm}세)`);
      if (fatherGone && pf && pf < 100 && !(nxt && nxt.flags && nxt.flags.includes('parents_gone'))) bad2.push(`${g.era}-${g.seed} ${s.age}세 플래그 없이 아버지 사별 표시(직전 ${pf}세)`);
    }
    if (gone) cover.gone++;
    if (prev && prev.age + 1 === s.age) {
      const pm = Number(/(\d+)세/.exec(prev.mother ?? '')?.[1]);
      if (pm && mAge && mAge !== pm + 1) bad2.push(`${g.era}-${g.seed} ${s.age}세 어머니 나이 ${pm}→${mAge}`);
      const pf = Number(/(\d+)세/.exec(prev.father ?? '')?.[1]);
      if (pf && fAge && fAge !== pf + 1) bad2.push(`${g.era}-${g.seed} ${s.age}세 아버지 나이 ${pf}→${fAge}`);
      // 위 형제 나이 +1
      for (let i = 0; i < Math.min(prev.siblings.length, s.siblings.length); i++) {
        const a = Number(/(\d+)세/.exec(prev.siblings[i])?.[1]);
        const b = Number(/(\d+)세/.exec(s.siblings[i])?.[1]);
        if (a && b && b !== a + 1) bad2.push(`${g.era}-${g.seed} ${s.age}세 형제 나이 ${a}→${b}`);
      }
    }
    prev = s;
  }
}
const coverOk = cover.married > 0 && cover.child > 0 && cover.partner > 0 && cover.gone > 0;
append({ id: 'M4-N09b', cat: '정상', title: `식구 카드 ⇔ 저장 플래그(${games.length}판·매 해 표본 ${checks}개): 배우자(연인·있음·이혼·없음)·자녀·부모 사별 표시가 플래그와 일치, 부모·형제 나이 해마다 +1, 20세 미만에는 배우자·자녀 줄 없음`, steps: '자동 모드로 진행하는 여러 판의 매 해 대시보드 식구 글자와 같은 순간 저장의 flags를 대조', expected: '모순 0 — 연인·결혼·자녀·사별이 모두 표본에 등장', verdict: bad2.length ? 'FAIL' : 'PASS', severity: '높음', actual: (bad2.length ? [...new Set(bad2)].slice(0, 8).join(' / ') + ' | ' : '') + `표본 ${checks}개(표시가 같은 해 저장보다 한 표본 앞선 것 ${lagged}건은 저장이 효과로 뒤따라 쓰이는 시차라 통과 처리), 등장 횟수(해 단위) 연인 ${cover.partner} / 결혼 ${cover.married} / 이혼 ${cover.divorced} / 없음 ${cover.none} / 자녀 ${cover.child} / 사별 ${cover.gone}${coverOk ? '' : ' (일부 상태가 표본에 없음 — 공허 통과 주의)'}`, shots: [] });
