import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { useApp } from '../lib/context'
import { timeAgo } from '../lib/format'
import { usePolledMessages } from '../lib/usePolledMessages'

// Bandeja de conversaciones (DM) y chat 1:1.

export function MessagesView({ params }) {
  const { session, navigate } = useApp()
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const listingId = params?.listingId ?? null

  useEffect(() => {
    if (!session) {
      navigate('auth', { next: { name: 'messages', params: {} } })
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const payload = { action: 'list-dm-threads', token: session.access_token }
        if (listingId != null) payload.listing_id = listingId
        const resp = await callApi(payload)
        if (!cancelled) setThreads(resp.threads || [])
      } catch (e) {
        console.error('threads', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [session, listingId, navigate])

  if (!session) return null

  return (
    <div className="page-narrow">
      <h1>Mensajes</h1>
      {listingId != null && (
        <div className="notice">
          Mostrando solo conversaciones del aviso #{listingId}.{' '}
          <button type="button" className="link-btn" onClick={() => navigate('messages', {})}>Ver todas</button>
        </div>
      )}
      {loading ? (
        <div className="my-list">
          {Array.from({ length: 3 }, (_, i) => <div key={i} className="my-row shimmer" style={{ height: 64 }} />)}
        </div>
      ) : threads.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <p>No tienes conversaciones todavía. Contacta a un vendedor desde su aviso.</p>
          <button type="button" onClick={() => navigate('home', {})}>Explorar avisos</button>
        </div>
      ) : (
        <div className="my-list">
          {threads.map(t => (
            <button key={t.id} type="button" className="thread-row" onClick={() => navigate('dm', { thread: t })}>
              <div className="avatar sm" aria-hidden="true">{(t.other_username || '?').slice(0, 1).toUpperCase()}</div>
              <div className="thread-info">
                <span className="thread-name">{t.other_username}</span>
                {t.listing_title && <span className="thread-listing">Sobre: {t.listing_title}</span>}
              </div>
              <span className="muted">{timeAgo(t.created_at)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function DmView({ params }) {
  const { session, navigate } = useApp()
  const thread = params?.thread ?? null
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const { messages, appendLocal, bottomRef } = usePolledMessages({
    basePayload: { action: 'list-dm-messages', token: session?.access_token, thread_id: thread?.id },
    enabled: Boolean(session && thread?.id),
    resetKey: thread?.id,
  })

  useEffect(() => {
    if (!session) {
      navigate('auth', { next: { name: 'messages', params: {} } })
      return
    }
    if (!thread) navigate('messages', {})
  }, [session, thread, navigate])

  const send = async (e) => {
    e.preventDefault()
    if (!input.trim() || !thread) return
    try {
      setBusy(true)
      const resp = await callApi({ action: 'send-dm-message', token: session.access_token, thread_id: thread.id, content: input.trim() })
      appendLocal(resp.message)
      setInput('')
    } catch (e2) {
      console.error(e2)
    } finally {
      setBusy(false)
    }
  }

  if (!session || !thread) return null

  return (
    <div className="page-narrow chat-page">
      <div className="chat-head">
        <button type="button" className="link-btn" onClick={() => navigate('messages', {})}>← Mensajes</button>
        <h1>
          <button type="button" className="link-btn strong" onClick={() => navigate('profile', { username: thread.other_username })}>
            {thread.other_username}
          </button>
        </h1>
        {thread.listing_id != null && (
          <button type="button" className="link-btn" onClick={() => navigate('detail', { id: thread.listing_id })}>Ver aviso</button>
        )}
      </div>
      <div className="messages">
        {messages.map(m => (
          <div key={m.id} className={`bubble ${m.sender_username === thread.other_username ? 'them' : 'me'}`}>
            <span className="bubble-content">{m.content}</span>
            <span className="bubble-time">{new Date(m.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
        {messages.length === 0 && <div className="empty">Escribe el primer mensaje. Coordina siempre dentro de la plataforma por seguridad.</div>}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input" onSubmit={send}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          maxLength={1000}
          placeholder={`Mensaje para ${thread.other_username}`}
        />
        <button disabled={busy || !input.trim()}>Enviar</button>
      </form>
    </div>
  )
}

// Vista puente: crea (o recupera) el hilo y redirige al chat.
export function DmStartView({ params }) {
  const { session, navigate } = useApp()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) {
      navigate('auth', { next: { name: 'dm-start', params } })
      return
    }
    if (!params?.username) {
      navigate('home', {})
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const resp = await callApi({
          action: 'start-dm',
          token: session.access_token,
          target_username: params.username,
          listing_id: params.listingId ?? null,
        })
        if (!cancelled && resp.thread) navigate('dm', { thread: resp.thread })
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    })()
    return () => { cancelled = true }
  }, [session, params, navigate])

  return (
    <div className="page-narrow">
      {error
        ? <><div className="error">{error}</div><button type="button" className="secondary" onClick={() => navigate('home', {})}>Volver</button></>
        : <div className="muted">Abriendo conversación…</div>}
    </div>
  )
}
