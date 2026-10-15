// QA-003 M2 2회차: 새 보완 항목 — Q06(확정 버튼 문구, QM2-6) · Q07(푸터 빌드 표기, QM2-7) · Q08(그래프 첫 값 라벨, QM2-8)
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { launch, mkctx, runCase, shot, sleep, openTitle, waitGuard, VP, TOUCH, PROD, ROOT, SHOT_DIR, ensureFixture, seedContext, openState, saveInfo, whichScreen } from './m2r3-lib.mjs';
import { OVERFLOW_AUDIT, setRootFont } from './m2r3-textlib.mjs';

const browser = await launch();
const fx = await ensureFixture(browser);
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);

// ---------- Q06 확정 버튼 문구 ----------
if (want('Q06'))
  await runCase(
    { id: 'M2-Q06', cat: '정상', title: '확인 단계 확정 버튼 「이전 판 지우고 태어나기」 — 방금 누른 「새로 태어나기」와 구별되는가 (QM2-6)', steps: '개발 서버(?__exit)에서 「새로 태어나기」를 눌러 확인 단계를 열고, 화면의 버튼 이름 전부(접근성 이름), 확정·취소 이름이 서로/눌렀던 버튼과 다른지, 360x740·320x568 × 글자 100·200%에서 두 줄 이내·잘림 0·화면 안, 취소·확정 동작(이전 판 유지/삭제)을 본다', expected: '확정 이름 ≠ 「새로 태어나기」, 이름만으로 결과(이전 판 지움)가 드러남, 두 줄 이내·잘림 0, 취소는 이전 판 유지·확정은 새 판' },
    async () => {
      const problems = [];
      const facts = [];
      const shots = [];
      for (const [vp, touch] of [[VP.m360, true], [VP.m320, true]]) {
        for (const font of [100, 200]) {
          const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}) });
          await seedContext(ctx, fx);
          const p = await ctx.newPage();
          await openState(p, 'confirm');
          if (font !== 100) {
            await setRootFont(p, font);
            await sleep(350);
          }
          const info = await p.evaluate(() => {
            const names = [...document.querySelectorAll('[data-testid=bottom-bar] button')].map((b) => ({ id: b.getAttribute('data-testid'), name: (b.getAttribute('aria-label') || b.innerText).replace(/\s+/g, ' ').trim() }));
            const lines = (b) => {
              const rg = document.createRange();
              rg.selectNodeContents(b);
              return new Set([...rg.getClientRects()].map((r) => Math.round(r.top / 4))).size;
            };
            const yes = document.querySelector('[data-testid=confirm-new-yes]');
            const no = document.querySelector('[data-testid=confirm-new-no]');
            const rect = (b) => {
              const r = b.getBoundingClientRect();
              return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), clipped: b.scrollWidth > b.clientWidth + 1 };
            };
            return { names, yesLines: lines(yes), noLines: lines(no), yes: rect(yes), no: rect(no), ask: document.querySelector('[data-testid=confirm-new-ask]').innerText.replace(/\s+/g, ' ').trim(), vw: innerWidth, vh: innerHeight, beginNewPresent: !!document.querySelector('[data-testid=begin-new]') };
          });
          const tag = `${vp.width}x${vp.height}/${font}%`;
          const yesName = info.names.find((n) => n.id === 'confirm-new-yes')?.name;
          const noName = info.names.find((n) => n.id === 'confirm-new-no')?.name;
          if (yesName !== '이전 판 지우고 태어나기') problems.push(`${tag}: 확정 버튼 이름 「${yesName}」`);
          if (noName !== '돌아가기') problems.push(`${tag}: 취소 버튼 이름 「${noName}」`);
          if (info.names.some((n) => n.name === '새로 태어나기')) problems.push(`${tag}: 확인 단계에 「새로 태어나기」 버튼이 남아 있음`);
          if (yesName === noName) problems.push(`${tag}: 확정·취소 이름이 같음`);
          if (info.yesLines > 2 || info.noLines > 2) problems.push(`${tag}: 두 줄 초과 확정 ${info.yesLines}줄 취소 ${info.noLines}줄`);
          if (info.yes.clipped || info.no.clipped || info.yes.l < 0 || info.yes.r > info.vw || info.no.l < 0 || info.no.r > info.vw) problems.push(`${tag}: 버튼 잘림/화면 밖 ${JSON.stringify(info.yes)}`);
          if (info.yes.h < 44 || info.no.h < 44) problems.push(`${tag}: 버튼 높이 ${info.yes.h}/${info.no.h}px`);
          const ov = await p.evaluate(OVERFLOW_AUDIT);
          if (ov.docOverflowPx > 0) problems.push(`${tag}: 가로 넘침 ${ov.docOverflowPx}px`);
          facts.push(`${tag}: 확정 「${yesName}」 ${info.yesLines}줄 ${info.yes.w}x${info.yes.h}, 취소 「${noName}」 ${info.noLines}줄, 띠 ${ov.bar?.h}px`);
          shots.push(await shot(p, 'Q06', `${vp.width}x${vp.height}-${font}`));
          await ctx.close();
        }
      }
      // 동작: 취소 → 이전 판 유지, 확정 → 새 판
      {
        const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
        await seedContext(ctx, fx);
        const p = await ctx.newPage();
        await openState(p, 'confirm');
        const before = await saveInfo(p);
        await p.getByTestId('confirm-new-no').click();
        await sleep(300);
        const afterNo = await saveInfo(p);
        const resumeStill = await p.getByTestId('resume').count();
        await waitGuard(p, 'begin-new');
        await p.getByTestId('begin-new').click();
        await p.waitForSelector('[data-testid=confirm-new-yes]');
        await waitGuard(p, 'confirm-new-yes');
        await p.getByRole('button', { name: '이전 판 지우고 태어나기' }).click();
        await p.waitForSelector('[data-testid=birth-screen]', { timeout: 6000 });
        const afterYes = await saveInfo(p);
        await ctx.close();
        if (afterNo?.name !== before?.name || afterNo?.age !== before?.age || !resumeStill) problems.push(`취소 뒤 이전 판이 바뀜 ${JSON.stringify(afterNo)}`);
        if (afterYes?.phase !== 'birth' || afterYes?.seed === before?.seed) problems.push(`확정 뒤 새 판이 아님 ${JSON.stringify(afterYes)}`);
        facts.push(`동작: 취소 → ${before?.name} ${before?.age}세 유지·이어서 살기 유지, 확정(이름으로 찾아 클릭) → 새 판 phase=${afterYes?.phase} 이름 ${afterYes?.name}`);
      }
      return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') + ' || ' + facts.join(' ; ') : facts.join(' ; '), shots };
    }
  );

