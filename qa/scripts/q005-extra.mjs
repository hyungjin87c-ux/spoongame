// 손으로 남기는 기록: 관찰(RECORD)·건너뜀(SKIP) 케이스. 사용: node qa/scripts/q005-extra.mjs
import { launchChromium, VP, PROD, DEV, run, ok, bad, note, shot, record, sleep } from './q005-lib.mjs';

const b = await launchChromium();
// ---- 360 첫 화면: 그림은 로고 아래 배너 (완료 기준 8 「같은 줄」 문구와 다름 — 형진 님 r3 확정 배너 224px) ----
{
  const ctx = await b.newContext({ ...VP.m360, locale: 'ko-KR' });
  const page = await ctx.newPage();
  await page.goto(PROD + '/');
  await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
  await sleep(1200);
  const m = await page.evaluate(() => {
    const logo = document.querySelector('[data-testid=title-logo-word]').getBoundingClientRect();
    const fig = [...document.querySelectorAll('[data-testid^=home-illust]')].find((e) => e.getBoundingClientRect().width > 0).getBoundingClientRect();
    const build = document.querySelector('[data-testid=build-version]')?.innerText.replace(/\s+/g, ' ').trim();
    return { logo: `${Math.round(logo.width)}x${Math.round(logo.height)}`, fig: `${Math.round(fig.width)}x${Math.round(fig.height)} (로고 아래 ${Math.round(fig.top - logo.bottom)}px)`, sameRow: fig.top < logo.bottom, build };
  });
  await run({ id: 'm360-H01b-banner', area: '홈', title: '360×740 첫 화면: 일러스트가 로고 오른쪽 같은 줄이 아니라 로고 아래 배너(224px)로 놓인다', steps: '360×740 터치로 첫 화면', expected: 'SPEC 완료 기준 8의 글자(「픽토그램이 같은 줄에」)와 다르지만 QI3 구현 검수(REV-005-QI3-1, 형진 님 r3 확정 「모바일 224px」)가 승인한 배치 — 기록' }, async () => note(`로고 ${m.logo}(높이 ≥ 40px 충족), 일러스트 ${m.fig}, 같은 줄 ${m.sameRow}. 가로 넘침 0(m360-H01 PASS). 형진 님 확정 시안(illust-r3, 배너 224)과 같은 배치라 SPEC 문구와의 차이만 기록`, { shot: await shot(page, 'm360-H01b-banner') }));
  await ctx.close();
}
// ---- 푸터 빌드 표기 ----
{
  const ctx = await b.newContext({ ...VP.d1280, locale: 'ko-KR' });
  const page = await ctx.newPage();
  await page.goto(PROD + '/');
  await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
  await sleep(800);
  const label = await page.getByTestId('build-version').innerText();
  await run({ id: 'BUILD-label', area: '공통', title: '푸터 빌드 표기가 가리키는 커밋', steps: '로컬 프로덕션 빌드의 푸터 읽기', expected: '「v0.2.0 (7자 커밋)」 — 로컬 빌드는 커밋 안 된 파일이 있으면 「+」' }, async () => note(`「${label.replace(/\s+/g, ' ')}」. QA 시작 때 지시받은 커밋은 10efb72인데 빌드 시점의 HEAD는 6c3d2cc(「decision 로그 후속 163」 — 문서 로그만 담은 커밋)였고 「+」는 그때 작업 트리에 커밋 안 된 파일이 있었다는 뜻이다. src 트리 해시 git rev-parse HEAD:src = c09a94acdf9f6c4fc233f6d2ae481c96657c7a17가 10efb72와 6c3d2cc에서 같고 QA 시작·끝에 같음 — 이 QA는 10efb72의 src를 본 것이다`, { shot: await shot(page, 'BUILD-label', { locator: page.getByTestId('title-foot') }) }));
  await ctx.close();
}
// ---- 건너뜀(SKIP) ----
record({ id: 'SK-slot', area: '건너뜀', title: '슬롯 합성(큰 슬롯 카드 3·8장) — 실제 앱에는 세대 카드가 없다', steps: '-', expected: '합성 시험 e2e(first-screen-layout.spec.ts 「슬롯 합성」)로 대체 실행' }, { verdict: 'SKIP', actual: '실제 앱 조작으로 만들 수 없음(SPEC-004 세대 카드 미구현). e2e 합성 시험 실행 결과는 E2E-slot 행' });
record({ id: 'SK-nvda', area: '건너뜀', title: '스크린리더(NVDA) 실제 낭독', steps: '-', expected: '접근성 트리(ariaSnapshot)·읽기 이름·live region 원문 0으로 대체' }, { verdict: 'SKIP', actual: '이 QA 환경에 NVDA가 없다. 접근성 트리 검사(L02·G04c)·읽기 이름(G02·G10·G05)·live region 수집(G12)로 대체. 형진 님 NVDA 선택 점검은 그대로 남음' });
record({ id: 'SK-device', area: '건너뜀', title: 'Android·iOS 실기기', steps: '-', expected: '360×740 터치 에뮬레이션·WebKit으로 대체' }, { verdict: 'SKIP', actual: '실기기 없음. 터치 에뮬레이션(hasTouch·isMobile)과 WebKit(Playwright)으로 대체 — 실기기 점검은 형진 님' });
record({ id: 'SK-lm7b', area: '건너뜀', title: '판 하나를 1배속으로 사람처럼 끝까지(LM7b)', steps: '-', expected: '형진 님 재실측 몫(마스터 지시)' }, { verdict: 'SKIP', actual: 'QA는 연출 시간 표본(T1x·T8x)만 잰다. 판 전체 시간은 모델 report:time 중앙 25.8 / 28.8 / 29.1분(평균 27.9)' });
await b.close();
console.log('done');
