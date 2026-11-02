/**
 * 시대의 창 r5b — 무거운 장면 다시 그리기 9 + 2009 수저 구간 분기 2 = 11장 (designer 2026-11-02).
 * 형진 님 답(2026-11-02): ① 2009년은 인생이 어려우면 재난 사건(1월 철거 현장), 잘 살면 첫 스마트폰 ② 현장까지 생생하게 ③ 무겁게 느껴도 좋으니 넣는다.
 * 마스터 해석: 2009 = `band: 'low'` 철거 현장(○) / `band: 'high'` 첫 스마트폰(○ 아님) / 가운데 = 기존 5월 조문 줄(○, 그대로 두되 다른 ○와 같이 거리를 당김).
 * 수위 유지선(FT3 r4)은 그대로: 순간(구타·총격·압박·불길 속 사람·구조되는 사람) 0 · 시신·피·상처 0 · 실존 인물 얼굴·이름 0 · 정당 상징·구호 0 · 평가 문장·사망자 수 0.
 * 「그 자리에 서 있는 느낌」: 카메라를 현장 안으로 — 앞줄 사람은 키 11~16(아래가 잘림), 중심 사물은 화면의 절반 이상, 연기·잔해·장비·군중의 밀도를 올린다.
 * 바뀐 장면의 id는 r5와 같다(developer는 조각을 `pieces/era-r5b/`에서 가져간다). 새 id: `era-2009-demolition-fire`(low) · `era-2009-first-smartphone`(high).
 */
import { f, rep, shadow, person, walker, crouch, far, crowd, queue, mass, lamp, cloud, plume, flame, hills, bicycle, tower, aptSlab, skyline, nightRoad, curb, blank, subwayEntrance, tent, policeTape, cone, streetTree, fluorescent, ambulance, fireEngine, car, heli, boat, ferry, greyShip, flowers, ribbon, candle, candleCrowd, halfMast, phoneGlow, waves, swell, spray, rebar, smokeMass, rubble, crack, firefighter, firefighterBack, hose, shouldered, breath, riotFar, glow, lightbar, smartphone, watchtower, mobileCrane, hungContainer, waterCannon, hoarding } from './eraR5bLib.mjs';

const CITY = ['cloth1', 'roof2', 'cloth4', 'hairw', 'clay', 'far', 'cloth3', 'ink'];
/** 국화 한 송이(손에 든 — 흰 꽃 + 노란 심 + 줄기) */
const mum = (x, y, r = 0.4) => f.circle(x, y, r, 'cloth3') + f.circle(x, y, r * 0.38, 'cloth2') + f.line(`M${x},${y + r} v${r * 2.2}`, 0.1, 'green');
/** 필로티 빌라(가까이 — 3층 벽체 · 창 · 기둥 n) */
const pilotiNear = (x, yBase, w, h, cols = 4) => f.rect(x, yBase - h, w, h - 7, 'wall2') + f.rect(x, yBase - h - 0.6, w, 0.6, 'roof2') + rep(3, (i) => rep(Math.floor(w / 4.2), (j) => f.rect(x + 1 + j * 4.2, yBase - h + 1.2 + i * ((h - 7) / 3), 2.4, 2.2, 'glass') + f.rect(x + 1 + j * 4.2, yBase - h + 3.4 + i * ((h - 7) / 3), 2.4, 0.3, 'far', { op: 0.5 }))) + rep(cols, (j) => f.rect(x + 1.2 + j * ((w - 2.4) / (cols - 1)) - 0.8, yBase - 7, 1.6, 7, 'far'));

