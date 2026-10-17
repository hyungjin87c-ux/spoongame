// QA-003 M3 흐름 이후 회귀: 인생→엔딩→다시 태어나기, M2 핵심(첫 화면·캐러셀·확인 단계), 이어서 살기(룰렛·출생신고 단계), 저장 실패, 외부 요청·콘솔.
// 사용: node qa/scripts/m3-reg.mjs [ID,...]
import { launch, mkctx, fixSeed, runCase, shot, openTitle, waitGuard, pickEra, toRoulette, readRoulette, readBirth, skipToBirth, birthToLife, saveJson, readRaw, overflowX, lifeInfo, setSpeed, whichScreen, bodyText, VP, TOUCH, PROD, DEV, sleep, GAME_KEY, SETTINGS_KEY } from './m3-lib.mjs';

const browser = await launch();
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);
const push = (c, msg, arr) => (c ? null : arr.push(msg));

async function autoToEnding(p, timeoutMs = 100000) {
  await setSpeed(p, 8);
  await p.locator('[data-testid="auto"]').click();
  const t0 = Date.now();
  for (;;) {
    const i = await lifeInfo(p);
    if (i.screen === 'ending-screen') return i;
    if (Date.now() - t0 > timeoutMs) throw new Error('엔딩 시간 초과 ' + JSON.stringify(i));
    await sleep(150);
  }
}

// ---------- R01: 인생 진행·엔딩·다시 태어나기 → 첫 화면 ----------
if (want('R01')) {
  for (const era of ['present', 'past', 'future']) {
    await runCase(
      { id: `M3-R01-${era}`, cat: '회귀', title: `${era} 한 판을 끝까지: 룰렛→출생신고→인생(8배속 자동)→엔딩→「다시 태어나기」→첫 화면 (개발 서버 ?__timescale=100)`, steps: '태어나기→건너뛰기→출생신고 보기→살아가기→8배속+자동→엔딩. 엔딩의 출발선(수저 이름 허용 영역)·연표 첫 줄(출생신고 서술문)을 확인하고 「다시 태어나기」', expected: '엔딩 도달, 엔딩 연표 첫 줄 = 출생신고 서술문, 다시 태어나기로 첫 화면(저장은 title), 오류 0' },
      async () => {
        const bad = [];
        const shots = [];
        const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
        await fixSeed(ctx, 8080 + era.length);
        const p = await ctx.newPage();
        const errs = [];
        p.on('pageerror', (e) => errs.push(String(e)));
        await p.goto(DEV + '?__timescale=100');
        await p.waitForSelector('[data-testid="title-screen"]');
        await toRoulette(p, era);
        await skipToBirth(p);
        const b = await readBirth(p);
        await birthToLife(p);
        await autoToEnding(p);
        await sleep(500);
        const ed = await p.evaluate(() => ({ name: document.querySelector('[data-testid="ending-name"]')?.textContent.trim(), born: document.querySelector('[data-testid="ending-born"]')?.textContent.trim(), firstEntry: document.querySelector('[data-testid="timeline-entry"]')?.textContent.replace(/\s+/g, ' ').trim(), journey: document.querySelector('[data-testid="ending-journey"]')?.textContent.replace(/\s+/g, ' ').trim(), text: document.body.innerText }));
        push(ed.name === b.name, `엔딩 이름 ${ed.name} ≠ ${b.name}`, bad);
        push((ed.firstEntry ?? '').includes(b.sentence?.slice(0, 18) ?? '###'), `엔딩 연표 첫 줄에 출생신고 서술문 없음: ${ed.firstEntry?.slice(0, 80)}`, bad);
        push(!/외모\s*\d+\s*점/.test(ed.text), '엔딩에 외모 원점수', bad);
        const looksLines = ed.text.split('\n').filter((l, i, a) => /외모/.test(l) || /외모/.test(a[i - 1] ?? '')).slice(0, 4).join(' / ');
        shots.push(await shot(p, 'R01', `${era}-ending`));
        const ov = await overflowX(p);
        push(!ov.overflow, `엔딩 가로 넘침 ${ov.scrollW}>${ov.clientW}`, bad);
        await p.getByTestId('rebirth').scrollIntoViewIfNeeded();
        await waitGuard(p, 'rebirth');
        await p.getByTestId('rebirth').click();
        await p.waitForSelector('[data-testid="title-screen"]', { timeout: 5000 });
        await sleep(300);
        const sv = await saveJson(p);
        push(sv?.data?.phase === 'title', `다시 태어나기 뒤 저장 phase ${sv?.data?.phase}`, bad);
        const eraChecked = await p.evaluate(() => document.querySelector('[data-testid="era-group"] input:checked')?.value);
        shots.push(await shot(p, 'R01', `${era}-after-rebirth`));
        push(errs.length === 0, `pageerror ${errs.join('|')}`, bad);
        // 두 번째 판: 다시 태어나기 뒤 새 판이 룰렛부터 정상
        await toRoulette(p, era === 'present' ? 'present' : era);
        const r2 = await readRoulette(p);
        push(r2.state === 'spinning', `다시 태어난 뒤 룰렛 상태 ${r2.state}`, bad);
        await ctx.close();
        return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length ? bad.join(' / ') : `엔딩 ${ed.name}(외모 줄: ${looksLines}), 연표 첫 줄 = 서술문, 다시 태어나기 → 첫 화면(선택 세상 ${eraChecked}) → 두 번째 룰렛 정상`, shots };
      },
    );
  }
}

