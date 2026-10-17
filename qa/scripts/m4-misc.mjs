// QA-003 M4 기타 케이스: 상태 4색·얼굴 시각·인생 기록 스크롤·키보드 전용·움직임 줄이기·200% 조작·첫 화면 회귀. 사용: node qa/scripts/m4-misc.mjs [id-prefix]
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, newGameToLife, readDash, shot, sleep, runCase, con, PROD, TOUCH, VP, waitGuard, readRaw, GAME_KEY, SETTINGS_KEY, OUT, SHOT_DIR, openTitle, whichScreen, setRootFont, parseRgb } from './m4-lib.mjs';
import { openState } from './m4-states.mjs';

const only = process.argv[2] || '';
const want = (id) => !only || id.startsWith(only);
const browser = await launch();
const errs = () => con.take();
const lum = (c) => {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const ratio = (a, b) => {
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

// ===== N06b 상태 4색 =====
if (want('M4-N06b')) {
  await runCase(
    { id: 'M4-N06b', cat: '정상', title: '상태 4색: 건강·행복·지식·관계 막대가 서로 다른 색 + 라벨·수치 병기(색에만 의존하지 않음), role=meter 값=글자=막대 길이, 라이트·다크 둘 다', steps: '30세 저장을 라이트·다크로 열어 막대 채움색·너비·글자·aria 값 비교, 「상태 네 가지의 뜻」 펼침', expected: '4색이 서로 구별(채움색 쌍 대비 차이), 막대 너비 = 값 %, 수치와 라벨이 글자로 있음' },
    async () => {
      const bad = [];
      const notes = [];
      const shots = [];
      for (const scheme of ['light', 'dark']) {
        const { ctx, page: p } = await openState(browser, 'age30', { vp: { width: 360, height: 740, touch: true }, ctxOpts: { colorScheme: scheme } });
        const rows = await p.evaluate(() =>
          [...document.querySelectorAll('[data-stat]')].map((m) => {
            const fill = m.querySelector('[class*="meter__fill"], [class*="fill"], .meter__bar > *') || m.querySelector('span:nth-child(2) > *');
            const track = fill ? fill.parentElement : null;
            const val = m.querySelector('[data-testid^="stat-"]')?.textContent.trim();
            const meter = m.querySelector('[role="meter"]');
            return {
              key: m.getAttribute('data-stat'),
              label: m.textContent.replace(/\s+/g, ' ').trim().slice(0, 14),
              val,
              meterNow: meter?.getAttribute('aria-valuenow') ?? null,
              meterName: meter?.getAttribute('aria-label') ?? meter?.getAttribute('aria-labelledby') ?? null,
              fillBg: fill ? getComputedStyle(fill).backgroundColor : null,
              fillW: fill ? fill.getBoundingClientRect().width : null,
              trackW: track ? track.getBoundingClientRect().width : null,
              hasIcon: !!m.querySelector('svg'),
            };
          }),
        );
        if (rows.length !== 4) bad.push(`${scheme}: 상태 ${rows.length}개`);
        const cols = rows.map((r) => parseRgb(r.fillBg));
        const seen = new Set(rows.map((r) => r.fillBg));
        if (seen.size !== rows.length) bad.push(`${scheme}: 채움색이 겹침 ${[...seen]}`);
        let minPair = 99;
        for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) if (cols[i] && cols[j]) minPair = Math.min(minPair, ratio(cols[i], cols[j]));
        for (const r of rows) {
          if (r.meterNow !== null && r.meterNow !== r.val) bad.push(`${scheme}: ${r.key} meter ${r.meterNow} ≠ 글자 ${r.val}`);
          if (r.fillW !== null && r.trackW) {
            const pct = (100 * r.fillW) / r.trackW;
            if (Math.abs(pct - Number(r.val)) > 1.5) bad.push(`${scheme}: ${r.key} 막대 ${pct.toFixed(1)}% ≠ ${r.val}`);
          }
        }
        notes.push(`${scheme}: ${rows.map((r) => `${r.label.split(' ')[0]} ${r.val} ${r.fillBg}`).join(' / ')} (색 쌍 최소 명도 대비 ${minPair.toFixed(2)})`);
        await p.locator('details summary').first().click().catch(() => {});
        await sleep(200);
        const help = await p.evaluate(() => document.querySelector('details')?.innerText.replace(/\s+/g, ' '));
        if (scheme === 'light') notes.push(`도움말: ${help}`);
        await p.getByTestId('stats').scrollIntoViewIfNeeded();
        await sleep(200);
        shots.push(await shot(p, 'N06b', scheme));
        await ctx.close();
      }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots };
    },
  );
}

