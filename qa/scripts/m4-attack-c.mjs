// QA-003 M4 공격(3): 진입 직후 더블탭(입력 가드)·다른 탭이 저장을 바꿈·긴 이름·헤더 연도. 사용: node qa/scripts/m4-attack-c.mjs [id-prefix]
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, newGameToLife, readDash, shot, sleep, runCase, con, PROD, TOUCH, VP, waitGuard, readRaw, GAME_KEY, SETTINGS_KEY, OUT, openTitle, toRoulette, skipToBirth, whichScreen } from './m4-lib.mjs';
import { openState, loadSave } from './m4-states.mjs';

const only = process.argv[2] || '';
const want = (id) => !only || id.startsWith(only);
const browser = await launch();
const errs = () => con.take();

// ===== A08 진입 직후 더블탭 =====
if (want('M4-A08')) {
  await runCase(
    { id: 'M4-A08', cat: '공격', title: '대시보드 진입 직후 더블탭(입력 가드): 「살아가기」·「이어서 살기」·「다시 태어나기」 더블탭의 둘째 입력이 같은 자리의 컨트롤(배속·다음 결정으로·자동 모드·일시정지·도구)에 떨어져도 아무 일도 일어나지 않는다', steps: '360×740 터치·320×568·1280×800에서 (가) 출생신고 「살아가기」 (나) 첫 화면 「이어서 살기」 를 같은 좌표로 두 번 탭(간격 0·40·120·250·390ms) → 대시보드의 배속·자동 모드·일시정지·테마·BGM 상태가 처음 그대로인지', expected: '둘째 탭은 가드에 막혀 상태 불변(배속 1·자동 꺼짐·일시정지 안 됨·다크 꺼짐·BGM 꺼짐)' },
    async () => {
      const bad = [];
      const notes = [];
      const shots = [];
      const state = (p) => p.evaluate(() => ({ speed: document.querySelector('[data-speed][aria-pressed="true"]')?.getAttribute('data-speed'), auto: document.querySelector('[data-testid="auto"]')?.getAttribute('aria-pressed'), paused: document.querySelector('[data-testid="pause"]')?.getAttribute('data-paused'), dark: document.querySelector('[data-testid="tool-dark"]')?.getAttribute('aria-pressed'), bgm: document.querySelector('[data-testid="tool-bgm"]')?.getAttribute('aria-pressed'), exitAsk: !!document.querySelector('[data-testid="exit-ask"]'), screen: ['life-screen', 'title-screen', 'birth-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)) }));
      let swept = 0;
      const boundary = [];
      for (const [name, vp, touch] of [['360x740', VP.m360, true], ['320x568', VP.m320, true], ['1280x800', VP.d1280, false]]) {
        for (const via of ['살아가기', '이어서 살기']) {
          for (const gap of [0, 40, 120, 250, 390]) {
            const ctx = await mkctx(browser, touch ? { viewport: vp, ...TOUCH } : { viewport: vp });
            await cleanStorageOnce(ctx);
            await fixSeed(ctx, 229);
            await ctx.addInitScript(() => {
              window.__clicks = [];
              window.__mounts = [];
              document.addEventListener('click', (e) => window.__clicks.push({ t: performance.now(), id: e.target.closest && e.target.closest('[data-testid]') ? e.target.closest('[data-testid]').getAttribute('data-testid') : null }), true);
              const start = () => new MutationObserver(() => { const l = document.querySelector('[data-testid="life-screen"]'); if (l && !window.__lifeSeen) { window.__lifeSeen = true; window.__mounts.push(performance.now()); } if (!l) window.__lifeSeen = false; }).observe(document.documentElement, { subtree: true, childList: true });
              document.documentElement ? start() : document.addEventListener('DOMContentLoaded', start);
            });
            const p = await ctx.newPage();
            await openTitle(p);
            await toRoulette(p);
            await skipToBirth(p);
            let btn;
            if (via === '이어서 살기') {
              // 대시보드로 가서 나가기 → 첫 화면
              await waitGuard(p, 'next-life');
              await p.getByTestId('next-life').click();
              await p.waitForSelector('[data-testid="life-screen"]');
              await sleep(900);
              await p.getByTestId('tool-exit').click();
              await waitGuard(p, 'exit-yes');
              await p.getByTestId('exit-yes').click();
              await p.waitForSelector('[data-testid="resume"]');
              await waitGuard(p, 'resume');
              btn = 'resume';
            } else {
              await waitGuard(p, 'next-life');
              btn = 'next-life';
            }
            const box = await p.getByTestId(btn).boundingBox();
            const x = box.x + box.width / 2;
            const y = box.y + box.height / 2;
            if (touch) {
              await p.touchscreen.tap(x, y);
              if (gap) await sleep(gap);
              await p.touchscreen.tap(x, y);
            } else {
              await p.mouse.click(x, y);
              if (gap) await sleep(gap);
              await p.mouse.click(x, y);
            }
            await sleep(500);
            const s = await state(p);
            swept++;
            const wantPaused = via === '이어서 살기' ? 'true' : 'false'; // 나가기는 일시정지로 저장하므로 이어서 살기 뒤에는 멈춘 상태가 맞다
            const timing = await p.evaluate(() => ({ mounts: window.__mounts, clicks: window.__clicks }));
            const lastMount = timing.mounts[timing.mounts.length - 1];
            const lifeClicks = timing.clicks.filter((c) => c.t >= lastMount - 5);
            const afterMount = lifeClicks.filter((c) => c.id !== 'next-life' && c.id !== 'resume');
            const firstIdx = timing.clicks.findIndex((c) => c.id === btn);
            const secondT = firstIdx >= 0 && timing.clicks.length > firstIdx + 1 ? timing.clicks[firstIdx + 1].t : null; // 둘째 탭은 같은 자리의 (새 화면의) 다른 요소에 떨어진다
            const since = secondT !== null && lastMount !== undefined ? Math.round(secondT - lastMount) : null;
            const legit = since !== null && since >= 400; // 가드(400ms)가 풀린 뒤의 둘째 탭은 정당한 두 번째 입력(더블탭이 아니라 별개 탭)
            if (legit) { boundary.push(`${name} ${via} 간격 ${gap}: 둘째 탭이 대시보드 진입 ${since}ms 뒤(가드 해제 뒤) — 정당한 탭으로 보고 제외`); swept--; await ctx.close(); continue; }
            const changed = s.speed !== '1' || s.auto !== 'false' || s.paused !== wantPaused || s.dark !== 'false' || s.bgm !== 'false' || s.exitAsk;
            if (s.screen !== 'life-screen') bad.push(`${name} ${via} 간격 ${gap}: 화면 ${s.screen}`);
            if (changed) bad.push(`${name} ${via} 간격 ${gap}: 둘째 탭이 컨트롤을 눌렀다(진입 ${since}ms 뒤) ${JSON.stringify(s)}`);
            if (gap === 120 && name === '360x740') shots.push(await shot(p, 'A08', `${via === '살아가기' ? 'live' : 'resume'}-gap120-${name}`));
            await ctx.close();
          }
        }
      }
      notes.push(`3 뷰포트 × 2 경로 × 5 간격 중 유효 ${swept}조합(둘째 탭이 대시보드 진입 400ms 안) 둘째 탭 뒤 상태 점검`);
      if (boundary.length) notes.push(`제외 ${boundary.length}건: ${boundary.join(' ; ')}`);
      const e = errs();
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: (bad.length ? [...new Set(bad)].slice(0, 6).join(' / ') + ' | ' : '') + notes.join(' | '), shots };
    },
  );
}

// ===== A09 다른 탭이 저장을 바꿈 =====
if (want('M4-A09')) {
  await runCase(
    { id: 'M4-A09', cat: '공격', title: '다른 탭이 저장을 바꾸면(밀린 화면): 이 탭이 멈추고 「저장 안내」 공통 헤더가 뜨며, 「이 탭에서 이어하기」로 최신 저장을 이어받는다 — 그 사이 이 탭이 저장을 덮어쓰지 않음', steps: '탭 A 대시보드(진행 중) → 탭 B가 같은 저장을 더 진행된 상태(나이 30)로 덮어씀 → 탭 A 확인 → 이어하기 → 나이·진행', expected: 'A는 밀린 화면(로고 헤더·h1)으로 멈추고, 이어하기 뒤 B의 저장(나이 ≥ 30)에서 계속, 저장이 되감기지 않음' },
    async () => {
      const bad = [];
      const notes = [];
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await cleanStorageOnce(ctx);
      await fixSeed(ctx, 229);
      const a = await ctx.newPage();
      await newGameToLife(a);
      await a.locator('[data-speed="8"]').click();
      await sleep(1500);
      const b = await ctx.newPage();
      await b.goto(PROD, { waitUntil: 'load' });
      await sleep(500);
      const rawBefore = await readRaw(b);
      await b.evaluate(([k, v]) => localStorage.setItem(k, v), [GAME_KEY, loadSave('present', 'age30')]);
      await sleep(700);
      await a.bringToFront();
      await sleep(500);
      const scr = await whichScreen(a);
      notes.push(`탭 A 화면 ${scr}`);
      if (scr !== 'superseded-screen') bad.push(`탭 A가 밀린 화면이 아님(${scr})`);
      const info = await a.evaluate(() => ({ h1: document.querySelector('h1')?.textContent.trim(), head: !!document.querySelector('header [role="img"], header svg'), headText: document.querySelector('header')?.textContent.replace(/\s+/g, ' ').trim() }));
      notes.push(`h1 「${info.h1}」 헤더 ${info.headText}`);
      if (!info.head) bad.push('밀린 화면에 공통 헤더(로고)가 없음');
      await shot(a, 'A09', 'superseded');
      await sleep(1500);
      const raw2 = await readRaw(a);
      const g2 = JSON.parse(raw2).data;
      if (g2.age < 30) bad.push(`A가 멈춰 있는 동안 저장이 되감김(나이 ${g2.age})`);
      await waitGuard(a, 'take-over');
      await a.getByTestId('take-over').click();
      await a.waitForSelector('[data-testid="life-screen"], [data-testid="title-screen"]', { timeout: 5000 });
      await sleep(600);
      const d = await readDash(a);
      notes.push(`이어하기 뒤 ${d.screen} 나이 ${d.age}`);
      if (d.screen !== 'life-screen' || d.age < 30) bad.push(`이어하기 뒤 ${d.screen} 나이 ${d.age} (30 이상 기대)`);
      await sleep(1500);
      const d2 = await readDash(a);
      notes.push(`1.5초 뒤 나이 ${d2.age}, 진행 ${d2.fillStyle}`);
      const e = errs();
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots: ['qa/screenshots/003/M4-A09-superseded.png'] };
    },
  );
}

// ===== A10 긴 이름·특수 이름 =====
if (want('M4-A10')) {
  await runCase(
    { id: 'M4-A10', cat: '공격', title: '변조된 이름(한글 20자·영문 W 40자·이모지 ZWJ·RTL·태그·공백·줄바꿈)이 헤더·프로필·인생 기록 고정 줄·엔딩에 들어가도 레이아웃이 깨지거나 스크립트가 실행되지 않는다', steps: '30세 저장·엔딩 저장의 character.name을 바꿔 심고 폭 320·360·1280 × 글자 100·200%에서 가로 넘침·h1 낱말·태그 삽입을 점검', expected: '가로 넘침 0(또는 기록), 태그는 글자 그대로, 스크립트 실행 0, 크래시 0' },
    async () => {
      const bad = [];
      const notes = [];
      const shots = [];
      const names = {
        hangul20: '가나다라마바사아자차카타파하거너더러머버',
        latinW40: 'W'.repeat(40),
        emojiZwj: '👨‍👩‍👧‍👦🏳️‍🌈김',
        rtl: 'مرحبا بالعالم',
        tag: '<img src=x onerror=window.__xss=1>',
        spaces: '   김   ',
        newline: '김\n수\n호',
        zero: '김\u0000수',
      };
      let worst = 0;
      for (const era of ['present']) {
        for (const [tag, name] of Object.entries(names)) {
          for (const [screenTag, state] of [['dash', 'age30'], ['end', 'ending']]) {
            const base = JSON.parse(loadSave(era, state));
            if (base.data.character) base.data.character.name = name;
            const raw = JSON.stringify(base);
            for (const [w, h, font] of [[320, 568, 200], [360, 740, 100], [1280, 800, 100]]) {
              const ctx = await mkctx(browser, { viewport: { width: w, height: h } });
              await ctx.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem(k, v); sessionStorage.setItem('__s', '1'); } } catch {} }, [GAME_KEY, raw]);
              const p = await ctx.newPage();
              await p.goto(PROD, { waitUntil: 'load' });
              await sleep(600);
              if (font !== 100) {
                await p.evaluate((f) => { const st = document.createElement('style'); st.textContent = `html{font-size:${f}% !important}`; document.head.appendChild(st); }, font);
                await sleep(300);
              }
              const scr = await whichScreen(p);
              const m = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth, xss: window.__xss ?? null, imgs: document.querySelectorAll('img[onerror]').length, h1: document.querySelector('h1')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 30) }));
              const label = `${tag}/${screenTag}/${w}x${h}/${font}%`;
              if (['error-screen', 'BLANK', 'unknown'].includes(scr)) bad.push(`${label}: 화면 ${scr}`);
              else if (scr !== (screenTag === 'dash' ? 'life-screen' : 'ending-screen')) notes.push(`${label}: 저장이 거부됨(${scr})`);
              if (m.xss) bad.push(`${label}: 스크립트 실행`);
              if (m.imgs) bad.push(`${label}: 태그가 DOM으로 삽입`);
              if (m.over > 0) {
                worst = Math.max(worst, m.over);
                bad.push(`${label}: 가로 넘침 ${m.over}px`);
                if (shots.length < 4) shots.push(await shot(p, 'A10', `${tag}-${screenTag}-${w}`));
              }
              await ctx.close();
            }
          }
        }
      }
      if (shots.length === 0) {
        // 대표 화면 하나
        const base = JSON.parse(loadSave('present', 'age30'));
        base.data.character.name = names.hangul20;
        const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
        await ctx.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem(k, v); sessionStorage.setItem('__s', '1'); } } catch {} }, [GAME_KEY, JSON.stringify(base)]);
        const p = await ctx.newPage();
        await p.goto(PROD, { waitUntil: 'load' });
        await sleep(700);
        shots.push(await shot(p, 'A10', 'hangul20-dash-360'));
        await ctx.close();
      }
      const e = errs();
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      return { verdict: bad.length ? (worst > 0 && bad.every((b) => /가로 넘침/.test(b)) ? 'RECORD' : 'FAIL') : 'PASS', severity: '낮음(변조 입력)', actual: (bad.length ? [...new Set(bad)].slice(0, 8).join(' / ') + ` (총 ${bad.length}) | ` : '') + notes.slice(0, 6).join(' | '), shots };
    },
  );
}

