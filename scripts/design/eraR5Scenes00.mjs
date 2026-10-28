/**
 * 시대의 창 r5 — 2000년대 13장: 사건 8(2000 피시방 · 2001 폴더 휴대전화 · 2002 거리 응원 · ○ 2003 지하철역 입구의 연기 · 2004 고속열차 승강장 · 2005~06 부동산 유리창 · ○ 2008 여름밤 촛불 · ○ 2009 5월 광장의 조문 줄)
 * + 일상 3(미니홈피 방 · 분식집 · 편의점 밤 근무) + 계층 변주 2(고시원 / 학원가의 밤). designer 2026-10-28. 톤 A 2000년대 = 디지털(망점·종이 겹 0).
 * 수위 「현장까지, 순간은 그리지 않는다」 · 얼굴 0 · 글자·상호·로고 0(화면·전광판·피켓·쪽지는 빈 면) · 사진 모사 0. 2009는 5월 광장의 조문 줄로 그렸다(영정·이름·장례 행렬 0 — 1979 선례; 1월 참사로 바꿀지는 형진 님께).
 */
import { f, rep, shadow, person, walker, crouch, sitter, far, crowd, queue, mass, building, shops, lamp, cloud, plume, bicycle, taegeuk, tower, aptSlab, skyline, nightRoad, curb, blank, shelter, subwayEntrance, tent, policeTape, cone, streetTree, crt, lcd, laptop, desk, cubicle, kiosk, shelf, box, ambulance, fireEngine, car, van, bus, scooter, folderPhone, phoneGlow, flowers, ribbon, candle, candleCrowd, halfMast, seatedBacks, windowNight, fluorescent, clock, sofa, plant, bulletTrain } from './eraR5Lib.mjs';

/** 응원 깃발(태극기 작은 것) 든 팔은 person carry 'flag' */
/** 디지털카메라(작은 상자 + 렌즈) */
const digicam = (x, y, s = 1) => f.rect(x, y, s * 1.4, s * 0.9, 'hairw', { rx: 0.1 }) + f.circle(x + s * 0.7, y + s * 0.45, s * 0.3, 'ink');
/** 떡볶이 철판(김) */
const griddle = (x, y, w) => f.rect(x, y, w, 1.2, 'roof2', { rx: 0.2 }) + f.rect(x + 0.3, y + 0.2, w - 0.6, 0.7, 'clay') + rep(Math.floor(w / 0.8), (i) => f.rect(x + 0.5 + i * 0.8, y + 0.3, 0.45, 0.5, 'cloth3', { rx: 0.15 })) + cloud(x + w * 0.35, y - 1.6, 0.9, 'cloth3', 0.35) + cloud(x + w * 0.7, y - 2, 0.7, 'cloth3', 0.3);