// ===== N13 얼굴: 나이대별 =====
if (want('M4-N13')) {
  await runCase(
    { id: 'M4-N13', cat: '정상', title: '프로필 얼굴이 나이대마다 다른 그림으로 보인다(96px 정사각, 라이트·다크): 영아·유아·아동·청소년·청년·중년·장년·노년', steps: '저장(0·5·10·16·30·55·65·78세)을 열어 프로필 카드 얼굴의 크기와 SVG 내용 해시를 비교하고 카드 스크린샷', expected: '얼굴 상자 96×96, 연령대마다 그림 해시가 다름, 같은 사람의 외모 글자는 그대로' },
    async () => {
      const bad = [];
      const notes = [];
      const shots = [];
      const hashes = new Map();
      const tags = [['infant', 0], ['age5', 5], ['age10', 10], ['age16', 16], ['age30', 30], ['age55', 55], ['age65', 65], ['age78', 78]];
      const have = (t) => fs.existsSync(path.join(OUT, 'saves', `present-${t}.json`));
      for (const [tag, age] of tags) {
        if (!have(tag)) {
          notes.push(`${tag} 저장 없음`);
          continue;
        }
        const { ctx, page: p } = await openState(browser, 'age30', { saveTag: tag, vp: { width: 1280, height: 800 } });
        const f = await p.evaluate(() => {
          const el = document.querySelector('[data-testid="profile-card"] [data-testid="face"]');
          const r = el.getBoundingClientRect();
          const svg = el.querySelector('svg');
          let h = 0;
          const s = svg.innerHTML;
          for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
          return { w: Math.round(r.width), h: Math.round(r.height), group: el.getAttribute('data-age-group'), hash: h, age: parseInt(document.querySelector('[data-testid="life-age"] b').textContent, 10), looks: document.querySelector('[data-testid="profile-looks"]').textContent.replace(/\s+/g, ' ').trim() };
        });
        if (f.w !== 96 || f.h !== 96) bad.push(`${tag}: 얼굴 ${f.w}×${f.h}`);
        hashes.set(f.group, f.hash);
        notes.push(`${f.age}세 ${f.group} ${f.w}×${f.h}`);
        const card = p.getByTestId('profile-card');
        await card.screenshot({ path: path.join(SHOT_DIR, `M4-N13-face-${f.age}.png`) });
        shots.push(`qa/screenshots/003/M4-N13-face-${f.age}.png`);
        await ctx.close();
      }
      const uniq = new Set(hashes.values()).size;
      if (uniq !== hashes.size) bad.push(`연령대가 달라도 같은 그림: 그룹 ${hashes.size}개 중 해시 ${uniq}종`);
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + `그룹 ${[...hashes.keys()].join(',')} 서로 다른 그림 ${uniq}/${hashes.size} | ` + notes.join(', '), shots };
    },
  );
}

