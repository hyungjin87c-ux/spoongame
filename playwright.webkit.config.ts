import { defineConfig } from '@playwright/test';

/**
 * WebKit 핵심 흐름 점검 (SPEC-005 QI1 — 인생 기록의 스크롤 위치 보정은 WebKit이 `overflow-anchor`를 구현하지 않아 직접 하므로, 그 보정이 WebKit에서도 가만히 있는지 본다.
 * QI3 — 첫 화면 개편(`first-screen-layout.spec.ts`: 일러스트 배치·겹침·흐림 필터, 조작 줄 소형·겹침 0, 인생 길이 분절 컨트롤, 슬롯 합성 3장·8장의 가로 넘침·포커스 가림 0)도 WebKit에서 같은 단언으로 돈다).
 * QI5 — 부모님이 정한·흘러간 해의 비모달 카드(`parent-card.spec.ts`: 포커스 이동 없음·일시정지·새로고침·8배속·다음 결정으로)도 WebKit에서 같은 단언으로 돈다.
 * 실행: ./node_modules/.bin/playwright test -c playwright.webkit.config.ts   (WebKit 브라우저가 설치돼 있어야 한다: playwright가 받아 둔 webkit-*)
 * 일반 e2e(playwright.config.ts)는 Chromium만 돌고, 이 설정은 WebKit에서도 같은 단언이 통과해야 하는 파일만 고른다. 개발 서버는 다른 포트(5198)를 쓴다.
 */
const PORT = 5198;

export default defineConfig({
  testDir: 'e2e',
  testMatch: ['log-order.spec.ts', 'first-screen-layout.spec.ts', 'parent-card.spec.ts'],
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'webkit',
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: 'webkit-mobile-360', use: { viewport: { width: 360, height: 740 } } },
    { name: 'webkit-desktop', use: { viewport: { width: 1280, height: 800 } } },
  ],
});
