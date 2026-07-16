import { useState } from 'react'
import { useApp } from '../lib/context'
import { callApi } from '../lib/api'
import { BRAND } from '../constants/catalog'

// Capturas de pantalla del proyecto. El usuario las guarda en public/landing/.
// Mientras no existan, se muestra un marcador con instrucciones.
const SHOTS = [
  {
    src: '/landing/01-home.png',
    title: 'Explorar avisos',
    desc: 'Portada con grilla de avisos y panel de filtros por tipo, categoría, región, comuna y precio.',
  },
  {
    src: '/landing/02-detalle.png',
    title: 'Ficha del aviso',
    desc: 'Galería de fotos, precio, reputación del vendedor con estrellas y contacto por mensaje o WhatsApp.',
  },
  {
    src: '/landing/03-publicar.png',
    title: 'Publicar',
    desc: 'Un solo formulario que se adapta a producto o servicio: categorías, comunas, hasta 6 fotos y tipo de precio.',
  },
  {
    src: '/landing/04-mensajes.png',
    title: 'Mensajería',
    desc: 'Bandeja de conversaciones y chat interno comprador–vendedor, sin salir de la plataforma.',
  },
]

const FEATURES = [
  ['🧩', 'Publicación adaptativa', 'Producto o servicio con un mismo flujo: categorías, subcategorías, comunas de todo Chile y hasta 6 fotos.'],
  ['🔎', 'Búsqueda con filtros', 'Por texto, tipo, categoría, región, comuna, condición y rango de precio, con orden por fecha o precio.'],
  ['⭐', 'Reputación y reseñas', 'Estrellas y comentarios por vendedor, visibles en cada aviso: confianza antes de contactar.'],
  ['💬', 'Mensajería interna', 'Chat 1:1 entre comprador y vendedor, más botones de llamada y WhatsApp cuando corresponde.'],
  ['❤️', 'Favoritos y denuncias', 'Guardar avisos para después y reportar los que infringen las reglas.'],
  ['🗂️', 'Gestión de avisos', 'Editar, renovar, pausar o marcar como vendido desde un panel propio.'],
]

const STACK = ['React 18', 'Vite', 'Supabase / PostgreSQL', 'Row Level Security', 'Función serverless (Vercel)', 'Auth con OAuth', 'Storage de imágenes']

function Shot({ shot, index }) {
  const [broken, setBroken] = useState(false)
  return (
    <figure className="shot">
      {broken ? (
        <div className="shot-ph" aria-hidden="true">
          <span className="shot-ph-cam">🖼️</span>
          <span className="shot-ph-num">Captura {index + 1}</span>
          <span className="shot-ph-hint">{shot.src}</span>
        </div>
      ) : (
        <img src={shot.src} alt={shot.title} loading="lazy" onError={() => setBroken(true)} />
      )}
      <figcaption>
        <strong>{shot.title}</strong>
        <span>{shot.desc}</span>
      </figcaption>
    </figure>
  )
}

