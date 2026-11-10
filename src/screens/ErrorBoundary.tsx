import { Component, type CSSProperties, type ReactNode } from 'react';
import { clearGame, getBrowserStorage } from '../core';
import { SYSTEM_TITLE, SYSTEM_TITLE_CHARS } from '../data/dashText';
import { SiteHead } from '../ui/Brand';

interface Props {
  children: ReactNode;
}
interface BoundaryState {
  failed: boolean;
}

/** 공통 헤더의 화면 이름 (DS1, docs/design/copy.md 「오류 화면」 행) */
export const ERROR_HEAD_NAME = '오류';

/**
 * 최상위 ErrorBoundary: 렌더 중 예외가 나도 저장을 지우고 새로 시작할 탈출구를 보여준다. (R-001)
 * 공통 헤더(DS1, M4): 옛 `<h1>수저 게임</h1>` 대신 게임명 로고가 헤더에 있고 화면 이름은 「오류」, `<h1>`은 이 화면의 메시지다. 문구는 현행 그대로(docs/design/copy.md).
 * 앱이 무너진 뒤라 테마 훅이 없다 — 문서에 이미 걸린 `<html data-theme>`(설정의 수동 선택)와 토큰 CSS가 색을 정한다.
 */
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

  /**
   * 헤더 로고 → 페이지 다시 열기 (SPEC-016 H1·Q2 (가)): 오류 화면은 앱(세션) 바깥이라 `dispatch`가 없다 — 저장은 **지우지 않고** 주소의 쿼리만 떼어 다시 연다. 저장된 판이 열리고(첫 화면 단계면 첫 화면),
   * 오류가 그 저장 때문이면 이 화면이 다시 뜰 수 있다(그때의 탈출구는 아래 「저장 지우고 새로 시작」).
   */
  private home = () => {
    window.location.assign(window.location.pathname);
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page" data-testid="error-screen">
        <SiteHead name={ERROR_HEAD_NAME} onHome={this.home} />
        <main className="system" data-state="error">
          <section className="card">
            {/* 제목 글자 크기 상한(R-321, QM3-2): 밀린 화면과 같은 칸 수 — dash.css 「제목 글자 크기 상한」 */}
            <h1 tabIndex={-1} ref={(el) => el?.focus()} style={{ '--title-chars': SYSTEM_TITLE_CHARS } as CSSProperties}>
              {SYSTEM_TITLE.error}
            </h1>
            <button type="button" className="btn btn--primary" onClick={this.reset}>
              저장 지우고 새로 시작
            </button>
          </section>
        </main>
      </div>
    );
  }
}
