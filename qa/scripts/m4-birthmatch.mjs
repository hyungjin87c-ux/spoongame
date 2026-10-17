// QA-003 M4: 출생신고 ⇔ 대시보드 0세 정합을 여러 시드(세상 3 × 판)에서: 형제 순서 「N째입니다」 ⇔ 식구 카드 위 형제 수, 부모 나이, 출신 가정, 또래 4명, 서술문 ⇔ 인생 기록 첫 줄.
// 사용: node qa/scripts/m4-birthmatch.mjs [판 수/세상] [시작 시드]
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, readBirth, OUT, CASES, con, VP, TOUCH, sleep } from './m4-lib.mjs';

const per = Number(process.argv[2] || 20);
const seed0 = Number(process.argv[3] || 5000);
const tasks = [];
for (let i = 0; i < per; i++) for (const era of ['past', 'present', 'future']) tasks.push({ era, seed: seed0 + i * 13 + (era === 'past' ? 1 : era === 'present' ? 2 : 3) });
const browser = await launch();
const rows = [];
let idx = 0;
const ORD = { 첫째: 0, 둘째: 1, 셋째: 2, 넷째: 3, '다섯째 이상': 4 };
async function worker() {
  while (idx < tasks.length) {
    const t = tasks[idx++];
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    await cleanStorageOnce(ctx);
    await fixSeed(ctx, t.seed);
    const p = await ctx.newPage();
    try {
      await openTitle(p);
      await toRoulette(p, t.era);
      await skipToBirth(p);
      const b = await readBirth(p);
      await birthToLife(p);
      await sleep(200);
      const d = await p.evaluate(() => {
        const tx = (s) => (document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null);
        return {
          first: tx('[data-testid="log-row"] .log__text'),
          mother: tx('[data-testid="family-mother"]'),
          father: tx('[data-testid="family-father"]'),
          sibs: [...document.querySelectorAll('[data-testid="family-sibling"]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
          home: tx('[data-testid="profile-home"]'),
          place: tx('[data-testid="profile-place"]'),
          born: tx('[data-testid="profile-born"]'),
          name: tx('[data-testid="life-name"]'),
          looks: tx('[data-testid="profile-looks"]'),
          gender: tx('[data-testid="profile-gender"]'),
          peers: [...document.querySelectorAll('[data-testid="peer-now"]')].map((li) => ({ name: li.querySelector('[data-testid="peer-now-name"]')?.textContent.trim(), grade: (/(흙|동|은|금|다이아몬드)수저/.exec(li.textContent) || [])[0], place: li.querySelector('.sub:last-of-type')?.textContent.trim() })),
        };
      });
      rows.push({ ...t, b: { name: b.name, sentence: b.sentence, fields: b.fields, peers: b.peers }, d });
    } catch (e) {
      rows.push({ ...t, err: String(e.message).slice(0, 150) });
    }
    await ctx.close();
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
fs.writeFileSync(path.join(OUT, 'samples-birthmatch.json'), JSON.stringify(rows));
const bad = [];
let ok = 0;
const orderDist = {};
for (const r of rows) {
  if (r.err) {
    bad.push(`${r.era}-${r.seed}: ${r.err}`);
    continue;
  }
  ok++;
  const m = /(첫째|둘째|셋째|넷째|다섯째 이상)입니다/.exec(r.b.sentence ?? '');
  if (!m) {
    bad.push(`${r.era}-${r.seed}: 서술문에서 순서를 못 읽음`);
    continue;
  }
  orderDist[m[1]] = (orderDist[m[1]] ?? 0) + 1;
  const older = ORD[m[1]];
  const sibs = r.d.sibs.filter((s) => !/없음/.test(s)).length;
  const want = Math.min(older, 4);
  if (sibs !== want) bad.push(`${r.era}-${r.seed}: ${m[1]} ⇔ 식구 위 형제 ${sibs}명(${want} 기대) ${JSON.stringify(r.d.sibs)}`);
  if (!r.d.first || !r.d.first.includes(r.b.sentence)) bad.push(`${r.era}-${r.seed}: 기록 첫 줄 ≠ 서술문`);
  const bm = /(\d+)세/.exec(r.b.fields.mother?.value ?? '')?.[1];
  const bf = /(\d+)세/.exec(r.b.fields.father?.value ?? '')?.[1];
  const dm = /(\d+)세/.exec(r.d.mother ?? '')?.[1];
  const df = /(\d+)세/.exec(r.d.father ?? '')?.[1];
  if (bm !== dm || bf !== df) bad.push(`${r.era}-${r.seed}: 부모 나이 ${bm}/${bf} vs ${dm}/${df}`);
  // 어머니 나이 ⇔ 형제 순서(어머니 출산 최소 나이): 위 형제 나이 차 합 ≤ 어머니 나이 − 16
  const gaps = r.d.sibs.map((s) => Number(/(\d+)세 위/.exec(s)?.[1])).filter(Boolean);
  const maxGap = gaps.length ? Math.max(...gaps) : 0;
  if (maxGap && Number(dm) - maxGap < 16) bad.push(`${r.era}-${r.seed}: 어머니 ${dm}세인데 맏이와 ${maxGap}세 차 → 첫 출산 ${Number(dm) - maxGap}세 < 16`);
  const grade = /(흙|동|은|금|다이아몬드)수저/.exec(r.b.fields.wealth?.value ?? '')?.[0];
  const gradeD = /(흙|동|은|금|다이아몬드)수저/.exec(r.d.home ?? '')?.[0];
  if (grade !== gradeD) bad.push(`${r.era}-${r.seed}: 수저 ${grade} vs ${gradeD}`);
  const bn = r.b.peers.map((p) => p.name).join(',');
  const dn = r.d.peers.map((p) => p.name).join(',');
  if (bn !== dn) bad.push(`${r.era}-${r.seed}: 또래 이름 ${bn} vs ${dn}`);
  const bg = r.b.peers.map((p) => (/(흙|동|은|금|다이아몬드)수저/.exec(p.chip) || [])[0]).join(',');
  const dg = r.d.peers.map((p) => p.grade).join(',');
  if (bg !== dg) bad.push(`${r.era}-${r.seed}: 또래 수저 ${bg} vs ${dg}`);
  if (r.b.name !== r.d.name) bad.push(`${r.era}-${r.seed}: 이름 ${r.b.name} vs ${r.d.name}`);
}
const rec = {
  id: 'M4-N01m',
  cat: '정상',
  title: `출생신고 ⇔ 대시보드 0세 정합 ${ok}판(세 세상 × ${per}판): 「N째입니다」 ⇔ 식구 위 형제 수·어머니 첫 출산 나이 ≥ 16, 부모 나이, 수저, 또래 4명 이름·수저, 서술문 ⇔ 인생 기록 첫 줄`,
  steps: '시드를 바꿔 새 판을 열고 출생신고와 대시보드 0세 값을 대조',
  expected: '모든 판에서 불일치 0',
  verdict: bad.length ? 'FAIL' : 'PASS',
  severity: '높음',
  actual: (bad.length ? bad.slice(0, 8).join(' / ') + ` (총 ${bad.length}) | ` : '') + `${ok}판 대조 · 형제 순서 분포 ${JSON.stringify(orderDist)}`,
  shots: [],
  console: con.take(),
  externalRequests: [],
  at: new Date().toISOString(),
};
fs.appendFileSync(CASES, JSON.stringify(rec) + '\n');
console.log(`[${rec.verdict}] ${rec.id} :: ${rec.actual.slice(0, 1500)}`);
await browser.close();
