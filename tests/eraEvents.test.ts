import { describe, expect, it } from 'vitest';
import { ERA_CAPTION_MAX, ERA_FIRST_MAX, ERA_SECOND_MAX, type EraWindow } from '../src/core/eraWindow';
import { ERA_EVENTS } from '../scripts/eraEvents';
import { ALT_1987_ID, END_ID, ERA_EVENT_TABLE, PENDING_ART, REAL_EVENTS, REAL_WINDOWS, RETIRED_PIECES, WINDOW_COUNT, realById } from './helpers/eraEventsTable';
import { ALARM_WORDS, COMPANY_NAMES_EXTRA, COMPANY_NAMES_FROM_DOC, PARTY_NAMES, actionWordsIn, lineViolations } from './helpers/eraFutureForbidden';

/**
 * SPEC-013 T7 「사건 표 대조」: 데이터(`src/data/eraWindows/d*.ts` — `npm run gen:era`가 사건 표 `scripts/eraEvents.ts`에서 만든 생성 파일)가 부록 A·C 표(`tests/helpers/eraEventsTable.ts`)와
 * **형진 님이 승인한 문장 문서**(`docs/design/era-text-r1.md` — 문서의 표를 직접 읽는다, 복사본끼리 견주지 않는다)와 같은지 잠근다: 사건 수·연대별 수·★·○·재사용 id·그림 대기 목록·문장 규칙.
 * 개정 사유: SPEC-013이 시대의 창을 「사건이 있던 해만」으로 바꿨다 — 옛 SPEC-010 표(U01~U46) 대조(`tests/eraFuture.test.ts`)와 SPEC-009의 140장 구성 시험(`tests/eraWindows.test.ts`)을 이 파일이 대체한다.
 */

const byNo = (no: string): { id: string; row: (typeof ERA_EVENT_TABLE)[number] } => {
  const row = ERA_EVENT_TABLE.find((x) => x.no === no)!;
  return { id: row.id, row };
};
const PARENT_WORDS = ['아버지', '어머니', '부모', '엄마', '아빠'];
/** 계층 낙인 낱말(문장 규칙 3): 둘째 문장에 0 */
const CLASS_WORDS = ['가난', '부자', '흙수저', '금수저', '은수저', '동수저', '빈곤', '부유'];
/** 개인 행동 낱말(완료 기준 8): 사건 문장·캡션에 0 */
const PERSONAL_WORDS = ['야자', '학원', '밤샘', '밤새', '시험', '피시방', '게임', '추첨', '휴대전화를 열'];

