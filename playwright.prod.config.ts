import { defineConfig } from '@playwright/test';

/**
 * 프로덕션 번들 스모크 (R-043): 개발 서버가 아니라 `vite build`의 산출물(dist)을 `vite preview`로 띄워 확인한다.
 * 실행: npm run e2e:prod  (빌드 → 이 설정으로 e2e-prod/ 실행). 일반 e2e(playwright.config.ts)는 개발 서버 대상이라 이 폴더를 읽지 않는다.
 */
const PORT = 4199;

export default defineConfig({
  testDir: 'e2e-prod',
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    viewport: { width: 360, height: 740 },
  },
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
