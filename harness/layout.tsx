import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DEFAULT_SETTINGS, ERAS, citationFor, citationIdFor, citationValidRange, createEventPool, worstCaseVisibleChoiceIds, type BirthReport, type Character, type Era, type EventDef, type EventPool, type HistoryEntry, type NoteCardDef } from '../src/core';
import { ERA_CONFIG } from '../src/data/birthTable';
import { getCitation } from '../src/data/citationsAccess';
import { EVENT_POOL } from '../src/data/events';
import { NOTE_CARDS } from '../src/data/noteCards';
import { LifeScreen, type LifeGame } from '../src/screens/LifeScreen';
import { NoteSheet } from '../src/ui/dash/NoteSheet';
import type { YearClock } from '../src/ui/useYearClock';
import '../src/styles/tokens.css';
import '../src/styles.css';
import '../src/styles/title.css';
import '../src/styles/doc.css';
import '../src/styles/dash.css';

/**
 * 모든 선택지 이벤트의 실제 레이아웃(실제 LifeScreen(대시보드) + 실제 CSS)을 e2e(e2e/layout.spec.ts)로 재기 위한 하니스 (R-042, M4에서 대시보드로 갱신).
 * 개발 서버(npm run dev)에서만 /harness/layout.html 로 열린다. vite build는 index.html만 묶으므로 제품 번들에 들어가지 않는다.
 * 앱 전체를 이벤트마다 새로 띄우면 이벤트 수 × 뷰포트 수만큼 페이지를 새로 열어야 해서, 화면 컴포넌트만 띄우고 window.__layout.show(id)로 이벤트를 바꾼다.
 * 보여 주는 선택지는 requires와 무관하게 **같은 상태에서 함께 보일 수 있는 가장 큰 묶음**이다(최악의 경우: 3개가 모두 보이는 경우 — 정의가 4개인 infant-new-sibling은 라벨이 더 긴 묶음, M7a r3).
 */
/** 지금 세상은 2026년생만 있다(SPEC-003 Q1) — 대시보드 또래 칸이 출생 연도에서 시대를 읽으므로 실제와 같은 연도를 쓴다 */
const character: Character = { name: '김민준', gender: 'male', birthYear: 2026, parentWealth: 3, parenting: 'free', looks: 50 };
const stats = { education: 40, health: 60, happiness: 50, relationships: 50 };
/** 출생신고 상세(대시보드 프로필·식구가 읽는다) — 이 하니스는 이벤트 카드의 레이아웃만 보지만 화면이 받는 모양은 실제와 같다 */
const birthReport: BirthReport = { month: 3, region: '서울', sigunguSido: '서울', sigungu: '종로구', mother: { age: 31, job: 'clerk' }, father: { age: 34, job: 'professional' }, housing: 'own', birthWeightKg: 3.2, birthOrder: 2 };
/** 서버·타이머 없이 고정된 올해 시계(진행률 0) */
const CLOCK: YearClock = { get: () => 0, subscribe: () => () => undefined };

/** 인용 박스 감사용(D-67): 카드를 어느 세상·어느 게임 속 연도에 보일지 */
interface Cell {
  era: Era;
  /** 이 세상에 실제로 있는 출생 연도(대시보드 또래 칸이 출생 연도에서 시대를 읽는다) */
  birthYear: number;
  age: number;
}

