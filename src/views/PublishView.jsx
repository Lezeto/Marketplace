import { useEffect, useMemo, useRef, useState } from 'react'
import { callApi } from '../lib/api'
import { useApp } from '../lib/context'
import {
  LISTING_TYPES, REGIONS, CONDITIONS, SHIPPING_OPTIONS, CURRENCIES, BADGES,
  categoriesForType, findCategory, findRegion, priceTypesForType, MAX_IMAGES,
} from '../constants/catalog'

const EMPTY_FORM = {
  type: 'producto',
  title: '',
  category: '',
  subcategory: '',
  description: '',
  price: '',
  currency: 'CLP',
  price_type: 'fijo',
  condition: 'usado',
  stock: '',
  shipping: 'retiro',
  badge: '',
  region_code: '',
  comuna: '',
  address: '',
}

// Publicar / editar aviso. Un solo flujo que se adapta al tipo (producto vs. servicio).
export default function PublishView({ params }) {
  const { session, supabase, requireAuth, navigate } = useApp()
  const editId = params?.id ?? null
  const [form, setForm] = useState({ ...EMPTY_FORM })
  // Fotos: { url } (ya subida) o { file, preview } (nueva)
  const [photos, setPhotos] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingListing, setLoadingListing] = useState(Boolean(editId))
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!session) navigate('auth', { next: { name: 'publish', params: editId != null ? { id: editId } : {} } })
  }, [session, navigate, editId])

  // Modo edición: precargar el aviso
  useEffect(() => {
    if (editId == null) {
      setForm({ ...EMPTY_FORM })
      setPhotos([])
      setLoadingListing(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const resp = await callApi({ action: 'get-listing', id: editId })
        if (cancelled) return
        const l = resp.listing
        setForm({
          type: l.type || 'producto',
          title: l.title || '',
          category: l.category || '',
          subcategory: l.subcategory || '',
          description: l.description || '',
          price: l.price ?? '',
          currency: l.currency || 'CLP',
          price_type: l.price_type || (l.type === 'servicio' ? 'convenir' : 'fijo'),
          condition: l.condition || 'usado',
          stock: l.stock ?? '',
          shipping: l.shipping || 'retiro',
          badge: l.badge || '',
          region_code: l.region_code || '',
          comuna: l.comuna || '',
          address: l.address || '',
        })
        setPhotos((l.images || []).map(u => ({ url: u })))
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoadingListing(false)
      }
    })()
    return () => { cancelled = true }
  }, [editId])

  const set = (patch) => setForm(f => {
    const next = { ...f, ...patch }
    if ('type' in patch && patch.type !== f.type) {
      next.category = ''
      next.subcategory = ''
      next.price_type = patch.type === 'servicio' ? 'convenir' : 'fijo'
    }
    if ('category' in patch && patch.category !== f.category) next.subcategory = ''
    if ('region_code' in patch && patch.region_code !== f.region_code) next.comuna = ''
    return next
  })

  const cats = categoriesForType(form.type)
  const category = findCategory(form.type, form.category)
  const region = findRegion(form.region_code)
  const priceTypes = priceTypesForType(form.type)
  const priceDisabled = form.price_type === 'convenir'
  // UF disponible solo donde tiene sentido (inmuebles), como en yapo.cl
  const allowUF = form.category === 'inmuebles'

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []).filter(f => f.type.startsWith('image/'))
    setPhotos(prev => {
      const room = MAX_IMAGES - prev.length
      const chosen = incoming.slice(0, room)
      return [...prev, ...chosen.map(file => ({ file, preview: URL.createObjectURL(file) }))]
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePhoto = (idx) => {
    setPhotos(prev => {
      const target = prev[idx]
      if (target?.preview) URL.revokeObjectURL(target.preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const movePhoto = (idx, dir) => {
    setPhotos(prev => {
      const next = [...prev]
      const j = idx + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }

  const uploadNewPhotos = async () => {
    const urls = []
    for (const p of photos) {
      if (p.url) {
        urls.push(p.url)
        continue
      }
      const file = p.file
      const ext = (() => {
        const n = file.name || ''
        const i = n.lastIndexOf('.')
        return i > -1 ? n.slice(i + 1).toLowerCase() : 'jpg'
      })()
      const rid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2)
      const path = `${session.user.id}/${rid}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('listings2').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg',
      })
      if (upErr) throw new Error(`Error al subir una foto: ${upErr.message || upErr}`)
      const { data: pub } = supabase.storage.from('listings2').getPublicUrl(path)
      urls.push(pub.publicUrl)
    }
    return urls
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!requireAuth()) return
    setError('')
    if (!form.category) { setError('Elige una categoría para tu aviso.'); return }
    if (!form.region_code) { setError('Indica la región.'); return }
    if (!priceDisabled && (form.price === '' || Number(form.price) < 0)) { setError('Indica el precio.'); return }
    try {
      setBusy(true)
      const images = await uploadNewPhotos()
      const payload = {
        action: editId != null ? 'update-listing' : 'create-listing',
        token: session.access_token,
        type: form.type,
        title: form.title,
        category: form.category,
        subcategory: form.subcategory || null,
        description: form.description,
        price: priceDisabled ? 0 : Number(form.price),
        currency: allowUF ? form.currency : 'CLP',
        price_type: form.price_type,
        badge: form.badge || null,
        region_code: form.region_code,
        comuna: form.comuna || null,
        address: form.address || '',
        images,
      }
      if (editId != null) payload.id = editId
      if (form.type === 'producto') {
        payload.condition = form.condition
        payload.stock = form.stock === '' ? null : Number(form.stock)
        payload.shipping = form.shipping
      }
      const resp = await callApi(payload)
      navigate('detail', { id: resp.listing.id })
    } catch (e2) {
      setError(e2.message)
    } finally {
      setBusy(false)
    }
  }

  const photoSlots = useMemo(() => photos.map((p, i) => ({
    key: p.url || p.preview || i,
    src: p.url || p.preview,
    idx: i,
  })), [photos])

  if (loadingListing) {
    return <div className="page-narrow"><div className="sk-line w80 shimmer" /><div className="sk-line w60 shimmer" /></div>
  }

  return (
    <div className="page-narrow">
      <form className="publish-form" onSubmit={submit}>
        <h1>{editId != null ? 'Editar aviso' : 'Publicar aviso'}</h1>
        <p className="form-hint">Publicar es gratis. Mientras más completo el aviso, más contactos recibirás.</p>
        {error && <div className="error">{error}</div>}

        <div className="field">
          <span className="field-label">¿Qué quieres publicar?</span>
          <div className="seg big">
            {LISTING_TYPES.map(t => (
              <button key={t.code} type="button" className={form.type === t.code ? 'on' : ''} onClick={() => set({ type: t.code })}>
                {t.code === 'producto' ? '📦 ' : '🧰 '}{t.label}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          Título del aviso *
          <input
            value={form.title}
            onChange={e => set({ title: e.target.value })}
            maxLength={120}
            placeholder={form.type === 'servicio' ? 'Ej: Gasfíter con 10 años de experiencia, urgencias 24/7' : 'Ej: Bicicleta MTB aro 29 casi nueva'}
            required
          />
        </label>

        <div className="field-row">
          <label className="field">
            Categoría *
            <select value={form.category} onChange={e => set({ category: e.target.value })} required>
              <option value="" disabled>Selecciona una categoría</option>
              {cats.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </label>
          <label className="field">
            Subcategoría
            <select value={form.subcategory} onChange={e => set({ subcategory: e.target.value })} disabled={!category}>
              <option value="">{category ? 'Selecciona (opcional)' : 'Elige categoría primero'}</option>
              {(category?.subcategories || []).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>

        <label className="field">
          Descripción *
          <textarea
            rows={6}
            value={form.description}
            onChange={e => set({ description: e.target.value })}
            maxLength={4000}
            placeholder={form.type === 'servicio'
              ? 'Describe tu servicio: qué haces, experiencia, cobertura, horarios, formas de pago…'
              : 'Describe el producto: estado, tiempo de uso, motivo de venta, qué incluye…'}
            required
          />
          <span className="char-count">{form.description.length}/4000</span>
        </label>

        <div className="field">
          <span className="field-label">Fotos (hasta {MAX_IMAGES}) — la primera será la portada</span>
          <div className="photo-grid">
            {photoSlots.map(p => (
              <div key={p.key} className="photo-slot">
                <img src={p.src} alt={`Foto ${p.idx + 1}`} />
                {p.idx === 0 && <span className="photo-cover">Portada</span>}
                <div className="photo-tools">
                  <button type="button" onClick={() => movePhoto(p.idx, -1)} disabled={p.idx === 0} aria-label="Mover antes">◀</button>
                  <button type="button" onClick={() => removePhoto(p.idx)} aria-label="Quitar foto">✕</button>
                  <button type="button" onClick={() => movePhoto(p.idx, 1)} disabled={p.idx === photos.length - 1} aria-label="Mover después">▶</button>
                </div>
              </div>
            ))}
            {photos.length < MAX_IMAGES && (
              <button type="button" className="photo-add" onClick={() => fileInputRef.current?.click()}>
                <span>＋</span>
                <span>Agregar foto</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={e => addFiles(e.target.files)}
          />
        </div>

        <div className="field-row">
          <label className="field">
            {form.type === 'servicio' ? 'Tipo de tarifa *' : 'Tipo de precio *'}
            <select value={form.price_type} onChange={e => set({ price_type: e.target.value })}>
              {priceTypes.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
            </select>
          </label>
          <label className="field">
            Precio {priceDisabled ? '(a convenir)' : '*'}
            <div className="price-input">
              {allowUF && (
                <select value={form.currency} onChange={e => set({ currency: e.target.value })} aria-label="Moneda">
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
              )}
              <input
                type="number"
                min="0"
                step={form.currency === 'UF' ? '0.01' : '1'}
                value={priceDisabled ? '' : form.price}
                onChange={e => set({ price: e.target.value })}
                disabled={priceDisabled}
                placeholder={priceDisabled ? '—' : form.currency === 'UF' ? 'Ej: 3500' : 'Ej: 45000'}
              />
            </div>
          </label>
        </div>

        {form.type === 'producto' && (
          <div className="field-row three">
            <div className="field">
              <span className="field-label">Condición *</span>
              <div className="seg">
                {CONDITIONS.map(c => (
                  <button key={c.code} type="button" className={form.condition === c.code ? 'on' : ''} onClick={() => set({ condition: c.code })}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="field">
              Stock (opcional)
              <input type="number" min="0" value={form.stock} onChange={e => set({ stock: e.target.value })} placeholder="Ej: 1" />
            </label>
            <label className="field">
              Entrega
              <select value={form.shipping} onChange={e => set({ shipping: e.target.value })}>
                {SHIPPING_OPTIONS.map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
              </select>
            </label>
          </div>
        )}

        <label className="field">
          Etiqueta destacada (opcional)
          <select value={form.badge} onChange={e => set({ badge: e.target.value })}>
            <option value="">Sin etiqueta</option>
            {BADGES.map(b => <option key={b.code} value={b.code}>{b.label}</option>)}
          </select>
        </label>

        <div className="field-row">
          <label className="field">
            Región *
            <select value={form.region_code} onChange={e => set({ region_code: e.target.value })} required>
              <option value="" disabled>Selecciona región</option>
              {REGIONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
          </label>
          <label className="field">
            Comuna
            <select value={form.comuna} onChange={e => set({ comuna: e.target.value })} disabled={!region}>
              <option value="">{region ? 'Selecciona comuna' : 'Elige región primero'}</option>
              {(region?.comunas || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>

        <label className="field">
          Dirección de referencia (opcional)
          <input
            value={form.address}
            onChange={e => set({ address: e.target.value })}
            maxLength={200}
            placeholder="Ej: cerca del metro Plaza Egaña"
          />
        </label>

        <div className="row form-actions">
          <button type="submit" disabled={busy}>
            {busy ? 'Publicando…' : editId != null ? 'Guardar cambios' : 'Publicar aviso'}
          </button>
          <button type="button" className="secondary" onClick={() => navigate(editId != null ? 'my-listings' : 'home', {})}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}
