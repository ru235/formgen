import type { Measure } from './types.ts'

export type Tariffs = {
  knife2pt: number // ₽ per linear meter, 2-point knife
  knife3pt: number // ₽ per linear meter, 3-point knife
  perfGlue: number // ₽ per linear meter, perforation and glue knives
  maxThickness2pt: number // mm — 2-point knife up to this thickness
}

export const DEFAULT_TARIFFS: Tariffs = {
  knife2pt: 1600,
  knife3pt: 1700,
  perfGlue: 500,
  maxThickness2pt: 2,
}

/**
 * Die form price in ₽.
 * Cutting and creasing are priced per the knife tariff (2pt/3pt by
 * material thickness); perforation and glue knives per the finishing
 * tariff. All lengths come from the same model as the drawing.
 */
export function priceDie(
  m: Measure,
  thickness: number,
  tariffs: Tariffs = DEFAULT_TARIFFS,
): number {
  const knife = thickness <= tariffs.maxThickness2pt ? tariffs.knife2pt : tariffs.knife3pt
  const cutting = ((m.cut + m.crease) / 1000) * knife
  const finishing = ((m.perf + m.glue) / 1000) * tariffs.perfGlue
  return Math.round(cutting + finishing)
}
