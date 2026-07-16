# Pasos finales para activar la versión 2 del Marketplace

El código (frontend + API serverless) ya está listo y compila. Para que todas las
funcionalidades nuevas queden operativas faltan solo estos pasos manuales.

## 1. Ejecutar la migración SQL en Supabase (obligatorio)

1. Abrir el proyecto en [supabase.com](https://supabase.com) → **SQL Editor**.
2. Abrir el archivo [src/sql-v2.sql](src/sql-v2.sql), copiar TODO su contenido y ejecutarlo.
3. La migración es **idempotente**: si algo falla a la mitad, se puede volver a ejecutar completa sin riesgo.

Qué crea/modifica:

| Objeto | Descripción |
|---|---|
| `listings2` (columnas nuevas) | `type`, `category`, `subcategory`, `condition`, `stock`, `shipping`, `price_type`, `comuna`, `images` (galería jsonb), `status`, `views`, `refreshed_at`, `currency`, `badge` |
| `favorites2` | Favoritos por usuario (con RLS) |
| `reviews2` | Reseñas 1–5 estrellas sobre vendedores (con RLS) |
| `reports2` | Denuncias de avisos (solo escritura para usuarios; lectura solo vía service key) |
| `increment_listing_views2()` | Función contadora de visitas |
| Bucket `listings2` en Storage | Bucket público + políticas para subir/leer/borrar fotos |

> Los avisos antiguos (v1) se migran automáticamente: su `image_url` pasa a la galería
> `images` y quedan como `producto` activo.

## 2. Desplegar en Vercel

Si el proyecto está conectado a Vercel, basta con hacer commit y push (o `vercel deploy`).
Las variables de entorno ya configuradas siguen siendo las mismas:

- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (opcional `VITE_SITE_URL`)
- Serverless: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

Ver [.env.example](.env.example).

## 3. Login social con Facebook y Google (opcional, recomendado)

Los botones "Continuar con Google/Facebook" ya están en la pantalla de ingreso.
Para que funcionen hay que habilitar los proveedores en Supabase:

### Facebook

1. Crear una app en [developers.facebook.com](https://developers.facebook.com) (tipo *Consumer*).
2. Agregar el producto **Facebook Login** y en *Valid OAuth Redirect URIs* poner:
   `https://<TU-PROYECTO>.supabase.co/auth/v1/callback`
3. Copiar **App ID** y **App Secret**.
4. En Supabase: **Authentication → Providers → Facebook** → habilitar y pegar las credenciales.

### Google

1. En [console.cloud.google.com](https://console.cloud.google.com) → *APIs & Services → Credentials* → crear **OAuth Client ID** (tipo Web).
2. En *Authorized redirect URIs* poner: `https://<TU-PROYECTO>.supabase.co/auth/v1/callback`
3. En Supabase: **Authentication → Providers → Google** → habilitar y pegar Client ID y Secret.

En ambos casos, verificar además en **Authentication → URL Configuration** que el
*Site URL* apunte al dominio de producción (y agregar `http://localhost:5173` a
*Redirect URLs* para desarrollo local).

> Mientras los proveedores no estén habilitados, los botones muestran un error claro
> y el login con correo/contraseña sigue funcionando igual.

## 4. Prueba de humo sugerida (5 minutos)

1. Crear una cuenta nueva → elegir nombre de usuario.
2. Publicar un aviso de **producto** con 2–3 fotos, categoría y comuna.
3. Publicar un aviso de **servicio** con tarifa "por hora".
4. Buscar por palabra, filtrar por región/comuna/precio y ordenar por precio.
5. Con otra cuenta: guardar en favoritos, contactar por chat, dejar una reseña al vendedor.
6. Como dueño: editar el aviso, renovarlo, pausarlo y marcarlo vendido desde "Mis avisos".
7. En el perfil propio, agregar teléfono y marcar "mostrar teléfono" → verificar que
   aparecen los botones Llamar/WhatsApp en el aviso.
