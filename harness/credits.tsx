import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GAME_KEY, parseGame, type EndingGame } from '../src/core';
import { loadCredits, type CreditsLoaded } from '../src/credits/loader';
import '../src/data/installAll'; // 지연 로드 데이터(이벤트 풀·출생 연도 표·인용 테이블)를 정적으로 놓는다 — core의 기본 인자가 읽는다(MG8)
import '../src/styles/fonts.css';
import '../src/styles/tokens.css';
import '../src/styles.css';
import '../src/styles/title.css';
import '../src/styles/doc.css';
import '../src/styles/dash.css';

/**
 * 「이 삶의 이름들」(SPEC-022 EC1)의 가림 설정을 **열린 채로** 바꿔 보는 하니스 (완료 기준 8 — 엔딩 화면 안에는 가림 스위치가 없다).
 * 개발 서버(npm run dev)에서만 /harness/credits.html 로 열린다. vite build는 index.html만 묶으므로 제품 번들에 들어가지 않는다.
 * 앱이 저장해 둔 끝난 판(`localStorage`의 게임 저장 — e2e가 심어 둔다)을 읽어 실제 `CreditsScreen`을 그리고, 두 버튼이 `gentle` 속성만 바꾼다:
 * 끔 → 켬: 열린 건 없이 가려지고, 켬 → 끔: 원문으로 나온다. 화면은 저장을 쓰지 않는다.
 */

function Harness() {
  const [loaded, setLoaded] = useState<{ game: EndingGame; credits: CreditsLoaded } | null>(null);
  const [gentle, setGentle] = useState(new URLSearchParams(window.location.search).get('gentle') === '1');
  const closeRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const game = parseGame(window.localStorage.getItem(GAME_KEY));
    if (game === null || game.phase !== 'ending') return;
    const ended = game as EndingGame;
    void loadCredits(ended.character.birthYear, ended.death.age, ended.birthReport !== null).then((credits) => setLoaded({ game: ended, credits }));
  }, []);
  return (
    <div className="page ending-page" data-testid="harness-credits">
      <div style={{ display: 'flex', gap: 8, padding: 8 }}>
        <button type="button" className="btn btn--secondary btn--sm" data-testid="gentle-on" onClick={() => setGentle(true)}>
          가림 켬
        </button>
        <button type="button" className="btn btn--secondary btn--sm" data-testid="gentle-off" onClick={() => setGentle(false)}>
          가림 끔
        </button>
        <output data-testid="gentle-state">{gentle ? 'on' : 'off'}</output>
      </div>
      {loaded === null ? null : <loaded.credits.Screen game={loaded.game} gentle={gentle} windows={loaded.credits.windows} onClosed={() => undefined} closeRef={closeRef} />}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
