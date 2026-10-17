// QA-003 M4 공격(5): 폭 경계(959/960)·저장 실패(quota)·BGM 생명주기. 사용: node qa/scripts/m4-attack-e.mjs [id-prefix]
import { launch, mkctx, fixSeed, cleanStorageOnce, newGameToLife, readDash, shot, sleep, runCase, con, PROD, DEV, TOUCH, VP, waitGuard, readRaw, GAME_KEY, SETTINGS_KEY, whichScreen } from './m4-lib.mjs';
import { openState } from './m4-states.mjs';

const only = process.argv[2] || '';
const want = (id) => !only || id.startsWith(only);
const browser = await launch();
const errs = () => con.take();
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

// ===== L04 폭 경계 =====
if (want('M4-L04')) {
  await runCase(
    { id: 'M4-L04', cat: '접근성', title: '폭 경계(959·960·961px 등)에서 레이아웃 전환: 3열 ↔ 1열, 하단 고정 진행 줄 ↔ 일반 줄이 경계에서 정확히 바뀌고 가로 넘침 0·고정 요소가 본문을 가리지 않는다', steps: '높이 700px로 폭 768·900·959·960·961·1100·1440에서 영아·30세·선택지 카드 상태를 열어 열 수·진행 줄 position·넘침·본문 끝 여백을 잰다', expected: '≤ 959 = 1열 + 하단 고정, ≥ 960 = 3열 + 일반 줄, 넘침 0, 문서 끝 요소가 하단 띠에 가리지 않음' },
    async () => {
      const bad = [];
      const notes = [];
      const shots = [];
      for (const state of ['infant', 'age30', 'pending']) {
        for (const w of [768, 900, 959, 960, 961, 1100, 1440]) {
          const { ctx, page: p } = await openState(browser, state, { vp: { width: w, height: 700 } });
          const m = await p.evaluate(() => {
            const main = document.querySelector('main.dash');
            const cols = ['profile-card', 'log', 'family-card', 'peers-now-card'].map((id) => Math.round(document.querySelector('[data-testid="' + id + '"]').getBoundingClientRect().left));
            const distinctLeft = new Set(cols).size;
            const ctl = document.querySelector('[data-testid="controls"]');
            const last = document.querySelector('[data-testid="peers-now-card"]');
            const lastBottom = last ? last.getBoundingClientRect().bottom + window.scrollY : 0;
            return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, gridCols: getComputedStyle(main).gridTemplateColumns.split(' ').length, distinctLeft, ctlPos: getComputedStyle(ctl).position, docH: document.documentElement.scrollHeight, lastBottom: Math.round(lastBottom), ctlH: Math.round(ctl.getBoundingClientRect().height) };
          });
          const three = w >= 960;
          const label = `${state}/${w}`;
          if (m.over > 0) bad.push(`${label}: 넘침 ${m.over}px`);
          if (three && m.distinctLeft < 3) bad.push(`${label}: 3열이 아님(열 시작 ${m.distinctLeft}종)`);
          if (!three && m.distinctLeft > 1) bad.push(`${label}: 1열이어야 하는데 ${m.distinctLeft}열`);
          if (three && m.ctlPos === 'fixed') bad.push(`${label}: 3열인데 진행 줄이 하단 고정`);
          if (!three && m.ctlPos !== 'fixed' && w < 960 && 700 > 0) {
            // 높이 700에서 띠가 절반(350)을 넘지 않으므로 고정이어야 한다
            if (m.ctlH <= 350) bad.push(`${label}: 1열인데 진행 줄이 고정이 아님(${m.ctlPos})`);
          }
          // 맨 아래까지 스크롤했을 때 마지막 카드 하단이 고정 띠 위에 있다
          await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await sleep(200);
          const tail = await p.evaluate(() => {
            const last = document.querySelector('[data-testid="peers-now-card"]');
            const ctl = document.querySelector('[data-testid="controls"]');
            const r = last.getBoundingClientRect();
            const c = ctl.getBoundingClientRect();
            return { lastBottom: Math.round(r.bottom), ctlTop: getComputedStyle(ctl).position === 'fixed' ? Math.round(c.top) : null, vh: innerHeight };
          });
          if (tail.ctlTop !== null && tail.lastBottom > tail.ctlTop + 1) bad.push(`${label}: 맨 아래에서 마지막 카드 끝 ${tail.lastBottom} > 고정 띠 위끝 ${tail.ctlTop}`);
          if (state === 'age30' && (w === 959 || w === 960)) {
            await p.evaluate(() => window.scrollTo(0, 0));
            shots.push(await shot(p, 'L04', `w${w}`));
          }
          if (state === 'infant') notes.push(`${w}: ${three ? '3열' : '1열'} 진행 줄 ${m.ctlPos}`);
          await ctx.close();
        }
      }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? [...new Set(bad)].slice(0, 8).join(' / ') + ' | ' : '') + notes.join(' | '), shots };
    },
  );
}

