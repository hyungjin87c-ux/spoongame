// 공격 #5 다중 탭 5개 시나리오 (+ 변형). 마지막 쓰기 우선: 밀린 탭은 멈추고 "이 탭에서 이어하기"로 이어받는다.
import { DEV, GAME_KEY, SETTINGS_KEY, launch, mkctx, runCase, shot, snap, toLife, toBirth, waitScreen, readSave, readRaw, sleep, con } from './f-compat.mjs';

const G = 'a-tabs';
const browser = await launch();
const only = process.argv[2];
let n = 61;
const aId = () => `F-AT${String(n++).padStart(2, '0')}`;
const curId = () => `F-AT${String(n - 1).padStart(2, '0')}`;
const HIDE = () => {
  window.__vis = 'hidden';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
};
const setVis = (p, v) => p.evaluate((x) => { window.__vis = x; document.dispatchEvent(new Event('visibilitychange')); }, v);
const ageOf = (s) => Number(String(s.age || '').replace('세', ''));
const newCtx = () => mkctx(browser, { viewport: { width: 360, height: 740 } });

if (!only || only === 'S1') {
  n = 61;
  await runCase(G, { id: aId(), cat: '#5 다중 탭', title: '시나리오1a 열기만 한 둘째 탭 — 첫 탭이 선택지 대기 중일 때 둘째 탭 열기', steps: '탭A 인생 화면 선택지 대기 → 탭B 같은 주소 열기 → 8초 관찰', expected: '아무도 쓰지 않으므로 탭A는 밀리지 않음(선택지 그대로), 저장 원문 불변' }, async () => {
    const ctx = await newCtx();
    const A = await ctx.newPage();
    await A.goto(DEV + '/');
    await toLife(A, 'present');
    await sleep(600);
    await A.getByTestId('skip').click();
    await A.waitForSelector('[data-testid="choice-panel"]');
    await sleep(500);
    const a0 = await snap(A);
    const raw0 = await readRaw(A);
    const B = await ctx.newPage();
    await B.goto(DEV + '/');
    await sleep(8000);
    const a1 = await snap(A);
    const b1 = await snap(B);
    const raw1 = await readRaw(A);
    const bad = [];
    if (a1.screen !== 'life-screen' || a1.choiceKey !== a0.choiceKey) bad.push(`탭A 상태 변함 ${a1.screen}/${a1.choiceKey}`);
    if (b1.screen !== 'life-screen' || b1.choiceKey !== a0.choiceKey) bad.push(`탭B 상태 이상 ${b1.screen}/${b1.choiceKey}`);
    if (raw0 !== raw1) bad.push('저장 원문이 바뀜');
    const sh = await shot(A, curId(), 'tabA');
    const sh2 = await shot(B, curId(), 'tabB');
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') : `A=${a1.screen}(${a1.choiceKey}) B=${b1.screen}(${b1.choiceKey}) 저장 불변`, shots: [sh, sh2] };
  });

  await runCase(G, { id: aId(), cat: '#5 다중 탭', title: '시나리오1b 열기만 한 둘째 탭 — 첫 탭이 진행 중(1배)일 때 둘째 탭을 가려진 상태로 열기', steps: '탭A 인생 화면 진행 중 → 탭B 열기(가려진 상태 흉내, visibilityState=hidden) → 10초', expected: '탭B는 진행·저장하지 않아 탭A가 밀리지 않고 계속 진행(나이 증가). 탭B가 A의 진행 저장에 밀리는 것은 예상 동작(기록만)' }, async () => {
    const ctx = await newCtx();
    const A = await ctx.newPage();
    await A.goto(DEV + '/');
    await toLife(A, 'present');
    await sleep(500);
    const a0 = await snap(A);
    const B = await ctx.newPage();
    await B.addInitScript(HIDE);
    await B.goto(DEV + '/');
    await sleep(10000);
    const a1 = await snap(A);
    const b1 = await snap(B);
    const bad = [];
    if (a1.screen === 'superseded-screen') bad.push('탭A가 밀림');
    if (a1.screen === 'life-screen' && ageOf(a1) <= ageOf(a0) && !a1.hasChoice) bad.push(`탭A 진행 안 함 ${a0.age}→${a1.age}`);
    // 탭B는 탭A의 진행(저장)에 밀리는 것이 마지막 쓰기 우선의 예상 동작이다 → 오류 화면만 실패로 본다
    if (b1.screen === 'error-screen' || b1.screen === 'BLANK') bad.push(`탭B ${b1.screen}`);
    const sh = await shot(A, curId(), 'tabA');
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') : `A ${a0.age}→${a1.age}(${a1.screen}), B=${b1.screen} ${b1.age}`, shots: [sh] };
  });

  await runCase(G, { id: aId(), cat: '#5 다중 탭', title: '시나리오1c 타이틀 상태에서 둘째 탭 열기 → 한쪽이 시작하면 다른 쪽은 밀림 → 이어하기 한 번에 탈출', steps: '탭A 타이틀 → 탭B 열기(타이틀) → A에서 시작 → B 관찰 → B에서 "이 탭에서 이어하기"', expected: 'B는 밀린 화면을 보여 주고, 이어하기 한 번으로 A의 진행 상태(시대 선택)로 이어짐' }, async () => {
    const ctx = await newCtx();
    const A = await ctx.newPage();
    await A.goto(DEV + '/');
    await waitScreen(A, 'title-screen');
    await sleep(500);
    const B = await ctx.newPage();
    await B.goto(DEV + '/');
    await waitScreen(B, 'title-screen');
    await sleep(1500);
    const bad = [];
    const a0 = await snap(A);
    const b0 = await snap(B);
    if (a0.screen !== 'title-screen' || b0.screen !== 'title-screen') bad.push(`열기만 했는데 화면 변함 A=${a0.screen} B=${b0.screen}`);
    await A.getByRole('button', { name: '시작' }).click();
    await waitScreen(A, 'era-screen');
    await sleep(800);
    const b1 = await snap(B);
    const shB = await shot(B, curId(), 'B-밀림');
    if (b1.screen !== 'superseded-screen') bad.push(`B가 밀리지 않음(${b1.screen}) — 마지막 쓰기 우선이면 밀려야 함`);
    await B.getByTestId('take-over').click().catch(() => bad.push('이어하기 버튼 없음'));
    await sleep(500);
    const b2 = await snap(B);
    if (b2.screen !== 'era-screen') bad.push(`이어하기 후 ${b2.screen}`);
    const shB2 = await shot(B, curId(), 'B-이어하기후');
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') : `열기만: A=${a0.screen}/B=${b0.screen}; A 시작 후 B=${b1.screen}; 이어하기 후 B=${b2.screen}`, shots: [shB, shB2] };
  });
}

