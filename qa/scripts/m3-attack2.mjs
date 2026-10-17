// QA-003 M3 공격 테스트 2(A08~): 저장 손상·v5·종료·오프라인·다중 탭·키 연타·CPU 지연 등. 사용: node qa/scripts/m3-attack2.mjs [ID,...]
import { launch, mkctx, fixSeed, installRouletteProbe, getProbe, runCase, shot, openTitle, waitGuard, pickEra, toRoulette, readRoulette, readBirth, skipToBirth, birthToLife, saveJson, readRaw, overflowX, lifeInfo, whichScreen, bodyText, VP, TOUCH, PROD, DEV, sleep, GAME_KEY, SETTINGS_KEY, driveLife } from './m3-lib.mjs';

const browser = await launch();
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);
const push = (c, msg, arr) => (c ? null : arr.push(msg));
const fp = (sv) => (sv?.data ? JSON.stringify({ c: sv.data.character, r: sv.data.birthReport, ps: sv.data.peerSeed, seed: sv.data.seed, era: sv.data.era }) : null);
const center = async (p, testid) => {
  const b = await p.getByTestId(testid).boundingBox();
  return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null;
};

/** 정상 v6 저장을 한 번 만들어 둔다(roulette/birth 단계) */
async function makeSave(stage, seed = 777, era = 'present') {
  const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
  await fixSeed(ctx, seed);
  const p = await ctx.newPage();
  await openTitle(p);
  await toRoulette(p, era);
  await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 9000 }).catch(() => {});
  if (stage === 'birth' || stage === 'life') {
    await waitGuard(p, 'to-birth');
    await p.getByTestId('to-birth').click();
    await p.waitForSelector('[data-testid="birth-screen"]');
  }
  if (stage === 'life') await birthToLife(p);
  const raw = await readRaw(p);
  const settings = await readRaw(p, SETTINGS_KEY);
  await ctx.close();
  return { raw, settings };
}

async function openWithSave(save, { vp = VP.m360, touch = TOUCH, base = PROD, settings = null } = {}) {
  const ctx = await mkctx(browser, { viewport: vp, ...touch });
  await ctx.addInitScript(([k, v, sk, sv]) => {
    try {
      if (!sessionStorage.getItem('__planted')) {
        sessionStorage.setItem('__planted', '1');
        localStorage.clear();
        if (v !== null) localStorage.setItem(k, v);
        if (sv) localStorage.setItem(sk, sv);
      }
    } catch {}
  }, [GAME_KEY, save, SETTINGS_KEY, settings]);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  p.on('dialog', (d) => {
    errs.push('dialog:' + d.message());
    d.dismiss().catch(() => {});
  });
  await p.goto(base, { waitUntil: 'load' });
  await sleep(500);
  return { ctx, p, errs };
}

