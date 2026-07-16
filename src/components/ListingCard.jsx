import { useApp } from '../lib/context'
import { formatPrice, timeAgo } from '../lib/format'
import { badgeLabel, conditionLabel, listingEmoji } from '../constants/catalog'

// Tarjeta de aviso para la grilla de alta densidad.
export function ListingCard({ listing }) {
  const { navigate, session, favoriteIds, toggleFavorite } = useApp()
  const l = listing
  const isFav = favoriteIds.has(l.id)

  const onFav = (e) => {
    e.stopPropagation()
    toggleFavorite(l.id)
  }

  return (
    <article className="card" onClick={() => navigate('detail', { id: l.id })}>
      <div className="card-media">
        {l.image_url
          ? <img src={l.image_url} alt={l.title} loading="lazy" />
          : <div className="card-placeholder" aria-hidden="true">{listingEmoji(l.type)}</div>}
        {l.badge && <span className="card-badge">{badgeLabel(l.badge)}</span>}
        {l.type === 'servicio' && <span className="card-type">Servicio</span>}
        {session && (
          <button
            type="button"
            className={`card-fav ${isFav ? 'on' : ''}`}
            aria-label={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            onClick={onFav}
          >{isFav ? '♥' : '♡'}</button>
        )}
      </div>
      <div className="card-body">
        <div className="card-price">{formatPrice(l.price, l.currency, l.price_type)}</div>
        <h3 className="card-title">{l.title}</h3>
        <div className="card-meta">
          <span>{[l.comuna, l.region_code].filter(Boolean).join(', ') || '—'}</span>
          <span>{timeAgo(l.refreshed_at || l.created_at)}</span>
        </div>
        {l.condition && <span className="card-cond">{conditionLabel(l.condition)}</span>}
      </div>
    </article>
  )
}

export function SkeletonCard() {
  return (
    <div className="card skeleton" aria-hidden="true">
      <div className="card-media shimmer" />
      <div className="card-body">
        <div className="sk-line w40 shimmer" />
        <div className="sk-line w80 shimmer" />
        <div className="sk-line w60 shimmer" />
      </div>
    </div>
  )
}

export function ListingGrid({ listings, loading, skeletonCount = 8, emptyText = 'No encontramos avisos con esos filtros.' }) {
  if (loading && (!listings || listings.length === 0)) {
    return (
      <div className="grid">
        {Array.from({ length: skeletonCount }, (_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }
  if (!listings || listings.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔍</div>
        <p>{emptyText}</p>
      </div>
    )
  }
  return (
    <div className="grid">
      {listings.map(l => <ListingCard key={l.id} listing={l} />)}
    </div>
  )
}
