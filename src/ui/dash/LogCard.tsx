import { useMemo, useRef, useState } from 'react';
import { formatCount } from '../../core/format';
import { tryVirtualPopulation } from '../../core/population';
import type { HistoryEntry } from '../../core/types';
import { DASH_TEXT } from '../../data/dashText';
import { FitPair } from '../FitPair';
import { Glue } from '../Glue';
import { useEpochMinute, useReducedMotion } from '../hooks';
import { LogList } from './LogList';
import { useVeilOpen } from './Veil';
import { isAtLogTop, logRows } from './logOrder';

/**
 * 인생 기록 카드 (SPEC-003 DB12·DB14, SPEC-005 LR1~LR7): 가운데 영역에 **한 줄씩 쌓이고** 영역 안에서 스크롤된다. **위가 최신**이다 — 새 줄은 맨 위에 붙는다.
 *  - 저장 순서(`game.history`)는 시간순 그대로이고 화면만 뒤집는다(`logOrder.ts#logRows`). DOM 순서 = 화면 순서 = 읽기 순서(CSS로 겉만 뒤집지 않는다 — 스크린리더·Tab 순서가 갈라진다).
 *  - 맨 위(가장 최근)를 보고 있는 동안은 새 줄이 와도 맨 위에 머문다(= 새 줄이 바로 보인다). 아래로 내려 지난 기록을 읽는 중이면 **보던 줄이 화면에서 움직이지 않게** 스크롤 위치를 직접 보정하고
 *    (`LogList.tsx` — WebKit은 `overflow-anchor`를 구현하지 않는다) 「새 기록 N개 · 맨 위로」 버튼에 개수만 센다. 누르거나 직접 맨 위까지 올리면 개수는 0. 버튼을 누르면 포커스는 목록 영역으로 간다(버튼이 사라지므로 — R-441).
 *    알약은 스크롤 영역 **안** 위 가장자리에 떠 있다(새 줄이 쌓이는 쪽 — 나타나도 줄이 밀리지 않는다, `LogList`의 높이 0 슬롯, R-438).
 *    알약이 사라지는 길은 둘이다: 누름(`jump`)과, 직접 맨 위까지 올림(휠·스크롤바·키보드 Home·PageUp·↑ — `onScroll`)·다른 판으로 바뀜(`onReset`). 어느 길이든 **알약이 포커스를 가진 채 사라지면**
 *    (키보드로 Tab한 뒤 Home 등으로 맨 위에 닿은 경우) 포커스를 목록 영역으로 옮긴다 — 문서 맨 앞(body)으로 떨어지지 않게(`keepFocusOnList`, WCAG 2.4.3, R-444).
 *    창 크기·글자 크기·화면 회전으로 줄이 다시 흐를 때도 보던 줄을 지킨다(`LogList.tsx`의 `ResizeObserver` — R-439).
 *  - 줄 형식 「{나이}세 {문장}」, 종류: 단계(출생 포함, 아래 선 — 그 단계의 가장 오래된 줄이 단계 묶음의 맨 아래에 와서 선이 묶음을 가른다) / 사건 / 선택 결과(「선택: …」) / (나의 기록 — 자유 기록 M7c) / 사망. 첫 줄(가장 최근)은 굵게.
 *  - 맨 위 고정 줄(DB14): 「이 세상의 가상 인구 {N}명 · {이름}도 그중 한 사람」 — 쌓이는 기록과 구분되는 띠. N은 첫 화면과 같은 가상 인구 함수(core/population.ts)이고 시각은 UI가 분 단위로 넘긴다.
 *    짧은 쌍이라 `FitPair`(한 줄에 안 들어가면 기호 없이 두 줄). 근거 통계를 읽을 수 없으면 이 줄만 빠진다(R-211).
 *  - 스크롤 영역은 키보드로 닿을 수 있다(tabindex 0 + 이름 + 안내 문구가 설명) — 방향키·PageUp/Down으로 지난 기록을 읽고 Home = 맨 위(가장 최근) · End = 맨 아래(가장 오래된)다.
 *    영역(최대 520px)이 가용 높이(화면 − 고정 머리 − 진행 줄)보다 크면 키보드 포커스를 받을 때 위쪽 변이 머리 밑에 오게 맞춘다(CM10 예외 ②).
 *  - 처음 뜰 때·새로고침 복원 때는 맨 위(가장 최근)에서 시작한다 — 새로 만든 스크롤 영역의 기본 위치다.
 *  - **무거운 장면 가리기**(SPEC-005 QI6): `gentle`(설정값)이 켜져 있으면 무거운 장면 줄이 지난 줄까지 가려지고 「펼쳐 보기」로 연다. 펼침은 이 컴포넌트의 상태일 뿐 저장하지 않고, 설정이 바뀌면 초기화된다(M19, `useVeilOpen`).
 */