// ---------- Q07 푸터 빌드 표기 ----------
if (want('Q07'))
  await runCase(
    { id: 'M2-Q07', cat: '정상', title: '푸터 빌드 표기 — 로컬 빌드는 「+」 접미사, CI 빌드는 배포 커밋 7자 (QM2-7·FS7)', steps: '현재 prod(로컬) 빌드 푸터의 「v버전 (커밋)」을 읽어 git HEAD 앞 7자·작업 트리 변경 여부와 대조. GITHUB_SHA를 준 CI 흉내 빌드(임시 폴더)를 따로 띄워 푸터가 그 앞 7자이고 「+」가 없는지, 360px에서 넘침 없는지 확인', expected: '로컬: HEAD 7자 + (변경 있으면) 「+」, CI 흉내: GITHUB_SHA 앞 7자·「+」 없음' },
    async () => {
      const problems = [];
      const facts = [];
      const shots = [];
      const head = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
      const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim() !== '';
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      const p = await ctx.newPage();
      await openTitle(p);
      const label = (await p.getByTestId('build-version').innerText()).replace(/\s+/g, ' ').trim();
      const ov = await p.evaluate(OVERFLOW_AUDIT);
      await p.getByTestId('build-version').scrollIntoViewIfNeeded();
      shots.push(await shot(p, 'Q07', 'footer-local'));
      await ctx.close();
      const m = /^v(\d+\.\d+\.\d+) \(([0-9a-f]{7})(\+?)\)$/.exec(label.replace(/^.*?(v\d)/, '$1'));
      if (!m) problems.push(`푸터 표기 모양 이상 「${label}」`);
      else {
        if (m[2] !== head) problems.push(`로컬 푸터 커밋 ${m[2]} ≠ git HEAD ${head}`);
        if (dirty && m[3] !== '+') problems.push(`작업 트리에 변경이 있는데 「+」가 없음 「${label}」`);
        if (!dirty && m[3] === '+') problems.push(`작업 트리가 깨끗한데 「+」가 있음`);
      }
      if (ov.docOverflowPx > 0) problems.push(`푸터 360px 넘침 ${ov.docOverflowPx}px`);
      facts.push(`로컬 빌드 푸터 「${label}」, git HEAD ${head}, 작업 트리 변경 ${dirty ? '있음' : '없음'}`);
      // CI 흉내 빌드
      const scratch = process.env.QA_SCRATCH;
      if (scratch) {
        const out = path.join(scratch, 'dist-ci');
        const sha = '0123456789abcdef0123456789abcdef01234567';
        const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
        try {
          execFileSync(npx, ['vite', 'build', '--outDir', out, '--emptyOutDir'], { cwd: ROOT, env: { ...process.env, GITHUB_SHA: sha, PAGES_BASE: '/spoongame/', MSYS_NO_PATHCONV: '1' }, stdio: 'pipe', shell: process.platform === 'win32' });
          const srv = spawn(npx, ['vite', 'preview', '--outDir', out, '--port', '4499', '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, env: { ...process.env, PAGES_BASE: '/spoongame/' }, stdio: 'ignore', shell: process.platform === 'win32' });
          for (let i = 0; i < 40; i++) {
            try {
              const r = await fetch('http://127.0.0.1:4499/spoongame/');
              if (r.ok) break;
            } catch {}
            await sleep(250);
          }
          const ctx2 = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
          const p2 = await ctx2.newPage();
          await p2.goto('http://127.0.0.1:4499/spoongame/');
          await p2.waitForSelector('[data-testid=build-version]');
          const label2 = (await p2.getByTestId('build-version').innerText()).replace(/\s+/g, ' ').trim();
          await p2.getByTestId('build-version').scrollIntoViewIfNeeded();
          shots.push(await shot(p2, 'Q07', 'footer-ci'));
          await ctx2.close();
          if (!label2.includes(`(${sha.slice(0, 7)})`)) problems.push(`CI 흉내 푸터가 GITHUB_SHA 앞 7자(${sha.slice(0, 7)})가 아님 「${label2}」`);
          if (/\+/.test(label2)) problems.push(`CI 흉내 푸터에 「+」 「${label2}」`);
          facts.push(`CI 흉내(GITHUB_SHA=0123456…) 푸터 「${label2}」`);
          // 서버 정리: 띄운 프로세스 트리를 종료
          try {
            if (process.platform === 'win32') execFileSync('taskkill', ['/F', '/T', '/PID', String(srv.pid)], { stdio: 'ignore' });
          } catch {}
          srv.kill();
        } catch (e) {
          problems.push(`CI 흉내 빌드 실패 ${String(e.message).slice(0, 120)}`);
        }
      } else facts.push('(QA_SCRATCH 미설정 — CI 흉내 빌드는 건너뜀)');
      return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') + ' || ' + facts.join(' ; ') : facts.join(' ; '), shots };
    }
  );

// ---------- Q08 그래프 첫 값 라벨 ----------
const CHART_AUDIT = () => {
  const a = document.querySelector('.slide.is-active');
  const svg = a.querySelector('svg');
  if (!svg) return null;
  const texts = [...svg.querySelectorAll('text')].map((t) => {
    const b = t.getBBox();
    const cs = getComputedStyle(t);
    return { s: t.textContent, cls: t.getAttribute('class') || '', x: b.x, y: b.y, w: b.width, h: b.height, paint: cs.paintOrder, stroke: cs.stroke, sw: cs.strokeWidth, fs: parseFloat(cs.fontSize), fill: cs.fill };
  });
  const lines = [...svg.querySelectorAll('polyline')].map((pl) => pl.getAttribute('points').trim().split(/\s+/).map((pt) => pt.split(',').map(Number)));
  const dots = [...svg.querySelectorAll('circle')].map((c) => ({ x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), r: +c.getAttribute('r') }));
  const surface = getComputedStyle(a.closest('.carousel') || a.parentElement).backgroundColor;
  // 선분과 사각형 교차
  const segHitsRect = (p1, p2, r) => {
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const x = p1[0] + ((p2[0] - p1[0]) * i) / steps;
      const y = p1[1] + ((p2[1] - p1[1]) * i) / steps;
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
    }
    return false;
  };
  const rectInk = (t) => ({ x: t.x, y: t.y + t.h * 0.12, w: t.w, h: t.h * 0.7 });
  const res = texts.map((t, i) => {
    const r = rectInk(t);
    const onLine = lines.some((pts) => pts.slice(1).some((pt, k) => segHitsRect(pts[k], pt, r)));
    const onDot = dots.some((d) => d.x + d.r > r.x && d.x - d.r < r.x + r.w && d.y + d.r > r.y && d.y - d.r < r.y + r.h);
    const onText = texts.some((o, j) => {
      if (j === i) return false;
      const q = rectInk(o);
      return Math.min(r.x + r.w, q.x + q.w) - Math.max(r.x, q.x) > 0.5 && Math.min(r.y + r.h, q.y + q.h) - Math.max(r.y, q.y) > 0.5;
    });
    return { s: t.s, cls: t.cls, onLine, onDot, onText, paint: t.paint, stroke: t.stroke, sw: t.sw, fs: t.fs, fill: t.fill };
  });
  return { id: a.getAttribute('data-slide-id'), title: a.querySelector('h3').innerText, res, surface, svgW: Math.round(svg.getBoundingClientRect().width), hasLine: lines.length > 0 };
};