if (!only || only === 'S2') {
  n = 64;
  await runCase(G, { id: aId(), cat: '#5 다중 탭', title: '시나리오2 탭 주고받기 반복 (A↔B 8회): 한쪽이 진행하면 다른 쪽은 밀리고, 이어하기로 이어받기', steps: '탭A·B가 번갈아 "다음 결정으로"/선택으로 진행. 밀린 탭은 이어하기 한 번. 8회 반복', expected: '매번 밀린 화면 → 이어하기 한 번으로 정상 인생 화면. 나이는 되감기지 않고, 오류 화면 없음' }, async () => {
    const ctx = await newCtx();
    const A = await ctx.newPage();
    await A.goto(DEV + '/');
    await toLife(A, 'present');
    await sleep(500);
    const B = await ctx.newPage();
    await B.goto(DEV + '/');
    await waitScreen(B, 'life-screen');
    await sleep(600);
    const bad = [];
    const log = [];
    let lastAge = -1;
    let cur = A, other = B;
    let shots = [];
    for (let i = 0; i < 8; i++) {
      // 현재 탭이 진행: 선택지가 있으면 고르고, 아니면 다음 결정으로
      const s = await snap(cur);
      if (s.screen === 'superseded-screen') {
        await cur.getByTestId('take-over').click();
        await sleep(600);
      }
      const s1 = await snap(cur);
      if (s1.hasChoice) await cur.locator('.choice-list button').first().click();
      else await cur.getByTestId('skip').click().catch(() => {});
      await sleep(900);
      const o = await snap(other);
      const sv = await readSave(cur);
      const ag = sv.data.age;
      log.push(`${i}:${cur === A ? 'A' : 'B'}진행(저장 ${ag}세) → 상대 ${o.screen}`);
      if (ag < lastAge) bad.push(`${i}: 저장 나이 되감김 ${lastAge}→${ag}`);
      lastAge = Math.max(lastAge, ag);
      if (o.screen !== 'superseded-screen' && o.screen !== 'ending-screen') bad.push(`${i}: 상대 탭이 밀리지 않음(${o.screen})`);
      if (i === 1) shots.push(await shot(other, curId(), 'superseded'));
      // 상대가 이어받기
      if (o.screen === 'superseded-screen') {
        await other.getByTestId('take-over').click();
        await sleep(700);
        const o2 = await snap(other);
        if (o2.screen !== 'life-screen' && o2.screen !== 'ending-screen') bad.push(`${i}: 이어하기 후 ${o2.screen}`);
        if (o2.screen === 'life-screen' && ageOf(o2) < ag) bad.push(`${i}: 이어받은 나이 ${o2.age} < 저장 ${ag}`);
      }
      const e = await snap(other);
      if (e.screen === 'ending-screen') break;
      [cur, other] = [other, cur];
    }
    shots.push(await shot(A, curId(), 'A-최종'));
    shots.push(await shot(B, curId(), 'B-최종'));
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + log.join(' | ') : log.join(' | '), shots };
  });
}

