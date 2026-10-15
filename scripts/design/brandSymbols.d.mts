/** brandSymbols.mjs의 타입 선언 — tests/designAssets.test.ts가 숟가락 도형·섬 크기 계약을 단언할 때 쓴다 */
export interface SpoonParams {
  cx?: number;
  top?: number;
  w?: number;
  h?: number;
  neck?: number;
  handleLen?: number;
  endW?: number;
  neckLen?: number;
}
export interface SymbolMetrics {
  bowlW: number;
  bowlH: number;
  mapW: number;
  mapH: number;
  mapToBowl: number;
  handleLen: number;
  tilt: number;
  bowlPath: string;
  mapOutline: number[][];
  islands: boolean;
}
export interface SymbolShape {
  d: string;
  fillRule: 'nonzero' | 'evenodd';
  metrics: SymbolMetrics;
}
export const TILT_DEG: number;
export function spoonPath(p: SpoonParams): string;
export function pathPoints(d: string): Array<[number, number]>;
export function transformPath(d: string, fn: (x: number, y: number) => [number, number]): string;
export function symbolA(opts?: { small?: boolean }): SymbolShape;
export function islandMetrics(): { jeju: number; ulleung: number; dokdo: number; jejuToUlleung: number; dokdoToUlleung: number };
export const OPTIONS: Record<string, { name: string; fn: (opts?: { small?: boolean }) => SymbolShape }>;
export const ARCHIVED: Record<string, { name: string; fn: (opts?: { small?: boolean }) => { d: string; fillRule: string } }>;
