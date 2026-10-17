// QA-003 M4 공격(2): 새로고침 연타·뒤로가기·탭 숨김·창 크기·저장 손상·저장 중 종료·오프라인·BGM 저장+터치·CPU 스로틀. 사용: node qa/scripts/m4-attack-b.mjs [id-prefix]
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, newGameToLife, readDash, shot, sleep, runCase, con, PROD, DEV, TOUCH, VP, waitGuard, readRaw, SETTINGS_KEY, GAME_KEY, OUT, whichScreen } from './m4-lib.mjs';
import { openState, loadSave } from './m4-states.mjs';

const only = process.argv[2] || '';
const want = (id) => !only || id.startsWith(only);
const browser = await launch();

const TL_INIT = () => {
  window.__tl = [];
  window.__paint = [];
  const read = () => {
    const age = document.querySelector('[data-testid="life-age"] b');
    const fill = document.querySelector('[data-testid="year-progress-fill"]');
    if (!age || !fill) return;
    const w = parseFloat(fill.style.width);
    const a = parseInt(age.textContent, 10);
    const last = window.__tl[window.__tl.length - 1];
    if (!last || last.a !== a || Math.abs(last.w - w) > 0.001) window.__tl.push({ t: Math.round(performance.now()), a, w: Math.round(w * 100) / 100 });
  };
  const start = () => new MutationObserver(read).observe(document.documentElement, { subtree: true, attributes: true, childList: true, characterData: true });
  document.documentElement ? start() : document.addEventListener('DOMContentLoaded', start);
  // 화면에 그려질 상태: 프레임마다(그리기 직전) 나이 글자와 바 너비를 읽는다
  const frame = () => {
    const age = document.querySelector('[data-testid="life-age"] b');
    const fill = document.querySelector('[data-testid="year-progress-fill"]');
    if (age && fill) {
      const a = parseInt(age.textContent, 10);
      const w = parseFloat(fill.style.width);
      const last = window.__paint[window.__paint.length - 1];
      if (!last || last.a !== a || Math.abs(last.w - w) > 0.01) window.__paint.push({ t: Math.round(performance.now()), a, w: Math.round(w * 100) / 100 });
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};
const AC_INIT = () => {
  window.__ac = { ctxs: [], osc: 0 };
  const wrap = (name) => {
    const O = window[name];
    if (!O) return;
    const W = function (...a) {
      const c = new O(...a);
      window.__ac.ctxs.push(c);
      const co = c.createOscillator.bind(c);
      c.createOscillator = (...x) => {
        window.__ac.osc++;
        return co(...x);
      };
      return c;
    };
    W.prototype = O.prototype;
    window[name] = W;
  };
  wrap('AudioContext');
  wrap('webkitAudioContext');
};
const VIS_INIT = () => {
  window.__vis = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__vis === 'hidden' });
};
async function game(opts = {}) {
  const ctx = await mkctx(browser, opts.ctx ?? { viewport: VP.m360, ...TOUCH });
  if (!opts.noClean) await cleanStorageOnce(ctx);
  await fixSeed(ctx, opts.seed ?? 229);
  if (opts.tl) await ctx.addInitScript(TL_INIT);
  if (opts.ac) await ctx.addInitScript(AC_INIT);
  if (opts.vis) await ctx.addInitScript(VIS_INIT);
  const p = await ctx.newPage();
  await newGameToLife(p, { era: opts.era ?? 'present', base: opts.base ?? PROD, query: opts.query ?? '' });
  await sleep(400);
  return { ctx, p };
}
const sv = async (p) => {
  const g = JSON.parse((await readRaw(p, GAME_KEY)) || 'null');
  const s = JSON.parse((await readRaw(p, SETTINGS_KEY)) || 'null');
  return { game: g && g.data, settings: s && (s.data ?? s), raw: g };
};
const errs = () => con.take();
const acs = (p) => p.evaluate(() => ({ n: window.__ac.ctxs.length, states: window.__ac.ctxs.map((c) => c.state), osc: window.__ac.osc }));
const hide = (p) => p.evaluate(() => { window.__vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
const show = (p) => p.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });

function analyzeTl(tl) {
  const byAge = new Map();
  for (const r of tl) {
    if (!byAge.has(r.a)) byAge.set(r.a, []);
    byAge.get(r.a).push(r);
  }
  const ages = [...byAge.keys()].sort((a, b) => a - b);
  const issues = [];
  for (let i = 0; i < ages.length; i++) {
    const rs = byAge.get(ages[i]);
    for (let j = 1; j < rs.length; j++) if (rs[j].w < rs[j - 1].w - 0.001) issues.push(`나이 ${ages[i]}: 바 줄어듦 ${rs[j - 1].w}→${rs[j].w}`);
    if (i > 0 && rs[0].w >= 90) issues.push(`나이 ${ages[i]}: 새 나이 첫 기록 바 ${rs[0].w}%`);
  }
  return { issues, ages };
}

