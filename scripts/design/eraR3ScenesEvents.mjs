/**
 * 시대의 창 r3 — 1970~80년대 무겁지 않은 사건 3장 + 1987 둘째 그림(12월 투표소) (designer 2026-10-28).
 * r2 그림(`eraR2ScenesEvents.mjs`)의 장소는 그대로 두고 **사람**(뒷모습·옆모습·먼 인물, 얼굴 0)을 더해 「그때 거기 있는 느낌」을 낸다. 새로 구성(사진 모사 0).
 */
import { f, rep, person, walker, far, crowd, flame } from './eraR3Lib.mjs';
import { EVENTS as R2 } from './eraR2ScenesEvents.mjs';

const r2 = (id) => { const q = R2.find((e) => e.id === id); if (!q) throw new Error(`r2 그림 없음: ${id}`); return q; };

export const EVENTS = [
  { ...r2('era-1974-subway-platform'), id: 'era-1974-subway-platform-r3', approved: false,
    draws: 'r2 승강장에 더함 — 안전선 뒤에 줄 선 승객들의 뒷모습(가방·보따리·신문), 모자 쓴 역무원의 옆모습, 계단을 내려오는 사람.',
    ft3: '노선 번호·역 이름·안내 글자 0(화살표만). 사람은 뒷모습·옆모습(얼굴 0). 새로 구성.',
    draw: () => r2('era-1974-subway-platform').draw() + [
      crowd(1.5, 15, 6, 5, 6.8, { y: 24.3, jitter: 0.5, seed: 74, skirts: 0.35, tops: ['cloth3', 'cloth1', 'hairw', 'clay', 'cloth4', 'roof2'], carry: ['paper', 'box'] }),
      walker(27.4, 24.6, 6.2, { top: 'cloth1', bottom: 'cloth1', hat: 'cap', hatTok: 'cloth1' }, -1, 0.1), f.rect(26.2, 20.6, 0.4, 1.4, 'cloth2'),
      walker(3.2, 17.6, 4.2, { top: 'cloth4', bottom: 'ink', load: 'bag' }, 1, 0.5),
    ].join('') },

  { ...r2('era-1982-ballpark-night'), id: 'era-1982-ballpark-night-r3', approved: false,
    draws: 'r2 야간 경기장에 더함 — 우리 앞줄 관중의 뒷모습(팔 든 사람·응원 깃발), 마운드와 타석의 선수, 더그아웃 앞 선수들.',
    ft3: '구단 표지·숫자·글자 0(전광판 빈 판, 깃발은 빈 천). 관중·선수 모두 뒷모습·먼 인물(얼굴 0).',
    draw: () => r2('era-1982-ballpark-night').draw() + [
      far(20, 26.6, 1.8, 'cloth3', 'ink'), far(20.2, 31.6, 2, 'hairw', 'ink'), f.line('M20.9,30.2 L21.8,29', 0.2, 'wood'), far(30.4, 26.4, 1.6, 'cloth3', 'ink'), far(9.6, 26.4, 1.6, 'cloth3', 'ink'),
      rep(3, (i) => far(1.2 + i * 1.4, 22.4, 1.9, 'cloth3', 'ink')), rep(3, (i) => far(35.2 + i * 1.4, 22.4, 1.9, 'hairw', 'ink')),
      crowd(-1, 41, 9, 7, 9.4, { y: 36.4, jitter: 1.2, seed: 82, arms: 0.5, skirts: 0.2, tops: ['cloth3', 'cloth4', 'hairw', 'clay', 'cloth1', 'cloth2'] }),
      f.line('M33.4,26.4 V20.4', 0.25, 'wood'), f.rect(33.5, 20.4, 3, 1.9, 'cloth4'),
    ].join('') },

  { ...r2('era-1988-stadium-flame'), id: 'era-1988-stadium-flame-r3', approved: false,
    draws: 'r2 성화대에 더함 — 우리 앞줄 관중의 뒷모습(팔 든 사람·작은 태극기), 트랙을 달리는 성화 봉송 주자, 잔디의 기수단 행렬.',
    ft3: '오륜·휘장·글자 0. 깃발은 태극기(일반형)와 빈 천. 사람은 뒷모습·먼 인물(얼굴 0).',
    draw: () => r2('era-1988-stadium-flame').draw() + [
      walker(8.6, 25.6, 2.6, { top: 'cloth3', bottom: 'cloth3' }, 1, 1), f.line('M9.4,23.6 L9.9,22.6', 0.2, 'wood'), flame(9.95, 22.6, 0.9, 0.7),
      rep(9, (i) => far(13 + i * 1.6, 27.6 + (i % 2) * 0.2, 1.8, ['cloth3', 'cloth4', 'clay', 'hairw'][i % 4], 'ink') + f.line(`M${13.4 + i * 1.6},26.2 V24.4`, 0.14, 'wood') + f.rect(13.45 + i * 1.6, 24.4, 0.9, 0.6, ['cloth3', 'clay', 'cloth4', 'green'][i % 4])),
      crowd(-1, 41, 9, 7, 9.4, { y: 36.4, jitter: 1.2, seed: 88, arms: 0.4, skirts: 0.25, tops: ['cloth3', 'cloth4', 'hairw', 'clay', 'cloth1', 'cloth3'], carry: ['flag'] }),
    ].join('') },

  // 같은 해 둘째 그림(무겁지 않음 — 1987년 6월이 무거운 쪽이라 `eraOf`는 6월을 먼저 고른다. 가리기를 켜면 12월 투표소가 아니라 그해 일상으로)
  { ...r2('era-1987-polling-station'), id: 'era-1987-polling-station-r3', heavy: false, approved: false, alt: true,
    name: '1987년 12월 — 투표소', draws: 'r2 투표소에 더함 — 투표함에 용지를 넣는 유권자의 뒷모습, 뒤에 줄 선 둘, 기표소 커튼 아래 보이는 발.',
    ft3: '정당·후보·구호·벽보 0. 사람은 뒷모습(얼굴 0). 1987년 6월(무거움)의 둘째 그림.',
    draw: () => r2('era-1987-polling-station').draw() + [
      f.rect(19.2, 17.2, 1.6, 0.4, 'ink'), f.rect(21.2, 17.2, 1.6, 0.4, 'ink'), f.rect(30.6, 17.2, 1.6, 0.4, 'ink'),
      person(10.4, 26.2, 10, { top: 'cloth1', bottom: 'ink', arm: 'upR', coat: true }), person(23.2, 29.4, 9, { top: 'clay', bottom: 'roof2', skirt: true, hat: 'scarf', hatTok: 'cloth3' }), person(33.4, 30.4, 9.4, { top: 'hairw', bottom: 'cloth1', coat: true }),
    ].join('') },
];