// ===== N08b 인생 기록 스크롤·새 기록 N개 =====
if (want('M4-N08b')) {
  await runCase(
    { id: 'M4-N08b', cat: '정상', title: '인생 기록 스크롤: 맨 아래를 보는 동안 새 줄을 따라가고, 위로 올리면 멈춰 「새 기록 N개 · 맨 아래로」가 뜨며(N=쌓인 줄 수), 누르면 맨 아래·표시 사라짐. 맨 위 가상 인구 줄은 고정', steps: '16세 저장(기록 영역이 스크롤됨) → 자동 모드 + 8배속 → (가) 맨 아래 상태에서 새 줄이 쌓이는지 (나) 위로 올려 둔 채 새 줄 2개 이상 → 「새 기록」 버튼·개수 (다) 버튼 누름 (라) 가상 인구 줄 위치 (마) PageUp 키로 스크롤', expected: '(가) 맨 아래 유지 (나) 위치 유지·버튼 N개 (다) 맨 아래·버튼 사라짐 (라) 줄 위치 불변 (마) 키로 스크롤' },
    async () => {
      const bad = [];
      const notes = [];
      const shots = [];
      for (const [name, vp] of [['360', { width: 360, height: 740, touch: true }], ['1280', { width: 1280, height: 800 }]]) {
        const { ctx, page: p } = await openState(browser, 'age30', { saveTag: 'age16', vp });
        const info = () =>
          p.evaluate(() => {
            const l = document.querySelector('[data-testid="log-list"]');
            const pin = document.querySelector('[data-testid="log-pin"]');
            const jump = document.querySelector('[data-testid="log-jump"]');
            return { st: Math.round(l.scrollTop), ch: l.clientHeight, sh: l.scrollHeight, rows: l.querySelectorAll('[data-testid="log-row"]').length, pinTop: Math.round(pin.getBoundingClientRect().top - document.querySelector('[data-testid="log"]').getBoundingClientRect().top), jump: jump ? jump.textContent.replace(/\s+/g, ' ').trim() : null };
          });
        let i0 = await info();
        notes.push(`${name}: 시작 rows ${i0.rows}, 스크롤 ${i0.st}/${i0.sh - i0.ch}`);
        if (i0.sh <= i0.ch) bad.push(`${name}: 기록 영역이 스크롤될 만큼 길지 않음(sh ${i0.sh} ch ${i0.ch}) — 표본 부족`);
        if (i0.sh - i0.ch - i0.st > 24) bad.push(`${name}: 복원 직후 맨 아래가 아님 ${i0.st}/${i0.sh - i0.ch}`);
        await p.getByTestId('auto').click();
        await p.locator('[data-speed="8"]').click();
        await p.getByTestId('pause').click(); // 다시 진행
        // (가) 새 줄이 올 때까지
        let t0 = Date.now();
        let cur = i0;
        while (cur.rows <= i0.rows && Date.now() - t0 < 30000) {
          await sleep(200);
          cur = await info();
        }
        await sleep(300);
        cur = await info();
        const atBottom = cur.sh - cur.ch - cur.st <= 24;
        notes.push(`${name} (가) 새 줄 ${i0.rows}→${cur.rows}, 맨 아래 ${atBottom}`);
        if (cur.rows <= i0.rows) bad.push(`${name}: 30초 안에 새 줄이 안 쌓임`);
        if (!atBottom) bad.push(`${name}: 맨 아래를 보고 있는데 새 줄을 따라가지 않음 ${cur.st}/${cur.sh - cur.ch}`);
        if (cur.jump) bad.push(`${name}: 맨 아래인데 새 기록 버튼이 보임`);
        // (나) 위로 올림
        const pin0 = cur.pinTop;
        await p.getByTestId('log-list').evaluate((l) => {
          l.scrollTop = 0;
          l.dispatchEvent(new Event('scroll'));
        });
        await sleep(300);
        const rowsAtTop = (await info()).rows;
        t0 = Date.now();
        let after = await info();
        while (after.rows < rowsAtTop + 2 && Date.now() - t0 < 40000) {
          await sleep(300);
          after = await info();
        }
        await sleep(300);
        after = await info();
        const gained = after.rows - rowsAtTop;
        notes.push(`${name} (나) 위에 둔 채 새 줄 +${gained}, 스크롤 ${after.st}, 버튼 「${after.jump}」`);
        if (after.st > 5) bad.push(`${name}: 위로 올려 둔 위치를 잃고 끌려 내려감 ${after.st}`);
        if (!after.jump || !new RegExp(`새 기록\\s*${gained}\\s*개`).test(after.jump)) bad.push(`${name}: 새 줄 +${gained}인데 버튼 「${after.jump}」`);
        if (after.pinTop !== pin0) bad.push(`${name}: 가상 인구 고정 줄이 움직임 ${pin0}→${after.pinTop}`);
        shots.push(await shot(p, 'N08b', `${name}-scrolled-up`));
        // (다) 버튼
        await p.getByTestId('log-jump').click();
        await sleep(700);
        const done = await info();
        notes.push(`${name} (다) 버튼 뒤 스크롤 ${done.st}/${done.sh - done.ch}, 버튼 ${done.jump}`);
        if (done.sh - done.ch - done.st > 30) bad.push(`${name}: 버튼을 눌러도 맨 아래로 안 감 ${done.st}/${done.sh - done.ch}`);
        if (done.jump) bad.push(`${name}: 누른 뒤에도 버튼이 남음`);
        // (마) 키보드
        await p.getByTestId('log-list').focus();
        await p.keyboard.press('PageUp');
        await sleep(400);
        const key = await info();
        if (key.st >= done.st) bad.push(`${name}: 포커스 + PageUp으로 스크롤되지 않음`);
        notes.push(`${name} (마) PageUp ${done.st}→${key.st}`);
        await ctx.close();
      }
      const e = errs();
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots };
    },
  );
}

