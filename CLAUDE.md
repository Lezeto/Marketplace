# Marketplace

## Definición del proyecto

Marketplace estilo **Mercado Libre**, pero ampliado: no solo para **productos** físicos, también para **servicios** (al estilo **yapo.cl**), con foco en el mercado **chileno** (CLP/UF, regiones y comunas).

La plataforma permite que cualquier usuario publique:

- **Productos**: artículos nuevos o usados, con stock, fotos, precio fijo o conversable, envío o retiro.
- **Servicios**: oficios, clases, freelance, eventos, etc., con tarifa por hora / por trabajo / a convenir.

## Estado actual (v2 — julio 2026)

La app rivaliza en funcionalidades con yapo.cl. Marca provisional: **LaFeria** (se cambia en `BRAND` de [src/constants/catalog.js](src/constants/catalog.js)).

> ⚠️ **Pendiente**: ejecutar [src/sql-v2.sql](src/sql-v2.sql) en Supabase y (opcional) habilitar OAuth de Google/Facebook. Instrucciones en [PASOS_FINALES.md](PASOS_FINALES.md). Hasta que no corra la migración, las funcionalidades v2 fallan de forma controlada.

### Stack

- **Frontend**: React 18 + Vite, SPA **modularizada** (ya no es un solo archivo):
  - [src/App.jsx](src/App.jsx): orquestador — sesión, "router" por estado (`route {name, params}` persistido en localStorage), favoritos globales, contexto.
  - [src/views/](src/views/): una vista por archivo (Home, Detail, Publish, MyListings, Favorites, Profile, ProfileEdit, Messages/Dm, Chat, Auth/Username).
  - [src/components/](src/components/): Header (buscador prominente), ListingCard/Grid/Skeleton, Stars.
  - [src/lib/](src/lib/): `api.js` (cliente del serverless), `format.js` (CLP/UF, fechas relativas, WhatsApp), `context.js` (useApp), `usePolledMessages.js` (polling de mensajería con deduplicación, compartido por chat global y DMs).
  - [src/constants/catalog.js](src/constants/catalog.js): **única fuente de verdad del catálogo** — categorías/subcategorías de productos y servicios, 16 regiones con todas sus comunas, tipos de precio, condiciones, etiquetas, monedas. La API la **importa** (`api/gamexapi.js` importa `../src/constants/catalog.js` y deriva los códigos válidos), así que agregar una categoría/región se hace en un solo archivo.
- **Backend**: función serverless Vercel [api/gamexapi.js](api/gamexapi.js), rutea por `action` en body POST. Usa `SUPABASE_SERVICE_KEY` (salta RLS de forma controlada).
- **BD + Auth**: Supabase. Esquema v1 en [src/sql.sql](src/sql.sql) (ya aplicado) + migración v2 en [src/sql-v2.sql](src/sql-v2.sql) (pendiente). Storage: bucket público `listings2` para fotos (hasta 6 por aviso).
- **Auth**: email+password y botones OAuth Google/Facebook (requieren habilitar proveedores en Supabase).

### Variables de entorno ([.env.example](.env.example))

- Frontend (Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, opcional `VITE_SITE_URL`
- Serverless: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

### Tablas en Supabase (sufijo `2`)

| Tabla | Para qué sirve |
|---|---|
| `profiles2` | Perfil por usuario: `username`, datos extendidos, `phone` + `show_phone` (v2) |
| `listings2` | Avisos. v2 agrega: `type` (producto/servicio), `category`, `subcategory`, `condition`, `stock`, `shipping`, `price_type`, `currency` (CLP/UF), `comuna`, `images` jsonb, `status` (active/paused/sold), `views`, `refreshed_at` (renovación), `badge` (etiqueta) |
| `favorites2` (v2) | Favoritos por usuario |
| `reviews2` (v2) | Reseñas 1–5 con comentario; única por (reviewer, seller); editable |
| `reports2` (v2) | Denuncias de avisos (lectura solo vía service key) |
| `chat_messages2` | Chat global "Comunidad" |
| `threads2` / `thread_messages2` | DMs 1:1, opcionalmente atados a un aviso |

### Funcionalidades (paridad yapo.cl)

- **Navegación pública sin login** (explorar y ver avisos); login solo para publicar/contactar/favoritos.
- **Publicación adaptativa** producto vs. servicio: hasta 6 fotos con portada y reordenamiento, categoría/subcategoría, región+comuna, precio CLP (UF en inmuebles), tipo de tarifa para servicios, condición/stock/entrega para productos, etiqueta destacada (Nuevo/Poco uso/Oportunidad/Urgente).
- **Búsqueda y filtros**: texto (título+descripción), tipo, categoría, subcategoría, región, comuna, condición, rango de precio, orden (recientes/precio), paginación "cargar más" con total.
- **Ficha del aviso**: galería con miniaturas, migas de pan, contador de visitas y favoritos, tabla de atributos, tarjeta del vendedor con reputación y antigüedad, botones Mensaje/Llamar/WhatsApp (si el vendedor muestra teléfono), compartir (enlace `/?aviso=ID`), denunciar, avisos similares.
- **Gestión de avisos**: editar, renovar (sube el aviso, 1 vez cada 24 h), pausar/reactivar, marcar vendido, eliminar.
- **Reputación**: reseñas con estrellas en el perfil del vendedor; promedio visible en la ficha.
- **Mensajería**: bandeja de conversaciones con título del aviso, chat con burbujas (polling 4 s). Chat global "Comunidad" en el footer.

### Acciones del serverless

`me · set-username · get-profile · update-profile · list-messages · send-message · create-listing · update-listing · delete-listing · set-listing-status · renew-listing · list-my-listings · list-user-listings · list-all-listings (filtros+count) · get-listing (visitas+vendedor) · toggle-favorite · list-favorites · list-favorite-ids · create-review · list-reviews · report-listing · start-dm · get-dm-thread · list-dm-messages · send-dm-message · list-dm-threads`

### Notas de mantención

- El endpoint sigue llamándose `gamexapi.js` (el frontend llama a `/api/gamexapi`) — renombrarlo requiere cambiar [src/lib/api.js](src/lib/api.js).
- Compatibilidad v1: avisos antiguos sin `type/category` se tratan como `producto` y su `image_url` se expone como única foto; la migración los normaliza.
- La API degrada sin romper cuando las tablas v2 no existen (reseñas/favoritos devuelven vacío o error controlado).

### Brechas restantes vs. la visión

- Pagos integrados (WebPay/escrow) — diferenciador clave según [marketing/competencia.md](marketing/competencia.md).
- Realtime de Supabase para chat/DMs (hoy: polling).
- Alertas de búsqueda guardada y notificaciones.
- Verificación de identidad del prestador (RUT + cédula).
- Moderación de denuncias (hoy solo se almacenan en `reports2`).
- GPS/hiperlocalidad y app móvil.
