// QA-003 M3 정상 플로우(N01~N12). 사용: node qa/scripts/m3-normal.mjs [케이스ID,...]
import { launch, mkctx, fixSeed, installRouletteProbe, getProbe, runCase, shot, openTitle, waitGuard, pickEra, toRoulette, readRoulette, readBirth, skipToBirth, birthToLife, saveJson, overflowX, lifeInfo, driveLife, setSpeed, whichScreen, bodyText, VP, TOUCH, PROD, DEV, sleep, GAME_KEY } from './m3-lib.mjs';

const browser = await launch();
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);
const ERA_LABEL = { past: '지난 세상', present: '지금 세상', future: '다가올 세상' };
const SEEDS = { past: 31, present: 4242, future: 77 };
const ok = (c, msg, arr) => (c ? null : arr.push(msg));

/** 로고(헤더) 크기 */
const logoInfo = (page) =>
  page.evaluate(() => {
    const w = document.querySelector('[data-testid="header-logo"]');
    const svg = w?.querySelector('svg');
    const r = (svg || w)?.getBoundingClientRect();
    return { present: !!w, h: r ? Math.round(r.height) : 0, w: r ? Math.round(r.width) : 0, label: svg?.getAttribute('aria-label') || svg?.querySelector('title')?.textContent || w?.getAttribute('aria-label') || null, headText: document.querySelector('[data-testid="site-head"]')?.textContent.trim() };
  });

