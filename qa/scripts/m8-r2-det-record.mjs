// QA-003 M8 2회차: 첫 화면 D-98 대상 밖 글의 줄 끝 홀로 관형사 관찰 한 건을 케이스로 남긴다(m8-r2-det-title.mjs·m8-r2-det-popline.mjs 결과 요약).
import fs from 'node:fs';
import path from 'node:path';
import { addCase, OUT } from './m8-lib.mjs';
const rows = JSON.parse(fs.readFileSync(path.join(OUT, 'det-title-others.json'), 'utf8'));
addCase({
  id: 'TL-det-others',
  cat: '(바) D-97·D-98 관찰',
  title: '첫 화면의 D-98 대상(FS5 설명·가상 인구 주석) 밖 글에서 줄 끝에 홀로 선 이·그·저 관찰',
  steps: '첫 화면 title-screen 전체를 공통 뷰포트 11 × 글자 100·200%(라이트)로 훑어 줄 끝의 홀로 선 관형사를 찾음(조사로 붙은 「이」는 제외)',
  expected: 'D-98 대상 여섯 곳은 위반 0(TL-det PASS). 그 밖의 글은 관찰만',
  actual: `관찰 ${rows.length}곳: ${rows.map((r) => `${r.el} — ${r.at.join(', ')}`).join(' / ')}. 가상 인구 한 줄(population-line: 「51,048명이 이 시뮬레이션 속에서 각자의 삶을 살고 있어요.」)이 글자 200%·폭 320·360에서 「51,048명이 이 / 시뮬레이션 / 속에서 …」로 갈려 「이」가 첫 줄 끝에 홀로 남음(DET-popline 스크린샷). D-98의 여섯 곳(FS5 설명·가상 인구 주석 …) 밖이라 FAIL이 아닌 RECORD — 같은 묶음을 이 줄에도 걸지 마스터·designer 판단`,
  verdict: 'RECORD',
  shots: ['qa/screenshots/003/M8-r2-DET-popline-360x740-200.png', 'qa/screenshots/003/M8-r2-DET-popline-320x568-200.png'],
});
