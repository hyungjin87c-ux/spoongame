import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolvePagesBase } from './scripts/pagesBase';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages(/<저장소>/ 하위)용 빌드만 환경변수 PAGES_BASE로 base를 바꾼다. 없으면 '/' — dev·e2e·e2e:prod·preview는 그대로다. (scripts/pagesBase.ts)
  base: resolvePagesBase(process.env.PAGES_BASE),
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
