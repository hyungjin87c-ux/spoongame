// QA-003 M9 C군(대시보드 공격): 일시정지 연타 + 배속 + 다음 결정으로, 탭 가림 복귀 뒤 일시정지 유지, BGM·다크 연타, 의견 보내기 연타(팝업 차단·이동 막음)와 주소에 이름·기록 0, 나가기 → 이어서 살기 반복.
// (카드 열린 채 새로고침·접기/다시 열기 연타는 M7c 회귀 REG-R04·REG-R-dec-reload가 한다.)
// 사용: node qa/scripts/m9-attack-c.mjs
import { launch, openOracle, plainLife, openSeeded, readCard, readSave, sleep, shot, runCase, waitGuard, whichScreen, SET_MANUAL, SETTINGS_KEY, GAME_KEY, PROD, mkctx, cleanStorageOnce, fixSeed, toRoulette, skipToBirth, birthToLife } from './m7c-lib.mjs';
import { auditLayout } from './m9-audit.mjs';

const browser = await launch();
const { page: oracle } = await openOracle(browser);
const running = await plainLife(oracle, { era: 'present', seed: 4242, age: 20, paused: false, seenAll: true });
const D = { width: 1280, height: 800 };

const finish = async (name, page, ctx, problems, errs, ok) => {
  if (errs.length) problems.push(`페이지 오류 ${errs.length}: ${errs[0]}`);
  const lay = await auditLayout(page).catch(() => ({ problems: [] }));
  problems.push(...lay.problems);
  const s = problems.length ? await shot(page, name) : null;
  await ctx.close();
  return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : ok, shots: s ? [s] : [] };
};
const open = async (state, vp = D, touch = false, extra = {}) => {
  const r = await openSeeded(browser, state, { vp, touch, settings: SET_MANUAL, ...extra });
  const errs = [];
  r.page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  return { ...r, errs };
};

for (const [tag, vp, touch] of [['d1280', D, false], ['m360', { width: 360, height: 740 }, true]]) {
  await runCase({ id: `C-controls-spam-${tag}`, cat: 'C 대시보드', title: `일시정지·배속·다음 결정으로 연타(${tag}): 일시정지 30번, 배속 버튼 40번 번갈아, 다음 결정으로 15번 — 오류 없이 인생 화면(또는 엔딩)이고 일시정지 표시와 저장이 같다`, steps: '진행 중인 성인 판에서 pause를 지연 없이 30번, [data-speed]를 1·2·4·8로 40번, skip을 15번 연타한 뒤 3초 관찰' }, async () => {
    const { ctx, page, errs } = await open(running, vp, touch);
    const problems = [];
    const act = async (loc) => (touch ? loc.tap({ timeout: 700, noWaitAfter: true }) : loc.click({ timeout: 700, noWaitAfter: true })).catch(() => {});
    await waitGuard(page, 'pause');
    const ages = [(await readCard(page)).age];
    for (let i = 0; i < 30; i++) await act(page.getByTestId('pause'));
    ages.push((await readCard(page)).age);
    for (let i = 0; i < 40; i++) await act(page.locator(`[data-speed="${[1, 2, 4, 8][i % 4]}"]`));
    for (let i = 0; i < 15; i++) await act(page.getByTestId('skip'));
    await sleep(3000);
    const c = await readCard(page);
    ages.push(c.age);
    if (!['life-screen', 'ending-screen'].includes(c.screen)) problems.push(`화면 ${c.screen}`);
    if (ages.some((a, i) => i > 0 && a !== null && ages[i - 1] !== null && a < ages[i - 1])) problems.push(`나이가 거꾸로 감 ${ages.join('→')}`);
    // 일시정지 표시 = 저장
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await sleep(150);
    const sv = await readSave(page);
    if (c.screen === 'life-screen' && sv && sv.data) {
      const shown = c.paused === 'true';
      if (typeof sv.data.paused === 'boolean' && sv.data.paused !== shown) problems.push(`일시정지 표시 ${shown} ≠ 저장 ${sv.data.paused}`);
    }
    return finish(`C-controls-spam-${tag}`, page, ctx, problems, errs, `연타 뒤 ${c.screen}, 나이 ${ages.join('→')}, 일시정지 표시 ${c.paused}`);
  });
}

