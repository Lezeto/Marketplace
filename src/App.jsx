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
  const appliedStoredViewRef = useRef(false)
  const viewRef = useRef('loading')
  const didInitialRouteRef = useRef(false)

  // Listings state
  const [publishTitle, setPublishTitle] = useState('')
  const [publishAddress, setPublishAddress] = useState('')
  const [publishPrice, setPublishPrice] = useState('')
  const [publishDescription, setPublishDescription] = useState('')
  const [publishFile, setPublishFile] = useState(null)
  const [publishRegion, setPublishRegion] = useState('')
  const [myListings, setMyListings] = useState([])
  const [allListings, setAllListings] = useState([])
  const [allRegion, setAllRegion] = useState('')
  const [allSearch, setAllSearch] = useState('')
  const [userListings, setUserListings] = useState([])
  const [currentListing, setCurrentListing] = useState(null)
  // DMs state
  const [dmThread, setDmThread] = useState(null)
  const [dmMessages, setDmMessages] = useState([])
  const [dmInput, setDmInput] = useState('')
  const dmLastIdRef = useRef(null)
  const dmPollingRef = useRef(null)
  const [dmThreads, setDmThreads] = useState([])
  const [dmThreadsFilterListingId, setDmThreadsFilterListingId] = useState(null)

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
        // Preserve current view on initial load; we'll restore from localStorage
        await hydrateProfile(client, session, true)
      } else {
        setView('auth')
      }
      client.auth.onAuthStateChange((event, session) => {
        setSession(session)
        if (session) {
          // Preserve current view for non-SIGNED_IN events (e.g., TOKEN_REFRESHED)
          const preserveView = event !== 'SIGNED_IN'
          hydrateProfile(client, session, preserveView)
        } else {
          resetAll()
        }
      })
    })()
  }, [])

  // Keep a live ref of the current view to avoid stale closures
  useEffect(() => { viewRef.current = view }, [view])

  // Persist view to localStorage (except the transient 'loading')
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && view && view !== 'loading') {
        window.localStorage.setItem('app.view', view)
      }
    } catch {}
  }, [view])

  // Restore last view once after login/profile is available
  useEffect(() => {
    if (appliedStoredViewRef.current) return
    if (!session) return
    // If username is required and not set, don't restore a non-username view
    const hasUsername = !!(myProfile?.username || username)
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('app.view') : null
      if (!stored) return
      if (stored === 'loading' || stored === 'auth') return
      if (!hasUsername && stored !== 'username') return
      setView(stored)
      appliedStoredViewRef.current = true
    } catch {}
  }, [session, myProfile?.username, username])

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
    appliedStoredViewRef.current = false
    didInitialRouteRef.current = false
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

  const hydrateProfile = async (client, sess, preserveView = false) => {
    try {
      const token = sess.access_token
      const me = await callApi({ action: 'me', token })
      if (!me.username) {
        setView('username')
        didInitialRouteRef.current = true
      } else {
        setUsername(me.username)
        // store extended profile
        setMyProfile(me)
        if (!preserveView && !didInitialRouteRef.current) {
          // Only push once, and only if coming from auth-related views; don't override active pages like chat/publish
          const v = viewRef.current
          if (v === 'loading' || v === 'auth' || v === 'username' || v === 'profile') {
            setView('profile')
          }
          didInitialRouteRef.current = true
        }
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

  // Auto-load listings for the current profile view
  useEffect(() => {
    if (view === 'profile') {
      const prof = viewedProfile || myProfile
      if (prof?.username) {
        loadUserListings(prof.username)
      }
    }
  }, [view, viewedProfile?.username, myProfile?.username])

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
      // Upload image to Supabase Storage if present
      let uploadedUrl
      if (publishFile && supabase) {
        try {
          const userId = session?.user?.id
          const ext = (() => {
            const n = publishFile.name || ''
            const i = n.lastIndexOf('.')
            return i > -1 ? n.slice(i + 1).toLowerCase() : 'jpg'
          })()
          const rid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2)
          const path = `${userId}/${rid}-${Date.now()}.${ext}`
          const { error: upErr } = await supabase.storage.from('listings2').upload(path, publishFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: publishFile.type || 'image/jpeg'
          })
          if (upErr) throw upErr
          const { data: pub } = supabase.storage.from('listings2').getPublicUrl(path)
          uploadedUrl = pub.publicUrl
        } catch (e) {
          setError(`Image upload failed: ${e.message || e}`)
          setLoadingAction(false)
          return
        }
      }
      const payload = {
        action: 'create-listing',
        token,
        title: publishTitle,
        address: publishAddress,
        price: publishPrice,
        description: publishDescription,
        image_url: uploadedUrl,
        region_code: publishRegion,
      }
      const resp = await callApi(payload)
      // Clear form and navigate to my listings
      setPublishTitle('')
      setPublishAddress('')
      setPublishPrice('')
      setPublishDescription('')
      setPublishFile(null)
  setPublishRegion('')
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

  const loadAllListings = async (regionCode, search) => {
    try {
      const rc = regionCode !== undefined ? regionCode : allRegion
      const qv = search !== undefined ? search : allSearch
      if (regionCode !== undefined) setAllRegion(rc)
      if (search !== undefined) setAllSearch(qv)
      const payload = { action: 'list-all-listings' }
      if (rc) payload.region_code = rc
      if (qv && qv.trim()) payload.q = qv.trim()
      const resp = await callApi(payload)
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

  // ------- Direct Messages (DM) -------
  const startDmWith = async (uname, listingId) => {
    try {
      setLoadingAction(true)
      const token = session?.access_token
      if (!token || !uname) return
      const resp = await callApi({ action: 'start-dm', token, target_username: uname, listing_id: listingId ?? null })
      if (resp.thread) {
        setDmThread(resp.thread)
        setDmMessages([])
        dmLastIdRef.current = null
        setView('dm')
        await loadDmMessages(resp.thread.id, true)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingAction(false)
    }
  }

  const loadDmMessages = useCallback(async (threadId, initial = false) => {
    try {
      const token = session?.access_token
      if (!token || !threadId) return
      const payload = { action: 'list-dm-messages', token, thread_id: threadId }
      if (!initial && dmLastIdRef.current) payload.after_id = dmLastIdRef.current
      const resp = await callApi(payload)
      if (Array.isArray(resp.messages) && resp.messages.length > 0) {
        setDmMessages(prev => initial ? resp.messages : [...prev, ...resp.messages])
        dmLastIdRef.current = resp.messages[resp.messages.length - 1].id
      }
    } catch (e) {
      console.error('loadDmMessages', e)
    }
  }, [callApi, session?.access_token])

  const openThreads = async (listingId = null) => {
    try {
      const token = session?.access_token
      if (!token) return
      setDmThreadsFilterListingId(listingId)
      const payload = { action: 'list-dm-threads', token }
      if (listingId != null) payload.listing_id = listingId
      const resp = await callApi(payload)
      setDmThreads(resp.threads || [])
      setView('dm-threads')
    } catch (e) {
      setError(e.message)
    }
  }

  const sendDm = async (e) => {
    e.preventDefault()
    if (!dmInput.trim() || !dmThread) return
    try {
      const token = session?.access_token
      if (!token) return
      const resp = await callApi({ action: 'send-dm-message', token, thread_id: dmThread.id, content: dmInput.trim() })
      if (resp.message) {
        setDmMessages(prev => [...prev, resp.message])
        dmLastIdRef.current = resp.message.id
        setDmInput('')
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (view === 'dm' && dmThread?.id) {
      dmPollingRef.current = setInterval(() => {
        loadDmMessages(dmThread.id, false)
      }, 4000)
    } else if (dmPollingRef.current) {
      clearInterval(dmPollingRef.current)
      dmPollingRef.current = null
    }
    return () => {
      if (dmPollingRef.current && view !== 'dm') {
        clearInterval(dmPollingRef.current)
        dmPollingRef.current = null
      }
    }
  }, [view, dmThread?.id, loadDmMessages])

  // Reusable nav (only after game/login)
  const NavBar = () => (
    <div className="nav-bar">
      <button onClick={() => openProfile(username)} className={view.startsWith('profile') ? 'active' : ''}>Profile</button>
      <button onClick={enterChat} className={view === 'chat' ? 'active' : ''}>Chat</button>
  <button onClick={() => { loadAllListings('', ''); setView('all-listings') }} className={view === 'all-listings' ? 'active' : ''}>All Listings</button>
      <button onClick={() => { loadMyListings(); setView('my-listings') }} className={view === 'my-listings' ? 'active' : ''}>My Listings</button>
      <button onClick={goPublish} className={view === 'publish' ? 'active' : ''}>Publish</button>
      <div className="spacer" />
      <span className="nav-username">{username}</span>
      <button onClick={signOut}>Sign Out</button>
    </div>
  )

  const REGIONS = [
    { code: 'I', label: 'I – Tarapacá' },
    { code: 'II', label: 'II – Antofagasta' },
    { code: 'III', label: 'III – Atacama' },
    { code: 'IV', label: 'IV – Coquimbo' },
    { code: 'V', label: 'V – Valparaíso' },
    { code: 'RM', label: 'RM – Región Metropolitana de Santiago' },
    { code: 'VI', label: 'VI – O’Higgins' },
    { code: 'VII', label: 'VII – Maule' },
    { code: 'VIII', label: 'VIII – Biobío' },
    { code: 'IX', label: 'IX – La Araucanía' },
    { code: 'X', label: 'X – Los Lagos' },
    { code: 'XI', label: 'XI – Aysén' },
    { code: 'XII', label: 'XII – Magallanes y Antártica' },
    { code: 'XIV', label: 'XIV – Los Ríos' },
    { code: 'XV', label: 'XV – Arica y Parinacota' },
    { code: 'XVI', label: 'XVI – Ñuble' },
  ]

  const regionLabel = (code) => {
    const r = REGIONS.find(r => r.code === code)
    return r ? r.label : code
  }

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
                {(!viewedProfile) && (
                  <div className="row mt">
                    <button onClick={beginEditProfile}>Edit Profile</button>
                    <button className="secondary" onClick={() => openThreads(null)}>Messages</button>
                  </div>
                )}
                {viewedProfile && (
                  <div className="row mt">
                    <button onClick={() => startDmWith(viewedProfile.username)}>
                      Message {viewedProfile.username}
                    </button>
                  </div>
                )}
                <div className="mt">
                  <h3 style={{margin:'0 0 .5rem'}}>Listings by {prof.username}</h3>
                  <div className="listings">
                    {(userListings || []).map(l => (
                      <div key={l.id} className={`listing-row ${l.image_url ? 'has-thumb' : ''}`} onClick={() => openListing(l.id)}>
                        {l.image_url && <img className="thumb" src={l.image_url} alt="" />}
                        <div className="title">{l.title}</div>
                        <div className="price">${l.price}</div>
                        {l.region_code && <span className="chip">{l.region_code}</span>}
                      </div>
                    ))}
                    {(userListings || []).length === 0 && (
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
              <label>Region
                <select value={publishRegion} onChange={e => setPublishRegion(e.target.value)} required>
                  <option value="" disabled>Select region</option>
                  {REGIONS.map(r => (
                    <option key={r.code} value={r.code}>{r.label}</option>
                  ))}
                </select>
              </label>
              <label className="col-full">Address
                <input value={publishAddress} onChange={e => setPublishAddress(e.target.value)} maxLength={200} required />
              </label>
              <label>Price
                <input type="number" step="0.01" min="0" value={publishPrice} onChange={e => setPublishPrice(e.target.value)} required />
              </label>
              <label className="col-full">Image (optional)
                <input type="file" accept="image/*" onChange={e => setPublishFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
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
                <div key={l.id} className={`listing-row ${l.image_url ? 'has-thumb' : ''}`} onClick={() => openListing(l.id)}>
                  {l.image_url && <img className="thumb" src={l.image_url} alt="" />}
                  <div className="title">{l.title}</div>
                  <div className="price">${l.price}</div>
                  {l.region_code && <span className="chip">{l.region_code}</span>}
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
            <div className="row" style={{marginBottom:'.5rem', alignItems:'center', gap:'.5rem', flexWrap:'wrap'}}>
              <div className="row" style={{alignItems:'center', gap:'.4rem'}}>
                <label style={{fontSize:'.7rem', color:'#8b949e'}}>Region</label>
                <select value={allRegion} onChange={e => loadAllListings(e.target.value)} style={{background:'#0d1117', border:'1px solid #30363d', color:'#e6edf3', borderRadius:8, padding:'0.4rem 0.55rem'}}>
                  <option value="">All</option>
                  {REGIONS.map(r => (
                    <option key={r.code} value={r.code}>{r.label}</option>
                  ))}
                </select>
              </div>
              <input
                value={allSearch}
                onChange={e => {
                  const v = e.target.value
                  setAllSearch(v)
                }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); loadAllListings(undefined, allSearch) } }}
                onBlur={() => loadAllListings(undefined, allSearch)}
                placeholder="Search titles..."
                maxLength={120}
                style={{flex:'1 1 220px', minWidth:200, background:'#0d1117', border:'1px solid #30363d', color:'#e6edf3', borderRadius:8, padding:'0.45rem 0.6rem'}}
              />
              <button className="secondary" onClick={() => loadAllListings(undefined, allSearch)}>Search</button>
            </div>
            <div className="listings">
              {allListings.map(l => (
                <div key={l.id} className={`listing-row ${l.image_url ? 'has-thumb' : ''}`} onClick={() => openListing(l.id)}>
                  {l.image_url && <img className="thumb" src={l.image_url} alt="" />}
                  <div className="user">{l.username}</div>
                  <div className="title">{l.title}</div>
                  <div className="price">${l.price}</div>
                  {l.region_code && <span className="chip">{l.region_code}</span>}
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
                {currentListing.image_url && (
                  <img className="listing-image" src={currentListing.image_url} alt="" />
                )}
                <div className="profile-grid">
                  <div><span className="k">Seller:</span> <button className="link-btn" onClick={() => openProfile(currentListing.username)}>{currentListing.username}</button></div>
                  <div><span className="k">Price:</span> <span className="v">${currentListing.price}</span></div>
                  <div><span className="k">Region:</span> <span className="v">{regionLabel(currentListing.region_code)}</span></div>
                  <div className="full"><span className="k">Address:</span> <span className="v">{currentListing.address}</span></div>
                  <div className="full"><span className="k">Description:</span> <span className="v">{currentListing.description}</span></div>
                </div>
                <div className="row mt">
                  <button className="secondary" onClick={() => setView('all-listings')}>Back to All</button>
                  {currentListing.username !== username ? (
                    <button onClick={() => startDmWith(currentListing.username, currentListing.id)}>Message seller</button>
                  ) : (
                    <button onClick={() => openThreads(currentListing.id)}>View messages</button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }
  else if (view === 'dm-threads') {
    content = (
      <div className="layout single">
        <div className="main-game">
          <NavBar />
          <div className="profile-card">
            <h2>Messages</h2>
            {dmThreadsFilterListingId != null && (
              <div className="empty">Filtered for listing #{dmThreadsFilterListingId}</div>
            )}
            <div className="listings">
              {dmThreads.map(t => (
                <div key={t.id} className="listing-row" onClick={() => { setDmThread(t); setDmMessages([]); dmLastIdRef.current = null; setView('dm'); loadDmMessages(t.id, true); }}>
                  <div className="title">Chat with {t.other_username}</div>
                  {t.listing_id && <span className="chip">#{t.listing_id}</span>}
                </div>
              ))}
              {dmThreads.length === 0 && <div className="empty">No conversations yet.</div>}
            </div>
            <button className="link-btn mt" onClick={() => setView('profile')}>Back</button>
          </div>
        </div>
      </div>
    )
  }
  else if (view === 'dm') {
    content = (
      <div className="layout single">
        <div className="main-game">
          <NavBar />
          <div className="chat-wrapper">
            <h2>Chat with {dmThread?.other_username}</h2>
            <div className="messages">
              {dmMessages.map(m => (
                <div key={m.id} className="message">
                  <span className="author">{m.sender_username}</span>
                  <span className="content">{m.content}</span>
                  <span className="time">{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
              ))}
              {dmMessages.length === 0 && <div className="empty">No messages yet.</div>}
            </div>
            <form className="chat-input" onSubmit={sendDm}>
              <input value={dmInput} onChange={e => setDmInput(e.target.value)} maxLength={1000} placeholder={`Message ${dmThread?.other_username || ''}`} />
              <button disabled={!dmInput.trim()}>Send</button>
            </form>
            <button className="link-btn mt" onClick={() => setView('profile')}>Back</button>
          </div>
        </div>
      </div>
    )
  }

  return <div className="app-shell">{content}</div>
}

export default App