export const S5B = [
  // ---------------------------------------------------------------- 1994 — 다리 위에서
  { id: 'era-1994-bridge-collapse', year: 1994, hCode: 'H-B06', name: '1994년 10월 — 끊긴 한강 다리', kind: 'event', topic: '재난', heavy: true, approved: false, redrawn: true,
    line: '한강 다리의 한 구간이 무너졌습니다.',
    draws: '아침, 끊긴 다리 위 — 바로 앞에서 뚝 끊긴 상판과 늘어진 철근, 그 끝에 멈춰 선 승용차와 소방차, 끝에 서서 내려다보는 소방관 둘, 아래 강에 기울어 반쯤 잠긴 상판과 물보라, 상판을 둘러싼 구조 보트 셋(조끼 입은 대원들)과 줄을 내린 헬기, 건너편의 끊긴 다리 끝과 아파트.',
    ft3: '유지선 ① 추락한 차량 안·시신·구조되는 사람 0(끊긴 끝·내려앉은 상판·보트와 헬기까지) ② 실존 인물 0(뒷모습·먼 인물·헬멧) ④ 사망자 수·원인·책임 0(한 줄은 사실만). 다리 이름·글자 0. 사진 모사 0. r5보다 카메라를 다리 위로 — 끊긴 끝이 화면 왼쪽을 채우고 보트는 앞까지 온다.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'far2', { op: 0.3 }), rep(7, (i) => aptSlab(-1 + i * 6, 10.4, 3.6, 5 + (i % 3) * 1.6, 'far2', 5)), f.rect(0, 10.2, 40, 0.8, 'green', { op: 0.5 }),
      // 강(크게)
      f.rect(0, 11, 40, 21, 'cloth4'), f.rect(0, 11, 40, 21, 'far2', { op: 0.45 }), waves(0, 40, 13, 30, 24, 94, 'cloth3', 0.4),
      // 건너편 다리 끝(멀리·낮게) + 교각
      f.rect(27.5, 12.2, 12.5, 1.6, 'wall2'), f.line('M27.5,12 H40', 0.2, 'roof2'), f.rect(31, 13.8, 1.2, 4, 'far'), f.rect(37, 13.8, 1.2, 4, 'far'), f.line('M27.5,12.2 l0.4,1.6 M27.9,12.2 l0.6,1', 0.3, 'roof2'), rebar(27.3, 13.4, 2, 1, -1, 0.4),
      // 내려앉은 상판(가운데 크게 · 기울어 반쯤 잠김) · 철근 · 물보라
      f.poly([[13, 19.6], [26.4, 16.8], [27.2, 20.2], [13.6, 23.4]], 'wall2'), f.poly([[13, 19.6], [26.4, 16.8], [26.4, 17.9], [13, 20.7]], 'far', { op: 0.6 }), f.poly([[13.2, 21.4], [27.1, 19.6], [27.2, 20.2], [13.6, 23.4]], 'cloth4', { op: 0.4 }), rebar(26.4, 16.8, 3, 1.6, 1), rebar(12.4, 19.8, 3, 1.4, -1), spray(20, 23.2, 14, 0.45), f.line('M14,23.4 q1,0.6 2.4,0 M23,22.6 q1.2,0.6 2.6,0', 0.2, 'cloth3', { op: 0.6 }),
      // 이쪽 다리(왼쪽 · 크고 가까움) — 두꺼운 상판 · 난간 · 끊긴 끝 · 교각
      f.rect(0, 14.6, 15, 3.2, 'wall2'), f.rect(0, 14.6, 15, 0.5, 'far', { op: 0.5 }), f.rect(0, 17.8, 15, 0.8, 'far'), f.poly([[15, 14.6], [16.4, 15.6], [15.8, 17.8], [15, 18.6]], 'wall2'), f.line('M15,14.6 l0.9,0.9 l-0.5,1.3 l0.9,1 l-0.4,0.8', 0.26, 'ink', { op: 0.6 }), rebar(15.6, 16.2, 4, 2.6, 1),
      f.rect(4.4, 18.6, 1.8, 7.4, 'far'), f.rect(11.6, 18.6, 1.8, 6.6, 'far'), f.rect(4.2, 25.6, 2.2, 0.6, 'far2', { op: 0.6 }),
      f.line('M0,13.2 H15.4', 0.22, 'roof2'), f.line(rep(8, (i) => `M${1 + i * 2},13.2 v1.4`), 0.18, 'roof2'),
      // 다리 위: 소방차 · 끝의 차(멈춤) · 소방관 둘(끝을 봄)
      fireEngine(-1.5, 14.6, 9.6, 1), car(9.2, 14.6, 4.6, 'cloth1', 1), f.rect(9.6, 13.3, 1, 0.3, 'clay', { op: 0.7 }),
      person(13.3, 14.7, 3.8, { top: 'clay', bottom: 'clay', hat: 'helmet', hatTok: 'cloth2' }), person(14.5, 14.9, 3.6, { top: 'clay', bottom: 'clay', hat: 'helmet', hatTok: 'cloth2', arm: 'upR' }),
      // 헬기(낮게 · 줄)
      heli(21, 6, 7, 'roof2', -1), f.line('M21,8.2 V15.4', 0.12, 'ink', { op: 0.6 }), f.circle(21, 15.6, 0.4, 'cloth2'),
      // 구조 보트들 — 가까이 올수록 크게, 조끼(cloth2) 대원들
      boat(28.6, 21.6, 4.4, 'hairw'), far(30.4, 21.4, 1.6, 'cloth2', 'roof2'), f.line('M33.2,22.2 q1,0.4 2.2,0', 0.18, 'cloth3', { op: 0.6 }),
      boat(5.6, 24.6, 6.4, 'cloth2'), far(7.8, 24.3, 2.2, 'cloth2', 'roof2'), far(10, 24.4, 2, 'cloth2', 'roof2'), f.line('M12.2,25.2 q-1.4,0.6 -3,0.2', 0.2, 'cloth3', { op: 0.6 }),
      boat(21, 29, 10, 'cloth2'), far(23.8, 28.6, 3.4, 'cloth2', 'roof2'), far(27, 28.5, 3.2, 'cloth2', 'roof2'), far(29.4, 28.7, 3, 'cloth2', 'roof2'), f.circle(22.4, 28, 0.55, 'cloth3'), f.circle(22.4, 28, 0.3, 'clay'), f.line('M31.2,29.8 q-2,0.9 -4.8,0.3 M19.6,29.8 q1.2,0.7 2.4,0.2', 0.24, 'cloth3', { op: 0.6 }), spray(26, 31.3, 13, 0.3),
    ].join('') },

  // ---------------------------------------------------------------- 2003 — 역 입구 바로 앞
  { id: 'era-2003-subway-entrance-smoke', year: 2003, hCode: 'H-B07', name: '2003년 2월 — 지하철역 입구의 연기', kind: 'event', topic: '재난', heavy: true, approved: false, redrawn: true,
    line: '지하철역에서 큰불이 났습니다.',
    draws: '겨울 한낮, 역 입구 바로 앞 — 화면 가운데를 차지한 입구 계단에서 쏟아져 올라 하늘을 메우는 검은 연기와 땅에 깔린 연기, 공기통을 메고 호스를 끌며 계단으로 들어가는 소방관들의 옆모습·뒷모습, 입구에서 걸어 나와 멀어지는 사람들, 길을 가로지른 호스, 오른쪽을 채운 소방차와 왼쪽의 구급차, 통제선 앞에 선 시민들의 어깨 너머.',
    ft3: '유지선 ① 역 안·시신·화상·구조되는 사람 0(입구·연기·진입하는 소방관·걸어 나오는 사람까지 — 쓰러진 사람 0) ② 실존 인물 0(뒷모습·옆모습·헬멧) ④ 원인·책임·사망자 수 0(한 줄은 사실만). 역명·글자 0. 피해자·유족이 있는 사건 — 판단을 여기와 era-window.md에 적었다. 사진 모사 0. r5보다 입구가 2배, 연기는 하늘의 2/3.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'far2', { op: 0.35 }),
      f.rect(0, 0, 16, 19, 'wall2'), f.rect(0.6, 1, 14.8, 15, 'far', { op: 0.08 }), f.fill(0.6, 1, 14.8, 15, 'era-windows', { op: 0.5 }), f.rect(24, 0, 16, 19, 'wall'), f.fill(24.6, 0.8, 14.8, 15.4, 'era-windows', { op: 0.45 }), f.rect(16, 2, 8, 17, 'far2'), f.fill(16.4, 2.6, 7.2, 14, 'era-windows', { op: 0.4 }),
      curb(19), f.rect(0, 19.4, 40, 12.6, 'ground'), f.rect(0, 19.4, 40, 12.6, 'far2', { op: 0.25 }), f.rect(0, 25.4, 40, 6.6, 'ground2'),
      // 역 입구(크게 · 가운데)
      subwayEntrance(10, 24.6, 16, 5.2), f.rect(10.5, 19.4, 15, 0.6, 'ink', { op: 0.5 }),
      // 연기 — 입구에서 솟아 하늘을 메움 · 땅에 깔린 연기
      f.ellipse(18, 20.8, 11, 1.6, 'roof2', { op: 0.4 }), plume(16.6, 20.6, 15, 'ink', 0.72), plume(20.4, 20.8, 11, 'roof2', 0.52), smokeMass(8, 1, 22, 15, 20, 2003, 'ink', 0.62), smokeMass(14, -1, 20, 9, 10, 20031, 'roof2', 0.45), cloud(11, 19.6, 2.6, 'roof2', 0.45), cloud(25.6, 19.8, 2.4, 'roof2', 0.4), f.rect(0, 0, 40, 10, 'roof2', { op: 0.12 }),
      // 소방차(오른쪽 크게 · 잘림) · 구급차(왼쪽 잘림) · 호스
      fireEngine(28, 25.4, 16, -1), lightbar(39.6, 19.4, 1.6), ambulance(-3.4, 25.2, 9, 1), hose('M28.6,25 Q22,24.2 19.4,24.5 Q17,24.8 15.2,24.3', 0.5),
      // 소방관 — 계단으로 들어가는 셋(옆) · 입구 앞 뒷모습 하나 · 호스 잡은 하나
      firefighter(13.4, 24.9, 5.8, 1), firefighter(16.4, 25.1, 6, 1), firefighterBack(21, 25.3, 6.2, { arm: 'upL' }), firefighter(25.4, 25.7, 6.4, -1), f.line('M24.6,22.4 L22.4,22.6', 0.3, 'clay'),
      // 걸어 나와 멀어지는 사람들(옆 · 입구에서 왼쪽으로)
      walker(7.4, 25.4, 6.6, { top: 'cloth1', bottom: 'ink', hair: 'ink' }, -1), walker(4.4, 25.8, 7, { top: 'cloth4', bottom: 'cloth1', skirt: true }, -1), walker(9.8, 25, 6, { top: 'roof2', bottom: 'cloth1', hair: 'ink', hat: 'scarf', hatTok: 'cloth3' }, -1), walker(1.6, 25.2, 6.4, { top: 'hairw', bottom: 'roof2' }, -1),
      cone(8.4, 27.2), cone(27.4, 28.2), f.rect(2.2, 21, 0.3, 4.4, 'roof2'),
      // 통제선(앞) · 시민들(어깨 너머 — 소방관이 가려지지 않게 머리는 통제선 조금 위까지)
      policeTape(0.8, 28, 39.2, 28), crowd(-1, 41, 9, 5.4, 7.2, { y: 32.8, jitter: 1, seed: 20032, skirts: 0.3, tops: CITY, bottoms: ['cloth1', 'ink'], hats: [{ hat: 'scarf', hatTok: 'cloth3', p: 0.25 }] }),
    ].join('') },

  // ---------------------------------------------------------------- 2008 — 촛불 군중 속
  { id: 'era-2008-candle-summer', year: 2008, hCode: 'H-B13', name: '2008년 여름 — 광장의 촛불', kind: 'event', topic: '정치', heavy: true, approved: false, redrawn: true,
    line: '여름밤, 광장에 촛불이 켜졌습니다.',
    draws: '초여름 밤, 촛불 군중 한가운데 — 바로 앞 어깨들과 손마다 종이컵 촛불, 어깨 위에 올라앉아 촛불을 든 아이, 유모차, 빈 피켓, 끝없이 이어지는 촛불의 바다(세 겹)와 멀리 불 켜진 빌딩·가로등, 광장 끝 경찰 버스의 줄(접촉 0).',
    ft3: '유지선 ③ 정당 상징·구호 글자 0(피켓·현수막은 빈 면) ② 실존 인물 0(뒷모습·먼 인물) ① 충돌·연행 순간 0(경찰 버스는 멀리 줄만) ④ 평가어 0(한 줄은 사실만). 사진 모사 0. r5보다 카메라를 군중 안으로 — 앞줄 키 12~15, 촛불 70여 개.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.3 }), tower(0, 13, 8, 12, 'roof2', { night: true, op: 0.45 }), tower(8.6, 13, 9, 9, 'roof2', { night: true, op: 0.45 }), tower(18.4, 13, 11, 13, 'roof2', { night: true, op: 0.45 }), tower(30.2, 13, 9.8, 11, 'roof2', { night: true, op: 0.45 }),
      rep(6, (i) => f.rect(0.5 + i * 6.6, 13.4, 6, 1.8, 'cloth4', { rx: 0.3 }) + f.rect(0.9 + i * 6.6, 13.7, 5.2, 0.7, 'glass', { op: 0.5 })), lamp(6, 15.4, 6, true), lamp(33.4, 15.4, 6, true),
      nightRoad(15.2, 16.8), f.rect(0, 15.2, 40, 16.8, 'cloth1', { op: 0.2 }),
      // 촛불의 바다 — 세 겹 패턴 + 번짐
      mass(0, 15.6, 40, 2.8, 0.7), f.fill(0, 15.4, 40, 3.2, 'era-cups', { op: 0.85 }), mass(0, 18, 40, 2.6, 0.8), f.fill(0, 17.8, 40, 3, 'era-cups', { op: 0.9 }), f.rect(0, 15, 40, 6.4, 'glass', { op: 0.1 }),
      // 먼 인물 줄 + 촛불
      rep(14, (i) => far(0.4 + i * 2.9 + (i % 2) * 0.5, 22.2 + (i % 3) * 0.35, 3.8, CITY[(i * 3) % 8], 'ink') + candle(0.95 + i * 2.9 + (i % 2) * 0.5, 20.4 + (i % 3) * 0.35, 0.42)),
      // 중간 군중(촛불) · 빈 피켓
      candleCrowd(-1, 41, 13, 5.6, 7.8, { y: 27.6, jitter: 1.2, seed: 2008, skirts: 0.35, tops: ['cloth3', 'cloth4', 'hairw', 'cloth1', 'clay', 'roof2'], bottoms: ['cloth1', 'ink', 'roof2', 'far'] }), blank(15.6, 18.6, 3.4, 2.2, 'cloth3'), f.line('M17.3,20.8 V24.2', 0.2, 'wood'),
      // 앞 군중(크게 · 아래 잘림) · 어깨 위 아이 · 유모차
      f.rect(9.6, 29, 3.6, 2.6, 'cloth4', { rx: 0.6 }), f.line('M13.2,29 L14.6,26.6', 0.22, 'ink'), f.circle(10.2, 31.8, 0.6, 'ink'), f.circle(12.6, 31.8, 0.6, 'ink'),
      candleCrowd(-2, 42, 7, 12, 15.5, { y: 36.5, jitter: 1.5, seed: 20081, skirts: 0.3, tops: ['cloth3', 'cloth4', 'hairw', 'cloth1', 'clay', 'roof2'], bottoms: ['cloth1', 'ink', 'roof2'] }),
      shouldered(29.4, 36, 13, { top: 'cloth4', bottom: 'cloth1', hair: 'ink' }, { top: 'cloth3', hair: 'ink' }), candle(30.6, 24, 0.55),
    ].join('') },

  // ---------------------------------------------------------------- 2009 가운데 — 조문 줄 안에서
  { id: 'era-2009-square-mourning-queue', year: 2009, hCode: 'H-B13', name: '2009년 5월 — 광장의 조문 줄', kind: 'event', topic: '정치', heavy: true, approved: false, redrawn: true,
    line: '5월, 광장에 조문 줄이 길었습니다.',
    draws: '5월 광장, 조문 줄 안에서 — 바로 앞 어깨들과 손에 든 흰 국화, 세 겹으로 꺾이며 천막으로 이어지는 긴 줄, 국화가 쌓인 천막과 빈 쪽지들, 조기가 걸린 건물과 깃대, 노란 리본이 빼곡한 가로수와 난간, 경찰 버스 없이 열린 길.',
    ft3: '유지선 ② 실존 인물 얼굴·이름·영정·장례 행렬 0(1979 선례 — 조기와 시민의 줄까지) ③ 정당 상징·구호 글자 0(쪽지·현수막은 빈 면) ④ 평가어 0(한 줄은 사실만). 사진 모사 0. 수저 구간 가운데(mid)에서 보는 2009 — 마스터 결정. r5보다 줄이 가깝고 국화가 손에 보인다.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.15 }), tower(0, 14.2, 9, 13, 'far', { op: 0.45 }), f.rect(11, 6, 17, 8.4, 'wall2'), f.fill(11.6, 6.8, 15.8, 7, 'era-windows', { op: 0.5 }), f.path('M10.4,6 L28.6,6 L27.4,4 L11.6,4Z', 'roof2'), tower(29.4, 14.2, 10.6, 12, 'far2', { op: 0.45 }),
      halfMast(9.4, 14.2, 13, 2.6), halfMast(30.6, 14.2, 13, 2.6), halfMast(19.5, 4, 4.6, 2.4),
      curb(14.2), f.rect(0, 14.6, 40, 17.4, 'ground'), f.fill(0, 14.6, 40, 17.4, 'era-tiles', { op: 0.25 }),
      // 가로수 + 리본 빼곡 · 난간 리본
      streetTree(3.4, 15, 12), streetTree(37, 15, 12), rep(9, (i) => ribbon(1.2 + (i % 3) * 1.6, 8.4 + Math.floor(i / 3) * 1.5, 0.95)), rep(9, (i) => ribbon(34.8 + (i % 3) * 1.6, 8.4 + Math.floor(i / 3) * 1.5, 0.95)), rep(3, (i) => ribbon(3.3, 11.2 + i * 1.1, 0.7)),
      f.line('M0,19.6 H9.6', 0.3, 'roof2'), f.line(rep(4, (i) => `M${1.2 + i * 2.6},19.6 v2`), 0.2, 'roof2'), rep(4, (i) => ribbon(1.2 + i * 2.6, 21.2, 0.8)),
      // 천막(국화 더미 크게 · 빈 쪽지)
      tent(16.4, 22.4, 17, 6.8, 'cloth3'), f.rect(17, 16.6, 15.8, 0.3, 'roof2', { op: 0.4 }), flowers(17.2, 20.2, 15.4, 32, 2009), rep(10, (i) => blank(17.2 + (i % 5) * 3.1, 15.8 + Math.floor(i / 5) * 1.3, 2.3, 1, 'cloth3', { op: 0.9 })),
      // 줄 — 멀리(천막 쪽으로) · 중간 · 앞(줄 안)
      queue(15.6, 22.6, 7, 4.6, -2.1, { seed: 2009, tops: ['cloth1', 'ink', 'roof2', 'cloth3', 'far'], bottoms: ['cloth1', 'ink'], skirts: 0.4 }, 1), rep(7, (i) => mum(16.2 - i * 2.1, 20.5 + (i % 2) * 0.2, 0.3)),
      queue(1.6, 27.2, 9, 7, 4.1, { seed: 20092, tops: ['cloth1', 'ink', 'roof2', 'cloth3', 'cloth4', 'hairw'], bottoms: ['cloth1', 'ink', 'roof2'], skirts: 0.4 }, 1), rep(9, (i) => mum(2.6 + i * 4.1, 23.6 + (i % 2) * 0.3, 0.38)),
      crowd(-2, 42, 8, 11, 14.5, { y: 36, jitter: 1.4, seed: 20091, skirts: 0.4, arms: 0, tops: ['cloth1', 'ink', 'roof2', 'cloth3', 'cloth4', 'hairw'], bottoms: ['cloth1', 'ink', 'roof2'], hairs: ['ink', 'hair'] }), rep(6, (i) => mum(1.8 + i * 7.2 + (i % 2) * 1.4, 26.4 + (i % 3) * 0.7, 0.5)),
      f.rect(0, 0, 40, 32, 'cloth3', { op: 0.05 }),
    ].join('') },

  // ---------------------------------------------------------------- 2009 아래 — 철거 현장(새)
  { id: 'era-2009-demolition-fire', year: 2009, hCode: 'H-B13', name: '2009년 1월 — 철거 현장의 망루와 연기', kind: 'event', topic: '재난', heavy: true, band: 'low', approved: false, redrawn: false, isNew: true,
    line: '1월, 철거 현장에서 불이 났습니다.',
    draws: '1월 새벽의 재개발 철거 현장 — 창이 뜯긴 건물 옥상에 세운 가설 망루와 거기서 솟아 하늘을 메우는 짙은 연기, 옥상의 먼 인물 셋, 옆에 선 차량 크레인과 공중에 매달린 컨테이너, 물줄기를 쏘아 올리는 물대포 차, 거리의 전경 열(먼 인물 · 내린 방패), 잔해 더미와 가설 울타리, 통제선 뒤에서 바라보는 시민들의 어깨 너머.',
    ft3: '수저 구간 아래(low)에서만 보이는 2009 사건(형진 님 답 「어려우면 재난」). 유지선 ① 불길 속 사람·추락·진압 순간·시신 0 — 망루·연기·장비까지만, 컨테이너는 망루에서 떨어져 공중에 멈춰 있고 물줄기는 사람에 닿지 않는 높이로 간다 ② 실존 인물 0(경찰·철거민은 먼 인물, 얼굴 0) ③ 정당 상징·구호 글자 0(현수막·울타리는 빈 면) ④ 사망자 수·원인·책임 0(한 줄은 사실만). 피해자·유족이 있는 사건 — 판단을 여기와 era-window.md에 적었다. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'far', { op: 0.35 }), skyline(12, false, 'far2', 2009), f.rect(0, 4, 40, 4, 'clay', { op: 0.06 }),
      // 철거 건물(4층 · 창 뜯김) · 옥상 망루 · 연기
      f.rect(5, 9, 19, 15.4, 'wall2'), f.rect(5, 9, 19, 15.4, 'cloth1', { op: 0.12 }), rep(12, (i) => f.rect(6.2 + (i % 4) * 4.6, 10.4 + Math.floor(i / 4) * 3.6, 2.6, 2.2, ['ink', 'far', 'ink', 'roof2'][(i * 3) % 4], { op: 0.75 })), f.rect(4.6, 8.5, 19.8, 0.6, 'roof2'), crack(9.4, 12.6, 5), blank(6, 20.4, 7, 1.6, 'cloth3', { op: 0.8 }),
      smokeMass(13, -3, 22, 8, 16, 20091, 'ink', 0.7), smokeMass(18, -2, 20, 6, 8, 20092, 'roof2', 0.5), plume(15.6, 2.6, 12, 'ink', 0.75), f.rect(0, 0, 40, 7, 'roof2', { op: 0.1 }),
      watchtower(12, 8.5, 5.4, 6.6), flame(14.7, 2.2, 1.6, 1.4), cloud(16.4, 1.4, 1.6, 'ink', 0.7),
      far(10.2, 8.5, 1.8, 'cloth1', 'ink'), far(18.8, 8.5, 1.7, 'roof2', 'ink'), far(20, 8.5, 1.6, 'cloth1', 'hair'),
      // 크레인 + 매달린 컨테이너(오른쪽 · 공중에 멈춤 · 망루와 거리 둠)
      mobileCrane(27, 25, 9, 35, 2.6), hungContainer(35, 2.6, 33.6, 10.2, 5, 2.4, 'cloth4'),
      // 물대포 차(왼쪽) + 물줄기(망루 쪽 높이로)
      waterCannon(-1.4, 25.4, 9, 12.6, 5.4),
      // 거리 — 바닥 · 잔해 · 가설 울타리 · 전경 열(먼 인물)
      f.rect(0, 24.4, 40, 7.6, 'ground2'), f.rect(0, 24.4, 40, 7.6, 'far2', { op: 0.25 }), hoarding(24.2, 24.4, 12, 2.6), rubble(5.4, 22.4, 11, 2.6, 11, 20093), rubble(19, 23, 6, 1.8, 5, 20094), cone(21.6, 26.2), cone(4.2, 26.6),
      riotFar(7.6, 25.6, 12, 1.45, 2.7, 20095),
      // 통제선 · 시민들(어깨 너머 — 외투)
      policeTape(0.8, 27.4, 39.2, 27.4), crowd(-1, 41, 7, 7.6, 10, { y: 33.8, jitter: 1.2, seed: 20096, skirts: 0.3, tops: ['cloth1', 'roof2', 'ink', 'cloth4', 'far', 'hairw'], bottoms: ['cloth1', 'ink'], hats: [{ hat: 'scarf', hatTok: 'cloth3', p: 0.3 }, { hat: 'cap', hatTok: 'ink', p: 0.3 }] }), breath(9, 24.8, 0.6), breath(30, 25.2, 0.5),
    ].join('') },

  // ---------------------------------------------------------------- 2009 위 — 첫 스마트폰(새)
  { id: 'era-2009-first-smartphone', year: 2009, hCode: 'H-C09', name: '2009년 11월 — 손에 든 첫 스마트폰', kind: 'event', topic: '문화', heavy: false, band: 'high', approved: false, redrawn: false, isNew: true,
    line: '첫 스마트폰이 손에 들어왔습니다.',
    draws: '초겨울 저녁의 휴대전화 대리점 앞 — 환한 유리 전면과 빈 간판 띠, 진열대에 세워 둔 똑같은 전화기들과 안의 점원 뒷모습, 문 앞에 선 줄, 앞쪽에서 방금 산 스마트폰을 손에 쥐고 들여다보는 두 사람의 옆모습과 화면의 앱 격자 빛.',
    ft3: '수저 구간 위(high)에서만 보이는 2009 사건(형진 님 답 「잘 살면 스마트폰」). 무겁지 않음(가리기 대상 밖). 사람은 옆모습·뒷모습(얼굴 0). 전화기·간판·화면에 상표·로고·글자 0(앱 격자는 색 네모만). 과시 표현 0 — 물건과 장소만. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.22 }), f.rect(0, 2, 40, 5, 'clay', { op: 0.1 }), skyline(9, true, 'roof2', 20099),
      // 대리점 — 빈 간판 띠 · 유리 전면(환함) · 진열대의 전화기들 · 점원 뒷모습 · 유리문
      f.rect(1.6, 6, 27, 19.6, 'wall2'), blank(1.6, 6, 27, 2.8, 'cloth4'), f.rect(1.6, 8.8, 27, 0.3, 'cloth3', { op: 0.5 }), f.rect(2.2, 9.4, 25.8, 16.2, 'glass'), f.rect(2.2, 9.4, 25.8, 16.2, 'cloth3', { op: 0.35 }), f.circle(15, 17, 15, 'glass', { op: 0.08 }), fluorescent(4, 10.2, 7), fluorescent(13, 10.2, 7), fluorescent(21.6, 10.2, 5),
      f.rect(4.4, 17.4, 18, 0.8, 'hairw'), f.rect(4.8, 18.2, 17.2, 2.6, 'wall2', { op: 0.7 }), rep(6, (i) => smartphone(5.6 + i * 2.9, 14.9, 1.1, { grid: true, halo: false })), far(9.4, 17.2, 4, 'cloth1', 'ink'), far(17.6, 17.2, 4.2, 'cloth3', 'ink'),
      f.rect(22.8, 13.4, 5.2, 12.2, 'roof2', { op: 0.3 }), f.line('M25.4,13.4 V25.6', 0.24, 'roof2'),
      curb(25.6, 'far'), f.rect(0, 26, 40, 6, 'ground2'), f.rect(0, 26, 40, 6, 'cloth1', { op: 0.4 }), lamp(37, 26, 10, true),
      // 문 앞 줄(옆모습 · 가방) · 바깥 입간판(빈 면)
      queue(30.4, 26.6, 4, 6.6, -2.3, { seed: 20098, tops: ['cloth1', 'roof2', 'cloth4', 'hairw'], bottoms: ['cloth1', 'ink'], loads: ['bag'], skirts: 0.4 }, 1), blank(33.4, 22.2, 2.4, 3.6, 'cloth3'), f.rect(34.5, 25.8, 0.2, 0.9, 'roof2'),
      // 앞 — 손에 든 스마트폰(옆모습 둘 · 가까이)
      shadow(7, 32.4, 3.2, 1.4, 0.3), walker(9, 32.6, 12.4, { top: 'cloth1', bottom: 'ink', hair: 'ink' }, 1), smartphone(11.2, 24.6, 1.5), f.line('M10.9,26.6 L11.3,25.9', 0.5, 'cloth1'),
      walker(35, 33, 13, { top: 'roof2', bottom: 'cloth1', skirt: true, hair: 'ink' }, -1), smartphone(31.5, 24.8, 1.6), f.line('M33.3,27 L33,26.2', 0.5, 'roof2'),
      person(20.2, 34.2, 11.6, { top: 'cloth4', bottom: 'cloth1', hair: 'ink', coat: true }), phoneGlow(21.9, 27.6, 0.6, { op: 0.9 }),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.06 }),
    ].join('') },

  // ---------------------------------------------------------------- 2010 — 수색 함정 옆 바다 위
  { id: 'era-2010-west-sea-search', year: 2010, hCode: 'H-B14', name: '2010년 3월 — 서해의 수색', kind: 'event', topic: '재난', heavy: true, approved: false, redrawn: true,
    line: '3월, 서해에서 함정이 침몰했습니다.',
    draws: '잿빛 서해, 수색 보트 위에서 — 바로 옆을 지나는 큰 회색 함정과 갑판의 먼 인물들, 사방의 흰 물마루와 앞바다의 큰 너울, 수면의 주황 부표, 줄을 내린 헬기, 멀리 둘째 함정과 섬, 앞쪽 보트의 조끼 입은 대원들의 뒷모습.',
    ft3: '유지선 ① 두 동강 난 선체·시신·인양 순간 0(수색하는 함정·보트·헬기·파도까지) ② 실존 인물 0(먼 인물·뒷모습) ④ 원인·책임 0(한 줄은 사실만). 함정 번호·휘장·부대 표시 0. 사진 모사 0. r5의 방파제 대신 바다 위로 — 함정이 화면의 2/3, 너울이 앞을 채운다.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'far2'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.22 }), f.rect(0, 0, 40, 10, 'far', { op: 0.25 }), f.line(rep(12, (i) => `M${2 + i * 3.4},${1 + (i % 3)} l-0.5,1.6`), 0.1, 'cloth3', { op: 0.3 }), f.path('M0,10.4 L5,8.8 L11,9.6 L14,9.2 L18,10.4Z', 'far', { op: 0.6 }),
      // 바다 · 물마루
      f.rect(0, 10.2, 40, 21.8, 'far'), f.rect(0, 10.2, 40, 21.8, 'cloth4', { op: 0.38 }), waves(0, 40, 11, 28, 34, 2010, 'cloth3', 0.45, 0.2),
      // 멀리 둘째 함정 · 헬기(줄)
      greyShip(0.6, 12.4, 7), heli(30.6, 5.2, 7, 'roof2', -1), f.line('M30.6,7.4 V13', 0.12, 'ink', { op: 0.6 }), f.circle(30.6, 13.2, 0.36, 'cloth2'),
      // 큰 함정(가운데 오른쪽 · 가까이) · 갑판의 먼 인물
      greyShip(9, 17, 26, 'roof2', 'far2'), rep(5, (i) => far(14 + i * 3.6, 12.9, 1.5, ['cloth1', 'roof2', 'cloth2', 'cloth1', 'roof2'][i], 'roof2')), f.rect(9.4, 18.2, 25, 0.6, 'cloth3', { op: 0.5 }), spray(22, 18.9, 26, 0.4),
      // 부표 · 가운데 보트
      rep(4, (i) => f.circle(6 + i * 9, 20.2 + (i % 2) * 1.8, 0.45, 'clay')), boat(27, 22, 6.4, 'hairw'), far(29.2, 21.7, 2.3, 'cloth2', 'roof2'), far(31.2, 21.8, 2.1, 'cloth2', 'roof2'), f.line('M33.6,22.8 q1.2,0.5 2.6,0', 0.2, 'cloth3', { op: 0.6 }),
      // 앞 너울 · 앞 보트(대원 뒷모습 · 조끼)
      swell(-3, 25.6, 24, 'cloth4', 'cloth3'), swell(14, 27.4, 30, 'cloth4', 'cloth3'), f.rect(0, 28.6, 40, 3.4, 'far', { op: 0.35 }),
      boat(1, 28.4, 13, 'cloth2'), f.rect(2.2, 26.4, 1.1, 1.1, 'cloth3'), person(5.2, 28.6, 4.6, { top: 'cloth2', bottom: 'cloth1', hat: 'helmet', hatTok: 'cloth3' }), person(8.4, 28.4, 4.8, { top: 'cloth2', bottom: 'cloth1', hat: 'helmet', hatTok: 'cloth3', arm: 'upR' }), person(11.4, 28.7, 4.4, { top: 'cloth2', bottom: 'ink', hair: 'ink' }), f.circle(3.2, 29.8, 0.6, 'cloth3'), f.circle(3.2, 29.8, 0.32, 'clay'),
      spray(8, 31.4, 16, 0.4), f.rect(0, 0, 40, 32, 'far', { op: 0.06 }),
    ].join('') },

  // ---------------------------------------------------------------- 2014 — 기운 선체 가까이
  { id: 'era-2014-tilted-ferry-ribbons', year: 2014, hCode: 'H-B08', name: '2014년 4월 — 기울어진 배와 노란 리본', kind: 'event', topic: '재난', heavy: true, approved: false, redrawn: true,
    line: '4월, 남쪽 바다에서 배가 기울었습니다.',
    draws: '흐린 남쪽 바다 — 화면의 절반을 차지하며 옆으로 크게 기울어 반쯤 잠긴 흰 여객선, 그 둘레에 바짝 붙은 구조 보트들(조끼 입은 대원)과 줄을 내린 헬기 둘, 선체 둘레의 물보라, 앞쪽 항구 난간에 빼곡히 묶인 노란 리본, 난간 앞에 선 사람들의 어깨 너머.',
    ft3: '마스터 결정(2026-10-28): 기울어진 배·바다·구조 현장에 노란 리본. 유지선 ① 선내·실종자·구조되는 사람 0(선체 바깥과 보트·헬기까지 — 선체 위의 사람 0) ② 얼굴 0(뒷모습·먼 인물) ④ 사망자 수·책임 0(한 줄은 사실만). 선사 이름·선명·번호 0. 피해자·유족이 있는 사건 — 판단을 여기와 era-window.md에 적었다. 사진 모사 0. r5보다 선체가 2배 가깝고 보트가 둘레에 붙는다.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'far2'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.2 }), f.rect(0, 0, 40, 9, 'far', { op: 0.18 }), f.path('M0,9.4 L4,8.2 L8,8.8 L10,8.4 L13,9.4Z', 'far', { op: 0.6 }),
      // 바다 · 기울어진 배(크게 · 가까이) · 물보라 · 바다 띠로 잠김
      f.rect(0, 9.2, 40, 15.8, 'cloth4'), f.rect(0, 9.2, 40, 15.8, 'far', { op: 0.4 }), waves(0, 40, 10, 14, 10, 2014, 'cloth3', 0.4),
      ferry(5, 17, 28, 46), f.rect(0, 19.2, 40, 6, 'cloth4'), f.rect(0, 19.2, 40, 6, 'far', { op: 0.4 }), spray(16, 19.3, 20, 0.6), waves(0, 40, 20, 24, 14, 20141, 'cloth3', 0.45),
      // 구조 보트(둘레에 바짝) · 헬기 둘(줄)
      boat(3, 17.4, 4.2, 'cloth2'), far(4.6, 17.2, 1.5, 'cloth2', 'roof2'), boat(24.6, 18.2, 4.6, 'cloth2'), far(26.4, 18, 1.6, 'cloth2', 'roof2'), far(27.8, 18.1, 1.5, 'cloth2', 'roof2'),
      boat(9, 20.4, 5.6, 'hairw'), far(11.2, 20.1, 2, 'cloth2', 'roof2'), far(13, 20.2, 1.9, 'cloth2', 'roof2'), f.line('M14.8,21 q1.4,0.6 3,0.1', 0.2, 'cloth3', { op: 0.6 }), boat(28, 21.6, 6.4, 'cloth2'), far(30.4, 21.3, 2.3, 'cloth2', 'roof2'), far(32.6, 21.4, 2.1, 'cloth2', 'roof2'), f.line('M34.8,22.3 q1.4,0.6 3,0.1', 0.2, 'cloth3', { op: 0.6 }),
      heli(12, 4.6, 6.4, 'roof2', 1), f.line('M12,6.8 V11.6', 0.12, 'ink', { op: 0.6 }), heli(30, 6.6, 5.6, 'roof2', -1), f.line('M30,8.6 V13.4', 0.12, 'ink', { op: 0.6 }),
      // 항구 난간(앞) + 노란 리본 빼곡 · 바닥
      f.rect(0, 25, 40, 7, 'ground2'), f.rect(0, 24.6, 40, 0.6, 'wall2'), f.line('M0,21.8 H40 M0,23.3 H40', 0.22, 'roof2'), f.line(rep(11, (i) => `M${i * 4 + 0.6},24.6 v-3.2`), 0.24, 'roof2'),
      rep(30, (i) => ribbon(0.7 + i * 1.34, 23 + (i % 3) * 0.4, 1 + (i % 2) * 0.2)),
      // 사람들(어깨 너머 · 크게)
      crowd(-2, 42, 7, 11, 14, { y: 36, jitter: 1.4, seed: 20142, skirts: 0.35, tops: ['cloth1', 'roof2', 'cloth4', 'cloth3', 'far', 'ink'], bottoms: ['cloth1', 'ink', 'roof2'], hairs: ['ink', 'hair'] }), rep(3, (i) => f.circle(13.4 + i * 1.6, 24.2, 0.34, 'cloth3') + f.circle(13.4 + i * 1.6, 24.2, 0.14, 'cloth2')),
    ].join('') },

  // ---------------------------------------------------------------- 2016 — 겨울 촛불 군중 속
  { id: 'era-2016-candle-winter', year: 2016, hCode: 'H-B09', name: '2016년 겨울 — 광장의 촛불', kind: 'event', topic: '정치', heavy: true, approved: false, redrawn: true,
    line: '겨울 밤마다 광장에 촛불이 모였습니다.',
    draws: '한겨울 밤, 촛불 군중 한가운데 — 바로 앞의 두꺼운 외투와 목도리·털모자, 손마다 종이컵 촛불과 입김, 어깨 위의 아이, 빈 피켓들, 끝이 보이지 않는 촛불의 바다(세 겹), 빈 무대 화면과 불 켜진 빌딩, 흩날리는 눈.',
    ft3: '유지선 ③ 정당 상징·구호 글자 0(피켓·무대 화면·현수막은 빈 면) ② 실존 인물 0(뒷모습·먼 인물) ① 충돌 순간 0 ④ 평가어 0(한 줄은 사실만). 사진 모사 0. r5보다 카메라를 군중 안으로 — 앞줄 키 12~16, 입김·눈.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'ink', { op: 0.3 }), tower(0, 13.6, 7, 14, 'roof2', { night: true, op: 0.45 }), tower(7.6, 13.6, 9, 11, 'roof2', { night: true, op: 0.45 }), tower(17.2, 13.6, 6, 13, 'roof2', { night: true, op: 0.45 }), tower(23.8, 13.6, 8.6, 15, 'roof2', { night: true, op: 0.45 }), tower(33, 13.6, 7, 12, 'roof2', { night: true, op: 0.45 }),
      f.rect(13.6, 6.6, 12.8, 7, 'ink'), f.rect(14, 7, 12, 6.2, 'glass', { op: 0.55 }), f.rect(14, 7, 12, 6.2, 'cloth4', { op: 0.3 }), lamp(4.6, 13.6, 7, true), lamp(35.4, 13.6, 7, true),
      // 촛불 바다 — 세 겹 + 번짐
      nightRoad(13.6, 18.4), f.rect(0, 13.6, 40, 18.4, 'cloth1', { op: 0.2 }), mass(0, 14, 40, 3, 0.7), f.fill(0, 13.8, 40, 3.4, 'era-cups', { op: 0.85 }), mass(0, 17, 40, 3, 0.8), f.fill(0, 16.8, 40, 3.2, 'era-cups', { op: 0.9 }), f.rect(0, 13.6, 40, 7, 'glass', { op: 0.1 }),
      rep(14, (i) => far(0.4 + i * 2.9 + (i % 2) * 0.5, 22 + (i % 3) * 0.35, 3.9, ['cloth1', 'roof2', 'cloth4', 'ink', 'far', 'clay'][i % 6], 'ink') + candle(0.95 + i * 2.9 + (i % 2) * 0.5, 20.2 + (i % 3) * 0.35, 0.44)),
      candleCrowd(-1, 41, 13, 5.8, 8, { y: 27.4, jitter: 1.2, seed: 2016, skirts: 0.2, coat: 0.7, tops: ['cloth1', 'roof2', 'ink', 'cloth4', 'far', 'clay'], bottoms: ['cloth1', 'ink', 'roof2'], hats: [{ hat: 'scarf', hatTok: 'cloth3', p: 0.3 }, { hat: 'cap', hatTok: 'cloth1', p: 0.3 }] }),
      blank(6.4, 18.2, 3.2, 2.1, 'cloth3'), f.line('M8,20.3 V23.4', 0.18, 'wood'), blank(29.6, 17.8, 3.2, 2.1, 'cloth3'), f.line('M31.2,19.9 V23', 0.18, 'wood'),
      // 앞 군중(크게 · 외투 · 털모자 · 입김) · 어깨 위 아이
      candleCrowd(-2, 42, 7, 12, 16, { y: 36.8, jitter: 1.5, seed: 20161, skirts: 0.15, coat: 0.85, tops: ['cloth1', 'roof2', 'ink', 'cloth4', 'far', 'clay'], bottoms: ['cloth1', 'ink', 'roof2'], hats: [{ hat: 'scarf', hatTok: 'cloth3', p: 0.35 }, { hat: 'cap', hatTok: 'cloth1', p: 0.35 }] }),
      shouldered(11.6, 36.4, 13.4, { top: 'roof2', bottom: 'cloth1', hair: 'ink', coat: true }, { top: 'clay', hat: 'cap', hatTok: 'cloth3' }), candle(12.8, 24.2, 0.55),
      breath(5.8, 22.4, 0.7, 0.35), breath(22, 21.6, 0.7, 0.35), breath(34.6, 22.6, 0.6, 0.35),
      rep(30, (i) => f.circle((i * 9.7) % 40, (i * 5.3) % 32, 0.22, 'cloth3', { op: 0.7 })),
    ].join('') },

  // ---------------------------------------------------------------- 2017 — 무너진 외벽 앞
  { id: 'era-2017-quake-street', year: 2017, hCode: 'H-B15', name: '2017년 11월 — 지진 뒤의 골목', kind: 'event', topic: '재난', heavy: true, approved: false, redrawn: true,
    line: '11월, 경북에서 큰 지진이 났습니다.',
    draws: '지진 이튿날, 필로티 빌라 바로 앞 — 화면 왼쪽을 채운 빌라의 1층 기둥들, 그중 하나는 콘크리트가 떨어져 나가 철근이 드러났고, 벽을 타고 내려온 큰 균열, 떨어진 외장 벽돌이 앞에 쌓인 더미와 먼지, 벽돌이 얹힌 승용차, 통제선과 고깔, 담요를 두르고 서 있는 주민들의 어깨 너머와 아이, 오른쪽 멀리 금 간 둘째 빌라.',
    ft3: '유지선 ① 무너지는 순간·매몰·부상 0(이튿날의 금 간 건물·떨어진 벽돌·골목까지) ② 실존 인물 0(뒷모습) ④ 원인·책임 0(한 줄은 사실만). 건물·차에 이름·번호 0. 사진 모사 0. r5보다 빌라가 2배 — 기둥 하나의 파손과 벽돌 더미가 앞에 온다.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'far2', { op: 0.3 }), hills(8, 'far2', 'far'),
      // 둘째 빌라(오른쪽 멀리 · 금) · 담
      f.rect(29, 10, 11, 10, 'wall2'), rep(6, (i) => f.rect(30 + (i % 3) * 3.4, 11 + Math.floor(i / 3) * 3.6, 2, 1.8, 'glass')), f.rect(28.6, 9.5, 11.8, 0.5, 'roof2'), rep(3, (i) => f.rect(30.2 + i * 4, 17, 0.9, 3, 'far')), crack(33.4, 11.2, 6, 0.14), f.rect(26.4, 15.2, 3, 4.8, 'wall2'), f.fill(26.4, 15.2, 3, 4.8, 'era-stones', { op: 0.5 }),
      // 큰 필로티 빌라(왼쪽 · 가까이) — 기둥 하나 파손(철근) · 벽의 균열 · 벽돌 떨어진 자리
      pilotiNear(-2, 20, 28, 20, 5), f.fill(-2, 0, 28, 13, 'era-stones', { op: 0.35 }),
      // 외장 벽돌이 떨어져 나간 자리(맨 벽 · 들쭉날쭉한 가장자리) · 큰 균열
      f.poly([[2.4, 2.6], [10.8, 2.2], [11.6, 6.4], [9.2, 7], [9.8, 9.6], [3.2, 10.2], [2, 6.4]], 'wall'), f.poly([[14.2, 7.4], [21, 7], [21.6, 12.6], [15, 13]], 'wall', { op: 0.9 }), crack(6.4, 3, 7, 0.2), crack(19, 1.2, 10, 0.18),
      // 파손된 기둥(콘크리트 떨어짐 · 철근 노출) · 기둥 앞으로 기운 외벽 조각
      f.rect(11.9, 13, 1.6, 7, 'far'), f.poly([[11.9, 15], [13.5, 14.6], [13.7, 17.2], [11.7, 17.6]], 'ground2'), f.line('M12.2,15 l0.2,2.4 M12.8,14.9 l-0.1,2.5 M13.3,14.8 l0.1,2.3', 0.14, 'ink'), f.poly([[11.6, 16.9], [13.9, 16.4], [14.2, 20], [11.4, 20]], 'far', { op: 0.5 }),
      f.poly([[14.8, 20.4], [23.6, 15.2], [25, 16.6], [16.4, 21.6]], 'wall2'), f.fillPath('M14.8,20.4 L23.6,15.2 L25,16.6 L16.4,21.6Z', 'era-stones', { op: 0.6 }),
      // 골목 바닥 · 벽돌 더미(앞 크게) · 먼지 · 차(벽돌 얹힘)
      f.rect(0, 20, 40, 12, 'ground2'), f.rect(0, 20, 40, 12, 'far2', { op: 0.25 }), rubble(1, 21.6, 18, 4.4, 30, 2017, ['clay', 'clay', 'wall2', 'ground2']), cloud(8, 20.4, 2.2, 'ground2', 0.3), cloud(17, 21.8, 1.4, 'ground2', 0.25),
      car(23, 26.2, 7.4, 'far', 1), f.rect(24, 23.8, 6, 0.6, 'ground2', { op: 0.7 }), rep(4, (i) => f.rect(24.4 + i * 1.4, 23.3, 1, 0.5, 'clay', { tr: `rotate(${(i * 23) % 30 - 15} ${24.9 + i * 1.4} ${23.5})` })),
      cone(20.4, 27), cone(31.6, 26.6), policeTape(0.8, 24.8, 21.6, 24.8), f.rect(33.6, 22.2, 0.3, 3, 'roof2'),
      // 주민들(어깨 너머 · 담요 = 외투) · 아이 · 구급차 멀리
      ambulance(34, 21.4, 5.2, 1), crowd(-2, 42, 7, 10.5, 14, { y: 35.6, jitter: 1.4, seed: 20171, skirts: 0.3, tops: ['clay', 'cloth4', 'roof2', 'cloth3', 'cloth1', 'hairw'], bottoms: ['cloth1', 'ink', 'roof2'], hairs: ['ink', 'hair'] }), person(17.6, 31.4, 6.6, { top: 'hairw', bottom: 'cloth1', hair: 'ink' }),
      f.rect(0, 0, 40, 32, 'ground2', { op: 0.06 }),
    ].join('') },

  // ---------------------------------------------------------------- 2022 — 그날 밤 골목 입구에서
  { id: 'era-2022-alley-tape-flowers', year: 2022, hCode: 'H-B10', name: '2022년 10월 — 밤의 좁은 비탈 골목', kind: 'event', topic: '재난', heavy: true, approved: false, redrawn: true,
    line: '10월, 좁은 골목에서 참사가 났습니다.',
    draws: '그날 밤, 좁은 비탈 골목 입구에서 — 양쪽으로 바짝 붙은 건물과 빈 간판의 불빛, 위로 오르며 좁아지는 비탈을 메운 인파의 뒷모습(모두 서 있다), 왼쪽 아래 멈춘 구급차의 경광등과 벽을 붉고 푸르게 물들이는 빛, 앞쪽에 선 사람들의 어깨 너머.',
    ft3: '유지선 ① 넘어짐·압박·구조 순간·시신 0 — 서 있는 인파와 경광등 빛까지, 사람 사이에 간격을 두어 눌림을 그리지 않았다(형진 님 답 「그날 밤 … 압박의 순간은 그리지 않는다」) ② 실존 인물 0(뒷모습·먼 인물) ④ 사망자 수·책임 0(한 줄은 사실만). 간판·가게 이름·글자 0(빈 면). 피해자·유족이 있는 사건 — 판단을 여기와 era-window.md에 적었다. 사진 모사 0. r5의 「이튿날 낮의 꽃」을 「그날 밤의 골목」으로 바꿨다.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'ink', { op: 0.35 }),
      // 양쪽 건물(가깝게 · 어둡게) · 켜진 창 · 빈 간판 불빛
      f.rect(0, 0, 13.4, 24, 'roof2'), f.fill(0.6, 0.8, 12.2, 12, 'era-lit', { op: 0.35 }), f.rect(26.6, 0, 13.4, 24, 'roof2'), f.rect(26.6, 0, 13.4, 24, 'cloth1', { op: 0.3 }), f.fill(27.2, 1.2, 12.2, 11.6, 'era-lit', { op: 0.3 }),
      rep(3, (i) => blank(1 + i * 4.2, 14 + (i % 2) * 2.2, 3.4, 1.4, ['glass', 'clay', 'cloth4'][i]) + f.rect(1 + i * 4.2, 14 + (i % 2) * 2.2, 3.4, 1.4, 'glass', { op: 0.25 })), rep(3, (i) => blank(27.4 + i * 4.2, 13.4 + (i % 2) * 2.4, 3.4, 1.4, ['cloth4', 'glass', 'green'][i]) + f.rect(27.4 + i * 4.2, 13.4 + (i % 2) * 2.4, 3.4, 1.4, 'glass', { op: 0.25 })),
      f.rect(1, 18.6, 11.6, 5.4, 'glass', { op: 0.25 }), f.rect(27.4, 18.4, 11.6, 5.6, 'glass', { op: 0.2 }),
      // 비탈(위로 좁아짐) · 인파 — 위는 패턴, 가운데 먼 인물, 아래 뒷모습(간격 둠)
      f.poly([[13.4, 24], [26.6, 24], [23.4, 0], [16.6, 0]], 'ground2'), f.poly([[13.4, 24], [26.6, 24], [23.4, 0], [16.6, 0]], 'cloth1', { op: 0.45 }),
      f.fillPath('M14.2,24 L25.8,24 L22.8,2 L17.2,2Z', 'era-mass', { op: 0.9 }), f.fillPath('M15.4,24 L24.6,24 L22.4,8 L17.6,8Z', 'era-mass', { op: 0.9 }),
      rep(8, (i) => far(15.6 + (i % 4) * 2.7 + Math.floor(i / 4) * 0.6, 14.2 + Math.floor(i / 4) * 2.6, 2.6 + Math.floor(i / 4) * 0.6, ['cloth1', 'roof2', 'clay', 'cloth4', 'hairw', 'ink', 'cloth3', 'far'][i], 'ink')),
      crowd(13.8, 26.2, 7, 4.6, 6, { y: 24.2, jitter: 0.9, seed: 2022, skirts: 0.4, tops: ['cloth1', 'roof2', 'clay', 'cloth4', 'hairw', 'ink', 'cloth3'], bottoms: ['cloth1', 'ink', 'roof2'], hairs: ['ink', 'hair'] }),
      // 경광등 빛(벽을 물들임) · 구급차(왼쪽 아래 잘림) · 오른쪽 경찰차 경광등
      glow(6, 20, 9, 'clay', 0.16), glow(16, 21, 7, 'clay', 0.1), glow(31, 19, 8, 'cloth4', 0.16), f.rect(0, 10, 13.4, 14, 'clay', { op: 0.08 }), f.rect(26.6, 10, 13.4, 14, 'cloth4', { op: 0.08 }),
      f.rect(0, 24, 40, 8, 'roof2'), f.rect(0, 24, 40, 8, 'ink', { op: 0.3 }), ambulance(-4, 31, 11, 1), lightbar(0.2, 25.4, 3.2), f.rect(34, 26, 8, 3.2, 'cloth1', { rx: 0.4 }), lightbar(36, 25.4, 2.6), f.circle(36.2, 30.4, 0.6, 'ink'),
      // 앞 사람들(어깨 너머 · 크게 · 간격)
      shadow(8, 34, 3, 1.4, 0.3), crowd(4, 36, 5, 11, 14.5, { y: 36.4, jitter: 1.2, seed: 20221, skirts: 0.4, tops: ['cloth1', 'roof2', 'clay', 'cloth4', 'ink', 'hairw'], bottoms: ['cloth1', 'ink', 'roof2'], hairs: ['ink', 'hair'] }),
      f.rect(0, 0, 40, 32, 'ink', { op: 0.05 }),
    ].join('') },
];

export const HEAVY5B = S5B.filter((q) => q.heavy);
export const REDRAWN = S5B.filter((q) => q.redrawn);
export const NEW2009 = S5B.filter((q) => q.isNew);
