// QA-003 M2 2회차: M2-D01 반복 시험 — 다크 OS 첫 로드(JS 1.5초 지연)의 JS 전 프레임 밝기를 같은 브라우저에서 N회 잰다(드문 번쩍임 확인)
import { launch, VP, PROD, sleep } from './m2r3-lib.mjs';
const browser = await launch();
async function meanBrightness(frames) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('about:blank');
  const res = await page.evaluate(async (fr) => {
    const out = [];
    for (const f of fr) {
      const bin = atob(f.data);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const bmp = await createImageBitmap(new Blob([arr], { type: 'image/jpeg' }));
      const c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      const g = c.getContext('2d');
      g.drawImage(bmp, 0, 0, 32, 32);
      const d = g.getImageData(0, 0, 32, 32).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      out.push({ t: f.t, y: Math.round(s / (d.length / 4)) });
    }
    return out;
  }, frames);
  await ctx.close();
  return res;
}

async function captureLoad(scheme, savedGame, jsDelay) {
  const ctx = await browser.newContext({ viewport: VP.m360, colorScheme: scheme, locale: 'ko-KR', deviceScaleFactor: 1 });
  if (savedGame) await ctx.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); localStorage.setItem(k, v); } } catch {} }, [GAME_KEY, savedGame]);
  const p = await ctx.newPage();
  if (jsDelay > 0) await p.route('**/*.js', async (route) => { await sleep(jsDelay); route.continue(); });
  const cdp = await ctx.newCDPSession(p);
  const frames = [];
  const marks = {};
  const t0 = Date.now();
  cdp.on('Page.frameNavigated', (e) => { if (!e.frame.parentId && /spoongame/.test(e.frame.url)) marks.commit = Date.now() - t0; });
  cdp.on('Page.lifecycleEvent', (e) => { if (e.name === 'firstPaint' || e.name === 'firstContentfulPaint') marks[e.name] = marks[e.name] ?? Date.now() - t0; });
  await cdp.send('Page.enable');
  await cdp.send('Page.setLifecycleEventsEnabled', { enabled: true });
  cdp.on('Page.screencastFrame', (f) => { frames.push({ t: Date.now() - t0, data: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 40, maxWidth: 180, maxHeight: 370, everyNthFrame: 1 });
  await p.goto(PROD, { waitUntil: 'commit' });
  await p.waitForSelector('[data-testid=title-screen],[data-testid=life-screen]', { timeout: 15000 });
  await sleep(600);
  const bodyBg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await cdp.send('Page.stopScreencast').catch(() => {});
  await ctx.close();
  const br = await meanBrightness(frames);
  return { n: frames.length, br, bodyBg, marks };
}

const N = Number(process.argv[2] || 30);
const res = [];
for (let i = 0; i < N; i++) {
  const r = await captureLoad('dark', null, 1500);
  res.push(r.br); res[res.length-1].marks = r.marks;
}
const maxes = res.map((br) => Math.max(...br.map((b) => b.y)));
const bad = res.map((br, i) => ({ i, br })).filter((x) => Math.max(...x.br.map((b) => b.y)) > 60);
console.log(`다크 첫 로드 ${N}회: 프레임 수 ${[...new Set(res.map((b) => b.length))].join('/')}, 최대 밝기 분포 ${[...new Set(maxes)].sort((a, b) => a - b).join(',')}, 밝은 프레임(>60) 있는 회차 ${bad.length}`);
for (const b of bad) console.log(`  회차 ${b.i}: ${b.br.map((x) => `${x.t}ms:${x.y}`).join(' ')} | 커밋 ${b.br.marks.commit}ms 첫 페인트 ${b.br.marks.firstPaint}ms`);
const good = res.map((br, i) => ({ i, br })).filter((x) => Math.max(...x.br.map((b) => b.y)) <= 60).slice(0, 3);
for (const g of good) console.log(`  (정상 예) 회차 ${g.i}: ${g.br.map((x) => `${x.t}ms:${x.y}`).join(' ')} | 커밋 ${g.br.marks.commit}ms 첫 페인트 ${g.br.marks.firstPaint}ms`);
await browser.close();