export function AuthView() {
  const { supabase, navigate } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const siteUrl = import.meta.env.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : undefined)

  const signIn = async (e) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(traducirAuthError(error.message))
    setBusy(false)
  }

  const signUp = async () => {
    if (!supabase) return
    if (!email || !password) {
      setError('Escribe tu correo y una contraseña para crear la cuenta.')
      return
    }
    setBusy(true)
    setError('')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: siteUrl },
    })
    if (error) setError(traducirAuthError(error.message))
    else if (data.user) setNotice('Revisa tu correo para confirmar la cuenta y vuelve aquí. Si no lo ves, mira el spam.')
    setBusy(false)
  }

  const signInWithProvider = async (provider) => {
    if (!supabase) return
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: siteUrl },
    })
    if (error) setError(`No se pudo iniciar sesión con ${provider === 'google' ? 'Google' : 'Facebook'}: ${error.message}. Es posible que el proveedor aún no esté habilitado en Supabase.`)
  }

  const scrollToLogin = () => {
    document.getElementById('login-card')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="landing">
      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="eyebrow">Proyecto — marketplace chileno</span>
          <h1>{BRAND}: compra, vende y contrata en un solo lugar</h1>
          <p>
            Una plataforma donde cualquier persona publica <strong>productos</strong> o <strong>servicios</strong> y
            contacta con compradores, al estilo de Yapo y Mercado Libre, pensada para Chile (CLP/UF, regiones y comunas).
            Puedes recorrerlo sin registrarte; la cuenta solo se necesita para publicar, guardar favoritos o escribir mensajes.
          </p>
          <div className="landing-cta">
            <button type="button" onClick={() => navigate('home', {})}>Explorar el marketplace</button>
            <button type="button" className="secondary" onClick={scrollToLogin}>Ingresar o crear cuenta</button>
          </div>
        </div>
        <div className="landing-hero-badge" aria-hidden="true">◆</div>
      </section>

      {/* Funcionalidades */}
      <section className="landing-section">
        <h2>Qué hace la plataforma</h2>
        <div className="feature-grid">
          {FEATURES.map(([icon, title, desc]) => (
            <div key={title} className="feature">
              <span className="feature-icon" aria-hidden="true">{icon}</span>
              <div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Capturas */}
      <section className="landing-section">
        <h2>Un vistazo al producto</h2>
        <div className="shots-grid">
          {SHOTS.map((shot, i) => <Shot key={shot.src} shot={shot} index={i} />)}
        </div>
      </section>

      {/* Stack */}
      <section className="landing-section">
        <h2>Cómo está construido</h2>
        <p className="muted">
          SPA modular en React, backend serverless que rutea por acciones, y PostgreSQL con Row Level Security en todas
          las tablas. Autenticación por correo y con proveedores OAuth (Google / Facebook).
        </p>
        <div className="stack-chips">
          {STACK.map(t => <span key={t} className="stack-chip">{t}</span>)}
        </div>
      </section>

      {/* Login */}
      <section className="landing-section" id="login-card">
        <div className="auth-panel">
          <h2>Ingresa o crea tu cuenta</h2>
          <p className="muted">Solo necesario para publicar, guardar favoritos o escribir mensajes.</p>
          {error && <div className="error">{error}</div>}
          {notice && <div className="notice">{notice}</div>}

          <div className="oauth-buttons">
            <button type="button" className="oauth google" onClick={() => signInWithProvider('google')}>
              <span className="oauth-icon" aria-hidden="true">G</span> Continuar con Google
            </button>
            <button type="button" className="oauth facebook" onClick={() => signInWithProvider('facebook')}>
              <span className="oauth-icon" aria-hidden="true">f</span> Continuar con Facebook
            </button>
          </div>

          <div className="divider"><span>o con tu correo</span></div>

          <form onSubmit={signIn} autoComplete="on">
            <label className="field">
              Correo electrónico
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </label>
            <label className="field">
              Contraseña
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            </label>
            <div className="row">
              <button type="submit" disabled={busy}>Ingresar</button>
              <button type="button" className="secondary" onClick={signUp} disabled={busy}>Crear cuenta</button>
            </div>
          </form>

          <button type="button" className="link-btn landing-skip" onClick={() => navigate('home', {})}>
            o explora el marketplace sin registrarte →
          </button>
        </div>
      </section>
    </div>
  )
}

function traducirAuthError(msg) {
  if (!msg) return 'Error de autenticación'
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.'
  if (/email not confirmed/i.test(msg)) return 'Debes confirmar tu correo antes de ingresar.'
  if (/password should be at least/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.'
  if (/user already registered/i.test(msg)) return 'Ese correo ya tiene una cuenta. Prueba ingresar.'
  return msg
}

// Onboarding: elegir nombre de usuario único tras el primer ingreso.
export function UsernameView() {
  const { session, setUsername, setMyProfile, navigate, signOut } = useApp()
  const [desired, setDesired] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!desired.trim() || !session) return
    try {
      setBusy(true)
      setError('')
      const token = session.access_token
      const resp = await callApi({ action: 'set-username', token, username: desired.trim() })
      setUsername(resp.username)
      const me = await callApi({ action: 'me', token })
      setMyProfile(me)
      navigate('home', {})
    } catch (e2) {
      setError(e2.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-panel">
        <h1>Elige tu nombre de usuario</h1>
        <p className="muted">Así te verán compradores y vendedores. 3 a 20 caracteres, sin espacios.</p>
        {error && <div className="error">{error}</div>}
        <form onSubmit={submit} autoComplete="off">
          <label className="field">
            Nombre de usuario
            <input maxLength={20} value={desired} onChange={e => setDesired(e.target.value)} placeholder="ej: maria_reparaciones" required />
          </label>
          <div className="row">
            <button disabled={busy}>Guardar</button>
            <button type="button" className="secondary" onClick={signOut}>Salir</button>
          </div>
        </form>
      </div>
    </div>
  )
}
