import { defineConfig } from '@playwright/test';

/**
 * WebKit 핵심 흐름 점검 (SPEC-005 QI1 — 인생 기록의 스크롤 위치 보정은 WebKit이 `overflow-anchor`를 구현하지 않아 직접 하므로, 그 보정이 WebKit에서도 가만히 있는지 본다).
 * 실행: ./node_modules/.bin/playwright test -c playwright.webkit.config.ts   (WebKit 브라우저가 설치돼 있어야 한다: playwright가 받아 둔 webkit-*)
 * 일반 e2e(playwright.config.ts)는 Chromium만 돌고, 이 설정은 WebKit에서도 같은 단언이 통과해야 하는 파일만 고른다. 개발 서버는 다른 포트(5198)를 쓴다.
 */
const PORT = 5198;

export default defineConfig({
  testDir: 'e2e',
  testMatch: ['log-order.spec.ts'],
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
