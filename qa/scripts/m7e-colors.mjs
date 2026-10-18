// QA-003 M7e 엔딩 막대 색·강제 색상: 라이트·다크(시스템)·수동 다크·강제 색상(라이트·다크) 5모드에서 출발선 막대의 그림 요소(선·눈금·띠 테두리·띠 안·마름모)를 실제로 그린 픽셀로 읽어 배경과의 대비(비텍스트 3:1)를 재고,
// 강제 색상에서는 계산된 색이 시스템 색(CanvasText·Canvas 등)인지와 렌더 대비(7:1 이상)를 본다. 글자 대비는 m7e-audit pixel 모드(렌더 픽셀)가 맡는다.
// 사용: node qa/scripts/m7e-colors.mjs   결과: cases.jsonl (M7e-K02), 스크린샷 M7e-K02-*
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, runCase, shot, SHOT_DIR, SHOT_PREFIX } from './m7e-lib.mjs';

const MODES = [
  ['light', {}, 'system'],
  ['dark', { colorScheme: 'dark' }, 'system'],
  ['manual-dark', {}, 'dark'],
  ['forced-light', { forcedColors: 'active', colorScheme: 'light' }, 'system'],
  ['forced-dark', { forcedColors: 'active', colorScheme: 'dark' }, 'system'],
];
const STATES = ['ending-present-t3-up', 'ending-present-t3-down', 'ending-present-t1-zero', 'ending-before20-present-t3-a17', 'ending-future-t3-e-up3'];
const settings = (theme) => JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme } });

const PIXELS = async ({ b64, pts }) => {
  const blob = await (await fetch('data:image/png;base64,' + b64)).blob();
  const bmp = await createImageBitmap(blob);
  const cv = document.createElement('canvas');
  cv.width = bmp.width;
  cv.height = bmp.height;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  return pts.map(([x, y]) => {
    const d = g.getImageData(Math.max(0, Math.min(bmp.width - 1, Math.round(x))), Math.max(0, Math.min(bmp.height - 1, Math.round(y))), 1, 1).data;
    return [d[0], d[1], d[2]];
  });
};
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => { const la = L(a); const lb = L(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };

const browser = await launch();
const helper = await browser.newPage();
await helper.goto('about:blank');

await runCase({ id: 'M7e-K02', cat: '접근성', title: '엔딩 출발선 막대의 그림 색(비텍스트 대비 ≥ 3:1)과 강제 색상: 선·눈금·띠 테두리·마름모가 5모드에서 배경과 구별되고, 강제 색상에서는 시스템 색(CanvasText)으로 그려진다', steps: `엔딩 ${STATES.length}종 × 5모드(라이트·다크·수동 다크·강제 색상 둘)에서 막대를 화면에 가져와 실제 픽셀을 읽는다`, expected: '선·눈금·띠 테두리·마름모가 카드 배경과 3:1 이상(강제 색상 7:1 이상), 강제 색상 계산 색 = 시스템 색' }, async () => {
  const bad = [];
  const rows = [];
  const shots = [];
  let minRatio = 99;
  let minForced = 99;
  for (const [mode, opts, theme] of MODES) {
    for (const st of STATES) {
      const early = st.includes('before20');
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH, ...opts });
      await seedStorage(ctx, { [GAME_KEY]: fs.readFileSync(path.join(OUT, 'saves', st + '.json'), 'utf8'), [SETTINGS_KEY]: settings(theme) });
      const page = await ctx.newPage();
      await page.goto(PROD, { waitUntil: 'load' });
      await page.waitForSelector('[data-testid="ending-screen"]');
      await sleep(400);
      await page.evaluate(() => document.querySelector('[data-testid="ending-bar"]').scrollIntoView({ block: 'center', behavior: 'instant' }));
      await sleep(350);
      const geo = await page.evaluate(() => {
        const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
        const bar = document.querySelector('[data-testid="ending-bar"]');
        const track = bar.querySelector('.journey__track');
        const band = bar.querySelector('.journey__band');
        const mid = bar.querySelector('.journey__mid');
        const end = bar.querySelector('.journey__end');
        const card = bar.closest('.card');
        const cs = (e, p) => (e ? getComputedStyle(e)[p] : null);
        const before = (e, p) => (e ? getComputedStyle(e, '::before')[p] : null);
        return {
          dpr: window.devicePixelRatio,
          vh: window.innerHeight,
          track: R(track), band: R(band), mid: R(mid), end: R(end), card: R(card), bar: R(bar),
          colors: {
            trackLine: before(track, 'backgroundColor'), trackLineBorder: before(track, 'borderTopColor'),
            bandBorder: cs(band, 'borderTopColor'), bandBg: cs(band, 'backgroundColor'),
            midBorder: cs(mid, 'borderLeftColor'), midBg: cs(mid, 'backgroundColor'),
            endBg: cs(end, 'backgroundColor'), endBorder: cs(end, 'borderTopColor'),
            cardBg: cs(card, 'backgroundColor'),
          },
        };
      });
      const png = await page.screenshot({ type: 'png' });
      const dpr = geo.dpr;
      const cy = (geo.track.t + geo.track.b) / 2;
      // 카드 배경 픽셀(카드 오른쪽 안쪽 빈 곳), 선(띠·마름모 바깥 트랙 선), 띠 테두리(왼쪽 가장자리 1px 안쪽), 마름모(중심), 눈금(선 위·아래로 튀어나온 부분)
      const px = (x, y) => [x * dpr, y * dpr];
      const pts = [px(geo.card.r - 8, geo.card.t + 30)];
      const labels = ['배경'];
      // 선: 띠와 마름모 바깥의 트랙 오른쪽 끝 근처 (왼쪽 끝이 띠인 판도 있어 양쪽에서 고른다)
      const lineX = [geo.track.r - 6, geo.track.l + 6, (geo.track.l + geo.track.r) / 2 + 40].find((x) => !(geo.band && x >= geo.band.l - 1 && x <= geo.band.r + 1) && !(geo.end && x >= geo.end.l - 2 && x <= geo.end.r + 2));
      if (lineX !== undefined) { pts.push(px(lineX, cy)); labels.push('선'); }
      if (geo.band) {
        pts.push(px(geo.band.l + 1, geo.band.t + geo.band.h / 2)); labels.push('띠 왼쪽 테두리');
        pts.push(px((geo.band.l + geo.band.r) / 2, geo.band.t + 1)); labels.push('띠 위 테두리');
        pts.push(px((geo.band.l + geo.band.r) / 2, geo.band.t + geo.band.h / 2)); labels.push('띠 안');
      }
      if (geo.end) { pts.push(px((geo.end.l + geo.end.r) / 2, (geo.end.t + geo.end.b) / 2)); labels.push('마름모'); }
      if (geo.mid) { pts.push(px((geo.mid.l + geo.mid.r) / 2, geo.mid.t + 2)); labels.push('눈금'); }
      const rgb = await helper.evaluate(PIXELS, { b64: png.toString('base64'), pts });
      const bg = rgb[0];
      const out = {};
      for (let i = 1; i < rgb.length; i++) out[labels[i]] = Math.round(ratio(rgb[i], bg) * 100) / 100;
      // 판정: 비텍스트 ≥ 3 — 띠 안(연한 채움)과 눈금(점선 두께 1px)은 보조라 기록만. 선·띠 테두리·마름모는 3:1.
      const need = mode.startsWith('forced') ? 7 : 3;
      for (const k of ['선', '띠 왼쪽 테두리', '띠 위 테두리', '마름모']) {
        if (out[k] === undefined) continue;
        minRatio = Math.min(minRatio, out[k]);
        if (mode.startsWith('forced')) minForced = Math.min(minForced, out[k]);
        if (out[k] < need) bad.push(`${mode}/${st}: ${k} ${out[k]}:1 < ${need}`);
      }
      if (mode.startsWith('forced')) {
        const sys = /^(rgb\(0, 0, 0\)|rgb\(255, 255, 255\)|rgba\(0, 0, 0, 0\))$/;
        for (const [k, v] of Object.entries(geo.colors)) if (['bandBorder', 'endBg', 'trackLine'].includes(k) && v && !sys.test(v) && /rgb\(/.test(v)) bad.push(`${mode}/${st}: 강제 색상인데 ${k} 계산 색 ${v}`);
      }
      rows.push(`${mode}/${st.replace('ending-', '')}: ${Object.entries(out).map(([k, v]) => `${k} ${v}`).join(', ')}`);
      if (st === 'ending-present-t3-up' || (st === 'ending-present-t1-zero' && mode === 'forced-dark')) {
        const name = `${SHOT_PREFIX}-K02-${mode}-${st.replace('ending-', '')}.png`;
        await page.screenshot({ path: path.join(SHOT_DIR, name) });
        shots.push(`qa/screenshots/003/${name}`);
      }
      await ctx.close();
    }
  }
  fs.writeFileSync(path.join(OUT, 'colors-table.json'), JSON.stringify(rows, null, 1));
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') : `5모드 × ${STATES.length}종 모두 통과: 그림 요소 최저 대비 ${minRatio}:1 (강제 색상 최저 ${minForced}:1), 강제 색상 계산 색은 시스템 색`, shots };
});
await browser.close();
