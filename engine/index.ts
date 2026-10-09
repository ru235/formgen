import { measure, facesBbox, normaliseFaces } from './geometry.ts'
import { getMaterial } from './materials.ts'
import { checkInvariants } from './invariants.ts'
import { resolveSizes } from './sizes.ts'
import { getStyle } from './styles/index.ts'
import { validate } from './validate.ts'
import type { Dieline, Measure, StyleParams } from './types.ts'

/**
 * Generate a dieline for a style and parameters.
 * The same model drives the preview, the exports and the
 * price calculation — they cannot diverge.
 */
export function generate(styleId: string, params: StyleParams): Dieline {
  const style = getStyle(styleId)
  const material = getMaterial(params.materialId, params.thickness)
  const sizes = resolveSizes(
    { l: params.l, w: params.w, h: params.h },
    params.sizeMode,
    material.thickness,
    style.coeffs,
  )
  const faces = normaliseFaces(style.buildFaces(sizes.manufacture, material.thickness))
  const bbox = facesBbox(faces)
  checkInvariants({
    id: 'main',
    materialId: material.id,
    thickness: material.thickness,
    faces,
    foldRoot: style.foldRoot,
    foldStages: style.foldStages,
  })
  return {
    styleId,
    params,
    layers: [
      {
        id: 'main',
        materialId: material.id,
        thickness: material.thickness,
        faces,
        foldRoot: style.foldRoot,
        foldStages: style.foldStages,
      },
    ],
    bbox,
    sizes,
    warnings: validate(style, sizes, bbox, material),
  }
}

/** Total linear length per edge kind across all layers (mm). */
export function measureDieline(d: Dieline): Measure {
  const total: Measure = { cut: 0, crease: 0, perf: 0, glue: 0 }
  for (const layer of d.layers) {
    const m = measure(layer.faces)
    total.cut += m.cut
    total.crease += m.crease
    total.perf += m.perf
    total.glue += m.glue
  }
  return total
}
