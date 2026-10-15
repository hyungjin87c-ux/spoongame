// 공격 #1/#4/#11: 화면 전환 버튼 더블탭·3연탭(좌/중/우), 이어하기 더블탭, 선택지 연타, 배속·자동 연타.
import { DEV, GAME_KEY, SETTINGS_KEY, launch, mkctx, runCase, shot, snap, toBirth, toLife, waitScreen, readSave, readSettings, sleep, con } from './lib.mjs';

const G = 'a-rapid';
const VPS = [
  [360, 480],
  [360, 568],
  [360, 640],
  [360, 740],
  [667, 375],
];
const only = process.argv[2]; // 선택 실행: T1|T2|T3|T3S|T4|CH|SPD|AUTO
const browser = await launch();

const REC = () => {
  window.__clicks = [];
  document.addEventListener(
    'click',
    (e) => {
      const b = e.target instanceof Element ? e.target.closest('button') : null;
      const name = b ? b.dataset.testid || (b.dataset.speed ? `speed-${b.dataset.speed}` : b.textContent.trim().slice(0, 14)) : `비버튼:${e.target.tagName}`;
      window.__clicks.push(b && b.getAttribute('aria-disabled') === 'true' ? `${name}(가드)` : name);
    },
    true,
  );
};

async function mk(vp, { touch = true, settings = null, query = '' } = {}) {
  const ctx = await mkctx(browser, { viewport: { width: vp[0], height: vp[1] }, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  await page.addInitScript(REC);
  if (settings) {
    await page.addInitScript(([k, v]) => { if (location.protocol === 'about:') return; if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, [SETTINGS_KEY, JSON.stringify({ version: 1, data: settings })]);
  }
  await page.goto(DEV + '/' + query);
  return { ctx, page };
}

async function burst(page, box, xf, n, gap, touch) {
  const x = box.x + box.width * xf;
  const y = box.y + box.height / 2;
  for (let i = 0; i < n; i++) {
    if (touch) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    if (gap && i < n - 1) await sleep(gap);
  }
  return { x: Math.round(x), y: Math.round(y) };
}

const clicks = (page) => page.evaluate(() => window.__clicks.slice());
const VARIANTS = [
  { xf: 0.5, n: 3, gap: 0, touch: true, label: '터치 3연탭 중앙' },
  { xf: 0.06, n: 3, gap: 0, touch: true, label: '터치 3연탭 좌측' },
  { xf: 0.94, n: 3, gap: 0, touch: true, label: '터치 3연탭 우측' },
  { xf: 0.5, n: 2, gap: 150, touch: true, label: '터치 더블탭 150ms' },
  { xf: 0.5, n: 2, gap: 0, touch: false, label: '마우스 더블클릭 중앙' },
];

/** 한 전환 단계의 버튼 연타 검증. prepare(page) -> 버튼 locator 와 '이 화면에 머물러야 하는지/다음 화면 기대' 판정 */
async function transitionCase({ id, title, vp, prepare, expectScreen, check, settings }) {
  return runCase(G, { id, cat: '#1 더블탭', title, steps: `${vp[0]}x${vp[1]}에서 버튼의 중앙·좌·우를 3연탭/더블탭/150ms 더블탭/마우스 더블클릭. 둘째 이후 입력이 새 화면 컨트롤에 닿는지 클릭 기록으로 확인`, expected: '첫 입력만 반영. 새 화면의 버튼은 약 0.4초간 입력 무시(가드 표시), 속도·자동·나이·선택 불변' }, async () => {
    const fails = [];
    const details = [];
    let lastShot = null;
    for (const v of VARIANTS) {
      const { ctx, page } = await mk(vp, { touch: v.touch, settings });
      try {
        const btn = await prepare(page);
        await sleep(650);
        await btn.scrollIntoViewIfNeeded();
        const box = await btn.boundingBox();
        const before = await snap(page);
        await page.evaluate(() => (window.__clicks = []));
        const pos = await burst(page, box, v.xf, v.n, v.gap, v.touch);
        await sleep(120);
        const after = await snap(page);
        const cl = await clicks(page);
        const bad = cl.slice(1).filter((c) => !c.endsWith('(가드)') && !c.startsWith('비버튼'));
        const verdict = check(before, after, cl, bad);
        details.push(`${v.label}@(${pos.x},${pos.y}) 클릭기록=[${cl.join(',')}] 화면=${after.screen} 속도=${after.speed} 자동=${after.auto} 나이=${after.age}`);
        if (verdict) fails.push(`${v.label}: ${verdict}`);
        if (v.xf === 0.5 && v.touch && v.n === 3) lastShot = await shot(page, id);
        await sleep(300);
      } catch (e) {
        fails.push(`${v.label}: 오류 ${e.message.slice(0, 120)}`);
      } finally {
        await ctx.close();
      }
    }
    return { verdict: fails.length ? 'FAIL' : 'PASS', actual: fails.length ? `실패 ${fails.join(' / ')} :: ${details.join(' | ')}` : `5개 변형 모두 이상 없음. ${details.slice(0, 2).join(' | ')} …`, shots: lastShot ? [lastShot] : [] };
  });
}

let idx = 1;
const nextId = (p) => `M3-${p}${String(idx++).padStart(2, '0')}`;
let aIdx = 1;
const aId = () => `M3-A${String(aIdx++).padStart(2, '0')}`;

// T1: 타이틀 시작 → 시대 선택
if (!only || only === 'T1') {
  for (const vp of VPS) {
    await transitionCase({
      id: aId(),
      title: `타이틀 "시작" 연타 ${vp[0]}x${vp[1]} (시대 선택 화면으로)`,
      vp,
      prepare: async (page) => {
        await waitScreen(page, 'title-screen');
        return page.getByRole('button', { name: '시작' });
      },
      check: (b, a, cl, bad) => (a.screen !== 'era-screen' ? `시대 선택 화면에 머물지 않음(${a.screen})` : bad.length ? `가드 없는 둘째 클릭 ${bad.join(',')}` : null),
    });
  }
}
aIdx = Math.max(aIdx, 6);
if (!only || only === 'T2') {
  for (const vp of VPS) {
    await transitionCase({
      id: aId(),
      title: `시대 선택 "이 세상에서 태어나기" 연타 ${vp[0]}x${vp[1]} (출생 화면으로)`,
      vp,
      prepare: async (page) => {
        await waitScreen(page, 'title-screen');
        await page.getByRole('button', { name: '시작' }).click();
        await waitScreen(page, 'era-screen');
        return page.getByTestId('confirm-era');
      },
      check: (b, a, cl, bad) => (a.screen !== 'birth-screen' ? `출생 화면에 머물지 않음(${a.screen})` : bad.length ? `가드 없는 둘째 클릭 ${bad.join(',')}` : null),
    });
  }
}
aIdx = Math.max(aIdx, 11);
if (!only || only === 'T3') {
  for (const vp of VPS) {
    await transitionCase({
      id: aId(),
      title: `출생 "살아가기" 연타 ${vp[0]}x${vp[1]} (기본 설정 1배·자동 꺼짐)`,
      vp,
      prepare: async (page) => {
        await toBirth(page, 'present');
        return page.getByTestId('next-life');
      },
      check: (b, a, cl, bad) =>
        a.screen !== 'life-screen' ? `인생 화면에 닿지 않음(${a.screen})` : a.speed !== '1' || a.auto !== 'false' ? `속도/자동이 바뀜(속도 ${a.speed}, 자동 ${a.auto})` : a.age !== '0세' ? `나이가 바뀜 ${a.age}` : bad.length ? `가드 없는 둘째 클릭 ${bad.join(',')}` : null,
    });
  }
}
aIdx = Math.max(aIdx, 16);
if (!only || only === 'T3S') {
  for (const vp of VPS) {
    await transitionCase({
      id: aId(),
      title: `출생 "살아가기" 연타 ${vp[0]}x${vp[1]} (저장된 설정 8배·자동 켜짐)`,
      vp,
      settings: { speed: 8, autoMode: true },
      prepare: async (page) => {
        await toBirth(page, 'present');
        return page.getByTestId('next-life');
      },
      check: (b, a, cl, bad) =>
        a.screen !== 'life-screen' ? `인생 화면에 닿지 않음(${a.screen})` : a.speed !== '8' || a.auto !== 'true' ? `속도/자동이 바뀜(속도 ${a.speed}, 자동 ${a.auto})` : bad.length ? `가드 없는 둘째 클릭 ${bad.join(',')}` : null,
    });
  }
}
aIdx = Math.max(aIdx, 21);

// T4: "이 탭에서 이어하기" 연타 (다른 탭이 저장을 바꾼 상황)
if (!only || only === 'T4') {
  for (const settings of [null, { speed: 8, autoMode: true }]) {
    for (const vp of VPS) {
      await runCase(G, { id: aId(), cat: '#1 더블탭', title: `"이 탭에서 이어하기" 연타 ${vp[0]}x${vp[1]} (${settings ? '8배·자동 켜짐 저장' : '기본 설정'})`, steps: '탭 A를 인생 화면까지 → 탭 B가 저장을 바꿈 → A가 밀린 화면 → 이어하기 중앙·좌·우 3연탭', expected: '이어하기는 한 번만 반영, 둘째 이후 입력은 새 인생 화면 컨트롤에 닿지 않음(가드). 속도·자동 설정 불변' }, async () => {
        const fails = [];
        const details = [];
        let sh = null;
        for (const v of VARIANTS.slice(0, 4)) {
          const ctx = await mkctx(browser, { viewport: { width: vp[0], height: vp[1] }, hasTouch: true, isMobile: true });
          const A = await ctx.newPage();
          await A.addInitScript(REC);
          if (settings) await A.addInitScript(([k, val]) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, val); }, [SETTINGS_KEY, JSON.stringify({ version: 1, data: settings })]);
          try {
            await A.goto(DEV + '/');
            await toLife(A, 'present');
            await sleep(500);
            const B = await ctx.newPage();
            await B.goto(DEV + '/');
            await waitScreen(B, 'life-screen');
            await sleep(700);
            // B가 저장을 바꾼다: "다음 결정으로"(자동 모드면 불가) 대신 설정이 켜져 있을 수 있으니 저장 값을 직접 한 걸음 진행한 값으로 교체
            await B.evaluate((k) => {
              const raw = localStorage.getItem(k);
              const o = JSON.parse(raw);
              o.data.rngState = (o.data.rngState + 1) >>> 0; // 유효한 다른 값
              localStorage.setItem(k, JSON.stringify(o));
            }, GAME_KEY);
            await B.close();
            await waitScreen(A, 'superseded-screen', 8000);
            await sleep(650);
            const btn = A.getByTestId('take-over');
            await btn.scrollIntoViewIfNeeded();
            const box = await btn.boundingBox();
            await A.evaluate(() => (window.__clicks = []));
            const pos = await burst(A, box, v.xf, v.n, v.gap, true);
            await sleep(120);
            const a = await snap(A);
            const cl = await clicks(A);
            const bad = cl.slice(1).filter((c) => !c.endsWith('(가드)') && !c.startsWith('비버튼'));
            const want = settings ? ['8', 'true'] : ['1', 'false'];
            let f = null;
            if (a.screen !== 'life-screen') f = `인생 화면으로 이어지지 않음(${a.screen})`;
            else if (a.speed !== want[0] || a.auto !== want[1]) f = `속도/자동 바뀜(${a.speed}/${a.auto})`;
            else if (bad.length) f = `가드 없는 둘째 클릭 ${bad.join(',')}`;
            details.push(`${v.label}@(${pos.x},${pos.y}) 클릭=[${cl.join(',')}] 화면=${a.screen} 속도=${a.speed} 자동=${a.auto}`);
            if (f) fails.push(`${v.label}: ${f}`);
            if (v.xf === 0.5) sh = await shot(A, aIdx - 1 > 0 ? `M3-A${String(aIdx - 1).padStart(2, '0')}` : 'M3-A-x');
          } catch (e) {
            fails.push(`${v.label}: 오류 ${e.message.slice(0, 150)}`);
          } finally {
            await ctx.close();
          }
        }
        return { verdict: fails.length ? 'FAIL' : 'PASS', actual: fails.length ? fails.join(' / ') + ' :: ' + details.join(' | ') : `4개 변형 이상 없음. ${details[0]}`, shots: sh ? [sh] : [] };
      });
    }
  }
}
aIdx = Math.max(aIdx, 31);

// CH: 선택지 버튼 연타 (시간 배율 사용: 다음 선택지가 금방 뜨게)
if (!only || only === 'CH') {
  for (const vp of [[360, 740], [360, 568], [667, 375]]) {
    await runCase(G, { id: aId(), cat: '#11 유지', title: `선택지 버튼 연타 ${vp[0]}x${vp[1]} (?__timescale=40, 8배, 다음 선택지가 곧 뜨는 상황)`, timescale: 40, steps: '8배속·시간 배율 40으로 선택지가 뜨면 같은 좌표를 40번 빠르게 클릭(시작부터 끝까지 선택지마다 반복). 선택 1회당 연표에 choice가 정확히 1개 늘어야 하고, 새로 뜬 선택지는 약 0.4초간 눌리지 않아야 함', expected: '클릭 1번 = 선택 1개. 연타 중 다음 선택지가 자동으로 눌리지 않음' }, async () => {
      const { ctx, page } = await mk(vp, { touch: false, settings: { speed: 8, autoMode: false }, query: '?__timescale=40' });
      const notes = [];
      let shotP = null;
      try {
        await toLife(page, 'present');
        let rounds = 0;
        let bad = 0;
        const t0 = Date.now();
        while (rounds < 6 && Date.now() - t0 < 60000) {
          const s = await snap(page);
          if (s.screen === 'ending-placeholder') break;
          if (!s.hasChoice) { await sleep(40); continue; }
          // 보이는 선택지가 뜬 지 0.4초 이후여야 첫 클릭이 먹는다 → 가드가 풀릴 때까지 기다린 뒤 버튼 중앙을 연타
          const btn = page.locator('.choice-list button').nth(1);
          await page.waitForFunction(() => { const b = document.querySelector('.choice-list button'); return b && b.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 3000 });
          const box = await btn.boundingBox();
          if (!box) continue;
          const before = await readSave(page);
          const nBefore = before.data.history.filter((h) => h.kind === 'choice').length;
          const keyBefore = s.choiceKey;
          const x = box.x + box.width / 2;
          const y = box.y + box.height / 2;
          for (let i = 0; i < 40; i++) await page.mouse.click(x, y);
          await sleep(60);
          const mid = await readSave(page);
          const nAfter = mid.data.history.filter((h) => h.kind === 'choice').length;
          rounds++;
          if (nAfter - nBefore > 1) {
            bad++;
            notes.push(`라운드 ${rounds}: 한 번의 연타로 선택 ${nAfter - nBefore}개 확정 (key ${keyBefore})`);
            shotP = await shot(page, `M3-A${String(aIdx - 1).padStart(2, '0')}`, `r${rounds}`);
          }
          await sleep(500); // 다음 가드 소진 후 다음 라운드
        }
        if (!shotP) shotP = await shot(page, `M3-A${String(aIdx - 1).padStart(2, '0')}`);
        return { verdict: bad ? 'FAIL' : rounds >= 3 ? 'PASS' : 'ERROR', actual: bad ? notes.join('; ') : `${rounds}번의 연타 라운드에서 한 번에 선택 1개씩만 확정됨`, shots: [shotP] };
      } finally {
        await ctx.close();
      }
    });
  }
}

// SPD: 배속 버튼 연타, AUTO: 자동 모드 빠른 켜고 끄기
if (!only || only === 'SPD') {
  aIdx = 34;
  await runCase(G, { id: aId(), cat: '#11 유지', title: '배속 버튼 연타: 1↔8 번갈아 50회, 2·4배 연타 (360x740)', steps: '인생 화면에서 속도 버튼을 번갈아 매우 빠르게 클릭', expected: '마지막 클릭한 배속이 선택된 상태로 표시되고 저장도 같음. 연타로 한 해가 두 번 지나가거나 선택이 확정되지 않음' }, async () => {
    const { ctx, page } = await mk([360, 740], { touch: false, query: '' });
    try {
      await toLife(page, 'present');
      await sleep(700);
      const a0 = (await snap(page)).age;
      for (let i = 0; i < 50; i++) await page.locator(`[data-speed="${i % 2 ? 1 : 8}"]`).click({ noWaitAfter: true });
      for (let i = 0; i < 10; i++) { await page.locator('[data-speed="2"]').click(); await page.locator('[data-speed="4"]').click(); }
      await sleep(300);
      const s = await snap(page);
      const st = await readSettings(page);
      const ok = s.speed === '4' && st && st.data && st.data.speed === 4;
      const sh = await shot(page, `M3-A${String(aIdx - 1).padStart(2, '0')}`);
      return { verdict: ok ? 'PASS' : 'FAIL', actual: `화면 속도=${s.speed} 저장 속도=${st && st.data && st.data.speed} 나이 ${a0}→${s.age}`, shots: [sh] };
    } finally {
      await ctx.close();
    }
  });
}
if (!only || only === 'AUTO') {
  aIdx = 35;
  await runCase(G, { id: aId(), cat: '#3 자동 해제', title: '자동 모드 빠른 켜고 끄기 (홀수 회/짝수 회, 선택지 대기 중 포함) 360x740', steps: '자동 모드 버튼을 41회 연타, 선택지 대기 중에 다시 20회', expected: '최종 상태가 클릭 횟수 홀짝과 일치, 선택지가 깨지지 않고 오류 없음' }, async () => {
    const { ctx, page } = await mk([360, 740], { touch: false, query: '?__timescale=6' });
    try {
      await toLife(page, 'present');
      await sleep(700);
      for (let i = 0; i < 41; i++) await page.getByTestId('auto').click();
      let s = await snap(page);
      const okOdd = s.auto === 'true';
      for (let i = 0; i < 41; i++) await page.getByTestId('auto').click();
      s = await snap(page);
      const okEven = s.auto === 'false';
      // 선택지까지
      await page.getByTestId('skip').click();
      await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 8000 });
      const c0 = await snap(page);
      for (let i = 0; i < 20; i++) await page.getByTestId('auto').click();
      await sleep(100);
      const c1 = await snap(page);
      const st = await readSettings(page);
      const sh = await shot(page, `M3-A${String(aIdx - 1).padStart(2, '0')}`);
      const ok = okOdd && okEven && c1.hasChoice && c1.auto === 'false' && st.data.autoMode === false;
      return { verdict: ok ? 'PASS' : 'FAIL', actual: `41회→${okOdd ? '켜짐' : '불일치'}, 82회→${okEven ? '꺼짐' : '불일치'}, 선택지 대기 중 20회 후 선택지 유지=${c1.hasChoice} 자동=${c1.auto} 저장=${st.data.autoMode}`, shots: [sh] };
    } finally {
      await ctx.close();
    }
  });
}
await browser.close();
