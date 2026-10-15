// QA-003 M2 추가: 포커스가 하단 띠에 가려지지 않는가(N14), 실행 중 OS 테마 전환(L02), 파비콘·아이콘 경로(X03)
import { launch, mkctx, runCase, shot, openTitle, waitGuard, VP, TOUCH, PROD, sleep, lifeInfo, startToLife, parseRgb, luminance } from './m2r3-lib.mjs';

const browser = await launch();
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);

if (want('N14'))
  await runCase({ id: 'M2-N14', cat: '정상', title: '키보드 포커스가 하단 고정 띠에 가려지지 않는가 — Tab으로 끝까지 순회 (WCAG 2.4.11·CM4)', steps: '360x740·320x568·1280x800·1280x620에서 Tab을 눌러 포커스가 갈 때마다 포커스 요소 한가운데 점이 실제로 그 요소(또는 안)가 맞는지(띠에 덮이지 않았는지)와 화면 안에 있는지 확인', expected: '포커스를 받은 요소는 항상 화면 안·띠 위에 보임(가려진 포커스 0)' }, async () => {
    const problems = [];
    const rows = [];
    const shots = [];
    for (const [vname, vp, touch] of [['m360x740', VP.m360, true], ['m320x568', VP.m320, true], ['d1280x800', VP.d1280, false], ['d1280x620', VP.d1280low, false]]) {
      const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}) });
      const p = await ctx.newPage();
      await openTitle(p);
      await waitGuard(p);
      await p.mouse.move(2, 2);
      const seq = [];
      for (let i = 0; i < 10; i++) {
        await p.keyboard.press('Tab');
        await sleep(120);
        const r = await p.evaluate(() => {
          const a = document.activeElement;
          if (!a) return null;
          const lab = a.closest('label') || a;
          const b = (a.type === 'radio' ? lab : a).getBoundingClientRect();
          const cx = b.left + b.width / 2, cy = b.top + Math.min(b.height / 2, 12);
          const hit = document.elementFromPoint(cx, cy);
          const bar = document.querySelector('[data-testid=bottom-bar]').getBoundingClientRect();
          const id = a.getAttribute('data-testid') || a.tagName;
          return { id, top: Math.round(b.top), bottom: Math.round(b.bottom), inView: b.top >= 0 && b.bottom <= innerHeight + 1, visibleTopPart: !!hit && (a.contains(hit) || (a.type === 'radio' ? lab.contains(hit) : false) || hit.closest('label') === lab || hit === a), barTop: Math.round(bar.top), overlapsBar: b.bottom > bar.top + 1 && b.top < bar.top, fullyUnderBar: b.top >= bar.top - 0.5 };
        });
        seq.push(r);
        if (r && r.id !== 'start-birth' && r.overlapsBar && (r.barTop - r.top) < (r.bottom - r.top) / 2) shots.push(await shot(p, 'N14', `${vname}-${r.id}`));
        if (r && r.id === 'start-birth') break;
      }
      // 가림 판정: 포커스 요소 위쪽 12px 지점이 띠에 덮였거나(= 한가운데가 안 보임), 요소의 절반 이상이 띠 안
      const covered = seq.filter((r) => r && r.id !== 'start-birth' && (r.fullyUnderBar || !r.visibleTopPart || (r.overlapsBar && (r.barTop - r.top) < (r.bottom - r.top) / 2)));
      const partial = seq.filter((r) => r && r.id !== 'start-birth' && r.overlapsBar && !covered.includes(r));
      rows.push(`${vname}: ${seq.map((r) => `${r.id}[${r.top}~${r.bottom}, 띠 ${r.barTop}${r.overlapsBar || r.fullyUnderBar ? ' ←가림' : ''}]`).join(' → ')}`);
            if (covered.length) problems.push(`${vname}: 포커스 요소가 하단 띠에 절반 이상 가려짐 ${covered.map((r) => `${r.id}(${r.top}~${r.bottom} vs 띠 ${r.barTop})`)}`);
      if (partial.length) rows.push(`  (${vname}: 일부만 띠에 걸친 포커스 ${partial.map((r) => r.id)} — 상단은 보임)`);
      shots.push(await shot(p, 'N14', vname));
      await ctx.close();
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', severity: problems.length ? '중간(접근성)' : undefined, actual: (problems.length ? problems.join(' / ') + ' || 전체 순회: ' : '') + rows.join(' ; '), shots };
  });

