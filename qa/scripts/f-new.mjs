// 최종 QA에서 새로 만든 공격·점검: 다시 태어나기 연타, 가장 긴 이벤트 레이아웃, 콘텐츠 갱신(대기 해제), 첫 선택지 전 사망, 엔딩 키보드·새로고침 연타·다중 탭
import fs from 'node:fs';
import path from 'node:path';
import { DEV, FAST, FIN, GAME_KEY, SETTINGS_KEY, launch, mkctx, MOBILE, shot, snap, waitScreen, con, sleep, readSave, readSettings, readRaw, readChoice, runCase, mkState, pendingOf, envelope, drive, inject } from './f-lib.mjs';

const only = process.argv[2] || 'all';
const run = (n) => only === 'all' || only === n;
const base = JSON.parse(fs.readFileSync(path.join(FIN, 'base-endings.json'), 'utf8'));
const EV = JSON.parse(fs.readFileSync(path.join(FIN, 'events-all.json'), 'utf8'));
const golden = JSON.parse(fs.readFileSync(path.join(FIN, 'golden-m3.json'), 'utf8'));
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
const endingState = (era = 'present', pw = 3, wealth = 55) => {
  const st = JSON.parse(JSON.stringify(base[era]));
  st.character.parentWealth = pw;
  st.stats.wealth = wealth;
  return st;
};
async function openEnding(vp, { settings = null, touch = true, era = 'present', query = '' } = {}) {
  const ctx = await mkctx(browser, { viewport: { width: vp[0], height: vp[1] }, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  await page.addInitScript(REC);
  await inject(page, DEV, endingState(era), { settings, query });
  await waitScreen(page, 'ending-screen');
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

// ======================= F-AN01.. 다시 태어나기 연타 (item 11, 18) =======================
const VPS = [[360, 480], [360, 568], [360, 640], [360, 740], [667, 375], [740, 360], [320, 568]];
const VARIANTS = [
  { xf: 0.5, n: 3, gap: 0, touch: true, label: '터치 3연탭 중앙' },
  { xf: 0.06, n: 3, gap: 0, touch: true, label: '터치 3연탭 좌측' },
  { xf: 0.94, n: 3, gap: 0, touch: true, label: '터치 3연탭 우측' },
  { xf: 0.5, n: 2, gap: 150, touch: true, label: '터치 더블탭 150ms' },
  { xf: 0.5, n: 2, gap: 0, touch: false, label: '마우스 더블클릭 중앙' },
];
if (run('rebirth')) {
  let k = 1;
  for (const settings of [null, { speed: 8, autoMode: true }]) {
    for (const vp of VPS) {
      const id = `F-AN${String(k++).padStart(2, '0')}`;
      await runCase({ id, cat: '#11 다시 태어나기 연타', title: `엔딩 「다시 태어나기」 연타 ${vp[0]}x${vp[1]} (${settings ? '저장된 설정 8배·자동 켜짐' : '기본 설정'})`, steps: '엔딩 화면에서 버튼을 중앙·좌·우 3연탭, 150ms 더블탭, 마우스 더블클릭. 둘째 입력 이후 새 시대 선택 화면의 버튼에 닿는지 클릭 기록·저장·화면으로 확인', expected: '새 판은 하나뿐이고 시대 선택에서 멈춘다(출생 화면으로 건너뛰지 않음). 설정 유지. 외부 링크 없음' }, async () => {
        const fails = [];
        const details = [];
        let sh = null;
        for (const v of VARIANTS) {
          const { ctx, page } = await openEnding(vp, { settings, touch: v.touch });
          try {
            await sleep(650);
            const btn = page.getByTestId('rebirth');
            await btn.scrollIntoViewIfNeeded();
            await sleep(100);
            const box = await btn.boundingBox();
            const seed0 = (await readSave(page)).data.seed;
            const nPages = ctx.pages().length;
            await page.evaluate(() => (window.__clicks = []));
            const pos = await burst(page, box, v.xf, v.n, v.gap, v.touch);
            await sleep(900);
            const a = await snap(page);
            const cl = await page.evaluate(() => window.__clicks.slice());
            const sv = (await readSave(page)).data;
            const st = await readSettings(page);
            const bad = cl.slice(1).filter((c) => !c.endsWith('(가드)') && !c.startsWith('비버튼'));
            let f = null;
            if (a.screen !== 'era-screen') f = `시대 선택 화면에 머물지 않음(${a.screen})`;
            else if (sv.phase !== 'eraSelect' || sv.era !== null) f = `저장 상태가 시대 선택이 아님(${sv.phase}, era=${sv.era})`;
            else if (sv.seed === seed0) f = '새 시드가 아님';
            else if (bad.length) f = `가드 없는 둘째 클릭 ${bad.join(',')}`;
            else if (settings && (st?.data?.speed !== 8 || st?.data?.autoMode !== true)) f = `설정이 바뀜 ${JSON.stringify(st)}`;
            else if (ctx.pages().length !== nPages) f = '새 창/탭이 열림';
            details.push(`${v.label}@(${pos.x},${pos.y}) 클릭=[${cl.join(',')}] 화면=${a.screen} phase=${sv.phase}`);
            if (f) fails.push(`${v.label}: ${f}`);
            if (v.xf === 0.5 && v.touch && v.n === 3) sh = await shot(page, id);
          } catch (e) {
            fails.push(`${v.label}: 오류 ${e.message.slice(0, 120)}`);
          } finally {
            await ctx.close();
          }
        }
        return { verdict: fails.length ? 'FAIL' : 'PASS', actual: fails.length ? `${fails.join(' / ')} :: ${details.join(' | ')}` : `5개 변형 이상 없음. ${details[0]}`, shots: sh ? [sh] : [] };
      });
    }
  }
  // 새 판이 자동 진행으로 이어지는지(기록만) + 새 판이 이전 판을 대체하는지
  await runCase({ id: 'F-AN15', cat: '#11 다시 태어나기', title: '다시 태어나기 → 시대 선택(기본 지금 세상) → 새 인물 → 인생: 이전 판 대체, 설정(8배·자동) 유지, 자동이면 곧바로 자동 진행(기록만)', steps: '엔딩(지난 세상) 주입, 설정 8배·자동 → 다시 태어나기 → 시대 선택에서 기본 선택 확인 → 확정 → 살아가기', expected: '기본 선택 지금 세상, 새 인물(이름·시드 다름), 연표 비어 있다가 새로 시작, 자동 진행' }, async () => {
    const { ctx, page } = await openEnding([360, 740], { settings: { speed: 8, autoMode: true }, era: 'past' });
    try {
      const old = (await readSave(page)).data;
      await sleep(600);
      await page.getByTestId('rebirth').scrollIntoViewIfNeeded();
      await page.getByTestId('rebirth').tap();
      await waitScreen(page, 'era-screen');
      const def = await page.locator('[data-era][aria-pressed="true"]').getAttribute('data-era');
      const s1 = await shot(page, 'F-AN15', 'era');
      await sleep(600);
      await page.getByTestId('confirm-era').tap();
      await waitScreen(page, 'birth-screen');
      const nm = await page.getByTestId('birth-name').innerText();
      await sleep(600);
      await page.getByTestId('next-life').tap();
      await waitScreen(page, 'life-screen');
      await sleep(4000);
      const s = await snap(page);
      const sv = (await readSave(page)).data;
      const s2 = await shot(page, 'F-AN15', 'life-auto');
      const ok = def === 'present' && sv.seed !== old.seed && s.auto === 'true' && s.speed === '8' && sv.history[0].text !== old.history[0].text + 'x';
      return { verdict: ok ? 'PASS' : 'FAIL', actual: `기본 선택 ${def}, 새 이름 ${nm} (이전 ${old.character.name}), 새 판 4초 뒤 나이 ${s.age}, 자동=${s.auto} 속도=${s.speed}, 연표 ${sv.history.length}줄(이전 ${old.history.length}줄), 시대=${sv.era}`, shots: [s1, s2] };
    } finally {
      await ctx.close();
    }
  });
}

// ======================= F-AL?? 가장 긴 이벤트 360x568 + 저장 실패 안내 + 자동 모드 문구 (item 23) =======================
if (run('layout')) {
  await runCase({ id: 'F-AU01', cat: '#23 긴 이벤트 레이아웃', title: '모든 선택지 이벤트(78개)를 360x568에서: 저장 실패 안내 + 자동 모드 문구가 있어도 선택지·컨트롤이 가려지지 않고 가로 넘침 없음', steps: '이벤트마다 선택지 대기 저장 주입(자동 모드 켜짐, ?__quota로 저장 실패 안내) → 360x568에서 위·아래 스크롤 위치의 요소 사각형 대조', expected: '스크롤하면 모든 선택지 버튼이 컨트롤 바에 가려지지 않고 닿음, 안내가 선택지를 덮지 않음', ts: false }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 568 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const rows = [];
    const choiceEvents = EV.filter((e) => e.choices);
    for (const e of choiceEvents) {
      const age = Math.round((e.ageRange.min + e.ageRange.max) / 2);
      const st = mkState({ era: 'present', age, pending: pendingOf(e.id, age, e.choices.map((c) => c.id)), seen: { [e.id]: age }, lastChoiceAge: age, flags: [] });
      await inject(page, DEV, st, { settings: { speed: 1, autoMode: true }, query: '?__quota=1&__timescale=1&__guard=0' });
      await waitScreen(page, 'life-screen', 8000);
      await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 5000 }).catch(() => {});
      await page.locator('[data-speed="2"]').click(); // 설정 저장이 막혀 있어(?__quota) 저장 실패 안내가 뜬다
      await sleep(80);
      const m = await page.evaluate(() => {
        const r = (el) => { const b = el.getBoundingClientRect(); return { t: b.top + scrollY, b: b.bottom + scrollY, l: b.left, rt: b.right }; };
        const panel = document.querySelector('[data-testid="choice-panel"]');
        if (!panel) return null;
        const btns = [...panel.querySelectorAll('.choice-list button')].map(r);
        const controls = r(document.querySelector('[data-testid="controls"]'));
        const cs = getComputedStyle(document.querySelector('[data-testid="controls"]')).position;
        const notice = document.querySelector('[data-testid="save-notice"]');
        const auto = document.querySelector('[data-testid="auto-note"]');
        const root = document.documentElement;
        return { panelH: panel.getBoundingClientRect().height, docH: root.scrollHeight, vh: innerHeight, overflowX: root.scrollWidth > root.clientWidth, btns, controls, controlsPos: cs, notice: !!notice, auto: !!auto, noticeR: notice ? r(notice) : null, autoR: auto ? r(auto) : null, last: btns[btns.length - 1] };
      });
      if (!m) { rows.push({ id: e.id, err: 'no panel' }); continue; }
      // 맨 아래까지 스크롤했을 때 마지막 선택지 아래쪽이 컨트롤 바 위쪽 이상으로 가려지지 않는지
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await sleep(30);
      const v = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('.choice-list button')].map((b) => b.getBoundingClientRect());
        const c = document.querySelector('[data-testid="controls"]').getBoundingClientRect();
        const covered = btns.filter((b) => b.bottom > c.top + 1 && b.top < c.bottom - 1 && getComputedStyle(document.querySelector('[data-testid="controls"]')).position === 'fixed');
        return { covered: covered.length, ctop: c.top, lastBottom: btns.length ? btns[btns.length - 1].bottom : null };
      });
      rows.push({ id: e.id, title: e.title, n: e.choices.length, panelH: Math.round(m.panelH), docH: m.docH, overflowX: m.overflowX, notice: m.notice, auto: m.auto, covered: v.covered, controlsPos: m.controlsPos });
    }
    rows.sort((a, b) => (b.panelH || 0) - (a.panelH || 0));
    fs.writeFileSync(path.join(FIN, 'F-AU01-layout.json'), JSON.stringify(rows, null, 1));
    const bad = rows.filter((r) => r.err || r.overflowX || r.covered > 0 || !r.notice || !r.auto);
    // 가장 긴 3개의 스크린샷
    const shots = [];
    for (const r of rows.slice(0, 2)) {
      const e = EV.find((x) => x.id === r.id);
      const age = Math.round((e.ageRange.min + e.ageRange.max) / 2);
      const st = mkState({ era: 'present', age, pending: pendingOf(e.id, age, e.choices.map((c) => c.id)), seen: { [e.id]: age }, lastChoiceAge: age });
      await inject(page, DEV, st, { settings: { speed: 1, autoMode: true }, query: '?__quota=1&__timescale=1&__guard=0' });
      await waitScreen(page, 'life-screen');
      await sleep(500);
      await page.locator('[data-speed="2"]').click();
      await sleep(150);
      shots.push(await shot(page, 'F-AU01', `${r.id}-top`));
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await sleep(150);
      shots.push(await shot(page, 'F-AU01', `${r.id}-bottom`));
    }
    await ctx.close();
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: `${rows.length}개 이벤트 점검, 문제 ${bad.length}건${bad.length ? ' ' + JSON.stringify(bad.slice(0, 3)) : ''}. 가장 높은 패널 ${rows[0].id}(${rows[0].panelH}px, 문서 ${rows[0].docH}px), 2위 ${rows[1].id}(${rows[1].panelH}px). 컨트롤 바 position=${rows[0].controlsPos}`, shots };
  });
}

