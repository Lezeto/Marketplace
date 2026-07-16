// Cliente mínimo del serverless /api/gamexapi (rutea por `action` en el body).
export async function callApi(payload) {
  const res = await fetch('/api/gamexapi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    let message = text || 'Error de la API'
    try {
      const parsed = JSON.parse(text)
      if (parsed && parsed.error) message = parsed.error
    } catch { /* texto plano */ }
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  return res.json()
}
