import { expect, test, type Page, type Response } from '@playwright/test';

/**
 * 첫 화면 초기 로드 한도 (SPEC-005 QI4 2단계 · QI6·QI7 뒤 마스터 결정 ②, SPEC-004 MG8·GS11 3차) — 빌드 산출물(`vite preview`)을 **실제 브라우저가 받은 요청**으로 잰다.
 *  · 합계 ≤ 400,000 B — Chromium·WebKit 모두, PC 폭(1280×800)·모바일 폭(360×740) 모두. 글자 계열(HTML·JS·CSS·아이콘)은 브라우저의 CompressionStream('gzip')으로 다시 눌러 크기를 재고
 *    (이 저장소는 @types/node를 들이지 않아 node:zlib을 쓰지 않는다), 그림·글꼴(woff2)은 이미 압축돼 있으므로 받은 그대로 센다. 기본 압축 수준이라 ai-log 묶음 크기 표의 레벨 9 방식 숫자보다 1% 안팎 크다.
 *  · 지연 로드(MG8): 이벤트 풀(JSON 5개)과 출생 연도 표는 「태어나기」 뒤에만 받는다 — 첫 화면에서는 받지 않고, 유휴 중 미리 받기(prefetch)도 없다.
 *    파일 이름이 아니라 **본문**(이벤트 id 표지·출생 연도 표 표지)으로 가린다 — 빌드가 덩어리 이름을 바꿔도 새는 것을 잡는다.
 *  · 같은 주소를 두 번 요청하지 않는다(첫 화면 로드, 그리고 「태어나기」 연타 뒤의 지연 로드 모두).
 *  · 그림(webp·png·jpg)은 첫 화면에서 아이콘 몇 개를 빼면 받지 않는다 — 오른쪽 위 일러스트(home-map-*)는 SPEC-004 GS11에서 없어졌다.
 *  · 글꼴: 첫 화면이 처음 받는 조각은 s0 400·700 둘(미리 받기)과, 화면에 그려지는 글자가 s0b 범위에 있으면 s0b — s1(룰렛)·s2(그 밖 게임 글자)·s3(꼬리)는 받지 않는다.
 * 개발 서버는 모듈을 하나씩 내려 받으므로 이 한도는 여기(프로덕션 번들)에서만 의미가 있다. 한도 숫자는 docs/TODO.md QI4 줄과 ai-log/2026-10-21_SPEC-005_dev-QI4-2.md의 묶음 크기 표가 같은 값이다
 */

const LIMIT_BYTES = 400_000;

const VIEWPORTS = [
  { name: 'PC 1280×800', width: 1280, height: 800 },
  { name: '모바일 360×740', width: 360, height: 740 },
] as const;

/**
 * 이벤트 풀 덩어리를 본문으로 알아보는 표지: 영유아 이벤트 첫 장면의 글(앞 24자). 이벤트 **id**는 부모 결정 분류표 같은 첫 화면 쪽 표에도 있어 표지가 못 된다.
 * 출생 연도 표 덩어리는 따로 본문 표지 없이 파일 이름(birthYearData)으로 가린다 — 이 덩어리는 이 표 하나뿐이라 이름이 곧 내용이다.
 */
async function eventPoolMark(): Promise<string> {
  const nodeFs = 'node:fs';
  const fs = (await import(nodeFs)) as { readFileSync(path: string, encoding: 'utf-8'): string };
  const infant = JSON.parse(fs.readFileSync('src/data/events/infant.json', 'utf-8')) as { events: Array<{ text?: string }> };
  return (infant.events.find((e) => (e.text ?? '').length > 30)?.text ?? '').slice(0, 24);
}

type Got = { file: string; url: string; bytes: number; kind: 'image' | 'font' | 'text'; body: string | null };

/** 같은 출처에서 받는 응답을 모으는 수집기. 요청 수(중복 확인용)도 센다 */
function collect(page: Page, origin: string) {
  const got: Got[] = [];
  const requested: string[] = [];
  const pending: Promise<void>[] = [];
  const onRequest = (url: string): void => {
    if (new URL(url).origin === origin) requested.push(url);
  };
  const onResponse = (res: Response): void => {
    const url = new URL(res.url());
    if (url.origin !== origin) return;
    pending.push(
      res
        .body()
        .then((buf) => {
          const kind = /\.(webp|png|jpe?g|avif)$/i.test(url.pathname) ? 'image' : /\.woff2?$/i.test(url.pathname) ? 'font' : 'text';
          got.push({ file: url.pathname.split('/').pop() ?? url.pathname, url: res.url(), bytes: buf.length, kind, body: kind === 'text' && /\.(js|css|html|json)$/i.test(url.pathname) ? buf.toString('utf-8') : null });
        })
        .catch(() => undefined), // 본문을 읽을 수 없는 응답(리디렉션 등)은 크기가 없다
    );
  };
  const onReq = (r: { url(): string }): void => onRequest(r.url());
  page.on('request', onReq);
  page.on('response', onResponse);
  return {
    got,
    requested,
    /** 모은 것을 마무리하고(수집 중단) 글자 계열은 gzip으로 다시 눌러 센 크기로 바꾼다 */
    async finish(): Promise<void> {
      await Promise.all(pending);
      page.off('response', onResponse); // 아래 다시 읽기(fetch)의 응답이 이 목록에 쌓여 끝없이 돌지 않게 먼저 끊는다
      page.off('request', onReq);
      for (const g of got) {
        if (g.kind !== 'text') continue;
        g.bytes = await page.evaluate(async (url) => {
          const res = await fetch(url);
          return (await new Response(res.body!.pipeThrough(new CompressionStream('gzip'))).arrayBuffer()).byteLength;
        }, g.url);
      }
    },
  };
}