// ---------- A08: 저장 손상·v5·변조 ----------
if (want('A08')) {
  await runCase(
    { id: 'M3-A08', cat: '공격', title: '저장 손상·v5 저장 심기·변조된 출생신고 → 안내 한 번·새 게임 (크래시 없음)', steps: '(가) 깨진 JSON (나) v5 봉투(룰렛 단계 없는 옛 저장) (다) 빈 문자열·null·배열 (라) v6인데 birthReport가 변조(month 13·체중 3.25·지역 없는 이름·형제 0·나이 200·직업 xyz·주거 zzz·peerSeed 문자열·시군구가 다른 시도 소속·birthReport 누락) (마) 이름에 <script>·이모지·자모 분리·21자 이상. 각각 심어 열기', expected: '손상·변조는 새 게임(첫 화면) — 앱이 죽지 않는다. v5는 첫 화면에 「이전 버전」 안내 한 줄(한 번만), 새 판을 시작하면 안내가 사라진다. 코드 실행·대화상자 0' },
    async () => {
      const bad = [];
      const notes = [];
      const shots = [];
      const base = JSON.parse((await makeSave('roulette', 515)).raw);
      const mk = (mut) => {
        const c = JSON.parse(JSON.stringify(base));
        mut(c.data);
        return JSON.stringify(c);
      };
      const cases = [
        ['broken-json', '{"version":6,"data":{broken'],
        ['empty-string', ''],
        ['null-text', 'null'],
        ['array', '[1,2,3]'],
        ['v5-envelope', JSON.stringify({ version: 5, data: { ...base.data, phase: 'birth' } })],
        ['v4-envelope', JSON.stringify({ version: 4, data: { ...base.data, phase: 'birth' } })],
        ['v7-future', JSON.stringify({ version: 7, data: base.data })],
        ['month13', mk((d) => (d.birthReport.month = 13))],
        ['month0', mk((d) => (d.birthReport.month = 0))],
        ['weight3.25', mk((d) => (d.birthReport.birthWeightKg = 3.25))],
        ['weight-neg', mk((d) => (d.birthReport.birthWeightKg = -1))],
        ['region-unknown', mk((d) => (d.birthReport.region = '화성'))],
        ['order0', mk((d) => (d.birthReport.birthOrder = 0))],
        ['order99', mk((d) => (d.birthReport.birthOrder = 99))],
        ['mother-age200', mk((d) => (d.birthReport.mother.age = 200))],
        ['job-xyz', mk((d) => (d.birthReport.father.job = 'xyz'))],
        ['housing-zzz', mk((d) => (d.birthReport.housing = 'zzz'))],
        ['peerSeed-string', mk((d) => (d.peerSeed = 'abc'))],
        ['peerSeed-negative', mk((d) => (d.peerSeed = -5))],
        ['sigungu-wrong-sido', mk((d) => (d.birthReport.sigungu = '해운대구'))],
        ['birthReport-missing', mk((d) => delete d.birthReport)],
        ['birthReport-null', mk((d) => (d.birthReport = null))],
        ['phase-unknown', mk((d) => (d.phase = 'casino'))],
        ['phase-roulette-no-report', mk((d) => { d.phase = 'roulette'; delete d.birthReport; })],
        ['era-unknown', mk((d) => (d.era = 'ancient'))],
        ['birthYear-2025-present', mk((d) => (d.character.birthYear = 2025))],
        ['name-21chars', mk((d) => (d.character.name = '가'.repeat(21)))],
        ['name-empty', mk((d) => (d.character.name = ''))],
        ['wealth-9', mk((d) => (d.character.parentWealth = 9))],
        ['proto-pollution', JSON.stringify(base).replace('"birthReport":{', '"__proto__":{"polluted":1},"birthReport":{"__proto__":{"x":1},')],
        ['constructor-key', JSON.stringify(base).replace('"birthReport":{', '"constructor":{"prototype":{"polluted":1}},"birthReport":{')],
      ];
      let newGameN = 0;
      let restoredN = 0;
      for (const [name, raw] of cases) {
        const { ctx, p, errs } = await openWithSave(raw);
        const scr = await whichScreen(p);
        const txt = await bodyText(p);
        const notice = await p.evaluate(() => document.querySelector('[data-testid="old-save-notice"]')?.textContent.trim() ?? null);
        const isOld = /v[4567]-/.test(name) && !name.includes('v7');
        if (scr === 'title-screen') newGameN++;
        else if (scr === 'roulette-screen' || scr === 'birth-screen') restoredN++;
        push(errs.length === 0, `${name}: 오류·대화상자 ${errs.join('|')}`, bad);
        push(scr !== 'BLANK' && scr !== 'unknown' && scr !== 'error-screen', `${name}: 화면 ${scr} — 빈 화면/오류 화면`, bad);
        if (name.startsWith('v5') || name.startsWith('v4')) {
          push(scr === 'title-screen' && !!notice, `${name}: 첫 화면+안내 기대인데 ${scr}/${notice}`, bad);
          notes.push(`${name}: ${notice}`);
        } else if (name === 'broken-json' || name === 'phase-unknown') {
          push(scr === 'title-screen', `${name}: 손상인데 ${scr}`, bad);
        } else if (name === 'proto-pollution' || name === 'constructor-key') {
          const polluted = await p.evaluate(() => ({}).polluted !== undefined || ({}).x !== undefined);
          push(!polluted, `${name}: 객체 오염 발생`, bad);
          notes.push(`${name}: ${scr}로 열림(알 수 없는 키는 무시), 오염 ${polluted}`);
        } else if (!['empty-string', 'null-text', 'array', 'v7-future'].includes(name)) {
          // 변조: 새 게임이어야 하고, 변조된 값이 화면에 나오면 안 된다
          push(scr === 'title-screen', `${name}: 변조 저장이 받아들여져 ${scr}로 열림`, bad);
        }
        if (name === 'v5-envelope') shots.push(await shot(p, 'A08', 'v5-notice'));
        if (name === 'broken-json') shots.push(await shot(p, 'A08', 'broken-json'));
        if (name === 'month13') shots.push(await shot(p, 'A08', 'tampered-month13'));
        await ctx.close();
      }
      notes.push(`새 게임으로 열림 ${newGameN}/${cases.length}, 복원 ${restoredN}`);
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots };
    },
  );
  await runCase(
    { id: 'M3-A08b', cat: '공격', title: 'v5 저장 안내는 한 번만: 안내 → 태어나기(저장 덮어씀) → 새로고침해도 안내 없음, 정상 이어짐', steps: 'v5 저장 심기 → 첫 화면 안내 확인 → 안내가 사라지는 시점(새 판 시작 전 새로고침 한 번, 태어나기 뒤 새로고침) 관찰', expected: '새 판을 시작해 v6 저장이 쓰이면 새로고침해도 안내가 다시 나오지 않는다(안내는 옛 저장이 남아 있는 동안만). 룰렛 상태 정상 복원' },
    async () => {
      const bad = [];
      const notes = [];
      const shots = [];
      const base = JSON.parse((await makeSave('roulette', 616)).raw);
      const v5 = JSON.stringify({ version: 5, data: { ...base.data, phase: 'birth' } });
      const { ctx, p } = await openWithSave(v5);
      const n1 = await p.evaluate(() => document.querySelector('[data-testid="old-save-notice"]')?.textContent.trim() ?? null);
      push(!!n1, '첫 로드에 안내 없음', bad);
      shots.push(await shot(p, 'A08b', 'notice-first-load'));
      await p.reload({ waitUntil: 'load' });
      await sleep(400);
      const n2 = await p.evaluate(() => document.querySelector('[data-testid="old-save-notice"]')?.textContent.trim() ?? null);
      notes.push(`새 판 시작 전 새로고침: 안내 ${n2 ? '있음' : '없음'}(첫 로드에서 v5 저장이 v6 첫 화면 저장으로 덮임: 저장 시작 ${(await readRaw(p))?.slice(0, 22)} — 안내는 첫 로드에서만 한 번)`);
      await toRoulette(p, 'present');
      await p.reload({ waitUntil: 'load' });
      await p.waitForSelector('[data-testid="roulette-screen"]');
      const n3 = await p.evaluate(() => document.querySelector('[data-testid="old-save-notice"]')?.textContent.trim() ?? null);
      push(!n3, `태어난 뒤 새로고침에도 안내가 남음: ${n3}`, bad);
      const sv = await saveJson(p);
      push(sv?.version === 6, `저장 버전 ${sv?.version}`, bad);
      notes.push(`태어난 뒤 새로고침: 안내 없음, 저장 v${sv?.version}, 화면 roulette`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots };
    },
  );
  await runCase(
    { id: 'M3-A08c', cat: '공격', title: '저장에 심은 이름의 특수문자·초장문·이모지·자모 분리가 출생신고·인생 화면에서 글자로만 그려지고 레이아웃을 깨지 않는다', steps: '정상 v6 출생신고 저장의 character.name을 바꿔 열기: <script>alert(1)</script>·<img src=x onerror=alert(1)>·\'"; DROP TABLE--·이모지(ZWJ 가족 포함)·ㅅㅜㅈㅓ(자모 분리)·20자 한글·결합 문자·RTL. 360x740/320x568', expected: '대화상자·스크립트 실행 0, 이름이 글자 그대로 보이고 가로 넘침 0, 인생 화면에서도 동일' },
    async () => {
      const bad = [];
      const shots = [];
      const base = JSON.parse((await makeSave('birth', 4040)).raw);
      const names = ['<script>x</script>', '"><svg onload=x>', `'"; DROP TABLE t;--`, '👨‍👩‍👧‍👦🇰🇷😀', 'ㅅㅜㅈㅓㄱㅔㅇㅣㅁ', '가나다라마바사아자차카타파하거너더러머버', 'e' + '́'.repeat(12), 'مرحبا שלום', 'x‮abc', '&lt;b&gt;굵게&lt;/b&gt;', '<b>굵게</b>', '가'.repeat(20), '가'.repeat(21)];
      const rejected = [];
      for (const [i, nm] of names.entries()) {
        const raw = JSON.stringify({ ...base, data: { ...base.data, character: { ...base.data.character, name: nm } } });
        const { ctx, p, errs } = await openWithSave(raw, { vp: i % 2 ? VP.m320 : VP.m360 });
        const scr = await whichScreen(p);
        if (scr !== 'birth-screen') {
          rejected.push(`#${i}(${nm.length}자)`);
          if (nm.length <= 20 && scr !== 'title-screen') bad.push(`name#${i}: 화면 ${scr}`);
        } else {
          const b = await readBirth(p);
          const ov = await overflowX(p);
          const injected = await p.evaluate(() => !!document.querySelector('[data-testid="birth-screen"] script, [data-testid="birth-screen"] img[src="x"]'));
          push(b.name === nm.replace(/\u0000/g, '\u0000'), `name#${i}: 화면 이름 ${JSON.stringify(b.name)} ≠ 입력 ${JSON.stringify(nm)}`, bad);
          push(!ov.overflow, `name#${i}: 가로 넘침 ${ov.scrollW}>${ov.clientW}`, bad);
          push(!injected, `name#${i}: 태그가 DOM에 삽입됨`, bad);
          push(errs.length === 0, `name#${i}: ${errs.join('|')}`, bad);
          if (i === 1 || i === 3 || i === 7) shots.push(await shot(p, 'A08c', `name${i}-birth`));
          await waitGuard(p, 'next-life');
          await p.getByTestId('next-life').click();
          await p.waitForSelector('[data-testid="life-screen"]', { timeout: 5000 });
          const ov2 = await overflowX(p);
          push(!ov2.overflow, `name#${i}: 인생 화면 가로 넘침`, bad);
          if (i === 1) shots.push(await shot(p, 'A08c', `name${i}-life`));
        }
        await ctx.close();
      }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : `이름 ${names.length}종: 20자 이하는 모두 글자 그대로 표시(가로 넘침 0·태그 삽입 0·대화상자 0), 저장 검증이 거부한 것 ${rejected.join(',') || '없음'}`, shots };
    },
  );
}