if (want('L02'))
  await runCase({ id: 'M2-L02', cat: '환경', title: '사용 중 OS 테마 전환 — 첫 화면은 따라가고 옛 화면은 라이트 유지 (DB6·R-208)', steps: '첫 화면에서 emulateMedia로 라이트→다크→라이트, 같은 방식으로 출생 화면(옛 화면)에서 다크로 전환 → 바탕색 읽기', expected: '첫 화면은 전환을 즉시 따라감, 옛 화면은 라이트 고정(깨진 대비 없음)' }, async () => {
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH, colorScheme: 'light' });
    const p = await ctx.newPage();
    await openTitle(p);
    await waitGuard(p);
    const bg = () => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const out = [];
    out.push(`라이트 ${await bg()}`);
    await p.emulateMedia({ colorScheme: 'dark' });
    await sleep(300);
    const d = await bg();
    out.push(`→다크 ${d}`);
    const shots = [await shot(p, 'L02', 'title-switched-dark')];
    await p.emulateMedia({ colorScheme: 'light' });
    await sleep(300);
    const l = await bg();
    out.push(`→라이트 ${l}`);
    await p.emulateMedia({ colorScheme: 'dark' });
    await sleep(200);
    await p.getByTestId('start-birth').click();
    await p.waitForSelector('[data-testid=birth-screen]');
    await sleep(400);
    const b1 = await bg();
    await p.emulateMedia({ colorScheme: 'light' });
    await sleep(200);
    await p.emulateMedia({ colorScheme: 'dark' });
    await sleep(300);
    const b2 = await bg();
    out.push(`출생 화면(다크 OS) ${b1}/${b2}`);
    shots.push(await shot(p, 'L02', 'birth-os-dark'));
    await ctx.close();
    const problems = [];
    if (!(luminance(parseRgb(d)) < 60)) problems.push(`다크 전환 뒤 첫 화면 바탕 ${d}`);
    if (!(luminance(parseRgb(l)) > 200)) problems.push(`라이트 복귀 뒤 바탕 ${l}`);
    for (const x of [b1, b2]) if (!(luminance(parseRgb(x)) > 200)) problems.push(`옛 화면이 라이트가 아님 ${x}`);
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : out.join(' ; '), shots };
  });

if (want('X03'))
  await runCase({ id: 'M2-X03', cat: '환경', title: 'Pages 경로(/spoongame/)에서 파비콘·터치 아이콘·번들이 모두 200 (DP2)', steps: 'prod index.html이 가리키는 모든 자산 URL을 요청해 상태 코드·콘텐츠 타입 확인, /spoongame/ 밖 경로 요청 0', expected: '모든 자산 200, 경로가 /spoongame/ 아래' }, async () => {
    const ctx = await mkctx(browser, { viewport: VP.m360 });
    const p = await ctx.newPage();
    await p.goto(PROD);
    const urls = await p.evaluate(() => [...document.querySelectorAll('link[href],script[src]')].map((e) => e.href || e.src));
    const rows = [];
    const problems = [];
    for (const u of urls) {
      const r = await ctx.request.get(u);
      rows.push(`${new URL(u).pathname.replace('/spoongame/', '')} ${r.status()} ${r.headers()['content-type']?.split(';')[0]}`);
      if (r.status() !== 200) problems.push(`${u} ${r.status()}`);
      if (!new URL(u).pathname.startsWith('/spoongame/')) problems.push(`경로가 /spoongame/ 밖 ${u}`);
    }
    const x03shot = await shot(p, 'X03', 'title');
    await ctx.close();
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : rows.join(' ; '), shots: [x03shot] };
  });

await browser.close();
