import fs from 'node:fs';
import path from 'node:path';
import { RES_DIR, resultFile } from './lib.mjs';
const last = new Map();
const where = new Map();
for (const f of fs.readdirSync(RES_DIR).filter((x) => x.endsWith('.jsonl'))) {
  for (const line of fs.readFileSync(path.join(RES_DIR, f), 'utf8').trim().split('\n')) {
    const r = JSON.parse(line);
    if (!last.has(r.id) || last.get(r.id).at <= r.at) { last.set(r.id, r); where.set(r.id, f.replace('.jsonl', '')); }
  }
}
const re = (id, patch) => {
  const r = { ...last.get(id), ...patch, at: new Date().toISOString() };
  fs.appendFileSync(resultFile(where.get(id)), JSON.stringify(r) + '\n');
  console.log('overridden', id, r.verdict);
};
re('M3-A66', { verdict: '판단 필요', actual: last.get('M3-A66').actual + ' || 판단 필요: 마스터 예상 동작은 "나중 탭이 밀려도 이어하기 한 번에 탈출"인데, 12회 모두 두 탭이 동시에 밀린 화면이 됨(각자 이어하기 1번씩 = 총 2번으로 탈출, 오류·멈춤 없음). 둘 다 저장소가 비어 있을 때 같은 순간에 읽어 서로의 첫 저장을 "다른 탭의 변경"으로 받아들이기 때문. 이어하기 후에는 두 탭이 같은 상태로 안정. 빈 저장소에서 두 탭을 정확히 동시에 여는 경우는 드물어 영향은 작음' });
re('M3-A92', { verdict: '기록만', actual: last.get('M3-A92').actual + ' || (예상 동작 기록: 자동 모드가 켜진 채 새 판을 시작하면 곧바로 자동 진행됨, 설정 키는 유지됨, 죽은 인생은 되살아나지 않음)' });
re('M3-A67', { actual: last.get('M3-A67').actual + ' || (번갈아 밀림은 예상 동작으로 기록만. 판정 기준인 이어하기 실패·오류 화면·저장 되감김은 모두 0)' });
const put = (group, rec) => fs.appendFileSync(resultFile(group), JSON.stringify({ console: [], at: new Date().toISOString(), ...rec }) + '\n');
put('a-headed', { id: 'M3-A106', cat: '#9 뒤로/앞으로(bfcache)', title: '뒤로 간 뒤 다시 들어오기(bfcache 복원) — 페이지가 bfcache에서 되살아날 때 진행·저장', steps: 'Playwright 크로미움은 --disable-back-forward-cache 로 실행되어 bfcache 복원 자체가 일어나지 않음. 대신 A44·A45(goBack/goForward, 일반 재로드 경로)로 확인', expected: 'bfcache 복원 후에도 상태 유지', actual: '재현 불가 — 이 환경에서는 bfcache가 꺼져 있음. 앱에는 pageshow 처리가 없으므로(코드를 읽어 확인) 실제 브라우저에서 bfcache 복원 후 타이머·저장 상태는 확인하지 못함', verdict: '미실행', shots: [] });
put('a-headed', { id: 'M3-A107', cat: '환경 한계', title: '실제 모바일 기기 터치·iOS Safari·Firefox/WebKit·스크린 리더', steps: '설치된 브라우저는 Chromium뿐, 실제 기기 없음 (터치는 Playwright touchscreen.tap·hasTouch 에뮬레이션으로만 확인)', expected: '-', actual: '확인하지 못함(미실행): 실제 터치의 300ms 지연·더블탭 확대·iOS 가상 키보드/주소창 높이 변화(100dvh)·Safari 포커스(버튼 클릭 시 포커스 이동 규칙)·Firefox 포커스 동작·스크린 리더 낭독(R-056 aria-describedby 포함)', verdict: '미실행', shots: [] });