// ===== N14 헤더 연도 = 출생 연도 + 나이 =====
if (want('M4-N14')) {
  await runCase(
    { id: 'M4-N14', cat: '정상', title: '헤더의 「{연도}년」 = 출생 연도 + 나이, 인생 기록 첫 줄의 출생 연월과 프로필 「출생」이 같다(세 세상)', steps: '세 세상의 저장(0·10·30·55·78세)을 열어 헤더 연도·프로필 출생·기록 첫 줄을 대조', expected: '헤더 연도 = 출생 연도 + 나이, 프로필 출생 = 기록 첫 줄 연월' },
    async () => {
      const bad = [];
      const notes = [];
      for (const era of ['past', 'present', 'future']) {
        for (const tag of ['infant', 'age10', 'age30', 'age55', 'age78']) {
          if (!fs.existsSync(path.join(OUT, 'saves', `${era}-${tag}.json`))) continue;
          const { ctx, page: p } = await openState(browser, 'age30', { era, saveTag: tag, vp: { width: 360, height: 740, touch: true } });
          const r = await p.evaluate(() => ({
            year: document.querySelector('[data-testid="life-year"]')?.textContent.trim(),
            age: parseInt(document.querySelector('[data-testid="life-age"] b').textContent, 10),
            born: document.querySelector('[data-testid="profile-born"]')?.textContent.trim(),
            first: document.querySelector('[data-testid="log-row"] .log__text')?.textContent.trim().slice(0, 30),
          }));
          const by = /(\d{4})년 (\d+)월/.exec(r.born ?? '');
          const hy = /(\d{4})/.exec(r.year ?? '');
          if (!by || !hy) bad.push(`${era}/${tag}: 읽기 실패 ${JSON.stringify(r)}`);
          else {
            if (Number(hy[1]) !== Number(by[1]) + r.age) bad.push(`${era}/${tag}: 헤더 ${r.year} ≠ 출생 ${by[1]} + ${r.age}`);
            if (!r.first.startsWith(`${by[1]}년 ${by[2]}월`)) bad.push(`${era}/${tag}: 기록 첫 줄 「${r.first}」 ≠ 프로필 출생 ${r.born}`);
          }
          if (tag === 'age30') notes.push(`${era}: 출생 ${r.born} → ${r.age}세 헤더 ${r.year}`);
          await ctx.close();
        }
      }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots: [] };
    },
  );
}

