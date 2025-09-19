import { useEffect, useState, useCallback, useRef } from 'react'
import './App.css'

// We will interact with a serverless function at /api/gamexapi (Vercel) or relative path locally.
// Supabase client will be dynamically imported to avoid SSR issues if deployed.

function App() {
  const [view, setView] = useState('loading') // loading | auth | username | profile | profile-edit | chat | publish | my-listings | all-listings | listing-detail
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [desiredUsername, setDesiredUsername] = useState('')
  const [session, setSession] = useState(null)
  // Removed maxScore (was used by the old game)
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
  const [notice, setNotice] = useState('')
  const lastMessageIdRef = useRef(null)
  const chatPollingRef = useRef(null)

  // Listings state
  const [publishTitle, setPublishTitle] = useState('')
  const [publishAddress, setPublishAddress] = useState('')
  const [publishPrice, setPublishPrice] = useState('')
  const [publishDescription, setPublishDescription] = useState('')
  const [myListings, setMyListings] = useState([])
  const [allListings, setAllListings] = useState([])
  const [userListings, setUserListings] = useState([])
  const [currentListing, setCurrentListing] = useState(null)

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
  // no-op: max score removed
    setMyProfile(null)
    setViewedProfile(null)
    setMessages([])
    setPublishTitle('')
    setPublishAddress('')
    setPublishPrice('')
    setPublishDescription('')
    setMyListings([])
    setAllListings([])
    setUserListings([])
    setCurrentListing(null)
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
        // store extended profile
        setMyProfile(me)
        setView('profile')
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
    const siteUrl = import.meta.env.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : undefined)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: siteUrl }
    })
    if (error) setError(error.message)
    else if (data.user) {
      setNotice('Check your email to confirm your account, then return here. If you do not see it, check spam.')
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
      setView('profile')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingAction(false)
    }
  }


  const signOut = async () => {
    await supabase.auth.signOut()
  }

  // ------- Navigation helpers -------
  const goProfile = () => { setView('profile'); setViewedProfile(null) }
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
    setView('profile')
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

  // ------- Listings functionality -------
  const goPublish = () => setView('publish')

  const createListing = async (e) => {
    e.preventDefault()
    try {
      setLoadingAction(true)
      setError('')
      const token = session?.access_token
      if (!token) return
      const payload = {
        action: 'create-listing',
        token,
        title: publishTitle,
        address: publishAddress,
        price: publishPrice,
        description: publishDescription,
      }
      const resp = await callApi(payload)
      // Clear form and navigate to my listings
      setPublishTitle('')
      setPublishAddress('')
      setPublishPrice('')
      setPublishDescription('')
      await loadMyListings()
      setView('my-listings')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingAction(false)
    }
  }

  const loadMyListings = async () => {
    try {
      const token = session?.access_token
      if (!token) return
      const resp = await callApi({ action: 'list-my-listings', token })
      setMyListings(resp.listings || [])
    } catch (e) {
      console.error(e)
    }
  }

  const loadAllListings = async () => {
    try {
      const resp = await callApi({ action: 'list-all-listings' })
      setAllListings(resp.listings || [])
    } catch (e) {
      console.error(e)
    }
  }

  const loadUserListings = async (uname) => {
    try {
      const resp = await callApi({ action: 'list-user-listings', username: uname })
      setUserListings(resp.listings || [])
    } catch (e) {
      console.error(e)
    }
  }

  const openListing = async (id) => {
    try {
      setLoadingAction(true)
      const resp = await callApi({ action: 'get-listing', id })
      setCurrentListing(resp.listing)
      setView('listing-detail')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingAction(false)
    }
  }

  // Reusable nav (only after game/login)
  const NavBar = () => (
    <div className="nav-bar">
      <button onClick={() => openProfile(username)} className={view.startsWith('profile') ? 'active' : ''}>Profile</button>
      <button onClick={enterChat} className={view === 'chat' ? 'active' : ''}>Chat</button>
      <button onClick={() => { loadAllListings(); setView('all-listings') }} className={view === 'all-listings' ? 'active' : ''}>All Listings</button>
      <button onClick={() => { loadMyListings(); setView('my-listings') }} className={view === 'my-listings' ? 'active' : ''}>My Listings</button>
      <button onClick={goPublish} className={view === 'publish' ? 'active' : ''}>Publish</button>
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
  <h1>Community Space</h1>
  <p className="tagline">Sign in to edit your profile and chat with others.</p>
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
          {notice && <div style={{marginTop:'0.5rem', fontSize:'0.85rem', color:'#8b949e'}}>{notice}</div>}
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
                  <div><span className="k">Age:</span> <span className="v">{prof.age ?? '—'}</span></div>
                  <div><span className="k">Gender:</span> <span className="v">{prof.gender || '—'}</span></div>
                  <div className="full"><span className="k">Occupation:</span> <span className="v">{prof.occupation || '—'}</span></div>
                  <div className="full"><span className="k">Address:</span> <span className="v">{prof.address || '—'}</span></div>
                  <div className="full"><span className="k">Motivation:</span> <span className="v">{prof.motivation || '—'}</span></div>
                </div>
                {(!viewedProfile) && <button className="mt" onClick={beginEditProfile}>Edit Profile</button>}
                <div className="mt">
                  <h3 style={{margin:'0 0 .5rem'}}>Listings by {prof.username}</h3>
                  <button className="link-btn" onClick={() => { loadUserListings(prof.username); setView('profile') }}>Refresh</button>
                  <div className="listings">
                    {(userListings || []).filter(l => l.username === prof.username).map(l => (
                      <div key={l.id} className="listing-row" onClick={() => openListing(l.id)}>
                        <div className="title">{l.title}</div>
                        <div className="price">${l.price}</div>
                      </div>
                    ))}
                    {userListings && userListings.filter(l => l.username === prof.username).length === 0 && (
                      <div className="empty">No listings yet.</div>
                    )}
                  </div>
                </div>
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
            <button className="link-btn mt" onClick={goProfile}>Back</button>
          </div>
        </div>
      </div>
    )
  }
  else if (view === 'publish') {
    content = (
      <div className="layout single">
        <div className="main-game">
          <NavBar />
          <form className="profile-form" onSubmit={createListing}>
            <h2>Publish Listing</h2>
            {error && <div className="error">{error}</div>}
            <div className="form-grid">
              <label className="col-full">Title
                <input value={publishTitle} onChange={e => setPublishTitle(e.target.value)} maxLength={120} required />
              </label>
              <label className="col-full">Address
                <input value={publishAddress} onChange={e => setPublishAddress(e.target.value)} maxLength={200} required />
              </label>
              <label>Price
                <input type="number" step="0.01" min="0" value={publishPrice} onChange={e => setPublishPrice(e.target.value)} required />
              </label>
              <label className="col-full">Description
                <textarea rows={4} value={publishDescription} onChange={e => setPublishDescription(e.target.value)} maxLength={2000} required />
              </label>
            </div>
            <div className="row mt">
              <button type="submit" disabled={loadingAction}>Publish</button>
              <button type="button" className="secondary" onClick={() => setView('profile')}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    )
  }
  else if (view === 'my-listings') {
    content = (
      <div className="layout single">
        <div className="main-game">
          <NavBar />
          <div className="profile-card">
            <h2>My Listings</h2>
            <div className="listings">
              {myListings.map(l => (
                <div key={l.id} className="listing-row" onClick={() => openListing(l.id)}>
                  <div className="title">{l.title}</div>
                  <div className="price">${l.price}</div>
                </div>
              ))}
              {myListings.length === 0 && <div className="empty">No listings yet.</div>}
            </div>
          </div>
        </div>
      </div>
    )
  }
  else if (view === 'all-listings') {
    content = (
      <div className="layout single">
        <div className="main-game">
          <NavBar />
          <div className="profile-card">
            <h2>All Listings</h2>
            <div className="listings">
              {allListings.map(l => (
                <div key={l.id} className="listing-row" onClick={() => openListing(l.id)}>
                  <div className="user">{l.username}</div>
                  <div className="title">{l.title}</div>
                  <div className="price">${l.price}</div>
                </div>
              ))}
              {allListings.length === 0 && <div className="empty">No listings found.</div>}
            </div>
          </div>
        </div>
      </div>
    )
  }
  else if (view === 'listing-detail') {
    content = (
      <div className="layout single">
        <div className="main-game">
          <NavBar />
          <div className="profile-card">
            {!currentListing && <div>Loading...</div>}
            {currentListing && (
              <>
                <h2>{currentListing.title}</h2>
                <div className="profile-grid">
                  <div><span className="k">Seller:</span> <button className="link-btn" onClick={() => openProfile(currentListing.username)}>{currentListing.username}</button></div>
                  <div><span className="k">Price:</span> <span className="v">${currentListing.price}</span></div>
                  <div className="full"><span className="k">Address:</span> <span className="v">{currentListing.address}</span></div>
                  <div className="full"><span className="k">Description:</span> <span className="v">{currentListing.description}</span></div>
                </div>
                <button className="link-btn mt" onClick={() => setView('all-listings')}>Back to All</button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return <div className="app-shell">{content}</div>
}

export default App