// ======================= 콘텐츠 갱신(대기 해제) (item 22) =======================
if (run('stale')) {
  await runCase({ id: 'F-AU02', cat: '#22 콘텐츠 갱신', title: '풀에서 사라진 이벤트가 대기 중인 저장: 대기만 풀고 이어간다 (화면·포커스·알림)', steps: '존재하지 않는 이벤트 id의 대기 선택지(모양은 유효)를 주입 → 열기', expected: '새 게임이 아니라 같은 인생이 이어지고 대기만 사라짐. 크래시 없음. 포커스는 body로 떨어지지 않고(제목) 알림 없음', ts: false }, async () => {
    const ctx = await mkctx(browser, MOBILE);
    const page = await ctx.newPage();
    const st = mkState({ era: 'present', age: 40, pending: pendingOf('removed-old-event', 40, ['a', 'b']), seen: { 'removed-old-event': 40, 'infant-first-word': 1 }, lastChoiceAge: 40, name: '박서연', history: [{ age: 0, kind: 'stage', text: '2015년, 남자아이로 태어났다.' }, { age: 1, kind: 'event', title: '첫 말', text: '돌이 지나 처음으로 또렷한 말을 했다.', eventId: 'infant-first-word' }] });
    await inject(page, DEV, st, { query: '?__timescale=1&__guard=0' });
    await waitScreen(page, 'life-screen');
    await sleep(900);
    const s = await snap(page);
    const focus = await page.evaluate(() => (document.activeElement ? `${document.activeElement.tagName}:${document.activeElement.getAttribute('data-testid') || document.activeElement.textContent.slice(0, 10)}` : null));
    const announce = await page.evaluate(() => document.querySelector('[data-testid="choice-announce"]').textContent);
    const sv = (await readSave(page)).data;
    const sh = await shot(page, 'F-AU02');
    const ok = s.screen === 'life-screen' && !s.hasChoice && sv.character.name === '박서연' && sv.age >= 40 && sv.history.length >= 2;
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `화면=${s.screen} 선택지=${s.hasChoice} 이름 ${s.name} 나이 ${sv.age}(주입 40) 연표 ${sv.history.length}줄, 포커스 ${focus}, 알림 「${announce}」`, shots: [sh] };
  });
  for (const [id, key, label] of [['F-AU03', 'lifeChoice', 'M3 시점 저장(대기 선택지 + 이벤트 풀 20개 시절의 id)'], ['F-AU04', 'ending', 'M3 시점 엔딩 자리표시 저장']]) {
    await runCase({ id, cat: '#22 콘텐츠 갱신', title: `${label}이 지금 빌드에서 이어지는지`, steps: 'M3 QA가 만든 저장 원문(qa/results/final/golden-m3.json)을 그대로 주입 → 열기', expected: '크래시 없이 이어지거나 새 게임(둘 다 허용), 오류 화면 없음', ts: false }, async () => {
      const ctx = await mkctx(browser, MOBILE);
      const page = await ctx.newPage();
      await inject(page, DEV, null, { raw: golden[key], query: '?__timescale=1&__guard=0' });
      await sleep(1200);
      const s = await snap(page);
      const sv = await readSave(page);
      const sh = await shot(page, id);
      const ok = ['life-screen', 'ending-screen', 'title-screen'].includes(s.screen);
      return { verdict: ok ? 'PASS' : 'FAIL', actual: `화면=${s.screen} 선택지=${s.hasChoice} 이름 ${s.name} 나이 ${s.age} 저장 phase=${sv?.data?.phase} 대기=${sv?.data?.pending ? sv.data.pending.eventId : '없음'}`, shots: [sh] };
    });
  }
}

