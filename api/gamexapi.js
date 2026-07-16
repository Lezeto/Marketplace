// Función serverless (Vercel) del marketplace. Rutea por `action` en el body POST.
// Usa el service key de Supabase para saltarse RLS de forma controlada.
//
// Acciones:
//  Perfil:    me · set-username · get-profile · update-profile
//  Chat:      list-messages · send-message
//  Avisos:    create-listing · update-listing · delete-listing · set-listing-status
//             renew-listing · list-my-listings · list-user-listings
//             list-all-listings · get-listing
//  Favoritos: toggle-favorite · list-favorites · list-favorite-ids
//  Reseñas:   create-review · list-reviews
//  Denuncias: report-listing
//  DMs:       start-dm · get-dm-thread · list-dm-messages · send-dm-message · list-dm-threads
//
// Env vars requeridas: SUPABASE_URL, SUPABASE_SERVICE_KEY

import { createClient } from '@supabase/supabase-js'
import {
	PRODUCT_CATEGORIES, SERVICE_CATEGORIES, REGIONS,
	CONDITIONS as CONDITION_OPTIONS, SHIPPING_OPTIONS,
	PRICE_TYPES_PRODUCT, PRICE_TYPES_SERVICE,
	CURRENCIES as CURRENCY_OPTIONS, BADGES as BADGE_OPTIONS,
	LISTING_STATUSES, MAX_IMAGES,
} from '../src/constants/catalog.js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !serviceKey) {
	console.warn('Missing Supabase env vars: SUPABASE_URL / SUPABASE_SERVICE_KEY')
}

const adminClient = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json')
    res.status(405).end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }
  let raw = ''
  try {
    for await (const chunk of req) {
      raw += chunk
    }
  } catch (e) {
    console.error('Body read error', e)
    res.status(400).json({ error: 'Body read error' })
    return
  }
  let body
  try {
    body = raw ? JSON.parse(raw) : {}
  } catch (e) {
    res.status(400).json({ error: 'Invalid JSON' })
    return
  }
  const { action } = body || {}
  try {
		switch (action) {
			case 'me':
				return await me(body, res)
			case 'set-username':
				return await setUsername(body, res)
			case 'get-profile':
				return await getProfile(body, res)
			case 'update-profile':
				return await updateProfile(body, res)
			case 'list-messages':
				return await listMessages(body, res)
			case 'send-message':
				return await sendMessage(body, res)
			case 'create-listing':
				return await createListing(body, res)
			case 'update-listing':
				return await updateListing(body, res)
			case 'delete-listing':
				return await deleteListing(body, res)
			case 'set-listing-status':
				return await setListingStatus(body, res)
			case 'renew-listing':
				return await renewListing(body, res)
			case 'list-my-listings':
				return await listMyListings(body, res)
			case 'list-user-listings':
				return await listUserListings(body, res)
			case 'list-all-listings':
				return await listAllListings(body, res)
			case 'get-listing':
				return await getListing(body, res)
			case 'toggle-favorite':
				return await toggleFavorite(body, res)
			case 'list-favorites':
				return await listFavorites(body, res)
			case 'list-favorite-ids':
				return await listFavoriteIds(body, res)
			case 'create-review':
				return await createReview(body, res)
			case 'list-reviews':
				return await listReviews(body, res)
			case 'report-listing':
				return await reportListing(body, res)
			case 'start-dm':
				return await startDm(body, res)
			case 'get-dm-thread':
				return await getDmThread(body, res)
			case 'list-dm-messages':
				return await listDmMessages(body, res)
			case 'send-dm-message':
				return await sendDmMessage(body, res)
			case 'list-dm-threads':
				return await listDmThreads(body, res)
			default:
				res.status(400).json({ error: 'Unknown action' })
		}
  } catch (e) {
    console.error('Handler error', e)
    const status = e.status || 500
    res.status(status).json({ error: e.message || 'Server error' })
  }
}

async function getUserFromToken(token) {
	const { data, error } = await adminClient.auth.getUser(token)
	if (error) throw new Error('Auth failed')
	return data.user
}

async function ensureProfile(userId) {
	const { data, error } = await adminClient.from('profiles2').select('*').eq('id', userId).single()
	if (error && error.code !== 'PGRST116') { // PGRST116 = not found single
		throw error
	}
	if (!data) {
		const { error: insErr } = await adminClient.from('profiles2').insert({ id: userId })
		if (insErr) throw insErr
		return { id: userId }
	}
	return data
}

async function me(body, res) {
	const { token } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	const user = await getUserFromToken(token)
	const profile = await ensureProfile(user.id)
	res.json(filterProfile(profile))
}