// ---------- R02: M2 핵심 회귀 ----------
if (want('R02')) {
  await runCase(
    { id: 'M3-R02', cat: '회귀', title: 'M2 핵심 회귀: 첫 화면 구성(로고·가상 인구·세상 3·인생 길이 2·캐러셀 14장·하단 고정 태어나기·푸터 버전)·캐러셀 조작·「올해(2026) 태어나는 아이」', steps: 'prod 360x740·1280x800에서 첫 화면 구성과 캐러셀(다음·이전·일시정지·점 대신 위치 표시)·태어나기 띠가 스크롤해도 같은 위치인지·세상 카드 문구', expected: 'M2 완료 시점과 같은 구성. 지금 세상 카드에 「올해(2026) 태어나는 아이」, 1시간 카드는 「준비 중」·선택 불가, 캐러셀 14장' },
    async () => {
      const bad = [];
      const shots = [];
      const notes = [];
      for (const [n, vp, t] of [['m360', VP.m360, TOUCH], ['d1280', VP.d1280, {}]]) {
        const ctx = await mkctx(browser, { viewport: vp, ...t });
        const p = await ctx.newPage();
        await openTitle(p);
        await sleep(600);
        const info = await p.evaluate(() => {
          const q = (s) => document.querySelector(s);
          const bar = q('[data-testid="bottom-bar"]');
          const r1 = bar.getBoundingClientRect();
          window.scrollTo(0, 400);
          const r2 = bar.getBoundingClientRect();
          window.scrollTo(0, 0);
          return {
            heading: q('[data-testid="title-heading"]')?.textContent.trim(),
            logoH: Math.round((q('.hero svg, [data-testid="title-screen"] svg')?.getBoundingClientRect().height) || 0),
            pop: q('[data-testid="population-line"]')?.textContent.replace(/\s+/g, ' ').trim(),
            popNote: q('[data-testid="population-note"]')?.textContent.trim(),
            eras: [...document.querySelectorAll('[data-testid="era-group"] label')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()),
            lengths: [...document.querySelectorAll('[data-testid="life-length-group"] label')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()),
            longDisabled: !!q('[data-testid="life-length-group"] input[value="long60"]')?.disabled,
            slides: document.querySelectorAll('[data-testid="carousel-viewport"] [data-testid="stat-slide"]').length,
            count: q('[data-testid="carousel-count"]')?.textContent.trim(),
            barFixed: getComputedStyle(bar).position === 'fixed',
            barTop: [Math.round(r1.top), Math.round(r2.top)],
            ver: q('[data-testid="build-version"]')?.textContent.trim(),
            startText: q('[data-testid="start-birth"]')?.textContent.trim(),
          };
        });
        notes.push(`${n}: 슬라이드 ${info.count}, 띠 ${info.barTop.join('→')}, ${info.ver}`);
        push(info.heading?.includes('수저 게임') || info.logoH >= 40, `${n}: 로고/제목 ${info.heading} ${info.logoH}`, bad);
        push(/\d[\d,]*명이 이 시뮬레이션 속에서 각자의 삶을 살고 있어요/.test(info.pop ?? ''), `${n}: 가상 인구 문구 ${info.pop}`, bad);
        push(info.eras.length === 3 && info.eras.some((e) => e.includes('올해(2026) 태어나는 아이')), `${n}: 세상 카드 ${JSON.stringify(info.eras)}`, bad);
        push(info.lengths.length === 2 && info.longDisabled && info.lengths.some((l) => l.includes('준비 중')), `${n}: 인생 길이 ${JSON.stringify(info.lengths)} 1시간 비활성 ${info.longDisabled}`, bad);
        push(info.count === '1 / 14', `${n}: 캐러셀 위치 ${info.count}`, bad);
        push(info.barFixed && info.barTop[0] === info.barTop[1], `${n}: 하단 띠가 스크롤에 따라 움직임 ${info.barTop}`, bad);
        push(info.startText === '태어나기', `${n}: 기본 버튼 ${info.startText}`, bad);
        push(/^v\d+\.\d+\.\d+/.test(info.ver ?? ''), `${n}: 푸터 버전 ${info.ver}`, bad);
        // 캐러셀 조작
        await p.getByTestId('carousel-pause').scrollIntoViewIfNeeded();
        await waitGuard(p, 'carousel-next');
        await p.getByTestId('carousel-next').click();
        await sleep(250);
        const c2 = await p.getByTestId('carousel-count').textContent();
        await waitGuard(p, 'carousel-prev');
        await p.getByTestId('carousel-prev').click();
        await sleep(250);
        const c3 = await p.getByTestId('carousel-count').textContent();
        push(c2.trim() === '2 / 14' && c3.trim() === '1 / 14', `${n}: 다음·이전 ${c2}/${c3}`, bad);
        await p.keyboard.press('Escape');
        shots.push(await shot(p, 'R02', `${n}-title`));
        await ctx.close();
      }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots };
    },
  );
}

