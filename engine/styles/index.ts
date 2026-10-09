import type { StyleDef } from '../types.ts'
import { fefco0427 } from './fefco-0427.ts'
import { fefco0215 } from './fefco-0215.ts'

export const STYLES: readonly StyleDef[] = [fefco0427, fefco0215]

export function getStyle(id: string): StyleDef {
  const s = STYLES.find((x) => x.id === id)
  if (!s) throw new Error(`Unknown style: "${id}"`)
  return s
}
