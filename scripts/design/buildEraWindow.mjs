/**
 * SPEC-009 「시대의 창」 첫 승인 묶음 — 1980년대 10장 시안 생성기 (designer 2026-10-28).
 *
 * 정본: SPEC-009 FT2·FT3(지키는 선)·FT5, `docs/design/family-scene.md` 5-3(칸 = 그림만, 좌표계 40×32), `docs/design/era-window.md`(목록 설계 — 이 묶음의 자리).
 * 그림체: 종이 오림(s1) — 선 없음, 평면 조각, 밀린 그림자 없음(flat, 칸이 작아서), 색은 `--c-scene-*` 토큰만(기본값 = 라이트). 글자·숫자·로고·휘장·실존 인물·정당 상징·참상 0.
 * 모두 **새로 구성**한 그림이다(dc16 마스터 결정 1 — (c) 기본). 사진을 열거나 내려받지 않았다(이번 작업은 저장소 안 자료만).
 * FT3: 1980년대 묶음의 재난·정치는 1987 투표함 1장(정치 · 일반 상징)이고, 1980년 5·18과 1979~80년 대통령 사망은 그릴 일반 상징이 없어 **그림을 두지 않는다**(인생 기록 배경 줄만).
 *
 * 실행: node scripts/design/buildEraWindow.mjs
 * 산출: docs/design/mockups/family/era-window-1980s.html · pieces/era/<id>.svg(10) · era-window-budget.json
 *   (buildFamilyMockups.mjs의 산출물은 건드리지 않는다 — 집 그림은 dashboard-family.html에서 **읽어** 2:1 예시에 끼운다)
 * 의존성 없음(Node 내장만). `src/`는 읽지 않는다.
 */
import { gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + 'docs/design/mockups/family/';
mkdirSync(OUT + 'pieces/era', { recursive: true });
const write = (f, s) => writeFileSync(OUT + f, s.replace(/\r\n/g, '\n'), 'utf8');

// ---------------------------------------------------------------- 토큰(마스터 승인 24개, 정본 family.css) — 라이트 기본값 = SVG fallback
const LIGHT = {
  sky: '#dfe6ed', far: '#b9c4d0', far2: '#cfd8e2', ground: '#e4dccb', ground2: '#cfc5ae',
  wall: '#f5f0e5', wall2: '#cdc3ac', roof: '#5b6879', roof2: '#404b58', wood: '#8a6b4c', clay: '#926f52',
  ink: '#2b2a27', shade: 'rgba(38,50,74,0.2)', glass: '#fbf3d4', green: '#6e8a5b',
  cloth1: '#26324a', cloth2: '#8a6a14', cloth3: '#f7f2e8', cloth4: '#6c7f9e',
  skin: '#f1c9a5', hair: '#2b2420', hairw: '#d6d2ca', pet: '#a98c66', pet2: '#4a453d', face: '#4a362c',
};
const T = (n) => { if (!(n in LIGHT)) throw new Error(`토큰 없음: ${n}`); return `var(--c-scene-${n},${LIGHT[n]})`; };
const r1 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- 평면 조각 도우미(종이 오림 · flat)
const f = {
  rect: (x, y, w, h, tok, o = {}) => `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}"${o.rx ? ` rx="${o.rx}"` : ''} fill="${T(tok)}"/>`,
  path: (d, tok) => `<path d="${d}" fill="${T(tok)}"/>`,
  circle: (cx, cy, r, tok) => `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="${T(tok)}"/>`,
  ellipse: (cx, cy, rx, ry, tok) => `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${T(tok)}"/>`,
  /** 가는 띠(안테나·연줄·크레인 줄) — 이 좌표계(40×32)에서는 0.4~0.8 */
  line: (d, w, tok, extra = '') => `<path d="${d}" fill="none" stroke="${T(tok)}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra ? ' ' + extra : ''}/>`,
  g: (attrs, inner) => `<g ${attrs}>${inner}</g>`,
};
/** 40×20 내용을 5:4 틀 가운데에(위·아래 6단위는 draw가 바탕으로 채운다 — family-scene.md 5-3) */
const mid = (inner) => `<g transform="translate(0 6)">${inner}</g>`;

// ---------------------------------------------------------------- 1980년대 10장
/**
 * 칸: id · year · hCode(SPEC-004 부록 A, 없으면 null) · name(장면 이름 — 시트 캡션) · kind(생활/문화/경제/스포츠/재난/정치) · heavy(재난·정치 → 가리기 대상, 마스터 지시 2026-10-28)
 *     · line(인생 기록 「시대의 창」 줄 문장 — 접근 이름, ≤ 22자) · reuse(재사용 조각·다른 해와 공유) · alt(이 해의 다른 후보) · approved(형진 님 사건별 승인 전 false — RG11 방식)
 */
const ERA80 = [
  { id: 'era-1980-color-tv', year: 1980, hCode: 'H-C01', name: '컬러 텔레비전 방송 시작', kind: '문화', heavy: false, line: '컬러 텔레비전 방송이 시작되었습니다.',
    reuse: 'TV 몸체는 FM2b 매체 조각 media-tv-color의 비례(기록 9f9d2da) — 1961 TV 개국·1978 생활 틀 「텔레비전 앞 저녁」과 몸체 공유, 화면만 교체', alt: 'H-S04 과외 금지(교실 책상)', approved: false,
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 24, 40, 8, 'wall2'), f.rect(0, 24, 40, 1, 'wood'),
      mid(
        f.line('M 20,4 L 15.5,-0.5 M 20,4 L 24.5,-0.5', 0.55, 'roof2') // 실내 안테나(V)
        + f.rect(14, 16, 12, 2.2, 'roof2') // 낮은 받침
        + f.rect(10, 4, 20, 12, 'roof2', { rx: 0.8 }) // 몸체
        + f.rect(11.4, 5.4, 12.8, 9.2, 'ink') // 화면 테
        + ['cloth3', 'cloth2', 'green', 'cloth4', 'cloth1', 'clay'].map((tok, i) => f.rect(12.1 + i * 1.9, 6.1, 1.9, 7.8, tok)).join('') // 컬러 시험 띠(방송국 표지·글자 없음)
        + f.rect(25.2, 5.4, 3.6, 9.2, 'wall2') // 스피커 판
        + f.circle(27, 10.6, 0.75, 'ink') + f.circle(27, 12.9, 0.75, 'ink'), // 손잡이 둘
      ),
    ].join('') },
  { id: 'era-1981-middle-east-site', year: 1981, hCode: 'H-E14', name: '중동 건설 현장', kind: '경제', heavy: false, line: '중동 건설 현장 취업이 많았습니다.',
    reuse: '타워 크레인은 1990 신도시(H-E05)·2005 부동산(H-E09)과 공유. 건물 골조는 새 조각', alt: 'H-S16 대학 졸업정원제(강의실)', approved: false,
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 20, 40, 12, 'ground2'),
      mid(
        f.path('M 0,14 Q 10,11 20,13.5 Q 30,15.6 40,12.4 L 40,20 L 0,20 Z', 'ground') // 모래 언덕
        + f.rect(6, 6, 14, 10, 'wall2') // 골조 안
        + [6, 9.3, 12.6].map((y) => f.rect(5, y, 16, 0.9, 'roof2')).join('') // 바닥판 셋
        + [7, 12.5, 18].map((x) => f.rect(x, 6, 0.9, 10, 'roof2')).join('') // 기둥 셋
        + f.rect(28, 2, 1.3, 14, 'roof2') + f.rect(17, 2, 20, 0.9, 'roof2') // 크레인 기둥·팔
        + f.path('M 28,2 L 28.65,-0.6 L 29.3,2 Z', 'roof2') + f.line('M 28.65,-0.4 L 17.6,2.1 M 28.65,-0.4 L 36.4,2.1', 0.4, 'roof2') // 꼭대기·버팀줄
        + f.line('M 20.5,2.9 V 6.4', 0.4, 'roof2') + f.rect(19.6, 6.4, 1.8, 1.4, 'cloth2') // 줄·짐
        + f.rect(33, 2.9, 3.6, 1.3, 'cloth2'), // 평형추
      ),
    ].join('') },
  { id: 'era-1982-ballpark', year: 1982, hCode: 'H-C02', name: '프로야구 출범', kind: '스포츠', heavy: false, line: '프로야구가 출범했습니다.',
    reuse: '야간 조명탑·관중석은 1986 아시안게임(대안)과 공유 가능. 다이아몬드는 새 조각(구단 표지·글자 없음)', alt: 'H-S05 통행금지 해제(밤거리 가로등)', approved: false,
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 26, 40, 6, 'green'),
      mid(
        f.rect(0, 9.4, 40, 1.4, 'wall2') // 외야 담장
        + f.rect(0, 10.8, 40, 9.2, 'green') // 잔디
        + f.path('M 20,11.4 L 29.5,16 L 20,20 L 10.5,16 Z', 'clay') // 내야
        + f.circle(20, 15.7, 1.05, 'ground2') // 마운드
        + [[19.5, 10.9], [28.2, 15.5], [10.9, 15.5]].map(([x, y]) => f.rect(x, y, 1, 1, 'cloth3')).join('') // 베이스 셋
        + f.path('M 19.4,18.6 L 20.6,18.6 L 20.6,19.3 L 20,19.9 L 19.4,19.3 Z', 'cloth3') // 홈
        + [5, 34].map((x) => f.rect(x, 1.2, 0.9, 8.4, 'roof2') + f.rect(x - 2.1, 0, 5.1, 2.3, 'roof2') + f.rect(x - 1.7, 0.4, 4.3, 1.5, 'glass')).join(''), // 조명탑 둘
      ),
    ].join('') },
  { id: 'era-1983-plain-clothes', year: 1983, hCode: 'H-S05', name: '교복·두발 자율화', kind: '사회', heavy: false, line: '교복과 두발이 자율화되었습니다.',
    reuse: '옷걸이 봉·옷 세 벌은 2000년대 「옷장」 생활 틀과 공유 가능. 새 조각', alt: '1983 생활 틀(골목)', approved: false,
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 25, 40, 7, 'wall2'),
      mid(
        f.rect(5, 3, 30, 0.9, 'roof2') + f.rect(5, 3, 0.9, 3.2, 'roof2') + f.rect(34.1, 3, 0.9, 3.2, 'roof2') // 옷걸이 봉·받침
        + f.line('M 11,3.9 V 5.7 M 20,3.9 V 5.7 M 29,3.9 V 5.7', 0.5, 'ink') // 고리 셋
        + f.path('M 7,7 L 11,5.6 L 15,7 L 15.5,16 L 6.5,16 Z', 'cloth1') + f.path('M 9.7,5.9 L 11,7.8 L 12.3,5.9 Z', 'cloth3') // 교복 상의(흰 깃)
        + f.path('M 16,7.2 L 20,5.6 L 24,7.2 L 24.3,15 L 15.7,15 Z', 'cloth2') + f.path('M 18.7,6 Q 20,7.6 21.3,6 Z', 'wall') // 스웨터
        + f.path('M 25,7 L 29,5.6 L 33,7 L 33.5,16 L 24.5,16 Z', 'cloth4') + f.path('M 27.7,5.9 L 29,9.4 L 30.3,5.9 Z', 'cloth3'), // 점퍼(깃)
      ),
    ].join('') },
  { id: 'era-1984-video-shop', year: 1984, hCode: null, name: '동네 비디오 가게(생활 장면)', kind: '생활', heavy: false, line: '동네마다 비디오 가게가 생겼습니다.',
    reuse: '생활 틀 1980년대(▲ 1983~1995 설계값) — 사건 그림이 승인되지 않은 1984·(1986·1989 대안)에도 쓴다. 진열대 상자는 색 토큰 순환(상표·글자 없음)', alt: 'GX1 오락실(갈등 후보, 승인 전)', approved: false,
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall2'), f.rect(0, 26, 40, 6, 'ground2'),
      mid(
        Array.from({ length: 8 }, (_, i) => f.rect(i * 5, 0, 5, 2.6, i % 2 ? 'cloth3' : 'cloth4')).join('') // 차양 줄무늬
        + f.rect(3, 3.4, 34, 13.2, 'roof2') + f.rect(4, 4.4, 32, 11.2, 'glass') // 진열창
        + [6, 10.6].map((y, row) => f.rect(5, y + 3.4, 30, 0.6, 'wood') + Array.from({ length: 6 }, (_, i) => f.rect(5.8 + i * 4.8, y, 3.6, 3.4, ['cloth1', 'cloth4', 'clay', 'green', 'cloth2', 'roof'][(i + row * 3) % 6])).join('')).join(''), // 선반 둘 + 테이프 상자 여섯(상표·글자 없음)
      ),
    ].join('') },
  { id: 'era-1985-first-car', year: 1985, hCode: 'X1', name: '마이카 — 첫 자가용', kind: '경제', heavy: false, line: '자가용을 처음 들이는 집이 늘었습니다.',
    reuse: '승용차는 집 그림 소품 prop-car(1985~, 「가진 것」 승용차)와 같은 조각 — 창에서는 40×32로 줄여 쓴다. 담·대문은 house-detached-rent-h2의 모양', alt: 'H-E14 중동 건설(1981과 공유)', approved: false,
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 23, 40, 9, 'ground'),
      mid(
        f.rect(0, 2, 14, 15, 'wall') + f.rect(3, 5, 5, 4, 'glass') + f.rect(-1, 1, 16, 1.4, 'roof2') // 집 벽·창·처마
        + f.rect(14, 7, 8, 10, 'wood') + f.rect(13.5, 6.2, 9, 1.1, 'roof2') // 대문
        + f.rect(22, 9, 18, 8, 'wall2') + f.rect(22, 8.3, 18, 1, 'roof2') // 담
        + f.path('M 21,12.6 L 23.6,9.3 L 31,9.3 L 33.2,12.6 Z', 'roof') + f.rect(17, 12.4, 19.2, 4.6, 'roof', { rx: 1 }) // 차 지붕·몸체
        + f.path('M 22.2,12.3 L 24.2,10 L 26.9,10 L 26.9,12.3 Z', 'glass') + f.path('M 27.7,12.3 L 27.7,10 L 30.6,10 L 32.1,12.3 Z', 'glass') // 유리창 둘
        + f.circle(21, 17, 1.9, 'roof2') + f.circle(21, 17, 0.8, 'wall2') + f.circle(32, 17, 1.9, 'roof2') + f.circle(32, 17, 0.8, 'wall2') // 바퀴
        + f.rect(35.3, 13.5, 0.9, 1.3, 'glass'), // 전조등
      ),
    ].join('') },
  { id: 'era-1986-export-port', year: 1986, hCode: 'H-E04', name: '3저 호황 — 수출 항구', kind: '경제', heavy: false, line: '수출이 늘어 항구가 붐볐습니다.',
    reuse: '항만 크레인·컨테이너 더미는 bg-coast-b3(항만 실루엣)·1997 외환위기(대안: 멈춘 부두)와 공유 가능', alt: 'H-C03 아시안게임(경기장 — 1988과 겹쳐 보여 뺌)', approved: false,
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 27, 40, 5, 'far2'),
      mid(
        f.rect(24, 18.5, 16, 3, 'far2') + f.rect(0, 17, 26, 4, 'ground2') // 바다·부두
        + f.path('M 25,18.6 L 40,18.6 L 40,14 L 26.6,14 Z', 'roof2') + f.rect(37, 9.6, 2.4, 4.4, 'wall') // 배·조타실
        + f.rect(28, 12, 3, 2, 'cloth2') + f.rect(31.3, 12, 3, 2, 'cloth4') + f.rect(34.6, 12, 3, 2, 'clay') + f.rect(31.3, 10, 3, 2, 'cloth1') // 배 위 컨테이너
        + f.rect(8, 4, 1, 13, 'roof2') + f.rect(17, 4, 1, 13, 'roof2') + f.rect(7, 3.2, 21, 1, 'roof2') // 갠트리 크레인 다리·팔
        + f.line('M 8.5,4.2 L 12.5,10 M 17.5,4.2 L 13.5,10', 0.45, 'roof2') + f.rect(22, 4.2, 1.6, 1, 'cloth2') + f.line('M 22.8,5.2 V 6.2', 0.4, 'roof2') + f.rect(21.5, 6.2, 2.6, 1.8, 'cloth4') // 버팀·대차·매단 짐
        + [[2, 15, 'cloth1'], [5, 15, 'cloth4'], [2, 13, 'cloth2'], [9.6, 15, 'cloth2'], [12.7, 15, 'cloth4'], [9.6, 13, 'clay']].map(([x, y, t]) => f.rect(x, y, 2.8, 2, t)).join(''), // 부두 컨테이너 더미
      ),
    ].join('') },
  { id: 'era-1987-ballot-box', year: 1987, hCode: 'H-B05', name: '직선제 — 투표함', kind: '정치', heavy: true, line: '국민이 대통령을 직접 뽑았습니다.',
    reuse: 'FM2d 표본 era-ballot-box 그대로(1948 첫 총선거·이후 선거 해와 공유 — 탁자·용지만 바꿈). 인물·정당·구호 없음', alt: '(그림 없음 — 인생 기록 배경 줄만)', approved: false,
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 21, 40, 11, 'wall2'),
      mid(
        f.rect(11, 6.5, 18, 9.5, 'cloth4') + f.rect(10, 5.5, 20, 2.4, 'cloth1') + f.rect(16, 6.1, 8, 1, 'wall') // 투표함·뚜껑·구멍
        + f.path('M 17.5,1.4 L 24.2,0.6 L 24.7,5.4 L 18,6 Z', 'cloth3') + f.rect(19, 2.4, 4, 0.9, 'cloth1') + f.rect(19, 4, 3, 0.9, 'cloth1'), // 넣는 용지(글자 대신 띠 둘)
      ),
    ].join('') },
  { id: 'era-1988-stadium-flame', year: 1988, hCode: 'H-C03', name: '서울올림픽 — 성화대', kind: '스포츠', heavy: false, line: '서울에서 올림픽이 열렸습니다.',
    reuse: 'FM2d 표본 era-stadium-flame 그대로(관중석 원호는 1982 야구장·1986 아시안게임·2002 월드컵과 공유). 오륜·휘장·글자 없음', alt: 'H-S06 국민연금·최저임금(월급 봉투)', approved: false,
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 26, 40, 6, 'far'),
      mid(
        f.path('M 2,16 Q 20,6 38,16 L 38,20 L 2,20 Z', 'far') + f.path('M 6,16 Q 20,9 34,16 Z', 'far2') // 관중석 원호 둘
        + f.rect(18.5, 9.4, 3, 6.8, 'wall2') + f.path('M 15,7 L 25,7 L 23,9.8 L 17,9.8 Z', 'wall2') // 성화대 기둥·접시
        + f.path('M 20,1.6 Q 24.3,4.2 23,7 L 17,7 Q 15.7,4.2 20,1.6 Z', 'cloth2') + f.path('M 20,3.4 Q 22,5.2 21.4,7 L 18.6,7 Q 18,5.2 20,3.4 Z', 'glass'), // 불꽃 두 겹
      ),
    ].join('') },
  { id: 'era-1989-passport-plane', year: 1989, hCode: 'H-C04', name: '해외여행 자유화 — 공항', kind: '문화', heavy: false, line: '해외여행이 자유화되었습니다.',
    reuse: '여객기는 1964 해외 취업(H-E14 — 떠나는 비행기)과 같은 조각. 활주로·관제탑은 새 조각', alt: 'H-E05 1기 신도시(1990과 공유)', approved: false,
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 27, 40, 5, 'ground2'),
      mid(
        f.rect(0, 17.4, 40, 3.6, 'roof2') + [2, 8, 14, 20, 26, 32].map((x) => f.rect(x, 19, 3, 0.5, 'cloth3')).join('') // 활주로·중앙선
        + f.rect(2, 12.5, 12, 5, 'wall') + f.rect(1.5, 12, 13, 0.9, 'roof2') + f.rect(3, 13.6, 10, 1.6, 'glass') // 청사
        + f.rect(12.6, 8, 1.4, 4.5, 'wall2') + f.rect(11.6, 7, 3.4, 1.7, 'roof2') // 관제탑
        + f.g('transform="rotate(-12 26 7)"',
          f.path('M 22,7.4 L 18,11 L 21,11 L 26,7.4 Z', 'wall2') // 날개(뒤)
          + f.rect(16, 5.9, 18, 3.1, 'cloth3', { rx: 1.55 }) + f.rect(17, 7.6, 16, 1.1, 'wall2') // 동체·배
          + f.path('M 31,6.2 L 34.4,2.4 L 35.5,2.4 L 34,6.2 Z', 'cloth4') // 꼬리날개
          + f.line('M 19.5,6.9 H 30', 0.6, 'roof2', 'stroke-dasharray="0.7 0.9"'), // 창문 줄
        ),
      ),
    ].join('') },
];
const ERA_LINE_MAX = 22; // family-scene.md 5-4 — 360에서 2줄 안
for (const q of ERA80) {
  if (q.line.length > ERA_LINE_MAX) throw new Error(`한 줄 ${q.line.length}자 > ${ERA_LINE_MAX}: ${q.id}`);
  if (/[0-9A-Za-z가-힣]/.test(q.draw().replace(/<[^>]+>/g, ''))) throw new Error(`그림 안 글자: ${q.id}`);
}
const heavyCount = ERA80.filter((q) => q.heavy).length;
if (heavyCount > 2) throw new Error(`재난·정치 ${heavyCount}장 > 2 (마스터 지시)`);
const eraSvg = (q, attrs = 'aria-hidden="true" focusable="false"') => `<svg viewBox="0 0 40 32" preserveAspectRatio="xMidYMid slice" ${attrs}>${q.draw()}</svg>`;