// ===== B01 새로고침 연타(진행 중) =====
if (want('M4-B01')) {
  await runCase(
    { id: 'M4-B01', cat: '공격', title: '대시보드 새로고침 연타(15번, 간격 0~150ms 무작위) 뒤 상태 복원: 이름·나이 유지·저장 손상 0·옛 저장 안내/밀린 화면/오류 화면 없음', steps: '새 판 → 8배속으로 몇 해 진행 → 새로고침 15번(load 완료를 기다리지 않고 연달아) → 최종 화면·저장 비교', expected: '같은 이름·나이 ≥ 이전 나이(최대 한 해 이내 차이)·기록 줄이 앞부분 그대로·저장 JSON 유효·콘솔 오류 0' },
    async () => {
      const { ctx, p } = await game();
      const bad = [];
      await p.locator('[data-speed="8"]').click();
      await sleep(5000);
      const before = await sv(p);
      const d0 = await readDash(p);
      let seed = 99;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      for (let i = 0; i < 15; i++) {
        p.reload({ waitUntil: 'commit' }).catch(() => {});
        await sleep(Math.floor(rnd() * 150));
      }
      await p.waitForLoadState('load').catch(() => {});
      await p.waitForSelector('[data-testid="life-screen"]', { timeout: 15000 }).catch(() => {});
      await sleep(600);
      const scr = await whichScreen(p);
      const d1 = await readDash(p);
      const after = await sv(p);
      if (scr !== 'life-screen') bad.push(`화면 ${scr}`);
      if (d1.name !== d0.name) bad.push(`이름 ${d0.name}→${d1.name}`);
      if (d1.age < d0.age) bad.push(`나이가 거꾸로 ${d0.age}→${d1.age}`);
      if (!after.game) bad.push('저장이 없거나 손상');
      else {
        const b = before.game.history;
        const a = after.game.history;
        for (let i = 0; i < b.length; i++) if (a[i]?.text !== b[i].text) bad.push(`기록 ${i}번 줄이 달라짐`);
      }
      if (await p.getByTestId('old-save-notice').count()) bad.push('옛 저장 안내가 뜸');
      await shot(p, 'B01', 'after');
      const e = errs().filter((x) => !/ERR_ABORTED|net::|NS_BINDING/.test(x.text));
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length ? bad.join(' / ') : `이름 ${d1.name}, 나이 ${d0.age}→${d1.age}, 기록 ${before.game.history.length}→${after.game.history.length}줄 앞부분 동일, 저장 유효`, shots: ['qa/screenshots/003/M4-B01-after.png'] };
    },
  );
}

// ===== B02 선택지 대기 중 새로고침 연타 =====
if (want('M4-B02')) {
  await runCase(
    { id: 'M4-B02', cat: '공격', title: '선택지 대기 중 새로고침 연타(15번): 같은 카드·같은 선택지가 그대로 뜨고 카드가 대신 선택되지 않음(기록 줄 수 불변)', steps: '선택지 대기 저장 → 새로고침 15번 → 카드 제목·선택지·기록 줄 수 비교(3개 세상)', expected: '매번 같은 카드·선택지·기록 줄 수 불변, 가드 때문에 새로고침 직후 클릭이 선택되지 않음' },
    async () => {
      const bad = [];
      const notes = [];
      for (const era of ['present', 'past', 'future']) {
        const { ctx, page: p } = await openState(browser, 'pending', { era, vp: { width: 360, height: 740, touch: true } });
        const read = async () => ({ d: await readDash(p), choices: await p.evaluate(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].map((b) => b.textContent.replace(/\s+/g, ' ').trim())), hist: (await sv(p)).game?.history?.length });
        const base = await read();
        if (!base.d.hasChoice) {
          bad.push(`${era}: 기준 상태에 카드가 없음`);
          await ctx.close();
          continue;
        }
        for (let i = 0; i < 15; i++) {
          p.reload({ waitUntil: 'commit' }).catch(() => {});
          await sleep(30 + (i % 4) * 40);
          if (i % 3 === 0) {
            // 로드 중 클릭 시도(가드 확인)
            await p.mouse.click(180, 400).catch(() => {});
          }
        }
        await p.waitForLoadState('load').catch(() => {});
        await p.waitForSelector('[data-testid="choice-panel"]', { timeout: 15000 }).catch(() => {});
        await sleep(500);
        const now = await read();
        if (now.d.choiceTitle !== base.d.choiceTitle) bad.push(`${era}: 카드 ${base.d.choiceTitle}→${now.d.choiceTitle}`);
        if (JSON.stringify(now.choices) !== JSON.stringify(base.choices)) bad.push(`${era}: 선택지가 바뀜`);
        if (now.hist !== base.hist) bad.push(`${era}: 기록 줄 수 ${base.hist}→${now.hist}`);
        notes.push(`${era}: 「${now.d.choiceTitle}」 선택지 ${now.choices.length}개 기록 ${now.hist}줄 유지`);
        await ctx.close();
      }
      const e = errs().filter((x) => !/ERR_ABORTED|net::/.test(x.text));
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots: [] };
    },
  );
}

