import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { useApp } from '../lib/context'
import { formatPrice, formatDate, timeAgo, whatsappNumber } from '../lib/format'
import Stars from '../components/Stars'
import { ListingGrid } from '../components/ListingCard'
import {
  categoryLabel, regionLabel, priceTypeLabel, shippingLabel, badgeLabel,
  conditionLabel, typeLabel, listingEmoji,
  REPORT_REASONS, statusLabel,
} from '../constants/catalog'

// Ficha del aviso: galería, atributos, vendedor con reputación, contacto,
// favoritos, compartir, denunciar y avisos similares.
export default function DetailView({ params }) {
  const { session, username, navigate, requireAuth, favoriteIds, toggleFavorite } = useApp()
  const [listing, setListing] = useState(null)
  const [seller, setSeller] = useState(null)
  const [favCount, setFavCount] = useState(0)
  const [similar, setSimilar] = useState([])
  const [imgIdx, setImgIdx] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0])
  const [reportDetail, setReportDetail] = useState('')
  const [reportError, setReportError] = useState('')
  const [busy, setBusy] = useState(false)

  const id = params?.id

  useEffect(() => {
    let cancelled = false
    setListing(null)
    setSeller(null)
    setSimilar([])
    setImgIdx(0)
    setError('')
    setNotice('')
    if (id == null) return
    ;(async () => {
      try {
        const resp = await callApi({ action: 'get-listing', id, count_view: true })
        if (cancelled) return
        setListing(resp.listing)
        setSeller(resp.seller || null)
        setFavCount(resp.favorites_count || 0)
        // Avisos similares: misma categoría, excluyendo el actual
        if (resp.listing?.category) {
          try {
            const sim = await callApi({
              action: 'list-all-listings',
              type: resp.listing.type,
              category: resp.listing.category,
              limit: 5,
            })
            if (!cancelled) setSimilar((sim.listings || []).filter(l => l.id !== resp.listing.id).slice(0, 4))
          } catch { /* opcional */ }
        }
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  if (error) {
    return (
      <div className="page-narrow">
        <div className="error">{error}</div>
        <button type="button" className="secondary" onClick={() => navigate('home', {})}>Volver al inicio</button>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="page-narrow">
        <div className="detail-skeleton">
          <div className="shimmer detail-sk-img" />
          <div className="sk-line w60 shimmer" />
          <div className="sk-line w40 shimmer" />
          <div className="sk-line w80 shimmer" />
        </div>
      </div>
    )
  }

  const l = listing
  const isOwner = session && l.username === username
  const images = l.images && l.images.length > 0 ? l.images : (l.image_url ? [l.image_url] : [])
  const isFav = favoriteIds.has(l.id)
  const wa = seller?.phone ? whatsappNumber(seller.phone) : null
  const shareUrl = `${window.location.origin}/?aviso=${l.id}`

  const onShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: l.title, url: shareUrl })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        setNotice('Enlace copiado al portapapeles')
        setTimeout(() => setNotice(''), 2500)
      }
    } catch { /* usuario canceló */ }
  }

  const onReport = async (e) => {
    e.preventDefault()
    if (!requireAuth()) return
    try {
      setBusy(true)
      await callApi({
        action: 'report-listing',
        token: session.access_token,
        listing_id: l.id,
        reason: reportReason,
        detail: reportDetail.trim() || null,
      })
      setReportOpen(false)
      setReportDetail('')
      setReportError('')
      setNotice('Denuncia enviada. Gracias por ayudar a mantener la comunidad segura.')
      setTimeout(() => setNotice(''), 4000)
    } catch (e2) {
      // Error propio del modal: no debe reemplazar la ficha completa
      setReportError(e2.message)
    } finally {
      setBusy(false)
    }
  }

  const contactSeller = () => {
    if (!requireAuth()) return
    navigate('dm-start', { username: l.username, listingId: l.id })
  }

  const attrs = [
    ['Categoría', l.category ? `${categoryLabel(l.type, l.category)}${l.subcategory ? ` · ${l.subcategory}` : ''}` : 'Sin categoría'],
    ['Tipo', typeLabel(l.type)],
    l.condition ? ['Condición', conditionLabel(l.condition)] : null,
    l.type === 'producto' && l.stock != null ? ['Stock disponible', l.stock] : null,
    l.type === 'producto' && l.shipping ? ['Entrega', shippingLabel(l.shipping)] : null,
    l.type === 'servicio' ? ['Tarifa', priceTypeLabel(l.price_type) || 'A convenir'] : null,
    ['Ubicación', [l.comuna, regionLabel(l.region_code)].filter(Boolean).join(', ')],
    l.address ? ['Dirección de referencia', l.address] : null,
    ['Publicado', formatDate(l.created_at)],
  ].filter(Boolean)

  return (
    <div className="detail">
      <nav className="breadcrumb">
        <button type="button" className="link-btn" onClick={() => navigate('home', {})}>Inicio</button>
        <span>›</span>
        <button type="button" className="link-btn" onClick={() => navigate('home', { type: l.type, category: l.category || '' })}>
          {categoryLabel(l.type, l.category) || (l.type === 'servicio' ? 'Servicios' : 'Productos')}
        </button>
        <span>›</span>
        <span className="crumb-current">{l.title}</span>
      </nav>

      {notice && <div className="notice">{notice}</div>}
      {l.status && l.status !== 'active' && (
        <div className="status-banner">Este aviso está {statusLabel(l.status).toLowerCase()}.</div>
      )}

      <div className="detail-layout">
        <div className="detail-main">
          <div className="gallery">
            {images.length > 0 ? (
              <>
                <img className="gallery-main" src={images[imgIdx]} alt={l.title} />
                {images.length > 1 && (
                  <div className="gallery-thumbs">
                    {images.map((u, i) => (
                      <button key={u + i} type="button" className={i === imgIdx ? 'on' : ''} onClick={() => setImgIdx(i)}>
                        <img src={u} alt={`Foto ${i + 1}`} loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="gallery-placeholder" aria-hidden="true">{listingEmoji(l.type)}</div>
            )}
          </div>

          <div className="detail-head">
            <div>
              <h1>{l.title}</h1>
              <div className="detail-meta">
                <span>{timeAgo(l.refreshed_at || l.created_at)}</span>
                <span>· {l.views ?? 0} visita{(l.views ?? 0) === 1 ? '' : 's'}</span>
                <span>· {favCount} favorito{favCount === 1 ? '' : 's'}</span>
                {l.badge && <span className="card-badge inline">{badgeLabel(l.badge)}</span>}
              </div>
            </div>
            <div className="detail-price">{formatPrice(l.price, l.currency, l.price_type)}</div>
          </div>

          <div className="detail-actions">
            {session && !isOwner && (
              <button type="button" className={`secondary ${isFav ? 'fav-on' : ''}`} onClick={() => toggleFavorite(l.id)}>
                {isFav ? '♥ En favoritos' : '♡ Agregar a favoritos'}
              </button>
            )}
            <button type="button" className="secondary" onClick={onShare}>Compartir</button>
            {!isOwner && (
              <button type="button" className="secondary danger-link" onClick={() => setReportOpen(true)}>Denunciar</button>
            )}
          </div>

          <section className="detail-section">
            <h2>Detalles</h2>
            <dl className="attr-table">
              {attrs.map(([k, v]) => (
                <div key={k} className="attr-row">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="detail-section">
            <h2>Descripción</h2>
            <p className="detail-desc">{l.description}</p>
          </section>
        </div>

        <aside className="detail-side">
          <div className="seller-card">
            <h3>{l.type === 'servicio' ? 'Prestador' : 'Vendedor'}</h3>
            <button type="button" className="seller-name link-btn" onClick={() => navigate('profile', { username: l.username })}>
              {l.username}
            </button>
            {seller && (
              <div className="seller-meta">
                <div className="seller-rating">
                  <Stars value={seller.rating_avg || 0} />
                  <span>{seller.rating_avg != null ? `${seller.rating_avg} (${seller.rating_count})` : 'Sin reseñas aún'}</span>
                </div>
                {seller.member_since && <div className="seller-since">En la plataforma desde {formatDate(seller.member_since)}</div>}
              </div>
            )}
            {!isOwner ? (
              <div className="seller-actions">
                <button type="button" onClick={contactSeller}>Enviar mensaje</button>
                {seller?.phone && (
                  <a className="btn-like secondary" href={`tel:${seller.phone}`}>Llamar {seller.phone}</a>
                )}
                {wa && (
                  <a
                    className="btn-like secondary"
                    href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola, vi tu aviso "${l.title}" y me interesa.`)}`}
                    target="_blank" rel="noreferrer"
                  >WhatsApp</a>
                )}
              </div>
            ) : (
              <div className="seller-actions">
                <button type="button" onClick={() => navigate('publish', { id: l.id })}>Editar aviso</button>
                <button type="button" className="secondary" onClick={() => navigate('messages', { listingId: l.id })}>Ver mensajes del aviso</button>
                <button type="button" className="secondary" onClick={() => navigate('my-listings')}>Administrar mis avisos</button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="detail-section">
          <h2>Avisos similares</h2>
          <ListingGrid listings={similar} loading={false} />
        </section>
      )}

      {reportOpen && (
        <div className="modal-backdrop" onClick={() => setReportOpen(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={onReport}>
            <h3>Denunciar este aviso</h3>
            {reportError && <div className="error">{reportError}</div>}
            <label className="field">
              Motivo
              <select value={reportReason} onChange={e => setReportReason(e.target.value)}>
                {REPORT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="field">
              Detalle (opcional)
              <textarea rows={3} maxLength={1000} value={reportDetail} onChange={e => setReportDetail(e.target.value)} />
            </label>
            <div className="row">
              <button type="submit" disabled={busy}>Enviar denuncia</button>
              <button type="button" className="secondary" onClick={() => setReportOpen(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
