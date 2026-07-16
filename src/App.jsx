import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { AppContext } from './lib/context'
import { callApi } from './lib/api'
import { BRAND } from './constants/catalog'
import Header from './components/Header'
import HomeView from './views/HomeView'
import DetailView from './views/DetailView'
import PublishView from './views/PublishView'
import MyListingsView from './views/MyListingsView'
import FavoritesView from './views/FavoritesView'
import ProfileView from './views/ProfileView'
import ProfileEditView from './views/ProfileEditView'
import { MessagesView, DmView, DmStartView } from './views/MessagesView'
import ChatView from './views/ChatView'
import { AuthView, UsernameView } from './views/AuthView'

const ROUTE_STORAGE_KEY = 'app.route.v2'
// Rutas que no tiene sentido restaurar tras recargar
const TRANSIENT_ROUTES = new Set(['dm-start', 'dm', 'auth', 'username'])

function App() {
  const [booting, setBooting] = useState(true)
  const [supabase, setSupabase] = useState(null)
  const [session, setSession] = useState(null)
  const [username, setUsername] = useState('')
  const [myProfile, setMyProfile] = useState(null)
  const [route, setRoute] = useState({ name: 'home', params: {} })
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const [profileError, setProfileError] = useState('')
  const routeRef = useRef(route)
  const hydratedUserRef = useRef(null)
  useEffect(() => { routeRef.current = route }, [route])

  const navigate = useCallback((name, params = {}) => {
    setRoute({ name, params })
    try {
      if (!TRANSIENT_ROUTES.has(name)) {
        window.localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify({ name, params }))
      }
    } catch { /* almacenamiento no disponible */ }
    window.scrollTo({ top: 0 })
  }, [])

  // Redirige a login guardando la ruta actual como destino post-autenticación.
  const requireAuth = useCallback(() => {
    if (session) return true
    const cur = routeRef.current
    navigate('auth', { next: { name: cur.name, params: cur.params } })
    return false
  }, [session, navigate])

  // ---------- Arranque: cliente Supabase + sesión + ruta inicial ----------
  useEffect(() => {
    let unsub = null
    ;(async () => {
      const { createClient } = await import('@supabase/supabase-js')
      const client = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      )
      setSupabase(client)

      const { data: { session: sess } } = await client.auth.getSession()
      if (sess) {
        setSession(sess)
        await hydrateProfile(sess)
      }

      // Ruta inicial:
      //  - enlace compartido (?aviso=ID) siempre abre esa ficha
      //  - sin sesión, la portada es SIEMPRE la landing (explicación + capturas + login)
      //  - con sesión, se restaura la última ruta guardada (o home por defecto)
      try {
        const shared = new URLSearchParams(window.location.search).get('aviso')
        if (shared) {
          setRoute({ name: 'detail', params: { id: Number(shared) } })
          window.history.replaceState({}, '', window.location.pathname)
        } else if (!sess) {
          setRoute({ name: 'auth', params: {} })
        } else {
          const stored = window.localStorage.getItem(ROUTE_STORAGE_KEY)
          const parsed = stored ? JSON.parse(stored) : null
          if (parsed?.name && !TRANSIENT_ROUTES.has(parsed.name)) setRoute(parsed)
        }
      } catch { /* ruta por defecto */ }

      setBooting(false)

      const { data } = client.auth.onAuthStateChange(async (event, newSession) => {
        setSession(newSession)
        if (newSession) {
          // Evitar re-hidratar en eventos repetidos (INITIAL_SESSION, TOKEN_REFRESHED)
          const profile = hydratedUserRef.current === newSession.user.id
            ? null
            : await hydrateProfile(newSession)
          // Tras un login explícito, salir de la pantalla de auth hacia el destino
          if (event === 'SIGNED_IN' && routeRef.current.name === 'auth') {
            const next = routeRef.current.params?.next
            if (next && typeof next === 'object' && next.name) setRoute({ name: next.name, params: next.params || {} })
            else if (typeof next === 'string') setRoute({ name: next, params: {} })
            else setRoute({ name: 'home', params: {} })
          }
          void profile
        } else {
          hydratedUserRef.current = null
          setUsername('')
          setMyProfile(null)
          setFavoriteIds(new Set())
        }
      })
      unsub = data?.subscription
    })()
    return () => { unsub?.unsubscribe?.() }
  }, [])

  const hydrateProfile = async (sess) => {
    // Hasta 2 intentos: un fallo transitorio no debe dejar la sesión "a medias"
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const me = await callApi({ action: 'me', token: sess.access_token })
        hydratedUserRef.current = sess.user.id
        setMyProfile(me)
        if (me.username) setUsername(me.username)
        setProfileError('')
        return me
      } catch (e) {
        console.error(`hydrateProfile intento ${attempt}`, e)
        if (attempt === 1) await new Promise(r => setTimeout(r, 1200))
      }
    }
    setProfileError('No pudimos cargar tu perfil (¿problemas de conexión?).')
    return null
  }

  // ---------- Favoritos (ids globales para pintar corazones) ----------
  useEffect(() => {
    if (!session) return
    let cancelled = false
    ;(async () => {
      try {
        const resp = await callApi({ action: 'list-favorite-ids', token: session.access_token })
        if (!cancelled) setFavoriteIds(new Set(resp.ids || []))
      } catch { /* pre-migración: sin favoritos */ }
    })()
    return () => { cancelled = true }
  }, [session])

  const toggleFavorite = useCallback(async (listingId) => {
    if (!session) {
      navigate('auth')
      return
    }
    // Actualización optimista
    setFavoriteIds(prev => {
      const next = new Set(prev)
      if (next.has(listingId)) next.delete(listingId)
      else next.add(listingId)
      return next
    })
    try {
      const resp = await callApi({ action: 'toggle-favorite', token: session.access_token, listing_id: listingId })
      setFavoriteIds(prev => {
        const next = new Set(prev)
        if (resp.favorited) next.add(listingId)
        else next.delete(listingId)
        return next
      })
    } catch (e) {
      // Revertir si falló
      setFavoriteIds(prev => {
        const next = new Set(prev)
        if (next.has(listingId)) next.delete(listingId)
        else next.add(listingId)
        return next
      })
      console.error('toggle-favorite', e)
    }
  }, [session, navigate])

  // Permite a otras vistas (Favoritos) incorporar ids conocidos, por si la
  // carga inicial de list-favorite-ids falló.
  const mergeFavoriteIds = useCallback((ids) => {
    if (!ids || ids.length === 0) return
    setFavoriteIds(prev => {
      const next = new Set(prev)
      ids.forEach(i => next.add(i))
      return next
    })
  }, [])

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
    navigate('home', {})
  }, [supabase, navigate])

  if (booting) {
    return (
      <div className="boot-screen">
        <div className="brand-mark big">◆</div>
        <div>{BRAND}</div>
      </div>
    )
  }

  const ctx = {
    supabase, session, username, myProfile,
    setUsername, setMyProfile,
    route, navigate, requireAuth, signOut,
    favoriteIds, toggleFavorite, mergeFavoriteIds,
  }

  let view
  switch (route.name) {
    case 'auth': view = <AuthView />; break
    case 'username': view = <UsernameView />; break
    case 'detail': view = <DetailView params={route.params} />; break
    case 'publish': view = <PublishView params={route.params} />; break
    case 'my-listings': view = <MyListingsView />; break
    case 'favorites': view = <FavoritesView />; break
    case 'profile': view = <ProfileView params={route.params} />; break
    case 'profile-edit': view = <ProfileEditView />; break
    case 'messages': view = <MessagesView params={route.params} />; break
    case 'dm': view = <DmView params={route.params} />; break
    case 'dm-start': view = <DmStartView params={route.params} />; break
    case 'chat': view = <ChatView />; break
    case 'home':
    default:
      view = <HomeView params={route.params} />
  }

  // Onboarding obligatorio: con sesión pero sin nombre de usuario no se puede
  // usar el resto de la app (publicar/chatear fallaría en el backend).
  if (session && myProfile && !myProfile.username) {
    view = <UsernameView />
  }

  return (
    <AppContext.Provider value={ctx}>
      <div className="app-shell">
        <Header />
        <main className="app-main">
          {profileError && session && (
            <div className="notice">
              {profileError}{' '}
              <button type="button" className="link-btn" onClick={() => hydrateProfile(session)}>Reintentar</button>
            </div>
          )}
          {view}
        </main>
        <footer className="site-footer">
          <div className="footer-inner">
            <span><strong>{BRAND}</strong> — publicar es gratis, sin comisiones.</span>
            <nav>
              <button type="button" className="link-btn" onClick={() => navigate('chat')}>Comunidad</button>
              <button type="button" className="link-btn" onClick={() => navigate('publish', {})}>Publicar aviso</button>
              <button type="button" className="link-btn" onClick={() => navigate('home', {})}>Explorar</button>
            </nav>
            <span className="muted">Hecho en Chile · {new Date().getFullYear()}</span>
          </div>
        </footer>
      </div>
    </AppContext.Provider>
  )
}

export default App