describe('부록 A 표와 데이터 (T7 · 완료 기준 2·3·4·9)', () => {
  it('데이터는 51장이다: 사건 49 + 1987 대체 그림 1 + 끝 장면 1 — 일상(daily) 장면 0건, id 유일', () => {
    expect(REAL_WINDOWS.length).toBe(WINDOW_COUNT);
    expect(REAL_WINDOWS.filter((w) => (w.kind as string) === 'daily').length, '일상 0건').toBe(0);
    expect(REAL_WINDOWS.filter((w) => w.kind === 'event').length, '사건 49 + 대체 1').toBe(50);
    expect(REAL_WINDOWS.filter((w) => w.kind === 'base').map((w) => w.id)).toEqual([END_ID]);
    expect(new Set(REAL_WINDOWS.map((w) => w.id)).size).toBe(WINDOW_COUNT);
    expect(REAL_EVENTS.length).toBe(49);
    expect(ERA_EVENT_TABLE.length).toBe(49);
  });

  it('표의 사건 49건이 데이터에 같은 id·해·★·○로 있다 (번호 순서 — 해 오름차순)', () => {
    for (const row of ERA_EVENT_TABLE) {
      const w = realById(row.id);
      expect(w.kind, row.no).toBe('event');
      expect(w.years, `${row.no} ${row.id}: 사건은 한 해짜리`).toEqual([row.year, row.year]);
      expect(w.heavy, `${row.no}: ○`).toBe(row.heavy);
      expect(w.second !== undefined, `${row.no}: ★`).toBe(row.star);
    }
    expect(ERA_EVENT_TABLE.map((r) => r.year)).toEqual([...ERA_EVENT_TABLE.map((r) => r.year)].sort((a, b) => a - b));
    expect(ERA_EVENT_TABLE.filter((r) => r.star).length, '★ 17 (F14 해제)').toBe(17);
    expect(ERA_EVENT_TABLE.filter((r) => r.heavy).length, '○ 16 = 과거 15 + F14').toBe(16);
    expect(REAL_EVENTS.filter((w) => w.second !== undefined).length).toBe(17);
    expect(REAL_EVENTS.filter((w) => w.heavy).length).toBe(16);
    expect(REAL_EVENTS.filter((w) => w.heavy && w.years[0] <= 2026).length, '과거 ○ 15').toBe(15);
  });

  it('연대별 사건 수는 부록 A와 같다: 1940s 2 · 50s 3 · 60s 4 · 70s 4 · 80s 4 · 90s 4 · 2000s 4 · 10s 4 · 20s 4 · 2030s 2 · 40s 2 · 50s 2 · 60s 2 · 70s 2 · 80s 3 · 90s 1 · 2100s 2 = 49', () => {
    const count = (d: number): number => REAL_EVENTS.filter((w) => Math.floor(w.years[0] / 10) * 10 === d).length;
    expect([1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020, 2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100].map(count)).toEqual([2, 3, 4, 4, 4, 4, 4, 4, 4, 2, 2, 2, 2, 2, 3, 1, 2]);
  });

  it('사건은 한 해짜리이고 사건 ages·수저 band 변주는 0건이다 · 같은 해 사건은 1987(6월 + 12월 대체) 하나뿐이다', () => {
    for (const w of REAL_WINDOWS.filter((x) => x.kind === 'event')) {
      expect(w.years[0], w.id).toBe(w.years[1]);
      expect('ages' in w, `${w.id}: 사건 ages 0건`).toBe(false);
      expect('band' in w, `${w.id}: band 0건`).toBe(false);
      expect('secondAges' in w, `${w.id}: secondAges 0건(둘째 문장에 아이 행동이 없다)`).toBe(false);
    }
    const years = REAL_WINDOWS.filter((x) => x.kind === 'event').map((x) => x.years[0]);
    const dup = years.filter((y, i) => years.indexOf(y) !== i);
    expect([...new Set(dup)], '같은 해 사건').toEqual([1987]);
    expect(REAL_WINDOWS.filter((x) => x.kind === 'event' && x.years[0] === 1987).map((x) => x.id).sort()).toEqual(['era-1987-june-street', ALT_1987_ID]);
    expect(realById(ALT_1987_ID).heavy).toBe(false);
    expect(realById(ALT_1987_ID).caption).toBe('12월 직선제 투표');
  });

  it('1987 외 같은 해 사건이 없다 — 2009는 조문 줄 하나(철거 현장 그림은 퇴역), 2027~2029는 사건이 없는 해', () => {
    expect(REAL_WINDOWS.filter((x) => x.years[0] === 2009).map((x) => x.id)).toEqual(['era-2009-square-mourning-queue']);
    for (const y of [2027, 2028, 2029]) expect(REAL_WINDOWS.filter((x) => x.years[0] <= y && x.years[1] >= y), `${y}`).toEqual([]);
  });

  it('사건 표 입구(`scripts/eraEvents.ts`)가 표와 같다: 번호·id·해·피스·★·○·임시 그림 표지 — 입구가 어긋나면 데이터도 어긋난다', () => {
    const entries = ERA_EVENTS.filter((e) => e.no !== 'P16b');
    expect(entries.map((e) => e.no)).toEqual(ERA_EVENT_TABLE.map((r) => r.no));
    for (const e of entries) {
      const row = ERA_EVENT_TABLE.find((r) => r.no === e.no)!;
      expect({ id: e.id, year: e.year, heavy: e.heavy, star: e.second !== undefined }, e.no).toEqual({ id: row.id, year: row.year, heavy: row.heavy, star: row.star });
      expect(e.pending === true, `${e.no} 임시 그림 표지`).toBe(row.art !== 'reuse');
    }
    expect(ERA_EVENTS.length).toBe(50);
  });
});

