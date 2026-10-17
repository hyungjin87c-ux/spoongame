// QA-003 M5 D-38: 선택지 번호 원 안의 숫자가 원 테두리에 닿지 않는가. 11 뷰포트 × 글자 100·150·200% × 성인·20세 미만 선택지 카드.
// 방법: 번호 원을 화면 그대로 찍어(배율 2) 원 안쪽(테두리 두께 안쪽)에서 글자색에 가까운 픽셀의 가장 먼 거리(원 중심에서)와 세로 중심 어긋남을 잰다. 독립 측정(개발 e2e의 캔버스 글꼴 지표와 다른 방식).
// 사용: node qa/scripts/m5-audit-num.mjs   (MUT_CSS=... 로 일부러 망가뜨려 측정기가 일하는지 대조)
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, CASES } from './m5-lib.mjs';
import { openState, VPS } from './m5-states.mjs';

const MUT = process.env.MUT_CSS || '';
const outFile = path.join(OUT, MUT ? 'audit-num-mut.jsonl' : 'audit-num.jsonl');
fs.writeFileSync(outFile, '');
const browser = await launch();
const helper = await browser.newPage();
await helper.goto('about:blank');

const CIRCLES = () => {
  const out = [];
  document.querySelectorAll('[data-testid="choice-panel"] .choice__no').forEach((e, i) => {
    e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    out.push({ i, x: r.left, y: r.top, w: r.width, h: r.height, border: parseFloat(cs.borderTopWidth) || 0, color: cs.color, fs: parseFloat(cs.fontSize), lh: cs.lineHeight, text: e.textContent.trim(), sh: e.scrollHeight, ch: e.clientHeight, sw: e.scrollWidth, cw: e.clientWidth });
  });
  return out;
};
const INK = async ({ b64, dpr, c }) => {
  const blob = await (await fetch('data:image/png;base64,' + b64)).blob();
  const bmp = await createImageBitmap(blob);
  const cv = document.createElement('canvas');
  cv.width = bmp.width;
  cv.height = bmp.height;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  const x0 = Math.floor(c.x * dpr);
  const y0 = Math.floor(c.y * dpr);
  const w = Math.ceil(c.w * dpr);
  const h = Math.ceil(c.h * dpr);
  const d = g.getImageData(x0, y0, w, h).data;
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c.color);
  const ink = [Number(m[1]), Number(m[2]), Number(m[3])];
  const cx = c.w / 2;
  const cy = c.h / 2;
  const rOut = Math.min(c.w, c.h) / 2;
  const rIn = rOut - c.border - 0.6; // 테두리 안쪽 가장자리(안티앨리어싱 여유 0.6px)
  // 원 안쪽의 배경색 = 안쪽 가장자리 근처의 최빈색(글자가 없는 곳)
  let n = 0;
  let maxR = 0;
  let minX = 1e9;
  let maxX = -1e9;
  let minY = 1e9;
  let maxY = -1e9;
  // 바탕색: 원 중심에서 rIn × 0.9 거리의 고리 위 픽셀 최빈색
  const ringHist = new Map();
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++) {
      const dx = (px + 0.5) / dpr - cx;
      const dy = (py + 0.5) / dpr - cy;
      const r = Math.hypot(dx, dy);
      if (r > rIn * 0.86 && r < rIn * 0.96) {
        const i = (py * w + px) * 4;
        const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
        ringHist.set(k, (ringHist.get(k) || 0) + 1);
      }
    }
  let bgK = 0;
  let bgN = -1;
  for (const [k, cnt] of ringHist) if (cnt > bgN) ((bgN = cnt), (bgK = k));
  const bg = [(bgK >> 16) & 255, (bgK >> 8) & 255, bgK & 255];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const full = dist(ink, bg);
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++) {
      const dx = (px + 0.5) / dpr - cx;
      const dy = (py + 0.5) / dpr - cy;
      const r = Math.hypot(dx, dy);
      if (r > rIn) continue; // 테두리 고리는 건너뛴다
      const i = (py * w + px) * 4;
      const col = [d[i], d[i + 1], d[i + 2]];
      // 글자색 쪽으로 절반 이상 간 픽셀 = 글자 획
      if (dist(col, bg) > full * 0.5) {
        n++;
        maxR = Math.max(maxR, r);
        minX = Math.min(minX, dx);
        maxX = Math.max(maxX, dx);
        minY = Math.min(minY, dy);
        maxY = Math.max(maxY, dy);
      }
    }
  // 테두리 고리 안쪽 가장자리 바로 안(rIn 근처)에 글자 픽셀이 있는가 = 숫자가 테두리에 닿음
  return { n, maxR: Math.round(maxR * 100) / 100, rIn: Math.round(rIn * 100) / 100, gap: Math.round((rIn - maxR) * 100) / 100, cxOff: n ? Math.round(((minX + maxX) / 2) * 100) / 100 : null, cyOff: n ? Math.round(((minY + maxY) / 2) * 100) / 100 : null, bg, fullDist: Math.round(full) };
};

