// 플레이 보고서(JSON)와 수작업 판정을 케이스 기록으로 등록한다.
import fs from 'node:fs';
import path from 'node:path';
import { RES_DIR, resultFile } from './lib.mjs';

const rd = (id) => JSON.parse(fs.readFileSync(path.join(RES_DIR, `${id}-report.json`), 'utf8'));
const S = (id, names) => names.map((n) => `qa/screenshots/001/${id}-${n}.png`);
const put = (group, rec) => fs.appendFileSync(resultFile(group), JSON.stringify({ console: [], at: new Date().toISOString(), ...rec }) + '\n');
const sec = (ms) => (ms / 1000).toFixed(1);

const n1 = rd('M3-N01'), n2 = rd('M3-N02'), n3 = rd('M3-N03'), b1 = rd('M3-B01'), p1 = rd('M3-P01'), p2 = rd('M3-P02'), p3 = rd('M3-P03');

put('normal', {
  id: 'M3-N01', cat: '정상 플레이', title: '정상 1판 — 지금 세상 · 모바일 360x740 · 1배속 수동(선택지 12개를 읽고 직접 선택)', steps: '타이틀 → 시대 선택(기본 지금 세상) → 태어나기 → 살아가기 → 1배속으로 사망까지. 선택지마다 스크린샷을 보고 직접 고름. 사망 후 새로고침',
  expected: '끊김 없이 사망·엔딩 자리표시까지. 문구 담담, 등급명·감탄사·이모지 없음, 글자 잘림·겹침·가로 스크롤 없음, 새로고침해도 엔딩 유지',
  actual: `${n1.name} ${n1.endingText.replace(/\n+/g, ' ').trim()} 선택지 ${n1.choices.length}개(내가 고름), 1배속 순수 연출 ${sec(n1.activeMs)}초(내가 읽고 고른 대기 ${sec(n1.pausedMs)}초 제외). 가로 넘침 ${n1.overflow.length}회, 예상 밖 화면 ${n1.notes.length}회, 콘솔 오류·경고 ${n1.console.length}건. 사망 후 새로고침에도 엔딩 유지. 설정 ${JSON.stringify(n1.settings.data)}`,
  verdict: 'PASS', shots: n1.shots,
});
put('normal', {
  id: 'M3-N02', cat: '정상 플레이', title: '정상 2판 — 지난 세상 · 데스크톱 1280x800 · 8배속 + "다음 결정으로" 위주(선택은 번갈아)', steps: '타이틀 → 시대 선택에서 지난 세상 선택 → 출생 → 8배 선택 → "다음 결정으로"와 선택지 반복 → 사망 → 새로고침',
  expected: '선택지에서 정확히 멈추고(건너뛰지 않음) 끝까지 진행, 데스크톱에서도 레이아웃 정상',
  actual: `${n2.name} ${n2.endingText.replace(/\n+/g, ' ').trim()} 선택지 ${n2.choices.length}개, 다음 결정으로 ${n2.skipClicks}번 클릭, 소요 ${sec(n2.activeMs)}초. 가로 넘침 ${n2.overflow.length}, 콘솔 ${n2.console.length}건. 설정 ${JSON.stringify(n2.settings.data)}(다음 판에 유지)`,
  verdict: 'PASS', shots: n2.shots,
});
put('normal', {
  id: 'M3-N03', cat: '정상 플레이', title: '정상 3판 — 다가올 세상 · 모바일 360x740 · 8배속 자동 모드', steps: '출생 → 살아가기 → 8배 + 자동 모드 켜기 → 사망까지 관찰(선택은 자동) → 새로고침',
  expected: '자동 모드가 선택지를 잠깐 보여 준 뒤 스스로 고르고 끝까지 진행',
  actual: `${n3.name} ${n3.endingText.replace(/\n+/g, ' ').trim()} 선택지 ${n3.choices.length}개 전부 자동 선택(선택지가 보이고 사라지기까지 ${Math.min(...n3.choices.map((c) => c.autoWaitMs))}~${Math.max(...n3.choices.map((c) => c.autoWaitMs))}ms), 소요 ${sec(n3.activeMs)}초. 가로 넘침 ${n3.overflow.length}, 콘솔 ${n3.console.length}건`,
  verdict: 'PASS', shots: n3.shots,
});
put('prodplay', {
  id: 'M3-P01', cat: '#10 프로덕션 정상 3판', title: '프로덕션 빌드(vite preview 4290)에서 정상 1판 — 모바일 · 1배속 · 선택지 즉시 선택', steps: 'npm run build 산출물을 vite preview로 띄워 1배속으로 사망까지', expected: '개발 서버와 같은 동작, 오류 없음',
  actual: `${p1.name} ${p1.endingText.replace(/\n+/g, ' ').trim()} 선택지 ${p1.choices.length}개, 소요 ${sec(p1.activeMs)}초, 콘솔 ${p1.console.length}건, 가로 넘침 ${p1.overflow.length}`, verdict: 'PASS', shots: p1.shots,
});
put('prodplay', {
  id: 'M3-P02', cat: '#10 프로덕션 정상 3판', title: '프로덕션 빌드에서 정상 1판 — 데스크톱 1280x800 · 8배속 + 다음 결정으로', steps: '프로덕션 preview, 지난 세상, 8배 + 다음 결정으로', expected: '개발 서버와 같은 동작',
  actual: `${p2.name} ${p2.endingText.replace(/\n+/g, ' ').trim()} 선택지 ${p2.choices.length}개, 소요 ${sec(p2.activeMs)}초, 콘솔 ${p2.console.length}건`, verdict: 'PASS', shots: p2.shots,
});
put('prodplay', {
  id: 'M3-P03', cat: '#10 프로덕션 정상 3판', title: '프로덕션 빌드에서 정상 1판 — 모바일 · 8배속 자동 모드(다가올 세상)', steps: '프로덕션 preview, 다가올 세상, 8배 + 자동 모드', expected: '개발 서버와 같은 동작',
  actual: `${p3.name} ${p3.endingText.replace(/\n+/g, ' ').trim()} 선택지 ${p3.choices.length}개 자동 선택, 소요 ${sec(p3.activeMs)}초, 콘솔 ${p3.console.length}건`, verdict: 'PASS', shots: p3.shots,
});
put('timing', {
  id: 'M3-B01', cat: 'B 플레이 시간(기록만)', title: '실측: 1배속 · 선택지 즉시 선택(순수 연출 시간) — 개발 서버 / 프로덕션 / 직접 읽고 선택한 판(N01)', steps: '시간 배율 쿼리를 쓰지 않고 실시간으로 사망까지. 선택지는 가드(0.4초)가 풀리는 즉시 첫 선택',
  expected: '(판정 없음) 기록만',
  actual: `개발 B01 ${sec(b1.activeMs)}초(${(b1.activeMs / 60000).toFixed(1)}분, 선택 ${b1.choices.length}개, ${b1.history ? '' : ''}83세 사망) / 프로덕션 P01 ${sec(p1.activeMs)}초(${(p1.activeMs / 60000).toFixed(1)}분, 선택 ${p1.choices.length}개, 89세) / 개발 N01 ${sec(n1.activeMs)}초(${(n1.activeMs / 60000).toFixed(1)}분, 선택 ${n1.choices.length}개, 85세). 해 단위 대기: 조용한 해 평균 약 4.1초, 선택 결과 뒤 약 7.8초, 서술 이벤트 해 약 10.0~10.4초(타이밍표 4000/8000/10000ms와 일치)`,
  verdict: '기록만', shots: S('M3-B01', ['ending']),
});
put('timing', {
  id: 'M3-B02', cat: 'B 플레이 시간(기록만)', title: '실측: 8배속 + "다음 결정으로"(선택은 즉시) 와 8배속 자동 모드', steps: '실시간. 8배속 + 다음 결정으로 반복(선택은 즉시), 별도로 8배속 + 자동 모드',
  expected: '(판정 없음) 기록만',
  actual: `8배+다음 결정으로: 개발 N02 ${sec(n2.activeMs)}초(선택 ${n2.choices.length}개), 프로덕션 P02 ${sec(p2.activeMs)}초(선택 ${p2.choices.length}개) — 사람이 읽는 시간을 빼면 10초 안팎. 8배 자동 모드: 개발 N03 ${sec(n3.activeMs)}초(선택 ${n3.choices.length}개), 프로덕션 P03 ${sec(p3.activeMs)}초(선택 ${p3.choices.length}개). 자동 모드 선택지 표시 시간 약 0.2~0.37초(3000ms/8)`,
  verdict: '기록만', shots: S('M3-N02', ['ending']),
});
put('timing', {
  id: 'M3-B03', cat: 'B 플레이 시간(기록만)', title: '한 판의 선택지 이벤트 수·사망 나이 분포 (45판, 세 시대 × 15, 시간 배율 1000 사용 — 시간 실측이 아닌 이벤트 수 통계)', steps: '시간 배율 1000·8배·다음 결정으로·첫 선택지 선택으로 45판 진행하며 선택지 수·사망 나이·선택지당 글자 수 수집(qa/results/life-stats.json)',
  expected: '(판정 없음) 기록만',
  actual: '선택지 수: 지난 평균 11.7(8~14) / 지금 12.1(8~14) / 다가올 12.7(9~15), 전체 평균 12.1(8~15). 사망 나이 평균 지난 81.0·지금 82.5·다가올 88.1(전체 83.9, 최소 39~최대 100). 선택지 1개당 본문+선택지 글자 수 평균 75.6자(58~108). 판당 선택지 글자 합 평균 918자. 선택 결과 문구 평균 42.3자(28~62). 직접 플레이한 판: B01 13개, N01 12개, P01 13개, N02 6개, N03 10개, P02 12개, P03 12개',
  verdict: '기록만', shots: [],
});
put('timing', {
  id: 'M3-B04', cat: 'B 플레이 시간(기록만)', title: '사람이 했을 때의 예상 시간 추정 (읽는 시간 가정치 명시)', steps: '실측한 연출 시간 + 선택지 수 × (읽는 시간 + 고르는 시간). 묵독 속도 가정 500/600/700자/분, 고르는 시간 가정 5~15초',
  expected: '(판정 없음) 기록만',
  actual: '선택지 1개 읽는 시간(평균 75.6자): 500자/분 9.1초 / 600자/분 7.6초 / 700자/분 6.5초(최소~최대 5.0~13.0초). 고르는 시간 5~15초를 더하면 1개당 약 12~24초. 1배속 수동: 연출 약 7.0~7.5분 + 12.1개 × 12~24초(2.4~4.8분) = 약 9.5~12.5분 (개발 가정 30초/개로는 12.1×30초=6.1분 → 약 13분). 8배속+다음 결정으로: 연출 10초 + 2.4~4.8분 = 약 2.5~5분 (30초/개 가정 시 약 6분). 8배 자동 모드: 약 1분. 의견: 30초/개는 짧은 문구(평균 76자)에는 후하다(1.3~2.5배). 그래도 첫 플레이에서 망설이는 시간을 감안하면 타당한 상한 가정. 다만 SPEC 목표(1배 약 30분 · 8배+다음 결정으로 10분 내외)에는 못 미친다: 1배속 수동은 10~30분 범위의 하한 근처이고 "약 30분"의 40% 안팎, 8배+다음 결정으로는 10분의 절반 이하. 선택지 수는 주로 해마다 선택지 확률(EVENT_FREQUENCY)과 최소 간격이 정하므로 이벤트가 40개로 늘어도 판당 선택지 수가 12개에서 크게 늘지는 않을 가능성이 높다(표본 20개로 최대 15개) — M4 이후 재측정 필요',
  verdict: '기록만', shots: [],
});

// 판정 조정(마지막 기록이 이긴다)
const A = (group, rec) => put(group, rec);
