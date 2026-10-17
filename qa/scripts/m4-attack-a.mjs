// QA-003 M4 공격(1): 컨트롤·도구 연타. 사용: node qa/scripts/m4-attack-a.mjs [id-prefix]
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, newGameToLife, readDash, shot, sleep, runCase, con, PROD, TOUCH, VP, waitGuard, readRaw, SETTINGS_KEY, GAME_KEY, OUT } from './m4-lib.mjs';
import { openState } from './m4-states.mjs';

const only = process.argv[2] || '';
const want = (id) => !only || id.startsWith(only);
const browser = await launch();

const TL_INIT = () => {
  window.__tl = [];
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
async function game(opts = {}) {
  const ctx = await mkctx(browser, opts.ctx ?? { viewport: VP.m360, ...TOUCH });
  await cleanStorageOnce(ctx);
  await fixSeed(ctx, opts.seed ?? 229);
  if (opts.tl) await ctx.addInitScript(TL_INIT);
  if (opts.ac) await ctx.addInitScript(AC_INIT);
  const p = await ctx.newPage();
  await newGameToLife(p, { era: opts.era ?? 'present' });
  await sleep(500);
  return { ctx, p };
}
const center = async (p, testid) => {
  const b = await p.getByTestId(testid).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const sv = async (p) => {
  const g = JSON.parse((await readRaw(p, GAME_KEY)) || 'null');
  const s = JSON.parse((await readRaw(p, SETTINGS_KEY)) || 'null');
  return { game: g && g.data, settings: s && (s.data ?? s) };
};
const errs = () => con.take();

// ===== A01 배속 버튼 난타 =====
if (want('M4-A01')) {
  await runCase(
    { id: 'M4-A01', cat: '공격', title: '배속 버튼 난타(1·2·4·8배를 무작위로 사람 속도 100번 + 한 틱에 200번): 눌린 표시는 정확히 하나·설정 저장과 일치·바가 되감기지 않음·콘솔 오류 0', steps: '새 판 → (가) 좌표 클릭 100번 간격 40ms (나) DOM click() 200번 한 번에 → 상태 비교 → 3초 더 진행', expected: 'aria-pressed 하나, 저장 speed = 화면 speed, 뒤이어 정상 진행, 오류 0' },
    async () => {
      const { ctx, p } = await game({ tl: true });
      const bad = [];
      const btns = [1, 2, 4, 8];
      const pos = {};
      for (const s of btns) {
        const b = await p.locator(`[data-speed="${s}"]`).boundingBox();
        pos[s] = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      }
      let seed = 7;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      for (let i = 0; i < 100; i++) {
        const s = btns[Math.floor(rnd() * 4)];
        await p.mouse.click(pos[s].x, pos[s].y);
        await sleep(40);
      }
      let d = await readDash(p);
      let st = await sv(p);
      const pressed1 = await p.evaluate(() => [...document.querySelectorAll('[data-speed][aria-pressed="true"]')].map((b) => b.getAttribute('data-speed')));
      if (pressed1.length !== 1) bad.push(`(가) 눌린 배속 ${pressed1.length}개 ${pressed1}`);
      if (st.settings && st.settings.speed !== Number(pressed1[0])) bad.push(`(가) 저장 speed ${st.settings.speed} ≠ 화면 ${pressed1[0]}`);
      await p.evaluate(() => {
        const bs = [...document.querySelectorAll('[data-speed]')];
        for (let i = 0; i < 200; i++) bs[(i * 7) % 4].click();
      });
      await sleep(300);
      const pressed2 = await p.evaluate(() => [...document.querySelectorAll('[data-speed][aria-pressed="true"]')].map((b) => b.getAttribute('data-speed')));
      st = await sv(p);
      if (pressed2.length !== 1) bad.push(`(나) 눌린 배속 ${pressed2.length}개`);
      if (st.settings && String(st.settings.speed) !== pressed2[0]) bad.push(`(나) 저장 speed ${st.settings.speed} ≠ 화면 ${pressed2[0]}`);
      const a0 = (await readDash(p)).age;
      await p.locator('[data-speed="8"]').click();
      await sleep(3000);
      const a1 = (await readDash(p)).age;
      if (a1 <= a0) bad.push(`난타 뒤 진행이 멈춤 ${a0}→${a1}`);
      const tl = await p.evaluate(() => window.__tl);
      for (let i = 1; i < tl.length; i++) if (tl[i].a === tl[i - 1].a && tl[i].w < tl[i - 1].w - 0.001) bad.push(`바가 되감김 나이 ${tl[i].a}: ${tl[i - 1].w}→${tl[i].w}`);
      await shot(p, 'A01', 'after');
      const c = errs();
      if (c.length) bad.push(`콘솔 ${JSON.stringify(c).slice(0, 200)}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? [...new Set(bad)].slice(0, 5).join(' / ') : `(가) 끝 배속 ${pressed1}, (나) 끝 배속 ${pressed2}, 저장과 일치, 이후 나이 ${a0}→${a1}, 바 되감김 0, 오류 0`, shots: ['qa/screenshots/003/M4-A01-after.png'] };
    },
  );
}

// ===== A02 일시정지 연타 =====
if (want('M4-A02')) {
  await runCase(
    { id: 'M4-A02', cat: '공격', title: '일시정지 연타(홀수·짝수 번): 마지막 상태와 버튼 이름·저장 paused·시계가 모두 일치하고 멈춘 채/흐르는 채로 고정', steps: '새 판 → 일시정지 31번(40ms) → 3초 관찰 → 22번 → 3초 관찰 → DOM click 101번 → 관찰', expected: '홀수면 멈춤(다시 진행·저장 paused true·바 불변), 짝수면 흐름(일시정지·저장 paused false·바 증가)' },
    async () => {
      const { ctx, p } = await game();
      const bad = [];
      const notes = [];
      const c = await center(p, 'pause');
      const check = async (label, expectPaused) => {
        const d1 = await readDash(p);
        const g1 = (await sv(p)).game;
        await sleep(2500);
        const d2 = await readDash(p);
        const moved = d1.fillStyle !== d2.fillStyle || d1.age !== d2.age;
        if (expectPaused) {
          if (d2.paused !== 'true' || d2.pauseText !== '다시 진행') bad.push(`${label}: 멈춰야 하는데 ${d2.paused}/${d2.pauseText}`);
          if (moved) bad.push(`${label}: 멈춘 상태인데 바가 움직임`);
          if (g1.paused !== true) bad.push(`${label}: 저장 paused ${g1.paused}`);
        } else {
          if (d2.paused !== 'false' || d2.pauseText !== '일시정지') bad.push(`${label}: 흘러야 하는데 ${d2.paused}/${d2.pauseText}`);
          if (!moved) bad.push(`${label}: 흐르는 상태인데 바가 안 움직임`);
          if (g1.paused !== false) bad.push(`${label}: 저장 paused ${g1.paused}`);
        }
        notes.push(`${label}: ${d2.pauseText} ${d1.fillStyle}→${d2.fillStyle}`);
      };
      for (let i = 0; i < 31; i++) {
        await p.mouse.click(c.x, c.y);
        await sleep(40);
      }
      await check('31번(홀수)', true);
      await shot(p, 'A02', 'odd');
      for (let i = 0; i < 22; i++) {
        await p.mouse.click(c.x, c.y);
        await sleep(40);
      }
      await check('+22번(짝수 → 아직 멈춤)', true);
      await p.mouse.click(c.x, c.y);
      await sleep(100);
      await check('+1번(재개)', false);
      await p.evaluate(() => {
        const b = document.querySelector('[data-testid="pause"]');
        for (let i = 0; i < 101; i++) b.click();
      });
      await sleep(300);
      await check('DOM 101번(홀수 → 멈춤)', true);
      const e = errs();
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? [...new Set(bad)].join(' / ') + ' | ' : '') + notes.join(' | '), shots: ['qa/screenshots/003/M4-A02-odd.png'] };
    },
  );
}

// ===== A03 다음 결정으로 연타 + 선택 더블클릭 =====
if (want('M4-A03')) {
  await runCase(
    { id: 'M4-A03', cat: '공격', title: '「다음 결정으로」 연타(8배속, 40번×여러 라운드)·카드 선택 더블클릭: 카드는 한 번에 하나, 한 카드에 선택은 한 번, 건너뛰기가 선택지를 대신 고르지 않음', steps: '새 판 8배속 → 다음 결정으로를 30ms 간격 40번 → 카드가 뜨면 첫 선택지를 더블클릭 → 반복 6라운드. 기록의 「(선택:」 줄 수 = 선택한 카드 수', expected: '카드가 둘 이상 겹치지 않음, 선택 기록 수 = 카드 수, 나이 단조, 오류 0' },
    async () => {
      const { ctx, p } = await game();
      const bad = [];
      const notes = [];
      await p.locator('[data-speed="8"]').click();
      let cards = 0;
      let choicesMade = 0;
      for (let round = 0; round < 6; round++) {
        const c = await center(p, 'skip');
        for (let i = 0; i < 40; i++) {
          await p.mouse.click(c.x, c.y);
          await sleep(30);
          const n = await p.locator('[data-testid="choice-panel"]').count();
          if (n > 1) bad.push(`카드가 ${n}개 동시에`);
        }
        await sleep(300);
        const d = await readDash(p);
        if (!d.hasChoice) {
          notes.push(`라운드 ${round}: 카드 없음(나이 ${d.age})`);
          continue;
        }
        cards++;
        const before = (await sv(p)).game.history.length;
        const btn = p.locator('[data-testid="choice-panel"] .choice').first();
        await waitGuardChoice(p);
        const box = await btn.boundingBox();
        await p.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
        await sleep(500);
        const g = (await sv(p)).game;
        const added = g.history.slice(before);
        const picks = added.filter((h) => h.choice);
        if (picks.length !== 1) bad.push(`라운드 ${round}: 더블클릭 뒤 선택 기록 ${picks.length}개 (1 기대)`);
        choicesMade += picks.length;
        notes.push(`라운드 ${round}: 카드 「${d.choiceTitle}」(${d.age}세) → 기록 +${added.length}`);
      }
      const hist = (await sv(p)).game.history;
      let prev = -1;
      for (const h of hist) {
        if (h.age < prev) bad.push(`기록 나이 역전 ${prev}→${h.age}`);
        prev = h.age;
      }
      const texts = hist.map((h) => `${h.age}|${h.text}`);
      if (new Set(texts).size !== texts.length) bad.push('같은 기록이 중복됨');
      await shot(p, 'A03', 'after');
      const e = errs();
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: (bad.length ? [...new Set(bad)].slice(0, 6).join(' / ') + ' | ' : '') + `카드 ${cards}개·선택 기록 ${choicesMade}개 | ` + notes.join(' | '), shots: ['qa/screenshots/003/M4-A03-after.png'] };
    },
  );
}
async function waitGuardChoice(p) {
  await p.waitForFunction(() => {
    const b = document.querySelector('[data-testid="choice-panel"] .choice');
    return b && b.getAttribute('aria-disabled') !== 'true';
  }, null, { timeout: 4000 });
}

// ===== A04 다크 토글 연타 =====
if (want('M4-A04')) {
  await runCase(
    { id: 'M4-A04', cat: '공격', title: '다크 모드 토글 연타(51번·DOM 201번): 마지막 상태가 화면·aria-pressed·저장과 일치', steps: '새 판 → 다크 모드 51번(40ms) → 상태 비교 → DOM click 201번 → 상태 비교 → 새로고침', expected: '홀수 번이면 다크, 화면 배경색·aria-pressed·settings.theme·새로고침 뒤가 일치, 오류 0' },
    async () => {
      const { ctx, p } = await game();
      const bad = [];
      const bgOf = () => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const light = await bgOf();
      const c = await center(p, 'tool-dark');
      for (let i = 0; i < 51; i++) {
        await p.mouse.click(c.x, c.y);
        await sleep(40);
      }
      await sleep(250);
      let d = await readDash(p);
      let bg = await bgOf();
      let st = (await sv(p)).settings;
      if (d.darkOn !== 'true' || bg === light || st.theme !== 'dark') bad.push(`51번 뒤: aria-pressed ${d.darkOn}, 배경 ${bg}, 저장 ${st.theme}`);
      await p.evaluate(() => {
        const b = document.querySelector('[data-testid="tool-dark"]');
        for (let i = 0; i < 201; i++) b.click();
      });
      await sleep(300);
      d = await readDash(p);
      bg = await bgOf();
      st = (await sv(p)).settings;
      // 51(홀수)에서 201번 더 = 홀수 → 짝수 번째 합 252 → 라이트
      if (d.darkOn !== 'false' || bg !== light || st.theme !== 'light') bad.push(`+201번 뒤(총 252): aria-pressed ${d.darkOn}, 배경 ${bg}, 저장 ${st.theme}`);
      await p.reload({ waitUntil: 'load' });
      await p.waitForSelector('[data-testid="life-screen"]');
      await sleep(300);
      const d2 = await readDash(p);
      if (d2.darkOn !== d.darkOn) bad.push(`새로고침 뒤 ${d2.darkOn} ≠ ${d.darkOn}`);
      await shot(p, 'A04', 'after');
      const e = errs();
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '낮음', actual: bad.length ? bad.join(' / ') : '51번 → 다크(화면·표시·저장 일치), 총 252번 → 라이트(일치), 새로고침 유지, 오류 0', shots: ['qa/screenshots/003/M4-A04-after.png'] };
    },
  );
}

// ===== A05 BGM 켜고 끄기 연타 =====
if (want('M4-A05')) {
  await runCase(
    { id: 'M4-A05', cat: '공격', title: 'BGM 켜고 끄기 연타(41번·DOM 301번): 소리 장치 1개 이하·마지막 상태와 표시·저장 일치·끈 뒤 음 예약 중단·콘솔 오류 0', steps: '새 판 → BGM 41번(50ms) → 장치 수·상태·저장 → DOM click 301번 → 3초 뒤 음 예약 변화', expected: '장치 ≤ 1(연타가 장치를 계속 만들지 않음), 홀수면 켜짐, 켜짐이면 음 예약이 늘고 꺼짐이면 멈춤, 슬라이더 표시 일치', },
    async () => {
      const { ctx, p } = await game({ ac: true });
      const bad = [];
      const acs = () => p.evaluate(() => ({ n: window.__ac.ctxs.length, states: window.__ac.ctxs.map((c) => c.state), osc: window.__ac.osc }));
      const c = await center(p, 'tool-bgm');
      for (let i = 0; i < 41; i++) {
        await p.mouse.click(c.x, c.y);
        await sleep(50);
      }
      await sleep(400);
      let d = await readDash(p);
      let a = await acs();
      let st = (await sv(p)).settings;
      if (d.bgmOn !== 'true' || !st.bgm.on) bad.push(`41번 뒤: aria-pressed ${d.bgmOn}, 저장 on=${st.bgm && st.bgm.on}`);
      if (a.n > 1) bad.push(`소리 장치 ${a.n}개 생성`);
      const o1 = a.osc;
      await sleep(2500);
      const o2 = (await acs()).osc;
      if (o2 <= o1) bad.push(`켜졌는데 음 예약이 안 늘어남 ${o1}→${o2}`);
      const vol = await p.getByTestId('bgm-volume-input').count();
      if (!vol) bad.push('켜졌는데 볼륨 슬라이더 없음');
      await p.evaluate(() => {
        const b = document.querySelector('[data-testid="tool-bgm"]');
        for (let i = 0; i < 301; i++) b.click();
      });
      await sleep(500);
      d = await readDash(p);
      a = await acs();
      st = (await sv(p)).settings;
      // 41 + 301 = 342 (짝수) → 꺼짐
      if (d.bgmOn !== 'false' || st.bgm.on) bad.push(`총 342번 뒤: aria-pressed ${d.bgmOn}, 저장 on=${st.bgm.on}`);
      const o3 = a.osc;
      await sleep(2500);
      const o4 = (await acs()).osc;
      if (o4 > o3 + 2) bad.push(`꺼졌는데 음 예약이 계속 늘어남 ${o3}→${o4}`);
      if (a.n > 1) bad.push(`장치 ${a.n}개`);
      await shot(p, 'A05', 'after');
      const e = errs();
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + `장치 ${a.n}개 ${a.states}, 음 예약 켠 동안 ${o1}→${o2}, 끈 뒤 ${o3}→${o4} (소리 자체는 미확인)`, shots: ['qa/screenshots/003/M4-A05-after.png'] };
    },
  );
}

// ===== A06 나가기 확인 더블탭 =====
if (want('M4-A06')) {
  await runCase(
    { id: 'M4-A06', cat: '공격', title: '나가기 → 확인 단계 더블탭: 둘째 탭이 「첫 화면으로 나가기」에 떨어지지 않고 안전한 쪽(돌아가기)에 떨어지거나 입력 가드에 막힌다', steps: '터치 360×740·320×568·데스크톱 1280×800에서 「나가기」를 같은 좌표로 두 번 — 간격 0·40·120·250·390ms. 그 뒤 화면과 저장 확인. 또 확인 단계의 두 버튼 좌표를 바로 두 번 탭', expected: '어떤 간격에서도 의도치 않게 첫 화면으로 나가지 않음(둘째 탭은 가드·돌아가기). 0.4초 뒤 정상 탭은 「첫 화면으로 나가기」로 나감' },
    async () => {
      const bad = [];
      const notes = [];
      const shots = [];
      for (const [name, vp, touch] of [['360x740', VP.m360, true], ['320x568', VP.m320, true], ['1280x800', VP.d1280, false]]) {
        for (const gap of [0, 40, 120, 250, 390]) {
          const ctx = await mkctx(browser, touch ? { viewport: vp, ...TOUCH } : { viewport: vp });
          await cleanStorageOnce(ctx);
          await fixSeed(ctx, 229);
          const p = await ctx.newPage();
          await newGameToLife(p);
          await sleep(900);
          const c = await center(p, 'tool-exit');
          if (touch) {
            await p.touchscreen.tap(c.x, c.y);
            if (gap) await sleep(gap);
            await p.touchscreen.tap(c.x, c.y);
          } else {
            await p.mouse.click(c.x, c.y);
            if (gap) await sleep(gap);
            await p.mouse.click(c.x, c.y);
          }
          await sleep(500);
          const s = await p.evaluate(() => ({ screen: ['title-screen', 'life-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)), ask: !!document.querySelector('[data-testid="exit-ask"]'), focus: document.activeElement?.getAttribute('data-testid') }));
          notes.push(`${name} 간격 ${gap}ms → ${s.screen}, 확인 단계 ${s.ask ? '열림' : '닫힘'}, 포커스 ${s.focus}`);
          if (s.screen !== 'life-screen') bad.push(`${name} 간격 ${gap}: 둘째 탭이 첫 화면으로 나가 버림`);
          if (gap === 120 && name === '360x740') shots.push(await shot(p, 'A06', `gap120-${name}`));
          await ctx.close();
        }
      }
      // 확인 단계가 열린 직후 두 버튼 좌표를 연속으로 탭(손가락이 빨리 두 번)
      {
        const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
        await cleanStorageOnce(ctx);
        await fixSeed(ctx, 229);
        const p = await ctx.newPage();
        await newGameToLife(p);
        await sleep(900);
        const c = await center(p, 'tool-exit');
        await p.touchscreen.tap(c.x, c.y);
        await p.waitForSelector('[data-testid="exit-yes"]');
        const y = await center(p, 'exit-yes');
        await p.touchscreen.tap(y.x, y.y); // 가드 안(0.4초 이내)
        await sleep(100);
        const s1 = await p.evaluate(() => !!document.querySelector('[data-testid="life-screen"]'));
        notes.push(`확인 단계 열린 직후 「첫 화면으로 나가기」 탭 → ${s1 ? '막힘(가드)' : '나가 버림'}`);
        if (!s1) bad.push('확인 단계가 열린 직후(가드 안) 바로 나가짐');
        await sleep(600);
        await p.touchscreen.tap(y.x, y.y);
        await sleep(500);
        const s2 = await p.evaluate(() => !!document.querySelector('[data-testid="title-screen"]'));
        if (!s2) bad.push('가드가 풀린 뒤 정상 탭이 첫 화면으로 나가지 못함');
        notes.push(`가드 해제 뒤 탭 → ${s2 ? '첫 화면' : '안 나감'}`);
        await ctx.close();
      }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots };
    },
  );
}

// ===== A07 카드 선택 더블클릭·새로고침 전 상태(저장된 선택지 카드) =====
if (want('M4-A07')) {
  await runCase(
    { id: 'M4-A07', cat: '공격', title: '저장된 선택지 카드에서 선택 더블클릭·카드가 뜬 직후 즉시 클릭(입력 가드): 한 번만 선택되고 다음 카드가 대신 선택되지 않음', steps: '선택지 대기 저장을 열고(0.4초 가드) 바로 클릭 → 막힘, 700ms 뒤 첫 선택지 더블클릭 → 기록에 선택 1건, 다음 카드가 있으면 그것은 선택 안 됨', expected: '가드 안 클릭 무시, 더블클릭이어도 선택 1건' },
    async () => {
      const bad = [];
      const notes = [];
      const { ctx, page: p } = await openState(browser, 'pending', { vp: { width: 360, height: 740, touch: true } });
      // openState가 이미 300ms 기다림 — 새로 열자마자의 가드를 보려면 새로고침 직후로
      await p.reload({ waitUntil: 'domcontentloaded' });
      await p.waitForSelector('[data-testid="choice-panel"]');
      const before = (await sv(p)).game;
      const box = await p.locator('[data-testid="choice-panel"] .choice').first().boundingBox();
      await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(150);
      const mid = (await sv(p)).game;
      if (mid.history.length !== before.history.length) bad.push('가드 안(진입 직후) 클릭이 선택으로 처리됨');
      notes.push(`가드 안 클릭 → 기록 ${before.history.length}→${mid.history.length}`);
      await sleep(700);
      const box2 = await p.locator('[data-testid="choice-panel"] .choice').first().boundingBox();
      const titleBefore = await p.getByTestId('choice-title').textContent();
      await p.mouse.dblclick(box2.x + box2.width / 2, box2.y + box2.height / 2);
      await sleep(600);
      const g = (await sv(p)).game;
      const added = g.history.slice(before.history.length);
      const picks = added.filter((h) => h.choice);
      notes.push(`더블클릭 → 기록 +${added.length}, 선택 ${picks.length}건 「${titleBefore}」`);
      if (picks.length !== 1) bad.push(`더블클릭 뒤 선택 기록 ${picks.length}건`);
      await shot(p, 'A07', 'after');
      const e = errs();
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots: ['qa/screenshots/003/M4-A07-after.png'] };
    },
  );
}

await browser.close();