if (!only || only === 'S3') {
  n = 65;
  await runCase(G, { id: aId(), cat: '#5 다중 탭', title: '시나리오3 탭 복제 — 복제한 탭에서 진행 → 원본 밀림 → 원본 닫고 복제만 계속 → 새 탭로 재개', steps: '탭A 선택지 대기 → 같은 주소로 복제 탭B → B에서 선택 → A 관찰 → A 닫기 → B 계속 → 새 탭C 열기', expected: '원본 A는 밀린 화면, 닫은 뒤에도 B의 진행이 저장되고 새 탭 C가 같은 상태로 이어짐' }, async () => {
    const ctx = await newCtx();
    const A = await ctx.newPage();
    await A.goto(DEV + '/');
    await toLife(A, 'present');
    await sleep(500);
    await A.getByTestId('skip').click();
    await A.waitForSelector('[data-testid="choice-panel"]');
    await sleep(500);
    const B = await ctx.newPage();
    await B.goto(A.url());
    await waitScreen(B, 'life-screen');
    await sleep(700);
    const bad = [];
    const bs = await snap(B);
    if (!bs.hasChoice) bad.push('복제 탭에 같은 선택지가 안 보임');
    await B.locator('.choice-list button').nth(0).click();
    await sleep(900);
    const a1 = await snap(A);
    if (a1.screen !== 'superseded-screen') bad.push(`원본 A가 밀리지 않음(${a1.screen})`);
    const shA = await shot(A, curId(), 'A-밀림');
    await A.close();
    await sleep(500);
    await B.getByTestId('skip').click().catch(() => {});
    await sleep(900);
    const savedB = await readSave(B);
    const C = await ctx.newPage();
    await C.goto(DEV + '/');
    await sleep(800);
    const cs = await snap(C);
    const bs2 = await snap(B);
    if (cs.screen !== 'life-screen' && cs.screen !== 'ending-screen') bad.push(`새 탭 C 화면 ${cs.screen}`);
    if (cs.age && ageOf(cs) < savedB.data.age) bad.push(`C 나이 ${cs.age} < 저장 ${savedB.data.age}`);
    const shC = await shot(C, curId(), 'C-재개');
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') : `A=${a1.screen}, B 저장 ${savedB.data.age}세, C=${cs.screen} ${cs.age}`, shots: [shA, shC] };
  });
}

if (!only || only === 'S4') {
  n = 66;
  await runCase(G, { id: aId(), cat: '#5 다중 탭', title: '시나리오4 빈 저장소에서 두 탭 동시 열기 x12 (경쟁) → 밀린 탭은 이어하기 한 번에 탈출, 그 뒤 동시에 시작', steps: '새 컨텍스트에서 두 탭을 Promise.all로 동시에 열고 → 화면 확인 → 밀린 탭 이어하기 → 두 탭이 동시에 "시작" 클릭. 12회 반복', expected: '두 탭 모두 오류 없이 이어하기 한 번(또는 0번)으로 정상 화면. 멈추거나 오류 화면이 뜨지 않음' }, async () => {
    const bad = [];
    const rows = [];
    let shots = [];
    for (let i = 0; i < 12; i++) {
      const ctx = await newCtx();
      const A = await ctx.newPage();
      const B = await ctx.newPage();
      await Promise.all([A.goto(DEV + '/'), B.goto(DEV + '/')]);
      await sleep(1300);
      let sa = await snap(A);
      let sb = await snap(B);
      const open = `${sa.screen.slice(0, 5)}/${sb.screen.slice(0, 5)}`;
      let takes = 0;
      for (const P of [A, B]) {
        const s = await snap(P);
        if (s.screen === 'superseded-screen') {
          await P.getByTestId('take-over').click();
          takes++;
          await sleep(500);
        }
      }
      sa = await snap(A);
      sb = await snap(B);
      if (isBad(sa) || isBad(sb)) bad.push(`${i}: 이어하기 ${takes}번 후에도 A=${sa.screen} B=${sb.screen}`);
      // 동시에 시작
      await Promise.all([
        A.getByRole('button', { name: '시작' }).click({ timeout: 3000 }).catch(() => {}),
        B.getByRole('button', { name: '시작' }).click({ timeout: 3000 }).catch(() => {}),
      ]);
      await sleep(1000);
      for (const P of [A, B]) {
        const s = await snap(P);
        if (s.screen === 'superseded-screen') {
          await P.getByTestId('take-over').click();
          await sleep(500);
        }
      }
      sa = await snap(A);
      sb = await snap(B);
      rows.push(`${i}: 열기=${open} 이어하기 ${takes}회 → 시작 후 A=${sa.screen.slice(0, 6)} B=${sb.screen.slice(0, 6)}`);
      if (['error-screen', 'BLANK', 'unknown'].includes(sa.screen) || ['error-screen', 'BLANK', 'unknown'].includes(sb.screen)) bad.push(`${i}: 최종 오류 ${sa.screen}/${sb.screen}`);
      if (i === 0) { shots.push(await shot(A, curId(), 'A')); shots.push(await shot(B, curId(), 'B')); }
      await ctx.close();
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + rows.join(' | ') : rows.join(' | '), shots };
  });
}