// ---------------------------------------------------------------- 조각 파일 + 예산 실측(조각 예산 110과 따로 — family-scene.md 5-5)
const countShapes = (s) => (s.match(/<(rect|path|circle|ellipse)\b/g) || []).length;
const rows = ERA80.map((q) => {
  const inner = q.draw();
  write(`pieces/era/${q.id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 32" width="200" height="160"><!-- 수저 게임 · 시대의 창 · ${q.id} · ${q.year} · ${q.hCode || '생활'} · ${q.kind}${q.heavy ? ' · 무거운 장면(가리기 대상)' : ''} · 승인 전(approved: false) · 새로 구성(사진 모사 없음), 색은 --c-scene-* 토큰 --><g>${inner}</g></svg>\n`);
  return { id: q.id, year: q.year, hCode: q.hCode, name: q.name, kind: q.kind, heavy: q.heavy, line: q.line, lineChars: q.line.length, shapes: countShapes(inner), raw: Buffer.byteLength(inner, 'utf8'), gz: gzipSync(Buffer.from(inner, 'utf8')).length, approved: q.approved };
});
const chunkGz = gzipSync(Buffer.from(JSON.stringify(Object.fromEntries(ERA80.map((q) => [q.id, q.draw()]))), 'utf8')).length;
const linesGz = gzipSync(Buffer.from(JSON.stringify(Object.fromEntries(ERA80.map((q) => [q.id, q.line]))), 'utf8')).length;
const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
const gzAvg = Math.round(sum('gz') / rows.length);
const ratio = Math.round((chunkGz / sum('gz')) * 100) / 100;
/** 1940~2025 방식별 추정 — 장당 평균(이 묶음 실측) × 장수 × 덩어리 비율 + 한 줄 */
const perLine = Math.round(linesGz / rows.length);
const est = (n, label) => ({ label, pieces: n, gzEachSum: gzAvg * n, chunkEst: Math.round(gzAvg * n * ratio), withLines: Math.round(gzAvg * n * ratio + perLine * n) });
const plans = [
  est(86, 'A 해마다 1장 새로(1940~2025, 86장)'),
  est(172, 'A2 해마다 2장(172장)'),
  est(56 + 9, 'B 사건 그림 56(겹치는 해는 재사용) + 생활 틀 9(10년 단위) = 65장 — 추천(era-window.md 4절 목록 기준)'),
  est(9 + 70, 'C 조합형: 시대 틀 9 + 교체 소품 70 = 79조각(장면은 조합 — 소품이 40×32에서 읽히려면 결국 장면마다 새 소품)'),
];
const budget = {
  measuredAt: '2026-10-28', note: '시대의 창 1980년대 10장(승인 전). raw·gz는 그림 안쪽 마크업 바이트, chunk는 10장을 {id: 마크업} JSON으로 묶어 gzip(덩어리 추정). shapes는 평면 조각 수(rect·path·circle·ellipse). 예산은 조각 110과 따로 센다(family-scene.md 5-5 · 마스터 결정 「시대별 하위 덩어리」). plans는 1940~2025 전체를 이 묶음의 장당 평균으로 늘린 추정(era-window.md 2절).',
  pieces: rows.length, heavy: heavyCount, shapesAvg: Math.round(sum('shapes') / rows.length), shapesMax: Math.max(...rows.map((r) => r.shapes)), rawTotal: sum('raw'), gzEachTotal: sum('gz'), gzEachAvg: gzAvg, chunkGz, chunkPerPiece: Math.round(chunkGz / rows.length), chunkRatio: ratio, linesGz, linePerPiece: perLine, plans, rows,
};
write('era-window-budget.json', JSON.stringify(budget, null, 2) + '\n');

