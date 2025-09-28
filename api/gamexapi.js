// Serverless function handler for Vercel-like environment.
// Actions: me, set-username, get-profile, update-profile, list-messages, send-message
//          create-listing, list-my-listings, list-user-listings, list-all-listings, get-listing
// Requires env vars:
//  - SUPABASE_URL
//  - SUPABASE_SERVICE_KEY (service role)
//  - SUPABASE_ANON_KEY (for potential validation)
// Database schema (SQL suggestions in README/instructions):
//  profiles2: id UUID (primary key references auth.users.id), username text unique, created_at timestamptz default now()
//  chat_messages2: id bigint generated always as identity primary key, user_id uuid, username text, content text, created_at timestamptz default now()
// RLS enabled with policies to allow read leaderboard, and user to read/update own row.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !serviceKey) {
	console.warn('Missing Supabase env vars: SUPABASE_URL / SUPABASE_SERVICE_KEY')
}

const adminClient = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

export default async function handler(req, res) {
  // Proper Node handler (NOT edge) for Vercel. We manually parse JSON body.
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
			case 'list-my-listings':
				return await listMyListings(body, res)
			case 'list-user-listings':
				return await listUserListings(body, res)
			case 'list-all-listings':
				return await listAllListings(body, res)
			case 'get-listing':
				return await getListing(body, res)
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
    res.status(500).json({ error: e.message || 'Server error' })
  }
}

async function getUserFromToken(token) {
	// Use admin auth API to get user
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
	if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: 'Invalid username (3-20 alphanumeric or _ )' })
	const user = await getUserFromToken(token)
	// Check uniqueness
	const { data: existing, error: existingErr } = await adminClient.from('profiles2').select('id').eq('username', username).maybeSingle()
	if (existingErr) throw existingErr
	if (existing && existing.id !== user.id) return res.status(409).json({ error: 'Username taken' })
	const { error: upErr, data } = await adminClient.from('profiles2').update({ username }).eq('id', user.id).select().single()
	if (upErr) throw upErr
	res.json({ username: data.username })
}

// Removed game-specific endpoints (submit-score, leaderboard)

// ---------- Profiles Extended ----------
const PROFILE_FIELDS = ['age','gender','address','occupation','motivation']

function filterProfile(p) {
	return {
		id: p.id,
		username: p.username,
		age: p.age ?? null,
		gender: p.gender ?? null,
		address: p.address ?? null,
		occupation: p.occupation ?? null,
		motivation: p.motivation ?? null,
	}
}

async function getProfile(body, res) {
	const { username, token } = body
	if (!username && !token) return res.status(400).json({ error: 'Provide username or token' })
	if (username) {
		const { data, error } = await adminClient.from('profiles2').select('*').eq('username', username).maybeSingle()
		if (error) throw error
		if (!data) return res.status(404).json({ error: 'Not found' })
		return res.json(filterProfile(data))
	}
	// fallback: own profile
	const user = await getUserFromToken(token)
	const profile = await ensureProfile(user.id)
	res.json(filterProfile(profile))
}

async function updateProfile(body, res) {
	const { token, patch } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	if (!patch || typeof patch !== 'object') return res.status(400).json({ error: 'Missing patch' })
	const user = await getUserFromToken(token)
	const allowed = {}
	for (const f of PROFILE_FIELDS) if (f in patch) allowed[f] = patch[f]
	if (Object.keys(allowed).length === 0) return res.status(400).json({ error: 'No valid fields' })
	// Simple validation
	if ('age' in allowed && allowed.age !== null) {
		const ageNum = Number(allowed.age)
		if (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 130) return res.status(400).json({ error: 'Invalid age' })
		allowed.age = ageNum
	}
	if ('gender' in allowed && allowed.gender && String(allowed.gender).length > 30) return res.status(400).json({ error: 'Gender too long' })
	for (const longField of ['address','occupation','motivation']) {
		if (longField in allowed && allowed[longField] && String(allowed[longField]).length > 500) {
			return res.status(400).json({ error: longField + ' too long' })
		}
	}
	const { data, error } = await adminClient.from('profiles2').update(allowed).eq('id', user.id).select().single()
	if (error) throw error
	res.json(filterProfile(data))
}

// ---------- Chat ----------
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
	if (!content || typeof content !== 'string' || content.trim().length === 0) return res.status(400).json({ error: 'Empty message' })
	const text = content.trim().slice(0, 500)
	const user = await getUserFromToken(token)
	const profile = await ensureProfile(user.id)
	if (!profile.username) return res.status(400).json({ error: 'Username not set' })
	const { data, error } = await adminClient.from('chat_messages2').insert({ user_id: user.id, username: profile.username, content: text }).select().single()
	if (error) throw error
	res.json({ message: data })
}

// Removed edge runtime config to use Node environment (res.status / json supported).

// ---------- Listings ----------
// listings2 schema suggestion:
// id bigint primary key generated always as identity,
// user_id uuid references auth.users(id),
// username text,
// title text,
// address text,
// price numeric,
// description text,
// image_url text,
// region_code text,
// created_at timestamptz default now()

function filterListingPublic(row) {
	return {
		id: row.id,
		username: row.username,
		title: row.title,
		image_url: row.image_url ?? null,
		price: row.price,
		region_code: row.region_code ?? null,
		created_at: row.created_at,
	}
}

function filterListingFull(row) {
	return {
		id: row.id,
		user_id: row.user_id,
		username: row.username,
		title: row.title,
		address: row.address,
		price: row.price,
		description: row.description,
		image_url: row.image_url ?? null,
		region_code: row.region_code ?? null,
		created_at: row.created_at,
	}
}

const REGION_CODES = [
	'I','II','III','IV','V','RM','VI','VII','VIII','IX','X','XI','XII','XIV','XV','XVI'
]