// ===== B03 나가기 확인 중 새로고침 연타 =====
if (want('M4-B03')) {
  await runCase(
    { id: 'M4-B03', cat: '공격', title: '나가기 확인 단계가 열린 채 새로고침 연타(12번): 대시보드가 그대로 복원되고 확인 단계는 닫힘·저장 손상 0·첫 화면으로 잘못 나가지 않음', steps: '새 판 → 나가기 → 확인 단계 → 새로고침 12번 → 화면 확인', expected: '대시보드(life-screen), 확인 단계 닫힘, 같은 나이(±1해), 저장 유효, 오류 0' },
    async () => {
      const { ctx, p } = await game();
      const bad = [];
      await sleep(2500);
      await waitGuard(p, 'tool-exit');
      await p.getByTestId('tool-exit').click();
      await p.waitForSelector('[data-testid="exit-ask"]');
      const d0 = await readDash(p);
      for (let i = 0; i < 12; i++) {
        p.reload({ waitUntil: 'commit' }).catch(() => {});
        await sleep(40 + (i % 5) * 35);
      }
      await p.waitForLoadState('load').catch(() => {});
      await sleep(900);
      const scr = await whichScreen(p);
      const d1 = await readDash(p);
      if (scr !== 'life-screen') bad.push(`화면 ${scr}`);
      if (d1.exitAsk) bad.push('확인 단계가 열린 채 복원됨(기대: 닫힘)');
      if (d1.age < d0.age) bad.push(`나이 ${d0.age}→${d1.age}`);
      const s = await sv(p);
      if (!s.game) bad.push('저장 손상');
      await shot(p, 'B03', 'after');
      const e = errs().filter((x) => !/ERR_ABORTED|net::/.test(x.text));
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : `복원: ${scr} 나이 ${d0.age}→${d1.age}, 확인 단계 닫힘, 일시정지 ${d1.paused}(저장 paused ${s.game.paused})`, shots: ['qa/screenshots/003/M4-B03-after.png'] };
    },
  );
}

// ===== B04 뒤로·앞으로가기 =====
if (want('M4-B04')) {
  await runCase(
    { id: 'M4-B04', cat: '공격', title: '뒤로·앞으로가기: 대시보드에서 뒤로 → 앱을 떠남 → 앞으로 → 저장된 대시보드 복원(손실 0), 첫 화면·나가기 뒤에도 같음', steps: 'about:blank → 앱 → 새 판 → 대시보드 → 뒤로 → 앞으로 → (나가기 → 첫 화면) → 뒤로 → 앞으로', expected: '앞으로 뒤 이름·나이·기록 유지(나이는 저장된 값 이상), 오류 0. 앱이 history 항목을 만들지 않는 것은 M3 결정(현행)' },
    async () => {
      const { ctx, p } = await game();
      const bad = [];
      const notes = [];
      await sleep(2500);
      const d0 = await readDash(p);
      const hlen = await p.evaluate(() => history.length);
      notes.push(`history.length ${hlen}`);
      await p.goBack().catch(() => {});
      await sleep(400);
      const urlBack = p.url();
      notes.push(`뒤로 → ${urlBack}`);
      await p.goForward({ waitUntil: 'load' }).catch(() => {});
      await p.waitForSelector('[data-testid="life-screen"]', { timeout: 10000 }).catch(() => {});
      await sleep(500);
      const scr = await whichScreen(p);
      const d1 = await readDash(p);
      if (scr !== 'life-screen') bad.push(`앞으로 뒤 화면 ${scr}`);
      if (d1.name !== d0.name || d1.age < d0.age) bad.push(`앞으로 뒤 ${d0.name}/${d0.age} → ${d1.name}/${d1.age}`);
      notes.push(`앞으로 뒤 ${d1.screen} 나이 ${d0.age}→${d1.age} 기록 ${d0.logRows}→${d1.logRows}`);
      // 나가기 → 첫 화면 → 뒤로/앞으로
      await waitGuard(p, 'tool-exit');
      await p.getByTestId('tool-exit').click();
      await waitGuard(p, 'exit-yes');
      await p.getByTestId('exit-yes').click();
      await p.waitForSelector('[data-testid="title-screen"]');
      await p.goBack().catch(() => {});
      await sleep(300);
      await p.goForward({ waitUntil: 'load' }).catch(() => {});
      await sleep(900);
      const scr2 = await whichScreen(p);
      notes.push(`첫 화면에서 뒤로→앞으로 뒤 ${scr2}`);
      if (!['life-screen', 'title-screen'].includes(scr2)) bad.push(`첫 화면 뒤로/앞으로 뒤 ${scr2}`);
      const s = await sv(p);
      if (!s.game) bad.push('저장 손상');
      await shot(p, 'B04', 'after-forward');
      const e = errs().filter((x) => !/ERR_ABORTED|net::/.test(x.text));
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots: ['qa/screenshots/003/M4-B04-after-forward.png'] };
    },
  );
}