// ---------------------------------------------------------------- 2:1 예시에 쓸 집 그림 — dashboard-family.html(장면 A)에서 읽는다
const dash = readFileSync(OUT + 'dashboard-family.html', 'utf8');
const hi = dash.indexOf('<div class="scene__house">');
const hj = dash.indexOf('</p></div>', hi) + '</p></div>'.length;
if (hi < 0 || hj < hi) throw new Error('dashboard-family.html에서 집 그림을 찾지 못함 — 먼저 buildFamilyMockups.mjs');
const houseA = dash.slice(hi, hj);
const ERA_ICON = '<symbol id="i-era" viewBox="0 0 24 24"><rect x="4" y="4.5" width="16" height="15" rx="1.5"/><path d="M12 4.5v15M4 12h16"/></symbol>';
const sceneLine = '서울 성북구 · 단독주택 셋방 · 부모님·누나 둘·할머니와 함께';
const petLine = '마당에서 기르는 개 한 마리가 있습니다.';
/** 집 그림 + 시대의 창(2:1 · 휴대폰은 쌓기) + 아래 한 줄 + 인생 기록 「시대의 창」 줄 — dashboard-family.html의 카드 구조 그대로(FM2d) */
function exampleCard(q, { hidden = false, age } = {}) {
  const k = `${q.year}${hidden ? 'h' : ''}`;
  const house = houseA
    .replace(/id="scene-year"/, `id="scene-year-${k}"`).replace(/aria-labelledby="scene-year scene-line scene-pets"/, `aria-labelledby="scene-year-${k} scene-line-${k} scene-pets-${k}"`)
    .replace(/<time datetime="\d+">\d+년<\/time>/, `<time datetime="${q.year}">${q.year}년</time>`);
  const name = hidden ? '가려 둔 장면' : q.line;
  const era = `<a class="era" href="#era-line-${k}" data-era="${q.id}" data-kind="${q.kind}" data-hidden="${hidden ? 'true' : 'false'}" title="시대의 창 · ${name}"><span class="era__pic" aria-hidden="true">${hidden ? '' : eraSvg(q)}</span><span class="sr-only">시대의 창 · ${name} 그해 기록으로</span></a>`;
  const row = hidden
    ? `<li class="log__row log__row--tl" data-kind="timeline" data-tl="era" id="era-line-${k}" tabindex="-1"><span class="log__age">${age}세<small class="log__year">${q.year}</small></span><span class="log__text"><span class="log__tl"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-era"/></svg><span>시대의 창</span></span><span class="log__sent ew__veil">무거운 일이 있었던 해입니다 · 가려 둔 장면 <button class="btn btn--ghost btn--sm" type="button">펼쳐 보기</button></span></span></li>`
    : `<li class="log__row log__row--tl" data-kind="timeline" data-tl="era" id="era-line-${k}" tabindex="-1"><span class="log__age">${age}세<small class="log__year">${q.year}</small></span><span class="log__text"><span class="log__tl"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-era"/></svg><span>시대의 창</span></span><span class="log__sent">${q.line}</span></span></li>`;
  return `<div class="ew__example"><section class="card scene-card" aria-labelledby="scene-title-${k}" data-fold="false" data-scene="a" data-year="${q.year}">
<h3 id="scene-title-${k}" class="sr-only">집과 가족 · ${q.year}년</h3>
<div class="scene" id="scene-pic-${k}">${house}${era}</div>
<p class="scene__line" id="scene-line-${k}">${sceneLine}</p>
<p class="sr-only" id="scene-pets-${k}">${petLine}</p>
<div class="scene__row"><details class="scene__more"><summary>함께 사는 사람</summary><ul class="scene__people"><li>어머니 · 박영숙 · ${34 + q.year - 1975}세 · 아주 가까움</li><li>아버지 · 김재호 · ${36 + q.year - 1975}세 · 가까움</li><li>${petLine.replace(/가 있습니다\.$/, '')}</li></ul></details><button class="btn btn--ghost btn--sm scene__fold" type="button" aria-expanded="true" aria-controls="scene-pic-${k}">그림 접기</button></div>
</section>
<section class="card log ew__log" aria-label="인생 기록(발췌)"><h3 class="ew__log-title">인생 기록 — 시대의 창 줄</h3><ul class="log__list ew__log-list" role="list">${row}</ul></section></div>`;
}

