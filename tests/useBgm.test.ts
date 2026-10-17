import { describe, expect, it } from 'vitest';
import useBgmSource from '../src/ui/useBgm.ts?raw';
import { BGM_ACTIVATION_EVENTS, bgmInputAction } from '../src/ui/useBgm';
import { createBgm, type AudioContextLike, type BgmTimers } from '../src/audio/bgm';

/**
 * BGM을 켜는 입력 (SPEC-003 DB4, R-325 / REV-003-M4-1): 저장된 「켜짐」인데 모바일에서 무음이 되는 일을 막는다.
 * 모바일 브라우저는 `touchstart`·터치 `pointerdown`을 사용자 활성화로 치지 않는다 — 그 입력에서 한 번만 `resume()`을 부르면 장치가 계속 멈춰 있다.
 * 그래서 소리 장치는 활성화 입력(`pointerup`·`touchend`·`click`·`keydown`) 안에서 만들고, 연주를 원하는 동안 장치가 멈춰 있으면 다음 입력마다 다시 깨운다.
 * 실제 브라우저의 장치 수·`running` 상태는 e2e/m4-dashboard.spec.ts(R-325)가 본다(훅은 DOM 이벤트가 필요하다 — 이 프로젝트는 jsdom을 두지 않는다).
 */

describe('활성화 입력 목록', () => {
  it('마우스·터치를 뗄 때와 클릭·키 누름이다. 모바일이 활성화로 치지 않는 touchstart·pointerdown은 없다', () => {
    expect([...BGM_ACTIVATION_EVENTS].sort()).toEqual(['click', 'keydown', 'pointerup', 'touchend']);
    for (const bad of ['touchstart', 'pointerdown', 'mousedown', 'touchmove', 'scroll']) expect(BGM_ACTIVATION_EVENTS as readonly string[], bad).not.toContain(bad);
  });

  it('훅의 소스가 이 목록으로만 입력을 듣는다: 이벤트 이름 문자열을 따로 적은 addEventListener가 없고, once 옵션(첫 입력 한 번만)을 쓰지 않는다', () => {
    const code = useBgmSource.replace(/\/\*[^]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).toMatch(/for \(const type of BGM_ACTIVATION_EVENTS\) window\.addEventListener\(type, onInput/);
    expect(code, '창에는 목록 밖 입력 이름을 직접 적어 듣지 않는다').not.toMatch(/window\.addEventListener\(\s*['"]/);
    expect(code, '입력마다 다시 깨워야 하므로 once가 없다').not.toMatch(/\bonce\s*:/);
    expect(code, '모바일이 활성화로 치지 않는 입력 이름이 코드에 없다').not.toMatch(/touchstart|pointerdown|mousedown/);
  });
});

describe('bgmInputAction: 입력 한 번에 무엇을 할지 (R-325)', () => {
  const idle = { want: true, hidden: false, playing: false, suspended: false };

  it('연주를 원하지 않으면(꺼짐이거나 BGM이 흐르는 화면이 아님) 아무것도 하지 않는다 — 소리 장치도 만들지 않는다', () => {
    for (const playing of [false, true]) for (const suspended of [false, true]) expect(bgmInputAction({ ...idle, want: false, playing, suspended })).toBe('none');
  });

  it('탭이 가려져 있으면 아무것도 하지 않는다 (가시성 효과가 멈춘 시계를 다시 흐르게 한다)', () => {
    expect(bgmInputAction({ ...idle, hidden: true })).toBe('none');
    expect(bgmInputAction({ ...idle, hidden: true, playing: true, suspended: true })).toBe('none');
  });

  it('원하는데 아직 시작하지 않았으면 start — 저장된 「켜짐」으로 새로 연 뒤의 첫 활성화 입력이다', () => {
    expect(bgmInputAction(idle)).toBe('start');
  });

  it('연주 중인데 장치가 멈춰 있으면(suspended·interrupted) 다음 입력마다 resume. 돌고 있으면 아무것도 하지 않는다', () => {
    expect(bgmInputAction({ ...idle, playing: true, suspended: true })).toBe('resume');
    expect(bgmInputAction({ ...idle, playing: true, suspended: false })).toBe('none');
  });
});

describe('연주기: isSuspended와 입력 안에서의 시작·깨우기 (가짜 AudioContext)', () => {
  class Ctx implements AudioContextLike {
    currentTime = 0;
    state = 'suspended';
    destination = {};
    /** 브라우저가 사용자 활성화 전의 resume()을 거절하는 모양 — 이 값이 false이면 resume()해도 계속 suspended */
    activated = false;
    resumes = 0;
    node = () => ({ connect: () => undefined, disconnect: () => undefined, gain: this.param(), frequency: this.param(), type: '', start: () => undefined, stop: () => undefined, onended: null });
    param = () => ({ value: 0, setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined, cancelScheduledValues: () => undefined });
    createOscillator() {
      return this.node() as never;
    }
    createGain() {
      return this.node() as never;
    }
    createBiquadFilter() {
      return this.node() as never;
    }
    async resume() {
      this.resumes++;
      if (this.activated) this.state = 'running';
    }
    async suspend() {
      this.state = 'suspended';
    }
    async close() {
      this.state = 'closed';
    }
  }
  const timers: BgmTimers = { setInterval: () => 1, clearInterval: () => undefined };

  it('시작 전·멈춘 뒤에는 isSuspended가 거짓이다(연주 중이 아니므로). 연주 중 장치가 running이 아니면 참, running이면 거짓', () => {
    const ctx = new Ctx();
    const engine = createBgm(() => ctx, timers);
    expect(engine.isSuspended(), '만들기만 한 연주기').toBe(false);
    engine.start(30);
    expect(ctx.resumes, '시작이 resume()을 부른다').toBe(1);
    expect(engine.isSuspended(), '브라우저가 거절해 suspended인 채').toBe(true);
    ctx.activated = true; // 이제 사용자 활성화가 있다
    engine.resume();
    expect(ctx.resumes).toBe(2);
    expect(ctx.state).toBe('running');
    expect(engine.isSuspended()).toBe(false);
    engine.stop();
    ctx.state = 'suspended';
    expect(engine.isSuspended(), '멈춘 연주기는 깨울 일이 없다').toBe(false);
  });

  it('결정 표대로 입력마다 다시 깨우면 거절된 뒤에도 결국 running이 된다 — 한 번의 거절이 영영 무음이 되지 않는다', () => {
    const ctx = new Ctx();
    const engine = createBgm(() => ctx, timers);
    let inputs = 0;
    const input = () => {
      inputs++;
      const action = bgmInputAction({ want: true, hidden: false, playing: engine.isPlaying(), suspended: engine.isSuspended() });
      if (action === 'start') engine.start(30);
      else if (action === 'resume') engine.resume();
    };
    input(); // 첫 입력: 시작(브라우저가 활성화로 치지 않아 거절)
    expect(ctx.state).toBe('suspended');
    input(); // 둘째 입력: 아직 활성화가 없다 → 다시 시도
    expect(ctx.state).toBe('suspended');
    ctx.activated = true; // 사용자가 마침내 활성화 입력을 했다
    input();
    expect(ctx.state).toBe('running');
    const resumesAfterRunning = ctx.resumes;
    input(); // 돌고 있으면 더 부르지 않는다
    input();
    expect(ctx.resumes).toBe(resumesAfterRunning);
    expect(inputs).toBe(5);
  });
});