// ---------- N01: 세 세상 정상 플로우 (모바일 360×740 터치) ----------
for (const era of ['present', 'past', 'future']) {
  const id = `M3-N01-${era}`;
  if (!want('N01') && !want(id)) continue;
  await runCase(
    { id, cat: '정상', title: `${ERA_LABEL[era]} 전 과정: 첫 화면→태어나기→룰렛→결과→출생신고→살아가기→인생 (360x740 터치, prod)`, steps: `prod 360x740 터치, 시드 ${SEEDS[era]} 고정. ${era === 'present' ? '' : ERA_LABEL[era] + ' 카드 선택 → '}태어나기 → 룰렛 회전 관찰(스크린샷 2장) → 결과 → 출생신고 보기 → 출생신고 상·전체 → 살아가기 → 인생 화면`, expected: '룰렛이 돌고 결과 문구가 나오며, 출생신고에 모든 항목이 있고, 살아가기로 인생 화면에 이름이 이어진다. 저장은 단계마다 맞다' },
    async () => {
      const shots = [];
      const bad = [];
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await fixSeed(ctx, SEEDS[era]);
      await installRouletteProbe(ctx);
      const p = await ctx.newPage();
      await openTitle(p);
      if (era !== 'present') await pickEra(p, era);
      shots.push(await shot(p, 'N01', `${era}-1-title`));
      await waitGuard(p, 'start-birth');
      await p.getByTestId('start-birth').click();
      await p.waitForSelector('[data-testid="roulette-screen"]', { timeout: 5000 });
      await sleep(1500);
      const mid = await readRoulette(p);
      shots.push(await shot(p, 'N01', `${era}-2-roulette-spinning`));
      ok(mid.state === 'spinning', `1.5초에 회전 중이 아님(${mid.state})`, bad);
      ok(mid.btn === 'skip' && mid.btnText === '건너뛰기', `회전 중 버튼 ${mid.btnText}`, bad);
      ok(mid.heading === '태어날 집과 땅을 고르는 중', `회전 중 제목 ${mid.heading}`, bad);
      await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 8000 });
      await sleep(250);
      const done = await readRoulette(p);
      shots.push(await shot(p, 'N01', `${era}-3-roulette-result`));
      const probe = await getProbe(p);
      ok(done.heading === '태어날 곳이 정해졌습니다', `결과 제목 ${done.heading}`, bad);
      ok(done.btn === 'to-birth' && done.btnText === '출생신고 보기', `결과 버튼 ${done.btnText}`, bad);
      ok(!!done.wealthResult && !!done.regionResult, '릴 결과 칸 없음', bad);
      ok(done.status?.startsWith(done.wealthResult), `상태 문구 ${done.status} vs ${done.wealthResult}`, bad);
      const sv1 = await saveJson(p);
      ok(sv1?.data?.phase === 'roulette', `저장 phase ${sv1?.data?.phase}`, bad);
      await waitGuard(p, 'to-birth');
      await p.getByTestId('to-birth').click();
      await p.waitForSelector('[data-testid="birth-screen"]', { timeout: 5000 });
      await sleep(300);
      const b = await readBirth(p);
      const logo = await logoInfo(p);
      shots.push(await shot(p, 'N01', `${era}-4-birth-top`));
      shots.push(await shot(p, 'N01', `${era}-5-birth-full`, { full: true }));
      ok(b.heading === '출생 신고', `출생신고 제목 ${b.heading}`, bad);
      ok(logo.present && logo.h >= 22, `헤더 로고 높이 ${logo.h}px (<22) 또는 없음`, bad);
      ok(logo.headText?.includes('출생'), `헤더 화면 이름 ${logo.headText}`, bad);
      ok(b.fields.wealth?.value.startsWith(done.wealthResult), `집안 형편 ${b.fields.wealth?.value} vs ${done.wealthResult}`, bad);
      const sv2 = await saveJson(p);
      ok(sv2?.data?.phase === 'birth', `저장 phase ${sv2?.data?.phase}`, bad);
      const ov = await overflowX(p);
      ok(!ov.overflow, `가로 넘침 ${ov.scrollW}>${ov.clientW}`, bad);
      await waitGuard(p, 'next-life');
      await p.getByTestId('next-life').click();
      await p.waitForSelector('[data-testid="life-screen"]', { timeout: 6000 });
      await sleep(400);
      const li = await lifeInfo(p);
      shots.push(await shot(p, 'N01', `${era}-6-life`));
      ok(li.name === b.name, `인생 화면 이름 ${li.name} ≠ 출생신고 이름 ${b.name}`, bad);
      const logText = await p.evaluate(() => document.querySelector('[data-testid="log"]')?.innerText ?? '');
      ok(logText.includes(b.sentence?.slice(0, 20) ?? '###'), `인생 기록 첫 줄에 출생신고 서술문 없음: ${logText.slice(0, 100)}`, bad);
      const sv3 = await saveJson(p);
      ok(sv3?.data?.phase === 'life', `저장 phase ${sv3?.data?.phase}`, bad);
      await ctx.close();
      return {
        verdict: bad.length ? 'FAIL' : 'PASS',
        severity: bad.length ? '중간' : undefined,
        actual: bad.length ? bad.join(' / ') : `룰렛 ${done.status} → 출생신고 이름 ${b.name}·${b.fields.place?.value}·${b.fields.wealth?.value} → 인생 ${li.name}(${li.age}세), 로고 ${logo.h}px, 저장 roulette→birth→life`,
        shots,
      };
    },
  );
}