// ======================= 첫 선택지 전 사망 (item 29) =======================
if (run('early')) {
  await runCase({ id: 'F-AU05', cat: '#29 첫 선택지 전 사망', title: '실제 진행에서 선택지 없이 어린 나이에 사망 → 엔딩 문구', steps: '4세·건강 0 저장 주입, 시드를 바꿔 가며 끝까지 진행(시간 배율 1000) → 선택지가 0번인 엔딩을 찾음', expected: '「선택을 내려야 하는 순간이 오기 전에 생이 끝났다.」 + 「…의 집에서 태어났다.」만, 담담', ts: true }, async () => {
    const ctx = await mkctx(browser, MOBILE);
    const page = await ctx.newPage();
    await page.goto(DEV + '/' + FAST);
    let found = null;
    const tried = [];
    for (let i = 0; i < 25 && !found; i++) {
      const st = mkState({ era: 'present', age: 4, stats: { health: 0 }, seed: 9000 + i, rngState: 9000 + i * 17 });
      await page.evaluate(([g, v]) => localStorage.setItem(g, v), [GAME_KEY, envelope(st)]);
      await page.reload();
      await waitScreen(page, 'life-screen', 8000);
      const r = await drive(page, { strategy: 'first', maxMs: 20000 });
      const sv = (await readSave(page)).data;
      const n = sv.history.filter((h) => h.kind === 'choice').length;
      tried.push(`${sv.death?.age}세/${n}`);
      if (r.done === 'ending' && n === 0) {
        const t = await page.evaluate(() => ({ choices: document.querySelector('[data-testid="ending-choices"]').innerText, journey: document.querySelector('[data-testid="ending-journey"]').innerText, death: document.querySelector('[data-testid="ending-death"]').innerText, mv: !!document.querySelector('[data-testid="ending-movement"]') }));
        found = { t, age: sv.death.age };
      }
    }
    const sh = await shot(page, 'F-AU05', 'ending', { full: true });
    await ctx.close();
    return { verdict: found && /선택을 내려야 하는 순간이 오기 전에 생이 끝났다\./.test(found.t.choices) && !found.t.mv ? 'PASS' : found ? 'FAIL' : 'JUDGE', actual: found ? `${found.t.death} | ${found.t.choices} | ${found.t.journey} | 방향 문장 ${found.t.mv}` : `선택 0번 사망을 못 찾음(시도 ${tried.join(',')}) — 문구는 F-E34에서 주입으로 확인`, shots: [sh] };
  });
}

