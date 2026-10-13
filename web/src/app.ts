import { generate, measureDieline } from '../../engine/index.ts'
import { getStyle, STYLES } from '../../engine/styles/index.ts'
import { MATERIALS } from '../../engine/materials.ts'
import { priceDie, DEFAULT_TARIFFS } from '../../engine/pricing.ts'
import { renderDxf } from './export-dxf.ts'
import { renderPdf } from './export-pdf.ts'
import { collectEdges, KIND_LABEL, renderSvg } from './render-svg.ts'
import type { Dieline, SizeMode, StyleParams } from '../../engine/types.ts'

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel)
  if (!el) throw new Error(`missing element: ${sel}`)
  return el
}

type State = StyleParams

const state: State = {
  l: 300,
  w: 200,
  h: 150,
  sizeMode: 'inner',
  thickness: 1.5,
  materialId: 'micro-e',
}

let current: Dieline | null = null

function fmt(n: number, digits = 1): string {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: digits })
}

function sizeModeRu(m: SizeMode): string {
  return m === 'inner' ? 'внутренние' : m === 'manufacture' ? 'по линиям сгиба' : 'наружные'
}

function readParams(): State {
  const matId = $<HTMLSelectElement>('#material').value
  const preset = MATERIALS.find((m) => m.id === matId)
  const num = (sel: string, fallback: number) => {
    const v = parseFloat($<HTMLInputElement>(sel).value)
    return Number.isFinite(v) && v > 0 ? v : fallback
  }
  return {
    l: num('#l', 300),
    w: num('#w', 200),
    h: num('#h', 150),
    sizeMode: $<HTMLSelectElement>('#sizeMode').value as SizeMode,
    materialId: matId,
    thickness: matId === 'custom' ? num('#thickness', 1.5) : (preset?.thickness ?? 1.5),
  }
}

function styleId(): string {
  return $<HTMLSelectElement>('#style').value
}

function syncUrl(): void {
  const p = new URLSearchParams({
    s: styleId().replace('fefco-', ''),
    l: String(state.l),
    w: String(state.w),
    h: String(state.h),
    m: state.materialId,
    sm: state.sizeMode,
  })
  history.replaceState(null, '', `?${p}`)
}

function loadUrl(): boolean {
  const p = new URLSearchParams(location.search)
  if (!p.has('s')) return false
  const s = `fefco-${p.get('s')}`
  if (!STYLES.some((x) => x.id === s)) return false
  $<HTMLSelectElement>('#style').value = s
  const st = getStyle(s)
  state.l = parseFloat(p.get('l') ?? '') || st.defaults.l
  state.w = parseFloat(p.get('w') ?? '') || st.defaults.w
  state.h = parseFloat(p.get('h') ?? '') || st.defaults.h
  state.sizeMode = (p.get('sm') as SizeMode) || 'inner'
  const m = p.get('m')
  if (m && MATERIALS.some((x) => x.id === m)) state.materialId = m
  else state.materialId = st.defaultMaterialId
  $<HTMLSelectElement>('#sizeMode').value = state.sizeMode
  syncInputs()
  return true
}