describe('승인 문서와 데이터 (docs/design/era-text-r1.md — 형진 님 승인 2026-11-08, 추천안)', () => {
  const docs = import.meta.glob('../docs/design/era-text-r1.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const text = Object.values(docs)[0];
  const EVENT_ROW = /^\| ([PF]\d\d)((?: [○★])*) \| (\d{4}) \| (.+?) \((\d+)\) \| (.+?) \((\d+)\) \| (유지|새) \|/gm;
  const SECOND_ROW = /^\| ([PF]\d\d) (\d{4})(?: \(조건부\))? \| (.+?) \((\d+)\) \| (.+?) \((\d+)\) \| (.+?) \((\d+)\) \|/gm;
  const events = [...text.matchAll(EVENT_ROW)];
  const seconds = [...text.matchAll(SECOND_ROW)];

  it('문서에서 읽은 사건 행이 49건이다(공허 통과 방지) — 번호·해가 표와 같다', () => {
    expect(events.map((m) => m[1])).toEqual(ERA_EVENT_TABLE.map((r) => r.no));
    for (const m of events) expect(Number(m[3]), m[1]).toBe(byNo(m[1]).row.year);
  });

  it('데이터의 첫 문장·캡션은 승인된 문서의 글자 하나까지 같고, 문서가 적은 글자 수와 실제 글자 수가 같다 (P13 「10월 대통령 서거」 · P31 「10월 골목 참사」 · P29 「동계」 · P02 새 줄)', () => {
    for (const m of events) {
      const w = realById(byNo(m[1]).id);
      expect(w.caption, `${m[1]} 캡션`).toBe(m[4]);
      expect(w.line, `${m[1]} 첫 문장`).toBe(m[6]);
      expect(m[4].length, `${m[1]} 캡션 글자 수 표기`).toBe(Number(m[5]));
      expect(m[6].length, `${m[1]} 첫 문장 글자 수 표기`).toBe(Number(m[7]));
    }
    expect(realById('era-1979-autumn-martial-street').caption).toBe('10월 대통령 서거');
    expect(realById('era-2022-alley-tape-flowers').caption).toBe('10월 골목 참사');
    expect(realById('era-2018-pyeongchang').line).toBe('2월, 강원도 평창에서 동계 올림픽이 열렸습니다.');
    expect(realById('era-1948-polling-queue').line).toBe('5월, 처음으로 국회의원을 뽑는 선거가 있었습니다.');
    expect(realById('era-2002-world-cup').line, '형진 님 문체 예').toBe('우리나라가 월드컵 4강에 올라 온 나라가 떠들썩했습니다.');
  });

  it('둘째 문장 셋(아래·가운데·위)은 문서와 같다 — 문서에서 읽은 ★ 둘째 문장 행(F14 ★ 해제 — 17행)이 데이터의 17건이다', () => {
    const rows = seconds.filter((m) => m[1] !== 'F14');
    expect(seconds.length, '문서의 ★ 둘째 문장 행: 17(F14 조건부 행은 승인 때 빠졌다 — 있어도 18)').toBeGreaterThanOrEqual(17);
    expect(seconds.length).toBeLessThanOrEqual(18);
    expect(rows.length).toBe(17);
    for (const m of rows) {
      const w = realById(byNo(m[1]).id);
      expect(w.second, m[1]).toEqual({ low: m[3], mid: m[5], high: m[7] });
      expect([m[3].length, m[5].length, m[7].length], `${m[1]} 글자 수 표기`).toEqual([Number(m[4]), Number(m[6]), Number(m[8])]);
    }
    expect(rows.map((m) => m[1]).sort()).toEqual(ERA_EVENT_TABLE.filter((r) => r.star).map((r) => r.no).sort());
    expect(realById('era-2095-flooded-town-leaving-line').second, 'F14 ○ 사건에는 둘째 문장이 없다').toBeUndefined();
  });
});

describe('문장 규칙 (T4 · 완료 기준 5·8)', () => {
  it('글자 수: 첫 문장 ≤ 32 · 둘째 문장 ≤ 28 · 캡션 ≤ 14(공백·쉼표·마침표 포함), 끝 장면만 캡션이 빈 글자다', () => {
    let maxFirst = 0;
    let maxSecond = 0;
    let maxCaption = 0;
    for (const w of REAL_WINDOWS) {
      expect(w.line.length, `${w.id} 첫 문장`).toBeLessThanOrEqual(ERA_FIRST_MAX);
      maxFirst = Math.max(maxFirst, w.line.length);
      if (w.kind === 'base') {
        expect(w.caption, '끝 장면은 캡션이 없다').toBe('');
        continue;
      }
      expect(w.caption.length, `${w.id} 캡션`).toBeGreaterThan(0);
      expect(w.caption.length, `${w.id} 캡션 「${w.caption}」`).toBeLessThanOrEqual(ERA_CAPTION_MAX);
      maxCaption = Math.max(maxCaption, w.caption.length);
      for (const s of w.second === undefined ? [] : Object.values(w.second)) {
        expect(s.length, `${w.id} 둘째 문장 「${s}」`).toBeLessThanOrEqual(ERA_SECOND_MAX);
        maxSecond = Math.max(maxSecond, s.length);
      }
    }
    expect([maxFirst, maxSecond, maxCaption], '실측 최댓값(문서의 32 · 28 · 13)').toEqual([32, 28, 13]);
  });

  it('첫 문장·둘째 문장은 합쇼체 한 문장(「…습니다.」 마침표 하나), 캡션은 마침표·서술어가 없다 · 평가어 0', () => {
    const EVAL = ['참혹', '역사적', '끔찍', '비극', '위대', '안타깝', '충격'];
    for (const w of REAL_WINDOWS) {
      expect(w.line, `${w.id} 첫 문장`).toMatch(/^[^.!?]+습니다\.$/);
      for (const s of w.second === undefined ? [] : Object.values(w.second)) expect(s, `${w.id} 둘째 문장`).toMatch(/^[^.!?]+습니다\.$/);
      expect(w.caption, `${w.id} 캡션`).not.toMatch(/[.!?]|습니다/);
      for (const word of EVAL) expect(`${w.line}${w.caption}`, `${w.id}: 평가어 ${word}`).not.toContain(word);
    }
  });

  it('둘째 문장: 주어는 집·식구, 부모를 가리키는 말 0, 계층 낱말 0, 셋이 서로 다르다 — ★ 17 × 3 = 51 둘째 문장 전수 (Q3 (가))', () => {
    let n = 0;
    for (const w of REAL_EVENTS.filter((x) => x.second !== undefined)) {
      const three = Object.values(w.second!);
      expect(new Set(three).size, `${w.id}: 셋이 서로 다르다`).toBe(3);
      for (const s of three) {
        n++;
        expect(s, `${w.id} 「${s}」: 주어는 집·식구`).toMatch(/^집에(서는|서도|는)? /);
        for (const p of PARENT_WORDS) expect(s, `${w.id}: 부모 낱말 ${p}`).not.toContain(p);
        for (const c of CLASS_WORDS) expect(s, `${w.id}: 계층 낱말 ${c}`).not.toContain(c);
      }
    }
    expect(n).toBe(51);
  });

  it('○(무거운 장면)에는 둘째 문장이 0이고, 사건 문장·캡션에 개인 행동 낱말이 0이며, 1969 중학교 추첨·2000 피시방·2001 휴대전화 같은 옛 줄이 데이터에 없다', () => {
    for (const w of REAL_WINDOWS.filter((x) => x.heavy)) expect(w.second, w.id).toBeUndefined();
    for (const w of REAL_WINDOWS) for (const word of PERSONAL_WORDS) expect(`${w.line} ${w.caption}`, `${w.id}: 개인 행동 ${word}`).not.toContain(word);
    for (const id of ['era-1969-lottery-hall', 'era-2000-pc-bang', 'era-2001-folder-phones-stop']) expect(REAL_WINDOWS.some((w) => w.id === id), id).toBe(false);
  });

  it('정치·재난(○) 문장·캡션에 고유 사건명·상호·인명·사상자 수가 없다: 「이태원」 「삼풍」 「세월호」 「천안함」 · 숫자는 월뿐', () => {
    for (const w of REAL_WINDOWS.filter((x) => x.heavy)) {
      for (const name of ['이태원', '삼풍', '세월호', '천안함', '대구', '명이', '명의']) expect(`${w.line} ${w.caption}`, `${w.id}: ${name}`).not.toContain(name);
      expect(`${w.line} ${w.caption}`.replace(/\d+월/g, ''), `${w.id}: 월 밖의 숫자`).not.toMatch(/\d/);
    }
  });

  it('미래(2027~) 사건 16건: 첫 문장·둘째 문장은 SPEC-010 줄 규칙(숫자·회사·인명·공포어 0, 알파벳은 AI뿐, 정당 0)이고 주인공 행동 낱말 0 · 캡션에도 숫자·알파벳(AI 외)·공포어·회사 이름이 0이다 · 나라 이름은 F11·F15 첫 문장에만', () => {
    const future = REAL_EVENTS.filter((w) => w.years[0] > 2026);
    expect(future.length).toBe(16);
    const COUNTRY = ['미국', '중국', '일본', '독일', '인도', '한국', '미·중', '미중'];
    const allowed: Record<string, string[]> = { 'era-2080s-port-split-two-blocs': ['미·중'], 'era-2100-half-city-demolition-towers': ['한국'] };
    for (const w of future) {
      expect(lineViolations(w.line, ERA_FIRST_MAX), `${w.id} 「${w.line}」`).toEqual([]);
      expect(actionWordsIn(w.line), `${w.id} 행동 낱말`).toEqual([]);
      for (const s of w.second === undefined ? [] : Object.values(w.second)) {
        expect(lineViolations(s, ERA_SECOND_MAX), `${w.id} 「${s}」`).toEqual([]);
        expect(actionWordsIn(s), `${w.id} 「${s}」 행동 낱말`).toEqual([]);
      }
      const cap = w.caption;
      expect(cap, `${w.id} 캡션 숫자`).not.toMatch(/[0-9]/);
      for (const word of cap.match(/[A-Za-z]+/g) ?? []) expect(word, `${w.id} 캡션 알파벳`).toBe('AI');
      for (const word of ALARM_WORDS) expect(cap, `${w.id} 캡션 공포어`).not.toContain(word);
      for (const name of [...COMPANY_NAMES_FROM_DOC, ...COMPANY_NAMES_EXTRA, ...PARTY_NAMES]) expect(cap.toLowerCase(), `${w.id} 캡션 이름`).not.toContain(name.toLowerCase());
      for (const c of COUNTRY) {
        expect(cap, `${w.id} 캡션 나라 이름 ${c}`).not.toContain(c);
        for (const s of w.second === undefined ? [] : Object.values(w.second)) expect(s, `${w.id} 둘째 문장 나라 이름 ${c}`).not.toContain(c);
        if (w.line.includes(c)) expect(allowed[w.id] ?? [], `${w.id}: 나라 이름 ${c}는 허용 줄에만`).toContain(c);
      }
    }
    // 검사기가 공허하지 않다
    expect(lineViolations('2030년에 일이 늘었습니다.', 32).join()).toContain('숫자');
    expect(actionWordsIn('식구가 일했습니다.')).toEqual(['일했습니다.']);
  });
});

describe('그림 구성과 대기 목록 (T2 · 부록 C · 완료 기준 9)', () => {
  it('유지 43장 = 재사용 37 + 수정 6, 새 8 — 표의 art 종류 수 (재사용 37은 1987 대체·끝 장면 포함)', () => {
    const n = (k: string): number => ERA_EVENT_TABLE.filter((r) => r.art === k).length;
    expect([n('reuse') + 2, n('fix'), n('new')]).toEqual([37, 6, 8]); // 사건 재사용 35 + 1987 대체 1 + 끝 장면 1
    expect(n('reuse') + n('fix') + n('new')).toBe(49);
  });

  it('그림 대기 목록(PENDING_ART)은 표의 수정 6 + 새 8 = 14건과 같고, 사건 표 입구의 임시 그림 표지·조각 id가 같다 — 임시 그림은 지금 승인된 그림이다', () => {
    const pendingRows = ERA_EVENT_TABLE.filter((r) => r.art !== 'reuse');
    expect(Object.keys(PENDING_ART).sort()).toEqual(pendingRows.map((r) => r.id).sort());
    expect(Object.keys(PENDING_ART).length).toBe(14);
    for (const row of pendingRows) {
      expect(PENDING_ART[row.id].work, row.id).toBe(row.art);
      expect(realById(row.id).draw, `${row.id}: 임시 그림`).toBe(PENDING_ART[row.id].piece);
      expect(ERA_EVENTS.find((e) => e.id === row.id)!.piece, row.id).toBe(PENDING_ART[row.id].piece);
    }
    // 재사용 그림은 자기 조각 그대로
    for (const row of ERA_EVENT_TABLE.filter((r) => r.art === 'reuse')) expect(realById(row.id).draw, row.id).toBe(row.id);
    expect(realById(ALT_1987_ID).draw).toBe(ALT_1987_ID);
  });

  it('퇴역한 조각은 데이터에 없다 — 임시 그림으로 쓰는 것(그림 대기 목록)만 예외다', () => {
    const temp = new Set(Object.values(PENDING_ART).map((v) => v.piece));
    const draws = new Set(REAL_WINDOWS.map((w) => w.draw));
    for (const id of RETIRED_PIECES) if (!temp.has(id)) expect(draws.has(id), `${id}: 퇴역한 그림`).toBe(false);
    // 임시 그림 중 새 그림 8장 대신 쓰는 퇴역 조각 8개는 그림 대기가 끝나면 빠진다
    expect([...temp].filter((p) => RETIRED_PIECES.includes(p)).length).toBe(8);
  });

  // 배포 전 게이트(`npm run check:era-art`와 같다): 평소에는 건너뛴다. 배포 때 `ERA_ART_GATE=1 npm test`로 켠다
  it.runIf((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.ERA_ART_GATE === '1')('배포 게이트: 그림 대기 0건 — 새 그림 8장·수정 6장이 모두 승인되어 들어왔다', () => {
    expect(Object.keys(PENDING_ART)).toEqual([]);
  });

  it('데이터의 모든 장면은 approved: true이고 조각 마크업이 있으며(그림 안 글자 요소 0), 임시 그림 14장도 승인된 조각이다', () => {
    for (const w of REAL_WINDOWS) expect(w.approved as boolean, w.id).toBe(true);
    const sources = import.meta.glob('../src/data/eraWindows/d????.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    for (const [path, src] of Object.entries(sources)) expect(src, `${path}: 그림 안 글자 0(허용 목록이 비어 있다)`).not.toMatch(/<text|<tspan/);
  });
});

describe('판당 사건 해 수 보고 (게이트: 18~34, 완료 기준 2)', () => {
  it('출생 1950·1965·1975·1990·2005·2020 × 구간 3 × 가리기 2에서 85세까지의 사건 해 수가 18~34 안이다(보고 값은 dev 로그)', async () => {
    const { eraRowsOf } = await import('../src/core/eraWindow');
    const ctx = (band: 'low' | 'mid' | 'high', gentle: boolean): Parameters<typeof eraRowsOf>[2] => ({ regionKey: '서울', gentle, seed: 777, windows: REAL_WINDOWS as readonly EraWindow[], band });
    const out: string[] = [];
    for (const birth of [1950, 1965, 1975, 1990, 2005, 2020]) {
      const counts: number[] = [];
      for (const band of ['low', 'mid', 'high'] as const) for (const gentle of [false, true]) counts.push(eraRowsOf(birth, 85, ctx(band, gentle)).length);
      out.push(`${birth}년생 ${Math.min(...counts)}~${Math.max(...counts)}`);
      for (const c of counts) {
        expect(c, `${birth}년생 사건 해 수`).toBeGreaterThanOrEqual(18);
        expect(c, `${birth}년생 사건 해 수`).toBeLessThanOrEqual(34);
      }
    }
    console.log(`[SPEC-013 판당 시대의 창 횟수(85세까지)] ${out.join(' · ')}`);
  });
});