async function setUsername(body, res) {
	const { token, username } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: 'Nombre de usuario inválido (3-20 caracteres alfanuméricos o _)' })
	const user = await getUserFromToken(token)
	const { data: existing, error: existingErr } = await adminClient.from('profiles2').select('id').eq('username', username).maybeSingle()
	if (existingErr) throw existingErr
	if (existing && existing.id !== user.id) return res.status(409).json({ error: 'Ese nombre de usuario ya está tomado' })
	const { error: upErr, data } = await adminClient.from('profiles2').update({ username }).eq('id', user.id).select().single()
	if (upErr) throw upErr
	res.json({ username: data.username })
}

// ---------- Perfiles ----------
const PROFILE_FIELDS = ['age', 'gender', 'address', 'occupation', 'motivation', 'phone', 'show_phone']

function filterProfile(p) {
	return {
		id: p.id,
		username: p.username,
		age: p.age ?? null,
		gender: p.gender ?? null,
		address: p.address ?? null,
		occupation: p.occupation ?? null,
		motivation: p.motivation ?? null,
		phone: p.phone ?? null,
		show_phone: p.show_phone ?? false,
		created_at: p.created_at ?? null,
	}
}

async function reviewSummaryForSeller(sellerId) {
	const { data, error } = await adminClient.from('reviews2').select('rating').eq('seller_id', sellerId)
	if (error) {
		// Tabla aún no migrada: degradar sin romper
		if (error.code === '42P01') return { rating_avg: null, rating_count: 0 }
		throw error
	}
	const count = (data || []).length
	if (count === 0) return { rating_avg: null, rating_count: 0 }
	const avg = data.reduce((s, r) => s + r.rating, 0) / count
	return { rating_avg: Math.round(avg * 10) / 10, rating_count: count }
}

async function getProfile(body, res) {
	const { username, token } = body
	if (!username && !token) return res.status(400).json({ error: 'Provide username or token' })
	let row = null
	if (username) {
		const { data, error } = await adminClient.from('profiles2').select('*').eq('username', username).maybeSingle()
		if (error) throw error
		if (!data) return res.status(404).json({ error: 'Usuario no encontrado' })
		row = data
	} else {
		const user = await getUserFromToken(token)
		row = await ensureProfile(user.id)
	}
	const summary = await reviewSummaryForSeller(row.id)
	if (username) {
		// Vista pública: sin PII (edad, género, dirección); el teléfono solo si
		// el dueño lo marcó visible.
		return res.json({
			id: row.id,
			username: row.username,
			occupation: row.occupation ?? null,
			motivation: row.motivation ?? null,
			phone: row.show_phone ? (row.phone ?? null) : null,
			show_phone: row.show_phone ?? false,
			created_at: row.created_at ?? null,
			...summary,
		})
	}
	res.json({ ...filterProfile(row), ...summary })
}

async function updateProfile(body, res) {
	const { token, patch } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	if (!patch || typeof patch !== 'object') return res.status(400).json({ error: 'Missing patch' })
	const user = await getUserFromToken(token)
	const allowed = {}
	for (const f of PROFILE_FIELDS) if (f in patch) allowed[f] = patch[f]
	if (Object.keys(allowed).length === 0) return res.status(400).json({ error: 'No valid fields' })
	if ('age' in allowed && allowed.age !== null) {
		const ageNum = Number(allowed.age)
		if (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 130) return res.status(400).json({ error: 'Edad inválida' })
		allowed.age = ageNum
	}
	if ('gender' in allowed && allowed.gender && String(allowed.gender).length > 30) return res.status(400).json({ error: 'Género demasiado largo' })
	if ('phone' in allowed && allowed.phone && !/^[+0-9 ()-]{6,20}$/.test(String(allowed.phone))) return res.status(400).json({ error: 'Teléfono inválido' })
	if ('show_phone' in allowed) allowed.show_phone = Boolean(allowed.show_phone)
	for (const longField of ['address', 'occupation', 'motivation']) {
		if (longField in allowed && allowed[longField] && String(allowed[longField]).length > 500) {
			return res.status(400).json({ error: longField + ' demasiado largo' })
		}
	}
	const { data, error } = await adminClient.from('profiles2').update(allowed).eq('id', user.id).select().single()
	if (error) throw error
	res.json(filterProfile(data))
}

// ---------- Chat global ----------
async function listMessages(body, res) {
	const { limit = 50, after_id } = body
	const query = adminClient.from('chat_messages2').select('id, username, content, created_at').order('id', { ascending: true }).limit(Math.min(limit, 100))
	if (after_id) query.gt('id', after_id)
	const { data, error } = await query
	if (error) throw error
	res.json({ messages: data })
}

