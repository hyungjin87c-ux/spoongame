// QA-003 M7b A14: 8배속 자동 모드에서 번쩍임 — CDP 화면 녹화(screencast)로 프레임별 평균 밝기를 재서 「큰 면적의 밝기 급변이 1초에 3번 이상」이 없는지, 시트(.overlay)가 한 번도 뜨지 않는지.
// 사용: node qa/scripts/m7b-flash.mjs   결과: 케이스 A14 + qa/results/m7b/flash.json
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, mkctx, PROD, DEV, shot, runCase, readCard, GAME_KEY, SETTINGS_KEY, settingsEnvelope, findCardState, evalCore } from './m7b-lib.mjs';

const browser = await launch();
const helper = await browser.newPage();
await helper.goto('about:blank');
const oracle = await (await mkctx(browser)).newPage();
await oracle.goto(DEV, { waitUntil: 'load' });
await oracle.waitForSelector('[data-testid="title-screen"]');
const base = await findCardState(oracle, 'school-tutoring', 'present', {});

const LUMA = async (frames) => {
  const out = [];
  for (const f of frames) {
    const blob = await (await fetch('data:image/jpeg;base64,' + f.data)).blob();
    const bmp = await createImageBitmap(blob);
    const cv = document.createElement('canvas');
    cv.width = 36;
    cv.height = 72;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(bmp, 0, 0, 36, 72);
    const d = g.getImageData(0, 0, 36, 72).data;
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = new Float32Array(36 * 72);
    let sum = 0;
    for (let i = 0; i < L.length; i++) {
      L[i] = 0.2126 * lin(d[i * 4]) + 0.7152 * lin(d[i * 4 + 1]) + 0.0722 * lin(d[i * 4 + 2]);
      sum += L[i];
    }
    out.push({ t: f.t, mean: sum / L.length, L: Array.from(L) });
  }
  return out;
};

