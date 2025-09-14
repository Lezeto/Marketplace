import { useEffect, useState, useCallback } from 'react'
import './App.css'

// We will interact with a serverless function at /api/gamexapi (Vercel) or relative path locally.
// Supabase client will be dynamically imported to avoid SSR issues if deployed.

function App() {
  const [view, setView] = useState('loading') // loading | auth | username | game
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [desiredUsername, setDesiredUsername] = useState('')
  const [session, setSession] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [gameState, setGameState] = useState('idle') // idle | counting | finished
  const [timeLeft, setTimeLeft] = useState(5)
  const [clicks, setClicks] = useState(0)
  const [maxScore, setMaxScore] = useState(0)
  const [error, setError] = useState('')
  const [loadingAction, setLoadingAction] = useState(false)

  // Lazy load supabase
  const [supabase, setSupabase] = useState(null)
  useEffect(() => {
    (async () => {
      const { createClient } = await import('@supabase/supabase-js')
      const client = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      )
      setSupabase(client)
      const { data: { session } } = await client.auth.getSession()
      if (session) {
        setSession(session)
        await hydrateProfile(client, session)
      } else {
        setView('auth')
      }
      client.auth.onAuthStateChange((_event, session) => {
        setSession(session)
        if (session) {
          hydrateProfile(client, session)
        } else {
          resetAll()
        }
      })
    })()
  }, [])

  const resetAll = () => {
    setUsername('')
    setMaxScore(0)
    setLeaderboard([])
    setView('auth')
  }

  const callApi = useCallback(async (payload) => {
    const res = await fetch('/api/gamexapi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || 'API error')
    }
    return res.json()
  }, [])

  const hydrateProfile = async (client, sess) => {
    try {
      const token = sess.access_token
      const me = await callApi({ action: 'me', token })
      if (!me.username) {
        setView('username')
      } else {
        setUsername(me.username)
        setMaxScore(me.max_score || 0)
        setView('game')
        loadLeaderboard()
      }
    } catch (e) {
      console.error(e)
      setError(e.message)
      setView('auth')
    }
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    if (!supabase) return
    setLoadingAction(true)
    setError('')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) setError(error.message)
    else if (data.user) {
      // user must verify email depending on settings; continue
    }
    setLoadingAction(false)
  }

  const handleSignIn = async (e) => {
    e.preventDefault()
    if (!supabase) return
    setLoadingAction(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoadingAction(false)
  }

  const submitUsername = async (e) => {
    e.preventDefault()
    if (!desiredUsername.trim()) return
    setLoadingAction(true)
    setError('')
    try {
      const token = session?.access_token
      const resp = await callApi({ action: 'set-username', token, username: desiredUsername.trim() })
      setUsername(resp.username)
      setView('game')
      loadLeaderboard()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingAction(false)
    }
  }

  const loadLeaderboard = useCallback(async () => {
    try {
      const data = await callApi({ action: 'leaderboard' })
      setLeaderboard(data.leaderboard || [])
    } catch (e) {
      console.error(e)
    }
  }, [callApi])

  // Game logic
  useEffect(() => {
    let timer
    if (gameState === 'counting' && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    } else if (gameState === 'counting' && timeLeft === 0) {
      setGameState('finished')
      submitScore()
    }
    return () => clearTimeout(timer)
  }, [gameState, timeLeft])

  const startGame = () => {
    setClicks(0)
    setTimeLeft(5)
    setGameState('counting')
  }

  const registerClick = () => {
    if (gameState !== 'counting') return
    setClicks(c => c + 1)
  }

  const submitScore = async () => {
    try {
      const token = session?.access_token
      if (!token) return
      const resp = await callApi({ action: 'submit-score', token, score: clicks })
      setMaxScore(resp.max_score)
      loadLeaderboard()
    } catch (e) {
      console.error(e)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  // UI pieces
  let content
  if (view === 'loading') {
    content = <div className="loading">Loading...</div>
  } else if (view === 'auth') {
    content = (
      <div className="panel">
        <h1>Click Blitz</h1>
        <p className="tagline">Click as many times as you can in 5 seconds!</p>
        {error && <div className="error">{error}</div>}
        <form className="auth-form" onSubmit={handleSignIn} autoComplete="on">
          <label htmlFor="email" className="visually-hidden">Email</label>
          <input id="email" name="email" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          <label htmlFor="password" className="visually-hidden">Password</label>
            <input id="password" name="password" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          <div className="row">
            <button type="submit" disabled={loadingAction}>Sign In</button>
            <button type="button" onClick={handleSignUp} disabled={loadingAction}>Sign Up</button>
          </div>
        </form>
      </div>
    )
  } else if (view === 'username') {
    content = (
      <div className="panel">
        <h2>Choose a username</h2>
        {error && <div className="error">{error}</div>}
        <form onSubmit={submitUsername} className="username-form" autoComplete="off">
          <label htmlFor="username" className="visually-hidden">Username</label>
          <input id="username" name="username" maxLength={20} value={desiredUsername} placeholder="Unique username" onChange={e => setDesiredUsername(e.target.value)} required autoComplete="off" />
          <button disabled={loadingAction}>Save</button>
        </form>
        <button className="link-btn" onClick={signOut}>Sign Out</button>
      </div>
    )
  } else if (view === 'game') {
    content = (
      <div className="layout">
        <div className="main-game">
          <div className="top-bar">
            <div>Logged in as <strong>{username}</strong></div>
            <button onClick={signOut}>Sign Out</button>
          </div>
          <div className="score-box">
            <div className="label">Your max score</div>
            <div className="value">{maxScore}</div>
          </div>
          {gameState !== 'counting' && (
            <button className="start-btn" onClick={startGame}>Start 5s Round</button>
          )}
          {gameState === 'counting' && <div className="timer">Time: {timeLeft}s</div>}
          <div className={`click-area ${gameState === 'counting' ? 'active' : ''}`} onClick={registerClick}>
            {gameState === 'idle' && <span>Press Start then click here fast!</span>}
            {gameState === 'counting' && <span>{clicks} clicks</span>}
            {gameState === 'finished' && <span>Round over! {clicks} clicks. Start again?</span>}
          </div>
        </div>
        <div className="sidebar">
          <h3>Top 10</h3>
          <button className="refresh" onClick={loadLeaderboard}>↻ Refresh</button>
          <ol className="leaderboard">
            {leaderboard.map((r, i) => (
              <li key={r.username + i} className={r.username === username ? 'me' : ''}>
                <span className="rank">{i + 1}.</span>
                <span className="user">{r.username}</span>
                <span className="score">{r.max_score}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    )
  }

  return <div className="app-shell">{content}</div>
}

export default App
