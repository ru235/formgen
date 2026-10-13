"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // engine/geometry.ts
  var EPS = 1e-6;
  function dist(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }
  function segments(face) {
    return face.edges.map((e, i) => ({
      from: i === 0 ? face.origin : face.edges[i - 1].to,
      to: e.to,
      edge: e
    }));
  }
  function facesBbox(faces) {
    if (faces.length === 0) throw new Error("facesBbox(): no faces");
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const f of faces) {
      for (const p of [f.origin, ...f.edges.map((e) => e.to)]) {
        if (p.x < x0) x0 = p.x;
        if (p.y < y0) y0 = p.y;
        if (p.x > x1) x1 = p.x;
        if (p.y > y1) y1 = p.y;
      }
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  function normaliseFaces(faces) {
    const bb = facesBbox(faces);
    return faces.map((f) => ({
      ...f,
      origin: { x: f.origin.x - bb.x, y: f.origin.y - bb.y },
      edges: f.edges.map((e) => ({ ...e, to: { x: e.to.x - bb.x, y: e.to.y - bb.y } }))
    }));
  }
  function measure(faces) {
    const m = { cut: 0, crease: 0, perf: 0, glue: 0 };
    for (const f of faces) {
      for (const s of segments(f)) {
        if (s.edge.kind === "crease") {
          if (!s.edge.hinge || f.id < s.edge.hinge) {
            m.crease += dist(s.from, s.to);
          }
        } else {
          m[s.edge.kind] += dist(s.from, s.to);
        }
      }
      for (const h of f.holes ?? []) {
        m.cut += 2 * (h.w + h.h);
      }
    }
    return m;
  }

  // engine/materials.ts
  var MATERIALS = [
    { id: "fbb-300", label: "Картон 300 г/м²", thickness: 0.35 },
    { id: "micro-e", label: "Микрогофрокартон E", thickness: 1.5, flute: "E" },
    { id: "flute-b", label: "Гофрокартон B", thickness: 3, flute: "B" }
  ];
  function getMaterial(id, thickness) {
    const preset = MATERIALS.find((m) => m.id === id);
    if (!preset) {
      if (thickness === void 0 || thickness <= 0) {
        throw new Error(`getMaterial(): unknown material "${id}" and no valid thickness`);
      }
      return { id: "custom", label: "Произвольная толщина", thickness };
    }
    return { ...preset, thickness: thickness ?? preset.thickness };
  }

  // engine/invariants.ts
  function samePt(a, b) {
    return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
  }
  function checkClosed(faces) {
    for (const f of faces) {
      const last = f.edges[f.edges.length - 1];
      if (!last || !samePt(last.to, f.origin)) {
        throw new Error(`invariant: face "${f.id}" loop is not closed`);
      }
    }
  }
  function checkReciprocalCreases(faces) {
    const byId = new Map(faces.map((f) => [f.id, f]));
    for (const f of faces) {
      for (const s of segments(f)) {
        if (s.edge.kind !== "crease") continue;
        if (!s.edge.hinge) {
          throw new Error(`invariant: crease on "${f.id}" has no hinge`);
        }
        const other = byId.get(s.edge.hinge);
        if (!other) {
          throw new Error(
            `invariant: crease on "${f.id}" hinges to unknown face "${s.edge.hinge}"`
          );
        }
        const match = segments(other).find(
          (os) => os.edge.kind === "crease" && os.edge.hinge === f.id && samePt(os.from, s.to) && samePt(os.to, s.from)
        );
        if (!match) {
          throw new Error(
            `invariant: crease between "${f.id}" and "${other.id}" is not reciprocal`
          );
        }
      }
    }
  }
  function checkConnectivity(faces, foldRoot) {
    const byId = new Map(faces.map((f) => [f.id, f]));
    if (!byId.has(foldRoot)) throw new Error(`invariant: fold root "${foldRoot}" not found`);
    const seen = /* @__PURE__ */ new Set([foldRoot]);
    const queue = [foldRoot];
    while (queue.length) {
      const id = queue.pop();
      const f = byId.get(id);
      for (const s of segments(f)) {
        if (s.edge.kind === "crease" && s.edge.hinge && !seen.has(s.edge.hinge)) {
          seen.add(s.edge.hinge);
          queue.push(s.edge.hinge);
        }
      }
    }
    const missing = faces.filter((f) => !seen.has(f.id)).map((f) => f.id);
    if (missing.length) {
      throw new Error(`invariant: faces unreachable from fold root: ${missing.join(", ")}`);
    }
  }
  function checkHoles(faces) {
    for (const f of faces) {
      const pts = [f.origin, ...f.edges.map((e) => e.to)].map((p) => ({
        x: p.x - f.origin.x,
        y: p.y - f.origin.y
      }));
      const x0 = Math.min(...pts.map((p) => p.x));
      const y0 = Math.min(...pts.map((p) => p.y));
      const x1 = Math.max(...pts.map((p) => p.x));
      const y1 = Math.max(...pts.map((p) => p.y));
      for (const h of f.holes ?? []) {
        if (h.x < x0 - EPS || h.y < y0 - EPS || h.x + h.w > x1 + EPS || h.y + h.h > y1 + EPS) {
          throw new Error(`invariant: hole on "${f.id}" extends outside the face`);
        }
      }
    }
  }
  function checkInvariants(layer) {
    checkClosed(layer.faces);
    checkReciprocalCreases(layer.faces);
    checkConnectivity(layer.faces, layer.foldRoot);
    checkHoles(layer.faces);
  }

  // engine/sizes.ts
  function resolveSizes(input, mode, thickness, coeffs) {
    const manufacture = { ...input };
    if (mode === "inner") {
      manufacture.l = input.l + coeffs.manufacture.l * thickness;
      manufacture.w = input.w + coeffs.manufacture.w * thickness;
      manufacture.h = input.h + coeffs.manufacture.h * thickness;
    } else if (mode === "outer") {
      manufacture.l = input.l - (coeffs.outer.l - coeffs.manufacture.l) * thickness;
      manufacture.w = input.w - (coeffs.outer.w - coeffs.manufacture.w) * thickness;
      manufacture.h = input.h - (coeffs.outer.h - coeffs.manufacture.h) * thickness;
    }
    const inner = {
      l: manufacture.l - coeffs.manufacture.l * thickness,
      w: manufacture.w - coeffs.manufacture.w * thickness,
      h: manufacture.h - coeffs.manufacture.h * thickness
    };
    const outer = {
      l: inner.l + coeffs.outer.l * thickness,
      w: inner.w + coeffs.outer.w * thickness,
      h: inner.h + coeffs.outer.h * thickness
    };
    return { inner, manufacture, outer };
  }

  // engine/dsl.ts
  var EPS2 = 1e-6;
  var SIDE_INDEX = { top: 0, right: 1, bottom: 2, left: 3 };
  var DEFAULT_FOLD = 90;
  function edge(to, kind) {
    return { kind, to };
  }
  function rectFace(id, b) {
    return {
      id,
      origin: { x: b.x0, y: b.y0 },
      edges: [
        edge({ x: b.x1, y: b.y0 }, "cut"),
        edge({ x: b.x1, y: b.y1 }, "cut"),
        edge({ x: b.x0, y: b.y1 }, "cut"),
        edge({ x: b.x0, y: b.y0 }, "cut")
      ]
    };
  }
  function setCrease(faces, faceId, side, hinge) {
    const face = faces.get(faceId);
    if (!face) throw new Error(`setCrease(): unknown face "${faceId}"`);
    const idx = SIDE_INDEX[side];
    if (face.edges[idx].kind === "crease") {
      throw new Error(`Face "${faceId}" already has a crease on its ${side} side`);
    }
    face.edges[idx] = { ...face.edges[idx], kind: "crease", hinge, foldAngle: DEFAULT_FOLD };
  }
  function makeFlap(spec, side, p, parentId) {
    const { id, depth, taper = 0, edgeKind = "cut" } = spec;
    const hinge = (to) => ({ kind: "crease", hinge: parentId, foldAngle: DEFAULT_FOLD, to });
    const c = (to) => ({ kind: edgeKind, to });
    const extent = side === "top" || side === "bottom" ? p.x1 - p.x0 : p.y1 - p.y0;
    if (2 * taper >= extent) {
      throw new Error(
        `flap(): "${id}" taper ${taper} on hinge extent ${extent}: 2×taper must be < extent`
      );
    }
    switch (side) {
      case "top": {
        const y = p.y0 - depth;
        const box = { x0: p.x0 + taper, y0: y, x1: p.x1 - taper, y1: p.y0 };
        return {
          box,
          face: {
            id,
            origin: { x: box.x0, y },
            edges: [
              c({ x: box.x1, y }),
              c({ x: p.x1, y: p.y0 }),
              hinge({ x: p.x0, y: p.y0 }),
              c({ x: box.x0, y })
            ]
          }
        };
      }
      case "bottom": {
        const y = p.y1 + depth;
        const box = { x0: p.x0 + taper, y0: p.y1, x1: p.x1 - taper, y1: y };
        return {
          box,
          face: {
            id,
            origin: { x: p.x0, y: p.y1 },
            edges: [
              hinge({ x: p.x1, y: p.y1 }),
              c({ x: p.x1 - taper, y }),
              c({ x: p.x0 + taper, y }),
              c({ x: p.x0, y: p.y1 })
            ]
          }
        };
      }
      case "left": {
        const x = p.x0 - depth;
        const box = { x0: x, y0: p.y0 + taper, x1: p.x0, y1: p.y1 - taper };
        return {
          box,
          face: {
            id,
            origin: { x, y: box.y0 },
            edges: [
              c({ x: p.x0, y: p.y0 }),
              hinge({ x: p.x0, y: p.y1 }),
              c({ x, y: box.y1 }),
              c({ x, y: box.y0 })
            ]
          }
        };
      }
      case "right": {
        const x = p.x1 + depth;
        const box = { x0: p.x1, y0: p.y0 + taper, x1: x, y1: p.y1 - taper };
        return {
          box,
          face: {
            id,
            origin: { x: p.x1, y: p.y0 },
            edges: [
              c({ x, y: box.y0 }),
              c({ x, y: box.y1 }),
              c({ x: p.x1, y: p.y1 }),
              hinge({ x: p.x1, y: p.y0 })
            ]
          }
        };
      }
    }
  }
  function assertUniqueIds(ids) {
    const seen = /* @__PURE__ */ new Set();
    for (const id of ids) {
      if (seen.has(id)) throw new Error(`Duplicate face id: "${id}"`);
      seen.add(id);
    }
  }
  function validateHoles(faceId, box, holes) {
    const bw = box.x1 - box.x0;
    const bh = box.y1 - box.y0;
    for (const h of holes) {
      if (h.w <= 0 || h.h <= 0) throw new Error(`holes(): "${faceId}" non-positive hole size`);
      if (h.x < -EPS2 || h.y < -EPS2 || h.x + h.w > bw + EPS2 || h.y + h.h > bh + EPS2) {
        throw new Error(
          `holes(): "${faceId}" hole (${h.x},${h.y}) ${h.w}×${h.h} outside face ${bw}×${bh}`
        );
      }
      for (const o of holes) {
        if (o === h) continue;
        const overlap = !(h.x + h.w <= o.x + EPS2 || o.x + o.w <= h.x + EPS2 || h.y + h.h <= o.y + EPS2 || o.y + o.h <= h.y + EPS2);
        if (overlap) throw new Error(`holes(): "${faceId}" overlapping holes`);
      }
    }
  }
  var StripBuilder = class {
    constructor(panels) {
      __publicField(this, "panels");
      __publicField(this, "attachments", []);
      if (panels.length === 0) throw new Error("row(): needs at least one panel");
      const h = panels[0].h;
      if (panels.some((p) => Math.abs(p.h - h) > 1e-9)) {
        throw new Error("row(): all panels must have the same height");
      }
      this.panels = panels;
    }
    attach(parentId, side, spec) {
      this.attachments.push({ parentId, side, spec });
      return this;
    }
    attachTop(parentId, spec) {
      return this.attach(parentId, "top", spec);
    }
    attachBottom(parentId, spec) {
      return this.attach(parentId, "bottom", spec);
    }
    attachLeft(parentId, spec) {
      return this.attach(parentId, "left", spec);
    }
    attachRight(parentId, spec) {
      return this.attach(parentId, "right", spec);
    }
    build() {
      assertUniqueIds([...this.panels.map((p) => p.id), ...this.attachments.map((a) => a.spec.id)]);
      const faces = /* @__PURE__ */ new Map();
      const boxes = /* @__PURE__ */ new Map();
      const flapInfo = /* @__PURE__ */ new Map();
      let x = 0;
      for (const p of this.panels) {
        const box = { x0: x, y0: 0, x1: x + p.w, y1: p.h };
        faces.set(p.id, rectFace(p.id, box));
        boxes.set(p.id, box);
        x += p.w;
      }
      for (let i = 0; i < this.panels.length - 1; i++) {
        const a = this.panels[i].id;
        const b = this.panels[i + 1].id;
        setCrease(faces, a, "right", b);
        setCrease(faces, b, "left", a);
      }
      for (const att of this.attachments) {
        const parentBox = boxes.get(att.parentId);
        if (!parentBox) throw new Error(`attach(): unknown parent face "${att.parentId}"`);
        const parentFlap = flapInfo.get(att.parentId);
        if (parentFlap && parentFlap.taper > 0 && att.side !== parentFlap.farSide) {
          throw new Error(
            `attach(): cannot attach to the "${att.side}" side of tapered flap "${att.parentId}" — attach to its far side`
          );
        }
        const { face, box } = makeFlap(att.spec, att.side, parentBox, att.parentId);
        faces.set(att.spec.id, face);
        boxes.set(att.spec.id, box);
        flapInfo.set(att.spec.id, { farSide: att.side, taper: att.spec.taper ?? 0 });
        setCrease(faces, att.parentId, att.side, att.spec.id);
        if (att.spec.holes?.length) {
          validateHoles(att.spec.id, box, att.spec.holes);
          face.holes = att.spec.holes.map((h) => ({
            x: box.x0 + h.x - face.origin.x,
            y: box.y0 + h.y - face.origin.y,
            w: h.w,
            h: h.h
          }));
        }
      }
      return [...faces.values()];
    }
  };
  function row(panels) {
    return new StripBuilder(panels);
  }
  function panel(id, w, h) {
    return { id, w, h };
  }
  function flap(id, depth, opts = {}) {
    return { id, depth, taper: opts.taper, edgeKind: opts.edgeKind, holes: opts.holes };
  }

  // engine/styles/fefco-0427.ts
  var TAB_D = 15;
  var TAB_TAPER = 3;
  var ROLL_GAP_T = 2;
  var EAR_CLEARANCE = 3;
  var f0427Coeffs = {
    // The L axis is double-walled: each roll end folds
    // outer wall → roll-over → inner wall, so the inner-wall
    // planes bounding the cavity sit 4T inboard of the
    // manufacture-size edges on that axis. Hence:
    //   manufacture.l = inner.l + 5T   (crease-to-crease)
    //   outer.l       = inner.l + 6T   (cut contour)
    // W and H are single-walled (+T / +2T).
    manufacture: { l: 5, w: 1, h: 1 },
    outer: { l: 6, w: 2, h: 2 }
  };
  function buildFefco0427Faces(m, thickness) {
    const { l: L, w: W, h: H } = m;
    const rollGap = ROLL_GAP_T * thickness;
    const earDepth = Math.max(W / 2 - EAR_CLEARANCE, 5);
    const lidTuck = Math.max(H - 2, 5);
    const wingDepth = Math.max(H - 4, 5);
    const tuckEarDepth = Math.max(H / 2 - 2, 5);
    const b = row([
      panel("backWall", H, L),
      panel("base", W, L),
      panel("frontWall", H, L),
      panel("lid", W, L),
      panel("lidTuck", lidTuck, L)
    ]);
    for (const end of ["L", "R"]) {
      const attach = end === "L" ? "attachBottom" : "attachTop";
      b[attach]("base", flap(`side${end}Outer`, H));
      b[attach](`side${end}Outer`, flap(`side${end}Roll`, rollGap));
      b[attach](`side${end}Roll`, flap(`side${end}Inner`, H));
      b[attach](`side${end}Inner`, flap(`side${end}Tab`, TAB_D, { taper: TAB_TAPER }));
    }
    b.attachTop("backWall", flap("earBackL", earDepth, { taper: 3 }));
    b.attachBottom("backWall", flap("earBackR", earDepth, { taper: 3 }));
    b.attachTop("frontWall", flap("earFrontL", earDepth, { taper: 3 }));
    b.attachBottom("frontWall", flap("earFrontR", earDepth, { taper: 3 }));
    b.attachTop("lid", flap("wingBack", wingDepth));
    b.attachBottom("lid", flap("wingFront", wingDepth));
    b.attachTop("lidTuck", flap("lidTuckTop", tuckEarDepth));
    b.attachBottom("lidTuck", flap("lidTuckBot", tuckEarDepth));
    return b.build();
  }
  var f0427FoldRoot = "base";
  var f0427FoldStages = [
    ["backWall", "frontWall"],
    ["earBackL", "earBackR", "earFrontL", "earFrontR"],
    ["sideLOuter", "sideROuter"],
    // capturing the ears
    ["sideLRoll", "sideRRoll"],
    ["sideLInner", "sideRInner"],
    ["sideLTab", "sideRTab"],
    ["lid", "wingBack", "wingFront"],
    ["lidTuck", "lidTuckTop", "lidTuckBot"]
  ];
  var fefco0427 = {
    id: "fefco-0427",
    label: "FEFCO 0427 · самоблокирующаяся вырубная коробка (mailer)",
    description: "Folder-type box. Die-cut from a single sheet, self-locking, no adhesive. Roll ends with locking tabs, hinged lid with front tuck.",
    fefcoRef: "FEFCO Code, 12th ed. (2022), p.52",
    verified: false,
    limits: { l: [80, 900], w: [60, 700], h: [20, 400] },
    defaults: { l: 300, w: 200, h: 80 },
    defaultMaterialId: "micro-e",
    coeffs: f0427Coeffs,
    buildFaces: buildFefco0427Faces,
    foldRoot: f0427FoldRoot,
    foldStages: f0427FoldStages,
    testVector: {
      input: { l: 254, w: 254, h: 102 },
      thickness: 1.5,
      expectFaces: 21,
      expectBlank: { x: 0, y: 0, w: 810, h: 655 },
      note: "Reference blank 810×655 mm from a published source; our engine produces 819.5×711.5 mm — the delta is in roll-end allowances. Verify against a real die before setting the verification badge."
    }
  };

  // engine/styles/fefco-0215.ts
  var GLUE_TAB = 20;
  var NOTCH_D_T = 4;
  var NOTCH_W_T = 2.5;
  var NOTCH_D_MIN = 10;
  var NOTCH_W_MIN = 6;
  var f0215Coeffs = {
    // Single-walled: crease-to-crease = inner + T, cut contour = inner + 2T.
    manufacture: { l: 1, w: 1, h: 1 },
    outer: { l: 2, w: 2, h: 2 }
  };
  function buildFefco0215Faces(m, thickness) {
    const { l: L, w: W, h: H } = m;
    const half = H / 2;
    const notchD = Math.max(NOTCH_D_T * thickness, NOTCH_D_MIN);
    const notchW = Math.max(NOTCH_W_T * thickness, NOTCH_W_MIN);
    const b = row([
      panel("back", L, H),
      panel("side1", W, H),
      panel("front", L, H),
      panel("side2", W, H)
    ]).attachLeft("back", flap("glueTab", GLUE_TAB, { edgeKind: "glue" }));
    for (const id of ["back", "side1", "front", "side2"]) {
      b.attachTop(id, flap(`${id}Top`, half));
    }
    for (const id of ["side1", "side2", "back", "front"]) {
      const width = id === "side1" || id === "side2" ? W : L;
      b.attachBottom(id, flap(`${id}Bot`, half, {
        holes: [{ x: width / 2 - notchW / 2, y: half - notchD, w: notchW, h: notchD }]
      }));
    }
    return b.build();
  }
  var f0215FoldRoot = "back";
  var f0215FoldStages = [
    ["side1", "front", "side2", "glueTab"],
    // close the tube
    ["side1Bot", "side2Bot"],
    // minor flaps first
    ["backBot", "frontBot"],
    // major flaps lock over them (1-2-3)
    ["side1Top", "side2Top"],
    ["backTop", "frontTop"]
    // top flaps meet in the centre
  ];
  var fefco0215 = {
    id: "fefco-0215",
    label: "FEFCO 0215 · слотковая коробка с snap-bottom 1-2-3 и крышкой",
    description: "Slotted container. Hand-locked 1-2-3 snap bottom, full lid of four half flaps meeting in the centre. Glued/stitched manufacturer's joint.",
    fefcoRef: "FEFCO Code, 12th ed. (2022)",
    verified: false,
    limits: { l: [50, 1200], w: [50, 1200], h: [50, 1200] },
    defaults: { l: 300, w: 200, h: 150 },
    defaultMaterialId: "flute-b",
    coeffs: f0215Coeffs,
    buildFaces: buildFefco0215Faces,
    foldRoot: f0215FoldRoot,
    foldStages: f0215FoldStages,
    testVector: {
      input: { l: 300, w: 200, h: 150 },
      thickness: 3,
      expectFaces: 13,
      note: "Structural vector: 13 faces, 12 creases, 4 snap slots. Blank gabarites to be verified against a real die."
    }
  };

  // engine/styles/index.ts
  var STYLES = [fefco0427, fefco0215];
  function getStyle(id) {
    const s = STYLES.find((x) => x.id === id);
    if (!s) throw new Error(`Unknown style: "${id}"`);
    return s;
  }

  // engine/validate.ts
  var MAX_BLANK_AREA = 1600 * 1100;
  function validate(style, sizes, bbox, material) {
    const warnings = [];
    for (const axis of ["l", "w", "h"]) {
      const [min, max] = style.limits[axis];
      if (sizes.inner[axis] < min) {
        warnings.push({
          code: "dim-min",
          message: `${axis.toUpperCase()} ${sizes.inner[axis]} мм ниже рекомендуемого минимума ${min} мм`
        });
      }
      if (sizes.inner[axis] > max) {
        warnings.push({
          code: "dim-max",
          message: `${axis.toUpperCase()} ${sizes.inner[axis]} мм выше рекомендуемого максимума ${max} мм`
        });
      }
    }
    if (bbox.w * bbox.h > MAX_BLANK_AREA) {
      warnings.push({
        code: "blank-oversize",
        message: `Разворот ${Math.round(bbox.w)}×${Math.round(bbox.h)} мм превышает типовой лист 1600×1100 мм`
      });
    }
    if (material.thickness > sizes.inner.h / 8) {
      warnings.push({
        code: "thickness-ratio",
        message: `Толщина ${material.thickness} мм велика для высоты ${sizes.inner.h} мм (T > H/8)`
      });
    }
    const preset = MATERIALS.find((m) => m.id === material.id);
    if (preset && Math.abs(preset.thickness - material.thickness) > 1e-9) {
      warnings.push({
        code: "material-mismatch",
        message: `Толщина ${material.thickness} мм не соответствует пресету "${preset.label}" (${preset.thickness} мм)`
      });
    }
    return warnings;
  }

  // engine/index.ts
  function generate(styleId2, params) {
    const style = getStyle(styleId2);
    const material = getMaterial(params.materialId, params.thickness);
    const sizes = resolveSizes(
      { l: params.l, w: params.w, h: params.h },
      params.sizeMode,
      material.thickness,
      style.coeffs
    );
    const faces = normaliseFaces(style.buildFaces(sizes.manufacture, material.thickness));
    const bbox = facesBbox(faces);
    checkInvariants({
      id: "main",
      materialId: material.id,
      thickness: material.thickness,
      faces,
      foldRoot: style.foldRoot,
      foldStages: style.foldStages
    });
    return {
      styleId: styleId2,
      params,
      layers: [
        {
          id: "main",
          materialId: material.id,
          thickness: material.thickness,
          faces,
          foldRoot: style.foldRoot,
          foldStages: style.foldStages
        }
      ],
      bbox,
      sizes,
      warnings: validate(style, sizes, bbox, material)
    };
  }
  function measureDieline(d) {
    const total = { cut: 0, crease: 0, perf: 0, glue: 0 };
    for (const layer of d.layers) {
      const m = measure(layer.faces);
      total.cut += m.cut;
      total.crease += m.crease;
      total.perf += m.perf;
      total.glue += m.glue;
    }
    return total;
  }

  // engine/pricing.ts
  var DEFAULT_TARIFFS = {
    knife2pt: 1600,
    knife3pt: 1700,
    perfGlue: 500,
    maxThickness2pt: 2
  };
  function priceDie(m, thickness, tariffs = DEFAULT_TARIFFS) {
    const knife = thickness <= tariffs.maxThickness2pt ? tariffs.knife2pt : tariffs.knife3pt;
    const cutting = (m.cut + m.crease) / 1e3 * knife;
    const finishing = (m.perf + m.glue) / 1e3 * tariffs.perfGlue;
    return Math.round(cutting + finishing);
  }

  // web/src/render-svg.ts
  var LAYER_STYLE = {
    cut: { color: "#e11d48", dash: "none", width: 0.5 },
    crease: { color: "#2563eb", dash: "6 3", width: 0.35 },
    perf: { color: "#059669", dash: "2 2", width: 0.35 },
    glue: { color: "#d97706", dash: "4 2", width: 0.4 }
  };
  function creaseKey(a, b, from, to) {
    const [f, t] = a < b ? [from, to] : [to, from];
    const [lo, hi] = a < b ? [a, b] : [b, a];
    return `${lo}|${hi}|${f.x.toFixed(3)},${f.y.toFixed(3)}|${t.x.toFixed(3)},${t.y.toFixed(3)}`;
  }
  function collectEdges(d) {
    const out = [];
    const seenCrease = /* @__PURE__ */ new Set();
    for (const layer of d.layers) {
      for (const face of layer.faces) {
        for (const s of segments(face)) {
          if (s.edge.kind === "crease") {
            const key = creaseKey(face.id, s.edge.hinge ?? "", s.from, s.to);
            if (seenCrease.has(key)) continue;
            seenCrease.add(key);
          }
          out.push({ kind: s.edge.kind, from: s.from, to: s.to });
        }
        for (const h of face.holes ?? []) {
          const x0 = face.origin.x + h.x;
          const y0 = face.origin.y + h.y;
          const x1 = x0 + h.w;
          const y1 = y0 + h.h;
          out.push({ kind: "cut", from: { x: x0, y: y0 }, to: { x: x1, y: y0 } });
          out.push({ kind: "cut", from: { x: x1, y: y0 }, to: { x: x1, y: y1 } });
          out.push({ kind: "cut", from: { x: x1, y: y1 }, to: { x: x0, y: y1 } });
          out.push({ kind: "cut", from: { x: x0, y: y1 }, to: { x: x0, y: y0 } });
        }
      }
    }
    return out;
  }
  function facePolygons(d) {
    return d.layers.flatMap((l) => l.faces.map((f) => [f.origin, ...f.edges.map((e) => e.to)]));
  }
  function renderSvg(d, opts = {}) {
    const margin = opts.margin ?? 12;
    const forPrint = opts.forPrint ?? false;
    const { x, y, w, h } = d.bbox;
    const totalW = w + margin * 2;
    const totalH = h + margin * 2;
    const edges = collectEdges(d);
    const parts = [];
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}mm" height="${totalH}mm" viewBox="${x - margin} ${y - margin} ${totalW} ${totalH}" data-unit="mm" data-scale="1:1">`
    );
    parts.push(
      `<rect x="${x - margin}" y="${y - margin}" width="${totalW}" height="${totalH}" fill="#ffffff"/>`
    );
    for (const poly of facePolygons(d)) {
      const pts = poly.map((p) => `${p.x},${p.y}`).join(" ");
      parts.push(`<polygon points="${pts}" fill="#f8fafc" stroke="none"/>`);
    }
    const kinds = ["cut", "crease", "perf", "glue"];
    for (const kind of kinds) {
      const st = LAYER_STYLE[kind];
      const lines = edges.filter((e) => e.kind === kind);
      if (!lines.length) continue;
      parts.push(`<g data-layer="${kind}" stroke="${st.color}" stroke-width="${st.width}" fill="none"`);
      if (st.dash !== "none") parts.push(` stroke-dasharray="${st.dash}"`);
      parts.push(` stroke-linecap="round">`);
      for (const e of lines) {
        parts.push(`<line x1="${e.from.x}" y1="${e.from.y}" x2="${e.to.x}" y2="${e.to.y}"/>`);
      }
      parts.push("</g>");
    }
    if (!forPrint) {
      parts.push(`<g data-layer="labels" fill="#0f172a" font-family="system-ui,sans-serif" font-size="11">`);
      parts.push(
        `<text x="${x + w / 2}" y="${y - 4}" text-anchor="middle">L = ${round(d.sizes.inner.l)} мм</text>`
      );
      parts.push(
        `<text x="${x - 4}" y="${y + h / 2}" text-anchor="end" transform="rotate(-90 ${x - 4} ${y + h / 2})">B = ${round(d.sizes.inner.w)} мм</text>`
      );
      parts.push(
        `<text x="${x - 4}" y="${y + 3}" text-anchor="end">H = ${round(d.sizes.inner.h)} мм</text>`
      );
      parts.push(
        `<text x="${x + w / 2}" y="${y + h + 14}" text-anchor="middle" fill="#475569">Разворот ${round(w)} × ${round(h)} мм</text>`
      );
      parts.push("</g>");
    }
    parts.push("</svg>");
    return parts.join("\n");
  }
  var round = (n) => Math.round(n * 100) / 100;

  // web/src/export-dxf.ts
  var LAYER_COLOR = {
    CUT: 1,
    // red
    CREASE: 5,
    // blue
    PERF: 3,
    // green
    GLUE: 2
    // yellow
  };
  var KIND_TO_LAYER = {
    cut: "CUT",
    crease: "CREASE",
    perf: "PERF",
    glue: "GLUE"
  };
  var g = (code, value) => ({ code, value });
  function dxf(groups) {
    let out = "";
    for (const gr of groups) out += `${gr.code}
${gr.value}
`;
    return out;
  }
  function renderDxf(d) {
    const s = [];
    s.push(
      g(0, "SECTION"),
      g(2, "HEADER"),
      g(9, "$ACADVER"),
      g(1, "AC1009"),
      g(9, "$INSUNITS"),
      g(70, 4),
      // millimetres
      g(9, "$MEASUREMENT"),
      g(70, 1),
      // metric
      g(9, "$EXTMIN"),
      g(10, d.bbox.x),
      g(20, d.bbox.y),
      g(30, 0),
      g(9, "$EXTMAX"),
      g(10, d.bbox.x + d.bbox.w),
      g(20, d.bbox.y + d.bbox.h),
      g(30, 0),
      g(0, "ENDSEC")
    );
    s.push(
      g(0, "SECTION"),
      g(2, "TABLES"),
      // LTYPE table
      g(0, "TABLE"),
      g(2, "LTYPE"),
      g(70, 1),
      g(0, "LTYPE"),
      g(2, "CONTINUOUS"),
      g(70, 0),
      g(3, "Solid line"),
      g(72, 65),
      g(73, 0),
      g(40, 0),
      g(0, "ENDTAB"),
      // LAYER table
      g(0, "TABLE"),
      g(2, "LAYER"),
      g(70, Object.keys(LAYER_COLOR).length)
    );
    for (const [name, color] of Object.entries(LAYER_COLOR)) {
      s.push(g(0, "LAYER"), g(2, name), g(70, 0), g(62, color), g(6, "CONTINUOUS"));
    }
    s.push(
      g(0, "ENDTAB"),
      // STYLE table (required by most importers)
      g(0, "TABLE"),
      g(2, "STYLE"),
      g(70, 1),
      g(0, "STYLE"),
      g(2, "STANDARD"),
      g(70, 0),
      g(40, 0),
      g(41, 1),
      g(50, 0),
      g(71, 0),
      g(42, 2.5),
      g(3, "txt"),
      g(4, ""),
      g(0, "ENDTAB"),
      g(0, "ENDSEC")
    );
    s.push(g(0, "SECTION"), g(2, "ENTITIES"));
    const flip = (y) => -y;
    for (const e of collectEdges(d)) {
      const layer = KIND_TO_LAYER[e.kind];
      s.push(
        g(0, "LINE"),
        g(8, layer),
        g(10, e.from.x.toFixed(4)),
        g(20, flip(e.from.y).toFixed(4)),
        g(30, "0"),
        g(11, e.to.x.toFixed(4)),
        g(21, flip(e.to.y).toFixed(4)),
        g(31, "0")
      );
    }
    s.push(g(0, "ENDSEC"), g(0, "EOF"));
    return dxf(s);
  }

  // web/src/export-pdf.ts
  var MM = 72 / 25.4;
  var P = (v) => (Math.round(v * 1e3) / 1e3).toString();
  var Pdf = class {
    constructor() {
      __publicField(this, "objs", []);
    }
    add(o) {
      this.objs.push(o);
      return this.objs.length;
    }
    build() {
      const enc = new TextEncoder();
      const chunks = [];
      let len = 0;
      const push = (s) => {
        const b = enc.encode(s);
        chunks.push(b);
        len += b.length;
      };
      push("%PDF-1.4\n%âãÏÓ\n");
      const offsets = [];
      this.objs.forEach((o, i) => {
        offsets.push(len);
        const body = typeof o === "string" ? o : `${o.dict}
stream
${o.stream}
endstream`;
        push(`${i + 1} 0 obj
${body}
endobj
`);
      });
      const xref = len;
      let t = `xref
0 ${this.objs.length + 1}
0000000000 65535 f 
`;
      for (const off of offsets) t += `${String(off).padStart(10, "0")} 00000 n 
`;
      t += `trailer
<< /Size ${this.objs.length + 1} /Root 1 0 R >>
startxref
${xref}
%%EOF
`;
      push(t);
      const total = chunks.reduce((a, c) => a + c.length, 0);
      const out = new Uint8Array(total);
      let p = 0;
      for (const c of chunks) {
        out.set(c, p);
        p += c.length;
      }
      return out;
    }
  };
  var GROUPS = [
    { kind: "cut", rgb: [0.85, 0.11, 0.28], w: 0.4, dash: [] },
    { kind: "crease", rgb: [0.15, 0.39, 0.92], w: 0.3, dash: [2, 1.5] },
    { kind: "perf", rgb: [0.02, 0.59, 0.41], w: 0.3, dash: [0.7, 0.7] },
    { kind: "glue", rgb: [0.85, 0.47, 0.02], w: 0.35, dash: [1.5, 1] }
  ];
  function renderPdf(d) {
    const pdf = new Pdf();
    const m = 12;
    const boxW = d.bbox.w + m * 2;
    const boxH = d.bbox.h + m * 2;
    const ox = d.bbox.x - m;
    const oy = d.bbox.y - m;
    const fy = (y) => boxH - (y - oy);
    let cs = `${P(MM)} 0 0 ${P(MM)} 0 0 cm
`;
    cs += "1 J 1 j\n";
    const edges = collectEdges(d);
    for (const g2 of GROUPS) {
      const list = edges.filter((e) => e.kind === g2.kind);
      if (!list.length) continue;
      cs += `${P(g2.rgb[0])} ${P(g2.rgb[1])} ${P(g2.rgb[2])} RG
${P(g2.w)} w
`;
      cs += g2.dash.length ? `[${g2.dash.map(P).join(" ")}] 0 d
` : "[] 0 d\n";
      for (const e of list) {
        cs += `${P(e.from.x - ox)} ${P(fy(e.from.y))} m ${P(e.to.x - ox)} ${P(fy(e.to.y))} l S
`;
      }
    }
    cs += "0 0 0 rg\nBT /F1 9 Tf\n";
    const label = (x, y, txt, size = 9) => {
      cs += `/F1 ${size} Tf ${P(x - ox)} ${P(fy(y))} Td (${txt}) Tj
`;
    };
    const bb = d.bbox;
    label(bb.x + bb.w / 2 - 22, bb.y - 5, `L ${P(d.sizes.inner.l)}  B ${P(d.sizes.inner.w)}  H ${P(d.sizes.inner.h)} mm`);
    label(bb.x + bb.w / 2 - 24, bb.y + bb.h + 8, `Blank ${P(bb.w)} x ${P(bb.h)} mm  (1:1)`);
    cs += "ET\n";
    pdf.add("<< /Type /Catalog /Pages 2 0 R >>");
    pdf.add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    pdf.add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${P(boxW * MM)} ${P(boxH * MM)}] /Resources << /Font << /F1 5 0 R >> /ProcSet [/PDF] >> /Contents 4 0 R >>`
    );
    pdf.add({ dict: `<< /Length ${cs.length} >>`, stream: cs });
    pdf.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    return pdf.build();
  }

  // web/src/app.ts
  var $ = (sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`missing element: ${sel}`);
    return el;
  };
  var state = {
    l: 300,
    w: 200,
    h: 150,
    sizeMode: "inner",
    thickness: 1.5,
    materialId: "micro-e"
  };
  var current = null;
  function fmt(n, digits = 1) {
    return n.toLocaleString("ru-RU", { maximumFractionDigits: digits });
  }
  function sizeModeRu(m) {
    return m === "inner" ? "внутренние" : m === "manufacture" ? "по линиям сгиба" : "наружные";
  }
  function readParams() {
    const matId = $("#material").value;
    const preset = MATERIALS.find((m) => m.id === matId);
    const num = (sel, fallback) => {
      const v = parseFloat($(sel).value);
      return Number.isFinite(v) && v > 0 ? v : fallback;
    };
    return {
      l: num("#l", 300),
      w: num("#w", 200),
      h: num("#h", 150),
      sizeMode: $("#sizeMode").value,
      materialId: matId,
      thickness: matId === "custom" ? num("#thickness", 1.5) : preset?.thickness ?? 1.5
    };
  }
  function styleId() {
    return $("#style").value;
  }
  function syncUrl() {
    const p = new URLSearchParams({
      s: styleId().replace("fefco-", ""),
      l: String(state.l),
      w: String(state.w),
      h: String(state.h),
      m: state.materialId,
      sm: state.sizeMode
    });
    history.replaceState(null, "", `?${p}`);
  }
  function loadUrl() {
    const p = new URLSearchParams(location.search);
    if (!p.has("s")) return false;
    const s = `fefco-${p.get("s")}`;
    if (!STYLES.some((x) => x.id === s)) return false;
    $("#style").value = s;
    const st = getStyle(s);
    state.l = parseFloat(p.get("l") ?? "") || st.defaults.l;
    state.w = parseFloat(p.get("w") ?? "") || st.defaults.w;
    state.h = parseFloat(p.get("h") ?? "") || st.defaults.h;
    state.sizeMode = p.get("sm") || "inner";
    const m = p.get("m");
    if (m && MATERIALS.some((x) => x.id === m)) state.materialId = m;
    else state.materialId = st.defaultMaterialId;
    $("#sizeMode").value = state.sizeMode;
    syncInputs();
    return true;
  }
  function download(name, data, mime) {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  function stamp() {
    return `formgen-${styleId().replace("fefco-", "")}-${state.l}x${state.w}x${state.h}-T${state.thickness}`;
  }
  function render() {
    const sid = styleId();
    const style = getStyle(sid);
    const params = readParams();
    Object.assign(state, params);
    const d = generate(sid, {
      l: state.l,
      w: state.w,
      h: state.h,
      sizeMode: state.sizeMode,
      thickness: state.thickness,
      materialId: state.materialId
    });
    current = d;
    const m = measureDieline(d);
    const price = priceDie(m, state.thickness);
    const knife = state.thickness <= DEFAULT_TARIFFS.maxThickness2pt ? "2pt" : "3pt";
    $("#preview").innerHTML = renderSvg(d);
    const svg = $("#preview svg");
    if (svg) svg.removeAttribute("width"), svg.removeAttribute("height");
    $("#blank").textContent = `${fmt(d.bbox.w)} × ${fmt(d.bbox.h)} мм`;
    $("#panels").textContent = String(d.layers[0].faces.length);
    $("#mCut").textContent = `${fmt(m.cut / 1e3, 3)} м`;
    $("#mCrease").textContent = `${fmt(m.crease / 1e3, 3)} м`;
    $("#mPerf").textContent = `${fmt(m.perf / 1e3, 3)} м`;
    $("#mGlue").textContent = `${fmt(m.glue / 1e3, 3)} м`;
    $("#price").textContent = `${fmt(price, 0)} ₽`;
    $("#tariff").textContent = `нож ${knife}, T = ${state.thickness} мм`;
    const edges = collectEdges(d);
    for (const el of document.querySelectorAll("[data-count]")) {
      const k = el.dataset.count;
      el.textContent = String(edges.filter((e) => e.kind === k).length);
    }
    const wl = $("#warnings");
    if (d.warnings.length) {
      wl.innerHTML = d.warnings.map((x) => `<li>${x.message}</li>`).join("");
      wl.hidden = false;
    } else {
      wl.hidden = true;
    }
    const badge = $("#badge");
    badge.textContent = style.verified ? "сверено с реальным штампом" : "не сверено с реальным штампом";
    badge.className = `badge ${style.verified ? "ok" : "warn"}`;
    $("#fefcoRef").textContent = style.fefcoRef;
    $("#reqSummary").textContent = `${style.label.split("·")[0].trim()} ${state.l}×${state.w}×${state.h} мм, T ${state.thickness} мм, штанцформа ≈ ${fmt(price, 0)} ₽`;
    syncUrl();
  }
  function syncInputs() {
    $("#l").value = String(state.l);
    $("#w").value = String(state.w);
    $("#h").value = String(state.h);
    $("#material").value = state.materialId;
  }
  function applyStyleDefaults() {
    const st = getStyle(styleId());
    state.l = st.defaults.l;
    state.w = st.defaults.w;
    state.h = st.defaults.h;
    state.materialId = st.defaultMaterialId;
    syncInputs();
    syncMaterialUi();
  }
  function syncMaterialUi() {
    const sel = $("#material");
    const custom = $("#thickness");
    custom.hidden = sel.value !== "custom";
    $("#thicknessField").hidden = sel.value !== "custom";
    if (sel.value !== "custom") {
      const m = MATERIALS.find((x) => x.id === sel.value);
      if (m) custom.value = String(m.thickness);
    }
  }
  function init() {
    const selStyle = $("#style");
    for (const s of STYLES) {
      const o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.label;
      selStyle.appendChild(o);
    }
    const selMat = $("#material");
    for (const m of MATERIALS) {
      const o = document.createElement("option");
      o.value = m.id;
      o.textContent = `${m.label} — ${m.thickness} мм`;
      selMat.appendChild(o);
    }
    const oc = document.createElement("option");
    oc.value = "custom";
    oc.textContent = "Произвольная толщина";
    selMat.appendChild(oc);
    if (!loadUrl()) applyStyleDefaults();
    syncMaterialUi();
    for (const id of ["#l", "#w", "#h"]) {
      $(id).addEventListener("input", render);
    }
    selStyle.addEventListener("change", () => {
      applyStyleDefaults();
      render();
    });
    selMat.addEventListener("change", () => {
      syncMaterialUi();
      render();
    });
    $("#sizeMode").addEventListener("change", render);
    $("#thickness").addEventListener("input", render);
    for (const cb of document.querySelectorAll("[data-layer-toggle]")) {
      cb.addEventListener("change", () => {
        const g2 = document.querySelector(`#preview g[data-layer="${cb.dataset.layerToggle}"]`);
        if (g2) g2.style.display = cb.checked ? "" : "none";
      });
    }
    $("#dlSvg").addEventListener("click", () => {
      if (current) download(`${stamp()}.svg`, renderSvg(current), "image/svg+xml");
    });
    $("#dlDxf").addEventListener("click", () => {
      if (current) download(`${stamp()}.dxf`, renderDxf(current), "application/dxf");
    });
    $("#dlPdf").addEventListener("click", () => {
      if (current) download(`${stamp()}.pdf`, renderPdf(current), "application/pdf");
    });
    $("#copyLink").addEventListener("click", async () => {
      await navigator.clipboard.writeText(location.href);
      const b = $("#copyLink");
      b.textContent = "Ссылка скопирована";
      setTimeout(() => b.textContent = "Скопировать ссылку", 2e3);
    });
    $("#lead").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const out = $("#leadOut");
      const fd = new FormData(ev.currentTarget);
      const get = (k) => String(fd.get(k) ?? "");
      const style = getStyle(styleId());
      const lines = [
        `Заявка на штанцформу — ${style.label.split("·")[0].trim()}`,
        "",
        `Имя: ${get("name")}`,
        `Типография: ${get("company") || "—"}`,
        `Контакт: ${get("contact")}`,
        `Комментарий: ${get("comment") || "—"}`,
        "",
        `Конструкция: ${style.label}`,
        `Параметры: ${state.l}×${state.w}×${state.h} мм (${sizeModeRu(state.sizeMode)}), T = ${state.thickness} мм`,
        current ? `Разворот: ${current.bbox.w.toFixed(1)}×${current.bbox.h.toFixed(1)} мм` : "",
        current ? `Расчёт штанцформы: ≈ ${$("#price").textContent}` : "",
        "",
        "Чертёж прикладываю файлом (DXF/PDF из конфигуратора)."
      ].filter(Boolean).join("\n");
      const subject = encodeURIComponent(`Штанцформа ${styleId().replace("fefco-", "")} ${state.l}×${state.w}×${state.h}`);
      location.href = `mailto:ru235@mail.ru?subject=${subject}&body=${encodeURIComponent(lines)}`;
      out.textContent = "Открыли почту — отправьте письмо и приложите чертёж (DXF или PDF).";
      out.hidden = false;
    });
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