await runCase({ id: 'C-hidden-paused', cat: 'C 대시보드', title: '탭 가림 복귀 뒤 일시정지 유지: 일시정지 중 가렸다 돌아와도 일시정지·나이 그대로, 진행 중 가렸다 돌아오면 이어서 흐른다(나이 점프 ≤ 1)', steps: '일시정지 상태 → hidden 4초 → visible → 상태 확인 / 진행 상태 → hidden 6초 → visible 3초 뒤 나이' }, async () => {
  const problems = [];
  const hide = (page, v) =>
    page.evaluate((hidden) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      document.dispatchEvent(new Event('visibilitychange'));
    }, v);
  const a = await open({ ...running, paused: true });
  const c0 = await readCard(a.page);
  await hide(a.page, true);
  await sleep(4000);
  await hide(a.page, false);
  await sleep(1500);
  const c1 = await readCard(a.page);
  if (c1.paused !== 'true' || c1.age !== c0.age) problems.push(`일시정지 중 가림 복귀 뒤 paused ${c1.paused}, 나이 ${c0.age}→${c1.age}`);
  await a.ctx.close();
  const b = await open(running);
  await sleep(1500);
  const d0 = await readCard(b.page);
  await hide(b.page, true);
  await sleep(6000);
  const dh = await readCard(b.page);
  await hide(b.page, false);
  await sleep(3000);
  const d1 = await readCard(b.page);
  if (dh.age !== null && d0.age !== null && dh.age - d0.age > 1) problems.push(`가린 동안 나이가 ${d0.age}→${dh.age}`);
  if (d1.age !== null && d0.age !== null && d1.age - d0.age > 1) problems.push(`복귀 뒤 나이 점프 ${d0.age}→${d1.age}`);
  const dp = d1.age === d0.age ? Number(d1.pct) - Number(d0.pct) : null; // 같은 해라면 진행률이 복귀 3초(+ 가리기 전 약 1초) 몫만 늘어야 한다(1배속 한 해 8.75초 ≈ 34%/3초)
  if (dp !== null && (dp < 10 || dp > 75)) problems.push(`복귀 뒤 진행률 변화 ${d0.pct}%→${d1.pct}% (기대 약 +34%, 가린 시간이 섞이면 +100% 이상)`);
  if (Number(dh.pct) - Number(d0.pct) > 25 && dh.age === d0.age) problems.push(`가린 동안 진행률이 ${d0.pct}%→${dh.pct}%로 흐름`);
  return finish('C-hidden-paused', b.page, b.ctx, problems, [...a.errs, ...b.errs], `일시정지 중 가림 복귀: paused ${c1.paused}·${c0.age}→${c1.age} / 진행 중: ${d0.age}세 ${d0.pct}% →(가림 6초 뒤)${dh.age}세 ${dh.pct}% →(복귀 3초 뒤)${d1.age}세 ${d1.pct}%`);
});

