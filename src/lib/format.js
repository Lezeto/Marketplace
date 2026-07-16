// Formato de precios, fechas y teléfono para el mercado chileno.

export function formatPrice(price, currency = 'CLP', priceType = 'fijo') {
  if (priceType === 'convenir') return 'A convenir'
  const n = Number(price) || 0
  const base = currency === 'UF'
    ? `UF ${n.toLocaleString('es-CL', { maximumFractionDigits: 2 })}`
    : `$${Math.round(n).toLocaleString('es-CL')}`
  if (priceType === 'por_hora') return `${base} / hora`
  if (priceType === 'por_trabajo') return `${base} / trabajo`
  return base
}

export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const then = new Date(dateStr).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Recién publicado'
  if (min < 60) return `Hace ${min} min`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return days === 1 ? 'Hace 1 día' : `Hace ${days} días`
  return new Date(dateStr).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Normaliza un teléfono chileno a formato wa.me (56XXXXXXXXX). Devuelve null si no se puede.
export function whatsappNumber(phone) {
  if (!phone) return null
  const digits = String(phone).replace(/\D/g, '')
  if (digits.startsWith('56') && digits.length >= 10) return digits
  if (digits.length === 9) return `56${digits}`
  if (digits.length === 8) return `569${digits}`
  return null
}
