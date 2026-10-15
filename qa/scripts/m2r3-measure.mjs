// QA-003 M2 실측: R-220·R-200(캐러셀 카드·조작 줄 위치) 와 R-223(다크 번쩍임)
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, runCase, shot, openTitle, waitGuard, VP, PROD, DEV, GAME_KEY, SETTINGS_KEY, sleep, OUT } from './m2r3-lib.mjs';

const browser = await launch();
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);
const TITLE = '[data-testid=title-screen]';

const LIFE_V5 = JSON.stringify({ version: 5, data: { phase: 'life', era: 'present', lifeLength: 'short30', character: { name: '김민준', gender: 'male', birthYear: 2012, parentWealth: 3, parenting: 'free', looks: 50 }, stats: { wealth: 45, education: 6, health: 70, happiness: 52, relationships: 54 }, birthStats: { wealth: 45, education: 6, health: 70, happiness: 52, relationships: 54 }, age: 3, history: [{ age: 0, kind: 'stage', text: '2012년, 남자아이로 태어났다.' }], flags: [], seen: {}, pending: null, lastChoiceAge: null, death: null, seed: 1234, rngState: 1235 } });

// 상태 3종: new(prod, 새 판) / continue(dev ?__exit, 이어하기) / confirm(dev ?__exit + 「새로 태어나기」 확인 단계)
async function openState(ctx, state) {
  const p = await ctx.newPage();
  if (state === 'new') {
    await p.goto(PROD);
  } else {
    await ctx.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); localStorage.setItem(k, v); } } catch {} }, [GAME_KEY, LIFE_V5]);
    await p.goto(DEV + '?__exit');
  }
  await p.waitForSelector(TITLE);
  await sleep(500);
  if (state === 'confirm') {
    await waitGuard(p, 'begin-new');
    await p.getByTestId('begin-new').click();
    await p.waitForSelector('[data-testid=confirm-new-ask]');
    await sleep(500);
  } else if (state === 'continue') {
    await waitGuard(p, 'resume');
  } else {
    await waitGuard(p, 'start-birth');
  }
  return p;
}

const rect = (p) => p.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const r = (e) => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height }; };
  const car = q('[data-testid=carousel]');
  const side = q('.title__side');
  const ctrl = q('.carousel__ctrl');
  const next = q('[data-testid=carousel-next]');
  const bar = q('[data-testid=bottom-bar]');
  const foot = q('[data-testid=title-foot]');
  const nb = next.getBoundingClientRect();
  const cx = nb.left + nb.width / 2, cy = nb.top + nb.height / 2;
  const hit = document.elementFromPoint(cx, cy);
  return {
    car: r(car), side: side ? r(side) : r(car), sideInner: side ? { sh: side.scrollHeight, ch: side.clientHeight } : null, ctrl: r(ctrl), bar: r(bar), nextCenter: { x: cx, y: cy },
    hitOk: !!hit && (hit === next || next.contains(hit)),
    footDocTop: foot.getBoundingClientRect().top + scrollY,
    docH: document.documentElement.scrollHeight,
    sideScroll: side ? side.scrollTop : 0,
    scrollY: window.scrollY,
    count: q('[data-testid=carousel-count]').innerText.trim(),
  };
});