const jobs = [];
for (const st of ['adult-choice', 'young-choice']) for (const vp of VPS) for (const font of [100, 150, 200]) jobs.push({ st, vp, font });
let idx = 0;
async function worker() {
  while (idx < jobs.length) {
    const j = jobs[idx++];
    const rec = { state: j.st, vp: j.vp.name, font: j.font, circles: [] };
    try {
      const { ctx, page } = await openState(browser, j.st, { vp: { ...j.vp, touch: false }, font: j.font, ctxOpts: { deviceScaleFactor: 2 } });
      if (MUT) {
        await page.addStyleTag({ content: MUT });
        await sleep(200);
      }
      const cs = await page.evaluate(CIRCLES);
      for (const c of cs) {
        // 화면 안으로 스크롤된 뒤의 위치로 다시 읽는다
        const live = await page.evaluate((i) => {
          const e = document.querySelectorAll('[data-testid="choice-panel"] .choice__no')[i];
          e.scrollIntoView({ block: 'center' });
          const r = e.getBoundingClientRect();
          return { x: r.left, y: r.top, w: r.width, h: r.height };
        }, c.i);
        await sleep(80);
        const png = await page.screenshot({ type: 'png', clip: { x: Math.max(0, live.x - 1), y: Math.max(0, live.y - 1), width: live.w + 2, height: live.h + 2 } });
        // clip을 1px 여유로 찍었으니 원의 좌표는 (1,1)에서 시작
        const r = await helper.evaluate(INK, { b64: png.toString('base64'), dpr: 2, c: { ...c, x: 1, y: 1 } });
        const circleRound = Math.abs(live.w - live.h) < 0.6;
        rec.circles.push({ i: c.i, size: Math.round(live.w * 10) / 10, round: circleRound, fs: c.fs, lh: c.lh, text: c.text, ...r, overflowBox: c.sh > c.ch || c.sw > c.cw });
      }
      await ctx.close();
    } catch (e) {
      rec.err = String(e.message).slice(0, 160);
    }
    fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
  }
}
await Promise.all(Array.from({ length: 3 }, worker));
await browser.close();

const L = fs.readFileSync(outFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const circles = L.flatMap((r) => (r.circles || []).map((c) => ({ ...c, state: r.state, vp: r.vp, font: r.font })));
const bad = circles.filter((c) => c.n === 0 || c.gap < 1.2 || !c.round || c.overflowBox || Math.abs(c.cyOff) > 3.5 || Math.abs(c.cxOff) > 3);
const minGap = circles.reduce((m, c) => (c.n ? Math.min(m, c.gap) : m), 99);
console.log(`조합 ${L.length}, 원 ${circles.length}개, 숫자와 테두리 사이 최소 ${minGap}px, 위반 ${bad.length}`);
for (const b of bad.slice(0, 8)) console.log(JSON.stringify(b));
if (!MUT) {
  const rec = {
    id: 'M5-L06',
    cat: '접근성',
    title: `선택지 번호 원 안의 숫자(D-38): 11 뷰포트 × 글자 100·150·200% × 성인·20세 미만 선택지 카드 — ${circles.length}개 원`,
    steps: '번호 원을 화면 그대로 찍어(배율 2) 원 안쪽에서 글자 획 픽셀의 중심 거리·세로·가로 중심 어긋남·원 스크롤 상자 넘침을 잼',
    expected: '숫자와 원 테두리 사이 ≥ 1.2px, 중심 어긋남 ≤ 3.5px, 원은 정원, 숫자 줄 상자가 원을 넘지 않음',
    verdict: bad.length || L.some((r) => r.err) ? 'FAIL' : 'PASS',
    actual: bad.length ? bad.slice(0, 5).map((b) => `${b.state}/${b.vp}/${b.font}% #${b.i} 간격 ${b.gap} cy ${b.cyOff} 정원 ${b.round}`).join(' / ') + ` (위반 ${bad.length}개)` : `원 ${circles.length}개 모두 통과, 숫자와 테두리 사이 최소 ${minGap}px, 글자 100% 원 지름 ${circles.find((c) => c.font === 100)?.size}px·200% ${circles.find((c) => c.font === 200)?.size}px${L.some((r) => r.err) ? ', 측정 오류 ' + L.filter((r) => r.err).length : ''}`,
    shots: [],
    console: [],
    externalRequests: [],
    at: new Date().toISOString(),
  };
  fs.appendFileSync(CASES, JSON.stringify(rec) + '\n');
  console.log(`[${rec.verdict}] ${rec.id} :: ${rec.actual}`);
}
