import { useCallback, useEffect, useRef, useState } from 'react'
import { callApi } from '../lib/api'
import { ListingGrid, SkeletonCard } from '../components/ListingCard'
import {
  LISTING_TYPES, REGIONS, CONDITIONS, SORT_OPTIONS,
  categoriesForType, findCategory, findRegion,
  PRODUCT_CATEGORIES, SERVICE_CATEGORIES,
} from '../constants/catalog'

const LIMIT = 24

const EMPTY_FILTERS = {
  q: '', type: '', category: '', subcategory: '',
  region_code: '', comuna: '', condition: '',
  min_price: '', max_price: '', sort: 'recent',
}

// Portada + listado con filtros (equivalente al listado con panel lateral de yapo.cl).
export default function HomeView({ params }) {
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [listings, setListings] = useState([])
  const [total, setTotal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [priceDraft, setPriceDraft] = useState({ min: '', max: '' })
  const [filtersOpen, setFiltersOpen] = useState(false)
  const fetchSeq = useRef(0)

  // Navegación entrante (marca/Explorar, buscador del header, chips de categoría):
  // cada llegada a Home define un estado de búsqueda NUEVO — se limpian los
  // filtros anteriores para no combinar búsquedas viejas con la navegación nueva.
  useEffect(() => {
    const next = {
      ...EMPTY_FILTERS,
      q: params?.q ?? '',
      type: params?.type ?? '',
      category: params?.category ?? '',
    }
    setFilters(f => {
      const same = Object.keys(next).every(k => next[k] === f[k])
      return same ? f : next
    })
    setPriceDraft(p => (p.min === '' && p.max === '') ? p : { min: '', max: '' })
  }, [params])

  const fetchListings = useCallback(async (f, offset, append) => {
    const seq = ++fetchSeq.current
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const payload = { action: 'list-all-listings', limit: LIMIT, offset, sort: f.sort }
      if (f.q) payload.q = f.q
      if (f.type) payload.type = f.type
      if (f.category) payload.category = f.category
      if (f.subcategory) payload.subcategory = f.subcategory
      if (f.region_code) payload.region_code = f.region_code
      if (f.comuna) payload.comuna = f.comuna
      if (f.condition) payload.condition = f.condition
      if (f.min_price) payload.min_price = Number(f.min_price)
      if (f.max_price) payload.max_price = Number(f.max_price)
      const resp = await callApi(payload)
      if (seq !== fetchSeq.current) return // llegó una respuesta vieja
      // El COUNT solo viene en la primera página; al paginar se conserva
      if (!append || resp.total != null) setTotal(resp.total)
      setListings(prev => append ? [...prev, ...(resp.listings || [])] : (resp.listings || []))
    } catch (e) {
      console.error('list-all-listings', e)
      if (!append) setListings([])
    } finally {
      if (seq === fetchSeq.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchListings(filters, 0, false)
  }, [filters, fetchListings])

  const set = (patch) => setFilters(f => {
    const next = { ...f, ...patch }
    // Cambiar de tipo invalida categoría/subcategoría/condición
    if ('type' in patch && patch.type !== f.type) {
      next.category = ''
      next.subcategory = ''
      if (patch.type === 'servicio') next.condition = ''
    }
    if ('category' in patch && patch.category !== f.category) next.subcategory = ''
    if ('region_code' in patch && patch.region_code !== f.region_code) next.comuna = ''
    return next
  })

  const applyPrices = (e) => {
    e.preventDefault()
    set({ min_price: priceDraft.min, max_price: priceDraft.max })
  }

  const clearAll = () => {
    setPriceDraft({ min: '', max: '' })
    setFilters({ ...EMPTY_FILTERS })
  }

  const region = findRegion(filters.region_code)
  const category = filters.type ? findCategory(filters.type, filters.category) : null
  const cats = filters.type ? categoriesForType(filters.type) : []

  // Chips de filtros activos (removibles)
  const chips = []
  if (filters.q) chips.push({ k: 'q', label: `"${filters.q}"` })
  if (filters.type) chips.push({ k: 'type', label: filters.type === 'servicio' ? 'Servicios' : 'Productos' })
  if (category) chips.push({ k: 'category', label: category.label })
  if (filters.subcategory) chips.push({ k: 'subcategory', label: filters.subcategory })
  if (region) chips.push({ k: 'region_code', label: region.label })
  if (filters.comuna) chips.push({ k: 'comuna', label: filters.comuna })
  if (filters.condition) chips.push({ k: 'condition', label: filters.condition === 'nuevo' ? 'Nuevo' : 'Usado' })
  if (filters.min_price || filters.max_price) chips.push({ k: 'price', label: `Precio ${filters.min_price || 0} – ${filters.max_price || '∞'}` })

  const removeChip = (k) => {
    if (k === 'price') {
      setPriceDraft({ min: '', max: '' })
      set({ min_price: '', max_price: '' })
    } else if (k === 'type') {
      set({ type: '' })
    } else {
      set({ [k]: '' })
    }
  }

  const showBrowse = !filters.q && !filters.category && !filters.type
  const canLoadMore = total != null && listings.length < total

  return (
    <div className="home">
      {showBrowse && (
        <section className="hero">
          <h1>Compra, vende y contrata cerca de ti</h1>
          <p className="hero-sub">Productos y servicios publicados por personas de todo Chile. Publicar es gratis.</p>
          <div className="browse-groups">
            <div className="browse-group">
              <h2>Productos</h2>
              <div className="cat-grid">
                {PRODUCT_CATEGORIES.map(c => (
                  <button key={c.code} type="button" className="cat-card" onClick={() => set({ type: 'producto', category: c.code })}>
                    <span className="cat-icon" aria-hidden="true">{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="browse-group">
              <h2>Servicios</h2>
              <div className="cat-grid">
                {SERVICE_CATEGORIES.map(c => (
                  <button key={c.code} type="button" className="cat-card" onClick={() => set({ type: 'servicio', category: c.code })}>
                    <span className="cat-icon" aria-hidden="true">{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="listing-layout">
        <aside className={`filters ${filtersOpen ? 'open' : ''}`}>
          <div className="filters-head">
            <h2>Filtros</h2>
            {chips.length > 0 && <button type="button" className="link-btn" onClick={clearAll}>Limpiar todo</button>}
          </div>

          <div className="filter-block">
            <span className="filter-label">Tipo de aviso</span>
            <div className="seg">
              <button type="button" className={!filters.type ? 'on' : ''} onClick={() => set({ type: '' })}>Todos</button>
              {LISTING_TYPES.map(t => (
                <button key={t.code} type="button" className={filters.type === t.code ? 'on' : ''} onClick={() => set({ type: t.code })}>
                  {t.label}s
                </button>
              ))}
            </div>
          </div>

          {filters.type && (
            <div className="filter-block">
              <label className="filter-label" htmlFor="f-cat">Categoría</label>
              <select id="f-cat" value={filters.category} onChange={e => set({ category: e.target.value })}>
                <option value="">Todas las categorías</option>
                {cats.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
          )}

          {category && (
            <div className="filter-block">
              <label className="filter-label" htmlFor="f-sub">Subcategoría</label>
              <select id="f-sub" value={filters.subcategory} onChange={e => set({ subcategory: e.target.value })}>
                <option value="">Todas</option>
                {category.subcategories.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          <div className="filter-block">
            <label className="filter-label" htmlFor="f-region">Región</label>
            <select id="f-region" value={filters.region_code} onChange={e => set({ region_code: e.target.value })}>
              <option value="">Todo Chile</option>
              {REGIONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
          </div>

          {region && (
            <div className="filter-block">
              <label className="filter-label" htmlFor="f-comuna">Comuna</label>
              <select id="f-comuna" value={filters.comuna} onChange={e => set({ comuna: e.target.value })}>
                <option value="">Todas las comunas</option>
                {region.comunas.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {filters.type !== 'servicio' && (
            <div className="filter-block">
              <span className="filter-label">Condición</span>
              <div className="seg">
                <button type="button" className={!filters.condition ? 'on' : ''} onClick={() => set({ condition: '' })}>Todas</button>
                {CONDITIONS.map(c => (
                  <button key={c.code} type="button" className={filters.condition === c.code ? 'on' : ''} onClick={() => set({ condition: c.code })}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form className="filter-block" onSubmit={applyPrices}>
            <span className="filter-label">Precio (CLP)</span>
            <div className="price-row">
              <input type="number" min="0" placeholder="Desde" value={priceDraft.min} onChange={e => setPriceDraft(p => ({ ...p, min: e.target.value }))} />
              <input type="number" min="0" placeholder="Hasta" value={priceDraft.max} onChange={e => setPriceDraft(p => ({ ...p, max: e.target.value }))} />
              <button type="submit" className="secondary">Ir</button>
            </div>
          </form>
        </aside>

        <section className="results">
          <div className="results-bar">
            <button type="button" className="secondary filters-toggle" onClick={() => setFiltersOpen(o => !o)}>
              {filtersOpen ? 'Ocultar filtros' : 'Filtros'}
            </button>
            <span className="results-count">
              {loading ? 'Buscando…' : total != null ? `${total.toLocaleString('es-CL')} aviso${total === 1 ? '' : 's'}` : ''}
            </span>
            <label className="sort-label">
              Ordenar
              <select value={filters.sort} onChange={e => set({ sort: e.target.value })}>
                {SORT_OPTIONS.map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
              </select>
            </label>
          </div>

          {chips.length > 0 && (
            <div className="chips-row">
              {chips.map(c => (
                <button key={c.k} type="button" className="chip removable" onClick={() => removeChip(c.k)}>
                  {c.label} ✕
                </button>
              ))}
            </div>
          )}

          <ListingGrid listings={listings} loading={loading} />

          {loadingMore && (
            <div className="grid" style={{ marginTop: '1rem' }}>
              {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {canLoadMore && !loading && !loadingMore && (
            <div className="load-more">
              <button type="button" className="secondary" onClick={() => fetchListings(filters, listings.length, true)}>
                Cargar más avisos
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
