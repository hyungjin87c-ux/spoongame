// QA-003 M7e 2회차 「바뀐 문장」 점검: docs/data/content-M7e.md 10절 표의 (지금 → 새) 문장을 읽어
//  (1) 새 문장이 이벤트 JSON에 그대로 있는가(정적) (2) 옛 문장이 풀에 남지 않았는가 (3) 수확 표본(화면에 실제로 나온 연표 줄)에서 새 문장이 몇 번 보였고 옛 문장은 0번인가 를 센다.
// 결과: <OUT>/changed-sentences.json (읽기용 목록 포함)
// 사용: QA_OUT=qa/results/m7e/r2 node qa/scripts/m7e-r2-changed.mjs
import fs from 'node:fs';
import path from 'node:path';
import { OUT, ROOT } from './m7e-lib.mjs';

const doc = fs.readFileSync(path.join(ROOT, 'docs', 'data', 'content-M7e.md'), 'utf8');
const sec = doc.slice(doc.indexOf('## 10. QA·검수 보완'));
// 풀 전체(정적)
const pool = [];
for (const f of ['infant', 'school', 'youth', 'middle', 'senior']) {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'events', f + '.json'), 'utf8'));
  for (const e of Array.isArray(j) ? j : j.events) {
    pool.push({ id: e.id, kind: '본문', t: e.text });
    for (const c of e.choices ?? []) {
      pool.push({ id: `${e.id}/${c.id}`, kind: '결과', t: c.result });
      pool.push({ id: `${e.id}/${c.id}`, kind: '라벨', t: c.label });
    }
  }
}
const poolText = pool.map((x) => x.t).join('\n');
// 수확·플레이의 화면 문장
const seen = new Map();
const lives = [];
for (const f of fs.readdirSync(OUT).filter((f) => /^samples-harvest-(past|present|future)-[a-z]\d?\.jsonl$/.test(f))) {
  for (const line of fs.readFileSync(path.join(OUT, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (r.final) lives.push(r);
  }
}
const screenText = [];
for (const l of lives) {
  for (const h of l.final.history) screenText.push(h.text, h.choice ?? '');
  for (const d of l.decisions) {
    screenText.push(d.text);
    for (const c of d.choices) screenText.push(c.label);
  }
}
const screenBlob = screenText.join('\n');
const count = (needle) => (needle ? screenBlob.split(needle).length - 1 : 0);

const clean = (c) =>
  c
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s*\((?:[^()]*—[^()]*|명사화[^()]*|「[^()]*|4-3절[^()]*|O0[0-9][^()]*|위 O0[0-9][^()]*)\)\s*$/, '')
    .replace(/^…+/, '')
    .replace(/…$/, '')
    .trim();
const sentences = (t) => t.split(/(?<=[.])\s+/).map((s) => s.trim()).filter((s) => s.length > 5 && /다\.$/.test(s));
const pairs = [];
let sectionName = '';
for (const line of sec.split('\n')) {
  if (/^\*\*O0\d|^\*\*REV|^\*\*R-3|^### 10-/.test(line)) sectionName = line.slice(0, 40);
  if (!line.startsWith('|') || /^\|[-| ]+\|$/.test(line)) continue;
  const cells = line.split('|').slice(1, -1).map((c) => c.trim());
  if (cells.length < 3) continue;
  const oldC = clean(cells[cells.length - 2]);
  const newC = clean(cells[cells.length - 1]);
  const loc = cells[cells.length - 3].replace(/\*\*/g, '');
  const isLabel = /라벨/.test(loc);
  if (isLabel) {
    if (oldC && newC && !/^(지금|새|—)/.test(newC) && !/^유지|조치|판단|처리/.test(newC)) pairs.push({ loc, section: sectionName, oldS: [oldC], newS: [newC], label: true });
    continue;
  }
  const o = sentences(oldC);
  const n = sentences(newC);
  if (n.length && o.length) pairs.push({ loc, section: sectionName, oldS: o, newS: n, label: false });
}
// 8음절 어절 표·관찰 1·2 표의 행(표 모양이 달라 위 파서가 못 읽는 것) — 새 문장 전체를 직접 적는다
const poolHas = (s) => poolText.includes(s);
const EXTRA = [
  ['senior-gathering/grandchildren 결과(8음절)', ['아이들의 웃음소리로 집이 다시 북적였습니다.', '몸은 힘들었지만 마음은 따뜻했습니다.'], ['시끄러워졌습니다']],
  ['senior-diet/eat 결과(8음절)', ['그날그날은 즐거웠고 병원에 가는 날은 가시방석 같았습니다.'], ['가시방석이었습니다']],
  ['infant-hovering 본문(8음절)', ['아이가 넘어질세라 어른들은 늘 한 걸음 앞에 있었습니다.', '아이는 안전했고, 조금 몸을 사리는 편이었습니다.'], ['조심스러웠습니다']],
  ['infant-parental-leave 본문(8음절)', ['아이가 태어난 첫해, 누가 일을 쉬고 아이를 돌볼지가 집안의 문제였습니다.', '일터와 살림살이가 함께 걸려 있었습니다.'], ['갈림길이었습니다']],
  ['youth-marriage/wait 결과(관찰 2)', ['서두르지 않기로 했습니다.', '몸과 마음의 짐은 덜었지만 상대의 얼굴에 아쉬운 기색이 스쳤습니다.'], []],
  ['middle-marriage-crisis/apart 결과(R-379)', ['재산을 나누느라 목돈이 나갔지만 따로 꾸리는 살림은 가벼워졌고, 오랜 긴장도 풀렸습니다.'], []],
  ['youth-startup/start 결과(R-380)', ['작은 사무실을 얻어 일을 시작했습니다.', '잠을 줄이며 한 해를 보내는 사이 배운 것이 쌓였고 윤곽이 잡혀 갔습니다.'], []],
  ['youth-housing/return 결과(새 선택지)', ['짐을 싸 부모님 집으로 돌아갔습니다.', '한 식탁에 앉는 저녁이 다시 늘었고 살림도 가벼워졌습니다.', '독립은 한 걸음 물러섰습니다.'], []],
  ['middle-home-loan/shrink 결과(건강 +1 문장)', ['큰 집을 정리하고 작은 집으로 옮겼습니다.', '쓸고 닦을 곳이 줄어 몸은 편해졌지만 정든 집을 떠나는 마음은 한동안 무거웠습니다.'], []],
];
for (const [loc, news, olds] of EXTRA) pairs.push({ loc, section: 'extra', oldS: olds, newS: news, label: false });
// 표의 머리글 행(L02 라벨 끊김 | 라벨 2개 | 문구)은 문장이 아니라 제외하고, 개발자가 360×740 배치 때문에 줄인 라벨(dev-M7e-4 기록)은 줄인 값으로 대조한다
for (let i = pairs.length - 1; i >= 0; i--) if (pairs[i].loc.startsWith('L02 라벨 끊김') || pairs[i].loc.startsWith('C20 라벨 확정')) pairs.splice(i, 1);
// 3회차: planner 10-9절이 라벨을 「일가친척과 의논해 치른다」로 확정(2회차에 줄였던 「가족·친척과 …」는 옛 값으로 대조)
for (const p of pairs) if (p.loc.startsWith('middle-parents-farewell/share 라벨')) { p.newS = ['일가친척과 의논해 치른다']; p.oldS = [...p.oldS, '가족·친척과 의논해 치른다']; }
const rows = [];
let staticNew = 0, staticNewMiss = 0, oldLeft = 0, newOnScreen = 0, newNever = 0, oldOnScreen = 0;
const misses = [];
const read = [];
for (const p of pairs) {
  const missNew = p.newS.filter((s) => !poolText.includes(s));
  const changedOld = p.oldS.filter((s) => !p.newS.includes(s));
  const left = changedOld.filter((s) => poolText.includes(s));
  const onScreenNew = p.newS.map((s) => count(s));
  const onScreenOld = changedOld.reduce((n, s) => n + count(s), 0);
  staticNew += p.newS.length;
  staticNewMiss += missNew.length;
  oldLeft += left.length;
  oldOnScreen += onScreenOld;
  newOnScreen += onScreenNew.filter((c) => c > 0).length;
  newNever += onScreenNew.filter((c) => c === 0).length;
  if (missNew.length || left.length) misses.push({ loc: p.loc, missNew, oldLeft: left });
  rows.push({ loc: p.loc, section: p.section, new: p.newS.join(' '), seen: onScreenNew.reduce((a, b) => a + b, 0), oldSeen: onScreenOld, staticOk: !missNew.length && !left.length });
  read.push(`${p.loc} — ${p.newS.join(' ')}`);
}
const out = { pairs: pairs.length, staticNew, staticNewMiss, oldLeft, newOnScreenSentences: newOnScreen, newNeverOnScreen: newNever, oldOnScreen, lives: lives.length, misses, rows };
fs.writeFileSync(path.join(OUT, 'changed-sentences.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ ...out, rows: undefined, misses: misses.slice(0, 12) }, null, 1));