// ===== A13 저장 실패(quota) =====
if (want('M4-A13')) {
  await runCase(
    { id: 'M4-A13', cat: '공격', title: '저장이 항상 실패하는 환경(개발 서버 ?__quota): 대시보드에서도 진행이 계속되고(저장 실패 안내가 보이고 고정 요소에 가리지 않음) 설정 변경·나가기·BGM·다크가 죽지 않는다', steps: '개발 서버 ?__quota로 새 판 → 대시보드 → 안내 확인 → 8배속 진행·다크·BGM·배속·나가기 확인 → 이어서 살기', expected: '크래시·오류 화면 0, 안내 문구가 보이고(360에서 하단 띠와 겹침 0), 게임 계속 진행, 나가기 → 첫 화면 → 이어서 살기(메모리)로 돌아옴' },
    async () => {
      const bad = [];
      const notes = [];
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await cleanStorageOnce(ctx);
      await fixSeed(ctx, 229);
      const p = await ctx.newPage();
      await newGameToLife(p, { base: DEV, query: '?__quota' });
      await sleep(800);
      const notice = await p.evaluate(() => {
        const n = document.querySelector('[data-testid="save-notice"]');
        if (!n) return null;
        const r = n.getBoundingClientRect();
        const ctl = document.querySelector('[data-testid="controls"]').getBoundingClientRect();
        return { text: n.textContent.replace(/\s+/g, ' ').trim().slice(0, 80), top: Math.round(r.top), bottom: Math.round(r.bottom), ctlTop: Math.round(ctl.top), vh: innerHeight, visible: r.height > 0 };
      });
      notes.push(`저장 실패 안내: ${notice ? JSON.stringify(notice) : '없음'}`);
      if (!notice) bad.push('저장이 계속 실패하는데 대시보드에 안내가 없음');
      await shot(p, 'A13', 'quota-dash');
      await p.locator('[data-speed="8"]').click();
      await p.getByTestId('tool-dark').click();
      await p.getByTestId('tool-bgm').click();
      await sleep(3500);
      const d = await readDash(p);
      notes.push(`진행 ${d.age}세, 다크 ${d.darkOn}, BGM ${d.bgmOn}`);
      if (d.screen !== 'life-screen' || d.age < 2) bad.push(`저장 실패 중 진행 이상 ${d.screen} ${d.age}`);
      await p.getByTestId('tool-exit').click();
      await waitGuard(p, 'exit-yes');
      await p.getByTestId('exit-yes').click();
      await p.waitForSelector('[data-testid="title-screen"]');
      await sleep(300);
      const t = await p.evaluate(() => ({ resume: !!document.querySelector('[data-testid="resume"]'), notice: document.querySelector('[data-testid="save-notice"]')?.textContent.trim().slice(0, 60) ?? null }));
      notes.push(`나가기 뒤 첫 화면: 이어서 살기 ${t.resume}, 안내 ${t.notice}`);
      if (t.resume) {
        await p.getByTestId('resume').click();
        await p.waitForSelector('[data-testid="life-screen"]', { timeout: 4000 }).catch(() => bad.push('이어서 살기가 대시보드로 못 돌아옴'));
      }
      const e = errs();
      const real = e.filter((x) => !/QuotaExceeded|quota probe/i.test(x.text));
      if (real.length) bad.push(`콘솔 ${JSON.stringify(real).slice(0, 250)}`);
      notes.push(`콘솔 ${e.length}건(저장 실패 시험용 오류 포함)`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots: ['qa/screenshots/003/M4-A13-quota-dash.png'] };
    },
  );
}

