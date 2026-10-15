// QA 보조: 엔딩 도착 자리/방향을 core 함수로 계산해 주입 표를 만든다 (읽기 전용, 앱 코드 무수정)
import { finalWealthStanding, startBandOf, movementOf, standingScore } from '../../src/core/ending';
import { bandLabel, journeyText, MOVEMENT_TEXT } from '../../src/data/endingText';
import { standingLabel } from '../../src/data/birthText';
import fs from 'node:fs';

const eras = ['past', 'present', 'future'] as const;
const out: any[] = [];
for (const era of eras) {
  for (const pw of [1, 2, 3, 4, 5] as const) {
    const band = startBandOf(era, pw);
    const seenLabels = new Map<string, number>();
    for (let w = 0; w <= 100; w++) {
      const end = finalWealthStanding(era, w);
      const lab = standingLabel(end);
      const mv = movementOf(band, end);
      if (!seenLabels.has(lab)) seenLabels.set(lab, w);
      out.push({ era, pw, wealth: w, band: bandLabel(band), low: band.low, high: band.high, end: lab, score: standingScore(end), mv, text: journeyText({ kind: 'compared', start: band, end, movement: mv }) + ' ' + MOVEMENT_TEXT[mv] });
    }
  }
}
fs.writeFileSync('qa/results/final/end-table.json', JSON.stringify(out));
// 요약: 지금 세상 4단계에서 앞섬이 되는 도착 자리
for (const era of eras) for (const pw of [1,2,3,4,5]) {
  const rows = out.filter(r => r.era===era && r.pw===pw);
  const byMv: any = {};
  for (const r of rows) (byMv[r.mv] ??= new Set()).add(r.end);
  console.log(era, pw, rows[0].band, Object.fromEntries(Object.entries(byMv).map(([k,v]:any)=>[k,[...v].slice(0,4).join(' | ') + (v.size>4?` ...(${v.size})`:'')])));
}
const p4 = out.filter(r => r.era==='present' && r.pw===4);
console.log(p4.filter(r=>/상위 약 [12]%|상위 1%/.test(r.end)).map(r=>`${r.wealth}:${r.end}:${r.mv}`).join('\n'));