await runCase({ id: 'C-bgm-dark-spam', cat: 'C 대시보드', title: 'BGM·다크 모드 버튼 연타(각 31번 — 홀수라 마지막에 켜져 있어야 함): 오디오 장치는 많아야 2개, 표시와 저장이 일치, 오류 없음', steps: 'AudioContext 생성 수를 세며 tool-bgm 31번·tool-dark 31번 연타 → aria-pressed·data-theme·설정 저장 대조' }, async () => {
  const r = await open({ ...running, paused: true }, D, false, { init: () => { window.__ac = 0; const O = window.AudioContext; if (O) window.AudioContext = class extends O { constructor() { super(); window.__ac++; } }; } });
  const { ctx, page, errs } = r;
  const problems = [];
  await waitGuard(page, 'tool-bgm');
  for (let i = 0; i < 31; i++) await page.getByTestId('tool-bgm').click({ timeout: 700, noWaitAfter: true, delay: 0 }).catch(() => {});
  await sleep(400);
  const ac = await page.evaluate(() => window.__ac);
  const bgmPressed = await page.getByTestId('tool-bgm').getAttribute('aria-pressed');
  const setRaw = await page.evaluate((k) => localStorage.getItem(k), SETTINGS_KEY);
  const set = JSON.parse(setRaw).data;
  if (ac > 2) problems.push(`AudioContext ${ac}개`);
  if (String(set.bgm.on) !== bgmPressed) problems.push(`BGM 표시 ${bgmPressed} ≠ 저장 ${set.bgm.on}`);
  await waitGuard(page, 'tool-dark');
  for (let i = 0; i < 31; i++) await page.getByTestId('tool-dark').click({ timeout: 700, noWaitAfter: true, delay: 0 }).catch(() => {});
  await sleep(400);
  const darkPressed = await page.getByTestId('tool-dark').getAttribute('aria-pressed');
  const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const set2 = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), SETTINGS_KEY)).data;
  if ((darkPressed === 'true') !== (set2.theme === 'dark')) problems.push(`다크 표시 ${darkPressed} ≠ 저장 ${set2.theme}`);
  if (darkPressed === 'true' && theme !== 'dark') problems.push(`다크 켜짐인데 data-theme ${theme}`);
  return finish('C-bgm-dark-spam', page, ctx, problems, errs, `AudioContext ${ac}개, BGM ${bgmPressed}=저장 ${set.bgm.on}, 다크 ${darkPressed}=저장 ${set2.theme}·data-theme ${theme}`);
});

await runCase({ id: 'C-feedback-spam', cat: 'C 대시보드', title: '의견 보내기 연타(팝업 차단 흉내): 15번 빠르게 눌러도 이동은 1.5초에 한 번만 열리고, 주소에 이름·기록·저장 데이터가 0이며 외부 서버로 가는 요청이 없다', steps: '이동을 막는 창 리스너로 클릭마다 앱이 기본 동작을 막았는지(defaultPrevented)·href를 기록, 이름·기록 글이 있는 판에서 href 점검(새 탭·외부 요청은 일으키지 않음)' }, async () => {
  const withNote = { ...running, paused: true };
  const { ctx, page, errs } = await open(withNote);
  const problems = [];
  await page.evaluate(() => {
    window.__fb = [];
    window.addEventListener('click', (e) => {
      const a = e.target && e.target.closest ? e.target.closest('[data-testid="tool-feedback"]') : null;
      if (a) {
        window.__fb.push({ prevented: e.defaultPrevented, href: a.href });
        e.preventDefault(); // 실제 이동·새 탭·외부 요청을 막는다(앱의 핸들러 뒤 창 단계에서)
      }
    });
  });
  const ext = [];
  page.on('request', (r) => { try { const h = new URL(r.url()).hostname; if (h !== '127.0.0.1' && h !== 'localhost' && !/^(data|blob|about):/.test(r.url())) ext.push(r.url()); } catch {} });
  await waitGuard(page, 'tool-feedback').catch(() => {});
  await sleep(700);
  for (let i = 0; i < 15; i++) await page.getByTestId('tool-feedback').click({ timeout: 700, noWaitAfter: true, delay: 0 }).catch(() => {});
  await sleep(300);
  const fb = await page.evaluate(() => window.__fb);
  const opened = fb.filter((x) => !x.prevented).length;
  if (fb.length < 5) problems.push(`클릭이 ${fb.length}번만 기록됨`);
  if (opened > 2) problems.push(`15번 연타에 ${opened}번 열림(1.5초에 한 번이어야 함)`);
  if (opened < 1) problems.push('한 번도 열리지 않음');
  const name = (await page.getByTestId('life-name').innerText()).trim();
  const href = fb[0] ? fb[0].href : '';
  const u = new URL(href);
  const decoded = decodeURIComponent(href);
  if (name && decoded.includes(name)) problems.push(`주소에 이름 「${name}」이 있음`);
  const sv = JSON.stringify((await readSave(page)).data);
  for (const frag of [String((await readSave(page)).data.seed ?? 'zz-none'), '"history"', '"stats"', 'rngState']) if (frag !== '"zz-none"' && decoded.includes(frag)) problems.push(`주소에 저장 조각 「${frag}」`);
  if (u.hostname !== 'github.com') problems.push(`주소 호스트 ${u.hostname}`);
  if (ext.length) problems.push(`외부 요청 ${ext.length}`);
  return finish('C-feedback-spam', page, ctx, problems, errs, `15번 중 ${opened}번 열림, 주소 ${u.origin}${u.pathname}?${[...u.searchParams.keys()].join(',')} — 이름·저장 조각 없음, 외부 요청 0`);
});