async function measureState(vp, state, positions) {
  const ctx = await mkctx(browser, { viewport: vp });
  const p = await openState(ctx, state);
  // 자동 전환은 끈다(일시정지) — 「다음」 클릭만으로 슬라이드를 넘긴다
  const maxScroll = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const rows = [];
  for (const posName of positions) {
    const y = posName === 'top' ? 0 : posName === 'y100' ? 100 : posName === 'mid' ? Math.round(maxScroll / 2) : posName === 'bottom' ? maxScroll : Number(posName);
    await p.evaluate((yy) => window.scrollTo(0, yy), y);
    await sleep(150);
    // 처음 슬라이드로: 필요하면 「이전」을 눌러 1/14로
    const series = [];
    for (let i = 0; i < 14; i++) {
      const m = await rect(p);
      series.push({ i, count: m.count, ctrlTop: m.ctrl.top, ctrlBottom: m.ctrl.bottom, carTop: m.car.top, carBottom: Math.min(m.car.bottom, m.side.bottom), innerScroll: !!(m.sideInner && m.sideInner.sh > m.sideInner.ch + 1), barTop: m.bar.top, footDocTop: m.footDocTop, docH: m.docH, hitOk: m.hitOk, sideScroll: m.sideScroll, scrollY: m.scrollY });
      // 「다음」 누르기 — 실제 마우스 클릭(좌표 한가운데)
      if (!m.hitOk) {
        series[series.length - 1].blocked = true;
      }
      await p.mouse.click(m.nextCenter.x, m.nextCenter.y);
      await sleep(130);
      // 클릭 직후 카드가 다른 위치로 튀지 않는지도 같이 본다(다음 루프에서 측정)
    }
    // 14번 눌렀으니 다시 1/14
    const fin = await rect(p);
    const ctrlTops = series.map((s) => s.ctrlTop);
    const carBottoms = series.map((s) => s.carBottom);
    const spread = (a) => Math.round((Math.max(...a) - Math.min(...a)) * 10) / 10;
    rows.push({
      pos: posName, scrollY: Math.round(series[0].scrollY),
      ctrlTopMin: Math.round(Math.min(...ctrlTops) * 10) / 10, ctrlTopMax: Math.round(Math.max(...ctrlTops) * 10) / 10, ctrlSpread: spread(ctrlTops),
      carTopSpread: spread(series.map((s) => s.carTop)),
      carBottomMax: Math.round(Math.max(...carBottoms)), barTop: Math.round(series[0].barTop), carBelowBar: carBottoms.filter((b, k) => b > series[k].barTop + 0.5).length,
      ctrlCovered: series.filter((s) => !s.hitOk).length, ctrlAboveScreen: series.filter((s) => s.ctrlTop < -0.5).length,
      footSpread: spread(series.map((s) => s.footDocTop)), docHSpread: spread(series.map((s) => s.docH)),
      sideScrollMax: Math.max(...series.map((s) => s.sideScroll)), innerScrollSlides: series.filter((s) => s.innerScroll).length,
      returned: fin.count,
    });
  }
  await ctx.close();
  return rows;
}

