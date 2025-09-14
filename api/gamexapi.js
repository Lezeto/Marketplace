// Serverless function handler for Vercel-like environment.
// Actions: me, set-username, submit-score, leaderboard
// Requires env vars:
//  - SUPABASE_URL
//  - SUPABASE_SERVICE_KEY (service role)
//  - SUPABASE_ANON_KEY (for potential validation)
// Database schema (SQL suggestions in README/instructions):
//  profiles: id UUID (primary key references auth.users.id), username text unique, max_score int default 0, created_at timestamptz default now()
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
      case 'leaderboard':
        return await leaderboard(res)
      case 'me':
        return await me(body, res)
      case 'set-username':
        return await setUsername(body, res)
      case 'submit-score':
        return await submitScore(body, res)
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
		return { id: userId, max_score: 0 }
	}
	return data
}

async function me(body, res) {
	const { token } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	const user = await getUserFromToken(token)
	const profile = await ensureProfile(user.id)
	res.json({ id: profile.id, username: profile.username, max_score: profile.max_score })
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

async function submitScore(body, res) {
	const { token, score } = body
	if (!token) return res.status(401).json({ error: 'Missing token' })
	if (typeof score !== 'number' || score < 0 || score > 10000) return res.status(400).json({ error: 'Bad score' })
	const user = await getUserFromToken(token)
	const profile = await ensureProfile(user.id)
	const newMax = Math.max(profile.max_score || 0, score)
	if (newMax !== profile.max_score) {
		const { error: upErr, data } = await adminClient.from('profiles').update({ max_score: newMax }).eq('id', user.id).select().single()
		if (upErr) throw upErr
		return res.json({ updated: true, max_score: data.max_score })
	}
	res.json({ updated: false, max_score: profile.max_score })
}

async function leaderboard(res) {
	const { data, error } = await adminClient.from('profiles').select('username, max_score').not('username','is', null).order('max_score', { ascending: false }).limit(10)
	if (error) throw error
	res.json({ leaderboard: data })
}

// Removed edge runtime config to use Node environment (res.status / json supported).
