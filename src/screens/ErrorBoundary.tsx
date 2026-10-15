import { Component, type ReactNode } from 'react';
import { clearGame, getBrowserStorage } from '../core';
import { LegacyLight } from '../ui/legacyTheme';

interface Props {
  children: ReactNode;
}
interface BoundaryState {
  failed: boolean;
}

/** 최상위 ErrorBoundary: 렌더 중 예외가 나도 저장을 지우고 새로 시작할 탈출구를 보여준다. (R-001) */
export class ErrorBoundary extends Component<Props, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  private reset = () => {
    clearGame(getBrowserStorage());
    // 쿼리 문자열을 떼고 다시 연다(개발용 크래시 탐침이 남지 않게).
    window.location.assign(window.location.pathname);
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="screen" data-testid="error-screen">
        <LegacyLight />
        <h1 tabIndex={-1} ref={(el) => el?.focus()}>
          수저 게임
        </h1>
        <p>저장된 내용을 불러오는 중 문제가 생겼습니다.</p>
        <button type="button" onClick={this.reset}>
          저장 지우고 새로 시작
        </button>
      </main>
    );
  }
}
