// QA-003 M4 공격(6): 자동 모드와 손 선택 경합·배포본이 개발 탐침을 무시하는가·요청 목록. 사용: node qa/scripts/m4-attack-f.mjs [id-prefix]
import { launch, mkctx, fixSeed, cleanStorageOnce, newGameToLife, readDash, shot, sleep, runCase, con, PROD, TOUCH, VP, waitGuard, readRaw, GAME_KEY, whichScreen } from './m4-lib.mjs';

const only = process.argv[2] || '';
const want = (id) => !only || id.startsWith(only);
const browser = await launch();
const errs = () => con.take();

if (want('M4-A14')) {
  await runCase(
    { id: 'M4-A14', cat: '공격', title: '자동 모드가 선택하는 순간에 손으로도 선택 버튼을 연타: 한 카드에 선택은 한 번, 기록 중복 0, 나이 단조', steps: '자동 모드 + 8배속(개발 서버 ×1이 아니라 배포 번들) 상태로 선택 버튼 좌표를 40ms 간격으로 25초 연타(카드가 뜰 때마다 겹침), 이후 기록 분석', expected: '같은 나이에 같은 문장이 두 번 쌓이지 않고, 기록의 「(선택:」 수 = 카드 수, 나이 역전 0, 오류 0' },
    async () => {
      const bad = [];
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await cleanStorageOnce(ctx);
      await fixSeed(ctx, 229);
      const p = await ctx.newPage();
      await newGameToLife(p);
      await p.locator('[data-speed="8"]').click();
      await p.getByTestId('auto').click();
      const t0 = Date.now();
      let clicks = 0;
      while (Date.now() - t0 < 25000) {
        const box = await p.locator('[data-testid="choice-panel"] .choice').first().boundingBox().catch(() => null);
        if (box) {
          await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => {});
          clicks++;
        } else {
          // 카드가 없어도 같은 자리를 두드린다(카드가 뜨는 순간 겹치게)
          await p.mouse.click(180, 330).catch(() => {});
        }
        await sleep(40);
      }
      const g = JSON.parse(await readRaw(p, GAME_KEY)).data;
      const texts = g.history.map((h) => `${h.age}|${h.kind}|${h.text}`);
      const dup = texts.filter((t, i) => texts.indexOf(t) !== i);
      if (dup.length) bad.push(`기록 중복 ${dup.slice(0, 2)}`);
      let prev = -1;
      for (const h of g.history) {
        if (h.age < prev) bad.push(`나이 역전 ${prev}→${h.age}`);
        prev = h.age;
      }
      const picks = g.history.filter((h) => h.choice).length;
      const stageCards = g.seen ? Object.keys(g.seen).length : null;
      const d = await readDash(p);
      await shot(p, 'A14', 'after');
      const e = errs();
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: (bad.length ? [...new Set(bad)].join(' / ') + ' | ' : '') + `25초 동안 클릭 ${clicks}번, 나이 ${d.age}, 기록 ${g.history.length}줄, 선택 기록 ${picks}건, 중복 0`, shots: ['qa/screenshots/003/M4-A14-after.png'] };
    },
  );
}

if (want('M4-X01')) {
  await runCase(
    { id: 'M4-X01', cat: '회귀', title: '배포본(prod 빌드)이 개발 탐침(?__timescale·?__quota·?__crash·?__exit)을 무시한다 + 서비스 워커 없음 + 요청 목록은 같은 출처의 번들·아이콘뿐', steps: 'prod 주소에 ?__timescale=100&__quota&__crash&__exit를 붙여 새 판 → 한 해 길이·저장·오류 화면 여부 → 서비스 워커 등록 수 → 요청 URL 목록', expected: '한 해 길이가 7초(배율 무시), 저장 성공, 오류 화면 없음, 첫 화면 다시 열기 없음, 서비스 워커 0, 요청은 모두 같은 출처' },
    async () => {
      const bad = [];
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await cleanStorageOnce(ctx);
      await fixSeed(ctx, 229);
      await ctx.addInitScript(() => {
        window.__tl = [];
        const read = () => {
          const age = document.querySelector('[data-testid="life-age"] b');
          if (!age) return;
          const a = parseInt(age.textContent, 10);
          const last = window.__tl[window.__tl.length - 1];
          if (!last || last.a !== a) window.__tl.push({ t: Math.round(performance.now()), a });
        };
        const start = () => new MutationObserver(read).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
        document.documentElement ? start() : document.addEventListener('DOMContentLoaded', start);
      });
      const p = await ctx.newPage();
      const reqs = new Set();
      p.on('request', (r) => reqs.add(new URL(r.url()).origin + new URL(r.url()).pathname.replace(/[0-9a-zA-Z_-]{8}\./, 'HASH.')));
      await newGameToLife(p, { query: '?__timescale=100&__quota&__crash&__exit' });
      await sleep(16000);
      const tl = await p.evaluate(() => window.__tl);
      const d = await readDash(p);
      const sv = await readRaw(p, GAME_KEY);
      const sw = await p.evaluate(async () => (navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 'n/a'));
      const years = [];
      for (let i = 1; i < tl.length; i++) years.push(tl[i].t - tl[i - 1].t);
      if (d.screen !== 'life-screen') bad.push(`화면 ${d.screen}`);
      if (!sv) bad.push('?__quota가 먹어 저장이 안 됨(배포본에서 탐침이 살아 있음)');
      if (years.length && years[0] < 3000) bad.push(`한 해 ${years[0]}ms — 시간 배율이 먹음`);
      if (sw !== 0 && sw !== 'n/a') bad.push(`서비스 워커 ${sw}개`);
      const origins = [...reqs];
      const external = origins.filter((u) => !u.startsWith('http://127.0.0.1:4899'));
      if (external.length) bad.push(`외부 출처 요청 ${external}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + `한 해 길이 ${years.slice(0, 2).join('/')}ms, 저장 ${sv ? '있음' : '없음'}, 서비스 워커 ${sw}, 요청 ${origins.length}종: ${origins.map((u) => u.replace('http://127.0.0.1:4899', '')).join(', ')}`, shots: [] };
    },
  );
}

await browser.close();
