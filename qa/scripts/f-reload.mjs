// 공격 #9 새로고침 / #6 R-052 회귀 감시 / 뒤로·앞으로 / 저장 중 종료 / 탭 가림 / URL 변조
import fs from 'node:fs';
import path from 'node:path';
import { DEV, GAME_KEY, SETTINGS_KEY, RES_DIR, launch, mkctx, runCase, shot, snap, toBirth, toLife, waitScreen, readSave, readSettings, readRaw, readChoice, sleep, con } from './f-compat.mjs';

const G = 'a-reload';
const golden = JSON.parse(fs.readFileSync(path.join(RES_DIR, 'golden.json'), 'utf8'));
const browser = await launch();
const only = process.argv[2];
let n = 36; // 이 파일의 케이스 번호는 A36부터
const aId = () => `F-AL${String(n++).padStart(2, '0')}`;
const sid = (k) => `F-AL${String(n - 1).padStart(2, '0')}${k ? '-' + k : ''}`;

const mk = async (vp = [360, 740], query = '', extra = {}) => {
  const ctx = await mkctx(browser, { viewport: { width: vp[0], height: vp[1] }, ...extra });
  const page = await ctx.newPage();
  await page.goto(DEV + '/' + query);
  return { ctx, page };
};
const seedInit = async (ctx, game, settings) => {
  // 앱이 뜨기 전에 저장소를 채운다(매 로드마다). 변조/주입용.
  await ctx.addInitScript(([gk, g, sk, s]) => {
    if (location.protocol === 'about:') return; // about:blank에서는 저장소 접근이 거부된다(하니스 오류 방지)
    // 탭마다 sessionStorage가 달라 새 탭이 다시 심어 버리므로, 한 번만 심었다는 표시는 localStorage에 둔다
    if (localStorage.getItem('__qa_seeded')) return;
    if (g !== null) localStorage.setItem(gk, g);
    if (s !== null) localStorage.setItem(sk, s);
    localStorage.setItem('__qa_seeded', '1');
  }, [GAME_KEY, game, SETTINGS_KEY, settings]);
};
const keyOf = (s) => JSON.stringify([s.screen, s.name, s.age, s.choiceKey]);
const modAge = (o, age) => { const c = JSON.parse(JSON.stringify(o)); c.data.age = age; return c; };

// ---------- 각 화면에서 새로고침 ----------
if (!only || only === 'R1') {
  n = 36;
  await runCase(G, { id: aId(), cat: '#9 새로고침', title: '각 화면(타이틀·시대 선택·출생·인생·선택지·사망 후)에서 새로고침 — 같은 인물·같은 선택지', steps: '화면마다 새로고침 1회, 이전 스냅샷(화면·이름·나이·선택지 key)과 비교. 모바일 360x740', expected: '시대 선택·출생 인물·인생·선택지·엔딩이 그대로 복원됨(다시 뽑히거나 건너뛰지 않음)' }, async () => {
    const { ctx, page } = await mk();
    const out = [];
    const bad = [];
    const shots = [];
    const check = async (label) => {
      const a = await snap(page);
      await page.reload();
      await sleep(500);
      const b = await snap(page);
      const same = keyOf(a) === keyOf(b);
      out.push(`${label}: ${a.screen}/${a.name}/${a.age} → ${b.screen}/${b.name}/${b.age}${a.choiceKey ? '/' + a.choiceKey : ''}`);
      if (!same) bad.push(label);
      shots.push(await shot(page, sid(label)));
    };
    await waitScreen(page, 'title-screen');
    await check('title');
    await page.getByRole('button', { name: '시작' }).click();
    await waitScreen(page, 'era-screen');
    await sleep(500);
    await page.locator('[data-era="past"]').click();
    await check('era');
    const era = await page.locator('[data-era="past"]').getAttribute('aria-pressed');
    if (era !== 'true') bad.push('시대 선택 유지 안 됨');
    await page.getByTestId('confirm-era').click();
    await waitScreen(page, 'birth-screen');
    await sleep(500);
    await check('birth');
    await page.getByTestId('next-life').click();
    await waitScreen(page, 'life-screen');
    await sleep(600);
    await check('life');
    // 선택지까지
    await page.getByTestId('skip').click();
    await page.waitForSelector('[data-testid="choice-panel"]');
    await sleep(500);
    const c0 = await readChoice(page);
    await check('choice');
    const c1 = await readChoice(page);
    if (JSON.stringify(c0) !== JSON.stringify(c1)) bad.push('선택지 내용 달라짐');
    // 끝까지: skip + 첫 선택지
    for (let i = 0; i < 60; i++) {
      const s = await snap(page);
      if (s.screen === 'ending-screen') break;
      if (s.hasChoice) { await page.locator('.choice-list button').first().click(); await sleep(200); }
      else { await page.getByTestId('skip').click(); await sleep(150); }
    }
    await waitScreen(page, 'ending-screen', 8000);
    await sleep(300);
    await check('ending');
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `불일치 ${bad.join(',')} / ${out.join(' ; ')}` : out.join(' ; '), shots };
  });
}

