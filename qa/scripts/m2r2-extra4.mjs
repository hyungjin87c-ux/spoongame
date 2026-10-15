// QA-003 M2 2회차 추가: r4 변경(scroll-padding·has-bottom-bar·revealTopOfTallFocus)의 부작용 점검
import { launch, mkctx, runCase, shot, sleep, openTitle, waitGuard, VP, TOUCH, PROD, ensureFixture, seedContext, openState, whichScreen } from './m2r2-lib.mjs';

const browser = await launch();
const fx = await ensureFixture(browser);
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);

const rootInfo = (p) =>
  p.evaluate(() => {
    const h = document.documentElement;
    const cs = getComputedStyle(h);
    const bar = document.querySelector('[data-testid=bottom-bar]');
    return {
      cls: h.className,
      barVar: h.style.getPropertyValue('--bar-h') || getComputedStyle(h).getPropertyValue('--bar-h'),
      spb: cs.scrollPaddingBottom,
      spt: cs.scrollPaddingTop,
      barH: bar ? Math.round(bar.getBoundingClientRect().height) : null,
    };
  });

if (want('A20'))
  await runCase(
    { id: 'M2-A20', cat: '공격', title: '스크롤 여백의 수명주기 — 상태가 바뀌면 따라가고, 첫 화면을 떠나면 사라지고, 돌아오면 다시 생기는가 (QM2-1 구현 부작용)', steps: '(1) 새 판→(개발 서버) 이어하기→확인 단계→돌아가기에서 html의 has-bottom-bar·scroll-padding-bottom이 띠 높이+12px와 일치하는지 (2) prod에서 태어나기로 옛 화면에 들어가면 클래스·여백이 사라지는지, 엔딩까지 가서 다시 태어나기로 첫 화면에 돌아오면 다시 생기는지', expected: '첫 화면에서만 클래스가 있고 scroll-padding-bottom = 띠 높이 + 12px(상태마다), 옛 화면에서는 클래스·여백 없음' },
    async () => {
      const problems = [];
      const facts = [];
      const shots = [];
      // (1) 개발 서버: 이어하기 → 확인 → 돌아가기
      {
        const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
        await seedContext(ctx, fx);
        const p = await ctx.newPage();
        await openState(p, 'continue');
        await sleep(300);
        const a = await rootInfo(p);
        await p.getByTestId('begin-new').click();
        await p.waitForSelector('[data-testid=confirm-new-ask]');
        await sleep(400);
        const b = await rootInfo(p);
        await p.getByTestId('confirm-new-no').click();
        await sleep(400);
        const c = await rootInfo(p);
        for (const [name, r] of [['이어하기', a], ['확인 단계', b], ['돌아가기 뒤', c]]) {
          const expect = r.barH + 12;
          if (!/has-bottom-bar/.test(r.cls)) problems.push(`${name}: html에 has-bottom-bar 없음 (${r.cls})`);
          if (Math.abs(parseFloat(r.spb) - expect) > 1.5) problems.push(`${name}: scroll-padding-bottom ${r.spb} ≠ 띠 ${r.barH}px + 12`);
          if (parseFloat(r.spt) !== 12) problems.push(`${name}: scroll-padding-top ${r.spt}`);
        }
        facts.push(`이어하기 띠 ${a.barH}px→여백 ${a.spb}, 확인 단계 띠 ${b.barH}px→여백 ${b.spb}, 돌아가기 뒤 띠 ${c.barH}px→여백 ${c.spb}`);
        await ctx.close();
      }
      // (2) prod: 새 판 → 옛 화면(클래스 사라짐) → 엔딩 → 다시 태어나기
      {
        const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
        const p = await ctx.newPage();
        await openTitle(p);
        await waitGuard(p);
        const t0 = await rootInfo(p);
        await p.getByTestId('start-birth').click();
        await p.waitForSelector('[data-testid=birth-screen]');
        await sleep(400);
        const b0 = await rootInfo(p);
        if (!/has-bottom-bar/.test(t0.cls) || Math.abs(parseFloat(t0.spb) - (t0.barH + 12)) > 1.5) problems.push(`첫 화면(새 판): ${JSON.stringify(t0)}`);
        if (/has-bottom-bar/.test(b0.cls) || parseFloat(b0.spb) > 0.5) problems.push(`옛 출생 화면에 클래스/여백이 남음: ${JSON.stringify(b0)}`);
        // 새로고침해도 옛 화면 유지
        await p.reload();
        await p.waitForSelector('[data-testid=birth-screen]');
        await sleep(300);
        const b1 = await rootInfo(p);
        if (/has-bottom-bar/.test(b1.cls)) problems.push('옛 화면 새로고침 뒤 has-bottom-bar가 생김');
        // 옛 화면에서 Tab으로 다음 버튼까지 — 포커스가 정상
        facts.push(`첫 화면 ${t0.cls || '(없음)'}/${t0.spb} → 출생 화면 ${b0.cls || '(없음)'}/${b0.spb}`);
        shots.push(await shot(p, 'A20', 'birth-screen'));
        await ctx.close();
      }
      return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : facts.join(' ; '), shots };
    }
  );

