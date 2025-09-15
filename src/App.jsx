import { useEffect, useState, useCallback, useRef } from 'react'
import './App.css'

// We will interact with a serverless function at /api/gamexapi (Vercel) or relative path locally.
// Supabase client will be dynamically imported to avoid SSR issues if deployed.

function App() {
  const [view, setView] = useState('loading') // loading | auth | username | game | profile | profile-edit | chat
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
  // Extended profile data (my profile)
  const [myProfile, setMyProfile] = useState(null)
  // Viewing another user's profile
  const [viewedProfile, setViewedProfile] = useState(null)
  // Profile edit form state
  const [editAge, setEditAge] = useState('')
  const [editGender, setEditGender] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editOccupation, setEditOccupation] = useState('')
  const [editMotivation, setEditMotivation] = useState('')
  // Chat state
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const lastMessageIdRef = useRef(null)
  const chatPollingRef = useRef(null)

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
    setMyProfile(null)
    setViewedProfile(null)
    setMessages([])
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
        // store extended profile
        setMyProfile(me)
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
      // Re-hydrate full profile (me)
      if (token) {
        const me = await callApi({ action: 'me', token })
        setMyProfile(me)
      }
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

  // ------- Navigation helpers -------
  const goGame = () => { setView('game'); setViewedProfile(null) }
  const openProfile = async (uname) => {
    if (!uname) return
    if (uname === username) {
      setViewedProfile(null)
      setView('profile')
      return
    }
    try {
      setLoadingAction(true)
      const prof = await callApi({ action: 'get-profile', username: uname })
      setViewedProfile(prof)
      setView('profile')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingAction(false)
    }
  }

  const beginEditProfile = () => {
    const p = viewedProfile || myProfile
    if (!p) return
    setEditAge(p.age ?? '')
    setEditGender(p.gender ?? '')
    setEditAddress(p.address ?? '')
    setEditOccupation(p.occupation ?? '')
    setEditMotivation(p.motivation ?? '')
    setView('profile-edit')
  }

  const cancelEdit = () => {
    setView('profile')
  }

  const saveProfile = async (e) => {
    e.preventDefault()
    try {
      setLoadingAction(true)
      const token = session?.access_token
      if (!token) return
      const patch = {
        age: editAge === '' ? null : parseInt(editAge, 10),
        gender: editGender === '' ? null : editGender,
        address: editAddress === '' ? null : editAddress,
        occupation: editOccupation === '' ? null : editOccupation,
        motivation: editMotivation === '' ? null : editMotivation
      }
      const updated = await callApi({ action: 'update-profile', token, patch })
      setMyProfile(updated)
      setViewedProfile(null)
      setView('profile')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingAction(false)
    }
  }

  // ------- Chat functionality -------
  const enterChat = async () => {
    setView('chat')
    if (messages.length === 0) await loadMessages(true)
  }

  const exitChat = () => {
    setView('game')
  }

  const loadMessages = useCallback(async (initial = false) => {
    try {
      const payload = { action: 'list-messages' }
      if (!initial && lastMessageIdRef.current) payload.after_id = lastMessageIdRef.current
      const resp = await callApi(payload)
      if (Array.isArray(resp.messages) && resp.messages.length > 0) {
        setMessages(prev => {
          const merged = initial ? resp.messages : [...prev, ...resp.messages]
          return merged
        })
        lastMessageIdRef.current = resp.messages[resp.messages.length - 1].id
      }
    } catch (e) {
      console.error('loadMessages', e)
    }
  }, [callApi])

  // Poll chat when active
  useEffect(() => {
    if (view === 'chat') {
      chatPollingRef.current = setInterval(() => {
        loadMessages(false)
      }, 4000)
    } else if (chatPollingRef.current) {
      clearInterval(chatPollingRef.current)
      chatPollingRef.current = null
    }
    return () => {
      if (chatPollingRef.current && view !== 'chat') {
        clearInterval(chatPollingRef.current)
        chatPollingRef.current = null
      }
    }
  }, [view, loadMessages])

  const sendChatMessage = async (e) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    try {
      setChatLoading(true)
      const token = session?.access_token
      if (!token) return
      const resp = await callApi({ action: 'send-message', token, content: chatInput.trim() })
      if (resp.message) {
        setMessages(prev => [...prev, resp.message])
        lastMessageIdRef.current = resp.message.id
      }
      setChatInput('')
    } catch (e) {
      console.error(e)
    } finally {
      setChatLoading(false)
    }
  }

  // Reusable nav (only after game/login)
  const NavBar = () => (
    <div className="nav-bar">
      <button onClick={goGame} className={view === 'game' ? 'active' : ''}>Game</button>
      <button onClick={() => openProfile(username)} className={view.startsWith('profile') ? 'active' : ''}>Profile</button>
      <button onClick={enterChat} className={view === 'chat' ? 'active' : ''}>Chat</button>
      <div className="spacer" />
      <span className="nav-username">{username}</span>
      <button onClick={signOut}>Sign Out</button>
    </div>
  )

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
          <NavBar />
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
                <button type="button" className="user linkish" onClick={() => openProfile(r.username)}>{r.username}</button>
                <span className="score">{r.max_score}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    )
  } else if (view === 'profile') {
    const prof = viewedProfile || myProfile
    content = (
      <div className="layout single">
        <div className="main-game">
          <NavBar />
          <div className="profile-card">
            {!prof && <div>Loading...</div>}
            {prof && (
              <>
                <h2>{prof.username}</h2>
                <div className="profile-grid">
                  <div><span className="k">Max Score:</span> <span className="v">{prof.max_score}</span></div>
                  <div><span className="k">Age:</span> <span className="v">{prof.age ?? '—'}</span></div>
                  <div><span className="k">Gender:</span> <span className="v">{prof.gender || '—'}</span></div>
                  <div className="full"><span className="k">Occupation:</span> <span className="v">{prof.occupation || '—'}</span></div>
                  <div className="full"><span className="k">Address:</span> <span className="v">{prof.address || '—'}</span></div>
                  <div className="full"><span className="k">Motivation:</span> <span className="v">{prof.motivation || '—'}</span></div>
                </div>
                {(!viewedProfile) && <button className="mt" onClick={beginEditProfile}>Edit Profile</button>}
                <button className="link-btn mt" onClick={goGame}>Back to Game</button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  } else if (view === 'profile-edit') {
    content = (
      <div className="layout single">
        <div className="main-game">
          <NavBar />
          <form className="profile-form" onSubmit={saveProfile}>
            <h2>Edit Profile</h2>
            {error && <div className="error">{error}</div>}
            <div className="form-grid">
              <label>Age
                <input type="number" min="0" max="130" value={editAge} onChange={e => setEditAge(e.target.value)} />
              </label>
              <label>Gender
                <input type="text" value={editGender} onChange={e => setEditGender(e.target.value)} />
              </label>
              <label className="col-full">Occupation
                <input type="text" value={editOccupation} onChange={e => setEditOccupation(e.target.value)} />
              </label>
              <label className="col-full">Address
                <input type="text" value={editAddress} onChange={e => setEditAddress(e.target.value)} />
              </label>
              <label className="col-full">Motivation
                <textarea value={editMotivation} onChange={e => setEditMotivation(e.target.value)} rows={3} />
              </label>
            </div>
            <div className="row mt">
              <button type="submit" disabled={loadingAction}>Save</button>
              <button type="button" onClick={cancelEdit} className="secondary">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    )
  } else if (view === 'chat') {
    content = (
      <div className="layout single">
        <div className="main-game">
          <NavBar />
          <div className="chat-wrapper">
            <div className="messages" id="messages-list">
              {messages.map(m => (
                <div key={m.id} className="message">
                  <button type="button" className="author" onClick={() => openProfile(m.username)}>{m.username}</button>
                  <span className="content">{m.content}</span>
                  <span className="time">{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
              ))}
              {messages.length === 0 && <div className="empty">No messages yet.</div>}
            </div>
            <form className="chat-input" onSubmit={sendChatMessage}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} maxLength={500} placeholder="Type a message" />
              <button disabled={chatLoading || !chatInput.trim()}>Send</button>
            </form>
            <button className="link-btn mt" onClick={goGame}>Back to Game</button>
          </div>
        </div>
      </div>
    )
  }

  return <div className="app-shell">{content}</div>
}

export default App