async function sendMessage(body, res) {
	const { token, content } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	if (!content || typeof content !== 'string' || content.trim().length === 0) return res.status(400).json({ error: 'Mensaje vacío' })
	const text = content.trim().slice(0, 500)
	const user = await getUserFromToken(token)
	const profile = await ensureProfile(user.id)
	if (!profile.username) return res.status(400).json({ error: 'Primero elige un nombre de usuario' })
	const { data, error } = await adminClient.from('chat_messages2').insert({ user_id: user.id, username: profile.username, content: text }).select().single()
	if (error) throw error
	res.json({ message: data })
}

// ---------- Avisos ----------
// Códigos válidos derivados del catálogo compartido con el frontend
// (src/constants/catalog.js): una sola fuente de verdad.
const REGION_CODES = REGIONS.map(r => r.code)
const LISTING_TYPES = ['producto', 'servicio']
const CONDITIONS = CONDITION_OPTIONS.map(c => c.code)
const SHIPPING = SHIPPING_OPTIONS.map(s => s.code)
const PRICE_TYPES = {
	producto: PRICE_TYPES_PRODUCT.map(p => p.code),
	servicio: PRICE_TYPES_SERVICE.map(p => p.code),
}
const STATUSES = LISTING_STATUSES.map(s => s.code)
const CURRENCIES = CURRENCY_OPTIONS.map(c => c.code)
const BADGES = BADGE_OPTIONS.map(b => b.code)
const PRODUCT_CATEGORY_CODES = PRODUCT_CATEGORIES.map(c => c.code)
const SERVICE_CATEGORY_CODES = SERVICE_CATEGORIES.map(c => c.code)

function filterListingPublic(row) {
	const images = Array.isArray(row.images) ? row.images : []
	return {
		id: row.id,
		username: row.username,
		title: row.title,
		image_url: images[0] ?? row.image_url ?? null,
		price: row.price,
		price_type: row.price_type ?? 'fijo',
		currency: row.currency ?? 'CLP',
		badge: row.badge ?? null,
		type: row.type ?? 'producto',
		category: row.category ?? null,
		subcategory: row.subcategory ?? null,
		condition: row.condition ?? null,
		region_code: row.region_code ?? null,
		comuna: row.comuna ?? null,
		status: row.status ?? 'active',
		views: row.views ?? 0,
		created_at: row.created_at,
		refreshed_at: row.refreshed_at ?? row.created_at,
	}
}

function filterListingFull(row) {
	const images = Array.isArray(row.images) ? row.images : []
	return {
		...filterListingPublic(row),
		user_id: row.user_id,
		address: row.address,
		description: row.description,
		images: images.length > 0 ? images : (row.image_url ? [row.image_url] : []),
		stock: row.stock ?? null,
		shipping: row.shipping ?? null,
	}
}