// ---------- N02: 룰렛 시간·정지 순서 (지역 먼저, 수저 마지막, 총 4~6초) ----------
if (want('N02')) {
  await runCase(
    { id: 'M3-N02', cat: '정상', title: '룰렛 연출 시간: 지역 릴 먼저 정지, 수저 릴 마지막, 총 4~6초 (세 세상 × 모바일·데스크톱 × 3판)', steps: '「태어나기」 클릭 시각부터 릴 data-state가 stopped로 바뀌는 시각을 MutationObserver로 잰다. 세 세상 × (360x740 터치·1280x800) × 시드 3개', expected: '지역 릴 정지 < 수저 릴 정지, 수저 릴 정지 4.0~6.0초, 결과 상태(제목·버튼)로 바뀌는 시각도 같다' },
    async () => {
      const rows = [];
      const bad = [];
      for (const era of ['present', 'past', 'future'])
        for (const vp of [{ n: 'm360', v: VP.m360, t: TOUCH }, { n: 'd1280', v: VP.d1280, t: {} }])
          for (const seed of [11, 222, 3333]) {
            const ctx = await mkctx(browser, { viewport: vp.v, ...vp.t });
            await fixSeed(ctx, seed);
            await installRouletteProbe(ctx);
            const p = await ctx.newPage();
            await openTitle(p);
            await toRoulette(p, era);
            await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 9000 });
            const pr = await getProbe(p);
            const stop = (id) => pr.events.find((e) => e.id === id && e.state === 'stopped')?.t ?? null;
            const res = pr.events.find((e) => e.id === 'roulette-screen' && e.state === 'result')?.t ?? null;
            rows.push({ era, vp: vp.n, seed, region: stop('reel-region'), wealth: stop('reel-wealth'), result: res, maxGap: Math.round(pr.maxGap) });
            if (!(stop('reel-region') < stop('reel-wealth'))) bad.push(`${era}/${vp.n}/${seed}: 지역(${stop('reel-region')}) ≥ 수저(${stop('reel-wealth')})`);
            if (!(stop('reel-wealth') >= 4000 && stop('reel-wealth') <= 6000)) bad.push(`${era}/${vp.n}/${seed}: 수저 정지 ${stop('reel-wealth')}ms (4~6초 밖)`);
            await ctx.close();
          }
      const w = rows.map((r) => r.wealth);
      const g = rows.map((r) => r.region);
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: bad.length ? '중간' : undefined, actual: bad.length ? bad.join(' / ') : `18회 — 지역 릴 정지 ${Math.min(...g)}~${Math.max(...g)}ms, 수저 릴 정지 ${Math.min(...w)}~${Math.max(...w)}ms(항상 지역이 먼저), 결과 상태 전환 ${Math.min(...rows.map((r) => r.result))}~${Math.max(...rows.map((r) => r.result))}ms`, note: JSON.stringify(rows), shots: [] };
    },
  );
}

// ---------- N03: 왕복 순서 — 정지 직전 칸이 이웃 단계 (5단계 모두) ----------
if (want('N03')) {
  await runCase(
    { id: 'M3-N03', cat: '정상', title: '수저 릴 왕복 순서: 칸이 흙→동→은→금→다이아→금→은→동 순으로 지나가고, 정지 직전 칸은 늘 이웃 단계(5개 결과 모두)', steps: '시드를 바꿔 수저 5단계 결과를 각각 만들고, 릴 가운데 칸을 rAF마다 기록해 지나간 칸 순서와 정지 직전 칸을 본다', expected: '지나간 칸 순서가 왕복 순서를 어기지 않고, 정지 직전 칸이 결과와 한 단계 차이. 흙수저 결과 직전에 다이아몬드수저가 지나가지 않는다' },
    async () => {
      const TIER = { 흙수저: 1, 동수저: 2, 은수저: 3, 금수저: 4, 다이아몬드수저: 5 };
      const NAMES = Object.keys(TIER);
      const bad = [];
      const got = {};
      const shots = [];
      const rows = [];
      for (let seed = 1; seed < 400 && Object.keys(got).length < 5; seed++) {
        const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
        await fixSeed(ctx, seed);
        await installRouletteProbe(ctx);
        const p = await ctx.newPage();
        await openTitle(p);
        await toRoulette(p, 'present');
        await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 9000 });
        const pr = await getProbe(p);
        const res = await readRoulette(p);
        const tier = TIER[res.wealthResult];
        if (!got[tier]) {
          got[tier] = seed;
          const seq = pr.seq.wealth.map((s) => s.text);
          const tiers = seq.map((t) => TIER[t]);
          // 이웃 칸 단계 차이는 늘 1이어야 한다(왕복 순서)
          const jumps = tiers.slice(1).map((t, i) => Math.abs(t - tiers[i]));
          const nonAdj = jumps.filter((j) => j !== 1).length;
          // 정지 직전 칸 = 마지막에서 두 번째로 가운데를 지난 칸
          const prev = tiers[tiers.length - 2];
          rows.push({ tier: res.wealthResult, seed, cells: tiers.length, nonAdj, prev: NAMES[prev - 1], last: NAMES[tiers[tiers.length - 1] - 1] });
          if (nonAdj > 0) bad.push(`${res.wealthResult}: 이웃이 아닌 칸 이동 ${nonAdj}번 (${seq.slice(-8).join('→')})`);
          if (Math.abs(prev - tier) !== 1) bad.push(`${res.wealthResult}: 정지 직전 칸 ${NAMES[prev - 1]}(단계 차 ${Math.abs(prev - tier)})`);
          if (tiers[tiers.length - 1] !== tier) bad.push(`${res.wealthResult}: 마지막 가운데 칸 ${NAMES[tiers[tiers.length - 1] - 1]} ≠ 결과`);
          // 꺼내 보기 위한 직전 칸 시점의 스크린샷은 어려우니 결과 화면을 남긴다
          shots.push(await shot(p, 'N03', `tier${tier}-${res.wealthResult}`));
        }
        await ctx.close();
      }
      if (Object.keys(got).length < 5) bad.push(`5단계를 다 얻지 못함: ${JSON.stringify(got)}`);
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: bad.length ? '낮음' : undefined, actual: bad.length ? bad.join(' / ') : `5단계 모두 확인(시드 ${JSON.stringify(got)}): ` + rows.map((r) => `${r.tier} 직전 ${r.prev}`).join(', ') + ' — 이웃 아닌 이동 0', note: JSON.stringify(rows), shots };
    },
  );
}

