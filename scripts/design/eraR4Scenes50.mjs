/**
 * 시대의 창 r4 — 1950년대 7장: 사건 4(○ 1952 폐허의 서울 · 1953 천막 교실 · 1954~56 구호물자 배급 줄 · 1957~59 새 기와 올리기) + 일상 3(라디오 앞 식구 · 골목 구슬치기 · 보릿고개 봄 들판).
 * 1950~51 피란 행렬은 r3(승인됨)을 그대로 쓴다. designer 2026-10-28. FT3 r4: 현장까지, 순간은 그리지 않는다 — 시신·피·폭격 순간·무기 0, 얼굴 0, 글자 0(포대·깡통도 빈 면). 전부 새로 구성.
 */
import { f, rep, shadow, tree, farRoofs, smoke, person, walker, crouch, far, crowd, queue, mass, truck, cart, flame, building, choga, stoneWall, hills, farChogas, bareTree, lamp } from './eraR4Lib.mjs';

/** 판잣집 한 채 — 널빤지 벽(줄) · 양철·루핑 지붕 · 깡통 굴뚝 */
const shack = (x, yBase, w, h, roof = 'far', wall = 'wood', chimney = true) => f.rect(x, yBase - h, w, h, wall) + f.line(rep(Math.max(2, Math.round(h / 0.9)), (i) => `M${x},${(yBase - h + 0.6 + i * 0.9).toFixed(1)}H${x + w}`), 0.12, 'ink', { op: 0.35 })
  + f.poly([[x - 0.4, yBase - h], [x + w + 0.4, yBase - h], [x + w + 0.2, yBase - h - h * 0.28], [x - 0.6, yBase - h - h * 0.18]], roof) + f.rect(x + w * 0.62, yBase - h * 0.74, w * 0.22, h * 0.6, 'cloth1', { op: 0.55 })
  + (chimney ? f.rect(x + w * 0.2, yBase - h - h * 0.5, 0.5, h * 0.4, 'hairw') + smoke(x + w * 0.2 + 0.25, yBase - h - h * 0.55, 'hairw', 0.5) : '');
/** 포대(쌀·밀가루 — 글자 없는 흰 자루) */
const sack = (x, y, w = 2.4, h = 1.4, tok = 'cloth3') => f.rect(x, y, w, h, tok, { rx: 0.5 }) + f.rect(x + w * 0.1, y + h * 0.55, w * 0.8, 0.2, 'ground2', { op: 0.5 });
/** 깡통(분유·통조림 — 빈 면) */
const can = (x, y, w = 0.9, h = 1.1, tok = 'hairw') => f.rect(x, y, w, h, tok, { rx: 0.1 }) + f.rect(x, y + 0.25, w, 0.4, 'cloth4', { op: 0.7 });
/** 기와 한 장(옆, 호 모양) 더미 */
const tilePile = (x, yBase, n = 6, w = 1.4) => rep(n, (i) => f.path(`M${x + (i % 3) * w * 0.9},${yBase - Math.floor(i / 3) * 0.7}q${w / 2},-${w * 0.45} ${w},0z`, 'roof2'));
/** 라디오(나무 상자 · 둥근 스피커 · 다이얼 둘) */
const radio = (x, y, w = 4.6, h = 3) => f.rect(x, y, w, h, 'wood', { rx: 0.3 }) + f.circle(x + w * 0.32, y + h * 0.5, h * 0.33, 'hairw') + f.circle(x + w * 0.32, y + h * 0.5, h * 0.22, 'clay', { op: 0.5 }) + f.circle(x + w * 0.74, y + h * 0.36, h * 0.12, 'glass') + f.circle(x + w * 0.74, y + h * 0.7, h * 0.12, 'ink') + f.rect(x + w * 0.58, y + h * 0.22, w * 0.32, h * 0.18, 'glass', { op: 0.8 });