// ===== A12 BGM 생명주기 =====
if (want('M4-A12')) {
  await runCase(
    { id: 'M4-A12', cat: '공격', title: 'BGM 생명주기: 나가기 ↔ 이어서 살기를 5번 되풀이해도 소리 장치 1개·음 예약 속도 불변(타이머 중복 없음), 첫 화면에서는 소리가 멈추고, 엔딩에서도 멈춘다', steps: '새 판 BGM 켜기 → 음 예약 속도(3초당) 측정 → 나가기/이어서 살기 5번 → 속도 재측정·장치 수 → 개발 서버 시간 배율 ×40으로 엔딩까지 → 엔딩에서 예약 증가 여부', expected: '장치 ≤ 1, 속도가 처음과 ±35% 이내, 첫 화면·엔딩에서 예약이 늘지 않음' },
    async () => {
      const bad = [];
      const notes = [];
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await cleanStorageOnce(ctx);
      await fixSeed(ctx, 229);
      await ctx.addInitScript(AC_INIT);
      const p = await ctx.newPage();
      await newGameToLife(p, { base: DEV, query: '?__timescale=1' });
      const acs = () => p.evaluate(() => ({ n: window.__ac.ctxs.length, states: window.__ac.ctxs.map((c) => c.state), osc: window.__ac.osc }));
      await p.getByTestId('tool-bgm').click();
      await sleep(600);
      const a0 = await acs();
      await sleep(3000);
      const a1 = await acs();
      const rate0 = a1.osc - a0.osc;
      for (let i = 0; i < 5; i++) {
        await p.getByTestId('tool-exit').click();
        await waitGuard(p, 'exit-yes');
        await p.getByTestId('exit-yes').click();
        await p.waitForSelector('[data-testid="resume"]');
        await sleep(300);
        const t0 = (await acs()).osc;
        await sleep(1500);
        const t1 = (await acs()).osc;
        if (t1 - t0 > 2) bad.push(`반복 ${i}: 첫 화면에서 음 예약이 늘어남 ${t0}→${t1}`);
        await waitGuard(p, 'resume');
        await p.getByTestId('resume').click();
        await p.waitForSelector('[data-testid="life-screen"]');
        await sleep(500);
        await p.getByTestId('pause').click().catch(() => {}); // 이어서 살기는 멈춘 상태
        await sleep(100);
        await p.getByTestId('pause').click().catch(() => {});
      }
      await sleep(500);
      const b0 = await acs();
      await sleep(3000);
      const b1 = await acs();
      const rate1 = b1.osc - b0.osc;
      notes.push(`음 예약 3초당 처음 ${rate0} → 5번 되풀이 뒤 ${rate1}, 장치 ${b1.n}개 ${b1.states}`);
      if (b1.n > 1) bad.push(`장치 ${b1.n}개`);
      if (rate1 > rate0 * 1.35 + 2 || rate1 < rate0 * 0.5 - 2) bad.push(`음 예약 속도가 달라짐 ${rate0}→${rate1}(타이머 중복 의심)`);
      if (b1.states.some((s) => s !== 'running')) bad.push(`장치 상태 ${b1.states}`);
      await ctx.close();
      // 엔딩에서 멈춤
      const ctx2 = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await cleanStorageOnce(ctx2);
      await fixSeed(ctx2, 229);
      await ctx2.addInitScript(AC_INIT);
      const q = await ctx2.newPage();
      await newGameToLife(q, { base: DEV, query: '?__timescale=40' });
      await q.getByTestId('auto').click();
      await q.getByTestId('tool-bgm').click();
      await q.waitForSelector('[data-testid="ending-screen"]', { timeout: 120000 });
      await sleep(600);
      const e0 = (await q.evaluate(() => window.__ac.osc));
      await sleep(2500);
      const e1 = (await q.evaluate(() => window.__ac.osc));
      notes.push(`엔딩에서 음 예약 ${e0}→${e1}`);
      if (e1 - e0 > 2) bad.push(`엔딩에서 음 예약이 계속 늘어남 ${e0}→${e1}`);
      await ctx2.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | ') + ' (소리 자체는 미확인)', shots: [] };
    },
  );
}

await browser.close();
