import { useState } from 'react'
import { callApi } from '../lib/api'
import { useApp } from '../lib/context'
import { usePolledMessages } from '../lib/usePolledMessages'

// Chat público de la comunidad (lectura abierta, escribir requiere sesión).
export default function ChatView() {
  const { session, username, navigate, requireAuth } = useApp()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const { messages, appendLocal, bottomRef } = usePolledMessages({
    basePayload: { action: 'list-messages' },
    resetKey: 'global',
  })

  const send = async (e) => {
    e.preventDefault()
    if (!input.trim()) return
    if (!requireAuth()) return
    try {
      setBusy(true)
      const resp = await callApi({ action: 'send-message', token: session.access_token, content: input.trim() })
      appendLocal(resp.message)
      setInput('')
    } catch (e2) {
      console.error(e2)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-narrow chat-page">
      <h1>Comunidad</h1>
      <p className="muted">Conversación abierta entre usuarios de la plataforma.</p>
      <div className="messages">
        {messages.map(m => (
          <div key={m.id} className={`bubble ${m.username === username ? 'me' : 'them'}`}>
            <button type="button" className="bubble-author link-btn" onClick={() => navigate('profile', { username: m.username })}>
              {m.username}
            </button>
            <span className="bubble-content">{m.content}</span>
            <span className="bubble-time">{new Date(m.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
        {messages.length === 0 && <div className="empty">Aún no hay mensajes.</div>}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input" onSubmit={send}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          maxLength={500}
          placeholder={session ? 'Escribe un mensaje' : 'Ingresa para participar'}
        />
        <button disabled={busy || !input.trim()}>Enviar</button>
      </form>
    </div>
  )
}