// ===== B05 탭 숨김 =====
if (want('M4-B05')) {
  await runCase(
    { id: 'M4-B05', cat: '공격', title: '탭을 숨겼다 돌아오기: (가) 일시정지 중 숨김→복귀: 재개하지 않음 (나) 진행 중 숨김 8초: 그동안 나이·바가 멈추고 복귀 뒤 이어서 흐름(몰아치기 없음) — 가짜 hidden·진짜 bringToFront·CDP frozen', steps: '세 방식으로 각각: 새 판 → (가) 일시정지 → 숨김 6초 → 복귀 → 3초 (나) 재개 → 숨김 8초 → 복귀 → 2초. BGM이 켜진 상태에서 숨김 시 소리 장치 suspended → 복귀 시 running도 확인', expected: '(가) 복귀 뒤에도 멈춤 유지(다시 진행 이름·바 불변) (나) 숨긴 동안 불변, 복귀 직후 한꺼번에 여러 해가 지나가지 않음(나이 증가 ≤ 1), BGM suspend→resume' },
    async () => {
      const bad = [];
      const notes = [];
      for (const mode of ['fake-hidden', 'real-bringToFront', 'cdp-frozen']) {
        const { ctx, p } = await game({ vis: mode === 'fake-hidden', ac: true, tl: true });
        const p2 = mode === 'real-bringToFront' ? await ctx.newPage() : null;
        const cdp = mode === 'cdp-frozen' ? await ctx.newCDPSession(p) : null;
        const doHide = async () => {
          if (mode === 'fake-hidden') await hide(p);
          else if (mode === 'real-bringToFront') {
            await p2.goto('about:blank');
            await p2.bringToFront();
          } else await cdp.send('Page.setWebLifecycleState', { state: 'frozen' }).catch(() => {});
        };
        const doShow = async () => {
          if (mode === 'fake-hidden') await show(p);
          else if (mode === 'real-bringToFront') await p.bringToFront();
          else await cdp.send('Page.setWebLifecycleState', { state: 'active' }).catch(() => {});
        };
        // BGM 켜기
        await waitGuard(p, 'tool-bgm');
        await p.getByTestId('tool-bgm').click();
        await sleep(400);
        // (가) 일시정지 중
        await p.getByTestId('pause').click();
        await sleep(300);
        const a0 = await readDash(p);
        await doHide();
        await sleep(6000);
        await doShow();
        await sleep(1500);
        const a1 = await readDash(p);
        const ac1 = mode === 'cdp-frozen' ? null : await acs(p);
        if (a1.paused !== 'true' || a1.fillStyle !== a0.fillStyle || a1.age !== a0.age) bad.push(`${mode}(가): 복귀 뒤 재개됨 ${a0.fillStyle}→${a1.fillStyle} 멈춤=${a1.paused}`);
        notes.push(`${mode}(가) 멈춤 유지 ${a1.paused}, ${a0.fillStyle}→${a1.fillStyle}`);
        // (나) 진행 중
        await p.getByTestId('pause').click();
        await sleep(1200);
        const b0 = await readDash(p);
        const tlLen = (await p.evaluate(() => window.__tl)).length;
        await doHide();
        await sleep(8000);
        const acHidden = mode === 'fake-hidden' ? await acs(p) : null;
        await doShow();
        await sleep(300);
        const b1 = await readDash(p);
        await sleep(1700);
        const b2 = await readDash(p);
        const acShown = mode === 'cdp-frozen' ? null : await acs(p);
        const jump = b1.age - b0.age;
        // 숨긴 동안 나이가 안 늘고, 복귀 직후 몰아치지 않음(1해 이하)
        if (mode !== 'cdp-frozen' && jump > 1) bad.push(`${mode}(나): 숨긴 8초 뒤 복귀 직후 나이 ${b0.age}→${b1.age} (몰아치기)`);
        if (b2.age <= b0.age && b2.fillStyle === b0.fillStyle) bad.push(`${mode}(나): 복귀 뒤 흐르지 않음`);
        if (mode === 'fake-hidden') {
          if (acHidden.states.some((s) => s === 'running')) bad.push(`${mode}: 숨긴 동안 소리 장치가 running ${acHidden.states}`);
          if (!acShown.states.every((s) => s === 'running')) bad.push(`${mode}: 복귀 뒤 소리 장치 ${acShown.states}`);
        }
        notes.push(`${mode}(나) 나이 ${b0.age}→${b1.age}(복귀 직후)→${b2.age}${mode === 'fake-hidden' ? `, 장치 숨김 중 ${acHidden.states} 복귀 ${acShown.states}` : ''}`);
        const e = errs();
        if (e.length) bad.push(`${mode} 콘솔 ${JSON.stringify(e).slice(0, 150)}`);
        await ctx.close();
      }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots: [] };
    },
  );
}