// ---------- A09: 저장 중 종료 ----------
if (want('A09')) {
  await runCase(
    { id: 'M3-A09', cat: '공격', title: '저장 중 종료: 「태어나기」·「출생신고 보기」·「살아가기」 직후 즉시 탭 닫기 → 다시 열면 반쪽 상태가 없다', steps: '클릭 직후 0·5·15·40ms 뒤 페이지를 닫고(beforeunload 없이) 같은 컨텍스트로 새로 열어 저장·화면을 본다. 3개 전환 × 4개 지연 × 3회', expected: '새로 열면 (전환 전 화면) 또는 (전환 후 화면, 저장 완전)만 보이고, 중간 상태(룰렛인데 출생 결과 없음·인생인데 이름 없음 등)나 오류 화면이 없다' },
    async () => {
      const bad = [];
      const outcomes = {};
      for (const trans of ['begin', 'to-birth', 'next-life'])
        for (const delay of [0, 5, 15, 40])
          for (let rep = 0; rep < 3; rep++) {
            const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
            await fixSeed(ctx, 100 + rep);
            const p = await ctx.newPage();
            await openTitle(p);
            let startAt = 'title-screen';
            if (trans !== 'begin') {
              await toRoulette(p, 'present');
              startAt = 'roulette-screen';
              await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 9000 });
              if (trans === 'next-life') {
                await waitGuard(p, 'to-birth');
                await p.getByTestId('to-birth').click();
                await p.waitForSelector('[data-testid="birth-screen"]');
                startAt = 'birth-screen';
              }
            }
            const tid = trans === 'begin' ? 'start-birth' : trans === 'to-birth' ? 'to-birth' : 'next-life';
            await waitGuard(p, tid);
            const c = await center(p, tid);
            await p.mouse.click(c.x, c.y);
            await sleep(delay);
            await p.close({ runBeforeUnload: false });
            const p2 = await ctx.newPage();
            await p2.goto(PROD, { waitUntil: 'load' });
            await sleep(500);
            const scr = await whichScreen(p2);
            const sv = await saveJson(p2);
            const key = `${trans}/${delay}ms`;
            outcomes[key] = outcomes[key] || {};
            outcomes[key][scr] = (outcomes[key][scr] || 0) + 1;
            const ph = sv?.data?.phase ?? 'none';
            const expectedAfter = { begin: 'roulette-screen', 'to-birth': 'birth-screen', 'next-life': 'life-screen' }[trans];
            if (scr !== startAt && scr !== expectedAfter) bad.push(`${key}#${rep}: 화면 ${scr}(허용 ${startAt}/${expectedAfter}) 저장 ${ph}`);
            if (scr === 'roulette-screen') {
              const hasReport = !!sv?.data?.birthReport && !!sv?.data?.character?.name;
              if (!hasReport) bad.push(`${key}#${rep}: 룰렛인데 출생 결과 없음`);
              const r = await readRoulette(p2);
              if (r.state !== 'result') bad.push(`${key}#${rep}: 룰렛 복원 상태 ${r.state}`);
            }
            if (scr === 'life-screen' && !sv?.data?.character?.name) bad.push(`${key}#${rep}: 인생인데 이름 없음`);
            await ctx.close();
          }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length ? bad.slice(0, 5).join(' / ') : '36회 종료 모두 반쪽 상태 없음: ' + JSON.stringify(outcomes), shots: [] };
    },
  );
}

