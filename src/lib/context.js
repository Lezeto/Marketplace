import { createContext, useContext } from 'react'

// Contexto global de la app: sesión, perfil propio, navegación y favoritos.
// Lo provee App.jsx; las vistas lo consumen con useApp().
export const AppContext = createContext(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppContext.Provider>')
  return ctx
}