export function LogCard({ history, name, live, minute, gentle = false }: { history: readonly HistoryEntry[]; name: string; live: boolean; minute?: number; /** 「무거운 장면 가리기」(설정값) */ gentle?: boolean }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => logRows(history), [history]);
  /** 「맨 위로」를 누른 직후 부드럽게 올라가는 중인가 — 그동안 새 줄이 와도 맨 위로 따라간다 */
  const following = useRef(false);
  const [unread, setUnread] = useState(0);
  const clock = useEpochMinute();
  const reduced = useReducedMotion();
  const population = tryVirtualPopulation(minute ?? clock);
  const veil = useVeilOpen(gentle);

  /**
   * 「새 기록 N개 · 맨 위로」 알약이 **저절로 사라지는** 길(키보드로 알약에 Tab한 뒤 Home·PageUp·↑로 목록이 맨 위에 닿음, 휠·스크롤바로 맨 위에 닿음, 다른 판으로 바뀜)에서, 알약이 지금 포커스를 가졌으면 목록 영역으로 옮긴다 —
   * 알약은 개수가 0이 되면 사라지고(조건부 렌더) 포커스를 가진 요소가 사라지면 포커스가 문서 맨 앞(body)으로 떨어진다(WCAG 2.4.3 포커스 순서, R-444). 알약을 **누른** 경우(`jump`)는 따로 무조건 옮긴다(R-441).
   * 상태를 바꾸기 **전에** 부른다. 스크롤은 사용자가 이미 했으므로 포커스가 화면을 끌지 않게 한다(`preventScroll`).
   */
  const keepFocusOnList = () => {
    const el = scrollerRef.current;
    const active = document.activeElement;
    if (el !== null && active instanceof HTMLElement && active.matches('.log__jump') && el.contains(active)) el.focus({ preventScroll: true });
  };

  const onScroll = () => {
    const el = scrollerRef.current;
    if (el === null) return;
    if (isAtLogTop(el.scrollTop)) {
      following.current = false;
      if (unread > 0) {
        keepFocusOnList();
        setUnread(0);
      }
    }
  };

  const jump = () => {
    following.current = true;
    // 누른 버튼은 곧 사라진다 — 포커스가 문서 맨 앞(body)으로 떨어지지 않게 목록 영역으로 옮긴다(WCAG 2.4.3). 스크롤은 아래 scrollTo가 하므로 포커스가 화면을 끌지 않게 한다.
    // (누르면 무조건 옮긴다 — 마우스로 누른 버튼에 포커스를 주지 않는 브라우저(Safari)에서도 같다. 알약이 저절로 사라지는 길은 `keepFocusOnList`가 포커스를 가졌을 때만 옮긴다)
    setUnread(0);
    const el = scrollerRef.current;
    el?.focus({ preventScroll: true });
    el?.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' });
  };

  return (
    <section className="card log" aria-labelledby="log-t" data-testid="log">
      <div className="card__head card__head--tight">
        <h2 id="log-t" className="card__title">
          {DASH_TEXT.logTitle}
        </h2>
        <span className="t-xs t-faint" id="log-hint" data-testid="log-hint">
          <Glue text={DASH_TEXT.logHint} />
        </span>
      </div>
      {population === null ? null : (
        <p className="log__pin" data-testid="log-pin">
          <FitPair a={DASH_TEXT.logPinA(formatCount(population))} b={DASH_TEXT.logPinB(name)} />
        </p>
      )}
      <LogList
        rows={rows}
        jump={
          unread > 0 ? (
            <button type="button" className="btn btn--secondary btn--sm log__jump" onClick={jump} data-testid="log-jump">
              <Glue text={DASH_TEXT.logJump(unread)} />
            </button>
          ) : null
        }
        live={live}
        gentle={gentle}
        veilOpen={veil.isOpen}
        onVeilToggle={veil.toggle}
        scrollerRef={scrollerRef}
        following={following}
        onScroll={onScroll}
        onUserScroll={() => {
          // 사용자가 직접 스크롤하기 시작하면(휠·터치·포인터·키보드) 「맨 위로」가 시작한 따라가기를 놓는다 — 그 뒤 새 줄은 지금 보는 자리를 지킨다
          following.current = false;
        }}
        onUnread={(added) => setUnread((n) => n + added)}
        onReset={() => {
          keepFocusOnList();
          setUnread(0);
        }}
      />
    </section>
  );
}