function validateImages(images) {
	if (images == null) return []
	if (!Array.isArray(images)) throw badRequest('images debe ser una lista')
	if (images.length > MAX_IMAGES) throw badRequest(`Máximo ${MAX_IMAGES} fotos por aviso`)
	return images.map(u => {
		const url = String(u)
		if (url.length > 1000 || !/^https?:\/\//i.test(url)) throw badRequest('URL de imagen inválida')
		return url
	})
}

function badRequest(message) {
	const err = new Error(message)
	err.status = 400
	return err
}

// Valida y normaliza los campos comunes de crear/editar aviso.
function validateListingFields(body, { partial = false } = {}) {
	const out = {}
	const has = (f) => f in body && body[f] !== undefined

	if (!partial || has('type')) {
		const type = String(body.type || 'producto')
		if (!LISTING_TYPES.includes(type)) throw badRequest('Tipo de aviso inválido')
		out.type = type
	}
	if (!partial || has('title')) {
		const t = (body.title || '').toString().trim()
		if (t.length < 3 || t.length > 120) throw badRequest('El título debe tener entre 3 y 120 caracteres')
		out.title = t
	}
	if (!partial || has('description')) {
		const d = (body.description || '').toString().trim()
		if (d.length < 3 || d.length > 4000) throw badRequest('La descripción debe tener entre 3 y 4000 caracteres')
		out.description = d
	}
	if (!partial || has('price')) {
		const p = Number(body.price)
		if (!Number.isFinite(p) || p < 0 || p > 1e10) throw badRequest('El precio debe ser un número no negativo')
		out.price = p
	}
	if (!partial || has('region_code')) {
		if (!body.region_code || !REGION_CODES.includes(String(body.region_code))) throw badRequest('Región inválida')
		out.region_code = String(body.region_code)
	}
	if (has('comuna')) {
		const c = (body.comuna || '').toString().trim()
		if (c.length > 80) throw badRequest('Comuna inválida')
		out.comuna = c || null
	}
	if (has('address')) {
		const a = (body.address || '').toString().trim()
		if (a.length > 200) throw badRequest('La dirección no puede superar 200 caracteres')
		out.address = a || ''
	} else if (!partial) {
		out.address = ''
	}
	if (has('images')) {
		out.images = validateImages(body.images)
	}
	if (has('currency')) {
		if (!CURRENCIES.includes(String(body.currency))) throw badRequest('Moneda inválida')
		out.currency = String(body.currency)
	}
	if (has('badge')) {
		if (body.badge != null && body.badge !== '' && !BADGES.includes(String(body.badge))) throw badRequest('Etiqueta inválida')
		out.badge = body.badge || null
	}
	return out
}

// Valida atributos que dependen del tipo. `type` debe venir resuelto.
function validateTypedFields(body, type, out) {
	const has = (f) => f in body && body[f] !== undefined
	if (has('price_type')) {
		const pt = String(body.price_type)
		if (!PRICE_TYPES[type].includes(pt)) throw badRequest('Tipo de precio inválido para este aviso')
		out.price_type = pt
	}
	if (has('category')) {
		const cat = String(body.category)
		const validCats = type === 'servicio' ? SERVICE_CATEGORY_CODES : PRODUCT_CATEGORY_CODES
		if (!validCats.includes(cat)) throw badRequest('Categoría inválida')
		out.category = cat
	}
	if (has('subcategory')) {
		const sub = (body.subcategory || '').toString().trim()
		if (sub.length > 80) throw badRequest('Subcategoría inválida')
		out.subcategory = sub || null
	}
	if (type === 'producto') {
		if (has('condition')) {
			if (body.condition != null && !CONDITIONS.includes(String(body.condition))) throw badRequest('Condición inválida')
			out.condition = body.condition ?? null
		}
		if (has('stock')) {
			if (body.stock == null || body.stock === '') {
				out.stock = null
			} else {
				const s = Number(body.stock)
				if (!Number.isInteger(s) || s < 0 || s > 1e6) throw badRequest('Stock inválido')
				out.stock = s
			}
		}
		if (has('shipping')) {
			if (body.shipping != null && !SHIPPING.includes(String(body.shipping))) throw badRequest('Opción de entrega inválida')
			out.shipping = body.shipping ?? null
		}
	} else {
		// Los servicios no llevan condición / stock / envío
		out.condition = null
		out.stock = null
		out.shipping = null
	}
	return out
}

// La UF solo tiene sentido en inmuebles (misma regla que aplica la UI)
function assertCurrencyAllowed(currency, category) {
	if (currency === 'UF' && category !== 'inmuebles') {
		throw badRequest('La UF solo está disponible para avisos de inmuebles')
	}
}

const MAX_LISTINGS_PER_USER = 100

async function createListing(body, res) {
	const { token } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	const user = await getUserFromToken(token)
	const profile = await ensureProfile(user.id)
	if (!profile.username) return res.status(400).json({ error: 'Primero elige un nombre de usuario' })

	// Cota simple anti-spam
	const { count: myCount } = await adminClient
		.from('listings2')
		.select('id', { count: 'exact', head: true })
		.eq('user_id', user.id)
	if ((myCount ?? 0) >= MAX_LISTINGS_PER_USER) {
		return res.status(429).json({ error: `Alcanzaste el máximo de ${MAX_LISTINGS_PER_USER} avisos por cuenta` })
	}

	const fields = validateListingFields(body)
	validateTypedFields(body, fields.type, fields)
	if (!fields.category) return res.status(400).json({ error: 'Debes elegir una categoría' })
	if (!fields.price_type) fields.price_type = fields.type === 'servicio' ? 'convenir' : 'fijo'
	assertCurrencyAllowed(fields.currency ?? 'CLP', fields.category)
	const images = fields.images || []

	const { data, error } = await adminClient.from('listings2').insert({
		user_id: user.id,
		username: profile.username,
		...fields,
		images,
		image_url: images[0] ?? null, // compatibilidad con el esquema v1
		status: 'active',
	}).select().single()
	if (error) throw error
	res.json({ listing: filterListingFull(data) })
}

async function getOwnedListing(user, listingId) {
	const { data, error } = await adminClient.from('listings2').select('*').eq('id', listingId).maybeSingle()
	if (error) throw error
	if (!data) throw Object.assign(new Error('Aviso no encontrado'), { status: 404 })
	if (data.user_id !== user.id) throw Object.assign(new Error('No eres el dueño de este aviso'), { status: 403 })
	return data
}

async function updateListing(body, res) {
	const { token, id } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	if (id == null) return res.status(400).json({ error: 'Missing id' })
	const user = await getUserFromToken(token)
	const current = await getOwnedListing(user, id)

	const fields = validateListingFields(body, { partial: true })
	const type = fields.type || current.type || 'producto'
	fields.type = type
	validateTypedFields(body, type, fields)
	assertCurrencyAllowed(fields.currency ?? current.currency ?? 'CLP', fields.category ?? current.category)
	if ('images' in fields) fields.image_url = fields.images[0] ?? null

	const { data, error } = await adminClient.from('listings2').update(fields).eq('id', id).select().single()
	if (error) throw error
	res.json({ listing: filterListingFull(data) })
}

async function deleteListing(body, res) {
	const { token, id } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	if (id == null) return res.status(400).json({ error: 'Missing id' })
	const user = await getUserFromToken(token)
	await getOwnedListing(user, id)
	const { error } = await adminClient.from('listings2').delete().eq('id', id)
	if (error) throw error
	res.json({ ok: true })
}

async function setListingStatus(body, res) {
	const { token, id, status } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	if (id == null) return res.status(400).json({ error: 'Missing id' })
	if (!STATUSES.includes(String(status))) return res.status(400).json({ error: 'Estado inválido' })
	const user = await getUserFromToken(token)
	await getOwnedListing(user, id)
	const { data, error } = await adminClient.from('listings2').update({ status: String(status) }).eq('id', id).select().single()
	if (error) throw error
	res.json({ listing: filterListingFull(data) })
}

const RENEW_COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24 horas, como el "refresh" de yapo

async function renewListing(body, res) {
	const { token, id } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	if (id == null) return res.status(400).json({ error: 'Missing id' })
	const user = await getUserFromToken(token)
	const current = await getOwnedListing(user, id)
	const last = new Date(current.refreshed_at || current.created_at).getTime()
	if (Date.now() - last < RENEW_COOLDOWN_MS) {
		return res.status(429).json({ error: 'Solo puedes renovar un aviso una vez cada 24 horas' })
	}
	const { data, error } = await adminClient.from('listings2').update({ refreshed_at: new Date().toISOString() }).eq('id', id).select().single()
	if (error) throw error
	res.json({ listing: filterListingFull(data) })
}

async function listMyListings(body, res) {
	const { token, limit = 100 } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	const user = await getUserFromToken(token)
	const { data, error } = await adminClient
		.from('listings2')
		.select('*')
		.eq('user_id', user.id)
		.order('id', { ascending: false })
		.limit(Math.min(limit, 200))
	if (error) throw error
	res.json({ listings: data.map(filterListingPublic) })
}

// Columnas que necesita filterListingPublic (evita transferir description/address)
const PUBLIC_COLUMNS = 'id, user_id, username, title, price, price_type, currency, badge, type, category, subcategory, condition, region_code, comuna, status, views, created_at, refreshed_at, images, image_url'

async function listUserListings(body, res) {
	const { username, limit = 50 } = body
	if (!username) return res.status(400).json({ error: 'Missing username' })
	const { data, error } = await adminClient
		.from('listings2')
		.select(PUBLIC_COLUMNS)
		.eq('username', username)
		.eq('status', 'active')
		.order('id', { ascending: false })
		.limit(Math.min(limit, 200))
	if (error) throw error
	res.json({ listings: (data || []).map(filterListingPublic) })
}

async function listAllListings(body, res) {
	const {
		limit = 24, offset = 0,
		region_code, comuna, q,
		type, category, subcategory,
		condition, min_price, max_price,
		sort = 'recent',
	} = body

	const lim = Math.min(Number(limit) || 24, 60)
	const off = Math.max(Number(offset) || 0, 0)

	// El COUNT exacto solo en la primera página; "cargar más" reutiliza el total
	let query = adminClient
		.from('listings2')
		.select(PUBLIC_COLUMNS, off === 0 ? { count: 'exact' } : {})

	// Solo avisos activos (requiere la migración v2 aplicada)
	query = query.eq('status', 'active')

	if (region_code && REGION_CODES.includes(String(region_code))) {
		query = query.eq('region_code', String(region_code))
	}
	if (comuna && String(comuna).trim()) {
		query = query.eq('comuna', String(comuna).trim().slice(0, 80))
	}
	if (type && LISTING_TYPES.includes(String(type))) {
		query = query.eq('type', String(type))
	}
	if (category && String(category).trim()) {
		query = query.eq('category', String(category).trim().slice(0, 80))
	}
	if (subcategory && String(subcategory).trim()) {
		query = query.eq('subcategory', String(subcategory).trim().slice(0, 80))
	}
	if (condition && CONDITIONS.includes(String(condition))) {
		query = query.eq('condition', String(condition))
	}
	const minP = Number(min_price)
	if (Number.isFinite(minP) && minP > 0) query = query.gte('price', minP)
	const maxP = Number(max_price)
	if (Number.isFinite(maxP) && maxP > 0) query = query.lte('price', maxP)

	// Los filtros de precio de la UI están expresados en CLP: excluir avisos en UF
	// para no mezclar magnitudes (UF 3.500 no es "menos" que $5.000)
	if ((Number.isFinite(minP) && minP > 0) || (Number.isFinite(maxP) && maxP > 0)) {
		query = query.eq('currency', 'CLP')
	}

	// Búsqueda por texto en título y descripción (AND entre términos)
	if (q != null && String(q).trim() !== '') {
		const raw = String(q).trim().slice(0, 120)
		const terms = raw.split(/\s+/).filter(Boolean)
		for (const term of terms) {
			const safe = term.replace(/[%_,()]/g, '')
			if (!safe) continue
			query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
		}
	}

	// Al ordenar por precio se agrupa por moneda (CLP primero) para no
	// intercalar UF con pesos
	if (sort === 'price_asc') query = query.order('currency', { ascending: true }).order('price', { ascending: true })
	else if (sort === 'price_desc') query = query.order('currency', { ascending: true }).order('price', { ascending: false })
	else query = query.order('refreshed_at', { ascending: false, nullsFirst: false })
	query = query.order('id', { ascending: false })

	query = query.range(off, off + lim - 1)

	const { data, error, count } = await query
	if (error) throw error
	res.json({ listings: (data || []).map(filterListingPublic), total: off === 0 ? (count ?? null) : null, offset: off, limit: lim })
}

async function getListing(body, res) {
	const { id, count_view } = body
	if (id == null) return res.status(400).json({ error: 'Missing id' })
	const { data, error } = await adminClient
		.from('listings2')
		.select('*')
		.eq('id', id)
		.single()
	if (error) throw error

	// Contador de visitas: efecto secundario, no bloquea la respuesta
	if (count_view) {
		adminClient.rpc('increment_listing_views2', { lid: data.id })
			.then(() => {}, () => { /* pre-migración */ })
	}

	// Vendedor (reputación, antigüedad, teléfono visible) y favoritos, en paralelo
	const [sellerInfo, favCount] = await Promise.all([
		(async () => {
			try {
				const { data: prof } = await adminClient.from('profiles2').select('*').eq('id', data.user_id).maybeSingle()
				if (!prof) return null
				const summary = await reviewSummaryForSeller(prof.id)
				return {
					username: prof.username,
					member_since: prof.created_at ?? null,
					phone: prof.show_phone ? (prof.phone ?? null) : null,
					...summary,
				}
			} catch (e) {
				console.error('seller info', e)
				return null
			}
		})(),
		(async () => {
			try {
				const { count } = await adminClient
					.from('favorites2')
					.select('listing_id', { count: 'exact', head: true })
					.eq('listing_id', data.id)
				return count ?? 0
			} catch { return 0 /* pre-migración */ }
		})(),
	])

	res.json({ listing: filterListingFull(data), seller: sellerInfo, favorites_count: favCount })
}

// ---------- Favoritos ----------
async function toggleFavorite(body, res) {
	const { token, listing_id } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	if (listing_id == null) return res.status(400).json({ error: 'Missing listing_id' })
	const user = await getUserFromToken(token)
	const { data: existing, error: exErr } = await adminClient
		.from('favorites2').select('listing_id')
		.eq('user_id', user.id).eq('listing_id', listing_id).maybeSingle()
	if (exErr) throw exErr
	if (existing) {
		const { error } = await adminClient.from('favorites2').delete().eq('user_id', user.id).eq('listing_id', listing_id)
		if (error) throw error
		return res.json({ favorited: false })
	}
	const { error } = await adminClient.from('favorites2').insert({ user_id: user.id, listing_id })
	if (error) throw error
	res.json({ favorited: true })
}

async function listFavorites(body, res) {
	const { token, limit = 100 } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	const user = await getUserFromToken(token)
	const { data, error } = await adminClient
		.from('favorites2')
		.select('listing_id, created_at, listings2(*)')
		.eq('user_id', user.id)
		.order('created_at', { ascending: false })
		.limit(Math.min(limit, 200))
	if (error) throw error
	const listings = (data || [])
		.map(r => r.listings2)
		.filter(Boolean)
		.map(filterListingPublic)
	res.json({ listings })
}

async function listFavoriteIds(body, res) {
	const { token } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	const user = await getUserFromToken(token)
	const { data, error } = await adminClient.from('favorites2').select('listing_id').eq('user_id', user.id)
	if (error) throw error
	res.json({ ids: (data || []).map(r => r.listing_id) })
}

// ---------- Reseñas ----------
async function createReview(body, res) {
	const { token, seller_username, listing_id, rating, comment } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	if (!seller_username) return res.status(400).json({ error: 'Missing seller_username' })
	const r = Number(rating)
	if (!Number.isInteger(r) || r < 1 || r > 5) return res.status(400).json({ error: 'La nota debe ser un entero entre 1 y 5' })
	const text = comment ? String(comment).trim().slice(0, 1000) : null

	const user = await getUserFromToken(token)
	const myProf = await ensureProfile(user.id)
	if (!myProf.username) return res.status(400).json({ error: 'Primero elige un nombre de usuario' })
	const seller = await findProfileByUsername(String(seller_username))
	if (!seller) return res.status(404).json({ error: 'Vendedor no encontrado' })
	if (seller.id === user.id) return res.status(400).json({ error: 'No puedes dejarte una reseña a ti mismo' })

	const payload = {
		reviewer_id: user.id,
		reviewer_username: myProf.username,
		seller_id: seller.id,
		seller_username: seller.username,
		listing_id: listing_id ?? null,
		rating: r,
		comment: text,
		updated_at: new Date().toISOString(),
	}
	const { data, error } = await adminClient
		.from('reviews2')
		.upsert(payload, { onConflict: 'reviewer_id,seller_id' })
		.select()
		.single()
	if (error) throw error
	res.json({ review: data })
}

async function listReviews(body, res) {
	const { seller_username, limit = 50 } = body
	if (!seller_username) return res.status(400).json({ error: 'Missing seller_username' })
	const seller = await findProfileByUsername(String(seller_username))
	if (!seller) return res.status(404).json({ error: 'Vendedor no encontrado' })
	const { data, error } = await adminClient
		.from('reviews2')
		.select('id, reviewer_username, rating, comment, created_at, updated_at, listing_id')
		.eq('seller_id', seller.id)
		.order('id', { ascending: false })
		.limit(Math.min(limit, 100))
	if (error) throw error
	const summary = await reviewSummaryForSeller(seller.id)
	res.json({ reviews: data || [], ...summary })
}

// ---------- Denuncias ----------
const REPORT_REASON_MAX = 120

async function reportListing(body, res) {
	const { token, listing_id, reason, detail } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	if (listing_id == null) return res.status(400).json({ error: 'Missing listing_id' })
	if (!reason || !String(reason).trim()) return res.status(400).json({ error: 'Debes indicar un motivo' })
	const user = await getUserFromToken(token)
	// Una denuncia por usuario y aviso (índice único en la BD)
	const { error } = await adminClient.from('reports2').upsert({
		listing_id,
		reporter_id: user.id,
		reason: String(reason).trim().slice(0, REPORT_REASON_MAX),
		detail: detail ? String(detail).trim().slice(0, 1000) : null,
	}, { onConflict: 'listing_id,reporter_id', ignoreDuplicates: true })
	if (error) throw error
	res.json({ ok: true })
}

// ---------- Mensajes directos (DM) ----------
async function findProfileByUsername(username) {
	const { data, error } = await adminClient.from('profiles2').select('id, username').eq('username', username).maybeSingle()
	if (error) throw error
	return data
}

function orderPair(a, b) {
	return a < b ? [a, b] : [b, a]
}

async function startDm(body, res) {
	const { token, target_username, listing_id } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	const user = await getUserFromToken(token)
	const myProf = await ensureProfile(user.id)
	if (!myProf.username) return res.status(400).json({ error: 'Primero elige un nombre de usuario' })
	let target = null
	let lid = null
	if (listing_id != null) {
		const { data: lrow, error: lerr } = await adminClient.from('listings2').select('id, user_id, username').eq('id', listing_id).maybeSingle()
		if (lerr) throw lerr
		if (!lrow) return res.status(404).json({ error: 'Aviso no encontrado' })
		lid = lrow.id
		const ownerProf = await ensureProfile(lrow.user_id)
		target = { id: ownerProf.id, username: ownerProf.username || lrow.username }
	} else {
		if (!target_username) return res.status(400).json({ error: 'Missing target_username' })
		const t = await findProfileByUsername(String(target_username))
		if (!t) return res.status(404).json({ error: 'Usuario no encontrado' })
		target = t
	}

	if (target.id === user.id) return res.status(400).json({ error: 'No puedes enviarte mensajes a ti mismo' })

	const [a, b] = orderPair(user.id, target.id)

	let query = adminClient
		.from('threads2')
		.select('*')
		.eq('user_a_id', a).eq('user_b_id', b)
	query = lid == null ? query.is('listing_id', null) : query.eq('listing_id', lid)
	const { data: existing, error: findErr } = await query.maybeSingle()
	if (findErr) throw findErr

	if (existing) {
		return res.json({ thread: sanitizeThread(existing, user.id) })
	}

	const payload = {
		user_a_id: a,
		user_b_id: b,
		user_a_username: a === user.id ? myProf.username : target.username,
		user_b_username: b === user.id ? myProf.username : target.username,
		listing_id: lid,
	}
	const { data: inserted, error: insErr } = await adminClient.from('threads2').insert(payload).select().single()
	if (insErr) throw insErr
	res.json({ thread: sanitizeThread(inserted, user.id) })
}

function sanitizeThread(row, viewerId) {
	const other_id = row.user_a_id === viewerId ? row.user_b_id : row.user_a_id
	const other_username = row.user_a_id === viewerId ? row.user_b_username : row.user_a_username
	return {
		id: row.id,
		listing_id: row.listing_id ?? null,
		user_a_id: row.user_a_id,
		user_b_id: row.user_b_id,
		user_a_username: row.user_a_username,
		user_b_username: row.user_b_username,
		other_id,
		other_username,
		created_at: row.created_at,
	}
}

async function requireThreadMembership(thread_id, user_id) {
	const { data, error } = await adminClient
		.from('threads2')
		.select('*')
		.eq('id', thread_id)
		.maybeSingle()
	if (error) throw error
	if (!data || (data.user_a_id !== user_id && data.user_b_id !== user_id)) {
		const err = new Error('No participas en esta conversación')
		err.status = 403
		throw err
	}
	return data
}

async function getDmThread(body, res) {
	const { token, thread_id } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	if (!thread_id) return res.status(400).json({ error: 'Missing thread_id' })
	const user = await getUserFromToken(token)
	const row = await requireThreadMembership(thread_id, user.id)
	res.json({ thread: sanitizeThread(row, user.id) })
}

async function listDmMessages(body, res) {
	const { token, thread_id, limit = 50, after_id } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	if (!thread_id) return res.status(400).json({ error: 'Missing thread_id' })
	const user = await getUserFromToken(token)
	await requireThreadMembership(thread_id, user.id)
	let query = adminClient
		.from('thread_messages2')
		.select('id, sender_id, sender_username, content, created_at')
		.eq('thread_id', thread_id)
		.order('id', { ascending: true })
		.limit(Math.min(limit, 200))
	if (after_id) query = query.gt('id', after_id)
	const { data, error } = await query
	if (error) throw error
	res.json({ messages: data })
}

async function sendDmMessage(body, res) {
	const { token, thread_id, content } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	if (!thread_id) return res.status(400).json({ error: 'Missing thread_id' })
	if (!content || typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: 'Mensaje vacío' })
	const text = content.trim().slice(0, 1000)
	const user = await getUserFromToken(token)
	const row = await requireThreadMembership(thread_id, user.id)
	const sender_username = row.user_a_id === user.id ? row.user_a_username : row.user_b_username
	const { data, error } = await adminClient
		.from('thread_messages2')
		.insert({ thread_id, sender_id: user.id, sender_username, content: text })
		.select()
		.single()
	if (error) throw error
	res.json({ message: data })
}

async function listDmThreads(body, res) {
	const { token, listing_id, limit = 50 } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	const user = await getUserFromToken(token)
	let query = adminClient
		.from('threads2')
		.select('*')
		.or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
		.order('id', { ascending: false })
		.limit(Math.min(limit, 200))
	if (listing_id != null) query = query.eq('listing_id', listing_id)
	const { data, error } = await query
	if (error) throw error
	const threads = (data || []).map(row => sanitizeThread(row, user.id))

	// Adjuntar título del aviso asociado (si existe) para la bandeja de entrada
	const listingIds = [...new Set(threads.map(t => t.listing_id).filter(v => v != null))]
	if (listingIds.length > 0) {
		const { data: lrows } = await adminClient.from('listings2').select('id, title').in('id', listingIds)
		const titles = new Map((lrows || []).map(l => [l.id, l.title]))
		for (const t of threads) {
			if (t.listing_id != null) t.listing_title = titles.get(t.listing_id) ?? null
		}
	}
	res.json({ threads })
}
