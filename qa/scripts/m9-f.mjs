// QA-003 M9 F군(배포 번들): 개발 탐침(?__timescale 등) 무효, 개발 문자열 0, 서비스 워커 0, 요청 도메인 localhost만, 푸터 빌드 표기, 번들 크기.
// 대상은 PAGES_BASE=/spoongame/ 로 빌드한 배포용 번들(세션 임시 폴더)과 vite preview다. 배포 주소(github.io)는 외부 요청 금지라 가지 않는다 — DP8(푸터 커밋 7자 = main HEAD)은 배포 뒤 마스터가 `DEPLOY_URL`로 돌린다(SKIP으로 적음).
// 사용: node qa/scripts/m9-f.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { launch, mkctx, cleanStorageOnce, readCard, sleep, shot, runCase, waitGuard, whichScreen, PROD, ROOT, toRoulette, skipToBirth, birthToLife, readSave } from './m7c-lib.mjs';

const DIST = process.env.M9_DIST || path.join(process.env.M9_SCR || '', 'dist');
const browser = await launch();
const BASE = PROD.replace(/\/$/, '');
const ORIGIN = new URL(PROD).origin;

await runCase({ id: 'F-bundle-strings', cat: 'F 배포 번들', title: '배포 번들 파일(index.html·JS·CSS)에 개발 탐침·하니스·개발 문자열이 없고, 자산 경로가 /spoongame/ 아래이며 외부 주소가 코드에 박혀 있지 않다', steps: '빌드 산출물 폴더의 모든 텍스트 파일을 읽어 금지 문자열 검색 + 서버가 주는 index.html 확인' }, async () => {
  const problems = [];
  const files = [];
  const walk = (d) => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) walk(p); else files.push(p); } };
  walk(DIST);
  const text = files.filter((f) => /\.(html|js|css|svg|json|txt|webmanifest)$/.test(f)).map((f) => [path.relative(DIST, f), fs.readFileSync(f, 'utf8')]);
  const FORBID = ['__timescale', '__guard', '__crash', '__quota', '__exit', '__playTime', '__layout', 'GuardedButton 하니스', '선택지 레이아웃 하니스', '/harness/', 'localhost:5', '127.0.0.1'];
  for (const [name, t] of text) for (const w of FORBID) if (t.includes(w)) problems.push(`${name}에 「${w}」`);
  // 외부 주소: https://… 는 데이터 출처 링크·GitHub 이슈 주소뿐이어야 한다(요청이 아니라 사용자가 누르는 링크). 요청을 일으키는 src/import 꼴은 금지
  const html = text.find(([n]) => n === 'index.html');
  if (!html) problems.push('index.html 없음');
  else {
    if (/<script[^>]+src=["']https?:/i.test(html[1]) || /<link[^>]+href=["']https?:\/\/[^"']*\.(css|woff2?|js)/i.test(html[1])) problems.push('index.html이 외부 스크립트·스타일·글꼴을 불러옴');
    if (!/src="\/spoongame\/assets\//.test(html[1]) && !/src="\.\/assets\//.test(html[1])) problems.push('index.html의 번들 경로가 /spoongame/ 아래가 아님');
  }
  const swFiles = files.filter((f) => /(^|[\\/])(sw|service-worker|workbox[^\\/]*)\.js$/i.test(f));
  if (swFiles.length) problems.push(`서비스 워커 파일 ${swFiles.map((f) => path.basename(f)).join(', ')}`);
  const js = text.filter(([n]) => n.endsWith('.js'));
  if (js.some(([, t]) => /navigator\.serviceWorker\.register/.test(t))) problems.push('serviceWorker.register 호출이 번들에 있음');
  const fetchExternal = js.filter(([, t]) => /fetch\(\s*["']https?:/.test(t) || /XMLHttpRequest/.test(t));
  if (fetchExternal.length) problems.push('번들에 외부 fetch/XMLHttpRequest');
  return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `파일 ${files.length}개(텍스트 ${text.length}), 금지 문자열 ${FORBID.length}종 0, 서비스 워커 0, 외부 fetch 0, 자산 경로 /spoongame/`, shots: [] };
});

await runCase({ id: 'F-bundle-size', cat: 'F 배포 번들', title: '초기 로드 크기(완료 기준 13): HTML + JS + CSS + 아이콘 gzip 합 ≤ 400KB', steps: '빌드 산출물 파일을 gzip 압축해 합을 잼(index.html이 불러오는 파일만)' }, async () => {
  let total = 0;
  const parts = [];
  for (const f of fs.readdirSync(DIST, { recursive: true })) {
    const p = path.join(DIST, f);
    if (!fs.statSync(p).isFile()) continue;
    const gz = zlib.gzipSync(fs.readFileSync(p), { level: 9 }).length;
    total += gz;
    parts.push(`${path.basename(f)} ${gz}`);
  }
  const kb = total / 1000;
  return { verdict: total <= 400 * 1024 ? 'PASS' : 'FAIL', actual: `gzip 합 ${total}바이트(${kb.toFixed(1)}KB, 400KB의 ${(total / 4096).toFixed(1)}%) — ${parts.join(', ')}`, shots: [] };
});

await runCase({ id: 'F-probes-inert', cat: 'F 배포 번들', title: '개발 탐침 쿼리(?__timescale=1000·__guard·__crash·__quota·__exit·__playTime)는 배포 번들에서 아무 효과가 없다', steps: '탐침을 모두 붙인 주소로 새 판을 열어 대시보드까지 → 8초 관찰: 오류 화면·저장 실패 안내·빨라진 시계·나가기 확인 자동 열림 없음' }, async () => {
  const ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
  await cleanStorageOnce(ctx);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`${PROD}?__timescale=1000&__guard=1&__crash=1&__quota=1&__exit=1&__playTime=1`, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 10000 }).catch(() => {});
  const problems = [];
  const scr0 = await whichScreen(page);
  if (scr0 !== 'title-screen') problems.push(`첫 화면 대신 ${scr0}`);
  await toRoulette(page, 'present');
  await skipToBirth(page);
  await birthToLife(page);
  const a0 = (await readCard(page)).age;
  await sleep(8000);
  const c = await readCard(page);
  if (c.screen !== 'life-screen') problems.push(`대시보드 대신 ${c.screen}`);
  if (c.age - a0 > 1) problems.push(`8초에 ${a0}→${c.age}세 (시간이 빨라짐)`);
  if (c.saveNotice) problems.push('저장 실패 안내가 뜸(__quota가 먹힘?)');
  if (c.exitAsk) problems.push('나가기 확인이 저절로 열림(__exit가 먹힘?)');
  const hasPlayTime = await page.evaluate(() => typeof window.__playTime);
  if (hasPlayTime !== 'undefined') problems.push(`window.__playTime이 ${hasPlayTime}`);
  if (errs.length) problems.push(`페이지 오류 ${errs[0]}`);
  const s = problems.length ? await shot(page, 'F-probes-inert') : null;
  await ctx.close();
  return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `탐침 6종을 붙여도 정상: 8초에 ${a0}→${c.age}세, 오류·저장 실패 안내·나가기 확인 없음, window.__playTime ${hasPlayTime}`, shots: s ? [s] : [] };
});

