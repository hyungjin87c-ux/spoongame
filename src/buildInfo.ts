import { formatBuildLabel } from './core/build';

/**
 * 빌드 때 vite가 넣는 상수 (vite.config.ts → scripts/buildInfo.ts). vite를 거치지 않는 환경(vite-node 스크립트 등)에서는 정의되지 않아 안전한 기본값을 쓴다.
 */
declare const __APP_VERSION__: string | undefined;
declare const __APP_COMMIT__: string | undefined;
declare const __REPO_URL__: string | undefined;

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
export const APP_COMMIT: string = typeof __APP_COMMIT__ === 'string' ? __APP_COMMIT__ : '';

/** 푸터에 적는 빌드 표기: `v0.1.0 (a1b2c3d)` */
export const BUILD_LABEL: string = formatBuildLabel(APP_VERSION, APP_COMMIT);

/** 저장소 주소(https://github.com/<주인>/<저장소>) — package.json의 repository에서 빌드 때 읽는다(DP1). 모르면 빈 글자(의견 보내기 링크를 만들지 않는다, core/feedback.ts) */
export const REPO_URL: string = typeof __REPO_URL__ === 'string' ? __REPO_URL__ : '';
