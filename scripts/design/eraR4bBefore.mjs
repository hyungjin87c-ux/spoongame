/**
 * 시대의 창 r4b — 보강 **전** 그림 네 장의 사본(designer 2026-10-28). r4b 시트(`buildEraWindowR4b.mjs`)가 전·후를 나란히 보이려고만 쓴다 — 조각 파일로 쓰지 않는다.
 * 형진 님 결정(2026-10-28 「세 곳 더 현실적으로 후 승인」): ① 1961 새벽 거리의 탱크에 멀리서 바라보는 출근길 시민 ② 1958 보릿고개에 빈 밥상과 나물 캐는 아이들 ③ 계층 변주 아래쪽(1970년대 셋방 · 1980년대 반지하)에 그 집의 현실(습기 자국·곰팡이 얼룩·쌓인 이불·창 밖 행인의 발).
 * 아래 네 함수는 커밋 db20523의 `eraR4Scenes50.mjs`·`eraR4Scenes60.mjs`·`eraR4ScenesBand.mjs`에서 그대로 옮겼다(고치지 않는다).
 */
import { f, rep, shadow, smoke, person, walker, crouch, far, soldierLine, building, shops, lamp, hills, farChogas, bareTree, papers } from './eraR4Lib.mjs';

const kerosene = (x, yBase, w = 3.2) => { const h = w * 0.9; return f.rect(x, yBase - h, w, h, 'roof2', { rx: 0.3 }) + f.rect(x + w * 0.1, yBase - h * 0.55, w * 0.8, h * 0.3, 'ink', { rx: 0.2 }) + f.rect(x + w * 0.2, yBase - h * 0.52, w * 0.6, h * 0.14, 'clay') + f.circle(x + w + 0.3, yBase - h * 0.42, 0.32, 'hairw') + f.ellipse(x + w / 2, yBase - h, w * 0.5, 0.2, 'hairw') + f.rect(x + w * 0.08, yBase - h - 1.6, w * 0.84, 1.6, 'hairw', { rx: 0.15 }) + f.ellipse(x + w / 2, yBase - h - 1.6, w * 0.42, 0.22, 'cloth3') + f.line(`M${x + w * 0.92},${yBase - h - 1.2} h1.2`, 0.22, 'ink'); };
const tank = (x, yBase, w = 11) => { const h = w * 0.3; return f.rect(x, yBase - h * 0.7, w, h * 0.7, 'ink', { rx: h * 0.3 }) + rep(5, (i) => f.circle(x + w * 0.12 + i * w * 0.19, yBase - h * 0.35, h * 0.2, 'far')) + f.poly([[x + w * 0.04, yBase - h * 0.7], [x + w * 0.14, yBase - h * 1.15], [x + w * 0.9, yBase - h * 1.15], [x + w, yBase - h * 0.7]], 'green') + f.rect(x + w * 0.34, yBase - h * 1.65, w * 0.34, h * 0.55, 'green', { rx: 0.4 }) + f.line(`M${(x + w * 0.36).toFixed(1)},${(yBase - h * 1.45).toFixed(1)} L${(x - w * 0.1).toFixed(1)},${(yBase - h * 2.1).toFixed(1)}`, h * 0.12, 'roof2'); };

