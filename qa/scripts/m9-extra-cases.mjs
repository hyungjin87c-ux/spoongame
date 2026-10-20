// QA-003 M9: 스크립트 밖에서 직접 한 일을 케이스로 남긴다 — e2e-prod 스모크 결과(F), WebKit 설치(P6).
// 사용: node qa/scripts/m9-extra-cases.mjs
import fs from 'node:fs';
import path from 'node:path';
import { addCase } from './m7c-lib.mjs';

const scr = process.env.M9_SCR;
const rep = JSON.parse(fs.readFileSync(path.join(scr, 'pw-report.json'), 'utf8'));
const st = rep.stats;
addCase({
  id: 'F-e2e-prod-smoke',
  cat: 'F 배포 번들',
  title: '배포 번들 스모크(e2e-prod/smoke.spec.ts 18건): 첫 화면→인생 화면, 기록 시트, BGM, 다크·의견 보내기·나가기, 엔딩까지 완주, 룰렛 연출 시간, 개발 탐침 무효, 번들 개발 문자열 0, 다크 첫 그림, 푸터 빌드 표기, 캐러셀·CSS 최소화 뒤 보존',
  steps: '이번 회차 소스(src 해시 ee8e752c…)를 루트 base로 한 번 더 빌드해 세션 임시 폴더에서 vite preview(4907)로 띄우고 저장소 시험 e2e-prod/smoke.spec.ts를 별도 설정(qa/scripts/m9-playwright.prod.config.mjs)으로 그대로 실행',
  expected: '실패 0 (DP8 공개 주소 확인은 DEPLOY_URL·DEPLOY_COMMIT이 있을 때만 돌고 없으면 건너뜀)',
  actual: `통과 ${st.expected} · 실패 ${st.unexpected} · 불안정 ${st.flaky} · 건너뜀 ${st.skipped}(DP8 — 공개 주소 확인은 외부 요청 금지라 배포 뒤 마스터가 DEPLOY_URL로 실행) · ${Math.round(st.duration / 1000)}초`,
  verdict: st.unexpected === 0 && st.flaky === 0 ? 'PASS' : 'FAIL',
  shots: [],
});
addCase({
  id: 'P6-wk-install',
  cat: 'P6 WebKit',
  title: 'WebKit 설치(마스터·형진 님 허용 12-3 Q2): 로컬 ./node_modules/.bin/playwright install webkit — 저장소 밖 브라우저 캐시에 설치',
  steps: '설치 전 캐시 크기 측정(720MB) → install(내려받기 크기는 설치 명령이 표시: 60.2 MiB) → 설치 뒤 캐시 크기 측정',
  expected: '설치되고 핵심 흐름을 돌릴 수 있음, 저장소 변화 0',
  actual: 'WebKit 27.2(playwright webkit v2370) 설치됨 — 표시 크기 60.2 MiB(압축 내려받기, 출처 cdn.playwright.dev 공식 배포), 압축을 풀면 webkit-2370 폴더 171MB, 브라우저 캐시 전체 720MB → 890MB(+170MB). 설치 위치 사용자 로컬 캐시(저장소 밖), 저장소 변화 0',
  verdict: 'PASS',
  shots: [],
});
