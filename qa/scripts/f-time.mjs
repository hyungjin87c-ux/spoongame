// 시간 측정 정리: 실측(F-N01~N03, F-P01~P03 보고서)과 대량 플레이 글자 수 통계로 사람 기준 예상 시간을 계산한다 (판정하지 않음)
import fs from 'node:fs';
import path from 'node:path';
import { FIN } from './f-lib.mjs';
const read = (f) => JSON.parse(fs.readFileSync(path.join(FIN, f), 'utf8'));
const r1 = (x) => Math.round(x * 10) / 10;
const out = { measured: {}, estimate: {} };

for (const id of ['F-N01', 'F-N02', 'F-N03', 'F-P01', 'F-P02', 'F-P03']) {
  const f = path.join(FIN, `${id}-report.json`);
  if (!fs.existsSync(f)) continue;
  const r = read(`${id}-report.json`);
  let dwell = 0;
  for (const c of r.choices) if (c.pickedAt) dwell += c.pickedAt - c.shownAt;
  const steps = [];
  for (let i = 1; i < r.timeline.length; i++) steps.push((r.timeline[i][1] - r.timeline[i - 1][1]) / 1000);
  const bucket = (lo, hi) => steps.filter((x) => x >= lo && x < hi).length;
  out.measured[id] = {
    era: r.era,
    viewport: r.mobile ? '360x740 모바일' : '1280x800 데스크톱',
    base: r.base === undefined ? 'dev' : r.base,
    mode: `${r.speed}배 ${r.mode}`,
    choices: r.choices.length,
    deathAge: r.save ? r.save.age : null,
    totalSec: Math.round(r.totalMs / 1000),
    harnessDwellAtChoicesSec: r1(dwell / 1000),
    pureSec: Math.round((r.totalMs - dwell) / 1000),
    pureMin: r1((r.totalMs - dwell) / 60000),
    stepBuckets: r.speed === 1 && r.mode === 'manual' ? { quiet7s: bucket(6.5, 8.5), resolved13s: bucket(12, 14), narrative17s: bucket(16.5, 19) } : undefined,
    autoPanelVisibleMs: r.mode === 'auto' ? (() => { const a = r.choices.map((c) => c.autoShownMs).filter(Boolean); return a.length ? { mean: Math.round(a.reduce((x, y) => x + y, 0) / a.length), min: Math.min(...a), max: Math.max(...a) } : null; })() : undefined,
    gapsMs: r.gaps,
  };
}

// 사람 기준 예상: 한 판 평균(수동 300판) 글자 수
const m = read('mass-analysis.json');
const n = m.perPlay.choices.mean; // 판당 선택지 수
const panelPer = m.chars.panel_title_body_labels.mean; // 선택지 1개의 제목+본문+선택지 문구
const resPer = m.chars.result.mean;
const n01 = out.measured['F-N01'];
const pure1x = n01 ? n01.pureSec : null;
const rows = [];
for (const cpm of [500, 600, 700]) {
  for (const pick of [5, 10, 15]) {
    const read = (panelPer / cpm) * 60;
    const readRes = (resPer / cpm) * 60;
    const perChoice = read + pick;
    rows.push({
      cpm,
      pickSec: pick,
      panelReadSec: r1(read),
      resultReadSec: r1(readRes),
      perChoiceSec: r1(perChoice),
      // 1배속 수동: 결과·서술 문구는 해 단위 대기(13초·17초) 안에서 읽히므로 더하지 않는다
      manual1x_min: pure1x ? r1((pure1x + n * perChoice) / 60) : null,
      // 8배속 + 다음 결정으로: 선택 뒤 곧바로 누르는 경우 / 결과 문구를 읽고 누르는 경우(눌러 넘기는 시간 1초 포함)
      fastSkip_noReadResult_min: r1((n * (perChoice + 1)) / 60),
      fastSkip_readResult_min: r1((n * (perChoice + readRes + 1)) / 60),
    });
  }
}
out.estimate = { choicesPerPlayMean: n, panelCharsPerChoice: panelPer, resultCharsPerChoice: resPer, pure1xSec: pure1x, rows };
fs.writeFileSync(path.join(FIN, 'time-summary.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.measured, null, 1));
console.log(JSON.stringify({ n, panelPer, resPer, pure1x }));
for (const r of rows) console.log(`cpm ${r.cpm} 고르기 ${r.pickSec}s → 선택지당 ${r.perChoiceSec}s | 1배 수동 ${r.manual1x_min}분 | 8배+다음결정(결과 안 읽음) ${r.fastSkip_noReadResult_min}분 / (결과 읽음) ${r.fastSkip_readResult_min}분`);
