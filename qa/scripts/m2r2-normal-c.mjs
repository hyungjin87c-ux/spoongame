// QA-003 M2 정상 흐름 C: 이어하기(N09)·새로 태어나기 확인(N10)·새로고침 뒤 복원(N11)
// 이어하기 화면은 prod에서 도달 수단이 없어(나가기=M4) 개발 서버 탐침 ?__exit로 만든다
import { launch, mkctx, runCase, shot, openTitle, waitGuard, whichScreen, VP, TOUCH, DEV, sleep, lifeInfo, startToLife, driveLife, setSpeed, saveInfo } from './m2r2-lib.mjs';

const browser = await launch();
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);
const TITLE = '[data-testid=title-screen]';

// 공용: 개발 서버에서 몇 해 산 판을 만든다
async function livedGameOnDev(vp, touch, minAge) {
  const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}) });
  const p = await ctx.newPage();
  await p.goto(DEV + '?__timescale=20');
  await p.waitForSelector(TITLE);
  await startToLife(p);
  await driveLife(p, (i) => i.screen === 'life-screen' && i.age >= minAge && !i.hasChoice);
  await sleep(300);
  return { ctx, p };
}

if (want('N09'))
  await runCase({ id: 'M2-N09', cat: '정상', title: '진행 중인 판이 있을 때 첫 화면 — 「이어서 살기」 기본, 「새로 태어나기」 보조 (FS6·C3)', steps: '개발 서버(?__exit 탐침)에서 몇 해 산 판을 만들고 첫 화면을 다시 열어 버튼 구성·위치 확인 → 「이어서 살기」 → 같은 판·같은 나이로 복귀 → 계속 진행', expected: '같은 자리에 기본 버튼 「이어서 살기」(크게)와 보조 「새로 태어나기」(작게), 이어하기 누르면 같은 이름·나이로 인생 화면 복귀하고 다시 진행' }, async () => {
    const { ctx, p } = await livedGameOnDev(VP.m360, true, 3);
    const before = await lifeInfo(p);
    const saveBefore = await saveInfo(p);
    await p.goto(DEV + '?__exit&__timescale=20');
    await p.waitForSelector(TITLE);
    await waitGuard(p, 'resume');
    await sleep(300);
    const ui = await p.evaluate(() => {
      const r = (t) => {
        const e = document.querySelector(`[data-testid="${t}"]`);
        if (!e) return null;
        const b = e.getBoundingClientRect();
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), cls: e.className, text: e.innerText };
      };
      return { resume: r('resume'), beginNew: r('begin-new'), start: r('start-birth'), bar: r('bottom-bar'), vh: innerHeight };
    });
    const shots = [await shot(p, 'N09', 'title-saved')];
    const titleSavedScreen = await whichScreen(p);
    await p.getByTestId('resume').click();
    await p.waitForSelector('[data-testid=life-screen]');
    await sleep(300);
    const after = await lifeInfo(p);
    shots.push(await shot(p, 'N09', 'resumed'));
    await driveLife(p, (i) => i.age >= before.age + 1 && !i.hasChoice, 60000);
    const later = await lifeInfo(p);
    await ctx.close();
    const problems = [];
    if (titleSavedScreen !== 'title-screen') problems.push(`?__exit 첫 화면이 ${titleSavedScreen}`);
    if (!ui.resume || ui.resume.text.trim() !== '이어서 살기') problems.push(`이어서 살기 버튼 이상 ${JSON.stringify(ui.resume)}`);
    if (!ui.beginNew || ui.beginNew.text.trim() !== '새로 태어나기') problems.push(`새로 태어나기 버튼 이상 ${JSON.stringify(ui.beginNew)}`);
    if (ui.start) problems.push('이어하기 상태에 「태어나기」 버튼이 같이 있음');
    if (ui.resume && ui.beginNew && !(ui.resume.h > ui.beginNew.h)) problems.push(`기본 버튼이 보조보다 크지 않음 ${ui.resume.h} vs ${ui.beginNew.h}`);
    if (ui.beginNew && ui.beginNew.h < 36) problems.push(`보조 버튼 높이 ${ui.beginNew.h}px (터치 대상 작음)`);
    if (after.name !== before.name || after.age < before.age) problems.push(`이어하기 뒤 ${after.name}/${after.age}세 ≠ 이전 ${before.name}/${before.age}세`);
    if (later.age <= before.age) problems.push(`다시 진행하지 않음 ${later.age}`);
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `이전 ${before.name} ${before.age}세(저장 phase=${saveBefore.phase}) → 첫 화면 「${ui.resume.text.trim()}」 ${ui.resume.w}x${ui.resume.h} + 「${ui.beginNew.text.trim()}」 ${ui.beginNew.w}x${ui.beginNew.h} → 이어하기 ${after.name} ${after.age}세 → 진행 ${later.age}세`, shots };
  });