function stateFor(pool: EventPool, eventId: string, extraHistory: readonly HistoryEntry[] = [], cell: Cell | null = null): LifeGame {
  const ev = pool.byId.get(eventId);
  if (ev === undefined || ev.choices === undefined) throw new Error(`선택지 이벤트가 아니다: ${eventId}`);
  const age = cell?.age ?? 30;
  return {
    phase: 'life',
    era: cell?.era ?? 'present',
    lifeLength: 'short30',
    character: cell === null ? character : { ...character, birthYear: cell.birthYear },
    stats,
    birthStats: { ...stats },
    age,
    assets: { net: 3000, income: 4500, debt: 0, incomeAdj: 0, dwelling: 'rent' }, // 스키마 v8: 30세라 자산이 있다
    familyFund: 0,
    history: [
      { age: 0, kind: 'stage', text: '2026년, 남자아이로 태어났다.' },
      { age: 20, kind: 'stage', text: '스무 살이 되었다. 이제 집안 형편이 아니라 내가 가진 것으로 살아가야 한다.' },
      { age: 24, kind: 'event', title: '끝나지 않는 일', text: '일은 끝이 없었습니다. 퇴근한 뒤에도 연락이 이어졌고, 쉬는 날에도 마음 한쪽은 일터에 남아 있었습니다.', eventId: 'youth-work-pressure' },
      { age: 27, kind: 'choice', title: '살 곳을 구하는 일', text: '좁은 방에 짐을 풀었습니다. 매달 빠져나가는 돈은 아팠지만 빚 없이 얻은 내 방이 든든했습니다.', choice: '보증금이 낮은 월세방을 구한다', eventId: 'youth-housing' },
      // 길이 표본(M7e-1)이 더하는 인생 기록 줄 — 권장 최대 길이로 만든 합쇼체 사건·결과 줄
      ...extraHistory,
    ],
    flags: [],
    seen: { [eventId]: age },
    pending: { eventId, key: `${eventId}@${age}`, age, choiceIds: worstCaseVisibleChoiceIds(ev) },
    lastChoiceAge: age,
    death: null,
    birthReport,
    peerSeed: 4242,
    paused: false,
    seed: 1,
    rngState: 1,
  };
}

declare global {
  interface Window {
    /** ids: 풀의 선택지 이벤트 / show: 풀의 이벤트를 보인다 / showCustom: 풀에 없는 이벤트(예: 길이 권장치 끝값으로 만든 최악의 이벤트)를 보인다. history를 주면 인생 기록에 그 줄들이 더해진다(M7e-1 길이 표본) */
    __layout: { ids: string[]; show: (id: string) => void; showCustom: (ev: EventDef, history?: HistoryEntry[]) => void; cells: Array<{ id: string; era: Era; birthYear: number; age: number; year: number; citation: string }>; showCell: (id: string, era: Era, birthYear: number, age: number) => void };
  }
}

const noop = () => undefined;

/**
 * 연결된 카드 × 세상 전부(인용 박스가 실제로 보이는 칸) — 각 칸을 보일 게임 속 연도는 인용의 유효 범위가 시작하는 해다(없으면 2026). 인용 박스는 앱과 같은 `citationFor`·`CitationBox`가 그린다(D-67).
 * 대기 상태의 나이·출생 연도는 합성이라 인용 박스 말고 다른 글(또래·기록)은 이 감사의 대상이 아니다.
 */
function connectedCells(): Array<{ id: string; era: Era; birthYear: number; age: number; year: number; citation: string }> {
  const out: Array<{ id: string; era: Era; birthYear: number; age: number; year: number; citation: string }> = [];
  for (const ev of EVENT_POOL.events) {
    if (ev.choices === undefined) continue;
    for (const era of ERAS) {
      const cid = citationIdFor(ev, era);
      const c = cid === null ? undefined : getCitation(cid);
      if (cid === null || c === undefined) continue;
      const range = citationValidRange(c);
      // 이 세상의 가장 이른 출생 연도로, 인용이 보이는 해 안에서 30세 근처에 놓는다(나이는 0~100 안)
      const birthYear = ERA_CONFIG[era].birthYears.min;
      const year = Math.min(Math.max(birthYear + 30, range.from), range.until);
      const age = year - birthYear;
      if (age >= 0 && age <= 100 && citationFor(ev, era, year) !== null) out.push({ id: ev.id, era, birthYear, age, year, citation: cid });
    }
  }
  // 기록 카드(M7c)의 인용 — 시트 안 인용 박스. 카드가 뜨는 나이(창의 시작)에 보인다(D-73: 89칸 + 기록 카드 ① × 세 세상 = 92칸)
  for (const card of NOTE_CARDS) {
    if (card.citation === undefined) continue;
    for (const era of ERAS) {
      const birthYear = ERA_CONFIG[era].birthYears.min;
      const age = card.ageRange.min;
      const year = birthYear + age;
      const cid = citationIdFor(card, era);
      if (cid !== null && citationFor(card, era, year) !== null) out.push({ id: card.id, era, birthYear, age, year, citation: cid });
    }
  }
  return out;
}
const NOTE_BY_ID = new Map<string, NoteCardDef>(NOTE_CARDS.map((c) => [c.id, c]));
const CELLS = connectedCells();