if (want('Q08'))
  await runCase(
    { id: 'M2-Q08', cat: '정상', title: '그래프 첫 값 글자 — 허용 목록(평균 수명·혼인 건수·고령인구 320px) 밖 겹침 0, 글자 스타일 (QM2-8·R-225)', steps: '320·360·1280에서 선 그래프 슬라이드마다 글자 상자(SVG getBBox)가 선·점·다른 글자와 겹치는지 계산, 허용 목록 슬라이드는 글자 스타일(paint-order·stroke·두께)을 읽고 스크린샷으로 사람 눈 확인', expected: '목록 밖 선·점·글자 겹침 0, 목록 안도 점·다른 글자 겹침 0, 글자 외곽선(카드 바탕색)으로 읽힘' },
    async () => {
      const problems = [];
      const facts = [];
      const shots = [];
      const KNOWN = [/^life-expectancy/, /^marriage-count/, /^aging-rate/];
      for (const [tag, vp, touch] of [['320', VP.m320, true], ['360', VP.m360, true], ['1280', VP.d1280, false]]) {
        const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}) });
        const p = await ctx.newPage();
        await openTitle(p);
        await waitGuard(p);
        await p.addStyleTag({ content: '[data-testid=bottom-bar]{visibility:hidden !important}' });
        await p.getByTestId('carousel-pause').click();
        await p.mouse.move(2, 2);
        const lineHits = [];
        for (let i = 0; i < 14; i++) {
          const c = await p.evaluate(CHART_AUDIT);
          if (c && c.hasLine) {
            const known = KNOWN.some((re) => re.test(c.id)) && (!/^aging-rate/.test(c.id) || tag === '320');
            for (const r of c.res) {
              const where = `${tag} ${c.title}(${c.id}) 글자「${r.s}」`;
              if (r.onDot) problems.push(`${where}: 점과 겹침`);
              if (r.onText) problems.push(`${where}: 다른 글자와 겹침`);
              if (r.onLine) {
                lineHits.push(`${tag} ${c.title} 「${r.s}」`);
                if (!known) problems.push(`${where}: 허용 목록 밖인데 선과 겹침`);
                if (!(r.paint.startsWith('stroke') && parseFloat(r.sw) >= 3 && r.stroke !== 'none')) problems.push(`${where}: 선에 걸리는데 외곽선 스타일 부족 paint=${r.paint} stroke=${r.stroke} ${r.sw}`);
              }
              if (r.fs < 12) problems.push(`${where}: 글자 ${r.fs}px`);
            }
            if (known && (tag === '320' || tag === '360')) {
              await p.getByTestId('carousel').scrollIntoViewIfNeeded();
              const name = `M2r3-Q08-${tag}-${c.id}.png`;
              await p.getByTestId('carousel').screenshot({ path: path.join(SHOT_DIR, name) });
              shots.push(`qa/screenshots/003/${name}`);
            }
          }
          await p.getByTestId('carousel-next').click();
          await p.mouse.move(2, 2);
          await sleep(450);
        }
        facts.push(`${tag}: 선과 걸린 글자 ${lineHits.length ? lineHits.join(', ') : '없음'}`);
        await ctx.close();
      }
      return { verdict: problems.length ? 'FAIL' : 'PASS', actual: (problems.length ? `이상 ${problems.length}건: ${problems.slice(0, 8).join(' // ')} || ` : '목록 밖 겹침 0, 점·다른 글자 겹침 0 || ') + facts.join(' ; '), shots: shots.slice(0, 6) };
    }
  );

await browser.close();