// ===== B06 창 크기·회전 =====
if (want('M4-B06')) {
  await runCase(
    { id: 'M4-B06', cat: '공격', title: '창 크기·회전(360×740 ↔ 667×375 가로 ↔ 1280×800 ↔ 320×568 ↔ 320×256): 가로 넘침 0·진행 유지·포커스 유지·헤더/진행 줄 고정 ↔ 해제 전환 뒤에도 정상·기록 맨 아래 유지', steps: '새 판 → 도구 줄 「다크 모드」에 포커스 → 뷰포트를 차례로 바꾸며 매번 넘침·고정 요소·포커스 요소·진행 계속 여부를 확인', expected: '매 단계 가로 넘침 0, 헤더+하단 고정 합이 높이의 절반을 넘으면 head-released, 진행 계속(나이 증가), 포커스가 유지됨' },
    async () => {
      const { ctx, p } = await game();
      const bad = [];
      const notes = [];
      const steps = [[667, 375], [1280, 800], [320, 568], [320, 256], [360, 740], [375, 812], [768, 1024]];
      await p.locator('[data-speed="8"]').click();
      await p.getByTestId('tool-dark').focus();
      let lastAge = (await readDash(p)).age;
      for (const [w, h] of steps) {
        await p.setViewportSize({ width: w, height: h });
        await sleep(700);
        const m = await p.evaluate(() => {
          const root = document.documentElement;
          const head = document.querySelector('[data-testid="dash-head"]');
          const ctl = document.querySelector('[data-testid="controls"]');
          return { over: root.scrollWidth - root.clientWidth, cls: root.className, headPos: getComputedStyle(head).position, headH: Math.round(head.getBoundingClientRect().height), ctlPos: getComputedStyle(ctl).position, ctlH: Math.round(ctl.getBoundingClientRect().height), vh: window.innerHeight, focus: document.activeElement?.getAttribute('data-testid') };
        });
        const fixedSum = (m.headPos !== 'static' ? m.headH : 0) + (m.ctlPos === 'fixed' || m.ctlPos === 'sticky' ? m.ctlH : 0);
        const d = await readDash(p);
        if (m.over > 0) bad.push(`${w}×${h}: 가로 넘침 ${m.over}px`);
        if (fixedSum > m.vh * 0.5 + 1) bad.push(`${w}×${h}: 고정 요소 합 ${fixedSum}px > 높이 ${m.vh}의 절반`);
        if (m.focus !== 'tool-dark') bad.push(`${w}×${h}: 포커스 ${m.focus} (tool-dark 기대)`);
        if (d.screen !== 'life-screen') bad.push(`${w}×${h}: 화면 ${d.screen}`);
        notes.push(`${w}×${h}: ${m.cls.replace('has-', '')}, 헤더 ${m.headPos} ${m.headH}, 진행 줄 ${m.ctlPos} ${m.ctlH}, 합 ${fixedSum}/${m.vh}`);
        if (w === 667) await shot(p, 'B06', 'landscape-667x375');
        if (w === 320 && h === 256) await shot(p, 'B06', '320x256');
        lastAge = d.age;
      }
      await sleep(2500);
      const end = await readDash(p);
      if (end.age <= 0) bad.push('창 크기를 바꾼 뒤 진행이 멈춘 듯함');
      const e = errs();
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? [...new Set(bad)].slice(0, 6).join(' / ') + ' | ' : '') + notes.join(' | '), shots: ['qa/screenshots/003/M4-B06-landscape-667x375.png', 'qa/screenshots/003/M4-B06-320x256.png'] };
    },
  );
}

