import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createEventPool, type Character, type EventDef, type EventPool, type GameState } from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { LifeScreen } from '../src/screens/LifeScreen';
import '../src/styles.css';

/**
 * 모든 선택지 이벤트의 실제 레이아웃(실제 LifeScreen + 실제 CSS)을 e2e(e2e/layout.spec.ts)로 재기 위한 하니스 (R-042).
 * 개발 서버(npm run dev)에서만 /harness/layout.html 로 열린다. vite build는 index.html만 묶으므로 제품 번들에 들어가지 않는다.
 * 앱 전체를 이벤트마다 새로 띄우면 이벤트 수 × 뷰포트 수만큼 페이지를 새로 열어야 해서, 화면 컴포넌트만 띄우고 window.__layout.show(id)로 이벤트를 바꾼다.
 * 보여 주는 선택지는 requires와 무관하게 그 이벤트의 선택지 전부다(최악의 경우: 3개가 모두 보이는 경우).
 */
const character: Character = { name: '김민준', gender: 'male', birthYear: 2012, parentWealth: 3, parenting: 'free', looks: 50 };
const stats = { wealth: 45, education: 40, health: 60, happiness: 50, relationships: 50 };

function stateFor(pool: EventPool, eventId: string): GameState & { character: Character } {
  const ev = pool.byId.get(eventId);
  if (ev === undefined || ev.choices === undefined) throw new Error(`선택지 이벤트가 아니다: ${eventId}`);
  const age = 30;
  return {
    phase: 'life',
    era: 'present',
    character,
    stats,
    birthStats: { ...stats },
    age,
    history: [
      { age: 0, kind: 'stage', text: '2012년, 남자아이로 태어났다.' },
      { age: 20, kind: 'stage', text: '스무 살이 되었다. 이제 집안 형편이 아니라 내가 가진 것으로 살아가야 한다.' },
      { age: 24, kind: 'event', title: '끝나지 않는 일', text: '일은 끝이 없었다. 퇴근한 뒤에도 연락이 이어졌고, 쉬는 날에도 마음 한쪽은 일터에 남아 있었다.', eventId: 'youth-work-pressure' },
      { age: 27, kind: 'choice', title: '살 곳을 구하는 일', text: '좁은 방에 짐을 풀었다. 매달 빠져나가는 돈은 아팠지만 내 방이라는 것이 든든했다.', choice: '보증금이 낮은 월세방을 구한다', eventId: 'youth-housing' },
    ],
    flags: [],
    seen: { [eventId]: age },
    pending: { eventId, key: `${eventId}@${age}`, age, choiceIds: ev.choices.map((c) => c.id) },
    lastChoiceAge: age,
    death: null,
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
      settings={{ speed: 1, autoMode: false }}
      tick={null}
      onChoose={noop}
      onSkip={noop}
      onSpeed={noop}
      onAuto={noop}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