// ---------- 새로고침 연타 ----------
async function reloadStorm(page, count, gapMs, interrupt) {
  for (let i = 0; i < count; i++) {
    try {
      if (interrupt) {
        // 로드가 끝나기 전에 다음 새로고침: commit만 기다리고 바로 또 reload
        await page.reload({ waitUntil: 'commit', timeout: 5000 });
        if (gapMs) await sleep(gapMs);
      } else {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 8000 });
        if (gapMs) await sleep(gapMs);
      }
    } catch (e) {
      // 중단된 탐색은 무시
    }
  }
  await page.waitForLoadState('load').catch(() => {});
  await sleep(700);
}

if (!only || only === 'R2') {
  n = 37;
  for (const interrupt of [false, true]) {
    await runCase(G, { id: aId(), cat: '#9 새로고침', title: `선택지 대기 중 새로고침 연타 ${interrupt ? '(로드 도중 중단, 간격 0)' : '(DOMContentLoaded 후 연속)'} x15`, steps: '선택지가 뜬 상태에서 15회 연속 새로고침', expected: '같은 인물·같은 선택지·같은 나이 그대로. 저장 손상 없음, 밀린 화면·오류 화면 없음' }, async () => {
      const { ctx, page } = await mk();
      await toLife(page, 'present');
      await sleep(600);
      await page.getByTestId('skip').click();
      await page.waitForSelector('[data-testid="choice-panel"]');
      await sleep(500);
      const before = await snap(page);
      const cb = await readChoice(page);
      const histBefore = (await readSave(page)).data.history.length;
      await reloadStorm(page, 15, interrupt ? 0 : 30, interrupt);
      const after = await snap(page);
      const ca = await readChoice(page);
      const sv = await readSave(page);
      const bad = [];
      if (keyOf(before) !== keyOf(after)) bad.push(`상태 불일치 ${keyOf(before)} → ${keyOf(after)}`);
      if (JSON.stringify(cb) !== JSON.stringify(ca)) bad.push('선택지 내용 불일치');
      if (sv.data.history.length !== histBefore) bad.push('연표 길이 변화');
      const sh = await shot(page, sid());
      return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') : `${before.name} ${before.age} "${before.choiceTitle}" 그대로 유지`, shots: [sh] };
    });
  }
}

if (!only || only === 'R3') {
  n = 39;
  await runCase(G, { id: aId(), cat: '#9 새로고침', title: '선택 직후 새로고침 연타 (선택 클릭 → 즉시 15회 새로고침) x3 반복', steps: '선택지를 누르자마자 로드 도중 중단 포함 새로고침 15회. 3번 반복', expected: '선택이 한 번만 반영되거나(저장됨) 아직 반영 전(원래 선택지)이어야 함. 연표 중복·두 번 선택·건너뛴 해 없음' }, async () => {
    const { ctx, page } = await mk([360, 740], '?__timescale=1');
    await toLife(page, 'present');
    await sleep(600);
    const bad = [];
    const notes = [];
    for (let round = 1; round <= 3; round++) {
      await page.getByTestId('skip').click();
      await page.waitForSelector('[data-testid="choice-panel"]');
      await sleep(600);
      const b = await readSave(page);
      const nb = b.data.history.filter((h) => h.kind === 'choice').length;
      const ageB = b.data.age;
      await page.locator('.choice-list button').nth(0).click({ noWaitAfter: true });
      await reloadStorm(page, 15, 0, true);
      const s = await snap(page);
      const a = await readSave(page);
      const na = a.data.history.filter((h) => h.kind === 'choice').length;
      const diff = na - nb;
      notes.push(`R${round}: 선택 ${nb}→${na}, 나이 ${ageB}→${a.data.age}, 화면 ${s.screen}${s.hasChoice ? '(선택지 ' + s.choiceKey + ')' : ''}`);
      if (diff < 0 || diff > 1) bad.push(`R${round}: 선택 수 변화 ${diff}`);
      if (a.data.age < ageB || a.data.age > ageB + 1) bad.push(`R${round}: 나이 변화 비정상 ${ageB}→${a.data.age}`);
      if (diff === 0 && !s.hasChoice) bad.push(`R${round}: 선택은 취소됐는데 선택지가 사라짐`);
      if (s.screen !== 'life-screen') bad.push(`R${round}: 인생 화면 아님(${s.screen})`);
    }
    const sh = await shot(page, sid());
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + notes.join(' | ') : notes.join(' | '), shots: [sh] };
  });
}