function isBad(s) { return ['error-screen', 'BLANK', 'unknown', 'superseded-screen'].includes(s.screen); }

if (!only || only === 'S5') {
  n = 67;
  await runCase(G, { id: aId(), cat: '#5 다중 탭', title: '시나리오5 나란히 둔 두 창이 둘 다 진행 중 (8배, 40초) — 서로 번갈아 밀림은 예상 동작, 밀린 화면에서 이어하기로 항상 탈출', steps: '두 탭 모두 보이는 상태(8배)로 인생 진행. 40초 동안 밀린 화면이 뜨면 이어하기 클릭을 반복. 밀림 횟수·오류 화면·되감김 기록', expected: '밀리는 것은 허용(기록만). 이어하기 한 번이면 인생 화면으로 복귀, 오류 화면·무한 멈춤 없음, 저장 나이 되감김 없음' }, async () => {
    const ctx = await newCtx();
    await ctx.addInitScript(([k, v]) => { if (location.protocol === 'about:') return; if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, [SETTINGS_KEY, JSON.stringify({ version: 1, data: { speed: 8, autoMode: true } })]);
    const A = await ctx.newPage();
    await A.goto(DEV + '/');
    await toLife(A, 'present');
    await sleep(300);
    const B = await ctx.newPage();
    await B.goto(DEV + '/');
    await B.waitForSelector('main[data-testid]'); // A가 8배로 계속 저장하므로 B는 뜨자마자 밀릴 수 있다(예상)
    const bad = [];
    const counts = { A: 0, B: 0 };
    let takeFail = 0;
    let lastSaved = -1;
    const t0 = Date.now();
    let ended = false;
    while (Date.now() - t0 < 40000 && !ended) {
      for (const [name, P] of [['A', A], ['B', B]]) {
        const s = await snap(P).catch(() => ({ screen: 'ERR' }));
        if (s.screen === 'superseded-screen') {
          counts[name]++;
          await sleep(500); // 가드 시간
          await P.getByTestId('take-over').click({ timeout: 3000 }).catch(() => takeFail++);
          await sleep(300);
          const s2 = await snap(P);
          if (s2.screen === 'error-screen' || s2.screen === 'BLANK') bad.push(`${name} 이어하기 후 ${s2.screen}`);
        } else if (s.screen === 'error-screen' || s.screen === 'BLANK') {
          bad.push(`${name} ${s.screen}`);
        } else if (s.screen === 'ending-screen') {
          ended = true;
        }
      }
      const sv = await readSave(A).catch(() => null);
      if (sv && sv.data) {
        if (sv.data.age < lastSaved && sv.data.phase === 'life') bad.push(`저장 나이 되감김 ${lastSaved}→${sv.data.age}`);
        lastSaved = Math.max(lastSaved, sv.data.age);
      }
      await sleep(250);
    }
    const sh = await shot(A, curId(), 'A');
    const sh2 = await shot(B, curId(), 'B');
    const fa = await snap(A);
    const fb = await snap(B);
    return { verdict: bad.length || takeFail ? 'FAIL' : 'PASS', actual: `밀림 횟수 A=${counts.A} B=${counts.B} (40초), 이어하기 실패 ${takeFail}, 최종 A=${fa.screen} ${fa.age || ''} B=${fb.screen} ${fb.age || ''}, 최대 저장 나이 ${lastSaved}${bad.length ? ' / ' + bad.join('; ') : ''}`, shots: [sh, sh2], note: '번갈아 밀림은 예상 동작(기록만)' };
  });
}
await browser.close();