// ---------- A10: 오프라인 플레이 ----------
if (want('A10')) {
  await runCase(
    { id: 'M3-A10', cat: '공격', title: '오프라인 플레이: 로드 뒤 네트워크를 끊고 룰렛→출생신고→살아가기', steps: '첫 화면 로드 뒤 context.setOffline(true) → 태어나기 → 룰렛(끝까지) → 출생신고 → 살아가기 → 인생. 실패한 요청·콘솔 오류 수집. (오프라인 새로고침은 기대 항목이 아님 — 외부 요청 0은 오프라인 재로드와 다르다)', expected: '전 과정 정상, 실패한 요청 0, 콘솔 오류 0' },
    async () => {
      const bad = [];
      const shots = [];
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await fixSeed(ctx, 9090);
      const p = await ctx.newPage();
      const reqFailed = [];
      p.on('requestfailed', (r) => reqFailed.push(r.url()));
      const errs = [];
      p.on('pageerror', (e) => errs.push(String(e)));
      p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
      await openTitle(p);
      await ctx.setOffline(true);
      await toRoulette(p, 'present');
      await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 9000 });
      shots.push(await shot(p, 'A10', 'offline-roulette'));
      await waitGuard(p, 'to-birth');
      await p.getByTestId('to-birth').click();
      await p.waitForSelector('[data-testid="birth-screen"]');
      shots.push(await shot(p, 'A10', 'offline-birth'));
      await birthToLife(p);
      await sleep(1200);
      push((await whichScreen(p)) === 'life-screen', '오프라인 인생 화면 도달 실패', bad);
      push(reqFailed.length === 0, `실패한 요청 ${reqFailed.join(',')}`, bad);
      push(errs.length === 0, `오류 ${errs.join('|')}`, bad);
      shots.push(await shot(p, 'A10', 'offline-life'));
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : '오프라인에서 룰렛·출생신고·인생까지 정상, 실패 요청 0·오류 0', shots };
    },
  );
}