if (!only || only === 'R4') {
  n = 40;
  await runCase(G, { id: aId(), cat: '#9 새로고침', title: '8배속+자동 모드 진행 중 새로고침 연타 (간격 250ms x20, 로드 중단 포함) — 인물 불변·나이 역행 없음', steps: '8배·자동 켜짐으로 진행 중에 20회 새로고침(저장→복원 반복). 매 복원 후 나이를 기록', expected: '같은 인물 유지, 나이가 줄어들지 않음(저장 되감김 없음), 밀린 화면·오류 없음, 설정(8배·자동) 유지' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await page.addInitScript(([k, v]) => { if (location.protocol === 'about:') return; if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, [SETTINGS_KEY, JSON.stringify({ version: 1, data: { speed: 8, autoMode: true } })]);
    await page.goto(DEV + '/');
    await toLife(page, 'present');
    await sleep(1500);
    const name = (await snap(page)).name;
    const ages = [];
    let bad = [];
    let last = -1;
    for (let i = 0; i < 20; i++) {
      await page.reload({ waitUntil: i % 3 === 0 ? 'commit' : 'domcontentloaded' }).catch(() => {});
      await sleep(250);
      const s = await snap(page).catch(() => null);
      if (!s) continue;
      if (s.screen === 'superseded-screen' || s.screen === 'error-screen' || s.screen === 'BLANK') bad.push(`${i}: ${s.screen}`);
      if (s.name && s.name !== name) bad.push(`${i}: 이름 바뀜 ${s.name}`);
      const a = Number(String(s.age || '').replace('세', ''));
      if (!Number.isNaN(a)) {
        ages.push(a);
        if (a < last) bad.push(`${i}: 나이 역행 ${last}→${a}`);
        last = Math.max(last, a);
      }
    }
    await sleep(1500);
    const f = await snap(page);
    const st = await readSettings(page);
    if (!(st && st.data.speed === 8 && st.data.autoMode === true)) bad.push('설정 불일치');
    const sh = await shot(page, sid());
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') : `나이 추이 ${ages.join(',')} → 최종 ${f.screen} ${f.age}`, shots: [sh] };
  });
}

if (!only || only === 'R5') {
  n = 41;
  // 사망 순간: 나이 104(상한 105 직전)·건강 100의 유효 저장을 만들어 8배·자동·시간 배율로 사망까지 가며 새로고침 연타
  const base = JSON.parse(golden.lifeChoice);
  const near = JSON.parse(JSON.stringify(base));
  near.data.age = 104;
  near.data.pending = null;
  near.data.seen = { 'infant-first-word': 1 };
  near.data.lastChoiceAge = null;
  near.data.history = [{ age: 0, kind: 'stage', text: '2015년, 남자아이로 태어났다.' }];
  near.data.stats.health = 100;
  for (const mode of ['reload-storm', 'reload-after']) {
    await runCase(G, { id: aId(), cat: '#9 새로고침', title: mode === 'reload-storm' ? '사망 순간 새로고침 연타 (104세 저장, 8배·자동, 시간 배율 100, 5ms~80ms 간격)' : '사망 직후·사망 후 새로고침 15회 (죽은 인생이 되살아나지 않음)', timescale: 100, steps: '104세 유효 저장을 심고 사망이 일어나는 시점에 새로고침을 연타. 사망 후에도 새로고침/새 탭', expected: '사망(엔딩)이 되돌려지지 않음: 엔딩 화면이 유지되고 사망 나이·원인이 새로고침마다 같음. 인생 화면으로 되살아나지 않음' }, async () => {
      const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
      await seedInit(ctx, JSON.stringify(near), JSON.stringify({ version: 1, data: { speed: 8, autoMode: true } }));
      const page = await ctx.newPage();
      await page.goto(DEV + '/?__timescale=100');
      const bad = [];
      const seen = [];
      let endedAt = null;
      const t0 = Date.now();
      if (mode === 'reload-storm') {
        for (let i = 0; i < 40 && Date.now() - t0 < 20000; i++) {
          await page.reload({ waitUntil: 'commit' }).catch(() => {});
          await sleep(5 + (i % 5) * 18);
          const s = await snap(page).catch(() => null);
          if (!s) continue;
          seen.push(s.screen === 'ending-screen' ? `E${s.death}` : s.screen === 'life-screen' ? s.age : s.screen);
          if (s.screen === 'ending-screen' && endedAt === null) endedAt = i;
          if (endedAt !== null && s.screen === 'life-screen') bad.push(`${i}: 엔딩 뒤에 인생 화면으로 되살아남`);
          if (s.screen === 'error-screen' || s.screen === 'superseded-screen') bad.push(`${i}: ${s.screen}`);
        }
      } else {
        await waitScreen(page, 'ending-screen', 15000);
        await sleep(500);
      }
      // 엔딩 이후
      await page.waitForLoadState('load').catch(() => {});
      await sleep(800);
      const e0 = await snap(page);
      if (e0.screen !== 'ending-screen') bad.push(`최종 화면이 엔딩이 아님: ${e0.screen} ${e0.age}`);
      const deaths = [];
      for (let i = 0; i < 15; i++) {
        await page.reload({ waitUntil: i % 2 ? 'commit' : 'load' }).catch(() => {});
        await sleep(i % 2 ? 60 : 100);
      }
      await page.waitForLoadState('load').catch(() => {});
      await sleep(600);
      const e1 = await snap(page);
      const sv = await readSave(page);
      if (e1.screen !== 'ending-screen') bad.push(`15회 새로고침 뒤 엔딩이 아님: ${e1.screen}`);
      if (e0.death !== e1.death) bad.push(`사망 문구 달라짐 ${e0.death} → ${e1.death}`);
      if (!(sv && sv.data && sv.data.phase === 'ending')) bad.push(`저장 phase=${sv && sv.data && sv.data.phase}`);
      // 새 탭으로 열어도 엔딩
      const p2 = await ctx.newPage();
      await p2.goto(DEV + '/?__timescale=100');
      await sleep(700);
      const e2 = await snap(p2);
      if (e2.screen !== 'ending-screen') bad.push(`새 탭에서 엔딩이 아님: ${e2.screen}`);
      const sh = await shot(page, sid());
      return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: 스트림 ' + seen.join(',') : `사망 화면 유지: ${e1.death}. 연타 중 관측 [${seen.join(',')}]`, shots: [sh] };
    });
  }
}

// ---------- R-052 회귀 감시: 단일 탭에서 밀린 화면이 한 번이라도 뜨면 FAIL ----------
if (!only || only === 'S1') {
  n = 43;
  await runCase(G, { id: aId(), cat: '#6 R-052', title: '단일 탭 플레이 중 밀린 화면 감시: 새로고침 연타·8배+자동·탭 가림 복귀 (시간 배율 12로 한 판 이상)', timescale: 12, steps: '한 탭만 사용. 8배·자동으로 한 판을 돌리며 새로고침을 틈틈이, 가림→복귀(visibility) 반복. MutationObserver로 superseded 화면이 한 번이라도 뜨는지 감시', expected: '밀린 화면(데이터 testid superseded-screen)이 한 번도 뜨지 않음' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await page.addInitScript(([k, v]) => { if (location.protocol === 'about:') return; if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, [SETTINGS_KEY, JSON.stringify({ version: 1, data: { speed: 8, autoMode: true } })]);
    await page.addInitScript(() => {
      window.__sup = 0;
      window.__vis = 'visible';
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
      new MutationObserver(() => { if (document.querySelector('[data-testid="superseded-screen"]')) { window.__sup++; sessionStorage.setItem('__sup', String(Number(sessionStorage.getItem('__sup') || 0) + 1)); } }).observe(document, { childList: true, subtree: true });
    });
    await page.goto(DEV + '/?__timescale=12');
    await toLife(page, 'present');
    let supers = 0;
    const log = [];
    for (let i = 0; i < 30; i++) {
      await sleep(400);
      if (i % 3 === 1) {
        await page.reload({ waitUntil: i % 2 ? 'commit' : 'load' }).catch(() => {});
        await sleep(100);
      }
      if (i % 5 === 3) {
        await page.evaluate(() => { window.__vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); }).catch(() => {});
        await sleep(1200);
        await page.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); }).catch(() => {});
      }
      const c = await page.evaluate(() => Number(sessionStorage.getItem('__sup') || 0)).catch(() => 0);
      supers = Math.max(supers, c);
      const s = await snap(page).catch(() => null);
      if (s) log.push(s.screen === 'life-screen' ? s.age : s.screen === 'ending-screen' ? 'E' : s.screen);
      if (s && s.screen === 'ending-screen') break;
    }
    const sh = await shot(page, sid());
    return { verdict: supers ? 'FAIL' : 'PASS', actual: supers ? `밀린 화면 ${supers}회 관측` : `밀린 화면 0회. 진행 관측 [${log.slice(0, 30).join(',')}]`, shots: [sh] };
  });
}

