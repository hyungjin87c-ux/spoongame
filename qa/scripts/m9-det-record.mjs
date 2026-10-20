// QA-003 M9: M8 2회차 m8-r2-det-record.mjs의 M9판. 첫 화면 D-98 대상 밖 글의 줄 끝 홀로 관형사 관찰을 케이스로 남긴다(m8-r2-det-title.mjs·m8-r2-det-popline.mjs 결과 요약).
// M8 2회차는 관찰을 항상 RECORD로 적었지만 여기서는 실제로 보인 곳이 있을 때만 RECORD(이월 — 2차 D-99), 0곳이면 PASS로 적는다.
import fs from 'node:fs';
import path from 'node:path';
import { addCase, OUT } from './m8-lib.mjs';
const rows = JSON.parse(fs.readFileSync(path.join(OUT, 'det-title-others.json'), 'utf8'));
addCase({
  id: 'TL-det-others',
  cat: '(바) D-97·D-98 관찰 — 이월 확인',
  title: '첫 화면의 D-98 대상(FS5 설명·가상 인구 주석) 밖 글에서 줄 끝에 홀로 선 이·그·저 관찰',
  steps: '첫 화면 title-screen 전체를 공통 뷰포트 11 × 글자 100·200%(라이트)로 훑어 줄 끝의 홀로 선 관형사를 찾음(조사로 붙은 「이」는 제외). 가상 인구 한 줄은 폭 320·360 글자 200%/360 100%를 따로 찍어 줄 나눔을 봄',
  expected: 'D-98 대상 여섯 곳은 위반 0(TL-det PASS). 그 밖의 글은 관찰만(1차 수용 — 2차 D-99)',
  actual: rows.length === 0 ? '관찰 0곳' : `관찰 ${rows.length}곳: ${rows.map((r) => `${r.el} — ${r.at.join(', ')}`).join(' / ')}. 가상 인구 한 줄(population-line)이 글자 200%·폭 320·360에서 「이」가 줄 끝에 홀로 남는 줄 나눔(DET-popline 스크린샷). 마스터 10-20 1차 수용·2차 D-99 이월이라 FAIL로 세지 않음`,
  verdict: rows.length === 0 ? 'PASS' : 'RECORD',
  shots: rows.length === 0 ? [] : ['qa/screenshots/003/M9-DET-popline-360x740-200.png', 'qa/screenshots/003/M9-DET-popline-320x568-200.png'],
});
