// QA-003 M9 F군: e2e-prod/smoke.spec.ts(배포 번들 스모크)를 이번 회차 빌드(루트 base로 한 번 더 빌드 — 세션 임시 폴더, vite preview 4907)에 돌리는 설정.
// 저장소의 playwright.prod.config.ts는 dist를 빌드해 4199에 띄우므로 쓰지 않는다(저장소에 dist를 새로 남기지 않기). 서버는 직접 띄우고 이 설정은 띄우지 않는다.
// 사용: M9_SCR=<세션 임시 폴더> ./node_modules/.bin/playwright test -c qa/scripts/m9-playwright.prod.config.mjs
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../../e2e-prod',
  outputDir: `${process.env.M9_SCR || '.'}/pw-out`,
  reporter: [['list'], ['json', { outputFile: `${process.env.M9_SCR || '.'}/pw-report.json` }]],
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:4907',
    browserName: 'chromium',
    viewport: { width: 360, height: 740 },
  },
});