if (want('R01'))
  await runCase({ id: 'M2-R01', cat: '실측', title: 'R-220·R-200 실측 — 1280x800·1024x768 × 새 판·이어하기·확인 단계 × 스크롤 위치(맨 위·100·중간·맨 아래) × 「다음」 14번', steps: '위치마다 14장을 「다음」 마우스 클릭으로 넘기며 조작 줄 위끝·카드 아래끝·푸터 위치·문서 높이를 잰다. (이어하기·확인 단계는 prod에 도달 수단이 없어 개발 서버 ?__exit 탐침)', expected: '조작 줄 위끝 변화(ctrlSpread) 0px, ctrl.top ≥ 0(화면 위로 안 잘림), 카드 아래끝 ≤ 하단 띠 위끝(가림 0), 푸터·문서 높이 불변, 「다음」 버튼은 항상 눌림' }, async () => {
    const out = {};
    const problems = [];
    const shots = [];
    const lines = [];
    for (const [vname, vp] of [['1280x800', VP.d1280], ['1024x768', VP.d1024]]) {
      for (const state of ['new', 'continue', 'confirm']) {
        const rows = await measureState(vp, state, ['top', 'y100', 'mid', 'bottom']);
        out[`${vname}/${state}`] = rows;
        for (const r of rows) {
          const tag = `${vname}/${state}/${r.pos}(scrollY ${r.scrollY})`;
          lines.push(`${tag}: ctrl.top ${r.ctrlTopMin}~${r.ctrlTopMax}(변화 ${r.ctrlSpread}), 카드 아래끝 최대 ${r.carBottomMax} vs 띠 위끝 ${r.barTop}, 푸터 변화 ${r.footSpread}, 문서높이 변화 ${r.docHSpread}, 안쪽스크롤이 필요한 슬라이드 ${r.innerScrollSlides}장`);
          if (r.ctrlSpread > 0.6) problems.push(`${tag}: 조작 줄 위끝이 ${r.ctrlSpread}px 움직임`);
          if (r.ctrlTopMin < -0.5) problems.push(`${tag}: 조작 줄이 화면 위로 잘림 ${r.ctrlTopMin}`);
          if (r.carBelowBar) problems.push(`${tag}: 카드가 하단 띠 아래로 ${r.carBelowBar}장 (최대 ${r.carBottomMax} > ${r.barTop})`);
          if (r.ctrlCovered) problems.push(`${tag}: 「다음」 버튼이 가려져 ${r.ctrlCovered}번 눌리지 않음`);
          if (r.footSpread > 0.6 || r.docHSpread > 0.6) problems.push(`${tag}: 전환 때 푸터 ${r.footSpread}px·문서 ${r.docHSpread}px 움직임`);
          if (r.returned !== '1 / 14') problems.push(`${tag}: 14번 누른 뒤 ${r.returned}`);
        }
      }
    }
    fs.writeFileSync(path.join(OUT, 'r220.json'), JSON.stringify(out, null, 1));
    // 스크린샷: 맨 아래 위치 4장
    for (const [vname, vp] of [['1280x800', VP.d1280], ['1024x768', VP.d1024]]) {
      for (const state of ['new', 'continue']) {
        const ctx = await mkctx(browser, { viewport: vp });
        const p = await openState(ctx, state);
        await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await sleep(300);
        shots.push(await shot(p, 'R01', `${vname}-${state}-bottom`));
        await ctx.close();
      }
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? `${problems.length}건: ` + problems.slice(0, 6).join(' / ') : lines.slice(0, 6).join(' ; ') + ` … (전체 ${lines.length}행은 qa/results/m2/r220.json)`, shots };
  });