if (want('N10'))
  await runCase({ id: 'M2-N10', cat: '정상', title: '「새로 태어나기」 → 확인 단계 → 돌아가기·Esc / 확정 (FS6·R-204·R-212)', steps: '이어하기 첫 화면에서 「새로 태어나기」 → 확인 문구·버튼 → 「돌아가기」(포커스 복귀) → 다시 → Esc → 다시 → 「새로 태어나기」 확정', expected: '확인 단계에서 이전 판 안내 문구, 돌아가기/Esc는 이전 판 유지·포커스가 「새로 태어나기」로 복귀, 확정하면 새 판 출생 화면(저장 age=0·다른 판)' }, async () => {
    const { ctx, p } = await livedGameOnDev(VP.m360, true, 3);
    const saveBefore = await saveInfo(p);
    await p.goto(DEV + '?__exit&__timescale=20');
    await p.waitForSelector(TITLE);
    await waitGuard(p, 'begin-new');
    const problems = [];
    const shots = [];
    const focusId = () => p.evaluate(() => document.activeElement?.getAttribute('data-testid') || document.activeElement?.tagName);
    // 1) 확인 → 돌아가기
    await p.getByTestId('begin-new').click();
    await p.waitForSelector('[data-testid=confirm-new-ask]');
    const ask = await p.getByTestId('confirm-new-ask').innerText();
    await waitGuard(p, 'confirm-new-no');
    const focusConfirm = await focusId();
    shots.push(await shot(p, 'N10', 'confirm'));
    await p.getByTestId('confirm-new-no').click();
    await sleep(250);
    const focusBack1 = await focusId();
    const stillSaved1 = await p.getByTestId('resume').count();
    // 2) 확인 → Esc
    await waitGuard(p, 'begin-new');
    await p.getByTestId('begin-new').click();
    await p.waitForSelector('[data-testid=confirm-new-ask]');
    await sleep(500);
    await p.keyboard.press('Escape');
    await sleep(250);
    const focusBack2 = await focusId();
    const stillSaved2 = await p.getByTestId('resume').count();
    const saveMid = await saveInfo(p);
    // 3) 확정
    await waitGuard(p, 'begin-new');
    await p.getByTestId('begin-new').click();
    await p.waitForSelector('[data-testid=confirm-new-yes]');
    await waitGuard(p, 'confirm-new-yes');
    await p.getByTestId('confirm-new-yes').click();
    await p.waitForSelector('[data-testid=birth-screen]', { timeout: 6000 });
    await sleep(200);
    const afterInfo = await lifeInfo(p);
    const saveAfter = await saveInfo(p);
    shots.push(await shot(p, 'N10', 'new-birth'));
    await ctx.close();
    if (!/이전 판이 사라집니다/.test(ask)) problems.push(`확인 문구 ${ask}`);
    if (focusConfirm !== 'confirm-new-no') problems.push(`확인 단계 진입 포커스 ${focusConfirm} (돌아가기 기대)`);
    if (focusBack1 !== 'begin-new' || focusBack2 !== 'begin-new') problems.push(`닫은 뒤 포커스 ${focusBack1}/${focusBack2} (새로 태어나기 기대)`);
    if (!stillSaved1 || !stillSaved2) problems.push('돌아가기/Esc 뒤 「이어서 살기」가 사라짐');
    if (saveMid.name !== saveBefore.name || saveMid.age !== saveBefore.age) problems.push(`취소 뒤 저장이 바뀜 ${JSON.stringify(saveMid)} vs ${JSON.stringify(saveBefore)}`);
    if (saveAfter.phase !== 'birth' || saveAfter.age !== 0) problems.push(`확정 뒤 저장 ${JSON.stringify(saveAfter)}`);
    if (saveAfter.seed === saveBefore.seed) problems.push('확정했는데 같은 시드');
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `확인 문구 「${ask}」, 포커스 ${focusConfirm}, 돌아가기·Esc 뒤 포커스 ${focusBack1}/${focusBack2}·이어서 살기 유지·저장 불변(${saveBefore.name} ${saveBefore.age}세), 확정 뒤 새 판 ${afterInfo.name}(저장 phase=${saveAfter.phase}, age=${saveAfter.age}, 이전 이름 ${saveBefore.name})`, shots };
  });