export const BEFORE = {
  'era-1958-barley-spring': {
    draws: '아직 푸른 보리밭과 밭둑 — 호미로 나물을 캐는 여인 둘(쪼그림), 바구니를 든 아이, 둑길을 가는 지게꾼, 멀리 초가 마을과 산, 봄 하늘.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'glass', { op: 0.1 }), hills(9, 'far', 'far2'), farChogas(11.6, 5, 2, 7.5),
      f.rect(0, 13.6, 40, 18.4, 'ground'), f.poly([[0, 13.6], [40, 13.6], [40, 19.6], [0, 23.8]], 'green', { op: 0.55 }), f.line(rep(9, (i) => `M0,${14.6 + i * 1.05}L40,${14.2 + i * 0.6}`), 0.22, 'green', { op: 0.6 }),
      f.poly([[0, 26.4], [40, 22], [40, 32], [0, 32]], 'green', { op: 0.5 }), f.line(rep(7, (i) => `M0,${27.4 + i * 0.8}L40,${23 + i * 1.3}`), 0.26, 'green', { op: 0.6 }),
      f.poly([[0, 24], [40, 19.6], [40, 22], [0, 26.4]], 'ground2', { op: 0.7 }),
      walker(31.6, 21.4, 4.6, { top: 'cloth3', bottom: 'cloth3', load: 'jige', hat: 'cap', hatTok: 'cloth3' }, -1), bareTree(37.4, 20.2, 6), rep(5, (i) => f.circle(37.4 + ((i * 1.3) % 3) - 1.4, 15.6 + (i % 2), 0.55, 'green', { op: 0.8 })),
      shadow(8.6, 28.8, 3, 1.2, 0.3), crouch(10, 28.8, 6.2, { top: 'hairw', bottom: 'cloth1', hat: 'scarf', hatTok: 'cloth3' }), f.line('M12.2,25.4 L13.6,26.8', 0.3, 'wood'), f.ellipse(14.6, 28.6, 1.4, 0.7, 'wood'), f.ellipse(14.6, 28.1, 1, 0.35, 'green'),
      crouch(23.4, 31.2, 6.8, { top: 'cloth3', bottom: 'clay', hat: 'scarf', hatTok: 'hairw' }), f.line('M25.8,27.4 L27.2,29', 0.3, 'wood'), f.ellipse(19.6, 31.2, 1.5, 0.75, 'wood'),
      person(32.2, 30.4, 5.6, { top: 'cloth4', bottom: 'cloth1', skirt: true, hair: 'ink', carry: 'bucket' }),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.05 }),
    ].join('') },

  'era-1961-dawn-tank': {
    draws: '아직 어두운 새벽의 도심 — 석조 건물 앞에 선 탱크 한 대와 군인 열의 뒷모습, 켜진 가로등, 셔터 내린 상가, 빈 전찻길, 동쪽 하늘의 옅은 빛.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'far', { op: 0.3 }), f.rect(0, 6, 40, 6, 'cloth2', { op: 0.1 }),
      f.rect(8, 6, 24, 11.6, 'far'), rep(7, (i) => f.rect(9.2 + i * 3.3, 8, 1.1, 9.6, 'far2')), f.rect(7.4, 5.2, 25.2, 1.2, 'far2'), f.fill(10, 8.4, 20, 4, 'era-windows', { op: 0.25 }),
      building(0, 2, 7.6, 15.6, 'roof2', 0.3), building(32.4, 1, 7.6, 16.6, 'roof2', 0.3), f.rect(0, 17.4, 40, 0.5, 'ground2'), shops(0.4, 13.2, 1, 6.4, 4.4, ['cloth1']), shops(33, 13.2, 1, 6.4, 4.4, ['roof2']),
      f.rect(0, 18, 40, 14, 'ground2'), f.rect(0, 18, 40, 14, 'cloth1', { op: 0.35 }), f.line('M0,27 H40 M0,28.2 H40', 0.22, 'roof2', { op: 0.8 }), f.line('M0,3.2 Q20,5 40,3.2', 0.14, 'ink', { op: 0.6 }),
      lamp(5.2, 18, 10, true), lamp(34.8, 18, 10, true),
      f.rect(13, 24.6, 15, 1.2, 'shade', { op: 0.5 }), tank(13.2, 24.8, 13.6), soldierLine(3.4, 26.6, 5, 4.6, 2), soldierLine(29.6, 26.6, 4, 4.6, 2),
      soldierLine(6.4, 31.6, 3, 6.6, 3), soldierLine(27.4, 31.4, 3, 6.6, 3),
      papers(61, 4, 8, 32, 28, 31.5, 0.9), f.rect(0, 20, 40, 12, 'far2', { op: 0.08 }), f.rect(0, 0, 40, 32, 'cloth1', { op: 0.12 }),
    ].join('') },

  'era-1970s-low-kerosene-room': {
    draws: '단칸 셋방의 문간 부엌 — 석유곤로 위 냄비와 밥 짓는 김, 그 앞에 쪼그려 앉은 어머니, 벽에 걸린 찬장과 양은 그릇, 방 안에 펴 둔 작은 상과 숙제하는 아이의 뒷모습, 못에 건 옷가지, 작은 창.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall2'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.25 }),
      f.rect(0, 20, 17, 12, 'ground2'), f.rect(17, 19.6, 1, 12.4, 'wood'), f.rect(18, 20.6, 22, 11.4, 'ground'), f.rect(18, 20.6, 22, 11.4, 'cloth2', { op: 0.18 }), f.fill(18, 20.6, 22, 11.4, 'era-planks', { op: 0.2 }),
      f.rect(17.6, 3, 1, 17, 'wood'), f.rect(17.6, 3, 22.4, 0.8, 'wood'),
      f.rect(3.4, 4.2, 5.2, 4.6, 'wood'), f.rect(3.8, 4.6, 4.4, 3.8, 'glass'), f.line('M6,4.6 V8.4', 0.2, 'wood'), f.poly([[3.8, 8.4], [8.2, 8.4], [12, 20], [1, 20]], 'glass', { op: 0.14 }),
      f.rect(9.6, 6.2, 7, 6.4, 'wood'), f.rect(10, 6.6, 6.2, 2.6, 'wall2'), f.rect(10, 9.6, 6.2, 2.6, 'wall2'), rep(3, (i) => f.ellipse(11.2 + i * 1.9, 8.6, 0.8, 0.3, 'hairw') + f.ellipse(11.2 + i * 1.9, 8.2, 0.8, 0.3, 'hairw')), f.rect(10.6, 10.4, 2.2, 1.6, 'hairw', { rx: 0.2 }), f.rect(13.4, 10.6, 1.8, 1.4, 'clay', { rx: 0.2 }),
      f.rect(1.2, 21.6, 8.4, 0.9, 'wall2'), f.rect(1.2, 22.5, 8.4, 2.4, 'wall2', { op: 0.6 }), kerosene(2.6, 21.6, 4.6), smoke(5, 14.6, 'cloth3', 0.5),
      shadow(8.4, 30.2, 3.6, 1.3, 0.35), crouch(10.6, 30.4, 7.6, { top: 'cloth4', bottom: 'cloth1', hat: 'scarf', hatTok: 'cloth3' }), f.rect(4.2, 29.4, 1.6, 1.8, 'hairw'), f.rect(13, 30.2, 2.8, 1.2, 'hairw', { rx: 0.2 }), f.ellipse(1.6, 30.8, 1, 0.9, 'clay'),
      f.line('M22,5.4 H36', 0.22, 'wood'), rep(4, (i) => f.rect(23 + i * 3.2, 5.6, 2.2, 4.6 + (i % 2) * 1.2, ['cloth3', 'cloth1', 'clay', 'cloth4'][i], { rx: 0.3 })),
      f.rect(30.6, 13.2, 8.4, 5.6, 'cloth4', { rx: 0.4 }), f.rect(30.6, 15.8, 8.4, 0.3, 'cloth3', { op: 0.6 }), f.rect(31.2, 11.4, 7.2, 1.8, 'clay', { rx: 0.4 }),
      f.rect(21.2, 24.6, 8.8, 0.7, 'wood'), f.line('M22,25.3 V27.4 M29.2,25.3 V27.4', 0.4, 'wood'), f.rect(23.2, 23.2, 3.6, 1.4, 'cloth3'), f.rect(27.4, 23.6, 1.4, 1, 'hairw'), f.line('M23.6,23.9 H26.4 M23.6,24.3 H26', 0.14, 'ink', { op: 0.5 }),
      crouch(25.4, 31.2, 6.6, { top: 'cloth3', bottom: 'roof2', hair: 'ink' }), f.line('M28.6,3.8 V6.4', 0.14, 'ink'), f.circle(28.6, 7, 0.55, 'glass'), f.circle(28.6, 7, 3, 'glass', { op: 0.1 }),
      f.rect(33.6, 27.4, 5.2, 3.6, 'clay', { rx: 0.3 }), f.rect(34, 27, 4.4, 0.6, 'cloth3'),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.05 }),
    ].join('') },

  'era-1980s-low-banjiha-room': {
    draws: '반지하 방 — 천장 가까운 창살 창 너머로 지나가는 행인의 다리, 밥상에서 공부하는 아이의 뒷모습, 벽에 세운 이불과 옷가지, 연탄난로와 주전자, 쌓아 둔 책, 전구 하나, 문 밖 복도의 공동 수도.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall2'), f.rect(0, 0, 40, 32, 'cloth1', { op: 0.1 }), f.rect(0, 20.4, 40, 11.6, 'ground'), f.rect(0, 20.4, 40, 11.6, 'cloth2', { op: 0.2 }), f.fill(0, 20.4, 40, 11.6, 'era-planks', { op: 0.2 }),
      f.rect(10, 1.4, 20, 7, 'roof2'), f.rect(10.6, 2, 18.8, 5.8, 'sky'), f.rect(10.6, 5.6, 18.8, 2.2, 'ground2'), f.rect(10.6, 2, 18.8, 5.8, 'glass', { op: 0.18 }),
      f.rect(15.2, 2.4, 1.2, 3.4, 'cloth1'), f.rect(16.9, 2.6, 1.1, 3.2, 'cloth1', { op: 0.8 }), f.rect(14.9, 5.6, 1.7, 0.5, 'ink'), f.rect(16.8, 5.7, 1.6, 0.4, 'ink'), f.rect(22.6, 2.2, 1.3, 3.5, 'clay'), f.rect(24.2, 2.4, 1.1, 3.3, 'clay', { op: 0.8 }), f.rect(22.4, 5.6, 1.7, 0.5, 'ink'), f.rect(24, 5.7, 1.6, 0.4, 'ink'), f.circle(28.4, 4.6, 0.9, 'pet'), f.rect(27.6, 5, 1.6, 0.9, 'pet'),
      f.line(rep(6, (i) => `M${12.6 + i * 2.8},1.4 V8.4`), 0.3, 'roof2'), f.poly([[10.6, 8.4], [29.4, 8.4], [36, 20.4], [4, 20.4]], 'glass', { op: 0.1 }),
      f.line('M20,8.4 V10.2', 0.14, 'ink'), f.circle(20, 10.8, 0.6, 'glass'), f.circle(20, 10.9, 3.4, 'glass', { op: 0.1 }),
      f.rect(1.2, 12.6, 7.4, 7.8, 'cloth4', { rx: 0.4 }), f.rect(1.2, 15.4, 7.4, 0.3, 'cloth3', { op: 0.6 }), f.rect(1.2, 18, 7.4, 0.3, 'cloth3', { op: 0.6 }), f.rect(1.6, 10.8, 6.6, 1.8, 'clay', { rx: 0.4 }),
      f.line('M31.4,9.2 H39', 0.22, 'wood'), rep(3, (i) => f.rect(32.2 + i * 2.3, 9.4, 1.8, 5 + (i % 2), ['cloth3', 'cloth1', 'hairw'][i], { rx: 0.3 })),
      f.ellipse(34.4, 25.6, 2.4, 0.6, 'shade', { op: 0.4 }), f.rect(32.8, 19.4, 3.2, 6.2, 'roof2', { rx: 0.4 }), f.rect(33.2, 19.8, 0.5, 5.4, 'far', { op: 0.3 }), f.rect(33.6, 22.6, 1.6, 1.4, 'ink'), f.rect(34, 23, 0.8, 0.6, 'cloth2'), f.rect(33.9, 9.8, 1, 9.6, 'roof2'), f.ellipse(34.4, 19.4, 1.6, 0.45, 'ink'),
      f.ellipse(34.4, 18.6, 1.3, 0.9, 'hairw'), f.line('M33.4,17.8 Q34.4,16.8 35.4,17.8', 0.3, 'roof2'), smoke(34.8, 17.2, 'cloth3', 0.4),
      rep(5, (i) => f.rect(26.4 + (i % 2) * 0.3, 24.8 - i * 0.9, 4.2, 0.9, ['cloth3', 'cloth4', 'clay', 'cloth3', 'green'][i])),
      f.rect(12.6, 24.2, 10.4, 0.7, 'wood'), f.line('M13.4,24.9 V27 M22.2,24.9 V27', 0.4, 'wood'), f.rect(14.6, 23, 3.6, 1.2, 'cloth3'), f.line('M15,23.4 H17.8 M15,23.8 H17.4', 0.14, 'ink', { op: 0.5 }), f.rect(19.2, 22.8, 1, 1.4, 'clay'), f.ellipse(21.6, 24, 1.1, 0.5, 'hairw'),
      shadow(15.2, 31, 3.6, 1.3, 0.35), crouch(17.4, 31.2, 7, { top: 'cloth3', bottom: 'cloth1', hair: 'ink' }),
      f.rect(0.4, 6.4, 0.6, 14, 'wood'), f.rect(1, 6.4, 0.4, 14, 'ink', { op: 0.3 }),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.08 }),
    ].join('') },
};