async function record(label, opts, viewport, seconds, control = false) {
  const ctx = await mkctx(browser, { viewport, ...opts, deviceScaleFactor: 1 });
  await ctx.addInitScript(([k, v, sk, sv]) => { try { if (!sessionStorage.getItem('__qa_seeded')) { localStorage.clear(); localStorage.setItem(k, v); localStorage.setItem(sk, sv); sessionStorage.setItem('__qa_seeded', '1'); } } catch {} }, [GAME_KEY, JSON.stringify({ version: 8, data: base }), SETTINGS_KEY, settingsEnvelope({ speed: 8, autoMode: true, theme: 'system' })]);
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__mut = { overlay: 0, inlineMount: 0, foldMount: 0, sheet: 0 };
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches?.('.overlay, [data-testid="decision-overlay"]') || n.querySelector?.('.overlay, [data-testid="decision-overlay"]')) window.__mut.overlay++;
        if (n.matches?.('[data-testid="choice-panel"]') || n.querySelector?.('[data-testid="choice-panel"]')) window.__mut.inlineMount++;
        if (n.matches?.('[data-testid="decision-fold"]') || n.querySelector?.('[data-testid="decision-fold"]')) window.__mut.foldMount++;
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="life-screen"]');
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  const t0 = Date.now();
  cdp.on('Page.screencastFrame', (e) => {
    frames.push({ data: e.data, t: e.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 40, maxWidth: viewport.width, maxHeight: viewport.height, everyNthFrame: 1 });
  if (control) await page.evaluate(() => { window.setInterval(() => document.querySelector('[data-testid="tool-dark"]')?.click(), 160); });
  await sleep(seconds * 1000);
  await cdp.send('Page.stopScreencast');
  const mut = await page.evaluate(() => window.__mut);
  const ageEnd = await page.evaluate(() => document.querySelector('[data-testid="life-age"]')?.textContent);
  const modes = new Set();
  const shotP = await shot(page, 'A14', label);
  const luma = await helper.evaluate(LUMA, frames);
  // 번쩍임 지표
  const AREA = 0.25;
  const changes = [];
  for (let i = 1; i < luma.length; i++) {
    const a = luma[i - 1];
    const b = luma[i];
    let big = 0;
    for (let k = 0; k < a.L.length; k++) if (Math.abs(a.L[k] - b.L[k]) >= 0.1) big++;
    changes.push({ t: b.t, dMean: b.mean - a.mean, area: big / a.L.length });
  }
  const maxArea = changes.reduce((m, c) => Math.max(m, c.area), 0);
  const maxDMean = changes.reduce((m, c) => Math.max(m, Math.abs(c.dMean)), 0);
  // 큰 면적(≥25%)이 10% 이상 밝기 차이로 바뀐 프레임 쌍
  const flashEv = changes.filter((c) => c.area >= AREA && Math.abs(c.dMean) >= 0.1);
  // 1초 창 안의 반대 방향 변화 쌍 수
  let maxPairs = 0;
  for (let i = 0; i < flashEv.length; i++) {
    const win = flashEv.filter((c) => c.t >= flashEv[i].t && c.t < flashEv[i].t + 1);
    let pairs = 0;
    for (let j = 1; j < win.length; j++) if (Math.sign(win[j].dMean) !== Math.sign(win[j - 1].dMean)) pairs++;
    maxPairs = Math.max(maxPairs, pairs);
  }
  const means = luma.map((f) => f.mean);
  const rec = { label, frames: frames.length, seconds, mut, ageEnd, maxArea: Math.round(maxArea * 1000) / 1000, maxDMean: Math.round(maxDMean * 1000) / 1000, flashPairs: flashEv.length, maxOpposingPerSec: maxPairs, meanRange: [Math.min(...means), Math.max(...means)].map((x) => Math.round(x * 1000) / 1000), shot: shotP };
  await ctx.close();
  return rec;
}

await runCase({ id: 'A14', cat: '공격', title: '8배속 자동 모드에서 번쩍임 0 — 시트가 뜨지 않고(인라인만), 화면 평균 밝기가 큰 면적으로 1초에 3번 이상 반대로 바뀌지 않는다(라이트·다크·데스크톱)', steps: '자동 모드·8배속 저장으로 40초 동안 화면 녹화(CDP screencast)와 DOM 감시(MutationObserver: .overlay 추가·카드 마운트 수)', expected: '.overlay 추가 0, 25% 이상 면적이 밝기 10% 이상 급변하는 프레임 쌍이 1초에 반대 방향으로 3번 이상 없음' }, async () => {
  const bad = [];
  const recs = [];
  for (const [label, opts, vp] of [['light-360', {}, { width: 360, height: 740 }], ['dark-360', { colorScheme: 'dark' }, { width: 360, height: 740 }], ['light-1280', {}, { width: 1280, height: 800 }]]) {
    const r = await record(label, opts, vp, 40);
    recs.push(r);
    if (r.mut.overlay > 0) bad.push(`${label}: .overlay ${r.mut.overlay}번 추가됨`);
    if (r.maxOpposingPerSec >= 3) bad.push(`${label}: 1초에 반대 방향 급변 ${r.maxOpposingPerSec}쌍`);
    if (r.frames < 10) bad.push(`${label}: 녹화 프레임 ${r.frames}개(너무 적음)`);
  }
  // 양성 대조: 다크 모드 버튼을 160ms마다 눌러 일부러 번쩍이게 만든 화면에서 같은 지표가 잡히는가
  const ctl = await record('control-toggle-dark', {}, { width: 360, height: 740 }, 4, true);
  recs.push(ctl);
  if (ctl.maxOpposingPerSec < 3) bad.push(`양성 대조 실패: 일부러 번쩍인 화면에서 반대 급변 ${ctl.maxOpposingPerSec}/초만 잡힘(측정 방법 불신)`);
  fs.writeFileSync(path.join(OUT, 'flash.json'), JSON.stringify(recs, null, 1));
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : recs.map((r) => `${r.label}: 프레임 ${r.frames}·카드 마운트 ${r.mut.inlineMount}회·.overlay ${r.mut.overlay}·최대 면적변화 ${Math.round(r.maxArea * 100)}%·최대 평균밝기 변화 ${r.maxDMean}·반대 급변 ${r.maxOpposingPerSec}/초·평균밝기 범위 ${r.meanRange.join('~')}·40초 뒤 ${r.ageEnd}`).join(' | '), shots: recs.map((r) => r.shot) };
});
await browser.close();