// ---------- 뒤로가기/앞으로가기 ----------
if (!only || only === 'NAV') {
  n = 44;
  await runCase(G, { id: aId(), cat: '#9 뒤로/앞으로', title: '각 화면에서 브라우저 뒤로→앞으로 (타이틀·시대·출생·인생·선택지·엔딩)', steps: 'about:blank에서 앱으로 이동한 뒤, 각 화면에서 goBack → goForward. 이어서 같은 탭을 다른 주소(/robots.txt 등)로 갔다가 뒤로(bfcache 가능 경로)', expected: '앱으로 돌아오면 같은 화면·같은 인물·같은 선택지. 진행이 꼬이거나 저장이 깨지지 않음(저장 유효)' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await page.goto('about:blank');
    await page.goto(DEV + '/');
    const bad = [];
    const notes = [];
    const shots = [];
    const roundTrip = async (label) => {
      const a = await snap(page);
      const rawA = await readRaw(page);
      await page.goBack().catch(() => {});
      await sleep(300);
      const url1 = page.url();
      await page.goForward().catch(() => {});
      await sleep(900);
      const b = await snap(page);
      const rawB = await readRaw(page);
      const same = keyOf(a) === keyOf(b);
      notes.push(`${label}: back→${url1.slice(0, 20)} / 복귀 ${b.screen} ${b.age || ''} ${same ? '동일' : '불일치(' + keyOf(a) + '→' + keyOf(b) + ')'}`);
      if (!same) bad.push(label);
      if (rawB !== null) { try { JSON.parse(rawB); } catch { bad.push(label + ': 저장 손상'); } }
      shots.push(await shot(page, sid(label)));
    };
    await waitScreen(page, 'title-screen');
    await roundTrip('title');
    await page.getByRole('button', { name: '시작' }).click();
    await waitScreen(page, 'era-screen');
    await sleep(500);
    await roundTrip('era');
    await page.getByTestId('confirm-era').click();
    await waitScreen(page, 'birth-screen');
    await sleep(500);
    await roundTrip('birth');
    await page.getByTestId('next-life').click();
    await waitScreen(page, 'life-screen');
    await sleep(600);
    await roundTrip('life');
    await page.getByTestId('skip').click();
    await page.waitForSelector('[data-testid="choice-panel"]');
    await sleep(500);
    await roundTrip('choice');
    for (let i = 0; i < 60; i++) {
      const s = await snap(page);
      if (s.screen === 'ending-screen') break;
      if (s.hasChoice) { await page.locator('.choice-list button').first().click(); await sleep(200); }
      else { await page.getByTestId('skip').click(); await sleep(150); }
    }
    await waitScreen(page, 'ending-screen', 8000);
    await sleep(300);
    await roundTrip('ending');
    // 같은 탭을 다른 문서로 보냈다가 뒤로
    const s0 = await snap(page);
    await page.goto(DEV + '/robots.txt').catch(() => {});
    await sleep(200);
    await page.goBack().catch(() => {});
    await sleep(900);
    const s1 = await snap(page);
    notes.push(`다른 주소 갔다 뒤로: ${s0.screen} → ${s1.screen}`);
    if (s1.screen !== 'ending-screen') bad.push('다른 주소 후 뒤로: 엔딩 아님');
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + notes.join(' | ') : notes.join(' | '), shots };
  });

  await runCase(G, { id: aId(), cat: '#9 뒤로/앞으로', title: '진행 중(1배·선택지 대기) 다른 페이지로 이동 후 뒤로(bfcache 시도) + 여러 번 뒤로/앞으로 연타', steps: '인생 화면에서 about:blank 이동 → 뒤로 → 다시 앞으로를 12회 연타. 중간에 선택지가 대기 중인 상태도', expected: '나이가 되감기지 않고 저장이 유효하며, 밀린 화면·오류 화면이 뜨지 않음' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await page.goto(DEV + '/');
    await toLife(page, 'present');
    await sleep(600);
    await page.getByTestId('skip').click();
    await page.waitForSelector('[data-testid="choice-panel"]');
    await sleep(500);
    const a = await snap(page);
    await page.goto(DEV + '/robots.txt');
    const bad = [];
    for (let i = 0; i < 12; i++) {
      await page.goBack().catch(() => {});
      await sleep(80);
      await page.goForward().catch(() => {});
      await sleep(80);
    }
    await page.goBack().catch(() => {});
    await sleep(1000);
    const b = await snap(page);
    const sv = await readSave(page);
    if (b.screen !== 'life-screen') bad.push(`복귀 화면 ${b.screen} (URL ${page.url()})`);
    if (b.screen === 'life-screen' && keyOf(a) !== keyOf(b)) bad.push(`상태 다름 ${keyOf(a)} → ${keyOf(b)}`);
    if (sv.__corrupt) bad.push('저장 손상');
    const sh = await shot(page, sid());
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') : `${a.age} 선택지 "${a.choiceTitle}" → 복귀 ${b.screen} ${b.age} ${b.choiceKey || ''}`, shots: [sh] };
  });
}

