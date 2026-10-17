import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SETTINGS_KEY, getBrowserStorage, parseSettings } from './core';
import { applyTheme } from './ui/theme';
import './styles/tokens.css';
import './styles.css';
import './styles/title.css';
import './styles/doc.css';
import './styles/dash.css';

// 설정의 수동 테마(라이트·다크)를 React가 뜨기 전에 건다 — 첫 그림부터 고른 테마다(DB6). 저장소를 읽을 수 없으면 시스템 설정을 따른다.
try {
  applyTheme(parseSettings(getBrowserStorage()?.getItem(SETTINGS_KEY) ?? null).theme);
} catch {
  // 저장소 접근이 막힌 환경: 시스템 설정을 따른다
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