// ---------- N04: 확률표 합·표기 ----------
if (want('N04')) {
  await runCase(
    { id: 'M3-N04', cat: '정상', title: '확률표: 수저 합 100·지역 합 100.0, 설계값·기준 연도·출처 표기 (세 세상)', steps: '세 세상 각각 룰렛 화면의 두 확률표 값을 읽어 합을 구하고 주석 문구를 본다', expected: '수저 정수 % 합 100, 지역 소수 1자리 합 100.0(지난 세상 칸 수 10~15, 지금·다가올 16), 「게임의 설계값(통계가 아님)」, 지역 주석에 기준 연도·출처(지난·다가올은 설계값 고지)' },
    async () => {
      const bad = [];
      const info = [];
      const shots = [];
      for (const era of ['present', 'past', 'future']) {
        const ctx = await mkctx(browser, { viewport: VP.d1280 });
        await fixSeed(ctx, SEEDS[era]);
        const p = await ctx.newPage();
        await openTitle(p);
        await toRoulette(p, era);
        await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 9000 });
        const r = await readRoulette(p);
        const ws = r.wealthOdds.reduce((a, o) => a + o.pct, 0);
        const rs = r.regionOdds.reduce((a, o) => a + Math.round(o.pct * 10), 0);
        info.push(`${era}: 수저 ${r.wealthOdds.map((o) => o.pct).join('/')}=${ws}, 지역 ${r.regionOdds.length}칸 합 ${rs / 10}`);
        ok(Math.round(ws) === 100, `${era} 수저 합 ${ws}`, bad);
        ok(rs === 1000, `${era} 지역 합 ${rs / 10}`, bad);
        ok(r.wealthNote?.includes('설계값') && r.wealthNote.includes('통계가 아님'), `${era} 수저 주석 ${r.wealthNote}`, bad);
        ok(/\d{4}년/.test(r.regionNote ?? ''), `${era} 지역 주석에 기준 연도 없음: ${r.regionNote}`, bad);
        if (era === 'present') ok(r.regionOdds.length === 16 && /국가데이터처/.test(r.regionNote ?? ''), `present 칸 ${r.regionOdds.length} / ${r.regionNote}`, bad);
        else ok(/설계값/.test(r.regionNote ?? ''), `${era} 지역 주석에 설계값 고지 없음: ${r.regionNote}`, bad);
        if (era === 'past') ok(r.regionOdds.length >= 10 && r.regionOdds.length <= 15, `past 지역 칸 ${r.regionOdds.length}`, bad);
        if (era === 'future') ok(r.regionOdds.length === 16, `future 지역 칸 ${r.regionOdds.length}`, bad);
        info.push(`  주석(${era}): ${r.regionNote}`);
        shots.push(await shot(p, 'N04', `${era}-odds-desktop`));
        await ctx.close();
      }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: bad.length ? '중간' : undefined, actual: bad.length ? bad.join(' / ') : info.join(' | '), shots };
    },
  );
}

