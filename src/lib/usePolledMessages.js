import { useCallback, useEffect, useRef, useState } from 'react'
import { callApi } from './api'

// Mensajería con polling incremental compartida por el chat global y los DMs.
// - El cursor `after_id` solo avanza con ids CONFIRMADOS por el servidor: si el
//   usuario envía un mensaje mientras hay un poll en vuelo, no se salta ningún
//   mensaje del interlocutor con id menor.
// - La mezcla deduplica por id y ordena, así el envío optimista y el poll
//   pueden cruzarse sin burbujas duplicadas.
export function usePolledMessages({ basePayload, enabled = true, resetKey = null, intervalMs = 4000 }) {
  const [messages, setMessages] = useState([])
  const lastIdRef = useRef(null)
  const bottomRef = useRef(null)
  const payloadRef = useRef(basePayload)
  payloadRef.current = basePayload

  const mergeMessages = useCallback((incoming) => {
    setMessages(prev => {
      const seen = new Set(prev.map(m => m.id))
      const fresh = (incoming || []).filter(m => m && !seen.has(m.id))
      if (fresh.length === 0) return prev
      return [...prev, ...fresh].sort((a, b) => a.id - b.id)
    })
  }, [])

  const load = useCallback(async (initial = false) => {
    try {
      const payload = { ...payloadRef.current }
      if (!initial && lastIdRef.current) payload.after_id = lastIdRef.current
      const resp = await callApi(payload)
      if (Array.isArray(resp.messages) && resp.messages.length > 0) {
        const maxId = resp.messages[resp.messages.length - 1].id
        lastIdRef.current = Math.max(lastIdRef.current || 0, maxId)
        mergeMessages(resp.messages)
      }
    } catch (e) {
      console.error('poll messages', e)
    }
  }, [mergeMessages])

  // Mensaje propio recién enviado: se muestra al instante, pero SIN mover el
  // cursor (el próximo poll lo re-trae y la deduplicación lo absorbe).
  const appendLocal = useCallback((message) => {
    if (message) mergeMessages([message])
  }, [mergeMessages])

  useEffect(() => {
    if (!enabled) return
    lastIdRef.current = null
    setMessages([])
    load(true)
    const timer = setInterval(() => load(false), intervalMs)
    return () => clearInterval(timer)
  }, [enabled, resetKey, load, intervalMs])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return { messages, appendLocal, bottomRef }
}