// ===== C01 키보드만 =====
if (want('M4-C01')) {
  await runCase(
    { id: 'M4-C01', cat: '접근성', title: '키보드만으로 전체 조작: 첫 화면 → 룰렛 → 출생신고 → 대시보드(일시정지·배속·다음 결정으로·자동 모드·BGM·다크·나가기 확인 Esc·선택지 카드), Tab 순서·포커스 이동', steps: '마우스·터치 없이 Tab·Shift+Tab·Enter·Space·Esc만. 대시보드에서 Tab 순서를 기록하고 각 조작이 동작하는지 확인', expected: '모든 조작이 키보드로 닿고 동작, 화면 전환 때 포커스가 제목에, 나가기 확인은 Esc로 닫혀 포커스가 나가기로 복귀, 카드 선택도 키보드로' },
    async () => {
      const bad = [];
      const notes = [];
      const ctx = await mkctx(browser, { viewport: VP.d1280 });
      await cleanStorageOnce(ctx);
      await fixSeed(ctx, 229);
      const p = await ctx.newPage();
      const active = () => p.evaluate(() => { const a = document.activeElement; return a && a !== document.body ? a.getAttribute('data-testid') || a.getAttribute('aria-label') || a.tagName : 'body'; });
      await openTitle(p);
      await sleep(400);
      // 태어나기까지 Tab
      let n = 0;
      for (; n < 60; n++) {
        await p.keyboard.press('Tab');
        await sleep(30);
        if ((await active()) === 'start-birth') break;
      }
      if ((await active()) !== 'start-birth') bad.push('첫 화면에서 Tab으로 태어나기에 못 닿음');
      await waitGuard(p, 'start-birth');
      await p.keyboard.press('Enter');
      await p.waitForSelector('[data-testid="roulette-screen"]');
      await sleep(300);
      await p.keyboard.press('Tab');
      await waitGuard(p, 'skip-roulette');
      await p.keyboard.press('Space');
      await p.waitForSelector('[data-testid="to-birth"]');
      await sleep(200);
      await waitGuard(p, 'to-birth');
      await p.keyboard.press('Enter');
      await p.waitForSelector('[data-testid="birth-screen"]');
      await sleep(400);
      await p.keyboard.press('Tab');
      await waitGuard(p, 'next-life');
      await p.keyboard.press('Enter');
      await p.waitForSelector('[data-testid="life-screen"]');
      await sleep(500);
      const arrive = await active();
      notes.push(`대시보드 도착 포커스 ${arrive}`);
      if (arrive !== 'life-name') bad.push(`대시보드 도착 포커스 ${arrive} (이름 제목 기대)`);
      // Tab 순서
      const order = [];
      for (let i = 0; i < 40; i++) {
        await p.keyboard.press('Tab');
        await sleep(40);
        const a = await active();
        if (order.length && a === order[0]) break;
        order.push(a);
        if (a === 'body') break;
      }
      notes.push(`Tab 순서(1280): ${order.join(' → ')}`);
      const must = ['pause', 'skip', 'auto', 'tool-bgm', 'tool-note', 'tool-dark', 'tool-feedback', 'tool-exit', 'log-list'];
      for (const m of must) if (!order.includes(m)) bad.push(`Tab 순회에 ${m} 없음`);
      if (order.some((x) => x === 'tool-note') === false) bad.push('「생각 남기기」(선택 불가)가 포커스를 못 받음');
      // 동작: 일시정지 Space
      await p.getByTestId('pause').focus();
      await p.keyboard.press('Space');
      await sleep(250);
      if ((await readDash(p)).paused !== 'true') bad.push('Space로 일시정지 안 됨');
      await p.keyboard.press('Enter');
      await sleep(250);
      if ((await readDash(p)).paused !== 'false') bad.push('Enter로 다시 진행 안 됨');
      // 배속 Tab + Enter
      await p.keyboard.press('Tab');
      await p.keyboard.press('Tab');
      await p.keyboard.press('Enter');
      await sleep(200);
      const sp = (await readDash(p)).speed;
      notes.push(`Tab Tab Enter → 배속 ${sp}`);
      // 자동 모드
      await p.getByTestId('auto').focus();
      await p.keyboard.press('Enter');
      await sleep(200);
      if ((await readDash(p)).auto !== 'true') bad.push('Enter로 자동 모드 안 켜짐');
      await p.keyboard.press('Enter');
      await sleep(200);
      // BGM·다크
      await p.getByTestId('tool-bgm').focus();
      await p.keyboard.press('Enter');
      await sleep(250);
      if ((await readDash(p)).bgmOn !== 'true') bad.push('Enter로 BGM 안 켜짐');
      await p.keyboard.press('Enter');
      await p.getByTestId('tool-dark').focus();
      await p.keyboard.press('Space');
      await sleep(250);
      if ((await readDash(p)).darkOn !== 'true') bad.push('Space로 다크 모드 안 켜짐');
      await p.keyboard.press('Space');
      // 나가기 확인 + Esc
      await p.getByTestId('tool-exit').focus();
      await p.keyboard.press('Enter');
      await p.waitForSelector('[data-testid="exit-ask"]');
      await sleep(250);
      const f1 = await active();
      notes.push(`나가기 → 확인 단계 포커스 ${f1}`);
      if (f1 !== 'exit-no') bad.push(`확인 단계 포커스 ${f1}`);
      await p.keyboard.press('Escape');
      await sleep(250);
      const f2 = await active();
      if ((await readDash(p)).exitAsk) bad.push('Esc로 확인 단계가 안 닫힘');
      if (f2 !== 'tool-exit') bad.push(`Esc 뒤 포커스 ${f2}`);
      // 선택지 카드를 키보드로
      await p.locator('[data-speed="8"]').focus();
      await p.keyboard.press('Enter');
      await p.getByTestId('skip').focus();
      await waitGuard(p, 'skip');
      await p.keyboard.press('Enter');
      await p.waitForSelector('[data-testid="choice-panel"]', { timeout: 15000 }).catch(() => {});
      await sleep(400);
      const f3 = await active();
      notes.push(`카드 뜬 뒤 포커스 ${f3}`);
      const rowsBefore = (await readDash(p)).logRows;
      await p.keyboard.press('Tab');
      await sleep(100);
      const f4 = await active();
      notes.push(`카드 제목 다음 Tab → ${f4}`);
      await waitGuardChoice(p);
      await p.keyboard.press('Enter');
      await sleep(500);
      const after = await readDash(p);
      if (after.hasChoice && after.logRows === rowsBefore) bad.push('키보드로 선택지가 선택되지 않음');
      await shot(p, 'C01', 'kbd-dashboard');
      const e = errs();
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots: ['qa/screenshots/003/M4-C01-kbd-dashboard.png'] };
    },
  );
}
async function waitGuardChoice(p) {
  await p.waitForFunction(() => {
    const b = document.querySelector('[data-testid="choice-panel"] .choice');
    return b && b.getAttribute('aria-disabled') !== 'true';
  }, null, { timeout: 4000 }).catch(() => {});
}