// ---------- N05: 건너뛰기 ----------
if (want('N05')) {
  await runCase(
    { id: 'M3-N05', cat: '정상', title: '「건너뛰기」: 회전 중 누르면 곧바로 결과 상태, 결과는 같다', steps: '회전 1.2초에 「건너뛰기」 → 결과 화면. 같은 시드에서 끝까지 기다린 결과와 비교', expected: '건너뛰기 직후 결과 상태(제목·버튼 「출생신고 보기」), 수저·지역 결과가 끝까지 기다린 경우와 같다', },
    async () => {
      const bad = [];
      const shots = [];
      const results = [];
      for (const wait of [true, false]) {
        const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
        await fixSeed(ctx, 555);
        const p = await ctx.newPage();
        await openTitle(p);
        await toRoulette(p, 'present');
        if (wait) await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 9000 });
        else {
          await sleep(1200);
          await waitGuard(p, 'skip-roulette');
          await p.getByTestId('skip-roulette').click();
          await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 1500 });
          shots.push(await shot(p, 'N05', 'after-skip'));
        }
        const r = await readRoulette(p);
        results.push(`${r.wealthResult}/${r.regionResult}`);
        ok(r.heading === '태어날 곳이 정해졌습니다' && r.btn === 'to-birth', `건너뛰기 결과 ${r.heading}/${r.btn}`, bad);
        await ctx.close();
      }
      ok(results[0] === results[1], `결과 불일치 ${results.join(' vs ')}`, bad);
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : `끝까지 ${results[0]} = 건너뛰기 ${results[1]}`, shots };
    },
  );
}

// ---------- N06: 움직임 줄이기 ----------
if (want('N06')) {
  await runCase(
    { id: 'M3-N06', cat: '정상', title: '움직임 줄이기(prefers-reduced-motion): 회전 없이 결과 + 안내 한 줄', steps: 'reducedMotion=reduce로 태어나기 → 곧바로 결과. 릴 정지 상태·안내 문구·「건너뛰기」 없음·같은 자리 「출생신고 보기」. 360·1280', expected: '회전 단계 없이 결과 상태, 안내 「움직임 줄이기가 켜져 있어 …」, 릴 data-state=stopped', },
    async () => {
      const bad = [];
      const shots = [];
      for (const [n, vp, t] of [['m360', VP.m360, TOUCH], ['d1280', VP.d1280, {}]]) {
        const ctx = await mkctx(browser, { viewport: vp, reducedMotion: 'reduce', ...t });
        await fixSeed(ctx, 4242);
        await installRouletteProbe(ctx);
        const p = await ctx.newPage();
        await openTitle(p);
        await waitGuard(p, 'start-birth');
        await p.getByTestId('start-birth').click();
        await p.waitForSelector('[data-testid="roulette-screen"]', { timeout: 5000 });
        await sleep(120);
        const r = await readRoulette(p);
        const pr = await getProbe(p);
        shots.push(await shot(p, 'N06', `reduced-${n}`));
        ok(r.state === 'result', `${n} 상태 ${r.state}`, bad);
        ok(r.motionNote?.includes('움직임 줄이기가 켜져 있어'), `${n} 안내 문구 ${r.motionNote}`, bad);
        ok(r.btn === 'to-birth', `${n} 버튼 ${r.btn}`, bad);
        ok(r.wealthReel === 'stopped' && r.regionReel === 'stopped', `${n} 릴 상태 ${r.wealthReel}/${r.regionReel}`, bad);
        const spun = pr.events.filter((e) => e.state === 'spinning');
        ok(spun.length === 0, `${n} 회전 기록 ${spun.length}건`, bad);
        ok(pr.seq.wealth.length <= 1, `${n} 수저 릴 가운데 칸이 바뀐 횟수 ${pr.seq.wealth.length}`, bad);
        await ctx.close();
      }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : '두 폭 모두 회전 기록 0, 안내 한 줄, 릴 정지, 「출생신고 보기」', shots };
    },
  );
}

await browser.close();
