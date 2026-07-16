import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { useApp } from '../lib/context'

// Edición del perfil propio, incluido teléfono de contacto y su visibilidad.
export default function ProfileEditView() {
  const { session, myProfile, setMyProfile, navigate } = useApp()
  const [form, setForm] = useState({
    age: '', gender: '', address: '', occupation: '', motivation: '',
    phone: '', show_phone: false,
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!session) {
      navigate('auth', { next: { name: 'profile-edit', params: {} } })
      return
    }
    if (myProfile) {
      setForm({
        age: myProfile.age ?? '',
        gender: myProfile.gender ?? '',
        address: myProfile.address ?? '',
        occupation: myProfile.occupation ?? '',
        motivation: myProfile.motivation ?? '',
        phone: myProfile.phone ?? '',
        show_phone: Boolean(myProfile.show_phone),
      })
    }
  }, [session, myProfile, navigate])

  const set = (patch) => setForm(f => ({ ...f, ...patch }))

  const submit = async (e) => {
    e.preventDefault()
    try {
      setBusy(true)
      setError('')
      const patch = {
        age: form.age === '' ? null : parseInt(form.age, 10),
        gender: form.gender || null,
        address: form.address || null,
        occupation: form.occupation || null,
        motivation: form.motivation || null,
        phone: form.phone || null,
        show_phone: Boolean(form.show_phone),
      }
      const updated = await callApi({ action: 'update-profile', token: session.access_token, patch })
      setMyProfile(updated)
      navigate('profile', {})
    } catch (e2) {
      setError(e2.message)
    } finally {
      setBusy(false)
    }
  }

  if (!session) return null

  return (
    <div className="page-narrow">
      <form className="publish-form" onSubmit={submit}>
        <h1>Editar mi perfil</h1>
        {error && <div className="error">{error}</div>}

        <div className="field-row">
          <label className="field">
            Teléfono de contacto
            <input value={form.phone} onChange={e => set({ phone: e.target.value })} placeholder="+56 9 1234 5678" maxLength={20} />
          </label>
          <label className="field checkbox-field">
            <span className="field-label">Visibilidad</span>
            <label className="checkbox">
              <input type="checkbox" checked={form.show_phone} onChange={e => set({ show_phone: e.target.checked })} />
              Mostrar mi teléfono en mis avisos (habilita llamadas y WhatsApp)
            </label>
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            Edad
            <input type="number" min="0" max="130" value={form.age} onChange={e => set({ age: e.target.value })} />
          </label>
          <label className="field">
            Género
            <input value={form.gender} onChange={e => set({ gender: e.target.value })} maxLength={30} />
          </label>
        </div>

        <label className="field">
          Ocupación
          <input value={form.occupation} onChange={e => set({ occupation: e.target.value })} maxLength={500} placeholder="Ej: Técnico electricista certificado SEC" />
        </label>

        <label className="field">
          Dirección
          <input value={form.address} onChange={e => set({ address: e.target.value })} maxLength={500} />
        </label>

        <label className="field">
          Sobre mí
          <textarea rows={3} value={form.motivation} onChange={e => set({ motivation: e.target.value })} maxLength={500} placeholder="Preséntate ante compradores y clientes" />
        </label>

        <div className="row form-actions">
          <button type="submit" disabled={busy}>Guardar</button>
          <button type="button" className="secondary" onClick={() => navigate('profile', {})}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}