const sum = (got: Got[]): number => got.reduce((n, g) => n + g.bytes, 0);
const describeGot = (got: Got[]): string => got.map((g) => `${g.file} ${g.bytes}`).join(', ');
const dupes = (urls: string[]): string[] => urls.filter((u, i) => urls.indexOf(u) !== i);

for (const vp of VIEWPORTS) {
  test(`초기 로드 ≤ ${LIMIT_BYTES.toLocaleString('en-US')} B(gzip) — ${vp.name}: 이벤트 풀·출생 연도 표는 받지 않고, 같은 주소를 두 번 요청하지 않으며, 미리 받기가 없다 (MG8)`, async ({ page, browserName, baseURL }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const origin = new URL(baseURL ?? 'http://localhost:4199').origin;
    const EVENT_POOL_MARK = await eventPoolMark();
    const c = collect(page, origin);
    await page.goto('/');
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500); // 늦게 시작하는 요청(지연 로드·글꼴·미리 받기)이 있어도 잡는다
    await c.finish();
    const { got } = c;
    const total = sum(got);
    const fonts = got.filter((g) => g.kind === 'font');
    console.log(
      `[MG8 초기 로드 ${browserName} ${vp.name}] 합계 ${total.toLocaleString('en-US')} B (한도 ${LIMIT_BYTES.toLocaleString('en-US')}) · 글꼴 ${describeGot(fonts) || '없음'} · 그림 ${describeGot(got.filter((g) => g.kind === 'image')) || '없음'} · 요청 ${got.length}개: ${describeGot(got)}`,
    );
    expect(got.length, '응답을 하나도 못 모았다면 측정이 비어 있는 것이다').toBeGreaterThan(3);
    expect(EVENT_POOL_MARK.length, '표지를 못 만들면 아래 점검이 공허하게 통과한다').toBe(24);
    // 지연 로드: 본문으로 가린다
    expect(got.filter((g) => g.body?.includes(EVENT_POOL_MARK)).map((g) => g.file), '이벤트 풀이 첫 화면에서 내려왔다').toEqual([]);
    expect(got.filter((g) => /birthYearData|koreaStatsReserve/i.test(g.file)).map((g) => g.file), '지연 로드 덩어리·예비 지표 묶음은 첫 화면에서 받지 않는다').toEqual([]);
    // 같은 주소 두 번 요청 없음
    expect(dupes(c.requested), '같은 주소를 두 번 요청했다').toEqual([]);
    // 그림: 오른쪽 위 일러스트는 없다(GS11) — 이미지 응답은 아이콘 계열뿐
    expect(got.filter((g) => g.kind === 'image' && /home-map/.test(g.file)).map((g) => g.file), 'home-map 그림').toEqual([]);
    // 글꼴: s0 두 조각은 받고, 룰렛·게임 글자 조각(s1·s2)과 꼬리(s3)는 받지 않는다
    expect(fonts.some((g) => /400\.s0-/.test(g.file)) && fonts.some((g) => /700\.s0-/.test(g.file)), `s0 400·700을 받았다: ${describeGot(fonts)}`).toBe(true);
    expect(fonts.filter((g) => /\.(s1|s2|s3)-/.test(g.file)).map((g) => g.file), '첫 화면에서 받으면 안 되는 글꼴 조각').toEqual([]);
    expect(total, `초기 로드 ${total} B ≤ ${LIMIT_BYTES} B`).toBeLessThanOrEqual(LIMIT_BYTES);
  });

  test(`지연 로드 — ${vp.name}: 「태어나기」 연타 뒤에야 이벤트 풀·출생 연도 표를 받고, 각 덩어리는 한 번만 받는다 (MG8, 중복 요청 없음)`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const origin = new URL(baseURL ?? 'http://localhost:4199').origin;
    const EVENT_POOL_MARK = await eventPoolMark();
    await page.goto('/');
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('start-birth')).toBeEnabled(); // 입력 가드가 풀린 뒤
    const c = collect(page, origin);
    // 연타: 같은 순간에 여러 번 눌러도 로드는 하나다
    const begin = page.getByTestId('start-birth');
    await begin.click();
    await begin.click({ force: true, noWaitAfter: true, timeout: 500 }).catch(() => undefined);
    await begin.click({ force: true, noWaitAfter: true, timeout: 500 }).catch(() => undefined);
    await expect(page.getByTestId('roulette-screen')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    await c.finish();
    const { got } = c;
    expect(got.filter((g) => g.body?.includes(EVENT_POOL_MARK)).length, `이벤트 풀 덩어리를 한 번 받았다: ${describeGot(got)}`).toBe(1);
    expect(got.filter((g) => /birthYearData/i.test(g.file)).length, `출생 연도 표 덩어리를 한 번 받았다: ${describeGot(got)}`).toBe(1);
    expect(dupes(c.requested), '같은 주소를 두 번 요청했다').toEqual([]);
  });
}
