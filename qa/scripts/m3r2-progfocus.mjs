// QA-003 M3 CM10 (d): 화면 전환 직후 프로그램 포커스(제목·같은 자리 버튼)가 고정 요소에 가려지지 않는다 — 11뷰포트 × 글자 100·200%
import { launch, mkctx, fixSeed, runCase, shot, openTitle, toRoulette, waitGuard, sleep, STD_VIEWPORTS, TOUCH, setRootFont } from './m3r2-lib.mjs';
import { MEASURE } from './m3-measure.mjs';

const browser = await launch();

await runCase(
  { id: 'M3-C10d', cat: '접근성', title: 'CM10(d) 프로그램 포커스: 룰렛·출생신고 도착 직후 제목 포커스, 건너뛰기 뒤 같은 자리 버튼 포커스가 고정 요소에 가려지지 않는다', steps: '11개 공통 뷰포트 × 글자 100·200%(320x256 글자 200% 제외)에서 태어나기 → 룰렛 도착 직후(제목 포커스) → 건너뛰기 → 출생신고 보기(포커스 유지) → 출생신고 도착 직후(제목 포커스) 각각 MEASURE(포커스 링 상자와 고정 요소 겹침·화면 안·한가운데 점)', expected: '모든 지점에서 겹침 0·화면 안·가려짐 0' },
  async () => {
    const bad = [];
    const rows = [];
    const shots = [];
    for (const vp of STD_VIEWPORTS) {
      for (const font of [100, 200]) {
        if (vp.name === '320x256-zoom400' && font === 200) continue;
        const ctx = await mkctx(browser, { viewport: { width: vp.width, height: vp.height }, ...(vp.touch ? TOUCH : {}) });
        await fixSeed(ctx, 229);
        const p = await ctx.newPage();
        await openTitle(p);
        if (font !== 100) await setRootFont(p, font);
        await sleep(200);
        await waitGuard(p, 'start-birth');
        await p.getByTestId('start-birth').click();
        await p.waitForSelector('[data-testid="roulette-screen"]');
        await sleep(350);
        const pts = [];
        const grab = async (label) => {
          const m = await p.evaluate(MEASURE);
          pts.push({ label, ...m });
        };
        await grab('roulette-arrive');
        await waitGuard(p, 'skip-roulette');
        await p.getByTestId('skip-roulette').click();
        await p.waitForSelector('[data-testid="to-birth"]');
        await sleep(300);
        await grab('after-skip');
        await waitGuard(p, 'to-birth');
        await p.getByTestId('to-birth').click();
        await p.waitForSelector('[data-testid="birth-screen"]');
        await sleep(450);
        await grab('birth-arrive');
        for (const m of pts) {
          const tag = `${vp.name}/${font}%/${m.label}`;
          if (m.body) {
            bad.push(`${tag}: 포커스가 body(도착 시 제목에 포커스가 와야 함)`);
            continue;
          }
          if (m.overlaps.length) bad.push(`${tag}: ${m.key} 링 ${m.ringTop}~${m.ringBottom}이 ${m.overlaps.map((o) => o.name).join(',')}에 가려짐`);
          if (!m.inView) bad.push(`${tag}: ${m.key} 화면 밖 ${m.ringTop}~${m.ringBottom}`);
          if (!m.hitOk) bad.push(`${tag}: ${m.key} 한가운데 점이 다른 요소`);
        }
        rows.push(`${vp.name}/${font}%: ${pts.map((m) => m.key ?? 'body').join('→')}`);
        if ((vp.name === '320x568' || vp.name === '667x375-landscape') && font === 200) shots.push(await shot(p, 'C10d', `${vp.name}-${font}-birth-arrive`));
        await ctx.close();
      }
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간(접근성)', actual: bad.length ? bad.slice(0, 8).join(' / ') : `21조합 × 3지점 = 63회: 가림 0·화면 밖 0 (포커스 요소 예: ${rows[0]})`, shots };
  },
);
await browser.close();