// ---------- 저장 중 종료 ----------
if (!only || only === 'CLOSE') {
  n = 46;
  await runCase(G, { id: aId(), cat: '#9 저장 중 종료', title: '진행 중 탭 닫기 → 같은 저장소로 다시 열기 (선택 직후·8배 자동 중·사망 직전)', steps: '같은 컨텍스트에서 탭을 닫고(page.close, runBeforeUnload) 새 탭으로 열기. 3가지 시점', expected: '저장이 유효하고(이전 값 또는 새 값) 되감김 없이 이어짐. 복원 후 같은 인물' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    let page = await ctx.newPage();
    await page.addInitScript(([k, v]) => { if (location.protocol === 'about:') return; if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, [SETTINGS_KEY, JSON.stringify({ version: 1, data: { speed: 8, autoMode: true } })]);
    await page.goto(DEV + '/');
    await toLife(page, 'present');
    await sleep(1800);
    const bad = [];
    const notes = [];
    for (let i = 0; i < 4; i++) {
      const before = await readSave(page);
      await sleep(i * 137);
      await page.close({ runBeforeUnload: true });
      page = await ctx.newPage();
      await page.goto(DEV + '/');
      await sleep(500);
      const s = await snap(page);
      const sv = await readSave(page);
      notes.push(`R${i}: 닫기 전 ${before.data.age}세 → 재개 ${s.screen} ${s.age || ''}`);
      if (sv.__corrupt) bad.push(`R${i}: 저장 손상`);
      if (s.screen !== 'life-screen' && s.screen !== 'ending-screen') bad.push(`R${i}: 화면 ${s.screen}`);
      if (s.age && Number(s.age.replace('세', '')) < before.data.age) bad.push(`R${i}: 나이 되감김`);
      if (s.name && s.name !== before.data.character.name) bad.push(`R${i}: 이름 바뀜`);
    }
    const sh = await shot(page, sid());
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + notes.join(' | ') : notes.join(' | '), shots: [sh] };
  });
}

await browser.close();