export const S50 = [
  { id: 'era-1952-ruins-shanty', year: 1952, hCode: 'H-B01', name: '1952년 — 폐허의 서울, 판잣집', kind: 'event', topic: '정치', heavy: true, approved: false,
    line: '폐허가 된 거리에 판잣집이 섰습니다.',
    draws: '벽만 남은 건물들과 잔해 더미 사이에 널빤지·양철·천막으로 지은 판잣집 — 깡통 굴뚝의 밥 짓는 연기, 물동이를 인 여인, 널빤지를 나르는 남자, 빨랫줄, 잔해 위의 아이 둘, 멀리 산.',
    ft3: '유지선 ① 시신·피·폭격 순간 0(잔해와 살림만, 연기는 밥 짓는 연기) ② 실존 인물 0(뒷모습·옆모습) ③ 군·무기·정당 상징 0 ④ 한 줄은 사실만. 낙인 표현 대신 살아가는 생활. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'far2'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.25 }), hills(9, 'far', 'far2'),
      // 벽만 남은 건물(들쭉날쭉한 윗선 · 창 구멍 · 기운 벽)
      f.poly([[2, 18], [2, 7.5], [5, 6.2], [8, 8.6], [11, 5.8], [14, 9.2], [14, 18]], 'wall2'), rep(4, (i) => f.rect(3.4 + i * 2.8, 10.2, 1.5, 2.2, 'ink', { op: 0.45 })), rep(3, (i) => f.rect(4.6 + i * 3, 14, 1.5, 2.2, 'ink', { op: 0.4 })),
      f.poly([[24, 18], [24, 9.6], [27, 11], [29, 7.2], [33, 8.4], [36, 6.4], [38, 10.8], [38, 18]], 'wall'), rep(4, (i) => f.rect(25.4 + i * 3.2, 11.8, 1.5, 2.2, 'ink', { op: 0.42 })), f.poly([[31, 18], [34.6, 9.8], [35.4, 10.2], [32.4, 18]], 'wall2'),
      f.rect(15, 11, 1, 7, 'wall2', { tr: 'rotate(8 15.5 18)' }), f.line('M17.6,12.4 q1.6,-1.6 2.6,-0.4 M21.2,10.4 q1.2,-1.8 2.4,-0.6', 0.2, 'ink'),
      // 잔해 더미 · 벽돌 조각
      rep(8, (i) => f.ellipse(2.6 + i * 5.1, 18.6 + (i % 2) * 0.6, 2.6, 1.1, ['ground2', 'wall2', 'far2'][i % 3])), rep(12, (i) => f.rect(1.4 + (i * 3.3) % 38, 17 + (i * 1.7) % 3.2, 1, 0.6, ['wall2', 'clay', 'far'][i % 3], { tr: `rotate(${(i * 37) % 50 - 25} ${1.9 + (i * 3.3) % 38} ${17.3 + (i * 1.7) % 3.2})` })),
      // 땅 · 판잣집 넷(멀리 작게 → 앞 크게) · 천막
      f.rect(0, 20, 40, 12, 'ground'), f.rect(0, 20, 40, 12, 'ground2', { op: 0.25 }),
      shack(16.6, 20.6, 5.6, 3.2, 'hairw', 'wood', false), shack(23.4, 21.2, 6.4, 3.6, 'far'), f.poly([[31, 21.6], [38.6, 21.6], [36.6, 17.8], [33, 17.8]], 'cloth3'), f.rect(31, 21.4, 7.6, 0.4, 'roof2', { op: 0.5 }),
      shack(1, 26.4, 9.4, 5.6, 'far', 'wood'), shack(27.6, 27.4, 12, 6.4, 'hairw', 'clay'),
      // 빨랫줄 · 빨래
      f.line('M10.4,22.4 L17,21.6', 0.14, 'ink'), rep(4, (i) => f.rect(11.2 + i * 1.5, 22.3 - i * 0.18, 1, 1.6 + (i % 2) * 0.4, ['cloth3', 'cloth4', 'hairw', 'clay'][i], { rx: 0.15 })),
      // 사람 — 물동이 인 여인(옆) · 널빤지 나르는 남자(옆) · 아이 둘(잔해 위) · 화덕 앞 쪼그림
      walker(15.2, 29.8, 8, { top: 'hairw', bottom: 'ink', long: true, load: 'jar' }, 1), walker(22.8, 31.2, 8.6, { top: 'far', bottom: 'cloth1', hat: 'cap', hatTok: 'ink' }, -1), f.rect(16.4, 24.4, 9.6, 0.6, 'wood', { tr: 'rotate(-8 21.2 24.7)' }),
      far(8.6, 17.4, 3, 'cloth4', 'ink'), far(10.4, 17.9, 2.6, 'clay', 'hair'),
      crouch(13, 27.2, 4.2, { top: 'cloth3', bottom: 'cloth1', hat: 'scarf', hatTok: 'cloth3' }), f.rect(10.2, 26.6, 1.8, 0.8, 'ink'), f.ellipse(11.1, 26.4, 0.7, 0.3, 'clay'), smoke(11.1, 25.6, 'hairw', 0.45),
      // 양동이 · 깡통 몇 개
      f.rect(25.2, 30.4, 1.2, 1.1, 'hairw'), f.rect(12.2, 31, 1, 0.9, 'cloth4'),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.05 }),
    ].join('') },

  { id: 'era-1953-tent-school', year: 1953, hCode: 'H-B01', name: '1953년 — 천막 교실과 돌아온 사람들', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '휴전 뒤 천막 교실에서 공부했습니다.',
    draws: '운동장에 친 큰 천막 교실 — 걷어 올린 옆면 안으로 긴 널빤지 책상에 앉은 아이들의 뒷모습과 빈 칠판, 보따리를 이고 돌아오는 사람들의 행렬, 사다리 위에서 판잣집을 세우는 남자, 봄의 산.',
    ft3: '무겁지 않음(휴전 뒤 복구). 사람은 뒷모습·옆모습(얼굴 0). 칠판·천막에 글자·표장 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), hills(10.5), farChogas(12.2, 3, 1, 5.5), farRoofs(13.6, 'far2'),
      f.rect(0, 14.4, 40, 17.6, 'ground'), f.rect(0, 14.4, 40, 0.5, 'ground2', { op: 0.5 }),
      // 판잣집 세우는 남자(사다리) — 뒤 왼쪽
      f.rect(1.4, 10.6, 6.4, 4.6, 'wood'), f.line('M1.4,11.3 H7.8 M1.4,12.4 H7.8 M1.4,13.5 H7.8', 0.12, 'ink', { op: 0.35 }), f.line('M8.6,15.6 L7.2,9 M10.2,15.6 L8.8,9 M8.3,14 H9.9 M8,12.4 H9.6 M7.7,10.8 H9.3', 0.22, 'wood'), person(8.4, 11.6, 4.4, { top: 'cloth4', bottom: 'ink', arm: 'upL' }), f.rect(5.2, 8.6, 3, 0.4, 'wood', { tr: 'rotate(-14 6.7 8.8)' }),
      // 천막(큰 삼각 지붕 · 기둥 · 걷어 올린 옆면 · 줄)
      f.poly([[11, 23], [37, 23], [37, 13.4], [24, 7.8], [11, 13.4]], 'cloth3'), f.poly([[11, 13.4], [24, 7.8], [37, 13.4], [24, 9.4]], 'hairw', { op: 0.6 }), f.line('M24,7.8 V6.2', 0.3, 'wood'), f.line('M11,13.4 L8.4,15.2 M37,13.4 L39.6,15.2', 0.18, 'ink'),
      f.rect(11.6, 13.4, 24.8, 1.2, 'hairw'), f.rect(11, 14.2, 26, 8.8, 'wall2', { op: 0.85 }), f.rect(11.4, 13.6, 0.6, 9.4, 'wood'), f.rect(36, 13.6, 0.6, 9.4, 'wood'), f.rect(23.7, 7.8, 0.6, 15.2, 'wood'),
      // 안 — 칠판(빈) · 책상 줄과 아이들 뒷모습
      f.rect(19.8, 10.6, 8.4, 4.4, 'wood'), f.rect(20.2, 11, 7.6, 3.6, 'roof2'), f.rect(21.6, 12.4, 3.2, 0.4, 'cloth3', { op: 0.16 }),
      rep(3, (i) => f.rect(12.4 + i * 0.3, 17 + i * 2, 23.2 - i * 0.6, 0.7, 'wood') + rep(7, (k) => far(13.6 + k * 3.4 + (i % 2) * 0.8 + (k % 2) * 0.3, 17 + i * 2, 2.2 + i * 0.5, ['cloth4', 'hairw', 'far', 'cloth3', 'clay', 'roof2', 'cloth4'][(k + i) % 7], ['hair', 'ink'][(k + i) % 2]))),
      // 돌아오는 사람들 — 보따리·지게·아이(옆모습, 왼쪽으로)
      queue(39, 27.4, 5, 6.2, 4.2, { seed: 53, tops: ['cloth3', 'hairw', 'cloth4', 'clay', 'cloth3'], bottoms: ['cloth1', 'ink', 'cloth3'], loads: ['bundle', 'jige', 'bag', 'bundle'], skirts: 0.4, long: 1, hats: [{ hat: 'scarf', hatTok: 'cloth3' }, { hat: 'cap', hatTok: 'ink' }] }, -1),
      shadow(2.6, 31.2, 2.4, 1.2, 0.35), walker(4.2, 31.4, 8.8, { top: 'hairw', bottom: 'ink', load: 'jige', hat: 'cap', hatTok: 'ink' }, -1), walker(8.6, 31.6, 8.2, { top: 'cloth3', bottom: 'clay', long: true, load: 'bundle' }, -1), walker(11.4, 31.8, 4.6, { top: 'cloth4', bottom: 'ink' }, -1), f.line('M10.2,27.6 L10.9,28.4', 0.3, 'skin'),
      // 봄 나무 · 신발주머니
      tree(38.6, 24, 7), f.rect(31.6, 25.4, 1.4, 1, 'clay', { rx: 0.2 }),
    ].join('') },

  { id: 'era-1954-relief-queue', year: 1954, years: [1954, 1956], hCode: 'H-E01', name: '1954~56년 — 구호물자 배급 줄', kind: 'event', topic: '경제', heavy: false, approved: false,
    line: '구호물자 배급 줄에 섰습니다.',
    draws: '마을 공터의 배급 — 포대를 실은 트럭, 탁자 위 상자와 분유 깡통(빈 면), 배급하는 사람 둘의 뒷모습, 깡통·바가지·자루를 들고 길게 선 줄(아기 업은 여인·노인·아이들), 뒤로 판잣집 줄과 산.',
    ft3: '경제 체험(○ 아님). 포대·깡통·트럭에 글자·표장·국기 0(빈 면). 사람은 뒷모습·옆모습(얼굴 0). 희화화·낙인 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.2 }), hills(9.5), farRoofs(12.6, 'far2'),
      f.rect(0, 13.6, 40, 18.4, 'ground'), f.rect(0, 13.6, 40, 0.4, 'ground2', { op: 0.5 }),
      // 판잣집 줄(뒤) · 천막
      shack(0.6, 16.8, 6.2, 3.4, 'far'), shack(7.4, 16.4, 5.2, 3, 'hairw', 'clay', false), shack(29, 16.6, 6, 3.4, 'far'), shack(35.6, 16.2, 4.4, 3, 'hairw', 'wood', false),
      // 트럭(포대 실림) — 왼쪽 가운데
      f.rect(1.6, 22.4, 13.4, 1.2, 'shade', { op: 0.4 }), truck(1.2, 22.6, 12.8, 'green', 'roof2', 1), rep(5, (i) => sack(1.8 + (i % 3) * 2.9 + (i > 2 ? 1.4 : 0), 17.6 - (i > 2 ? 1.4 : 0), 2.6, 1.5)),
      // 배급 탁자 · 상자 · 깡통 · 배급원 둘(뒷모습)
      f.rect(16.2, 20.8, 10.6, 0.7, 'wood'), f.line('M16.8,21.5 V24.4 M26.2,21.5 V24.4', 0.4, 'wood'), f.rect(17, 19.2, 3, 1.6, 'clay'), f.rect(20.6, 19.6, 2.4, 1.2, 'clay'), rep(4, (i) => can(23.4 + i * 1.05, 19.7)), sack(16.6, 22.4, 2.8, 1.6), sack(19.8, 22.8, 2.4, 1.4, 'hairw'),
      person(18.4, 20.2, 6.4, { top: 'cloth4', bottom: 'ink', hat: 'cap', hatTok: 'cloth4' }), person(24.2, 20.4, 6.6, { top: 'hairw', bottom: 'cloth1', hat: 'cap', hatTok: 'cloth4' }),
      // 줄 — 뒤쪽 작은 줄(오른쪽에서 탁자로) · 앞 큰 줄
      queue(39.2, 22.6, 8, 4.4, 1.7, { seed: 541, tops: ['cloth3', 'hairw', 'cloth4', 'clay', 'far'], bottoms: ['cloth1', 'ink', 'cloth3'], loads: ['bag', 'bundle'], skirts: 0.45, long: 1, hats: [{ hat: 'scarf', hatTok: 'cloth3' }, { hat: 'cap', hatTok: 'ink' }] }, -1),
      queue(38.6, 28.4, 6, 6.8, 4.4, { seed: 54, tops: ['hairw', 'cloth3', 'cloth4', 'cloth3', 'clay', 'far'], bottoms: ['ink', 'cloth1', 'cloth3'], loads: ['baby', 'bag', 'bundle'], skirts: 0.5, long: 1, hats: [{ hat: 'scarf', hatTok: 'hairw' }, { hat: 'cap', hatTok: 'ink' }, { hat: 'brim', hatTok: 'ink' }] }, -1),
      walker(14.4, 28.8, 4.6, { top: 'cloth3', bottom: 'ink' }, -1), f.rect(13, 26.2, 0.9, 1, 'hairw'), walker(31.6, 32.2, 9.2, { top: 'cloth3', bottom: 'cloth1', long: true, load: 'baby', hat: 'scarf', hatTok: 'cloth3' }, -1), f.rect(28.6, 29.2, 1.6, 1.3, 'hairw'),
      shadow(5.6, 31.2, 2.2, 1.2, 0.35), walker(7.2, 31.6, 8.4, { top: 'far', bottom: 'ink', hat: 'brim', hatTok: 'ink', load: 'bag' }, -1), walker(10.6, 31.8, 5, { top: 'clay', bottom: 'cloth1' }, -1), f.ellipse(12.2, 28.6, 0.6, 0.35, 'clay'),
    ].join('') },

  { id: 'era-1957-new-roof-tiles', year: 1957, years: [1957, 1959], hCode: 'H-E01', name: '1957~59년 — 새 기와 올리기', kind: 'event', topic: '경제', heavy: false, approved: false,
    line: '동네에 새 기와집이 올라갔습니다.',
    draws: '짓는 중인 집 — 기둥과 서까래가 드러난 지붕에 반쯤 얹은 기와, 대나무 비계와 발판, 지붕 위에서 기와를 받는 목수 둘, 아래에서 기와를 올려 주는 사람, 기와 더미와 흙 반죽 통, 리어카, 구경하는 아이, 뒤로 초가와 산.',
    ft3: '복구·건설의 일상(○ 아님). 사람은 뒷모습·옆모습·쪼그림(얼굴 0). 글자·상호 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'glass', { op: 0.08 }), hills(10), farChogas(11.8, 4, 24, 5), choga(0.4, 17.6, 9, 4.2, { maru: false }),
      f.rect(0, 18, 40, 14, 'ground'), f.rect(0, 18, 40, 0.4, 'ground2', { op: 0.5 }),
      // 집 뼈대 — 기둥 · 벽(흙) · 도리 · 서까래
      f.rect(12, 12.6, 16, 7.4, 'wall2'), f.fill(12, 12.6, 16, 7.4, 'era-stones', { op: 0.25 }), rep(4, (i) => f.rect(12.4 + i * 4.9, 11.6, 0.8, 8.4, 'wood')),
      f.path('M10.6,12.6 L20,6.8 L29.4,12.6 Z', 'ground2'), f.line(rep(9, (i) => `M${12 + i * 2},${12.6 - (i < 4 ? i : 8 - i) * 1.45 + (i === 4 ? 0 : 0)}L${20},6.8`), 0.18, 'wood', { op: 0.9 }), f.line('M10.6,12.6 L29.4,12.6', 0.5, 'wood'),
      // 왼쪽 절반 기와(줄) · 오른쪽 맨 서까래
      f.path('M10.6,12.8 L20,7 L20.4,7.3 L20.4,12.8 Z', 'roof2'), f.fill(10.8, 7.4, 9.6, 5.4, 'era-shutter', { op: 0.7 }), f.line('M10.6,12.6 L20,6.8', 0.4, 'roof'),
      // 비계(대나무) · 발판
      f.line('M9.4,20 V5.6 M30.6,20 V5.4 M9.4,9.2 H16 M30.6,9 H24 M9.4,14.6 H14 M30.6,14.4 H26', 0.28, 'cloth2'), f.rect(9.2, 9.6, 6.8, 0.5, 'wood'), f.rect(24, 9.4, 6.8, 0.5, 'wood'), f.rect(9.2, 15, 4.8, 0.5, 'wood'),
      // 지붕 위 목수 둘(쪼그림·서서 받음) · 아래에서 올려 주는 사람(팔 위) · 발판 위 사람
      crouch(15.2, 9.9, 3.4, { top: 'cloth3', bottom: 'cloth1', hat: 'scarf', hatTok: 'cloth3' }), person(22.6, 9.6, 4.4, { top: 'hairw', bottom: 'ink', arm: 'upL', hat: 'scarf', hatTok: 'cloth3' }), f.path('M20.6,6.2 q0.6,-0.5 1.2,0z', 'roof2'),
      person(26.6, 15, 4.6, { top: 'cloth4', bottom: 'cloth1', hat: 'cap', hatTok: 'ink' }),
      shadow(31.2, 23.6, 2.2, 1.2, 0.35), person(32.2, 23.8, 8, { top: 'cloth3', bottom: 'ink', arm: 'up', hat: 'scarf', hatTok: 'cloth3' }), f.path('M31.2,16.4 q0.9,-0.7 1.8,0z', 'roof2'),
      // 기와 더미 · 흙 반죽 통 · 리어카(기와) · 아이 구경 · 양동이
      tilePile(2.6, 23.8, 9, 1.6), tilePile(35.2, 22.6, 6, 1.5), f.rect(21.8, 21.8, 3.2, 1.8, 'wood'), f.ellipse(23.4, 21.8, 1.6, 0.5, 'clay'),
      f.rect(12.6, 28.4, 8.8, 1, 'shade', { op: 0.4 }), cart(14, 28.6, 6.6), tilePile(14.2, 25.6, 6, 1.5), walker(11, 28.8, 7.2, { top: 'far', bottom: 'ink', hat: 'cap', hatTok: 'ink' }, -1),
      person(6.6, 27.2, 4.6, { top: 'clay', bottom: 'cloth1', hair: 'ink' }), person(8.4, 27.6, 3.8, { top: 'cloth3', bottom: 'cloth3' }), f.rect(26.8, 27.2, 1.4, 1.3, 'hairw'),
      walker(36.8, 31.6, 8.2, { top: 'cloth3', bottom: 'cloth3', load: 'jige', hat: 'cap', hatTok: 'cloth3' }, -1),
    ].join('') },

  { id: 'era-1955-radio-evening', year: 1955, hCode: null, name: '마루의 라디오 — 저녁에 모인 식구', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '저녁이면 라디오 앞에 모였습니다.',
    draws: '해 진 뒤의 마루 — 작은 상 위 라디오 둘레에 둘러앉은 식구들의 뒷모습(할머니의 흰 머릿수건·아이들), 처마 밑 전구 하나, 열린 창호문, 댓돌의 고무신, 마당의 어둠과 장독.',
    ft3: '식구 모두 뒷모습(얼굴 0). 라디오에 글자·상표 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'far', { op: 0.35 }),
      // 집 — 초가 지붕 처마 · 벽 · 창호문 둘(불빛) · 마루
      f.rect(2, 6.4, 36, 15.6, 'wall'), f.rect(2, 6.4, 36, 15.6, 'cloth1', { op: 0.18 }), f.path('M-1,7 Q20,-2 41,7 L41,8.6 L-1,8.6 Z', 'ground2'), f.rect(-1, 8.2, 42, 0.7, 'wood'),
      f.rect(7, 10, 8.4, 11, 'glass'), f.line('M7,13 H15.4 M7,16 H15.4 M7,19 H15.4 M9.8,10 V21 M12.6,10 V21', 0.2, 'wood'), f.rect(24, 10, 8.4, 11, 'glass', { op: 0.9 }), f.line('M24,13 H32.4 M24,16 H32.4 M24,19 H32.4 M26.8,10 V21 M29.6,10 V21', 0.2, 'wood'),
      f.rect(16, 9.6, 1, 11.4, 'wood'), f.rect(22.6, 9.6, 1, 11.4, 'wood'), f.rect(16.6, 11, 6.4, 10, 'ink', { op: 0.7 }),
      // 전구(처마) · 빛
      f.line('M19.6,8.6 V10.2', 0.14, 'ink'), f.circle(19.6, 10.9, 0.65, 'glass'), f.circle(19.6, 11, 4.4, 'glass', { op: 0.12 }),
      // 마루(널) · 댓돌 · 고무신
      f.rect(0, 21, 40, 4.2, 'wood'), f.fill(0, 21, 40, 4.2, 'era-planks', { op: 0.5 }), f.rect(0, 21, 40, 0.3, 'clay', { op: 0.5 }), f.rect(12, 25.2, 16, 1.4, 'wall2'),
      rep(4, (i) => f.rect(13.2 + i * 3.4, 25.5, 1.2, 0.6, ['cloth3', 'ink', 'cloth3', 'ink'][i], { rx: 0.3 }) + f.rect(14.6 + i * 3.4, 25.5, 1.2, 0.6, ['cloth3', 'ink', 'cloth3', 'ink'][i], { rx: 0.3 })),
      // 상 + 라디오 · 식구 뒷모습(앉음 — 먼 인물 모양으로 낮게)
      f.rect(17.2, 17.6, 6.8, 0.5, 'wood'), f.line('M17.8,18.1 V20.6 M23.4,18.1 V20.6', 0.35, 'wood'), radio(18.2, 14.6, 4.8, 3),
      far(11.2, 23.8, 6, 'hairw', 'ink'), far(27.6, 23.6, 6.2, 'cloth4', 'ink'), far(15.4, 24.6, 5.2, 'cloth3', 'hair'), far(23.4, 24.4, 5, 'clay', 'hair'), far(19.4, 24.2, 3.8, 'hairw', 'hair'),
      f.path('M9.9,19.4a1.3,1.3 0 0 1 2.6,0l-0.8,0.9h-1z', 'cloth3'),
      // 마당(앞) · 장독 · 어둠
      f.rect(0, 25.2, 40, 6.8, 'ground2'), f.rect(0, 25.2, 40, 6.8, 'cloth1', { op: 0.45 }), f.ellipse(4.6, 29.6, 1.6, 1.7, 'clay'), f.ellipse(4.6, 28, 0.8, 0.3, 'ink'), f.ellipse(34.8, 30, 1.3, 1.4, 'clay'),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.12 }),
    ].join('') },

  { id: 'era-1956-alley-marbles', year: 1956, hCode: null, name: '골목 — 구슬치기와 딱지', kind: 'daily', topic: '생활', heavy: false, ageBand: '어린이(5~12)', approved: false,
    line: '골목에서 구슬치기를 했습니다.',
    draws: '돌담 사이 흙 골목 — 구슬 구멍 둘레에 쪼그려 앉은 아이 셋, 딱지를 내리치는 아이, 지켜보는 아이, 바닥의 구슬과 딱지, 담 위로 넘어온 빨래, 골목 끝 기와집과 전봇대.',
    ft3: '아이들 모두 뒷모습·옆모습(얼굴 0). 글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), farRoofs(10.5, 'far'),
      // 골목 끝 기와집 · 전봇대
      f.rect(14, 10.4, 12, 7, 'wall'), f.path('M12.6,10.8 L27.4,10.8 L26,8.2 L14,8.2 Z', 'roof2'), f.rect(16, 12.6, 2.6, 3, 'glass'), f.rect(21.4, 12.6, 2.6, 4.8, 'wood'), f.rect(29.4, 1, 0.8, 16.6, 'roof2'), f.rect(28, 2.6, 3.6, 0.5, 'roof2'), f.line('M29.8,2.8 Q16,5.6 0,4', 0.2, 'roof2', { op: 0.7 }),
      // 돌담(양쪽, 원근) · 담 위 빨래
      f.poly([[0, 5], [12, 11.6], [12, 17.4], [0, 22]], 'wall2'), f.fill(0, 5, 12, 17, 'era-stones', { op: 0.8 }), f.poly([[40, 5], [28, 11.6], [28, 17.4], [40, 22]], 'wall2'), f.fill(28, 5, 12, 17, 'era-stones', { op: 0.8 }),
      f.line('M0,6.2 L7,10', 0.14, 'ink'), f.rect(1.4, 7, 1.4, 2.2, 'cloth3', { rx: 0.2 }), f.rect(3.6, 8.1, 1.2, 1.8, 'cloth4', { rx: 0.2 }), f.rect(5.4, 9, 1.4, 2, 'hairw', { rx: 0.2 }),
      f.circle(34.4, 6.8, 2.6, 'green'), f.circle(37.2, 5.6, 2.2, 'green'), f.rect(35.6, 8.6, 0.6, 2.4, 'wood'), f.ellipse(10.2, 12.6, 1.1, 1.2, 'clay'), f.ellipse(12.1, 13, 0.9, 1, 'clay'),
      // 땅(흙) · 구멍 · 구슬 · 딱지
      f.rect(0, 17.4, 40, 14.6, 'ground'), f.poly([[12, 17.4], [28, 17.4], [40, 32], [0, 32]], 'ground2', { op: 0.3 }),
      f.ellipse(20, 26.6, 0.9, 0.45, 'shade', { op: 0.6 }), rep(7, (i) => f.circle(16.4 + (i * 2.3) % 8, 25.4 + (i * 1.1) % 3.2, 0.3, ['glass', 'cloth4', 'clay', 'green', 'glass', 'cloth2', 'cloth4'][i])),
      rep(5, (i) => f.rect(6.2 + (i * 1.3) % 4, 27.6 + (i * 0.9) % 2.4, 1.1, 1.1, ['cloth3', 'hairw', 'cloth3', 'clay', 'cloth3'][i], { tr: `rotate(${(i * 29) % 60} ${6.7 + (i * 1.3) % 4} ${28.1 + (i * 0.9) % 2.4})` })),
      // 아이들 — 구슬 둘레 쪼그림 셋 · 딱지 치는 아이(팔 위) · 구경하는 아이
      crouch(14.2, 27.6, 4.6, { top: 'cloth4', bottom: 'cloth1' }), crouch(25.8, 28, 4.8, { top: 'clay', bottom: 'ink' }), crouch(20.2, 31.6, 6, { top: 'hairw', bottom: 'cloth1' }),
      shadow(5.6, 30.6, 2, 1.2, 0.35), person(6.8, 30.8, 7.2, { top: 'cloth3', bottom: 'ink', arm: 'upR', hair: 'ink' }), f.rect(9.4, 24.2, 1, 1, 'clay', { tr: 'rotate(20 9.9 24.7)' }),
      person(33.4, 29.4, 6.4, { top: 'cloth4', bottom: 'cloth1', skirt: true, hair: 'ink' }), person(36.2, 27.8, 4.2, { top: 'cloth3', bottom: 'clay' }),
      // 강아지(작게) · 고무신 한 켤레
      f.ellipse(30.2, 31, 1.1, 0.55, 'pet'), f.circle(31.3, 30.6, 0.42, 'pet'), f.line('M29.4,31.2 V31.6 M30.8,31.2 V31.6', 0.18, 'pet2'), f.rect(11.6, 31, 1.1, 0.55, 'ink', { rx: 0.25 }), f.rect(12.9, 31, 1.1, 0.55, 'ink', { rx: 0.25 }),
    ].join('') },

  { id: 'era-1958-barley-spring', year: 1958, hCode: null, name: '보릿고개 — 빈 밥상과 나물 캐는 아이들', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    // r4b(형진 님 결정 2026-10-28): 들판만 그리던 것에 생활 안쪽(마루의 빈 밥상)과 나물 캐는 아이들을 더했다. 한 줄도 그림에 맞춰 바꿨다(이전 「봄이면 보리가 익기를 기다렸습니다.」).
    line: '보릿고개에는 나물로 끼니를 이었습니다.',
    draws: '왼쪽은 초가 툇마루의 모퉁이 — 할머니와 아이가 앉은 작은 밥상에 빈 그릇 둘과 나물죽 한 그릇, 숟가락, 댓돌의 고무신. 오른쪽은 아직 푸른 보리밭 — 호미로 나물을 캐는 아이 둘(쪼그림)과 바가지 든 아이, 들에서 바구니를 들고 돌아오는 어머니, 멀리 나물 캐는 여인과 둑길의 지게꾼, 초가 마을과 산.',
    ft3: '사람은 뒷모습·옆모습·먼 인물(얼굴 0). 굶주림은 빈 그릇과 나물 끼니로만 — 몸을 마르게 과장하거나 희화화하지 않는다(낙인 0). 글자 0. 사진 모사 0. r4b 보강(형진 님 결정 2026-10-28 「생활 안쪽까지」).',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'glass', { op: 0.1 }), hills(9, 'far', 'far2'), farChogas(11.6, 4, 16, 6.5),
      // 들 — 보리밭 두 뙈기(아직 푸른 줄) · 둑길(대각선)
      f.rect(0, 13.6, 40, 18.4, 'ground'),
      f.poly([[14, 13.6], [40, 13.6], [40, 19.4], [14, 22.6]], 'green', { op: 0.55 }), f.line(rep(8, (i) => `M14,${14.6 + i}L40,${14.2 + i * 0.62}`), 0.22, 'green', { op: 0.6 }),
      f.poly([[16, 27.4], [40, 22.4], [40, 32], [16, 32]], 'green', { op: 0.5 }), f.line(rep(6, (i) => `M16,${28.2 + i * 0.75}L40,${23.4 + i * 1.4}`), 0.26, 'green', { op: 0.6 }),
      f.poly([[14, 22.6], [40, 19.4], [40, 22.4], [16, 27.4], [14, 27.4]], 'ground2', { op: 0.7 }),
      // 둑길의 지게꾼(멀리) · 들의 여인(쪼그림 · 호미 · 바구니)
      walker(33.6, 21.2, 4.4, { top: 'cloth3', bottom: 'cloth3', load: 'jige', hat: 'cap', hatTok: 'cloth3' }, -1),
      crouch(24.6, 19.8, 3.8, { top: 'hairw', bottom: 'cloth1', hat: 'scarf', hatTok: 'cloth3' }), f.ellipse(27, 19.6, 0.9, 0.45, 'wood'),
      // 집 — 초가 툇마루 모퉁이(왼쪽): 흙벽 · 이엉 지붕 · 창호문과 열린 방(어두움) · 마루 · 댓돌 · 고무신 두 켤레
      f.rect(-1, 11.8, 17.4, 12.6, 'wall2'), f.path('M-2,12.2 Q7.6,5.4 18.8,12.2 L18.8,13.2 L-2,13.2 Z', 'ground2'), f.path('M-1.4,12.6 Q7.6,7.4 17.6,12.6 Q7.6,10.4 -1.4,12.6 Z', 'ground', { op: 0.55 }), f.rect(-2, 13, 20.8, 0.5, 'wood', { op: 0.6 }),
      f.rect(2.2, 14.6, 5.4, 8.4, 'cloth3'), f.line('M4.9,14.6 V23 M2.2,17.4 H7.6 M2.2,20.2 H7.6', 0.14, 'wood'), f.rect(9.4, 14.6, 5.2, 8.4, 'ink', { op: 0.55 }), f.rect(8.4, 14.2, 0.8, 9.2, 'wood'), f.rect(14.6, 14.2, 0.8, 9.2, 'wood'),
      f.rect(-1, 24.2, 17.4, 3, 'wood'), f.fill(-1, 24.2, 17.4, 3, 'era-planks', { op: 0.5 }), f.rect(-1, 24.2, 17.4, 0.3, 'clay', { op: 0.5 }), f.rect(3, 27.2, 10, 1.3, 'wall2'),
      f.rect(5.4, 27.5, 1.1, 0.55, 'cloth3', { rx: 0.25 }), f.rect(6.7, 27.5, 1.1, 0.55, 'cloth3', { rx: 0.25 }), f.rect(9.2, 27.5, 0.9, 0.5, 'ink', { rx: 0.25 }), f.rect(10.3, 27.5, 0.9, 0.5, 'ink', { rx: 0.25 }),
      // 마루의 밥상 — 할머니(흰머리)와 아이(뒷모습 · 앉음) · 빈 그릇 둘(안이 보이게) · 나물죽 한 그릇 · 숟가락 둘
      far(3.4, 24.4, 6.2, 'cloth3', 'hairw'), far(11.2, 24.6, 5, 'cloth4', 'ink'),
      f.ellipse(7.4, 22.6, 4.3, 1.35, 'wood'), f.line('M4.2,23.6 V24.2 M10.6,23.6 V24.2', 0.4, 'wood'),
      f.ellipse(5.3, 22.4, 1.2, 0.55, 'hairw'), f.ellipse(5.3, 22.48, 0.8, 0.32, 'wall2'), f.ellipse(9.5, 22.6, 1.2, 0.55, 'hairw'), f.ellipse(9.5, 22.68, 0.8, 0.32, 'wall2'),
      f.ellipse(7.4, 21.8, 1.25, 0.58, 'hairw'), f.ellipse(7.4, 21.82, 0.82, 0.34, 'green', { op: 0.75 }),
      f.line('M3.9,23.2 l1.6,-0.5 M10.6,23.3 l1.5,-0.4', 0.18, 'hairw'),
      // 들에서 돌아오는 어머니(머릿수건 · 나물 바구니) · 앞 들의 나물 캐는 아이들 둘(쪼그림 · 호미 · 바구니) · 바가지 든 아이
      shadow(17.2, 31, 2.6, 1.2, 0.3), walker(18.8, 31.2, 8.4, { top: 'cloth3', bottom: 'cloth1', long: true, hat: 'scarf', hatTok: 'cloth3' }, -1), f.ellipse(16.6, 27.8, 1.3, 0.7, 'wood'), f.ellipse(16.6, 27.3, 0.9, 0.35, 'green'),
      shadow(26.2, 29.6, 2.6, 1.1, 0.3), crouch(27.4, 29.6, 5, { top: 'cloth4', bottom: 'cloth1', hair: 'ink' }), f.line('M29.2,27.2 L30.4,28.4', 0.26, 'wood'), f.ellipse(31.4, 29.6, 1.2, 0.6, 'wood'), f.ellipse(31.4, 29.2, 0.8, 0.3, 'green'),
      crouch(35.4, 27.4, 4.4, { top: 'clay', bottom: 'ink' }), f.line('M37,25.3 L38,26.3', 0.24, 'wood'), f.ellipse(33.2, 27.2, 1, 0.5, 'wood'),
      person(24, 31.8, 5.2, { top: 'cloth3', bottom: 'clay', hair: 'ink', carry: 'bucket' }),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.05 }),
    ].join('') },
];
