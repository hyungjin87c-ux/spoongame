import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DEFAULT_SETTINGS, createEventPool, type BirthReport, type Character, type EventDef, type EventPool } from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { LifeScreen, type LifeGame } from '../src/screens/LifeScreen';
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
 * 보여 주는 선택지는 requires와 무관하게 그 이벤트의 선택지 전부다(최악의 경우: 3개가 모두 보이는 경우).
 */
/** 지금 세상은 2026년생만 있다(SPEC-003 Q1) — 대시보드 또래 칸이 출생 연도에서 시대를 읽으므로 실제와 같은 연도를 쓴다 */
const character: Character = { name: '김민준', gender: 'male', birthYear: 2026, parentWealth: 3, parenting: 'free', looks: 50 };
const stats = { education: 40, health: 60, happiness: 50, relationships: 50 };
/** 출생신고 상세(대시보드 프로필·식구가 읽는다) — 이 하니스는 이벤트 카드의 레이아웃만 보지만 화면이 받는 모양은 실제와 같다 */
const birthReport: BirthReport = { month: 3, region: '서울', sigunguSido: '서울', sigungu: '종로구', mother: { age: 31, job: 'clerk' }, father: { age: 34, job: 'professional' }, housing: 'own', birthWeightKg: 3.2, birthOrder: 2 };
/** 서버·타이머 없이 고정된 올해 시계(진행률 0) */
const CLOCK: YearClock = { get: () => 0, subscribe: () => () => undefined };

function stateFor(pool: EventPool, eventId: string): LifeGame {
  const ev = pool.byId.get(eventId);
  if (ev === undefined || ev.choices === undefined) throw new Error(`선택지 이벤트가 아니다: ${eventId}`);
  const age = 30;
  return {
    phase: 'life',
    era: 'present',
    lifeLength: 'short30',
    character,
    stats,
    birthStats: { ...stats },
    age,
    assets: { net: 3000, income: 4500, debt: 0, incomeAdj: 0, dwelling: 'rent' }, // 스키마 v8: 30세라 자산이 있다
    familyFund: 0,
    history: [
      { age: 0, kind: 'stage', text: '2026년, 남자아이로 태어났다.' },
      { age: 20, kind: 'stage', text: '스무 살이 되었다. 이제 집안 형편이 아니라 내가 가진 것으로 살아가야 한다.' },
      { age: 24, kind: 'event', title: '끝나지 않는 일', text: '일은 끝이 없었다. 퇴근한 뒤에도 연락이 이어졌고, 쉬는 날에도 마음 한쪽은 일터에 남아 있었다.', eventId: 'youth-work-pressure' },
      { age: 27, kind: 'choice', title: '살 곳을 구하는 일', text: '좁은 방에 짐을 풀었다. 매달 빠져나가는 돈은 아팠지만 내 방이라는 것이 든든했다.', choice: '보증금이 낮은 월세방을 구한다', eventId: 'youth-housing' },
    ],
    flags: [],
    seen: { [eventId]: age },
    pending: { eventId, key: `${eventId}@${age}`, age, choiceIds: ev.choices.map((c) => c.id) },
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
    /** ids: 풀의 선택지 이벤트 / show: 풀의 이벤트를 보인다 / showCustom: 풀에 없는 이벤트(예: 길이 권장치 끝값으로 만든 최악의 이벤트)를 보인다 */
    __layout: { ids: string[]; show: (id: string) => void; showCustom: (ev: EventDef) => void };
  }
}

const noop = () => undefined;

function Harness() {
  const ids = EVENT_POOL.events.filter((e) => e.choices !== undefined).map((e) => e.id);
  const [id, setId] = useState(ids[0]);
  const [custom, setCustom] = useState<EventDef | null>(null);
  useEffect(() => {
    window.__layout = {
      ids,
      show: (next) => {
        setCustom(null);
        setId(next);
      },
      showCustom: setCustom,
    };
  }, [ids]);
  const pool = custom !== null ? createEventPool([custom]) : EVENT_POOL;
  const shown = custom !== null ? custom.id : id;
  return (
    <LifeScreen
      key={shown}
      pool={pool}
      game={stateFor(pool, shown)}
      settings={DEFAULT_SETTINGS}
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
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