// ===== C02 움직임 줄이기 =====
if (want('M4-C02')) {
  await runCase(
    { id: 'M4-C02', cat: '접근성', title: '움직임 줄이기(prefers-reduced-motion): 진행률 바가 10% 단계로만 움직이고 부드러운 전환이 꺼지며, 정보는 그대로(퍼센트·나이)', steps: 'reducedMotion=reduce로 새 판 → 1배속 10초 동안 퍼센트 값을 기록 → 값이 10의 배수뿐인지, 바 채움의 transition 시간 확인', expected: '표시 퍼센트가 0·10·…·100만, 채움 transition 0s, 나이는 정상 증가' },
    async () => {
      const bad = [];
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH, reducedMotion: 'reduce' });
      await cleanStorageOnce(ctx);
      await fixSeed(ctx, 229);
      const p = await ctx.newPage();
      await newGameToLife(p);
      const seen = new Set();
      const t0 = Date.now();
      const trans = await p.evaluate(() => {
        const f = document.querySelector('[data-testid="year-progress-fill"]');
        const cs = getComputedStyle(f);
        return { dur: cs.transitionDuration, prop: cs.transitionProperty };
      });
      while (Date.now() - t0 < 10000) {
        const d = await readDash(p);
        seen.add(d.pct);
        await sleep(50);
      }
      const vals = [...seen].map((s) => parseInt(s, 10));
      const nonStep = vals.filter((v) => v % 10 !== 0);
      if (nonStep.length) bad.push(`10% 단계가 아닌 표시값 ${nonStep}`);
      if (!/^0s(, 0s)*$/.test(trans.dur)) bad.push(`바 채움 transition ${trans.dur}`);
      const d = await readDash(p);
      if (!(d.age >= 1)) bad.push(`10초 동안 나이가 안 오름 ${d.age}`);
      await shot(p, 'C02', 'reduced-motion');
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '낮음', actual: bad.length ? bad.join(' / ') : `표시값 ${vals.sort((a, b) => a - b).join(',')}%, transition ${trans.dur}, 나이 ${d.age}`, shots: ['qa/screenshots/003/M4-C02-reduced-motion.png'] };
    },
  );
}