// ===== B07 저장 손상·옛 저장 심기 =====
if (want('M4-B07')) {
  await runCase(
    { id: 'M4-B07', cat: '공격', title: '저장 손상·옛(v6) 저장 심기·변조: 앱이 죽지 않고 새 게임으로 시작, 옛 저장 안내는 한 번만, 태그·거대 문자열이 화면을 오염시키지 않음', steps: '대시보드 저장(나이 30)을 기반으로 (1)쓰레기 문자열 (2)잘린 JSON (3)빈 객체 (4)버전 6 (5)버전 999 (6)나이 음수 (7)나이 999 (8)paused 문자열 (9)flags 문자열 (10)기록 5000줄 (11)기록 문장에 <script>·이모지·1MB (12)stats NaN (13)설정 손상을 localStorage에 심고 연다', expected: '크래시·오류 화면 없음. v6는 안내 한 줄 + 새 게임(첫 화면), 새로고침하면 안내 사라짐. 변조는 새 게임 또는 안전하게 정리된 판. 스크립트 실행·태그 삽입 0' },
    async () => {
      const bad = [];
      const notes = [];
      const base = JSON.parse(loadSave('present', 'age30'));
      const variants = {
        garbage: 'not json at all {{{',
        truncated: JSON.stringify(base).slice(0, 400),
        emptyObj: '{}',
        v6: JSON.stringify({ ...base, version: 6 }),
        v999: JSON.stringify({ ...base, version: 999 }),
        ageNeg: JSON.stringify({ ...base, data: { ...base.data, age: -5 } }),
        age999: JSON.stringify({ ...base, data: { ...base.data, age: 999 } }),
        pausedStr: JSON.stringify({ ...base, data: { ...base.data, paused: 'yes' } }),
        flagsStr: JSON.stringify({ ...base, data: { ...base.data, flags: 'married' } }),
        hist5000: JSON.stringify({ ...base, data: { ...base.data, history: Array.from({ length: 5000 }, (_, i) => ({ age: 1, kind: 'event', text: '줄' + i })) } }),
        histXss: JSON.stringify({ ...base, data: { ...base.data, history: [...base.data.history.slice(0, 3), { age: 5, kind: 'event', text: '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>😀👨‍👩‍👧‍👦' }] } }),
        histHuge: JSON.stringify({ ...base, data: { ...base.data, history: [...base.data.history.slice(0, 2), { age: 5, kind: 'event', text: '가'.repeat(1000000) }] } }),
        statsNaN: JSON.stringify({ ...base, data: { ...base.data, stats: { health: 'NaN', happiness: null, education: -1, relationships: 1e9 } } }),
      };
      for (const [name, raw] of Object.entries(variants)) {
        const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
        await ctx.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem(k, v); sessionStorage.setItem('__s', '1'); } } catch {} }, [GAME_KEY, raw]);
        const p = await ctx.newPage();
        await p.goto(PROD, { waitUntil: 'load' });
        await sleep(900);
        const scr = await whichScreen(p);
        const info = await p.evaluate(() => ({ notice: !!document.querySelector('[data-testid="old-save-notice"]'), xss: window.__xss ?? null, bodyLen: document.body.innerText.length, imgOnerror: !!document.querySelector('img[onerror]'), scriptInBody: !!document.body.querySelector('script') && document.body.innerHTML.includes('window.__xss'), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
        let status = `${name}: ${scr}${info.notice ? ' +안내' : ''}`;
        if (['error-screen', 'BLANK', 'unknown'].includes(scr)) bad.push(`${name}: 화면 ${scr}`);
        if (info.xss) bad.push(`${name}: 스크립트 실행됨`);
        if (info.imgOnerror) bad.push(`${name}: 태그가 DOM으로 삽입됨`);
        if (info.overflow) bad.push(`${name}: 가로 넘침`);
        if (name === 'v6') {
          if (!info.notice) bad.push('v6: 옛 저장 안내가 안 뜸');
          if (scr !== 'title-screen') bad.push(`v6: 첫 화면이 아님(${scr})`);
          await shot(p, 'B07', 'v6-notice');
          await p.reload({ waitUntil: 'load' });
          await sleep(500);
          const n2 = await p.evaluate(() => !!document.querySelector('[data-testid="old-save-notice"]'));
          status += n2 ? ' (새로고침 뒤에도 안내)' : ' (새로고침 뒤 안내 사라짐)';
          if (n2) bad.push('v6: 새로고침 뒤에도 안내가 계속 뜸(한 번이어야)');
        }
        if (name === 'histXss' || name === 'histHuge' || name === 'hist5000' || name === 'ageNeg' || name === 'age999' || name === 'statsNaN') await shot(p, 'B07', name);
        notes.push(status);
        await ctx.close();
      }
      const e = errs().filter((x) => !/ERR_ABORTED|net::/.test(x.text));
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 300)}`);
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: (bad.length ? [...new Set(bad)].join(' / ') + ' | ' : '') + notes.join(' | '), shots: ['qa/screenshots/003/M4-B07-v6-notice.png', 'qa/screenshots/003/M4-B07-histXss.png', 'qa/screenshots/003/M4-B07-hist5000.png'] };
    },
  );
}

// ===== B08 저장 중 종료 =====
if (want('M4-B08')) {
  await runCase(
    { id: 'M4-B08', cat: '공격', title: '저장이 일어나는 중 탭 종료(진행·선택·나가기·일시정지·배속 변경 직후, 40번): 다시 열면 늘 유효한 저장(반쪽 상태 0)·같은 화면 복원', steps: '개발 서버 시간 배율 ×40(한 해 약 0.18초)으로 진행하며 무작위 시점(0~700ms)에 페이지를 닫고 같은 컨텍스트에서 다시 연다. 40번 반복(그 중 선택·나가기·일시정지·배속 변경 직후도), 이름·기록 앞부분·저장 파싱 확인', expected: '매번 life 또는 첫 화면 복원, 저장 JSON 유효, 이름 같음, 기록 앞부분 유지(잘림·뒤섞임 0), 옛 저장 안내·오류 화면 0' },
    async () => {
      const { ctx, p: p0 } = await game({ noClean: true, base: DEV, query: '?__timescale=40' });
      const bad = [];
      const notes = [];
      const name = (await readDash(p0)).name;
      await p0.locator('[data-speed="8"]').click();
      await sleep(1500);
      let page = p0;
      let prevHist = (await sv(page)).game.history.map((h) => h.text);
      let seed = 4242;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      let ok = 0;
      const trace = [];
      for (let i = 0; i < 40; i++) {
        await sleep(Math.floor(rnd() * 700));
        if (i % 6 === 4) await page.locator('[data-testid="choice-panel"] .choice').first().click({ timeout: 300 }).catch(() => {});
        if (i % 6 === 5) {
          // 나가기 확인 → 나가는 순간에 닫기
          await page.getByTestId('tool-exit').click({ timeout: 2500 }).catch(() => {});
          await sleep(500);
          await page.getByTestId('exit-yes').click({ timeout: 2500 }).catch(() => {});
        } else if (i % 6 === 2) {
          await page.getByTestId('pause').click({ timeout: 2500 }).catch(() => {});
        } else if (i % 6 === 3) {
          await page.locator(`[data-speed="${[1, 2, 4, 8][Math.floor(rnd() * 4)]}"]`).click({ timeout: 2500 }).catch(() => {});
        }
        await page.close({ runBeforeUnload: false }).catch(() => {});
        page = await ctx.newPage();
        await page.goto(DEV + '?__timescale=40', { waitUntil: 'load', timeout: 15000 });
        if (process.env.QA_DEBUG) console.log('B08 #' + i);
        await sleep(500);
        const scr = await whichScreen(page);
        const s = await sv(page);
        if (!['life-screen', 'title-screen', 'ending-screen'].includes(scr)) bad.push(`#${i}: 화면 ${scr}`);
        if (!s.game) bad.push(`#${i}: 저장 손상`);
        else {
          const h = s.game.history.map((x) => x.text);
          for (let k = 0; k < Math.min(prevHist.length, h.length, 12); k++) if (h[k] !== prevHist[k]) bad.push(`#${i}: 기록 ${k}번 줄이 달라짐`);
          prevHist = h;
        }
        if (await page.getByTestId('old-save-notice').count()) bad.push(`#${i}: 옛 저장 안내`);
        {
          const resumeBtn = await page.getByTestId('resume').count();
          const line = `#${i} ${scr} 저장 기록 ${s.game ? s.game.history.length : '-'}줄 나이 ${s.game ? s.game.age : '-'} phase ${s.game ? s.game.phase : '-'} paused ${s.game ? s.game.paused : '-'} 이어서 살기 ${resumeBtn}`;
          trace.push(line);
          if (process.env.QA_DEBUG) console.log(line);
          if (scr === 'title-screen' && !resumeBtn && s.game && s.game.history && s.game.history.length === 0) bad.push(`#${i}: 첫 화면인데 이어서 살기가 없고 저장이 빈 새 판 — 진행이 사라짐`);
        }
        if (scr === 'title-screen') {
          // 첫 화면에서 이어서 살기로 복귀(나가기 뒤 종료 시나리오)
          await page.getByTestId('resume').click({ timeout: 2500 }).catch(() => {});
          await page.waitForSelector('[data-testid="life-screen"]', { timeout: 4000 }).catch(() => {});
        }
        const d = await readDash(page);
        if (d.screen === 'life-screen' && d.name !== name) bad.push(`#${i}: 이름 ${d.name}`);
        if (d.screen === 'life-screen') await page.locator('[data-speed="8"]').click({ timeout: 2500 }).catch(() => {});
        if (d.screen === 'life-screen' && d.paused === 'true') await page.getByTestId('pause').click({ timeout: 2500 }).catch(() => {});
        ok++;
      }
      notes.push(`종료·재오픈 ${ok}번`);
      fs.writeFileSync(path.join(OUT, 'b08-trace.txt'), trace.join(String.fromCharCode(10)));
      notes.push(trace.slice(0, 6).join(' / ') + ' … ' + trace.slice(-3).join(' / '));
      const e = errs().filter((x) => !/ERR_ABORTED|net::/.test(x.text));
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: (bad.length ? [...new Set(bad)].slice(0, 6).join(' / ') + ' | ' : '') + notes.join(' | '), shots: [] };
    },
  );
}

