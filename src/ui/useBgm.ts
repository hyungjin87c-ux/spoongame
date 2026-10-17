import { useEffect, useRef, useState } from 'react';
import { createBgm, type BgmEngine } from '../audio/bgm';

/**
 * 사용자 활성화 입력 (R-325): 브라우저가 「사용자가 눌렀다」로 치고 소리 장치를 깨우게 두는 입력 — 마우스·터치를 **뗄 때**(`pointerup`·`touchend`·`click`)와 키를 누를 때(`keydown`).
 * `touchstart`와 터치 `pointerdown`은 모바일에서 사용자 활성화가 아니다(스크롤의 시작일 수 있다) — 거기서 `resume()`을 불러 봐야 장치가 계속 멈춰 있어, 저장된 「켜짐」인데 무음이 된다. 그래서 목록에 없다.
 * 이 목록을 쓰는 곳은 이 파일 한 곳이고 tests/useBgm.test.ts가 목록을 잠근다.
 */
export const BGM_ACTIVATION_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'] as const;

/** 활성화 입력이 들어왔을 때 BGM 연주기에 무엇을 할지 */
export type BgmInputAction = 'none' | 'start' | 'resume';

/**
 * 사용자 활성화 입력 한 번에 대한 결정 (순수 함수 — tests/useBgm.test.ts가 표로 본다):
 *  - 연주를 원하지 않으면(`want` = 설정이 켜짐이고 BGM이 흐르는 화면) 아무것도 하지 않는다 — 꺼짐이거나 첫 화면·엔딩에서는 소리 장치도 만들지 않는다.
 *  - 탭이 가려져 있으면 아무것도 하지 않는다(가시성 효과가 멈춘 시계를 다시 흐르게 한다).
 *  - 아직 연주 중이 아니면 `start`: 소리 장치를 **이 입력 안에서** 만들어 깨운다(저장된 「켜짐」으로 새로 연 뒤 첫 입력 — 입력 밖의 효과에서 만들면 사용자 활성화가 지나 있을 수 있다).
 *  - 연주 중인데 장치가 멈춰 있으면(`suspended` — 브라우저가 처음 깨우기를 거절했거나 iOS가 전화·알림으로 중단) `resume`: 다음 입력마다 다시 깨운다.
 */
export function bgmInputAction({ want, hidden, playing, suspended }: { want: boolean; hidden: boolean; playing: boolean; suspended: boolean }): BgmInputAction {
  if (!want || hidden) return 'none';
  if (!playing) return 'start';
  return suspended ? 'resume' : 'none';
}

/**
 * BGM을 화면 상태에 맞춰 켜고 끈다 (SPEC-003 DB4). 앱에서 한 곳(Game)에서만 부른다.
 *  - `on`: 설정의 BGM 켬/끔, `volume`: 0~100, `active`: BGM이 흐르는 화면인가(인생 화면 — 컨트롤이 있는 곳에서만 소리가 난다. 첫 화면·엔딩 등에서는 끌 방법이 없으므로 조용하다).
 *  - 모바일 자동재생 정책(R-325): 소리 장치는 **사용자 활성화 입력**(`BGM_ACTIVATION_EVENTS` — 마우스·터치를 뗄 때·클릭·키 누름)이 들어온 뒤에만 만든다.
 *    저장된 설정이 「켜짐」이어도 새로고침 직후에는 소리 장치가 0개이고 조용하다가, 첫 활성화 입력 안에서 만들어 시작한다 — BGM 버튼을 누른 입력이 곧 그 입력이다.
 *    연주를 원하는 동안 장치가 멈춰 있으면(`suspended`) 다음 입력마다 다시 `resume()`한다 — 한 번의 거절·중단으로 영영 무음이 되지 않는다.
 *  - 탭이 가려지면 일시 중단하고(시계를 멈춘다) 다시 보이면 이어간다. 꺼지거나 화면이 바뀌면 멈춘다.
 *  - 음원·외부 요청은 없다. AudioContext를 못 만드는 환경이면 아무 소리도 나지 않고 오류도 없다.
 */
export function useBgm({ on, volume, active }: { on: boolean; volume: number; active: boolean }): void {
  const engine = useRef<BgmEngine | null>(null);
  const [gesture, setGesture] = useState(false);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  // 입력 핸들러(브라우저 이벤트)가 렌더 밖에서 최신 설정을 읽는다
  const latest = useRef({ on, volume, active });
  latest.current = { on, volume, active };

  // 사용자 활성화 입력: 첫 입력이면 알리고(효과가 화면 상태 변화에 맞춰 시작·정지하게), 그 입력 안에서 곧바로 소리 장치를 만들거나 깨운다
  useEffect(() => {
    const onInput = () => {
      setGesture(true);
      const now = latest.current;
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      const e = engine.current;
      const action = bgmInputAction({ want: now.on && now.active, hidden, playing: e?.isPlaying() ?? false, suspended: e?.isSuspended() ?? false });
      if (action === 'start') {
        if (engine.current === null) engine.current = createBgm();
        engine.current.start(now.volume);
      } else if (action === 'resume') {
        e?.resume();
      }
    };
    for (const type of BGM_ACTIVATION_EVENTS) window.addEventListener(type, onInput, { capture: true, passive: true });
    return () => {
      for (const type of BGM_ACTIVATION_EVENTS) window.removeEventListener(type, onInput, { capture: true });
    };
  }, []);

  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  const wantPlaying = on && active && gesture;
  useEffect(() => {
    if (!wantPlaying) {
      engine.current?.stop();
      return;
    }
    if (engine.current === null) engine.current = createBgm();
    engine.current.start(volume);
  }, [wantPlaying, volume]);

  useEffect(() => {
    if (!wantPlaying) return;
    if (visible) engine.current?.resume();
    else engine.current?.suspend();
  }, [wantPlaying, visible]);

  useEffect(
    () => () => {
      engine.current?.dispose();
      engine.current = null;
    },
    [],
  );
}