// ===== C03 200% 확대에서 조작 =====
if (want('M4-C03')) {
  await runCase(
    { id: 'M4-C03', cat: '접근성', title: '글자 200% 확대에서 모든 컨트롤·도구가 실제로 눌린다(가려지지 않음): 360×740·320×568·640×400, 일시정지·배속·자동 모드·BGM·다크·나가기', steps: '글자 200% 적용 → 각 버튼을 화면 안으로 스크롤해 중심 점의 elementFromPoint가 그 버튼인지 확인하고 실제 클릭해 동작 확인', expected: '중심 점이 버튼(또는 안의 요소), 클릭으로 상태가 바뀜' },
    async () => {
      const bad = [];
      const notes = [];
      const shots = [];
      const askTitleHidden = [];
      for (const [name, vp] of [['360x740', { width: 360, height: 740, touch: true }], ['320x568', { width: 320, height: 568, touch: true }], ['640x400', { width: 640, height: 400 }]]) {
        const { ctx, page: p } = await openState(browser, 'age30', { vp, font: 200 });
        const ids = ['pause', 'tool-bgm', 'tool-dark', 'tool-exit', 'auto'];
        for (const id of ids) {
          const loc = p.getByTestId(id);
          await loc.scrollIntoViewIfNeeded();
          await sleep(150);
          const hit = await loc.evaluate((el) => {
            const r = el.getBoundingClientRect();
            const x = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1);
            const y = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
            const t = document.elementFromPoint(x, y);
            return { ok: !!t && (el === t || el.contains(t)), tag: t ? (t.getAttribute('data-testid') || t.tagName) : null, top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight };
          });
          if (!hit.ok) bad.push(`${name}: ${id} 중심이 ${hit.tag}에 가려짐 (${hit.top}~${hit.bottom}/${hit.vh})`);
        }
        // 실제 클릭
        const d0 = await readDash(p);
        await p.getByTestId('pause').click();
        await sleep(200);
        const d1 = await readDash(p);
        if (d1.paused === d0.paused) bad.push(`${name}: 일시정지 클릭이 안 먹음`);
        await p.getByTestId('tool-dark').click();
        await sleep(200);
        const d2 = await readDash(p);
        if (d2.darkOn === d1.darkOn) bad.push(`${name}: 다크 클릭이 안 먹음`);
        await p.getByTestId('auto').click();
        await sleep(200);
        if ((await readDash(p)).auto === d2.auto) bad.push(`${name}: 자동 모드 클릭이 안 먹음`);
        await p.getByTestId('tool-exit').click();
        await p.waitForSelector('[data-testid="exit-ask"]');
        await sleep(300);
        const askIn = await p.evaluate(() => {
          const t = document.querySelector('[data-testid="exit-ask"] .exit-ask__title');
          const b = document.querySelector('[data-testid="exit-no"]');
          const r1 = t.getBoundingClientRect();
          const r2 = b.getBoundingClientRect();
          return { t1: Math.round(r1.top), b2: Math.round(r2.bottom), vh: innerHeight, focus: document.activeElement?.getAttribute('data-testid') };
        });
        if (askIn.b2 > askIn.vh + 1 || askIn.b2 < 0) bad.push(`${name}: 포커스를 받은 취소 버튼이 화면 밖 ${JSON.stringify(askIn)}`);
        if (askIn.t1 < 0) askTitleHidden.push(`${name} 글자 200%: 안내문 첫 줄이 화면 위로 ${-askIn.t1}px 나감(취소 버튼은 화면 안)`);
        if (name === '360x740') shots.push(await shot(p, 'C03', `exit-ask-${name}-200`));
        notes.push(`${name}: 확인 단계 안내문 ${askIn.t1}~, 돌아가기 ${askIn.b2}/${askIn.vh}, 포커스 ${askIn.focus}`);
        await ctx.close();
      }
      if (askTitleHidden.length) notes.push('(기록 M4-O03) ' + askTitleHidden.join(' / '));
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots };
    },
  );
}

