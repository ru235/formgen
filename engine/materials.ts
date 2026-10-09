export type Material = {
  id: string
  label: string
  thickness: number
  flute?: string
}

export const MATERIALS: Material[] = [
  { id: 'fbb-300', label: 'Картон 300 г/м²', thickness: 0.35 },
  { id: 'micro-e', label: 'Микрогофрокартон E', thickness: 1.5, flute: 'E' },
  { id: 'flute-b', label: 'Гофрокартон B', thickness: 3.0, flute: 'B' },
]

/**
 * Resolve a material preset, optionally overriding its thickness.
 * Unknown ids fall back to a custom material if a valid thickness is given.
 */
export function getMaterial(id: string, thickness?: number): Material {
  const preset = MATERIALS.find((m) => m.id === id)
  if (!preset) {
    if (thickness === undefined || thickness <= 0) {
      throw new Error(`getMaterial(): unknown material "${id}" and no valid thickness`)
    }
    return { id: 'custom', label: 'Произвольная толщина', thickness }
  }
  return { ...preset, thickness: thickness ?? preset.thickness }
}
