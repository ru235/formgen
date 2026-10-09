import type { SizeCoeffs, SizeMode, Sizes, Vec3 } from './types.ts'

/**
 * Convert a dimension triple between size modes.
 *
 * `coeffs` are thickness multipliers per axis:
 *   manufacture = inner + coeffs.manufacture × T   (crease-to-crease)
 *   outer       = inner + coeffs.outer × T           (cut contour)
 *
 * Single-walled styles: manufacture = inner + T, outer = inner + 2T.
 * Double-walled axis (e.g. 0427 roll ends): manufacture = inner + 5T.
 */
export function resolveSizes(
  input: Vec3,
  mode: SizeMode,
  thickness: number,
  coeffs: SizeCoeffs,
): Sizes {
  const manufacture: Vec3 = { ...input }
  if (mode === 'inner') {
    manufacture.l = input.l + coeffs.manufacture.l * thickness
    manufacture.w = input.w + coeffs.manufacture.w * thickness
    manufacture.h = input.h + coeffs.manufacture.h * thickness
  } else if (mode === 'outer') {
    manufacture.l = input.l - (coeffs.outer.l - coeffs.manufacture.l) * thickness
    manufacture.w = input.w - (coeffs.outer.w - coeffs.manufacture.w) * thickness
    manufacture.h = input.h - (coeffs.outer.h - coeffs.manufacture.h) * thickness
  }
  const inner: Vec3 = {
    l: manufacture.l - coeffs.manufacture.l * thickness,
    w: manufacture.w - coeffs.manufacture.w * thickness,
    h: manufacture.h - coeffs.manufacture.h * thickness,
  }
  const outer: Vec3 = {
    l: inner.l + coeffs.outer.l * thickness,
    w: inner.w + coeffs.outer.w * thickness,
    h: inner.h + coeffs.outer.h * thickness,
  }
  return { inner, manufacture, outer }
}