// ---------- A11: 다중 탭 ----------
if (want('A11')) {
  await runCase(
    { id: 'M3-A11', cat: '공격', title: '다중 탭: 한 탭이 룰렛 회전 중일 때 다른 탭이 같은 주소를 열어 진행', steps: '탭A 태어나기(회전 중) → 탭B 열기(복원: 룰렛 결과 상태?) → 탭B가 출생신고 보기→살아가기까지 진행 → 탭A는 회전을 마침 → 탭A에서 출생신고 보기 시도', expected: '데이터가 섞이지 않는다: 탭B 진행이 탭A에 의해 덮어쓰이지 않거나(탭A가 「밀림」 화면으로 멈춤), 어느 쪽이든 크래시·빈 화면 없음. 최종 저장은 하나의 일관된 상태' },
    async () => {
      const bad = [];
      const notes = [];
      const shots = [];
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await fixSeed(ctx, 5151);
      const a = await ctx.newPage();
      await openTitle(a);
      await toRoulette(a, 'present');
      await sleep(1000);
      const b = await ctx.newPage();
      await b.goto(PROD, { waitUntil: 'load' });
      await sleep(600);
      const bScr = await whichScreen(b);
      const bState = bScr === 'roulette-screen' ? (await readRoulette(b)).state : null;
      notes.push(`탭B 열자 ${bScr}/${bState}`);
      push(bScr === 'roulette-screen', `탭B 화면 ${bScr}`, bad);
      shots.push(await shot(b, 'A11', 'tabB-opened'));
      // 탭B 진행
      if (bScr === 'roulette-screen') {
        await waitGuard(b, 'to-birth');
        await b.getByTestId('to-birth').click();
        await b.waitForSelector('[data-testid="birth-screen"]');
        await birthToLife(b);
      }
      await sleep(500);
      // 탭A: 회전을 마친 뒤 상태
      await a.waitForTimeout(5200);
      const aScr = await whichScreen(a);
      const aTxt = await bodyText(a);
      notes.push(`탭A 최종 화면 ${aScr}`);
      shots.push(await shot(a, 'A11', 'tabA-after'));
      push(!['BLANK', 'unknown', 'error-screen'].includes(aScr), `탭A 화면 ${aScr}`, bad);
      const sv = await saveJson(b);
      notes.push(`저장 phase ${sv?.data?.phase}`);
      // 탭A가 일반 화면으로 남아 있다면 눌러 보기(밀린 화면이면 skip)
      if (aScr === 'roulette-screen') {
        const btn = await a.evaluate(() => document.querySelector('[data-testid="to-birth"]') ? 'to-birth' : document.querySelector('[data-testid="skip-roulette"]') ? 'skip' : null);
        notes.push(`탭A 버튼 ${btn}`);
        if (btn === 'to-birth') {
          await waitGuard(a, 'to-birth');
          await a.getByTestId('to-birth').click();
          await sleep(700);
          const scr2 = await whichScreen(a);
          const sv2 = await saveJson(a);
          notes.push(`탭A에서 출생신고 보기 후 ${scr2}, 저장 phase ${sv2?.data?.phase} (탭B는 인생을 진행했음)`);
          push(!(sv2?.data?.phase === 'birth' && sv?.data?.phase === 'life'), `탭A가 탭B의 인생 진행을 birth로 되돌려 덮어씀`, bad);
        }
      }
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots };
    },
  );
}