// ===== N15 나가기 → 새로 태어나기 =====
if (want('M4-N15')) {
  await runCase(
    { id: 'M4-N15', cat: '정상', title: '나가기 → 첫 화면 「새로 태어나기」 → 확인 단계(이전 판 지우고 태어나기) → 룰렛: 이전 판이 사라지고 새 판이 시작된다. 돌아가기는 이어서 살기 상태 유지', steps: '새 판 → 3초 → 나가기 → 새로 태어나기 → 돌아가기 → 다시 새로 태어나기 → 확정', expected: '돌아가기는 아무 것도 안 지움, 확정 뒤 룰렛·저장이 새 판(기록 줄 0 또는 출생 전)' },
    async () => {
      const bad = [];
      const notes = [];
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await cleanStorageOnce(ctx);
      await fixSeed(ctx, 229);
      const p = await ctx.newPage();
      await newGameToLife(p);
      await sleep(3000);
      await p.getByTestId('tool-exit').click();
      await waitGuard(p, 'exit-yes');
      await p.getByTestId('exit-yes').click();
      await p.waitForSelector('[data-testid="begin-new"]');
      await waitGuard(p, 'begin-new');
      await p.getByTestId('begin-new').click();
      await p.waitForSelector('[data-testid="confirm-new-no"]');
      await waitGuard(p, 'confirm-new-no');
      const names = await p.evaluate(() => ({ yes: document.querySelector('[data-testid="confirm-new-yes"]')?.textContent.trim(), no: document.querySelector('[data-testid="confirm-new-no"]')?.textContent.trim() }));
      notes.push(`확인 단계 버튼 「${names.yes}」 / 「${names.no}」`);
      if (names.yes === '새로 태어나기') bad.push('확인 단계 확정 버튼 이름이 눌렀던 「새로 태어나기」와 같음(QM2-6)');
      await shot(p, 'N15', 'confirm');
      await p.getByTestId('confirm-new-no').click();
      await sleep(400);
      const hasResume = await p.getByTestId('resume').count();
      if (!hasResume) bad.push('돌아가기 뒤 이어서 살기가 사라짐');
      const sv0 = JSON.parse(await readRaw(p)).data;
      if (!sv0.history.length) bad.push('돌아가기만 눌렀는데 저장이 지워짐');
      await p.getByTestId('begin-new').click();
      await waitGuard(p, 'confirm-new-yes');
      await p.getByTestId('confirm-new-yes').click();
      await p.waitForSelector('[data-testid="roulette-screen"]', { timeout: 6000 });
      await sleep(600);
      const sv1 = JSON.parse(await readRaw(p)).data;
      notes.push(`새 판 저장: phase ${sv1.phase} 기록 ${sv1.history.length}줄`);
      if (sv1.history.length > 0 && sv1.phase === 'life') bad.push('새로 태어났는데 이전 판 기록이 남음');
      const e = errs();
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots: ['qa/screenshots/003/M4-N15-confirm.png'] };
    },
  );
}

await browser.close();