// ---------------------------------------------------------------- 시트 HTML
const KIND_NOTE = { 생활: '생활 장면', 문화: '문화', 경제: '경제', 스포츠: '스포츠', 사회: '사회', 재난: '재난', 정치: '정치(일반 상징)' };
const figure = (q, size = 'pc') => `<figure class="ew__fig" data-era="${q.id}" data-heavy="${q.heavy}" data-size="${size}"><div class="ew__pic">${eraSvg(q)}</div><figcaption class="ew__cap"><span class="ew__year">${q.year}년</span><span class="ew__name">${q.name}</span><span class="ew__kind">${q.hCode ? `${q.hCode} · ` : ''}${KIND_NOTE[q.kind] || q.kind}</span>${q.heavy ? '<span class="ew__heavy">무거운 장면 · 가리기 설정의 대상</span>' : ''}</figcaption></figure>`;
const html = `<!doctype html>
<html lang="ko" data-paper="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>수저 게임 · 시안 · 시대의 창 — 1980년대 열 장(SPEC-009 FT2·FT3, 승인 전)</title>
<!-- 시안(정적 HTML) — SPEC-009 시대의 창 첫 승인 묶음. 생성 scripts/design/buildEraWindow.mjs · ?theme=dark 다크 · ?motion=reduce 움직임 줄이기. 외부 자원 0. 그림은 모두 새로 구성(사진 모사 없음), 승인 전(approved: false). -->
<link rel="stylesheet" href="../../../../src/styles/tokens.css">
<link rel="stylesheet" href="../ds.css">
<link rel="stylesheet" href="../gm3/gm3.css">
<link rel="stylesheet" href="family.css">
<script>(function(){var q=new URLSearchParams(location.search);var t=q.get('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);if(q.get('motion')==='reduce')document.documentElement.setAttribute('data-motion','reduce');})();</script>
<style>
.ew { max-width: 1120px; margin: 0 auto; padding: var(--sp-6) var(--gutter) var(--sp-10); }
.ew h1 { font-size: var(--fs-2xl); line-height: var(--lh-snug); margin: 0 0 var(--sp-2); }
.ew h2 { font-size: var(--fs-xl); margin: var(--sp-8) 0 var(--sp-2); }
.ew__lead, .ew__note { margin: 0 0 var(--sp-4); color: var(--c-text-2); max-width: 72ch; }
.ew__lead { font-size: var(--fs-md); color: var(--c-text); }
/* 10장 — PC는 실제 칸 크기(175×140) 그대로 다섯 줄, 좁은 폭은 두 줄로 흐른다 */
.ew__grid { display: grid; grid-template-columns: repeat(5, 175px); gap: var(--sp-5) var(--sp-4); justify-content: start; }
@media (max-width: 1023px) { .ew__grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); } }
.ew__fig { margin: 0; min-width: 0; }
.ew__pic { aspect-ratio: 5 / 4; overflow: hidden; background: var(--c-scene-sky); }
.ew__pic svg { display: block; width: 100%; height: 100%; forced-color-adjust: none; }
.ew__cap { display: grid; gap: 2px; margin-top: var(--sp-2); font-size: var(--fs-sm); line-height: var(--lh-normal, 1.5); color: var(--c-text); word-break: keep-all; }
.ew__year { font-weight: var(--fw-bold); font-variant-numeric: tabular-nums; }
.ew__kind { color: var(--c-text-2); }
.ew__heavy { color: var(--c-era); font-weight: var(--fw-bold); }
/* 휴대폰 띠 크기(100×80) — 그림만 */
.ew__strip { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.ew a { color: var(--c-brand); text-decoration: underline; text-underline-offset: 2px; }
.ew__strip .ew__fig { width: 100px; }
.ew__strip .ew__cap { font-size: var(--fs-xs); }
/* 2:1 예시 — 대시보드 가운데 열 폭(534px) 그대로. 좁으면 전폭 → family.css 컨테이너 규칙이 쌓기(띠 80px)로 바꾼다 */
.ew__examples { display: flex; flex-wrap: wrap; gap: var(--sp-5); align-items: flex-start; }
.ew__example { width: min(534px, 100%); display: grid; gap: var(--sp-3); }
.ew__log { padding-top: var(--sp-3); }
.ew__log-title { font-size: var(--fs-sm); color: var(--c-text-2); margin: 0; font-weight: var(--fw-regular); }
.ew__log-list { max-height: none; overflow: visible; }
.ew__veil { color: var(--c-text-2); display: inline-flex; flex-wrap: wrap; gap: var(--sp-1) var(--sp-2); align-items: center; }
.ew table { border-collapse: collapse; width: 100%; max-width: 72ch; font-size: var(--fs-sm); }
.ew th, .ew td { text-align: left; padding: var(--sp-2) var(--sp-2) var(--sp-2) 0; border-bottom: 1px solid var(--c-border); vertical-align: top; }
.ew td.num, .ew th.num { text-align: right; font-variant-numeric: tabular-nums; padding-right: 0; }
@media (forced-colors: active) { .ew__pic { border: 1px solid CanvasText; } }
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">${ERA_ICON}</svg>
<main class="ew">
<h1>시대의 창 — 1980년대 열 장</h1>
<p class="ew__lead">해마다 한 장, 종이 오림으로 새로 구성한 그림입니다. 칸에는 그림만 들어가고 그해 문장은 인생 기록의 「시대의 창」 줄에 적힙니다. 재난·정치는 일반 상징으로만 그렸고(1987 투표함 한 장), 1980년 5월과 1979년 가을의 일은 그릴 일반 상징이 없어 그림을 두지 않습니다. 글자·로고·휘장·실존 인물·정당 상징·참상은 없고, 사진을 따라 그리지 않았습니다. 모두 승인 전입니다.</p>
<nav class="cmp__links" aria-label="보기" style="display:flex;flex-wrap:wrap;gap:var(--sp-3);font-size:var(--fs-sm);margin:0 0 var(--sp-6)"><a href="era-window-1980s.html">라이트</a><a href="era-window-1980s.html?theme=dark">다크</a><a href="dashboard-family.html?scene=a&amp;era=stadium&amp;decision=fold">대시보드 자리(FM2d)</a><a href="scenes.html#era-samples">표본 셋(FM2d)</a></nav>

<h2>열 장 — PC 칸 크기 175×140</h2>
<div class="ew__grid">${ERA80.map((q) => figure(q)).join('')}</div>

<h2>실제 자리 — 집 그림 옆 2:1(PC) · 집 아래 띠(휴대폰)</h2>
<p class="ew__note">왼쪽은 1985년(자가용), 오른쪽은 1987년을 「무거운 장면 가리기」를 켠 상태로 둔 것입니다. 칸을 누르면 인생 기록의 그해 줄로 갑니다. 집 그림은 장면 A(FM2d)를 그대로 읽어 왔고, 가족 이름·나이는 시안의 가짜 값입니다.</p>
<div class="ew__examples">${exampleCard(ERA80.find((q) => q.year === 1985), { age: 13 })}${exampleCard(ERA80.find((q) => q.year === 1987), { hidden: true, age: 15 })}</div>

<h2>휴대폰 띠 크기 100×80</h2>
<p class="ew__note">휴대폰에서는 집 그림 아래 띠(80px)의 왼쪽에 이 크기로 놓입니다. 이 크기에서도 읽히는지 보는 줄입니다.</p>
<div class="ew__strip">${ERA80.map((q) => figure(q, 'mobile')).join('')}</div>

<h2>인생 기록 줄 문장(제안)</h2>
<table><thead><tr><th scope="col">해</th><th scope="col">문장</th><th scope="col" class="num">자</th><th scope="col" class="num">gzip</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.year}</td><td>${r.line}${r.heavy ? ' <span class="ew__heavy">· 가리기 대상</span>' : ''}</td><td class="num">${r.lineChars}</td><td class="num">${r.gz}B</td></tr>`).join('')}</tbody></table>
<p class="ew__note">열 장 합계 gzip ${sum('gz').toLocaleString('ko-KR')}B(개별) · 덩어리 ${chunkGz.toLocaleString('ko-KR')}B · 장당 평균 ${gzAvg}B · 평면 조각 평균 ${budget.shapesAvg}개(최대 ${budget.shapesMax}). 정본 수치는 era-window-budget.json.</p>
</main>
</body>
</html>
`;
write('era-window-1980s.html', html);

console.log(`시대의 창 1980년대: ${rows.length}장 · 무거운 장면 ${heavyCount} · 장당 gzip 평균 ${gzAvg}B(합 ${sum('gz')}) · 덩어리 ${chunkGz}B(비율 ${ratio}) · 한 줄 평균 ${perLine}B · 조각 평균 ${budget.shapesAvg}(최대 ${budget.shapesMax})`);
for (const r of rows) console.log(`${r.year} ${r.id}: ${r.kind}${r.heavy ? '(무거움)' : ''} · 조각 ${r.shapes} · raw ${r.raw} · gz ${r.gz} · 「${r.line}」(${r.lineChars})`);
for (const p of plans) console.log(`${p.label}: ${p.pieces}장 → 덩어리 ≈ ${p.chunkEst}B(+한 줄 ${p.withLines}B)`);