async function createListing(body, res) {
	const { token, title, address, price, description, image_url, region_code } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	const user = await getUserFromToken(token)
	const profile = await ensureProfile(user.id)
	if (!profile.username) return res.status(400).json({ error: 'Username not set' })
	// Validate
	const t = (title || '').toString().trim()
	const a = (address || '').toString().trim()
	const d = (description || '').toString().trim()
	const p = Number(price)
	if (t.length < 3 || t.length > 120) return res.status(400).json({ error: 'Title must be 3-120 chars' })
	if (a.length < 3 || a.length > 200) return res.status(400).json({ error: 'Address must be 3-200 chars' })
	if (!Number.isFinite(p) || p < 0 || p > 1e9) return res.status(400).json({ error: 'Price must be a non-negative number' })
	if (d.length < 3 || d.length > 2000) return res.status(400).json({ error: 'Description must be 3-2000 chars' })
	if (!region_code || !REGION_CODES.includes(String(region_code))) return res.status(400).json({ error: 'Invalid region_code' })
	let imgUrl = null
	if (image_url != null) {
		const url = String(image_url)
		if (url.length > 1000) return res.status(400).json({ error: 'image_url too long' })
		// Allow only http/https public URLs
		if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'image_url must be http(s)' })
		imgUrl = url
	}
	const { data, error } = await adminClient.from('listings2').insert({
		user_id: user.id,
		username: profile.username,
		title: t,
		address: a,
		price: p,
		description: d,
		image_url: imgUrl,
		region_code: String(region_code),
	}).select().single()
	if (error) throw error
	res.json({ listing: filterListingFull(data) })
}

async function listMyListings(body, res) {
	const { token, limit = 50 } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	const user = await getUserFromToken(token)
	const { data, error } = await adminClient
		.from('listings2')
		.select('id, username, title, price, region_code, created_at')
		.eq('user_id', user.id)
		.order('id', { ascending: false })
		.limit(Math.min(limit, 200))
	if (error) throw error
	res.json({ listings: data.map(filterListingPublic) })
}

async function listUserListings(body, res) {
	const { username, limit = 50 } = body
	if (!username) return res.status(400).json({ error: 'Missing username' })
	const { data, error } = await adminClient
		.from('listings2')
		.select('id, username, title, price, region_code, created_at')
		.eq('username', username)
		.order('id', { ascending: false })
		.limit(Math.min(limit, 200))
	if (error) throw error
	res.json({ listings: data.map(filterListingPublic) })
}

async function listAllListings(body, res) {
	const { limit = 50, region_code } = body
	let query = adminClient
		.from('listings2')
		.select('id, username, title, price, region_code, created_at')
		.order('id', { ascending: false })
		.limit(Math.min(limit, 200))
	if (region_code && REGION_CODES.includes(String(region_code))) {
		query = query.eq('region_code', String(region_code))
	}
	const { data, error } = await query
	if (error) throw error
	res.json({ listings: data.map(filterListingPublic) })
}

async function getListing(body, res) {
	const { id } = body
	if (id == null) return res.status(400).json({ error: 'Missing id' })
	const { data, error } = await adminClient
		.from('listings2')
		.select('*')
		.eq('id', id)
		.single()
	if (error) throw error
	res.json({ listing: filterListingFull(data) })
}

// ---------- Direct Messages (DM) ----------
// Schema suggestions (SQL provided separately):
// threads2: id bigint identity pk, user_a_id uuid, user_b_id uuid, user_a_username text, user_b_username text, listing_id bigint null, created_at timestamptz
// thread_messages2: id bigint identity pk, thread_id bigint fk, sender_id uuid, sender_username text, content text, created_at timestamptz

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
	if (!myProf.username) return res.status(400).json({ error: 'Set your username first' })
	let target = null
	let lid = null
	if (listing_id != null) {
		// Derive target from listing owner to avoid mismatches if username changed
		const { data: lrow, error: lerr } = await adminClient.from('listings2').select('id, user_id, username').eq('id', listing_id).maybeSingle()
		if (lerr) throw lerr
		if (!lrow) return res.status(404).json({ error: 'Listing not found' })
		lid = lrow.id
		// Load/ensure profile for owner id
		const ownerProf = await ensureProfile(lrow.user_id)
		target = { id: ownerProf.id, username: ownerProf.username || lrow.username }
	} else {
		if (!target_username) return res.status(400).json({ error: 'Missing target_username' })
		const t = await findProfileByUsername(String(target_username))
		if (!t) return res.status(404).json({ error: 'User not found' })
		target = t
	}

	if (target.id === user.id) return res.status(400).json({ error: 'Cannot message yourself' })

	const [a, b] = orderPair(user.id, target.id)

	// Find existing thread (same participants, same listing_id/null)
	let existing
	if (lid == null) {
		const { data, error } = await adminClient
			.from('threads2')
			.select('*')
			.eq('user_a_id', a).eq('user_b_id', b)
			.is('listing_id', null)
			.maybeSingle()
		if (error && error.code !== 'PGRST116') throw error
		existing = data || null
	} else {
		const { data, error } = await adminClient
			.from('threads2')
			.select('*')
			.eq('user_a_id', a).eq('user_b_id', b)
			.eq('listing_id', lid)
			.maybeSingle()
		if (error && error.code !== 'PGRST116') throw error
		existing = data || null
	}

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
	// Mark the counterparty for convenience
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
		const err = new Error('Not a member of this thread')
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
	if (!content || typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: 'Empty message' })
	const text = content.trim().slice(0, 1000)
	const user = await getUserFromToken(token)
	const row = await requireThreadMembership(thread_id, user.id)
	// Use the stored username fields to keep display consistent
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
	res.json({ threads })
}
