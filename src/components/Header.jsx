import { useEffect, useState } from 'react'
import { useApp } from '../lib/context'
import { BRAND } from '../constants/catalog'

// Cabecera fija: marca, buscador prominente y accesos principales (estilo yapo.cl).
export default function Header() {
  const { session, username, navigate, route, signOut } = useApp()
  const [q, setQ] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  // Mantener el buscador sincronizado con la búsqueda activa del listado
  useEffect(() => {
    if (route.name === 'home') setQ(route.params?.q || '')
  }, [route])

  const submitSearch = (e) => {
    e.preventDefault()
    navigate('home', { q: q.trim() })
    setMenuOpen(false)
  }

  const go = (name, params) => {
    navigate(name, params)
    setMenuOpen(false)
  }

  const isActive = (name) => (route.name === name ? 'active' : '')

  return (
    <header className="site-header">
      <div className="header-inner">
        <button type="button" className="brand" onClick={() => go('home', {})}>
          <span className="brand-mark">◆</span> {BRAND}
        </button>

        <form className="header-search" onSubmit={submitSearch} role="search">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="¿Qué estás buscando? Ej: bicicleta, gasfíter, notebook…"
            maxLength={120}
            aria-label="Buscar avisos"
          />
          <button type="submit">Buscar</button>
        </form>

        <nav className={`header-nav ${menuOpen ? 'open' : ''}`}>
          <button type="button" className={`nav-link ${isActive('home')}`} onClick={() => go('home', {})}>Explorar</button>
          <button type="button" className={`nav-link ${isActive('favorites')}`} onClick={() => go('favorites')}>Favoritos</button>
          <button type="button" className={`nav-link ${isActive('messages')}`} onClick={() => go('messages')}>Mensajes</button>
          <button type="button" className={`nav-link ${isActive('my-listings')}`} onClick={() => go('my-listings')}>Mis avisos</button>
          {session ? (
            <>
              <button type="button" className={`nav-link ${isActive('profile') && !route.params?.username ? 'active' : ''}`} onClick={() => go('profile', {})}>
                {username || 'Mi cuenta'}
              </button>
              <button type="button" className="nav-link" onClick={() => { signOut(); setMenuOpen(false) }}>Salir</button>
            </>
          ) : (
            <button type="button" className={`nav-link ${isActive('auth')}`} onClick={() => go('auth')}>Ingresar</button>
          )}
          <button type="button" className="btn-publish" onClick={() => go('publish', {})}>+ Publicar aviso</button>
        </nav>

        <button
          type="button"
          className="menu-toggle"
          aria-label="Abrir menú"
          onClick={() => setMenuOpen(o => !o)}
        >☰</button>
      </div>
    </header>
  )
}