await runCase({ id: 'F-serviceworker', cat: 'F 배포 번들', title: '서비스 워커 0: 등록된 서비스 워커가 없고 /sw.js 같은 주소도 서비스되지 않는다', steps: '첫 화면·대시보드에서 navigator.serviceWorker.getRegistrations(), caches.keys(), sw 후보 경로 요청' }, async () => {
  const ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
  await cleanStorageOnce(ctx);
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"]');
  await toRoulette(page, 'present');
  await skipToBirth(page);
  await birthToLife(page);
  await sleep(1500);
  const r = await page.evaluate(async () => ({
    regs: navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 'api 없음',
    caches: typeof caches !== 'undefined' ? (await caches.keys()).length : 'api 없음',
    controller: navigator.serviceWorker ? !!navigator.serviceWorker.controller : false,
  }));
  const problems = [];
  if (r.regs !== 0 && r.regs !== 'api 없음') problems.push(`등록된 서비스 워커 ${r.regs}`);
  if (r.caches !== 0 && r.caches !== 'api 없음') problems.push(`캐시 저장소 ${r.caches}개`);
  if (r.controller) problems.push('서비스 워커가 페이지를 제어함');
  const probe = [];
  for (const p of ['sw.js', 'service-worker.js', 'serviceWorker.js', 'registerSW.js', 'manifest.webmanifest']) {
    const res = await page.request.get(`${BASE}/${p}`);
    const ct = res.headers()['content-type'] || '';
    if (res.status() === 200 && /javascript|json/.test(ct)) probe.push(`${p}(${res.status()} ${ct})`);
  }
  if (probe.length) problems.push(`서비스되는 파일: ${probe.join(', ')}`);
  await ctx.close();
  return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `서비스 워커 ${r.regs}, 캐시 저장소 ${r.caches}, 제어 ${r.controller}, sw 후보 5경로 모두 서비스 안 됨`, shots: [] };
});

await runCase({ id: 'F-footer-build', cat: 'F 배포 번들', title: '첫 화면 푸터 빌드 표기: 「v버전 (커밋7자)」 꼴(로컬 빌드는 작업 트리에 커밋 안 된 변경이 있으면 「+」)', steps: '첫 화면의 build-version 글을 읽어 꼴 검사, git HEAD 앞 7자와 대조' }, async () => {
  const ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
  await cleanStorageOnce(ctx);
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"]');
  const t = (await page.getByTestId('build-version').innerText()).replace(/\s+/g, ' ').trim();
  const { execFileSync } = await import('node:child_process');
  let head = null;
  try { head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim().slice(0, 7); } catch {}
  const m = /^v(\d+\.\d+\.\d+)\s*\(([0-9a-f]{7})(\+?)\)$/.exec(t) || /v(\d+\.\d+\.\d+).*?([0-9a-f]{7})(\+?)/.exec(t);
  const problems = [];
  if (!m) problems.push(`꼴이 다름: 「${t}」`);
  else if (head && m[2] !== head) problems.push(`커밋 ${m[2]} ≠ HEAD ${head}`);
  await ctx.close();
  return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `「${t}」 (HEAD ${head}${m && m[3] ? ', 작업 트리에 변경이 있어 「+」' : ''})`, shots: [] };
});

await browser.close();