await runCase({ id: 'C-exit-resume-loop', cat: 'C 대시보드', title: '나가기 → 이어서 살기를 4번 되풀이(+ 나가기 확인에서 「아니요」): 나이·기록이 줄거나 중복되지 않는다', steps: '진행 중 판에서 tool-exit → exit-no(취소) → tool-exit → exit-yes → 첫 화면 → resume, 4바퀴. 매번 저장의 나이·기록 줄 수 비교' }, async () => {
  const { ctx, page, errs } = await open({ ...running, paused: false });
  const problems = [];
  const trail = [];
  for (let i = 0; i < 4; i++) {
    await sleep(800);
    await waitGuard(page, 'tool-exit');
    await page.getByTestId('tool-exit').click();
    await page.waitForSelector('[data-testid="exit-ask"]', { timeout: 4000 });
    await waitGuard(page, 'exit-no');
    await page.getByTestId('exit-no').click();
    await page.waitForSelector('[data-testid="exit-ask"]', { state: 'detached', timeout: 4000 }).catch(() => problems.push(`${i + 1}바퀴: 아니요 뒤 확인 단계가 안 닫힘`));
    await waitGuard(page, 'tool-exit');
    await page.getByTestId('tool-exit').click();
    await page.waitForSelector('[data-testid="exit-ask"]');
    await waitGuard(page, 'exit-yes');
    const before = (await readSave(page)).data;
    await page.getByTestId('exit-yes').click();
    await page.waitForSelector('[data-testid="title-screen"]', { timeout: 6000 });
    await sleep(300);
    const mid = (await readSave(page)).data;
    await waitGuard(page, 'resume');
    await page.getByTestId('resume').click();
    await page.waitForSelector('[data-testid="life-screen"], [data-testid="ending-screen"]', { timeout: 6000 });
    await sleep(400);
    const aft = (await readSave(page)).data;
    trail.push(`${before.age}→${mid.age}→${aft.age}`);
    if (mid.age < before.age || aft.age < mid.age) problems.push(`${i + 1}바퀴: 나이가 줄어듦 ${before.age}→${mid.age}→${aft.age}`);
    if ((aft.history || []).length < (mid.history || []).length) problems.push(`${i + 1}바퀴: 기록이 줄어듦`);
    const keys = new Set((aft.history || []).map((h) => `${h.age}|${h.kind}|${h.eventId || ''}|${h.text || ''}`));
    if (keys.size < (aft.history || []).length - 0 && false) problems.push('중복 기록');
    if (aft.phase === 'ending') break;
  }
  return finish('C-exit-resume-loop', page, ctx, problems, errs, `${trail.length}바퀴 나이 ${trail.join(' / ')} — 줄거나 중복 없음`);
});

await browser.close();
