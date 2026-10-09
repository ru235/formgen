export type Pt = { x: number; y: number }
export type Vec3 = { l: number; w: number; h: number }
export type Rect = { x: number; y: number; w: number; h: number }

export type EdgeKind = 'cut' | 'crease' | 'perf' | 'glue'

export type Arc = { rx: number; ry: number; largeArc: boolean; sweep: boolean }

export type FaceId = string

/** One directed segment of a face's closed boundary loop. */
export type Edge = {
  kind: EdgeKind
  to: Pt
  arc?: Arc
  /** Present iff kind === 'crease': the face on the other side. */
  hinge?: FaceId
  /** Signed dihedral in degrees when fully folded. Defaults to 90. */
  foldAngle?: number
}

/** Interior cut-out or edge-opening slot, in face-local coords (from origin). */
export type Hole = { x: number; y: number; w: number; h: number }

export type Face = {
  id: FaceId
  origin: Pt
  /** Closed loop: the last edge's `to` equals `origin`. */
  edges: Edge[]
  holes?: Hole[]
}

/** Ordered fold stages; each names the child faces whose crease folds then. */
export type FoldStages = readonly (readonly FaceId[])[]

export type Layer = {
  id: string
  materialId: string
  thickness: number
  faces: Face[]
  /** The face held still while everything folds around it. */
  foldRoot: FaceId
  foldStages: FoldStages
}

/** Thickness multipliers per axis:
 *  manufacture = inner + coeffs.manufacture × T  (crease-to-crease)
 *  outer       = inner + coeffs.outer × T        (cut contour) */
export type SizeCoeffs = { manufacture: Vec3; outer: Vec3 }

export type SizeMode = 'inner' | 'manufacture' | 'outer'

export type StyleParams = {
  l: number
  w: number
  h: number
  sizeMode: SizeMode
  thickness: number
  materialId: string
}

export type Sizes = { inner: Vec3; manufacture: Vec3; outer: Vec3 }

export type Warning = { code: string; message: string }

export type Measure = { cut: number; crease: number; perf: number; glue: number }

export type TestVector = {
  /** Inner dimensions (mm). */
  input: Vec3
  thickness: number
  expectFaces: number
  /** Published reference blank (pending verification against a real die). */
  expectBlank?: Rect
  note?: string
}

export type StyleDef = {
  id: string
  label: string
  description: string
  fefcoRef: string
  /** True only after side-by-side verification against a real die. */
  verified: boolean
  limits: { l: [number, number]; w: [number, number]; h: [number, number] }
  defaults: Vec3
  defaultMaterialId: string
  coeffs: SizeCoeffs
  /** `m` is the manufacture (crease-to-crease) size in mm. */
  buildFaces: (m: Vec3, thickness: number) => Face[]
  foldRoot: FaceId
  foldStages: FoldStages
  testVector?: TestVector
}

export type Dieline = {
  styleId: string
  params: StyleParams
  layers: Layer[]
  bbox: Rect
  sizes: Sizes
  warnings: Warning[]
}
