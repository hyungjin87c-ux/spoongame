const path = require('node:path');
const { defineConfig } = require('@playwright/test');
const PORT = 5199; // 미리 띄워 둔 개발 서버를 재사용한다(npm run dev -- --port 5199 --strictPort, 끝나면 PID로 끈다). WebKit: playwright test -c qa/scripts/009/pw-webkit-qa.config.cjs
module.exports = defineConfig({
  testDir: path.resolve(__dirname, '../../../e2e'),
  testMatch: ['family-scene.spec.ts', 'log-order.spec.ts', 'gentle.spec.ts', 'life.spec.ts'],
  fullyParallel: true,
  reporter: 'list',
  outputDir: path.resolve(__dirname, '../../../test-results'),
  use: { baseURL: `http://localhost:${PORT}`, browserName: 'webkit' },
  projects: [
    { name: 'webkit-mobile-360', use: { viewport: { width: 360, height: 740 } } },
    { name: 'webkit-desktop', use: { viewport: { width: 1280, height: 800 } } },
  ],
});