// ---------- R02 낮은 창(1280x620) — 안쪽 스크롤 ----------
if (want('R02'))
  await runCase({ id: 'M2-R02', cat: '실측', title: '낮은 데스크톱 창 1280x620 — 가장 큰 슬라이드의 카드가 띠에 가리지 않고 키보드로 끝까지 내릴 수 있는가 (R-224)', steps: '이어하기 상태에서 슬라이드 14장 × 맨 위·맨 아래 스크롤 위치의 카드 위·아래끝 측정 → 가장 긴 슬라이드에서 슬라이드 영역 포커스 → PageDown', expected: '카드 아래끝 ≤ 띠 위끝(또는 안쪽 스크롤로 끝에 닿음), 조작 줄은 안쪽 스크롤 전에 보임' }, async () => {
    const rows = await measureState(VP.d1280low, 'continue', ['top', 'bottom']);
    const lines = rows.map((r) => `${r.pos}: ctrl.top ${r.ctrlTopMin}~${r.ctrlTopMax}, 카드 아래끝 최대 ${r.carBottomMax} vs 띠 ${r.barTop}, 안쪽 스크롤 ${r.sideScrollMax}`);
    const problems = [];
    for (const r of rows) {
      if (r.ctrlTopMin < -0.5) problems.push(`${r.pos}: 조작 줄이 화면 위로 ${r.ctrlTopMin}`);
      if (r.carBelowBar) problems.push(`${r.pos}: 카드가 띠 아래로 ${r.carBelowBar}장 (안쪽 스크롤로 보완되는지는 아래 참고)`);
    }
    // 안쪽 스크롤: 가장 큰 슬라이드(지역 인구, 6번째)로 이동해 PageDown
    const ctx = await mkctx(browser, { viewport: VP.d1280low });
    const p = await openState(ctx, 'continue');
    await p.getByTestId('carousel-pause').click();
    for (let i = 0; i < 5; i++) { await p.getByTestId('carousel-next').click(); await sleep(130); }
    await sleep(300);
    const before = await p.evaluate(() => { const s = document.querySelector('.title__side'); return { sh: s.scrollHeight, ch: s.clientHeight, st: s.scrollTop }; });
    await p.getByTestId('carousel-viewport').focus();
    await p.keyboard.press('PageDown');
    await sleep(400);
    const after = await p.evaluate(() => { const s = document.querySelector('.title__side'); const foot = [...document.querySelectorAll('.slide.is-active .slide__meta')].pop().getBoundingClientRect(); const bar = document.querySelector('[data-testid=bottom-bar]').getBoundingClientRect(); const ctrl = document.querySelector('.carousel__ctrl').getBoundingClientRect(); return { st: s.scrollTop, lastLineBottom: Math.round(foot.bottom), barTop: Math.round(bar.top), ctrlTop: Math.round(ctrl.top) }; });
    const shots = [await shot(p, 'R02', 'after-pagedown')];
    await ctx.close();
    const innerOk = before.sh > before.ch && after.st > 0 && after.lastLineBottom <= after.barTop + 1;
    return { verdict: problems.length && !innerOk ? 'FAIL' : 'PASS', actual: `${lines.join(' ; ')} | 6번째 슬라이드: 안쪽 스크롤 영역 ${before.sh}/${before.ch} → PageDown 뒤 scrollTop ${after.st}, 「통계 기준」 줄 아래끝 ${after.lastLineBottom} ≤ 띠 ${after.barTop}, 이때 조작 줄 top ${after.ctrlTop}(머리가 함께 올라감 = 알려진 설계) ${problems.length ? '| 안쪽 스크롤 전 가림: ' + problems.join(' / ') : ''}`, shots };
  });