export const S00 = [
  { id: 'era-2000-pc-bang', year: 2000, hCode: 'H-C06', name: '2000년 — 피시방', kind: 'event', topic: '문화', heavy: false, approved: false,
    line: '피시방에서 밤새 게임을 했습니다.',
    draws: '어두운 피시방 — 칸막이 책상에 줄지어 선 모니터의 빛, 헤드폰을 쓰고 앉은 사람들의 뒷모습, 컵라면과 음료, 천장의 어두운 조명, 카운터의 작은 빛.',
    ft3: '사람은 뒷모습(얼굴 0). 화면·간판에 게임 이름·상표·글자 0(빛만). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'ink', { op: 0.35 }), f.rect(0, 20, 40, 12, 'roof2', { op: 0.3 }),
      // 뒤 줄(작게) · 앞 줄(크게) — 칸막이 책상 · 모니터 빛 · 앉은 뒷모습(헤드폰)
      rep(6, (i) => cubicle(1 + i * 6.6, 14.8, 6.2, 2.2, 'roof2') + crt(2.4 + i * 6.6, 12.6, 2.8, 'hairw') + f.circle(3.8 + i * 6.6, 12.4, 2.6, 'glass', { op: 0.12 })), seatedBacks(3.4, 17.6, 6, 6.6, 4.4, ['cloth1', 'roof2', 'cloth4', 'far', 'ink', 'cloth3'], ['ink', 'hair'], 2001), rep(6, (i) => f.rect(2.8 + i * 6.6, 14.1, 1.3, 0.5, 'ink', { rx: 0.25 })),
      rep(4, (i) => cubicle(-1 + i * 10.6, 24.4, 10, 3.4, 'roof2') + crt(1.2 + i * 10.6, 21, 4.4, 'hairw') + f.circle(3.4 + i * 10.6, 20.4, 4, 'glass', { op: 0.12 })), seatedBacks(3.6, 29.6, 4, 10.6, 7.4, ['cloth4', 'cloth1', 'roof2', 'hairw'], ['ink', 'hair', 'ink', 'ink'], 2002), rep(4, (i) => f.rect(2.6 + i * 10.6, 23, 2, 0.7, 'ink', { rx: 0.35 })),
      // 컵라면 · 음료 · 바닥 · 카운터 빛
      rep(3, (i) => f.rect(6.4 + i * 10.6, 22.4, 1.1, 1.2, 'cloth3', { rx: 0.15 }) + f.rect(6.3 + i * 10.6, 22.3, 1.3, 0.3, 'clay')), f.rect(8.6, 22.6, 0.6, 1, 'cloth4'), f.rect(29.6, 22.6, 0.6, 1, 'green'),
      f.rect(36.6, 6, 3.4, 8.8, 'roof2'), f.rect(37, 6.4, 2.6, 3, 'glass', { op: 0.5 }), rep(5, (i) => f.circle(4 + i * 8, 1.6, 0.5, 'clay', { op: 0.5 })),
      f.rect(0, 0, 40, 32, 'cloth4', { op: 0.06 }),
    ].join('') },

  { id: 'era-2001-folder-phones-stop', year: 2001, hCode: 'H-C07', name: '2001년 — 정류장의 폴더 휴대전화', kind: 'event', topic: '문화', heavy: false, approved: false,
    line: '버스를 기다리며 휴대전화를 열었습니다.',
    draws: '저녁 버스 정류장 — 유리 셸터 아래 앉고 선 사람들이 저마다 폴더 휴대전화를 열어 보고, 다가오는 시내버스, 빈 간판의 상가와 가로등, 손 안의 작은 화면 빛.',
    ft3: '사람은 옆모습·뒷모습(얼굴 0). 휴대전화·버스·간판에 상표·번호·글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth1', { op: 0.3 }), f.rect(0, 4, 40, 4, 'clay', { op: 0.1 }), skyline(11, true, 'roof2', 2001),
      f.rect(0, 9, 40, 10.4, 'far'), f.rect(0, 9, 40, 10.4, 'cloth1', { op: 0.45 }), f.fill(0.6, 9.8, 38.8, 4.6, 'era-lit', { op: 0.35 }), rep(4, (i) => blank(1 + i * 10, 15, 7.6, 1.6, ['cloth4', 'roof2', 'clay', 'far'][i]) + f.rect(1 + i * 10, 16.8, 7.6, 2.6, 'glass', { op: 0.5 })),
      curb(19.4, 'far'), nightRoad(19.8, 12.2), f.rect(0, 19.8, 40, 5.2, 'ground2'), f.rect(0, 19.8, 40, 5.2, 'cloth1', { op: 0.4 }), lamp(3, 19.8, 9, true),
      // 셸터 · 앉은 둘(옆모습 · 폴더폰) · 선 사람들(옆모습 · 폴더폰)
      shelter(6, 25, 15, 7), sitter(10.2, 25, 5.6, { top: 'cloth3', bottom: 'cloth1' }, 1, 2.4), folderPhone(12, 22.2, 0.55), sitter(16, 25, 5.4, { top: 'clay', bottom: 'ink', hair: 'ink' }, -1, 2.4), folderPhone(14.3, 22.3, 0.5),
      walker(24.4, 25.2, 7.4, { top: 'cloth1', bottom: 'roof2', hair: 'ink' }, -1), folderPhone(22.9, 21.6, 0.6), walker(29.4, 25.4, 7.8, { top: 'cloth4', bottom: 'cloth1', skirt: true }, -1), folderPhone(27.8, 21.6, 0.6),
      // 다가오는 버스(오른쪽, 도로)
      bus(27, 31.6, 15, 'cloth4'), f.rect(27, 28.6, 15, 0.4, 'roof2', { op: 0.5 }), f.circle(28.2, 29.6, 0.5, 'glass'), f.circle(28.2, 29.6, 1.6, 'glass', { op: 0.2 }),
      // 앞 보도의 둘(뒷모습 · 손의 빛)
      person(4.6, 31.6, 9.2, { top: 'cloth1', bottom: 'ink', hair: 'ink', coat: true }), phoneGlow(6.3, 26.6, 0.5), person(37.6, 31.8, 8.8, { top: 'roof2', bottom: 'cloth1', skirt: true, hair: 'ink' }), phoneGlow(39.1, 27.2, 0.5),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.08 }),
    ].join('') },

  { id: 'era-2002-street-cheering', year: 2002, hCode: 'H-C08', name: '2002년 6월 — 거리 응원', kind: 'event', topic: '스포츠', heavy: false, approved: false,
    line: '거리마다 붉은 옷이 모여 응원했습니다.',
    draws: '초여름 밤의 광장 — 같은 색 옷을 입은 군중의 뒷모습이 빌딩의 큰 화면(빈 빛)을 향해 팔을 들고, 태극기 몇 개, 머리띠, 불 켜진 빌딩과 가로등.',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0). 화면·옷·머리띠에 글자·휘장·상표 0(붉은 옷은 토큰 clay). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.25 }),
      tower(0, 18, 8, 15, 'roof2', { night: true, op: 0.5 }), tower(8.6, 18, 7, 12, 'roof2', { night: true, op: 0.5 }), tower(29, 18, 6, 13, 'roof2', { night: true, op: 0.5 }), tower(35.6, 18, 4.4, 16, 'roof2', { night: true, op: 0.5 }),
      // 가운데 빌딩의 큰 화면(빈 빛)
      tower(15.6, 18, 13.4, 17, 'roof2', { night: true, op: 0.3 }), f.rect(16.6, 3, 11.4, 8, 'ink'), f.rect(17, 3.4, 10.6, 7.2, 'glass'), f.rect(17, 3.4, 10.6, 7.2, 'green', { op: 0.45 }), f.rect(17, 6.4, 10.6, 4.2, 'green', { op: 0.3 }), f.circle(22.3, 7, 7, 'glass', { op: 0.1 }),
      lamp(13.4, 18, 8, true), lamp(31, 18, 8, true),
      // 광장 바닥 · 군중(붉은 옷 = clay · 팔 든 사람 · 머리띠 · 태극기)
      nightRoad(18, 14), mass(0, 18.4, 40, 3.4, 0.8), f.rect(0, 18.4, 40, 3.4, 'clay', { op: 0.3 }),
      rep(11, (i) => far(0.6 + i * 3.8 + (i % 2) * 0.5, 22.6 + (i % 3) * 0.3, 3.6, ['clay', 'clay', 'cloth3', 'clay', 'roof2'][i % 5], 'ink')),
      crowd(-1, 41, 13, 5.6, 8.8, { y: 32.8, jitter: 1.5, seed: 2002, arms: 0.6, skirts: 0.25, tops: ['clay', 'clay', 'clay', 'cloth3', 'clay', 'ink'], bottoms: ['cloth1', 'ink', 'roof2'], hairs: ['ink', 'hair'], hats: [{ hat: 'band', hatTok: 'clay', p: 0.5 }], carry: ['flag'] }),
    ].join('') },

  { id: 'era-2003-subway-entrance-smoke', year: 2003, hCode: 'H-B07', name: '2003년 2월 — 지하철역 입구의 연기', kind: 'event', topic: '재난', heavy: true, approved: false,
    line: '지하철역에서 큰불이 났습니다.',
    draws: '겨울 한낮의 도심 네거리 — 지하철역 입구 계단에서 솟는 검은 연기, 호스를 끌고 들어가는 소방관들의 뒷모습, 소방차와 구급차, 통제선 뒤에서 지켜보는 시민들, 멈춘 차들.',
    ft3: '유지선 ① 역 안·시신·화상·구조되는 사람 0(입구와 연기, 진입하는 소방관까지) ② 실존 인물 0(뒷모습·헬멧) ④ 원인·책임·사망자 수 0(한 줄은 사실만). 역명·글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'far2', { op: 0.3 }), tower(0, 17.6, 9, 14, 'far', { op: 0.45 }), tower(9.6, 17.6, 7, 11, 'far2', { op: 0.45 }), tower(24, 17.6, 8, 12, 'far', { op: 0.45 }), tower(32.6, 17.6, 7.4, 15, 'far2', { op: 0.45 }), f.rect(16.8, 9.6, 7, 8, 'wall2'), f.fill(17.2, 10.2, 6.2, 7, 'era-windows', { op: 0.5 }),
      curb(17.6), f.rect(0, 18, 40, 14, 'ground'), f.rect(0, 18, 40, 14, 'far2', { op: 0.25 }), f.rect(0, 24.6, 40, 7.4, 'ground2'), f.line('M0,28.4 H40', 0.3, 'cloth3', { dash: '2.2 1.8', op: 0.5 }),
      // 역 입구 + 검은 연기 기둥(굵게, 오른쪽 위로)
      subwayEntrance(14, 24, 10, 3.6), plume(18.4, 20.6, 15, 'ink', 0.7), plume(21.6, 20.8, 11, 'roof2', 0.55), cloud(17, 16.4, 2.4, 'ink', 0.5), cloud(25, 12, 3, 'roof2', 0.4),
      // 소방차 · 구급차 · 호스 · 소방관(뒷모습 · 헬멧 · 입구로)
      fireEngine(27, 24.4, 12, -1), ambulance(1.2, 24.2, 7.4, 1), f.line('M27.6,23.6 Q22,22.8 20,23.8', 0.42, 'clay'), f.line('M27.6,23.6 Q22,22.8 20,23.8', 0.18, 'cloth3', { op: 0.5 }),
      person(19.2, 24.2, 4.2, { top: 'clay', bottom: 'clay', hat: 'helmet', hatTok: 'cloth2' }), person(21.6, 24.6, 4.4, { top: 'clay', bottom: 'clay', hat: 'helmet', hatTok: 'cloth2', arm: 'upL' }), walker(24.6, 25.2, 4.6, { top: 'clay', bottom: 'clay', hat: 'helmet', hatTok: 'cloth2' }, -1),
      cone(12.6, 25.2), cone(26.2, 26.4), f.rect(10, 20.4, 0.3, 3.4, 'roof2'), car(6, 31.4, 6.2, 'far', 1), car(33, 31.6, 6, 'cloth1', -1),
      // 통제선 + 시민(뒷모습)
      policeTape(1.4, 27.4, 38.6, 27.4), crowd(-1, 41, 9, 5.2, 7.6, { y: 32.8, jitter: 1.2, seed: 2003, skirts: 0.3, tops: ['cloth1', 'roof2', 'cloth4', 'hairw', 'clay', 'far'], bottoms: ['cloth1', 'ink'], hats: [{ hat: 'scarf', hatTok: 'cloth3', p: 0.25 }] }),
    ].join('') },

  { id: 'era-2004-ktx-platform', year: 2004, hCode: 'H-S15', name: '2004년 4월 — 고속열차 승강장', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '고속열차가 다니기 시작했습니다.',
    draws: '역 승강장 — 유선형 머리의 고속열차가 멈춰 서고, 캐리어와 가방을 든 승객들이 문 앞에 줄을 서고, 높은 지붕의 철골과 빈 안내판, 승강장 끝의 밝은 하늘.',
    ft3: '사람은 옆모습·뒷모습(얼굴 0). 열차·안내판에 로고·역명·글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'far2', { op: 0.25 }),
      // 지붕 철골 · 기둥 · 빈 안내판
      f.rect(0, 0, 40, 4.6, 'far'), f.line(rep(9, (i) => `M${i * 5},4.6 l2.5,-3.2 l2.5,3.2`), 0.22, 'roof2'), f.rect(0, 4.4, 40, 0.5, 'roof2'), f.rect(5, 4.9, 0.7, 13, 'far'), f.rect(33, 4.9, 0.7, 13, 'far'), blank(16, 6.6, 8, 2.2, 'cloth1'), f.rect(16, 6.6, 8, 2.2, 'glass', { op: 0.2 }),
      // 열차(오른쪽으로 머리) · 승강장 · 노란 선
      f.rect(0, 17.8, 40, 14.2, 'ground'), f.rect(0, 17.8, 40, 14.2, 'far2', { op: 0.3 }), f.fill(0, 17.8, 40, 14.2, 'era-tiles', { op: 0.25 }), f.rect(0, 24.6, 40, 0.5, 'cloth2'),
      f.rect(0, 17.2, 40, 0.8, 'roof2'), bulletTrain(-2, 17.2, 44, 'cloth4'), f.rect(24.6, 13.4, 2, 3.8, 'glass', { op: 0.3 }),
      // 승객 줄(옆모습 · 캐리어·가방) · 뒤의 먼 인물
      rep(4, (i) => far(29 + i * 2.6, 20.4, 3.2, ['cloth3', 'cloth1', 'hairw', 'clay'][i], 'ink')),
      queue(4, 27.6, 5, 6.4, 3.6, { seed: 2004, tops: ['cloth1', 'cloth3', 'cloth4', 'clay', 'hairw'], bottoms: ['cloth1', 'ink', 'roof2'], loads: ['bag', 'box'], skirts: 0.4 }, 1), rep(3, (i) => f.rect(6.2 + i * 7.2, 25, 1.8, 2.6, ['roof2', 'clay', 'cloth4'][i], { rx: 0.3 }) + f.line(`M${7.1 + i * 7.2},25 V24`, 0.2, 'ink')),
      person(30.2, 31.6, 9.4, { top: 'cloth3', bottom: 'cloth1', hair: 'ink', bag: 'clay' }), f.rect(33.2, 27.4, 2.4, 3.4, 'cloth4', { rx: 0.3 }), f.line('M34.4,27.4 V26.2', 0.22, 'ink'), person(36.8, 31.4, 8.8, { top: 'clay', bottom: 'ink', skirt: true }),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.04 }),
    ].join('') },

  { id: 'era-2005-realty-window', year: 2005, years: [2005, 2006], hCode: 'H-E09', name: '2005~06년 — 부동산 유리창 앞', kind: 'event', topic: '경제', heavy: false, approved: false,
    line: '부동산 유리창 앞에 사람들이 섰습니다.',
    draws: '아파트 단지 상가의 부동산 — 빈 종이가 빼곡히 붙은 유리창 앞에 선 사람들의 뒷모습, 안에서 전화를 받는 사람, 옆 가게들, 단지 안쪽의 아파트 동과 모델하우스 깃발(빈 천).',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0). 유리창 종이·간판·깃발에 글자·숫자·상호 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), aptSlab(1, 13, 10, 12, 'wall2', 7), aptSlab(13, 13, 9, 10, 'far2', 6), aptSlab(30, 13, 9.6, 13, 'wall2', 7), rep(3, (i) => f.line(`M${24 + i * 1.6},13 V7`, 0.16, 'roof2') + f.rect(24 + i * 1.6, 7, 1.2, 2.2, ['cloth3', 'clay', 'cloth4'][i])),
      // 상가 1층 · 부동산 유리창(빈 종이) · 옆 가게
      f.rect(0, 13, 40, 8.6, 'wall'), f.rect(0, 12.6, 40, 0.8, 'roof2'), blank(1.5, 13.6, 10, 1.6, 'cloth4'), blank(13.6, 13.6, 13, 1.6, 'green'), blank(28.4, 13.6, 10, 1.6, 'clay'),
      f.rect(13.6, 15.6, 13, 6, 'wood'), f.rect(14, 16, 12.2, 5.2, 'glass'), rep(21, (i) => blank(14.4 + (i % 7) * 1.7, 16.4 + Math.floor(i / 7) * 1.6, 1.4, 1.2, 'cloth3')), far(20, 21.2, 3.6, 'cloth3', 'ink'),
      f.rect(1.5, 15.6, 10, 6, 'glass', { op: 0.6 }), f.rect(28.4, 15.6, 10, 6, 'glass', { op: 0.6 }), f.rect(29, 16.2, 8.8, 5, 'cloth4', { op: 0.15 }),
      curb(21.6), f.rect(0, 22, 40, 10, 'ground'), f.fill(0, 22, 40, 10, 'era-tiles', { op: 0.3 }),
      // 유리창 앞 사람들(뒷모습 · 유리창을 봄) · 자전거 · 화분
      shadow(15.2, 27.6, 2.6, 1, 0.3), person(16.4, 27.8, 7.4, { top: 'cloth1', bottom: 'roof2', hair: 'ink', coat: true }), person(19.6, 28.2, 8, { top: 'cloth3', bottom: 'cloth1', skirt: true }), person(22.8, 27.6, 7.2, { top: 'clay', bottom: 'ink', hair: 'ink', bag: 'roof2' }), person(25.6, 28.4, 7.8, { top: 'cloth4', bottom: 'cloth1', coat: true }),
      person(6.4, 31.4, 9.2, { top: 'hairw', bottom: 'cloth1', hair: 'ink', skirt: true }), walker(34.6, 31.6, 9.4, { top: 'roof2', bottom: 'ink' }, -1), bicycle(9.6, 25.4, 2.8), plant(29.6, 24.6, 3.6),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.04 }),
    ].join('') },

  { id: 'era-2008-candle-summer', year: 2008, hCode: 'H-B13', name: '2008년 여름 — 광장의 촛불', kind: 'event', topic: '정치', heavy: true, approved: false,
    line: '여름밤, 광장에 촛불이 켜졌습니다.',
    draws: '초여름 밤의 광장 — 종이컵 촛불을 든 군중의 뒷모습이 광장을 메우고, 유모차와 아이 손을 잡은 어른, 빈 피켓, 불 켜진 빌딩과 가로등, 멀리 경찰 버스의 줄(접촉 0).',
    ft3: '유지선 ③ 정당 상징·구호 글자 0(피켓·현수막은 빈 면) ② 실존 인물 0(뒷모습·먼 인물) ① 충돌·연행 순간 0(경찰 버스는 멀리 줄만) ④ 평가어 0(한 줄은 사실만). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.3 }), tower(0, 15, 9, 13, 'roof2', { night: true, op: 0.45 }), tower(9.6, 15, 8, 10, 'roof2', { night: true, op: 0.45 }), tower(18.4, 15, 10, 14, 'roof2', { night: true, op: 0.45 }), tower(29.2, 15, 10.8, 12, 'roof2', { night: true, op: 0.45 }),
      // 멀리 경찰 버스 줄 · 광장 바닥
      rep(5, (i) => f.rect(1 + i * 8, 15.6, 7.2, 2.2, 'cloth4', { rx: 0.3 }) + f.rect(1.4 + i * 8, 16, 6.4, 0.9, 'glass', { op: 0.5 })), lamp(5.6, 17.8, 7, true), lamp(34.4, 17.8, 7, true),
      nightRoad(17.8, 14.2), f.rect(0, 17.8, 40, 14.2, 'cloth1', { op: 0.2 }),
      // 촛불 바다(뒤 띠 = 패턴) → 먼 인물 → 촛불 든 앞 군중
      mass(0, 18.4, 40, 3.2, 0.75), f.fill(0, 18, 40, 3.8, 'era-cups', { op: 0.9 }), rep(10, (i) => far(1 + i * 4.1 + (i % 2) * 0.6, 22.8 + (i % 3) * 0.3, 3.6, ['cloth3', 'cloth4', 'hairw', 'clay', 'cloth1'][i % 5], 'ink') + candle(1.5 + i * 4.1 + (i % 2) * 0.6, 21.2 + (i % 3) * 0.3, 0.42)),
      candleCrowd(-1, 41, 11, 5.6, 8.6, { y: 32.6, jitter: 1.4, seed: 2008, skirts: 0.35, tops: ['cloth3', 'cloth4', 'hairw', 'cloth1', 'clay', 'roof2'], bottoms: ['cloth1', 'ink', 'roof2', 'far'] }),
      // 유모차 · 아이 · 빈 피켓
      f.rect(26.4, 27.6, 2.6, 2, 'cloth4', { rx: 0.5 }), f.line('M29,27.6 L30.2,25.4', 0.2, 'ink'), f.circle(26.8, 30.2, 0.55, 'ink'), f.circle(28.6, 30.2, 0.55, 'ink'), person(31.6, 30.4, 3.8, { top: 'hairw', bottom: 'cloth1' }), blank(10.6, 20.4, 3.2, 2, 'cloth3'), f.line('M12.2,22.4 V25', 0.18, 'wood'),
    ].join('') },

  { id: 'era-2009-square-mourning-queue', year: 2009, hCode: 'H-B13', name: '2009년 5월 — 광장의 조문 줄', kind: 'event', topic: '정치', heavy: true, approved: false,
    line: '5월, 광장에 조문 줄이 길었습니다.',
    draws: '5월의 시청 앞 광장 — 조기가 걸린 건물, 흰 국화를 든 긴 줄의 뒷모습, 노란 리본이 매달린 가로수와 난간, 국화 더미가 쌓인 천막(영정 자리 없음), 빈 쪽지들, 경찰 버스 없이 열린 길.',
    ft3: '유지선 ② 실존 인물 얼굴·이름·영정·장례 행렬 0(1979 선례 — 조기와 시민의 줄까지) ③ 정당 상징·구호 글자 0(쪽지·현수막은 빈 면) ④ 평가어 0(한 줄은 사실만). 사진 모사 0. 2009를 1월 참사로 바꿀지는 형진 님께(시트 물음).',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.15 }), tower(0, 15.6, 10, 12, 'far', { op: 0.45 }), tower(10.6, 15.6, 7, 9, 'far2', { op: 0.45 }), f.rect(18, 7, 12, 8.6, 'wall2'), f.fill(18.6, 7.8, 10.8, 7, 'era-windows', { op: 0.5 }), f.path('M17.4,7 L30.6,7 L29.4,5 L18.6,5Z', 'roof2'), tower(30.6, 15.6, 9.4, 13, 'far', { op: 0.45 }),
      halfMast(13.2, 15.6, 12, 2.2), halfMast(34.4, 15.6, 12, 2.2), halfMast(24, 5, 4, 2),
      // 광장 · 가로수 + 노란 리본 · 난간 리본
      curb(15.6), f.rect(0, 16, 40, 16, 'ground'), f.fill(0, 16, 40, 16, 'era-tiles', { op: 0.25 }), streetTree(4, 16.6, 10), streetTree(36.4, 16.6, 10), rep(6, (i) => ribbon(2.4 + (i % 3) * 1.6, 10.2 + Math.floor(i / 3) * 1.4, 0.9)), rep(6, (i) => ribbon(34.8 + (i % 3) * 1.6, 10.2 + Math.floor(i / 3) * 1.4, 0.9)),
      f.line('M0,21.6 H12', 0.3, 'roof2'), f.line(rep(5, (i) => `M${1.2 + i * 2.6},21.6 v2`), 0.2, 'roof2'), rep(5, (i) => ribbon(1.2 + i * 2.6, 23.2, 0.7)),
      // 천막(국화 더미 · 빈 쪽지) · 줄
      tent(21, 22.8, 13, 6, 'cloth3'), f.rect(21.6, 18, 11.8, 0.3, 'roof2', { op: 0.4 }), flowers(22, 21.2, 11, 22, 2009), rep(8, (i) => blank(21.8 + (i % 4) * 2.9, 17.4 + Math.floor(i / 4) * 1.2, 2.2, 0.9, 'cloth3', { op: 0.9 })),
      queue(19.8, 25.4, 8, 5, -2.4, { seed: 2009, tops: ['cloth1', 'ink', 'roof2', 'cloth3', 'far'], bottoms: ['cloth1', 'ink'], loads: [], skirts: 0.4 }, 1), rep(8, (i) => f.circle(20.4 - i * 2.4, 22.8 + (i % 2) * 0.2, 0.32, 'cloth3') + f.line(`M${20.4 - i * 2.4},23.1 v0.8`, 0.1, 'green')),
      crowd(-1, 41, 10, 6, 8.6, { y: 32.8, jitter: 1.3, seed: 20091, skirts: 0.4, arms: 0, tops: ['cloth1', 'ink', 'roof2', 'cloth3', 'cloth4', 'hairw'], bottoms: ['cloth1', 'ink', 'roof2'], hairs: ['ink', 'hair'] }), rep(6, (i) => f.circle(2.4 + i * 7 + (i % 2) * 1.2, 26.4 + (i % 3) * 0.6, 0.42, 'cloth3') + f.circle(2.4 + i * 7 + (i % 2) * 1.2, 26.4 + (i % 3) * 0.6, 0.16, 'cloth2')),
      f.rect(0, 0, 40, 32, 'cloth3', { op: 0.05 }),
    ].join('') },

  // ---------------------------------------------------------------- 일상
  { id: 'era-2000s-minihompy-room', year: 2007, years: [2000, 2009], hCode: 'H-C13', name: '미니홈피 — 방의 모니터 앞', kind: 'daily', topic: '생활', heavy: false, ageBand: '청소년·청년(13~29)', approved: false,
    line: '미니홈피 배경음악을 골랐습니다.',
    draws: '밤의 작은 방 — 모니터 안의 작은 창틀(빈 칸들), 책상의 디지털카메라와 머그잔, 앉은 뒷모습, 벽의 사진 끈(빈 사진), 침대와 스탠드, 창밖 어둠.',
    ft3: '사람은 뒷모습(얼굴 0). 화면·사진·책등에 글자·서비스 이름·얼굴 0(화면 안 창틀은 빈 칸). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth4', { op: 0.08 }), f.rect(0, 21, 40, 11, 'wood'), f.fill(0, 21, 40, 11, 'era-planks', { op: 0.3 }),
      // 창(밤) · 사진 끈(빈 사진) · 침대 · 스탠드
      windowNight(26, 3, 10, 9), f.rect(25.6, 2.6, 10.8, 0.5, 'wood'), f.rect(25.6, 12, 10.8, 0.5, 'wood'), f.line('M31,3 V12 M26,7.5 H36', 0.26, 'wood'),
      f.line('M2,4.4 Q12,6.2 22,4.4', 0.12, 'ink'), rep(6, (i) => blank(3 + i * 3.3, 5 + Math.abs(i - 2.5) * -0.3 + 0.8, 2.2, 1.7, 'cloth3') + f.rect(3.3 + i * 3.3, 5.9 + Math.abs(i - 2.5) * -0.3 + 0.8, 1.6, 0.7, ['cloth4', 'green', 'clay', 'far', 'cloth2', 'cloth4'][i], { op: 0.6 })),
      f.rect(26, 23, 13, 5, 'cloth4', { rx: 0.5 }), f.rect(26, 22, 13, 1.6, 'cloth3', { rx: 0.4 }), f.rect(34.4, 20.6, 4, 2, 'hairw', { rx: 0.5 }), f.rect(26, 28, 13, 1.6, 'wood'),
      f.rect(22.6, 15.6, 0.3, 5.6, 'roof2'), f.path('M20.6,15.8 L24.8,15.8 L24.2,13.2 L21.2,13.2 Z', 'cloth3'), f.circle(22.7, 16.4, 2.6, 'glass', { op: 0.16 }),
      // 책상 · 모니터(미니홈피 창틀 = 빈 칸) · 디지털카메라 · 머그잔 · 앉은 뒷모습
      desk(3, 23.4, 18, 3.4), lcd(6.4, 20.6, 7.2, 'cloth4'), f.rect(7.2, 16.2, 5.6, 3.4, 'cloth3', { rx: 0.2 }), f.rect(7.5, 16.5, 2.2, 1.6, 'far2'), f.rect(10, 16.5, 2.5, 0.7, 'far2'), f.rect(10, 17.5, 2.5, 0.6, 'far2'), f.rect(7.5, 18.4, 5, 0.9, 'far2'), f.fill(7.2, 16.2, 5.6, 3.4, 'era-grid', { op: 0.35 }),
      f.rect(14.6, 19.6, 4.4, 0.4, 'roof2'), rep(3, (i) => f.rect(15 + i * 1.3, 19.1, 1, 0.5, 'hairw')), digicam(15.4, 21.4, 1.1), f.rect(18.2, 21.2, 1.3, 1.4, 'clay', { rx: 0.2 }),
      f.rect(7.4, 24.6, 5.4, 1, 'roof2', { rx: 0.4 }), far(10, 28.6, 7.2, 'cloth3', 'ink'), f.rect(6.8, 28.2, 6.4, 1.4, 'cloth1', { rx: 0.5 }), f.line('M10,29.6 V31.2 M7.6,31.6 H12.4', 0.4, 'roof2'),
      f.rect(0, 0, 40, 32, 'cloth4', { op: 0.03 }),
    ].join('') },

  { id: 'era-2000s-tteokbokki-stand', year: 2007, years: [2000, 2009], hCode: null, name: '학교 앞 분식집', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '학교 앞 분식집에서 떡볶이를 먹었습니다.',
    draws: '하굣길 분식집 앞 — 김 오르는 떡볶이 철판과 어묵 솥, 책가방을 멘 아이들의 뒷모습, 접시를 건네는 주인의 뒷모습, 포장마차 천막과 빈 메뉴판, 뒤의 학교 담.',
    ft3: '사람은 뒷모습·옆모습(얼굴 0). 메뉴판·간판에 글자·가격 0(빈 판). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 11.6, 40, 7, 'wall2'), f.rect(0, 11.6, 40, 0.5, 'roof2'), f.fill(0, 12.6, 40, 5.6, 'era-stones', { op: 0.3 }), f.rect(0, 18.6, 40, 13.4, 'ground'), f.fill(0, 18.6, 40, 13.4, 'era-tiles', { op: 0.3 }), streetTree(36, 12, 11),
      // 포장마차(천막 · 빈 메뉴판 · 철판 · 어묵 솥 · 꼬치)
      tent(5, 23.4, 24, 9.2, 'clay'), f.rect(5.2, 14.8, 23.6, 0.3, 'cloth3', { op: 0.6 }), blank(8, 15.8, 5.2, 2.6, 'cloth3'), blank(14, 15.8, 5.2, 2.6, 'cloth3'), blank(20, 15.8, 5.2, 2.6, 'cloth3'),
      f.rect(5.6, 22.4, 22.8, 1.2, 'roof2'), f.rect(5.6, 23.6, 22.8, 1.6, 'wall2'), griddle(7, 21, 9), f.rect(18.2, 20.2, 6, 2.2, 'roof2', { rx: 0.3 }), f.rect(18.6, 20.6, 5.2, 0.6, 'clay'), rep(5, (i) => f.line(`M${19.2 + i * 1.1},20.4 V18.2`, 0.14, 'wood') + f.rect(19 + i * 1.1, 18.2, 0.5, 1.4, 'hairw', { rx: 0.2 })), cloud(21, 18, 0.8, 'cloth3', 0.35),
      far(14, 21.2, 4.6, 'cloth3', 'hair'), f.rect(25.4, 21.4, 2.2, 0.5, 'hairw'), f.rect(25.6, 20.9, 1.8, 0.5, 'clay'),
      // 아이들(뒷모습 · 책가방) · 접시 · 어묵 국물 컵
      shadow(7.4, 30.4, 2.2, 1, 0.3), person(8.6, 30.6, 6.8, { top: 'cloth3', bottom: 'cloth1', hair: 'ink', bag: 'clay' }), person(12.6, 31.2, 7.2, { top: 'cloth4', bottom: 'cloth1', skirt: true, hair: 'ink', bag: 'cloth2' }), person(17, 30.8, 6.4, { top: 'hairw', bottom: 'roof2', bag: 'cloth4' }), person(21.4, 31.4, 7, { top: 'clay', bottom: 'cloth1', hair: 'ink', bag: 'roof2' }), person(25.6, 30.6, 6.6, { top: 'cloth3', bottom: 'ink', skirt: true, bag: 'clay' }),
      rep(3, (i) => f.rect(9.6 + i * 6.2, 25.2, 1.2, 0.5, 'cloth3') + f.rect(9.8 + i * 6.2, 24.9, 0.8, 0.3, 'clay')), f.rect(23, 24.8, 0.7, 0.9, 'cloth3'), walker(33, 31, 8.2, { top: 'cloth1', bottom: 'roof2', hair: 'ink', load: 'bag' }, -1),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.04 }),
    ].join('') },

  { id: 'era-2000s-night-convenience', year: 2007, years: [2000, 2009], hCode: null, name: '편의점 — 밤 근무', kind: 'daily', topic: '생활', heavy: false, ageBand: '청년(20~29)', approved: false,
    line: '편의점 밤 근무를 섰습니다.',
    draws: '새벽 두 시의 편의점 — 환한 유리 전면과 진열대, 카운터에 선 사람의 뒷모습과 바코드 기계, 전자레인지, 바깥의 어두운 거리와 가로등, 유리문 앞의 손님 하나.',
    ft3: '사람은 뒷모습·옆모습(얼굴 0). 간판·상품·광고에 상표·글자 0(색 상자만). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.3 }), nightRoad(24, 8), lamp(36.4, 24, 9, true),
      // 편의점 — 빈 간판 띠 · 유리 전면(환함) · 진열대 · 카운터 · 유리문
      f.rect(1, 4, 31, 20, 'wall2'), blank(1, 4, 31, 2.8, 'green'), f.rect(1, 6.8, 31, 0.3, 'cloth3', { op: 0.5 }), f.rect(1.6, 7.4, 29.8, 16.6, 'glass'), f.rect(1.6, 7.4, 29.8, 16.6, 'cloth3', { op: 0.3 }), f.circle(16.5, 15, 16, 'glass', { op: 0.08 }),
      fluorescent(4, 8, 8), fluorescent(14, 8, 8), fluorescent(23.6, 8, 6), shelf(2.4, 10, 9.6, 9.2, 4), shelf(13, 10, 7.4, 9.2, 4), f.rect(21.6, 10.4, 8.8, 4.2, 'far', { rx: 0.2 }), rep(4, (i) => f.rect(22 + i * 2.2, 10.8, 1.8, 3.4, ['cloth3', 'glass', 'cloth4', 'cloth3'][i], { op: 0.8 })),
      f.rect(21, 17.6, 9.6, 2.4, 'wall2'), f.rect(21, 17.4, 9.6, 0.5, 'roof2'), f.rect(27.8, 15.4, 2.4, 2, 'roof2', { rx: 0.2 }), f.rect(28.1, 15.7, 1.8, 1.2, 'glass', { op: 0.6 }), f.rect(22, 16.2, 2.2, 1.3, 'ink', { rx: 0.2 }), f.rect(24.6, 16.6, 1.2, 1, 'hairw'),
      far(25.8, 21.4, 5.2, 'cloth4', 'ink'), f.rect(23.2, 20.4, 5.2, 1.3, 'cloth2', { op: 0.6, rx: 0.3 }),
      f.rect(2.4, 19.6, 4.4, 4.4, 'roof2', { op: 0.25 }), f.line('M4.6,19.6 V24', 0.2, 'roof2'),
      // 보도 · 유리문 앞 손님(옆모습) · 바깥 자전거·상자
      f.rect(0, 24, 40, 8, 'ground2'), f.rect(0, 24, 40, 8, 'cloth1', { op: 0.4 }), curb(24, 'far'), walker(6.8, 31, 8.4, { top: 'cloth1', bottom: 'ink', hair: 'ink' }, 1), box(33.2, 27.6, 2.6, 1.8), box(33.6, 25.8, 2, 1.6, 'cloth4'), bicycle(13, 30.4, 3),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.06 }),
    ].join('') },

  // ---------------------------------------------------------------- 계층 변주(2000년대 — 아래 / 위)
  { id: 'era-2000s-low-goshiwon', year: 2005, years: [2000, 2009], hCode: null, name: '고시원 — 책상과 침대만 있는 방', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', band: 'low', approved: false,
    line: '고시원 방에 책상과 침대만 있었습니다.',
    draws: '좁은 고시원 방 — 벽에 붙은 책상과 스탠드, 그 아래 밀어 넣은 의자, 한 뼘 남은 통로 너머 침대, 벽걸이 옷 셋, 손바닥만 한 창, 열린 문 밖 복도의 똑같은 문들과 공용 주방의 밥솥, 책상 앞에 앉은 뒷모습.',
    ft3: '계층 변주(아래). 사람은 뒷모습(얼굴 0). 낙인·조롱·불결 강조 0 — 정돈된 방(개킨 이불·가지런한 신발·책), 글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall2'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.3 }), f.rect(0, 21.4, 40, 10.6, 'ground'), f.rect(0, 21.4, 40, 10.6, 'cloth2', { op: 0.12 }), f.fill(0, 21.4, 40, 10.6, 'era-planks', { op: 0.25 }),
      // 왼쪽 벽 · 작은 창 · 책상 + 스탠드 + 책 + 의자 · 앉은 뒷모습
      f.rect(0, 0, 23, 21.4, 'wall'), f.rect(2.6, 4.2, 3.6, 2.8, 'wood'), f.rect(3, 4.6, 2.8, 2, 'glass'), f.rect(3, 4.6, 2.8, 2, 'cloth4', { op: 0.3 }),
      f.rect(0.6, 8, 10.4, 6.6, 'wood'), f.rect(1, 8.4, 9.6, 2.6, 'wall2'), rep(8, (i) => f.rect(1.4 + i * 1.15, 8.6 + (i % 3) * 0.2, 0.8, 2.2 - (i % 3) * 0.2, ['cloth4', 'clay', 'green', 'cloth1', 'roof2', 'cloth2', 'far', 'cloth4'][i])), f.rect(1, 11.4, 9.6, 2.8, 'wall2'), rep(2, (i) => f.rect(1.6 + i * 3.6, 11.8, 3, 2, 'cloth3', { rx: 0.1 })),
      desk(0.6, 21.4, 10.6, 4.4, 'wood'), f.rect(8.2, 13.6, 0.3, 3.4, 'roof2'), f.path('M6.8,13.8 L9.6,13.8 L9.2,12.2 L7.2,12.2 Z', 'cloth3'), f.circle(8.2, 14.4, 2.2, 'glass', { op: 0.18 }), f.rect(1.6, 16.2, 2.8, 0.9, 'cloth3'), f.rect(1.6, 15.6, 2.8, 0.6, 'cloth4'),
      f.rect(2.8, 22.6, 5.2, 1.1, 'cloth1', { rx: 0.4 }), far(5.4, 26.6, 7.2, 'cloth3', 'ink'), f.line('M5.4,27.4 V29.6 M3.2,30 H7.6', 0.4, 'roof2'),
      // 통로 · 침대(개킨 이불) · 벽걸이 옷 · 슬리퍼
      f.rect(11.6, 15, 10.8, 6.4, 'cloth4', { rx: 0.3 }), f.rect(11.6, 14.6, 10.8, 0.6, 'wood'), f.rect(12, 12.4, 4.2, 2.6, 'cloth3', { rx: 0.3 }), f.rect(16.6, 12.6, 5.4, 2.4, 'clay', { rx: 0.3 }), f.rect(11.6, 21.4, 10.8, 0.9, 'wood'),
      f.line('M12.4,3.4 H21.6', 0.2, 'wood'), rep(3, (i) => f.rect(13 + i * 3, 3.6, 2.2, 5.2 + (i % 2) * 1.2, ['cloth1', 'cloth3', 'roof2'][i], { rx: 0.3 })), f.rect(13, 30.4, 1, 0.5, 'ink', { rx: 0.2 }), f.rect(14.2, 30.4, 1, 0.5, 'ink', { rx: 0.2 }),
      // 열린 문 · 복도의 문들 · 공용 주방(밥솥 · 싱크대)
      f.rect(23, 0, 1, 21.4, 'wood'), f.rect(24, 0, 16, 21.4, 'far2'), f.rect(24, 21.4, 16, 10.6, 'ground2', { op: 0.4 }), rep(3, (i) => f.rect(25.2 + i * 4.3, 4.6, 3.2, 16.8, 'wood') + f.rect(25.5 + i * 4.3, 5, 2.6, 16, 'wall2') + f.circle(27.6 + i * 4.3, 13.6, 0.22, 'ink')),
      f.rect(37.6, 13, 2.4, 8.4, 'wall2'), f.rect(37.6, 12.6, 2.4, 0.6, 'roof2'), f.ellipse(38.8, 11.8, 0.9, 0.7, 'hairw'), f.rect(38.3, 10.9, 1, 0.3, 'roof2'), f.line('M24.6,8 H37', 0.5, 'glass', { op: 0.5 }),
      f.rect(0, 0, 40, 32, 'cloth2', { op: 0.03 }),
    ].join('') },

  { id: 'era-2000s-high-hagwon-street', year: 2005, years: [2000, 2009], hCode: null, name: '학원가의 밤 — 셔틀과 승용차 줄', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', band: 'high', approved: false,
    line: '밤 열 시 학원가에 차가 줄을 섰습니다.',
    draws: '밤 열 시의 학원가 — 층마다 불 켜진 건물들과 빈 간판, 건물 앞에 늘어선 학원 셔틀버스와 데리러 온 승용차 줄, 가방을 메고 나오는 아이들의 뒷모습, 횡단보도와 가로등.',
    ft3: '계층 변주(위). 사람은 뒷모습·옆모습(얼굴 0). 과시·조롱 0 — 거리와 차·건물만. 간판·차에 학원 이름·글자·번호 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.3 }),
      // 학원 건물(층마다 환한 창 · 빈 간판 띠)
      rep(4, (i) => { const x = i * 10 - 0.5, w = 9.6, h = 15 + (i % 2) * 2.4; return f.rect(x, 18 - h, w, h, 'far') + rep(Math.floor(h / 3), (k) => f.rect(x + 0.5, 18 - h + 0.8 + k * 3, w - 1, 1.9, 'glass', { op: 0.85 }) + blank(x + 0.5, 18 - h + 2.7 + k * 3, w - 1, 0.7, ['cloth4', 'clay', 'green', 'cloth1'][(i + k) % 4])); }),
      curb(18, 'far'), nightRoad(18.4, 13.6), lamp(2.4, 18.4, 8, true), lamp(37.6, 18.4, 8, true), f.rect(0, 18.4, 40, 2.6, 'ground2'), f.rect(0, 18.4, 40, 2.6, 'cloth1', { op: 0.4 }),
      // 셔틀버스 둘(노란) · 승용차 줄 · 횡단보도
      van(2, 24.2, 10, 'cloth2', 1), van(13.4, 24.2, 10, 'cloth2', 1), rep(3, (i) => car(25 + i * 5.4, 24.2, 5, ['hairw', 'cloth1', 'far'][i], 1)), rep(6, (i) => f.rect(6 + i * 5, 26.4, 2.4, 4.2, 'cloth3', { op: 0.5 })),
      // 나오는 아이들(뒷모습 · 가방) · 기다리는 어른
      person(4.8, 31.4, 7.2, { top: 'cloth3', bottom: 'cloth1', hair: 'ink', bag: 'roof2' }), person(9.6, 31.8, 7.6, { top: 'cloth4', bottom: 'ink', skirt: true, hair: 'ink', bag: 'clay' }), person(16.2, 31.2, 7, { top: 'hairw', bottom: 'cloth1', bag: 'cloth4' }), walker(23.4, 31.6, 7.4, { top: 'cloth1', bottom: 'roof2', hair: 'ink', load: 'bag' }, 1),
      person(31.2, 31.6, 8.8, { top: 'roof2', bottom: 'cloth1', coat: true }), person(36.4, 31.2, 8.4, { top: 'cloth3', bottom: 'ink', skirt: true, hair: 'ink' }),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.08 }),
    ].join('') },
];
