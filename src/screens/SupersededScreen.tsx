import type { CSSProperties } from 'react';
import { SYSTEM_TITLE, SYSTEM_TITLE_CHARS } from '../data/dashText';
import { TITLE_TEXT } from '../data/titleText';
import { SiteHead } from '../ui/Brand';
import { GuardedButton } from '../ui/GuardedButton';
import { useScrollTopOnMount, useThemeSurface } from '../ui/useBottomBar';
import { useFocusOnChange } from '../ui/useFocus';

interface Props {
  onTakeOver: () => void;
  /** 이어받기에 필요한 게임 데이터(지연 덩어리, MG8)를 받지 못했다 — 안내 한 줄을 보이고 같은 버튼으로 다시 시도한다 (R-516) */
  loadFailed?: boolean;
}

/** 공통 헤더의 화면 이름 (DS1, docs/design/copy.md 「밀린 화면」 행) */
export const SUPERSEDED_HEAD_NAME = '저장 안내';

/**
 * 저장된 게임이 이 화면 밖에서 바뀌었을 때(R-011): 이 탭은 더 이상 저장하지 않고 멈춘다.
 * 바뀐 곳이 다른 탭인지, 이미 닫은 탭인지, 같은 탭의 개발자 도구(저장을 직접 지우거나 바꿈)인지는 알 수 없으므로 문구는 어느 쪽도 단정하지 않는다(R-047, R-054).
 * 마지막으로 진행한 쪽이 이기고(마지막 쓰기 우선), 이 탭에서 계속하려면 저장된 최신 상태를 이어받는다. 두 탭이 서로의 진행을 덮어써서 되감기거나 깨지는 일이 없다.
 * 이어받을 저장이 없거나 읽을 수 없으면(지워졌거나 손상) 새 게임이 시작된다 — 버튼 옆에 미리 알린다(R-054).
 *
 * 공통 헤더(DS1, M4): 옛 `<h1>수저 게임</h1>` 대신 게임명 로고가 헤더에 있고 화면 이름은 「저장 안내」, `<h1>`은 이 화면의 메시지다. 문구는 현행 그대로(docs/design/copy.md).
 */
export function SupersededScreen({ onTakeOver, loadFailed = false }: Props) {
  const headingRef = useFocusOnChange<HTMLHeadingElement>();
  useThemeSurface();
  useScrollTopOnMount();
  return (
    <div className="page" data-testid="superseded-screen">
      <SiteHead name={SUPERSEDED_HEAD_NAME} />
      <main className="system" data-state="superseded">
        <section className="card">
          {/* 바뀐 곳이 어디인지(다른 탭·닫힌 탭·같은 탭의 직접 변경)는 알 수 없다 → "저장이 이 화면 밖에서 바뀌었다"고만 말한다. */}
          {/* 제목 글자 크기 상한(R-321, QM3-2): 가장 긴 낱말 「바뀌었습니다.」가 폭 320 · 글자 200%에서도 한 줄에 들어가도록 줄 폭 ÷ 칸 수로 정한다 — dash.css 「제목 글자 크기 상한」 */}
          <h1 ref={headingRef} tabIndex={-1} data-testid="superseded-text" style={{ '--title-chars': SYSTEM_TITLE_CHARS } as CSSProperties}>
            {SYSTEM_TITLE.superseded}
          </h1>
          <p className="t-muted">다른 탭이나 창에서 진행했거나, 저장이 직접 지워지거나 바뀌었을 수 있습니다. 이 화면은 최신이 아닐 수 있습니다. 이어서 하려면 아래 버튼을 누르세요. 저장된 가장 최근 내용을 이어받습니다.</p>
          {loadFailed ? (
            <p className="t-sm" role="alert" data-testid="take-over-failed">
              {TITLE_TEXT.loadFailed}
            </p>
          ) : null}
          <GuardedButton className="btn btn--primary" guardKey="superseded" onClick={onTakeOver} data-testid="take-over">
            이 탭에서 이어하기
          </GuardedButton>
          <p className="t-sm t-muted" data-testid="take-over-note">
            저장된 게임이 없거나 읽을 수 없으면 새 게임이 시작됩니다.
          </p>
        </section>
      </main>
    </div>
  );
}