// ===== B09 오프라인 플레이 =====
if (want('M4-B09')) {
  await runCase(
    { id: 'M4-B09', cat: '공격', title: '오프라인 플레이(로드 뒤 네트워크 끊김): 진행·컨트롤·도구가 정상(외부 요청 0이므로), 의견 보내기는 링크라 영향 없음(href 유지) — 오프라인 새로고침은 기대 항목이 아님(기록만)', steps: '새 판 → context.setOffline(true) → 8배속 12초 → 일시정지·배속·다크·BGM·나가기 확인 → 의견 보내기 href 확인 → (기록) 오프라인 새로고침 → 온라인 복귀', expected: '진행·컨트롤·도구 정상, 콘솔에 요청 실패 오류 0, 링크 href 그대로' },
    async () => {
      const { ctx, p } = await game({ ac: true });
      const bad = [];
      const notes = [];
      await ctx.setOffline(true);
      await p.locator('[data-speed="8"]').click();
      const a0 = (await readDash(p)).age;
      await sleep(12000);
      let d = await readDash(p);
      if (d.hasChoice) {
        await p.locator('[data-testid="choice-panel"] .choice').first().click().catch(() => {});
      }
      const a1 = (await readDash(p)).age;
      if (a1 <= a0) bad.push(`오프라인에서 진행이 멈춤 ${a0}→${a1}`);
      await p.getByTestId('pause').click();
      await sleep(300);
      if ((await readDash(p)).paused !== 'true') bad.push('오프라인 일시정지 안 됨');
      await p.getByTestId('pause').click();
      await p.getByTestId('tool-dark').click();
      await sleep(200);
      if ((await readDash(p)).darkOn !== 'true') bad.push('오프라인 다크 토글 안 됨');
      await p.getByTestId('tool-bgm').click();
      await sleep(500);
      const ac = await acs(p);
      if ((await readDash(p)).bgmOn !== 'true' || ac.n !== 1) bad.push(`오프라인 BGM ${ac.n}`);
      const href = await p.getByTestId('tool-feedback').getAttribute('href');
      if (!/^https:\/\/github\.com\/.*\/issues\/new/.test(href ?? '')) bad.push(`오프라인 의견 보내기 href ${href}`);
      notes.push(`진행 ${a0}→${a1}세, 링크 유지`);
      await p.getByTestId('tool-exit').click();
      await waitGuard(p, 'exit-yes');
      await p.getByTestId('exit-yes').click();
      await p.waitForSelector('[data-testid="title-screen"]');
      await sleep(300);
      notes.push('오프라인 나가기 → 첫 화면 정상');
      const e = errs();
      const netErr = e.filter((x) => x.type !== 'requestfailed');
      if (netErr.length) bad.push(`콘솔 ${JSON.stringify(netErr).slice(0, 200)}`);
      // 기록용: 오프라인 새로고침
      let reloadOk = null;
      try {
        await p.reload({ waitUntil: 'load', timeout: 8000 });
        reloadOk = await whichScreen(p);
      } catch (err) {
        reloadOk = '실패(' + String(err.message).slice(0, 40) + ')';
      }
      notes.push(`(기록) 오프라인 새로고침 → ${reloadOk}`);
      await ctx.setOffline(false);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots: [] };
    },
  );
}