/**
 * 기본 = 자동 모드 켜짐(비모달 인라인 카드 — 대시보드 가운데 열 맨 위, 카드 전체가 문서 안에 놓인다). ?mode=sheet 이면 수동(모달 시트, M7b M-6 — 카드가 94dvh 이하의 고정 상자 안에서 스크롤된다).
 * 낱말 끊김·줄바꿈 감사처럼 카드 전체를 한 번에 재야 하는 e2e는 기본(인라인)을 쓰고, 시트의 안쪽 스크롤 레이아웃은 e2e/layout.spec.ts·m7b-*가 따로 잰다.
 */
const SHEET = new URLSearchParams(window.location.search).get('mode') === 'sheet';
const SETTINGS = { ...DEFAULT_SETTINGS, autoMode: !SHEET };

function Harness() {
  const ids = EVENT_POOL.events.filter((e) => e.choices !== undefined).map((e) => e.id);
  const [id, setId] = useState(ids[0]);
  const [custom, setCustom] = useState<EventDef | null>(null);
  const [extraHistory, setExtraHistory] = useState<readonly HistoryEntry[]>([]);
  const [cell, setCell] = useState<Cell | null>(null);
  useEffect(() => {
    window.__layout = {
      ids,
      cells: CELLS,
      show: (next) => {
        setCustom(null);
        setExtraHistory([]);
        setCell(null);
        setId(next);
      },
      showCell: (next, era, birthYear, age) => {
        setCustom(null);
        setExtraHistory([]);
        setCell({ era, birthYear, age });
        setId(next);
      },
      showCustom: (ev, history) => {
        setExtraHistory(history ?? []);
        setCustom(ev);
      },
    };
  }, [ids]);
  const pool = custom !== null ? createEventPool([custom]) : EVENT_POOL;
  const shown = custom !== null ? custom.id : id;
  // 기록 카드 칸(M7c D-73): 결정 카드 없이 인생 화면 위에 기록 시트(NoteSheet)를 얹어 시트 안 인용 박스를 잰다
  const noteCard = custom === null && cell !== null ? NOTE_BY_ID.get(id) : undefined;
  const game = stateFor(pool, noteCard !== undefined ? ids[0] : shown, extraHistory, cell);
  const life = (
    <LifeScreen
      key={shown}
      pool={pool}
      game={noteCard !== undefined ? { ...game, pending: null, seen: {} } : game}
      settings={SETTINGS}
      clock={CLOCK}
      exitOpen={false}
      onExitOpen={noop}
      onChoose={noop}
      onSkip={noop}
      onSpeed={noop}
      onAuto={noop}
      onPause={noop}
      onBgm={noop}
      onTheme={noop}
      onExit={noop}
      minute={29_846_880}
    />
  );
  if (noteCard === undefined) return life;
  return (
    <>
      {life}
      <NoteSheet via="auto" card={noteCard} game={{ ...game, pending: null, seen: {} }} count={0} cardsOn guardKey={noteCard.id} onSave={noop} onDismiss={noop} onToggleCards={noop} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