// ---------- D01 다크 번쩍임 ----------
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
  const t0 = Date.now();
  cdp.on('Page.screencastFrame', (f) => { frames.push({ t: Date.now() - t0, data: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 40, maxWidth: 180, maxHeight: 370, everyNthFrame: 1 });
  await p.goto(PROD, { waitUntil: 'commit' });
  await p.waitForSelector('[data-testid=title-screen],[data-testid=life-screen]', { timeout: 15000 });
  await sleep(600);
  const bodyBg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await cdp.send('Page.stopScreencast').catch(() => {});
  await ctx.close();
  const br = await meanBrightness(frames);
  return { n: frames.length, br, bodyBg };
}

if (want('D01'))
  await runCase({ id: 'M2-D01', cat: '실측', title: '다크 OS에서 prod 첫 화면 첫 그림(JS 전)이 밝게 번쩍이지 않는가 (R-223)', steps: 'prefers-color-scheme: dark로 prod 첫 로드: (a) JS를 1.5초 지연시켜 JS 전 구간의 실제 화면 프레임을 screencast로 캡처해 평균 밝기(0~255) 측정 (b) JS 전체 차단 시 body 바탕 (c) 라이트 OS 대조 (d) 저장된 판이 있는 옛 화면 새로고침(알려진 수용 범위)', expected: '다크 첫 화면은 모든 프레임이 어두움(평균 밝기 < 60), 라이트는 밝음, 번쩍임 0' }, async () => {
    const problems = [];
    const facts = [];
    const shots = [];
    const dark = await captureLoad('dark', null, 1500);
    const maxDark = Math.max(...dark.br.map((b) => b.y));
    facts.push(`다크 첫 로드(JS 1.5초 지연): 프레임 ${dark.n}개, 평균 밝기 ${dark.br.map((b) => `${b.t}ms:${b.y}`).join(' ')}, 최종 바탕 ${dark.bodyBg}`);
    if (!dark.n) problems.push('프레임을 캡처하지 못함');
    if (maxDark > 60) problems.push(`다크 첫 로드에 밝은 프레임(최대 ${maxDark})`);
    const light = await captureLoad('light', null, 1500);
    const minLight = Math.min(...light.br.map((b) => b.y));
    facts.push(`라이트 대조: 프레임 ${light.n}개, 최소 밝기 ${minLight}`);
    if (minLight < 150) problems.push(`라이트 첫 로드에 어두운 프레임(최소 ${minLight})`);
    // JS 차단
    for (const scheme of ['dark', 'light']) {
      const ctx = await browser.newContext({ viewport: VP.m360, colorScheme: scheme });
      const p = await ctx.newPage();
      await p.route('**/*.js', (r) => r.abort());
      await p.goto(PROD, { waitUntil: 'load' });
      await sleep(300);
      const bg = await p.evaluate(() => ({ body: getComputedStyle(document.body).backgroundColor, html: getComputedStyle(document.documentElement).backgroundColor }));
      shots.push(await shot(p, 'D01', `nojs-${scheme}`));
      facts.push(`JS 차단 ${scheme}: body ${bg.body}`);
      if (scheme === 'dark' && !/rgb\(20, 23, 31\)/.test(bg.body)) problems.push(`JS 차단 다크 바탕 ${bg.body}`);
      if (scheme === 'light' && !/rgb\(246, 243, 236\)/.test(bg.body)) problems.push(`JS 차단 라이트 바탕 ${bg.body}`);
      await ctx.close();
    }
    // 옛 화면 새로고침(다크 OS) — 알려진 수용 범위: 짧은 다크
    const legacy = await captureLoad('dark', LIFE_V5, 1500);
    facts.push(`참고(수용 범위) 옛 인생 화면 새로고침, 다크 OS: 프레임 밝기 ${legacy.br.map((b) => `${b.t}ms:${b.y}`).join(' ')}`);
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: (problems.length ? problems.join(' / ') + ' || ' : '') + facts.join(' | '), shots };
  });


// ---------- R03 실제 자동 전환(7초) 동안 조작 줄·푸터가 움직이는가 ----------
if (want('R03'))
  await runCase({ id: 'M2-R03', cat: '실측', title: '자동 전환 7초가 돌아가는 동안 조작 줄·카드·푸터 위치가 변하는가 (R-220) — 1280x800·1024x768, 맨 위·맨 아래', steps: 'prod 새 판에서 스크롤 위치를 고정하고 마우스를 카드 밖에 둔 채 프레임마다(rAF) 조작 줄 위끝·푸터 문서 위치·문서 높이를 36초 동안 기록(전환 5회 이상)', expected: '조작 줄 위끝·푸터·문서 높이의 변화 0px(1px 미만)' }, async () => {
    const problems = [];
    const lines = [];
    const shots03 = [];
    for (const [vname, vp] of [['1280x800', VP.d1280], ['1024x768', VP.d1024]]) {
      for (const pos of ['top', 'bottom']) {
        const ctx = await mkctx(browser, { viewport: vp });
        const p = await openState(ctx, 'new');
        await p.mouse.move(2, 2);
        const y = pos === 'top' ? 0 : await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
        await p.evaluate((yy) => window.scrollTo(0, yy), y);
        await sleep(300);
        await p.evaluate(() => {
          window.__s = { ctrl: [], foot: [], doc: [], card: [], counts: new Set() };
          const tick = () => {
            const c = document.querySelector('.carousel__ctrl').getBoundingClientRect();
            const cardTop = document.querySelector('[data-testid=carousel]').getBoundingClientRect().top;
            const f = document.querySelector('[data-testid=title-foot]').getBoundingClientRect().top + scrollY;
            window.__s.ctrl.push(c.top); window.__s.card.push(cardTop); window.__s.foot.push(f); window.__s.doc.push(document.documentElement.scrollHeight);
            window.__s.counts.add(document.querySelector('[data-testid=carousel-count]').innerText.trim());
            window.__s.id = requestAnimationFrame(tick);
          };
          tick();
        });
        await sleep(36000);
        const s = await p.evaluate(() => { cancelAnimationFrame(window.__s.id); const sp = (a) => Math.round((Math.max(...a) - Math.min(...a)) * 10) / 10; return { frames: window.__s.ctrl.length, ctrl: sp(window.__s.ctrl), card: sp(window.__s.card), foot: sp(window.__s.foot), doc: sp(window.__s.doc), slides: [...window.__s.counts].length }; });
        if (pos === 'bottom') shots03.push(await shot(p, 'R03', `${vname}-bottom`));
        lines.push(`${vname}/${pos}: 프레임 ${s.frames}, 슬라이드 ${s.slides}장 지나감, 조작 줄 변화 ${s.ctrl}px, 카드 위끝 변화 ${s.card}px, 푸터 변화 ${s.foot}px, 문서 높이 변화 ${s.doc}px`);
        if (s.slides < 5) problems.push(`${vname}/${pos}: 자동 전환이 5장 미만(${s.slides})`);
        if (s.ctrl > 1 || s.card > 1 || s.foot > 1 || s.doc > 1) problems.push(`${vname}/${pos}: 전환 중 위치가 움직임 ${JSON.stringify(s)}`);
        await ctx.close();
      }
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : lines.join(' ; '), shots: shots03 };
  });

