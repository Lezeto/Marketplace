import { useCallback, useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { useApp } from '../lib/context'
import { formatDate, timeAgo } from '../lib/format'
import Stars from '../components/Stars'
import { ListingGrid } from '../components/ListingCard'

// Perfil público de un vendedor/prestador (o el propio): reputación,
// reseñas y avisos publicados.
export default function ProfileView({ params }) {
  const { session, username, navigate, requireAuth } = useApp()
  const viewedUsername = params?.username || username
  const isOwn = Boolean(session) && viewedUsername === username

  const [profile, setProfile] = useState(null)
  const [listings, setListings] = useState([])
  const [reviews, setReviews] = useState([])
  const [summary, setSummary] = useState({ rating_avg: null, rating_count: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Formulario de reseña
  const [myRating, setMyRating] = useState(0)
  const [myComment, setMyComment] = useState('')
  const [reviewBusy, setReviewBusy] = useState(false)
  const [reviewNotice, setReviewNotice] = useState('')

  const loadReviews = useCallback(async (uname) => {
    try {
      const r = await callApi({ action: 'list-reviews', seller_username: uname })
      setReviews(r.reviews || [])
      setSummary({ rating_avg: r.rating_avg ?? null, rating_count: r.rating_count ?? 0 })
      return r
    } catch (e) {
      // Pre-migración: la tabla puede no existir todavía
      console.error('list-reviews', e)
      return null
    }
  }, [])

  useEffect(() => {
    if (!viewedUsername) {
      // Con sesión activa el username puede estar aún hidratándose: esperar,
      // no rebotar a login a un usuario ya autenticado.
      if (!session) navigate('auth', { next: { name: 'profile', params: {} } })
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const prof = await callApi({ action: 'get-profile', username: viewedUsername })
        if (cancelled) return
        setProfile(prof)
        setSummary({ rating_avg: prof.rating_avg ?? null, rating_count: prof.rating_count ?? 0 })
        const [lres, rres] = await Promise.all([
          callApi({ action: 'list-user-listings', username: viewedUsername }),
          loadReviews(viewedUsername),
        ])
        if (cancelled) return
        setListings(lres.listings || [])
        if (rres && session) {
          const mine = (rres.reviews || []).find(r => r.reviewer_username === username)
          if (mine) {
            setMyRating(mine.rating)
            setMyComment(mine.comment || '')
          }
        }
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [viewedUsername, session, username, navigate, loadReviews])

  const submitReview = async (e) => {
    e.preventDefault()
    if (!requireAuth()) return
    if (!myRating) return
    try {
      setReviewBusy(true)
      await callApi({
        action: 'create-review',
        token: session.access_token,
        seller_username: viewedUsername,
        rating: myRating,
        comment: myComment.trim() || null,
      })
      setReviewNotice('¡Gracias! Tu reseña quedó publicada.')
      setTimeout(() => setReviewNotice(''), 3000)
      await loadReviews(viewedUsername)
    } catch (e2) {
      setError(e2.message)
    } finally {
      setReviewBusy(false)
    }
  }

  if (loading || (!viewedUsername && session)) {
    return <div className="page-narrow"><div className="sk-line w60 shimmer" /><div className="sk-line w40 shimmer" /><div className="sk-line w80 shimmer" /></div>
  }
  if (error && !profile) {
    return <div className="page-narrow"><div className="error">{error}</div></div>
  }
  if (!profile) return null

  return (
    <div className="page-wide profile-page">
      <div className="profile-header">
        <div className="avatar" aria-hidden="true">{(profile.username || '?').slice(0, 1).toUpperCase()}</div>
        <div className="profile-id">
          <h1>{profile.username}</h1>
          <div className="seller-rating">
            <Stars value={summary.rating_avg || 0} />
            <span>
              {summary.rating_avg != null
                ? `${summary.rating_avg} · ${summary.rating_count} reseña${summary.rating_count === 1 ? '' : 's'}`
                : 'Sin reseñas aún'}
            </span>
          </div>
          {profile.created_at && <div className="muted">Miembro desde {formatDate(profile.created_at)}</div>}
          {profile.occupation && <div className="muted">{profile.occupation}</div>}
        </div>
        <div className="profile-actions">
          {isOwn ? (
            <button type="button" className="secondary" onClick={() => navigate('profile-edit')}>Editar mi perfil</button>
          ) : session ? (
            <button type="button" onClick={() => navigate('dm-start', { username: profile.username })}>Enviar mensaje</button>
          ) : (
            <button type="button" onClick={() => navigate('auth')}>Ingresar para contactar</button>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <section className="detail-section">
        <h2>Avisos de {profile.username}</h2>
        <ListingGrid listings={listings} loading={false} emptyText="Este usuario no tiene avisos activos." />
      </section>

      <section className="detail-section reviews-section">
        <h2>Reseñas</h2>
        {!isOwn && session && (
          <form className="review-form" onSubmit={submitReview}>
            <span className="field-label">¿Compraste o contrataste a {profile.username}? Deja tu evaluación:</span>
            <Stars value={myRating} onSelect={setMyRating} size="lg" />
            <textarea
              rows={3}
              maxLength={1000}
              value={myComment}
              onChange={e => setMyComment(e.target.value)}
              placeholder="Cuenta cómo fue tu experiencia (opcional)"
            />
            <div className="row">
              <button type="submit" disabled={reviewBusy || !myRating}>Publicar reseña</button>
              {reviewNotice && <span className="notice inline">{reviewNotice}</span>}
            </div>
          </form>
        )}
        {reviews.length === 0 ? (
          <p className="muted">Todavía no hay reseñas para este usuario.</p>
        ) : (
          <ul className="review-list">
            {reviews.map(r => (
              <li key={r.id} className="review-item">
                <div className="review-head">
                  <button type="button" className="link-btn" onClick={() => navigate('profile', { username: r.reviewer_username })}>
                    {r.reviewer_username}
                  </button>
                  <Stars value={r.rating} size="sm" />
                  <span className="muted">{timeAgo(r.updated_at || r.created_at)}</span>
                </div>
                {r.comment && <p>{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
