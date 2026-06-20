# Marketplace

## Definición del proyecto

Marketplace estilo **Mercado Libre**, pero ampliado: no solo para **productos** físicos, también para **servicios** (al estilo **yapo.cl**).

La plataforma debe permitir que cualquier usuario publique:

- **Productos**: artículos nuevos o usados, con stock, fotos, precio fijo o negociable, envío o retiro.
- **Servicios**: ofertas de trabajo profesional o informal (clases, oficios, freelance, reparaciones, eventos, etc.), con tarifas por hora / por trabajo / a convenir y cobertura geográfica.

## Idea base

- Un solo flujo de publicación que se adapta al tipo de aviso (producto vs. servicio).
- Búsqueda y filtros unificados, con categorías diferenciadas y atributos propios de cada tipo.
- Contacto entre comprador y vendedor / cliente y prestador dentro de la plataforma (chat).
- Reputación y reseñas tanto para vendedores como para prestadores de servicios.
- Foco inicial en el mercado **chileno** (CLP, regiones/comunas de Chile, integraciones locales como WebPay a futuro).

## Estado actual

Código base clonado desde **[Lezeto/Marketplace](https://github.com/Lezeto/Marketplace)** (`origin/main`). Las credenciales de Supabase y la API serverless están configuradas y funcionando.

### Stack

- **Frontend**: React 18 + Vite, SPA en un solo archivo [src/App.jsx](src/App.jsx) (~37 KB) con manejo de "vistas" por estado (`view`) en vez de router. Persiste la vista actual en `localStorage`.
- **Backend**: una sola función serverless tipo Vercel en [api/gamexapi.js](api/gamexapi.js) que rutea por `action` en el body POST. Usa `@supabase/supabase-js` con `SUPABASE_SERVICE_KEY` para saltarse RLS de forma controlada.
- **BD + Auth**: Supabase. Schema completo en [src/sql.sql](src/sql.sql), todas las tablas con RLS habilitado.
- **Build/Deploy**: Vite + despliegue en Vercel (la convención `/api/*.js` lo confirma).

> Nota: el `package.json` aún se llama `"gamex"` y la función `gamexapi.js` mantiene ese nombre — herencia de un proyecto anterior reciclado. No afecta funcionalidad.

### Variables de entorno necesarias

- Frontend (Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Serverless: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

### Tablas en Supabase (sufijo `2`)

| Tabla | Para qué sirve |
|---|---|
| `profiles2` | Perfil extendido por usuario: `username`, `age`, `gender`, `address`, `occupation`, `motivation` |
| `listings2` | Avisos publicados: `title`, `address`, `price`, `description`, `image_url`, `region_code` |
| `chat_messages2` | Chat global (lectura pública) |
| `threads2` | Conversación DM entre 2 usuarios, opcionalmente atada a un `listing_id` |
| `thread_messages2` | Mensajes dentro de un thread DM |

RLS: listings y chat lectura pública; threads/DMs solo participantes; perfiles solo dueño (lectura cruzada se hace vía service key en el serverless).

### Vistas del frontend

`loading | auth | username | profile | profile-edit | chat | publish | my-listings | all-listings | listing-detail`

### Flujos ya funcionando

- **Auth**: registro/login email+password (Supabase Auth) + onboarding de `username`.
- **Perfil**: editar campos extendidos; ver perfil de otro usuario por username.
- **Publicar aviso**: título, dirección, precio, descripción, imagen y `region_code`.
- **Explorar avisos**: listado global con filtros por región y búsqueda por texto.
- **Detalle de aviso**: ver publicación + botón para abrir DM con el dueño.
- **Chat global**: polling por `lastMessageId` (no realtime de Supabase).
- **DMs**: thread 1:1, opcionalmente vinculado a un `listing_id` → así se contacta al vendedor desde la publicación. Polling por `lastId`.

### Acciones soportadas por el serverless

`me · set-username · get-profile · update-profile · list-messages · send-message · create-listing · list-my-listings · list-user-listings · list-all-listings · get-listing · start-dm · get-dm-thread · list-dm-messages · send-dm-message · list-dm-threads`

### Brechas vs. la visión (ML + yapo.cl)

Lo que **falta** para llegar al producto descrito arriba:

- Distinción **producto vs. servicio** en el listing (campo `type` + atributos propios).
- Categorías y subcategorías.
- Atributos de producto: stock, condición (nuevo/usado), envío/retiro.
- Atributos de servicio: tarifa (hora/trabajo/a convenir), cobertura geográfica, disponibilidad.
- **Reputación y reseñas** (tabla nueva).
- **Pagos** (WebPay u otra pasarela CL).
- Subida real de imágenes a Supabase Storage (el campo `image_url` existe, falta verificar el flujo de upload).
- Realtime de Supabase para chat/DMs en vez de polling.
- Router de verdad (react-router) si la SPA crece.