// ---------- R03: 이어서 살기(룰렛·출생신고 단계) + 확인 단계 (개발 서버 ?__exit) ----------
if (want('R03')) {
  await runCase(
    { id: 'M3-R03', cat: '회귀', title: '이어서 살기: 룰렛 단계·출생신고 단계 저장에서 첫 화면을 다시 열고(?__exit) 「이어서 살기」→ 그 단계 복원, 「새로 태어나기」 확인 단계', steps: '개발 서버 ?__exit 탐침. (가) 룰렛 도중 저장 → 첫 화면 → 이어서 살기 → 룰렛 결과 상태 (나) 출생신고 저장 → 첫 화면 → 이어서 살기 → 출생신고 (다) 새로 태어나기 → 확인 단계 문구·돌아가기', expected: '저장된 단계로 정확히 복원(룰렛은 결과 상태, 결과 불변), 확인 단계의 확정 버튼 이름 「이전 판 지우고 태어나기」, 돌아가기로 취소하면 저장 유지' },
    async () => {
      const bad = [];
      const shots = [];
      const notes = [];
      for (const stage of ['roulette', 'birth']) {
        const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
        await fixSeed(ctx, 2468);
        const p = await ctx.newPage();
        await p.goto(DEV);
        await p.waitForSelector('[data-testid="title-screen"]');
        await toRoulette(p, 'present');
        await sleep(800);
        if (stage === 'birth') {
          await waitGuard(p, 'skip-roulette');
          await p.getByTestId('skip-roulette').click();
          await waitGuard(p, 'to-birth');
          await p.getByTestId('to-birth').click();
          await p.waitForSelector('[data-testid="birth-screen"]');
        }
        const sv0 = await saveJson(p);
        await p.goto(DEV + '?__exit');
        await p.waitForSelector('[data-testid="resume"]', { timeout: 8000 });
        await waitGuard(p, 'resume');
        shots.push(await shot(p, 'R03', `${stage}-title-continue`));
        // 확인 단계
        await waitGuard(p, 'begin-new');
        await p.getByTestId('begin-new').click();
        await p.waitForSelector('[data-testid="confirm-new-ask"]');
        await waitGuard(p, 'confirm-new-no');
        const yes = (await p.getByTestId('confirm-new-yes').textContent()).trim();
        const no = (await p.getByTestId('confirm-new-no').textContent()).trim();
        notes.push(`${stage}: 확인 단계 확정=「${yes}」 취소=「${no}」`);
        push(yes === '이전 판 지우고 태어나기' && no === '돌아가기', `${stage}: 확인 단계 버튼 ${yes}/${no}`, bad);
        shots.push(await shot(p, 'R03', `${stage}-confirm`));
        await p.getByTestId('confirm-new-no').click();
        await sleep(300);
        push(JSON.stringify((await saveJson(p)).data.birthReport) === JSON.stringify(sv0.data.birthReport), `${stage}: 돌아가기 뒤 저장이 바뀜`, bad);
        await waitGuard(p, 'resume');
        await p.getByTestId('resume').click();
        await sleep(600);
        const scr = await whichScreen(p);
        const want2 = stage === 'roulette' ? 'roulette-screen' : 'birth-screen';
        push(scr === want2, `${stage}: 이어서 살기 뒤 ${scr}`, bad);
        if (stage === 'roulette') {
          const r = await readRoulette(p);
          push(r.state === 'result', `roulette: 복원 상태 ${r.state}`, bad);
          shots.push(await shot(p, 'R03', 'roulette-resumed'));
        } else shots.push(await shot(p, 'R03', 'birth-resumed'));
        push(JSON.stringify((await saveJson(p)).data.birthReport) === JSON.stringify(sv0.data.birthReport), `${stage}: 이어서 살기 뒤 출생 결과 변동`, bad);
        await ctx.close();
      }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots };
    },
  );
}

