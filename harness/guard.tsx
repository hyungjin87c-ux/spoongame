import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GuardedButton } from '../src/ui/GuardedButton';

/**
 * GuardedButton의 실제 DOM 동작을 e2e(e2e/guard.spec.ts)로 확인하기 위한 하니스 (R-029, R-036).
 * 개발 서버(npm run dev)에서만 /harness/guard.html 로 열린다. vite build는 index.html만 묶으므로 제품 번들에 들어가지 않는다.
 * 핵심 시나리오:
 *  - 같은 버튼 요소가 언마운트되지 않은 채 guardKey만 바뀐다(인생 화면에서 다음 선택지가 같은 자리에 뜨는 경우, R-029).
 *  - 호출자가 aria-disabled를 넘기는 버튼("held")과 가드가 합쳐진다: 가드 × 호출자 비활성의 4칸 진리표를 실제 클릭·Enter·Space로 본다(R-036).
 *    held 버튼은 guarded와 같은 guardKey를 쓰므로 guarded가 활성화되면 held의 가드도 풀린 것이다(같은 시점에 시작한 같은 길이의 타이머).
 */
const KEYS: Array<string | number> = ['A', 'B', 3];

function Harness() {
  const [index, setIndex] = useState(0);
  const [clicks, setClicks] = useState<string[]>([]);
  const [heldClicks, setHeldClicks] = useState(0);
  const [heldInactive, setHeldInactive] = useState(true);
  const key = KEYS[index % KEYS.length];
  return (
    <main style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <button type="button" data-testid="bump" onClick={() => setIndex((i) => i + 1)}>
        guardKey 바꾸기
      </button>
      <GuardedButton data-testid="guarded" guardKey={key} onClick={() => setClicks((c) => [...c, String(key)])}>
        누르기
      </GuardedButton>
      <output data-testid="key">{String(key)}</output>
      <output data-testid="clicks">{clicks.join(',')}</output>

      <button type="button" data-testid="toggle-held" onClick={() => setHeldInactive((v) => !v)}>
        호출자 비활성 바꾸기
      </button>
      <GuardedButton data-testid="held" guardKey={key} aria-disabled={heldInactive} onClick={() => setHeldClicks((n) => n + 1)}>
        호출자가 막을 수 있는 버튼
      </GuardedButton>
      <output data-testid="held-state">{heldInactive ? 'inactive' : 'active'}</output>
      <output data-testid="held-clicks">{heldClicks}</output>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