function download(name: string, data: string | Uint8Array, mime: string): void {
  const blob = new Blob([data as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function stamp(): string {
  return `formgen-${styleId().replace('fefco-', '')}-${state.l}x${state.w}x${state.h}-T${state.thickness}`
}

function render(): void {
  const sid = styleId()
  const style = getStyle(sid)
  const params = readParams()
  Object.assign(state, params)

  const d = generate(sid, {
    l: state.l, w: state.w, h: state.h,
    sizeMode: state.sizeMode,
    thickness: state.thickness,
    materialId: state.materialId,
  })
  current = d
  const m = measureDieline(d)
  const price = priceDie(m, state.thickness)
  const knife = state.thickness <= DEFAULT_TARIFFS.maxThickness2pt ? '2pt' : '3pt'

  // preview
  $('#preview').innerHTML = renderSvg(d)
  const svg = $<HTMLElement>('#preview svg')
  if (svg) svg.removeAttribute('width'), svg.removeAttribute('height')

  // metrics
  $('#blank').textContent = `${fmt(d.bbox.w)} × ${fmt(d.bbox.h)} мм`
  $('#panels').textContent = String(d.layers[0].faces.length)
  $('#mCut').textContent = `${fmt(m.cut / 1000, 3)} м`
  $('#mCrease').textContent = `${fmt(m.crease / 1000, 3)} м`
  $('#mPerf').textContent = `${fmt(m.perf / 1000, 3)} м`
  $('#mGlue').textContent = `${fmt(m.glue / 1000, 3)} м`
  $('#price').textContent = `${fmt(price, 0)} ₽`
  $('#tariff').textContent = `нож ${knife}, T = ${state.thickness} мм`

  // legend counts
  const edges = collectEdges(d)
  for (const el of document.querySelectorAll<HTMLElement>('[data-count]')) {
    const k = el.dataset.count!
    el.textContent = String(edges.filter((e) => e.kind === k).length)
  }

  // warnings
  const wl = $('#warnings')
  if (d.warnings.length) {
    wl.innerHTML = d.warnings.map((x) => `<li>${x.message}</li>`).join('')
    wl.hidden = false
  } else {
    wl.hidden = true
  }

  // badge
  const badge = $('#badge')
  badge.textContent = style.verified ? 'сверено с реальным штампом' : 'не сверено с реальным штампом'
  badge.className = `badge ${style.verified ? 'ok' : 'warn'}`
  $('#fefcoRef').textContent = style.fefcoRef

  // lead payload preview
  $('#reqSummary').textContent =
    `${style.label.split('·')[0].trim()} ${state.l}×${state.w}×${state.h} мм, ` +
    `T ${state.thickness} мм, штанцформа ≈ ${fmt(price, 0)} ₽`

  syncUrl()
}

function syncInputs(): void {
  $<HTMLInputElement>('#l').value = String(state.l)
  $<HTMLInputElement>('#w').value = String(state.w)
  $<HTMLInputElement>('#h').value = String(state.h)
  $<HTMLSelectElement>('#material').value = state.materialId
}

function applyStyleDefaults(): void {
  const st = getStyle(styleId())
  state.l = st.defaults.l
  state.w = st.defaults.w
  state.h = st.defaults.h
  state.materialId = st.defaultMaterialId
  syncInputs()
  syncMaterialUi()
}

function syncMaterialUi(): void {
  const sel = $<HTMLSelectElement>('#material')
  const custom = $<HTMLInputElement>('#thickness')
  custom.hidden = sel.value !== 'custom'
  $<HTMLElement>('#thicknessField').hidden = sel.value !== 'custom'
  if (sel.value !== 'custom') {
    const m = MATERIALS.find((x) => x.id === sel.value)
    if (m) custom.value = String(m.thickness)
  }
}

function init(): void {
  // style options
  const selStyle = $<HTMLSelectElement>('#style')
  for (const s of STYLES) {
    const o = document.createElement('option')
    o.value = s.id
    o.textContent = s.label
    selStyle.appendChild(o)
  }
  // material options
  const selMat = $<HTMLSelectElement>('#material')
  for (const m of MATERIALS) {
    const o = document.createElement('option')
    o.value = m.id
    o.textContent = `${m.label} — ${m.thickness} мм`
    selMat.appendChild(o)
  }
  const oc = document.createElement('option')
  oc.value = 'custom'
  oc.textContent = 'Произвольная толщина'
  selMat.appendChild(oc)

  // URL state wins over the style defaults, so shared links reproduce exactly
  // the drawing they were copied from.
  if (!loadUrl()) applyStyleDefaults()
  syncMaterialUi()

  // listeners
  for (const id of ['#l', '#w', '#h']) {
    $<HTMLInputElement>(id).addEventListener('input', render)
  }
  selStyle.addEventListener('change', () => { applyStyleDefaults(); render() })
  selMat.addEventListener('change', () => { syncMaterialUi(); render() })
  $<HTMLSelectElement>('#sizeMode').addEventListener('change', render)
  $<HTMLInputElement>('#thickness').addEventListener('input', render)

  // layer toggles
  for (const cb of document.querySelectorAll<HTMLInputElement>('[data-layer-toggle]')) {
    cb.addEventListener('change', () => {
      const g = document.querySelector<SVGGElement>(`#preview g[data-layer="${cb.dataset.layerToggle}"]`)
      if (g) g.style.display = cb.checked ? '' : 'none'
    })
  }

  // downloads
  $<HTMLButtonElement>('#dlSvg').addEventListener('click', () => {
    if (current) download(`${stamp()}.svg`, renderSvg(current), 'image/svg+xml')
  })
  $<HTMLButtonElement>('#dlDxf').addEventListener('click', () => {
    if (current) download(`${stamp()}.dxf`, renderDxf(current), 'application/dxf')
  })
  $<HTMLButtonElement>('#dlPdf').addEventListener('click', () => {
    if (current) download(`${stamp()}.pdf`, renderPdf(current), 'application/pdf')
  })

  // copy link
  $<HTMLButtonElement>('#copyLink').addEventListener('click', async () => {
    await navigator.clipboard.writeText(location.href)
    const b = $('#copyLink')
    b.textContent = 'Ссылка скопирована'
    setTimeout(() => (b.textContent = 'Скопировать ссылку'), 2000)
  })

  // lead form
  // lead form — no backend on this host: compose a prefilled mail (and offer
  // Telegram). The drawing/PDF/DXF are downloaded separately and attached.
  $<HTMLFormElement>('#lead').addEventListener('submit', (ev) => {
    ev.preventDefault()
    const out = $('#leadOut')
    const fd = new FormData(ev.currentTarget as HTMLFormElement)
    const get = (k: string) => String(fd.get(k) ?? '')
    const style = getStyle(styleId())
    const lines = [
      `Заявка на штанцформу — ${style.label.split('·')[0].trim()}`,
      '',
      `Имя: ${get('name')}`,
      `Типография: ${get('company') || '—'}`,
      `Контакт: ${get('contact')}`,
      `Комментарий: ${get('comment') || '—'}`,
      '',
      `Конструкция: ${style.label}`,
      `Параметры: ${state.l}×${state.w}×${state.h} мм (${sizeModeRu(state.sizeMode)}), T = ${state.thickness} мм`,
      current ? `Разворот: ${current.bbox.w.toFixed(1)}×${current.bbox.h.toFixed(1)} мм` : '',
      current ? `Расчёт штанцформы: ≈ ${$('#price').textContent}` : '',
      '',
      'Чертёж прикладываю файлом (DXF/PDF из конфигуратора).',
    ].filter(Boolean).join('\n')
    const subject = encodeURIComponent(`Штанцформа ${styleId().replace('fefco-', '')} ${state.l}×${state.w}×${state.h}`)
    location.href = `mailto:ru235@mail.ru?subject=${subject}&body=${encodeURIComponent(lines)}`
    out.textContent = 'Открыли почту — отправьте письмо и приложите чертёж (DXF или PDF).'
    out.hidden = false
  })

  render()
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
else init()