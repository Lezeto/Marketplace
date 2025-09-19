// Serverless function handler for Vercel-like environment.
// Actions: me, set-username, get-profile, update-profile, list-messages, send-message
// Requires env vars:
//  - SUPABASE_URL
//  - SUPABASE_SERVICE_KEY (service role)
//  - SUPABASE_ANON_KEY (for potential validation)
// Database schema (SQL suggestions in README/instructions):
//  profiles: id UUID (primary key references auth.users.id), username text unique, created_at timestamptz default now()
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
	const { data, error } = await adminClient.from('profiles').select('*').eq('id', userId).single()
	if (error && error.code !== 'PGRST116') { // PGRST116 = not found single
		throw error
	}
	if (!data) {
		const { error: insErr } = await adminClient.from('profiles').insert({ id: userId })
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
	const { data: existing, error: existingErr } = await adminClient.from('profiles').select('id').eq('username', username).maybeSingle()
	if (existingErr) throw existingErr
	if (existing && existing.id !== user.id) return res.status(409).json({ error: 'Username taken' })
	const { error: upErr, data } = await adminClient.from('profiles').update({ username }).eq('id', user.id).select().single()
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
		const { data, error } = await adminClient.from('profiles').select('*').eq('username', username).maybeSingle()
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
	const { data, error } = await adminClient.from('profiles').update(allowed).eq('id', user.id).select().single()
	if (error) throw error
	res.json(filterProfile(data))
}

// ---------- Chat ----------
async function listMessages(body, res) {
	const { limit = 50, after_id } = body
	const query = adminClient.from('chat_messages').select('id, username, content, created_at').order('id', { ascending: true }).limit(Math.min(limit, 100))
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
	const { data, error } = await adminClient.from('chat_messages').insert({ user_id: user.id, username: profile.username, content: text }).select().single()
	if (error) throw error
	res.json({ message: data })
}

// Removed edge runtime config to use Node environment (res.status / json supported).