// ===== R01 첫 화면·룰렛·출생신고 회귀 =====
if (want('M4-R01')) {
  await runCase(
    { id: 'M4-R01', cat: '회귀', title: '첫 화면·룰렛·출생신고 핵심(M2·M3) 회귀: 로고·가상 인구·세상 3·인생 길이 2(「약 1시간」 준비 중)·캐러셀 14장·하단 고정 태어나기·푸터 빌드, 룰렛 확률표 합·건너뛰기, 출생신고 항목 11개·또래 4명·「살아가기」', steps: '새 판 시작해 각 화면의 핵심 요소·문구를 읽는다', expected: 'M3 QA 기준 그대로' },
    async () => {
      const bad = [];
      const notes = [];
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await cleanStorageOnce(ctx);
      await fixSeed(ctx, 229);
      const p = await ctx.newPage();
      await openTitle(p);
      await sleep(400);
      const t = await p.evaluate(() => {
        const q = (s) => document.querySelector(s);
        const tx = (s) => (q(s) ? q(s).textContent.replace(/\s+/g, ' ').trim() : null);
        return { pop: tx('[data-testid="population-line"]'), note: tx('[data-testid="population-note"]'), eras: [...document.querySelectorAll('[data-testid="era-group"] input')].map((i) => i.value), lengths: [...document.querySelectorAll('[data-testid="life-length-group"] input')].map((i) => `${i.value}${i.disabled || i.getAttribute('aria-disabled') === 'true' ? ':선택불가' : ''}`), carousel: tx('[data-testid="carousel-count"]'), btn: tx('[data-testid="start-birth"]'), build: tx('[data-testid="build-version"]'), logo: !!q('[data-testid="title-logo-stacked"], [data-testid="title-logo-row"]') };
      });
      notes.push(`첫 화면: ${JSON.stringify(t)}`);
      if (!/명이 이 시뮬레이션 속에서 각자의 삶을 살고 있어요/.test(t.pop ?? '')) bad.push(`가상 인구 문구 ${t.pop}`);
      if (t.eras.length !== 3) bad.push(`세상 ${t.eras.length}개`);
      if (t.lengths.length !== 2 || !t.lengths.some((l) => /선택불가/.test(l))) bad.push(`인생 길이 ${t.lengths}`);
      if (!/\/ 14/.test(t.carousel ?? '')) bad.push(`캐러셀 위치 ${t.carousel}`);
      if (t.btn !== '태어나기') bad.push(`버튼 ${t.btn}`);
      if (!/^v\d/.test(t.build ?? '')) bad.push(`푸터 빌드 ${t.build}`);
      await shot(p, 'R01', 'title');
      await toRoulette(p);
      await sleep(1000);
      const r = await p.evaluate(() => {
        const odds = (id) => [...document.querySelectorAll(`[data-testid="${id}"] tbody tr`)].map((tr) => parseFloat(tr.querySelector('td')?.textContent));
        return { w: odds('odds-wealth'), g: odds('odds-region') };
      });
      const sumW = Math.round(r.w.reduce((s, x) => s + x, 0) * 10) / 10;
      const sumG = Math.round(r.g.reduce((s, x) => s + x, 0) * 10) / 10;
      notes.push(`룰렛 확률표 합 수저 ${sumW} 지역 ${sumG}(${r.g.length}칸)`);
      if (sumW !== 100 || sumG !== 100) bad.push(`확률 합 ${sumW}/${sumG}`);
      await skipToBirthLocal(p);
      const b = await p.evaluate(() => ({ fields: [...document.querySelectorAll('[data-testid^="birth-field-"]')].length, peers: document.querySelectorAll('[data-testid="peer"]').length, sentence: document.querySelector('[data-testid="birth-sentence"]')?.textContent.replace(/\s+/g, ' ').trim(), next: document.querySelector('[data-testid="next-life"]')?.textContent.trim() }));
      notes.push(`출생신고: 항목 ${b.fields}, 또래 ${b.peers}, 버튼 ${b.next}`);
      if (b.fields < 11) bad.push(`출생신고 항목 ${b.fields}개`);
      if (b.peers !== 4) bad.push(`또래 ${b.peers}명`);
      await shot(p, 'R01', 'birth');
      const e = errs();
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots: ['qa/screenshots/003/M4-R01-title.png', 'qa/screenshots/003/M4-R01-birth.png'] };
    },
  );
}
async function toRoulette(p) {
  await waitGuard(p, 'start-birth');
  await p.getByTestId('start-birth').click();
  await p.waitForSelector('[data-testid="roulette-screen"]');
}
async function skipToBirthLocal(p) {
  await waitGuard(p, 'skip-roulette').catch(() => {});
  if (await p.locator('[data-testid="skip-roulette"]').count()) await p.getByTestId('skip-roulette').click();
  await p.waitForSelector('[data-testid="to-birth"]');
  await waitGuard(p, 'to-birth');
  await p.getByTestId('to-birth').click();
  await p.waitForSelector('[data-testid="birth-screen"]');
  await sleep(400);
}

await browser.close();