// ---------- R04: 저장 실패(?__quota)·저장소 차단 ----------
if (want('R04')) {
  await runCase(
    { id: 'M3-R04', cat: '회귀', title: '저장 실패: 용량 초과 탐침(?__quota)과 localStorage 접근 차단에서 룰렛·출생신고가 계속 동작하고 안내가 뜬다', steps: '(가) 개발 서버 ?__quota: 태어나기→룰렛→출생신고→살아가기, 저장 실패 안내(role=status) 확인, 새로고침하면 첫 화면 (나) localStorage getItem·setItem이 예외를 던지는 컨텍스트에서 같은 플로우', expected: '크래시 없이 진행, 저장 실패 안내 한 줄(가), 새로고침 뒤 진행이 사라지는 것은 예상 동작(안내가 먼저 알림), 빈 화면 없음' },
    async () => {
      const bad = [];
      const shots = [];
      const notes = [];
      {
        const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
        await fixSeed(ctx, 123);
        const p = await ctx.newPage();
        const errs = [];
        p.on('pageerror', (e) => errs.push(String(e)));
        await p.goto(DEV + '?__quota');
        await p.waitForSelector('[data-testid="title-screen"]');
        await toRoulette(p, 'present');
        await sleep(700);
        const notice = await p.evaluate(() => document.querySelector('[data-testid="save-notice"]')?.textContent.trim() ?? null);
        notes.push(`quota 룰렛: 안내 ${notice ? '있음' : '없음'}`);
        push(!!notice, '저장 실패 안내가 룰렛 화면에 없음', bad);
        shots.push(await shot(p, 'R04', 'quota-roulette'));
        await skipToBirth(p);
        await birthToLife(p);
        push((await whichScreen(p)) === 'life-screen', '저장 실패에도 인생 화면 도달', bad);
        push(errs.length === 0, `오류 ${errs.join('|')}`, bad);
        await p.reload();
        await p.waitForSelector('[data-testid="title-screen"], [data-testid="life-screen"]', { timeout: 8000 });
        notes.push(`quota 새로고침 후 ${await whichScreen(p)}`);
        await ctx.close();
      }
      {
        const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
        await fixSeed(ctx, 456);
        await ctx.addInitScript(() => {
          Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });
        });
        const p = await ctx.newPage();
        const errs = [];
        p.on('pageerror', (e) => errs.push(String(e)));
        await p.goto(PROD, { waitUntil: 'load' });
        await p.waitForSelector('[data-testid="title-screen"]', { timeout: 8000 });
        await toRoulette(p, 'present');
        await skipToBirth(p);
        const b = await readBirth(p);
        await birthToLife(p);
        push((await whichScreen(p)) === 'life-screen', '저장소 차단에서 인생 화면 도달', bad);
        push(errs.length === 0, `차단 오류 ${errs.join('|').slice(0, 200)}`, bad);
        notes.push(`저장소 차단: 인생 ${b.name} 도달`);
        shots.push(await shot(p, 'R04', 'storage-blocked-life'));
        await ctx.close();
      }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots };
    },
  );
}

await browser.close();