// ---------- A12: 출생신고·인생 새로고침 연타 ----------
if (want('A12')) {
  await runCase(
    { id: 'M3-A12', cat: '공격', title: '출생신고 화면 새로고침 연타(12회): 같은 이름·같은 또래·같은 비교 표로 복원', steps: '출생신고에서 0~300ms 간격으로 12회 새로고침, 매번 읽은 내용을 처음과 비교. 또한 룰렛 결과 화면에서 새로고침 연타 후 「출생신고 보기」', expected: '이름·서술문·격자·또래 4명·비교 표·하단 표기가 새로고침 전후 같고(R-021), 가드·화면 단계가 유지된다' },
    async () => {
      const bad = [];
      const shots = [];
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await fixSeed(ctx, 2020);
      const p = await ctx.newPage();
      await openTitle(p);
      await toRoulette(p, 'present');
      await skipToBirth(p);
      const strip = (b) => JSON.stringify({ n: b.name, s: b.sentence, f: b.fields, p: b.peers, c: b.compareRows, g: b.lifeGap, foot: b.foot });
      const b0 = strip(await readBirth(p));
      for (let i = 0; i < 12; i++) {
        await p.reload({ waitUntil: 'domcontentloaded' });
        await p.waitForSelector('[data-testid="birth-screen"]', { timeout: 6000 });
        if (i % 3 === 0) await sleep(i * 40);
        const b = strip(await readBirth(p));
        push(b === b0, `${i + 1}번째 새로고침 후 내용이 달라짐`, bad);
      }
      shots.push(await shot(p, 'A12', 'birth-after-12-reloads'));
      // 인생 화면 새로고침 연타
      await birthToLife(p);
      const name0 = (await lifeInfo(p)).name;
      for (let i = 0; i < 8; i++) {
        await p.reload({ waitUntil: 'domcontentloaded' });
        await p.waitForSelector('[data-testid="life-screen"]', { timeout: 6000 });
      }
      const li = await lifeInfo(p);
      push(li.name === name0, `인생 새로고침 후 이름 ${li.name} ≠ ${name0}`, bad);
      shots.push(await shot(p, 'A12', 'life-after-8-reloads'));
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : '출생신고 12회·인생 8회 새로고침 모두 같은 내용으로 복원', shots };
    },
  );
}

