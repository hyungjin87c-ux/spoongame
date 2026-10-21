import { expect, test, type Page, type Response } from '@playwright/test';

/**
 * 첫 화면 초기 로드 한도 (SPEC-005 QI4 2단계 · QI6·QI7 뒤 마스터 결정 ②) — 빌드 산출물(`vite preview`)을 **실제 브라우저가 받은 요청**으로 잰다.
 *  · 합계 ≤ 400,000 B — Chromium·WebKit 모두, PC 폭(1280×800)·모바일 폭(360×740) 모두. 글자 계열(HTML·JS·CSS·아이콘)은 브라우저의 CompressionStream('gzip')으로 다시 눌러 크기를 재고
 *    (이 저장소는 @types/node를 들이지 않아 node:zlib을 쓰지 않는다), 그림은 이미 압축돼 있으므로 받은 그대로 센다. 기본 압축 수준이라 ai-log 묶음 크기 표의 레벨 9 방식 숫자보다 1% 안팎 크게 나온다 — 한도에 대해 보수적인 쪽이다.
 *  · 첫 화면 큰 그림(home-map-*.webp)은 **한 장만** 받는다 — WebKit이 PC용·모바일용 두 장을 받던 일(R-450 `loading="lazy"`를 `src`보다 앞에 둔다)이 되돌아오면 실패한다
 *  · 예비 지표 묶음(koreaStatsReserve)은 첫 화면에서 받지 않는다 — 지금은 쓰는 곳이 없어 빌드가 별도 파일을 만들지도 않는다
 * 개발 서버는 모듈을 하나씩 내려 받으므로 이 한도는 여기(프로덕션 번들)에서만 의미가 있다. 한도 숫자는 docs/TODO.md QI4 줄과 ai-log/2026-10-21_SPEC-005_dev-QI4-2.md의 묶음 크기 표가 같은 값이다.
 */

const LIMIT_BYTES = 400_000;

const VIEWPORTS = [
  { name: 'PC 1280×800', width: 1280, height: 800 },
  { name: '모바일 360×740', width: 360, height: 740 },
] as const;

type Got = { file: string; url: string; bytes: number; image: boolean };

/** 첫 화면을 열고, 같은 출처에서 받은 응답을 모두 모은다(그림은 받은 그대로, 나머지는 gzip으로 다시 눌러 센다) */
async function loadTitle(page: Page, origin: string): Promise<Got[]> {
  const got: Got[] = [];
  const pending: Promise<void>[] = [];
  const onResponse = (res: Response): void => {
    const url = new URL(res.url());
    if (url.origin !== origin) return;
    pending.push(
      res
        .body()
        .then((buf) => {
          const image = /\.(webp|png|jpe?g|avif)$/i.test(url.pathname);
          got.push({ file: url.pathname.split('/').pop() ?? url.pathname, url: res.url(), bytes: buf.length, image });
        })
        .catch(() => undefined), // 본문을 읽을 수 없는 응답(리디렉션 등)은 크기가 없다
    );
  };
  page.on('response', onResponse);
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500); // 늦게 시작하는 요청(지연 그림·글꼴)이 있어도 잡는다
  await Promise.all(pending);
  page.off('response', onResponse); // 아래 다시 읽기(fetch)의 응답이 이 목록에 쌓여 끝없이 돌지 않게 먼저 끊는다
  // 글자 계열은 gzip으로 다시 눌러 센다(캐시에서 같은 본문을 다시 읽는다). 그림은 받은 크기 그대로.
  for (const g of got) {
    if (g.image) continue;
    g.bytes = await page.evaluate(async (url) => {
      const res = await fetch(url);
      return (await new Response(res.body!.pipeThrough(new CompressionStream('gzip'))).arrayBuffer()).byteLength;
    }, g.url);
  }
  return got;
}

for (const vp of VIEWPORTS) {
  test(`초기 로드 ≤ ${LIMIT_BYTES.toLocaleString('en-US')} B(gzip) — ${vp.name}, 첫 화면 그림은 한 장, 예비 지표 묶음은 받지 않는다 (QI4 2단계, 마스터 결정 ②)`, async ({ page, browserName, baseURL }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const got = await loadTitle(page, new URL(baseURL ?? 'http://localhost:4199').origin);
    const total = got.reduce((sum, g) => sum + g.bytes, 0);
    const images = got.filter((g) => g.image && /^home-map-/.test(g.file));
    console.log(
      `[QI4 초기 로드 ${browserName} ${vp.name}] 합계 ${total.toLocaleString('en-US')} B (한도 ${LIMIT_BYTES.toLocaleString('en-US')}) · 첫 화면 그림 ${images.map((g) => `${g.file} ${g.bytes}`).join(', ') || '없음'} · 요청 ${got.length}개`,
    );
    expect(got.length, '응답을 하나도 못 모았다면 측정이 비어 있는 것이다').toBeGreaterThan(3);
    expect(images.length, `첫 화면 큰 그림은 한 장: ${images.map((g) => g.file).join(', ')}`).toBe(1);
    expect(
      got.filter((g) => /koreaStatsReserve/i.test(g.file)),
      '예비 지표 묶음은 첫 화면에서 받지 않는다',
    ).toEqual([]);
    expect(total, `초기 로드 ${total} B ≤ ${LIMIT_BYTES} B`).toBeLessThanOrEqual(LIMIT_BYTES);
  });
}
