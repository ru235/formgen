# GEOMETRY — FEFCO conventions and rules

## Dimension conventions (FEFCO Code, 12th ed.)

- **Internal dimensions by default**: L = longer at the opening, B = shorter,
  H = top of opening to base.
- Telescope types: 4th dimension `h` (lid height) after a slash — `355×205×120/40`.
- Overlap types: `o` (overlap length) as 4th dimension.
- Measurement "from the centre of crease bearing the thickness of the material
  in mind".

## sizeMode

| Mode | Meaning |
|---|---|
| Inside | cavity the product fits into |
| Folding lines | crease-to-crease |
| Outside | finished outer gauge |

Conversion is **analytic through thickness** (`SizeCoeffs`), not a flat "+2T".
Example from a double-walled style: `manufacture.l = inner.l + 5T`
(one thickness per wall layer on that axis).

## Construction rules

- Outer cut contour = manufacture size; crease sits at **½ thickness** from the cut.
- Roll-end gap = **2 × thickness** (sized exactly to capture ears/tabs).
- FEFCO 0427 locking tabs/slots follow the **FEFCO CFQ** standard; slot depth
  and width derive from thickness — confirm standard values with the die bureau
  (phase 0).
- Glue flap: 15–25 mm (style-specific allowance, exposed as a parameter).
- Corner clearance: thickness-driven, per style.

## Validation

- **Hard throws** (DSL): double crease on one side, `2×taper ≥ hinge extent`,
  unknown parent face, duplicate ids.
- **Advisory warnings** (never block): dimension outside recommended range,
  oversized blank, thickness-to-size ratio, material/thickness mismatch.

## Test vectors (run on every change)

| Style | Input (inner, mm) | Blank (engine) | Panels |
|---|---|---|---|
| 0427 | 254 × 254 × 102, T=1.5 | 820 × 712 mm; published reference 810 × 655 mm — delta is in roll-end allowances, verify against a real die | 21 (20 creases) |
| 0215 | 300 × 200 × 150, T=3 | 1032 × 306 mm (gabarites TBD — verify against a real die) | 13 (12 creases, 4 snap slots) |

Engine output at vectors (single source for preview, exports and price):

- 0427 @ micro-flute E (1.5 мм): cut 4.622 м, crease 4.218 м → 14 145 ₽
- 0215 @ flute B (3 мм): cut 3.557 м, crease 2.636 м, glue 0.193 м → 10 625 ₽

## Verification badge

Styles carry a badge on the drawing: **«сверено с реальным штампом · дата»** —
set only after side-by-side comparison with the FEFCO plate and a real die
from the bureau. Unverified styles are marked «не сверено».