if (want('N11'))
  await runCase({ id: 'M2-N11', cat: '정상', title: '출생 → 인생 몇 년 → 새로고침 → 복원 → (나가기 상태) 첫 화면 이어하기 → 다시 진행 (C3·RL5)', steps: 'prod에서 출생·8배속으로 몇 해 → 새로고침(저장된 화면 복원 여부) → 개발 서버 ?__exit로 첫 화면 이어하기 → 새로고침 → 이어서 살기 → 진행', expected: 'prod 새로고침은 첫 화면이 아니라 저장된 인생 화면을 그대로 복원(C3, 이름 동일·나이 되돌아가지 않음), 첫 화면 이어하기 상태는 나가기(M4)나 개발 탐침으로만 도달' }, async () => {
    const problems = [];
    const shots = [];
    // prod: 새로고침 복원
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    const p = await ctx.newPage();
    await openTitle(p);
    await startToLife(p);
    await setSpeed(p, 8);
    await driveLife(p, (i) => i.screen === 'life-screen' && i.age >= 3 && !i.hasChoice, 90000);
    const before = await lifeInfo(p);
    shots.push(await shot(p, 'N11', 'prod-before-reload'));
    await p.reload();
    await p.waitForSelector('[data-testid=life-screen]', { timeout: 8000 }).catch(() => {});
    await sleep(500);
    const after = await lifeInfo(p);
    shots.push(await shot(p, 'N11', 'prod-after-reload'));
    if (after.screen !== 'life-screen') problems.push(`prod 새로고침 뒤 화면 ${after.screen}`);
    if (after.name !== before.name) problems.push(`이름 달라짐 ${before.name}→${after.name}`);
    if (after.age < before.age) problems.push(`나이가 되돌아감 ${before.age}→${after.age}`);
    if (after.speed !== '8') problems.push(`배속 설정 유지 안 됨 ${after.speed}`);
    await driveLife(p, (i) => i.age >= after.age + 1 && !i.hasChoice, 60000);
    const later = await lifeInfo(p);
    await ctx.close();
    // 개발 서버: 나가기 상태
    const { ctx: c2, p: p2 } = await livedGameOnDev(VP.m360, true, 3);
    const b2 = await lifeInfo(p2);
    await p2.goto(DEV + '?__exit&__timescale=20');
    await p2.waitForSelector(TITLE);
    await waitGuard(p2, 'resume');
    const titleOk = (await p2.getByTestId('resume').count()) === 1;
    // 첫 화면 상태에서 새로고침(?__exit 없이) → 저장된 화면 복원
    await p2.goto(DEV + '?__timescale=20');
    await p2.waitForSelector('[data-testid=life-screen]', { timeout: 8000 }).catch(() => {});
    const refreshed = await lifeInfo(p2);
    shots.push(await shot(p2, 'N11', 'dev-after-exit-reload'));
    await p2.goto(DEV + '?__exit&__timescale=20');
    await waitGuard(p2, 'resume');
    await p2.getByTestId('resume').click();
    await p2.waitForSelector('[data-testid=life-screen]');
    await driveLife(p2, (i) => i.age >= b2.age + 1 && !i.hasChoice, 60000);
    const resumed = await lifeInfo(p2);
    await c2.close();
    if (!titleOk) problems.push('?__exit 첫 화면에 이어서 살기 없음');
    if (refreshed.screen !== 'life-screen' || refreshed.name !== b2.name) problems.push(`첫 화면(나가기 상태)에서 새로고침 뒤 ${refreshed.screen}/${refreshed.name} (저장된 화면 복원 기대)`);
    if (resumed.name !== b2.name || resumed.age <= b2.age) problems.push(`이어서 살기 뒤 ${resumed.name} ${resumed.age}`);
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `prod: ${before.name} ${before.age}세(8배) → 새로고침 → ${after.screen} ${after.name} ${after.age}세 → 진행 ${later.age}세. 개발(나가기 상태): ${b2.name} ${b2.age}세 → 첫 화면 이어서 살기 → 새로고침 시 ${refreshed.screen} 복원(${refreshed.age}세) → 이어서 살기 → ${resumed.age}세. 참고: prod 새로고침은 첫 화면이 아니라 곧바로 인생 화면(C3 설계). 첫 화면의 「이어서 살기」는 prod에서 도달 수단 없음(나가기=M4)`, shots };
  });

await browser.close();