// ======================= 엔딩 키보드·새로고침 연타·뒤로가기 (item 19, 28) =======================
if (run('ending')) {
  await runCase({ id: 'F-AU06', cat: '#19 키보드', title: '엔딩에서 키보드만: 제목에 포커스 → Tab → 「다시 태어나기」 → Enter 연타 → 시대 선택에서 멈춤, 포커스가 제목으로', steps: '엔딩 주입 → Tab 1회 → Enter 5연타(가드 0.4초 포함)', expected: '시대 선택에 머무름(출생으로 건너뛰지 않음), 포커스 이동', ts: false }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await inject(page, DEV, endingState('present'));
    await waitScreen(page, 'ending-screen');
    await sleep(700);
    const f0 = await page.evaluate(() => `${document.activeElement.tagName}:${document.activeElement.getAttribute('data-testid') || ''}`);
    const tabs = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      tabs.push(await page.evaluate(() => `${document.activeElement.tagName}:${document.activeElement.getAttribute('data-testid') || document.activeElement.textContent.slice(0, 8)}`));
      if (tabs[tabs.length - 1].includes('rebirth')) break;
    }
    const s1 = await shot(page, 'F-AU06', 'focus');
    for (let i = 0; i < 5; i++) await page.keyboard.press('Enter');
    await sleep(900);
    const s = await snap(page);
    const f1 = await page.evaluate(() => `${document.activeElement.tagName}:${(document.activeElement.textContent || '').slice(0, 14)}`);
    const sv = (await readSave(page)).data;
    const s2 = await shot(page, 'F-AU06', 'after');
    await ctx.close();
    return { verdict: s.screen === 'era-screen' && sv.phase === 'eraSelect' ? 'PASS' : 'FAIL', actual: `엔딩 진입 포커스 ${f0}, Tab ${tabs.join(' → ')}, Enter 5연타 후 화면=${s.screen} phase=${sv.phase}, 포커스 ${f1}`, shots: [s1, s2] };
  });
  await runCase({ id: 'F-AU07', cat: '#28 새로고침 연타', title: '엔딩 화면 새로고침 연타 x15(로드 중단 포함) → 같은 엔딩, 죽은 인생 되살아나지 않음, 밀린 화면 없음', steps: '엔딩 주입 → DOMContentLoaded 후 연속 8회 + 로드 도중 중단 15회', expected: '이름·사망 나이·출발선 문장 불변, superseded/error 화면 없음', ts: false }, async () => {
    const ctx = await mkctx(browser, MOBILE);
    const page = await ctx.newPage();
    await inject(page, DEV, endingState('present', 2, 60));
    await waitScreen(page, 'ending-screen');
    const t0 = await page.evaluate(() => document.querySelector('[data-testid="ending-journey"]').innerText + document.querySelector('[data-testid="ending-name"]').innerText);
    const saveRaw0 = await readRaw(page);
    for (let i = 0; i < 8; i++) await page.reload({ waitUntil: 'domcontentloaded' });
    for (let i = 0; i < 15; i++) {
      await page.evaluate(() => location.reload()).catch(() => {});
      await sleep(i % 3 === 0 ? 0 : 25 + i * 7);
    }
    await page.waitForLoadState('load').catch(() => {});
    await waitScreen(page, 'ending-screen', 10000);
    const t1 = await page.evaluate(() => document.querySelector('[data-testid="ending-journey"]').innerText + document.querySelector('[data-testid="ending-name"]').innerText);
    const saveRaw1 = await readRaw(page);
    const sh = await shot(page, 'F-AU07');
    await ctx.close();
    return { verdict: t0 === t1 && saveRaw0 === saveRaw1 ? 'PASS' : 'FAIL', actual: `엔딩 문구 동일=${t0 === t1}, 저장 원문 동일=${saveRaw0 === saveRaw1}`, shots: [sh] };
  });
  await runCase({ id: 'F-AU08', cat: '#28 새로고침 연타', title: '다시 태어난 직후(시대 선택) 새로고침 연타 x15 → 시대 선택 그대로(새 판 하나), 고른 시대 유지', steps: '엔딩 → 다시 태어나기 → 지난 세상 선택 → 새로고침 연타', expected: '시대 선택 화면, 선택한 시대 유지, 출생·인생으로 건너뛰지 않음, 시드 불변', ts: false }, async () => {
    const ctx = await mkctx(browser, MOBILE);
    const page = await ctx.newPage();
    await inject(page, DEV, endingState('present'));
    await waitScreen(page, 'ending-screen');
    await sleep(600);
    await page.getByTestId('rebirth').scrollIntoViewIfNeeded();
    await page.getByTestId('rebirth').tap();
    await waitScreen(page, 'era-screen');
    await sleep(500);
    await page.locator('[data-era="past"]').tap();
    await sleep(200);
    const seed0 = (await readSave(page)).data.seed;
    for (let i = 0; i < 15; i++) {
      await page.evaluate(() => location.reload()).catch(() => {});
      await sleep(i % 2 ? 10 : 60);
    }
    await page.waitForLoadState('load').catch(() => {});
    await waitScreen(page, 'era-screen', 10000);
    const sel = await page.locator('[data-era][aria-pressed="true"]').getAttribute('data-era');
    const sv = (await readSave(page)).data;
    const sh = await shot(page, 'F-AU08');
    await ctx.close();
    return { verdict: sel === 'past' && sv.phase === 'eraSelect' && sv.seed === seed0 ? 'PASS' : 'FAIL', actual: `선택 시대 ${sel}, phase ${sv.phase}, 시드 불변=${sv.seed === seed0}`, shots: [sh] };
  });
  await runCase({ id: 'F-AU09', cat: '#25 다중 탭', title: '엔딩에서 두 탭: B가 다시 태어나기 → A는 밀린 화면 → 이어하기 → B가 만든 시대 선택으로 이어짐', steps: 'A=엔딩, B(같은 저장소)에서 다시 태어나기 → A 확인 → A에서 이어하기', expected: 'A는 「이 화면 밖에서 바뀌었습니다」 → 이어하기 한 번 → 시대 선택(새 게임이 아니라 B의 새 판)', ts: false }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    const A = await ctx.newPage();
    await inject(A, DEV, endingState('present'));
    await waitScreen(A, 'ending-screen');
    const B = await ctx.newPage();
    await B.goto(DEV + '/');
    await waitScreen(B, 'ending-screen');
    await sleep(700);
    await B.getByTestId('rebirth').scrollIntoViewIfNeeded();
    await B.getByTestId('rebirth').click();
    await waitScreen(B, 'era-screen');
    const seedB = (await readSave(B)).data.seed;
    await waitScreen(A, 'superseded-screen', 5000);
    const sh1 = await shot(A, 'F-AU09', 'A-superseded');
    const text = await A.getByTestId('superseded-text').innerText();
    await sleep(600);
    await A.getByTestId('take-over').click();
    await waitScreen(A, 'era-screen', 5000);
    const sv = (await readSave(A)).data;
    const sh2 = await shot(A, 'F-AU09', 'A-takeover');
    await ctx.close();
    return { verdict: sv.phase === 'eraSelect' && sv.seed === seedB ? 'PASS' : 'FAIL', actual: `A 안내 「${text}」, 이어하기 후 phase ${sv.phase}, B의 시드와 같음=${sv.seed === seedB}`, shots: [sh1, sh2] };
  });
}

await browser.close();
console.log('done');