// ===== B11 BGM 켜짐 저장 + 새로고침 + 터치 탭 =====
if (want('M4-B11')) {
  await runCase(
    { id: 'M4-B11', cat: '공격', title: 'BGM 켜짐 저장 + 새로고침 + 터치 탭 → 소리 장치가 running(R-325): 새로고침 직후 장치 0, touchstart/pointerdown만으로는 안 만들고, 터치 탭(뗄 때) 안에서 만들어 running. (소리 자체는 미확인)', steps: '터치 360×740: BGM 켜기 → 새로고침 → 장치 수 → 첫 터치 입력(touchstart·pointerdown만 디스패치) → 장치 수 → 실제 터치 탭 → 장치 수·상태 → 한 번 더 탭', expected: '재로드 직후 0, touchstart만으로 0, 탭 뒤 1·running, 음 예약이 늘어남' },
    async () => {
      const { ctx, p } = await game({ ac: true });
      const bad = [];
      const notes = [];
      await waitGuard(p, 'tool-bgm');
      await p.getByTestId('tool-bgm').click();
      await sleep(400);
      await p.reload({ waitUntil: 'load' });
      await p.waitForSelector('[data-testid="life-screen"]');
      await sleep(700);
      const d = await readDash(p);
      const a0 = await acs(p);
      notes.push(`재로드 직후: BGM ${d.bgmOn}, 장치 ${a0.n}`);
      if (d.bgmOn !== 'true') bad.push(`저장된 켜짐이 복원되지 않음 ${d.bgmOn}`);
      if (a0.n !== 0) bad.push(`사용자 동작 전 소리 장치 ${a0.n}개`);
      // touchstart·pointerdown만
      await p.evaluate(() => {
        const t = document.querySelector('.dash') || document.body;
        t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
        t.dispatchEvent(new Event('touchstart', { bubbles: true }));
      });
      await sleep(300);
      const a1 = await acs(p);
      notes.push(`touchstart·pointerdown 뒤: 장치 ${a1.n}`);
      if (a1.n !== 0) bad.push(`touchstart/pointerdown만으로 장치가 만들어짐 ${a1.n}`);
      // 실제 터치 탭(본문 빈 곳)
      await p.touchscreen.tap(180, 420);
      await sleep(600);
      const a2 = await acs(p);
      notes.push(`터치 탭 뒤: 장치 ${a2.n} ${a2.states}, osc ${a2.osc}`);
      if (a2.n !== 1 || a2.states[0] !== 'running') bad.push(`터치 탭 뒤 장치 ${JSON.stringify(a2)} (1개·running 기대)`);
      await sleep(2500);
      const a3 = await acs(p);
      if (a3.osc <= a2.osc) bad.push(`탭 뒤 음 예약이 늘지 않음 ${a2.osc}→${a3.osc}`);
      notes.push(`음 예약 ${a2.osc}→${a3.osc}`);
      await shot(p, 'B11', 'after-tap');
      const e = errs();
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | ') + ' (소리 자체는 미확인 — 장치 상태·음 예약까지)', shots: ['qa/screenshots/003/M4-B11-after-tap.png'] };
    },
  );
}

// ===== B12 CPU 스로틀 진행률 바 깜빡임 =====
if (want('M4-B12')) {
  await runCase(
    { id: 'M4-B12', cat: '공격', title: 'CPU 스로틀(×4·×6·×20)에서 진행률 바 깜빡임(새 나이 + 이전 해 100%) — 그려지는 프레임(rAF)과 DOM 변경 묶음 두 방식으로 관찰', steps: 'CDP Emulation.setCPUThrottlingRate × 8배속 20초(+ 선택지는 첫 선택지). 프레임마다 (나이 글자, 바 너비)를 기록해 나이가 바뀐 프레임의 바 너비가 ≥ 90인 경우를 센다. 눈 관찰은 스크린샷 대신 이 프레임 기록으로 갈음', expected: '나이가 바뀐 프레임에서 바가 90% 이상인 경우 0, 바가 같은 나이 안에서 되감기는 프레임 0' },
    async () => {
      const bad = [];
      const notes = [];
      for (const rate of [4, 6, 20]) {
        const { ctx, p } = await game({ tl: true });
        const cdp = await ctx.newCDPSession(p);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate });
        await p.locator('[data-speed="8"]').click();
        const t0 = Date.now();
        while (Date.now() - t0 < 20000) {
          const d = await readDash(p);
          if (d.hasChoice) await p.locator('[data-testid="choice-panel"] .choice').first().click({ timeout: 2500 }).catch(() => {});
          await sleep(200);
        }
        const tl = await p.evaluate(() => window.__tl);
        const paint = await p.evaluate(() => window.__paint);
        const a = analyzeTl(tl);
        let flicker = 0;
        let rewind = 0;
        for (let i = 1; i < paint.length; i++) {
          if (paint[i].a !== paint[i - 1].a && paint[i].w >= 90) flicker++;
          if (paint[i].a === paint[i - 1].a && paint[i].w < paint[i - 1].w - 0.01) rewind++;
        }
        const ages = [...new Set(paint.map((r) => r.a))];
        notes.push(`×${rate}: 나이 ${ages[0]}→${ages[ages.length - 1]}, 프레임 기록 ${paint.length}개·DOM 기록 ${tl.length}개, 새 나이+100% 프레임 ${flicker}, 되감김 ${rewind}`);
        if (flicker) bad.push(`×${rate}: 새 나이 + 이전 100% 프레임 ${flicker}개`);
        if (rewind) bad.push(`×${rate}: 같은 나이 안에서 바가 되감김 ${rewind}번`);
        if (a.issues.length) bad.push(`×${rate}: DOM 기록 ${a.issues.slice(0, 2).join(';')}`);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
        await ctx.close();
      }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '낮음', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots: [] };
    },
  );
}

await browser.close();