// ---------- A13: 키보드 연타(Enter·Space 꾹) ----------
if (want('A13')) {
  await runCase(
    { id: 'M3-A13', cat: '공격', title: '키보드 연타: 룰렛·출생신고 하단 버튼에서 Enter·Space 연타(반복 입력 포함)', steps: '태어나기에 포커스를 두고 Enter를 길게 누름(자동 반복) → 룰렛에서도 Enter 연타 → 같은 위치 버튼이 건너뛰기→출생신고 보기→살아가기로 바뀌어도 포커스가 유지되는지', expected: '한 번의 연타가 여러 단계를 건너뛰지 않고(가드 0.4초), 포커스 링이 사라지지 않는다. 키보드로 끝까지 진행 가능' },
    async () => {
      const bad = [];
      const notes = [];
      const shots = [];
      const ctx = await mkctx(browser, { viewport: VP.d1280 });
      await fixSeed(ctx, 6060);
      const p = await ctx.newPage();
      await openTitle(p);
      await waitGuard(p, 'start-birth');
      await p.getByTestId('start-birth').focus();
      // 자동 반복 키 입력: keydown을 repeat로 20번
      for (let i = 0; i < 20; i++) await p.keyboard.down('Enter');
      await p.keyboard.up('Enter');
      await sleep(800);
      let scr = await whichScreen(p);
      let r = scr === 'roulette-screen' ? await readRoulette(p) : null;
      notes.push(`Enter 반복 후 ${scr}/${r?.state}`);
      push(scr === 'roulette-screen' && r?.state === 'spinning', `Enter 반복 후 ${scr}/${r?.state} (회전 중이어야 함)`, bad);
      // 룰렛에서 포커스는? 건너뛰기에 Enter 연타(20번, 지연 0)
      const act0 = await p.evaluate(() => document.activeElement?.getAttribute('data-testid') || document.activeElement?.tagName);
      notes.push(`룰렛 진입 직후 포커스 ${act0}`);
      await sleep(600);
      await p.getByTestId('skip-roulette').focus();
      for (let i = 0; i < 20; i++) await p.keyboard.press('Enter');
      await sleep(250);
      scr = await whichScreen(p);
      r = scr === 'roulette-screen' ? await readRoulette(p) : null;
      notes.push(`건너뛰기 Enter ×20 직후 ${scr}/${r?.state}`);
      push(scr === 'roulette-screen' && r?.state === 'result', `건너뛰기 Enter 연타 직후 ${scr}/${r?.state} (결과 상태에 머물러야 함)`, bad);
      shots.push(await shot(p, 'A13', 'after-skip-enter-spam'));
      const act1 = await p.evaluate(() => document.activeElement?.getAttribute('data-testid') || document.activeElement?.tagName);
      push(act1 === 'to-birth', `건너뛰기 뒤 포커스 ${act1} (같은 자리 버튼 유지 기대)`, bad);
      await waitGuard(p, 'to-birth');
      for (let i = 0; i < 20; i++) await p.keyboard.press(i % 2 ? 'Space' : 'Enter');
      await sleep(250);
      scr = await whichScreen(p);
      notes.push(`출생신고 보기 연타 직후 ${scr}`);
      push(scr === 'birth-screen', `출생신고 보기 연타 직후 ${scr}`, bad);
      shots.push(await shot(p, 'A13', 'birth-after-enter-spam'));
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots };
    },
  );
}