// ---------- R04 맨 아래 스크롤에서 푸터 마지막 줄이 하단 띠(상태별 높이)에 가리지 않는가 (R-203) ----------
if (want('R04'))
  await runCase({ id: 'M2-R04', cat: '실측', title: '맨 아래까지 내렸을 때 푸터 마지막 줄·캐러셀이 하단 띠에 가리지 않는가 — 새 판·이어하기·확인 단계 × 4 뷰포트 (R-203)', steps: '360x740·320x568·1280x800·1024x768에서 상태 3종(이어하기·확인 단계는 개발 서버 ?__exit 탐침)의 맨 아래 스크롤 위치에서 푸터 마지막 줄 아래끝과 띠 위끝을 잼', expected: '푸터 마지막 줄 아래끝 ≤ 띠 위끝(가림 0), 띠 높이가 상태마다 달라도 여백이 따라감' }, async () => {
    const problems = [];
    const lines = [];
    const shots = [];
    for (const [vname, vp] of [['360x740', VP.m360], ['320x568', VP.m320], ['1280x800', VP.d1280], ['1024x768', VP.d1024]]) {
      for (const state of ['new', 'continue', 'confirm']) {
        const ctx = await mkctx(browser, { viewport: vp });
        const p = await openState(ctx, state);
        await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await sleep(300);
        const r = await p.evaluate(() => {
          const last = [...document.querySelectorAll('[data-testid=title-foot] p')].pop().getBoundingClientRect();
          const bar = document.querySelector('[data-testid=bottom-bar]').getBoundingClientRect();
          return { footBottom: Math.round(last.bottom), barTop: Math.round(bar.top), barH: Math.round(bar.height) };
        });
        lines.push(vname + '/' + state + ': 푸터 아래끝 ' + r.footBottom + ' vs 띠 위끝 ' + r.barTop + ' (띠 ' + r.barH + 'px)');
        if (r.footBottom > r.barTop + 0.5) problems.push(vname + '/' + state + ': 푸터 마지막 줄이 띠에 ' + (r.footBottom - r.barTop) + 'px 가림');
        if (vname === '360x740' && state !== 'new') shots.push(await shot(p, 'R04', vname + '-' + state + '-bottom'));
        if (vname === '360x740' && state === 'new') shots.push(await shot(p, 'R04', vname + '-new-bottom'));
        await ctx.close();
      }
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : lines.join(' ; '), shots };
  });

await browser.close();