if (want('A21'))
  await runCase(
    { id: 'M2-A21', cat: '공격', title: '마우스·터치로 슬라이드 영역·카드를 눌러도 화면이 점프하지 않는가 (revealTopOfTallFocus는 키보드 포커스 전용)', steps: '360x740 터치·320x568 마우스에서 캐러셀을 화면 중간에 오게 스크롤한 뒤 슬라이드 영역을 누르고(탭/클릭), 전후 scrollY를 비교. 같은 위치에서 키보드 Tab으로 슬라이드 영역에 들어가면 위쪽 변이 보이게 스크롤되는지도 확인', expected: '포인터로 눌러도 scrollY 불변(점프 0), 키보드 포커스는 위쪽 변이 가용 영역 안' },
    async () => {
      const problems = [];
      const facts = [];
      const shots = [];
      for (const [name, vp, touch] of [['360x740-touch', VP.m360, true], ['320x568-mouse', VP.m320, false]]) {
        const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}) });
        const p = await ctx.newPage();
        await openTitle(p);
        await waitGuard(p);
        await p.getByTestId('carousel-pause').click().catch(() => {});
        // 슬라이드 영역이 화면 가운데 오게
        await p.evaluate(() => {
          const v = document.querySelector('[data-testid=carousel-viewport]');
          const r = v.getBoundingClientRect();
          window.scrollTo(0, window.scrollY + r.top - 120);
        });
        await sleep(300);
        const y0 = await p.evaluate(() => window.scrollY);
        const box = await p.getByTestId('carousel-viewport').boundingBox();
        const px = box.x + box.width / 2;
        const py = Math.min(box.y + 60, vp.height - 140);
        if (touch) await p.touchscreen.tap(px, py);
        else await p.mouse.click(px, py);
        await sleep(400);
        const y1 = await p.evaluate(() => window.scrollY);
        if (Math.abs(y1 - y0) > 1) problems.push(`${name}: 포인터로 눌렀더니 scrollY ${y0}→${y1} (점프)`);
        // 키보드: 슬라이드 영역으로 Tab
        await p.evaluate(() => window.scrollTo(0, 0));
        await sleep(150);
        await p.getByTestId('carousel-pause').focus();
        await p.keyboard.press('Tab');
        await sleep(300);
        const onVp = await p.evaluate(() => document.activeElement?.getAttribute('data-testid'));
        const rect = await p.evaluate(() => {
          const r = document.querySelector('[data-testid=carousel-viewport]').getBoundingClientRect();
          const bar = document.querySelector('[data-testid=bottom-bar]').getBoundingClientRect();
          return { top: Math.round(r.top), bottom: Math.round(r.bottom), barTop: Math.round(bar.top), vh: innerHeight };
        });
        if (onVp !== 'carousel-viewport') facts.push(`${name}: Tab 한 번 뒤 포커스 ${onVp}`);
        else if (rect.top < -0.5 || rect.top > rect.barTop - 40) problems.push(`${name}: 키보드 포커스 슬라이드 영역 위쪽 변 ${rect.top} (띠 ${rect.barTop})`);
        facts.push(`${name}: 포인터 누름 scrollY ${y0}→${y1}, 키보드 포커스 위쪽 변 ${rect.top}/띠 ${rect.barTop}`);
        shots.push(await shot(p, 'A21', name));
        await ctx.close();
      }
      return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') + ' || ' + facts.join(' ; ') : facts.join(' ; '), shots };
    }
  );

await browser.close();
