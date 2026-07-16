import { useCallback, useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { useApp } from '../lib/context'
import { formatPrice, timeAgo } from '../lib/format'
import { statusLabel, listingEmoji } from '../constants/catalog'

// Gestión de avisos propios: editar, renovar, pausar, marcar vendido, eliminar.
export default function MyListingsView() {
  const { session, navigate } = useApp()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const load = useCallback(async () => {
    if (!session) return
    try {
      setLoading(true)
      const resp = await callApi({ action: 'list-my-listings', token: session.access_token })
      setListings(resp.listings || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    if (!session) {
      navigate('auth', { next: { name: 'my-listings', params: {} } })
      return
    }
    load()
  }, [session, load, navigate])

  const doAction = async (id, fn, okMsg) => {
    try {
      setBusyId(id)
      setError('')
      await fn()
      if (okMsg) {
        setNotice(okMsg)
        setTimeout(() => setNotice(''), 3000)
      }
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const renew = (id) => doAction(id, () =>
    callApi({ action: 'renew-listing', token: session.access_token, id }), 'Aviso renovado: vuelve a aparecer arriba en el listado.')

  const setStatus = (id, status) => doAction(id, () =>
    callApi({ action: 'set-listing-status', token: session.access_token, id, status }))

  const remove = (id) => doAction(id, async () => {
    await callApi({ action: 'delete-listing', token: session.access_token, id })
    setConfirmDeleteId(null)
  }, 'Aviso eliminado.')

  if (!session) return null

  return (
    <div className="page-narrow">
      <h1>Mis avisos</h1>
      {error && <div className="error">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      {loading ? (
        <div className="my-list">
          {Array.from({ length: 3 }, (_, i) => <div key={i} className="my-row shimmer" style={{ height: 84 }} />)}
        </div>
      ) : listings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>Aún no tienes avisos publicados.</p>
          <button type="button" onClick={() => navigate('publish', {})}>Publicar mi primer aviso</button>
        </div>
      ) : (
        <div className="my-list">
          {listings.map(l => (
            <div key={l.id} className={`my-row status-${l.status}`}>
              <button type="button" className="my-thumb" onClick={() => navigate('detail', { id: l.id })} aria-label="Ver aviso">
                {l.image_url ? <img src={l.image_url} alt="" /> : <span aria-hidden="true">{listingEmoji(l.type)}</span>}
              </button>
              <div className="my-info">
                <button type="button" className="my-title link-btn" onClick={() => navigate('detail', { id: l.id })}>{l.title}</button>
                <div className="my-meta">
                  <strong>{formatPrice(l.price, l.currency, l.price_type)}</strong>
                  <span className={`status-chip s-${l.status}`}>{statusLabel(l.status)}</span>
                  <span>{l.views ?? 0} visitas</span>
                  <span>{timeAgo(l.refreshed_at || l.created_at)}</span>
                </div>
              </div>
              <div className="my-actions">
                <button type="button" className="secondary" disabled={busyId === l.id} onClick={() => navigate('publish', { id: l.id })}>Editar</button>
                {l.status === 'active' && (
                  <>
                    <button type="button" className="secondary" disabled={busyId === l.id} onClick={() => renew(l.id)} title="Vuelve a subir tu aviso al inicio del listado (1 vez cada 24 h)">Renovar</button>
                    <button type="button" className="secondary" disabled={busyId === l.id} onClick={() => setStatus(l.id, 'paused')}>Pausar</button>
                    <button type="button" className="secondary" disabled={busyId === l.id} onClick={() => setStatus(l.id, 'sold')}>Marcar vendido</button>
                  </>
                )}
                {l.status !== 'active' && (
                  <button type="button" className="secondary" disabled={busyId === l.id} onClick={() => setStatus(l.id, 'active')}>Reactivar</button>
                )}
                <button type="button" className="secondary" disabled={busyId === l.id} onClick={() => navigate('messages', { listingId: l.id })}>Mensajes</button>
                {confirmDeleteId === l.id ? (
                  <span className="confirm-delete">
                    ¿Eliminar definitivamente?
                    <button type="button" className="danger" disabled={busyId === l.id} onClick={() => remove(l.id)}>Sí, eliminar</button>
                    <button type="button" className="secondary" onClick={() => setConfirmDeleteId(null)}>No</button>
                  </span>
                ) : (
                  <button type="button" className="secondary danger-link" disabled={busyId === l.id} onClick={() => setConfirmDeleteId(l.id)}>Eliminar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
