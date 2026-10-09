import type { Material } from './materials.ts'
import { MATERIALS } from './materials.ts'
import type { Rect, Sizes, StyleDef, Warning } from './types.ts'

const MAX_BLANK_AREA = 1600 * 1100 // mm² — typical die-cutting sheet

/** Advisory warnings: never block generation or export. */
export function validate(
  style: StyleDef,
  sizes: Sizes,
  bbox: Rect,
  material: Material,
): Warning[] {
  const warnings: Warning[] = []

  for (const axis of ['l', 'w', 'h'] as const) {
    const [min, max] = style.limits[axis]
    if (sizes.inner[axis] < min) {
      warnings.push({
        code: 'dim-min',
        message: `${axis.toUpperCase()} ${sizes.inner[axis]} мм ниже рекомендуемого минимума ${min} мм`,
      })
    }
    if (sizes.inner[axis] > max) {
      warnings.push({
        code: 'dim-max',
        message: `${axis.toUpperCase()} ${sizes.inner[axis]} мм выше рекомендуемого максимума ${max} мм`,
      })
    }
  }

  if (bbox.w * bbox.h > MAX_BLANK_AREA) {
    warnings.push({
      code: 'blank-oversize',
      message: `Разворот ${Math.round(bbox.w)}×${Math.round(bbox.h)} мм превышает типовой лист 1600×1100 мм`,
    })
  }

  if (material.thickness > sizes.inner.h / 8) {
    warnings.push({
      code: 'thickness-ratio',
      message: `Толщина ${material.thickness} мм велика для высоты ${sizes.inner.h} мм (T > H/8)`,
    })
  }

  const preset = MATERIALS.find((m) => m.id === material.id)
  if (preset && Math.abs(preset.thickness - material.thickness) > 1e-9) {
    warnings.push({
      code: 'material-mismatch',
      message: `Толщина ${material.thickness} мм не соответствует пресету "${preset.label}" (${preset.thickness} мм)`,
    })
  }

  return warnings
}
