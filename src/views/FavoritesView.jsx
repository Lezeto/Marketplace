import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { useApp } from '../lib/context'
import { ListingGrid } from '../components/ListingCard'

// Avisos guardados como favoritos.
export default function FavoritesView() {
  const { session, navigate, favoriteIds, mergeFavoriteIds } = useApp()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) {
      navigate('auth', { next: { name: 'favorites', params: {} } })
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const resp = await callApi({ action: 'list-favorites', token: session.access_token })
        if (!cancelled) {
          setListings(resp.listings || [])
          // Garantiza corazones marcados aunque list-favorite-ids haya fallado
          mergeFavoriteIds((resp.listings || []).map(l => l.id))
        }
      } catch (e) {
        console.error('favorites', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [session, navigate, mergeFavoriteIds])

  if (!session) return null

  // Si el usuario quitó un favorito desde la tarjeta, se refleja sin recargar
  const visible = listings.filter(l => favoriteIds.has(l.id))

  return (
    <div className="page-wide">
      <h1>Mis favoritos</h1>
      <ListingGrid
        listings={visible}
        loading={loading}
        emptyText="Aún no guardas avisos. Toca el corazón de un aviso para tenerlo a mano aquí."
      />
    </div>
  )
}