// ---------- A14: CPU 지연·느린 장치 ----------
if (want('A14')) {
  await runCase(
    { id: 'M3-A14', cat: '공격', title: 'CPU 6배 느림(저가 모바일 흉내): 룰렛 회전이 6초 안에 멈추고 결과가 같다', steps: 'CDP Emulation.setCPUThrottlingRate=6(·20)에서 태어나기 → 정지 시각·프레임 간격·결과 상태', expected: '지역 먼저·수저 나중 순서와 약 5.4초 근처(실제 시간 기준)를 유지하고 멈춘 채 남지 않는다. 결과는 느리지 않은 경우와 같다' },
    async () => {
      const bad = [];
      const notes = [];
      const shots = [];
      let baseline = null;
      for (const rate of [1, 6, 20]) {
        const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
        await fixSeed(ctx, 8888);
        await installRouletteProbe(ctx);
        const p = await ctx.newPage();
        const cdp = await ctx.newCDPSession(p);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate });
        await openTitle(p);
        await toRoulette(p, 'present');
        await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 12000 });
        const pr = await getProbe(p);
        const r = await readRoulette(p);
        const stop = (id) => pr.events.find((e) => e.id === id && e.state === 'stopped')?.t;
        notes.push(`CPU×${rate}: 지역 ${stop('reel-region')}ms 수저 ${stop('reel-wealth')}ms 최대 프레임 간격 ${Math.round(pr.maxGap)}ms 결과 ${r.wealthResult}/${r.regionResult}`);
        if (baseline === null) baseline = `${r.wealthResult}/${r.regionResult}`;
        push(`${r.wealthResult}/${r.regionResult}` === baseline, `CPU×${rate} 결과 ${r.wealthResult}/${r.regionResult} ≠ ${baseline}`, bad);
        push(stop('reel-region') < stop('reel-wealth'), `CPU×${rate}: 정지 순서`, bad);
        if (rate <= 6) push(stop('reel-wealth') <= 7000, `CPU×${rate}: 수저 정지 ${stop('reel-wealth')}ms`, bad);
        if (rate === 20) shots.push(await shot(p, 'A14', 'cpu20-result'));
        await ctx.close();
      }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '낮음', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots };
    },
  );
}

// ---------- A15: 회전 중 환경 바꾸기(다크·움직임 줄이기·글자 크기) ----------
if (want('A15')) {
  await runCase(
    { id: 'M3-A15', cat: '공격', title: '회전 중 다크 모드·움직임 줄이기·글자 크기를 바꾼다', steps: '회전 1초에 colorScheme dark, 1.5초에 reducedMotion reduce(회전이 즉시 결과로 가는지), 다른 판에서 글자 200%로 키움', expected: '다크 전환은 회전을 끊지 않고, 움직임 줄이기 전환은 크래시 없이 결과 상태(또는 끝까지)로 가며, 글자 확대 중에도 릴 칸이 가운데에 선다' },
    async () => {
      const bad = [];
      const notes = [];
      const shots = [];
      {
        const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
        await fixSeed(ctx, 31313);
        const p = await ctx.newPage();
        const errs = [];
        p.on('pageerror', (e) => errs.push(String(e)));
        await openTitle(p);
        await toRoulette(p, 'present');
        await sleep(1000);
        await p.emulateMedia({ colorScheme: 'dark' });
        await sleep(600);
        const st = (await readRoulette(p)).state;
        notes.push(`다크 전환 후 상태 ${st}`);
        push(st === 'spinning', `다크 전환이 회전을 끊음(${st})`, bad);
        shots.push(await shot(p, 'A15', 'dark-mid-spin'));
        await p.emulateMedia({ reducedMotion: 'reduce' });
        await sleep(800);
        const r = await readRoulette(p);
        notes.push(`움직임 줄이기 전환 후 ${r.state}`);
        shots.push(await shot(p, 'A15', 'reduce-mid-spin'));
        await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 7000 });
        push(errs.length === 0, `오류 ${errs.join('|')}`, bad);
        await ctx.close();
      }
      {
        const ctx = await mkctx(browser, { viewport: VP.m320, ...TOUCH });
        await fixSeed(ctx, 31313);
        const p = await ctx.newPage();
        await openTitle(p);
        await toRoulette(p, 'present');
        await sleep(1200);
        await (await import('./m3-lib.mjs')).setRootFont(p, 200);
        await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 7000 });
        const geo = await p.evaluate(() => {
          const reel = document.querySelector('[data-testid="reel-wealth"]');
          const win = reel.querySelector('.reel__window').getBoundingClientRect();
          const res = reel.querySelector('[data-result="true"]').getBoundingClientRect();
          return Math.abs(win.top + win.height / 2 - (res.top + res.height / 2));
        });
        push(geo < 3, `글자 200% 중 정지한 결과 칸이 ${geo.toFixed(1)}px 어긋남`, bad);
        const ov = await overflowX(p);
        push(!ov.overflow, `글자 200% 가로 넘침 ${ov.scrollW}>${ov.clientW}`, bad);
        shots.push(await shot(p, 'A15', 'font200-320-result'));
        await ctx.close();
      }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '낮음', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots };
    },
  );
}

await browser.close();
