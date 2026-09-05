"use client"
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSupabaseSession } from '../hooks/use-supabase-session'
import { useAccountState } from '../hooks/use-account-state'
import { ApiAuthenticationError, authenticatedFetch } from '../utils/api-client'
import { userScopedStorageKey } from '../utils/user-scoped-state'

type Msg = { role: 'user' | 'assistant' | 'system'; text: string; id?: string; subject?: string; mode?: string; targetId?: string }
type Project = { id: string; title: string; description: string; subject: string; created_at?: string; updated_at?: string }
type PlanTopic = { id?: string; week_number: number; title: string; lesson?: string; exercise?: string; completed: boolean; sort_order?: number }
type StudyPlan = { id: string; title: string; objective: string; subject: string; learner_level: string; estimated_duration: string; schedule: string; project_id?: string | null; study_plan_topics?: PlanTopic[] }
type ProjectContext = { projectId: string; projectName: string; subject?: string; studyPlanId?: string | null }
type Conversation = { id: string; title: string; created_at: string; updated_at: string }

type TutorName = 'Nira' | 'Elara' | 'Solara'

const TUTORS: Array<{ name: TutorName; mode: string; description: string }> = [
  { name: 'Nira', mode: 'nira', description: 'Balanced guidance' },
  { name: 'Elara', mode: 'elara', description: 'Structured analysis' },
  { name: 'Solara', mode: 'solara', description: 'Idea generation' }
]

function tutorForMode(value: string): TutorName {
  const normalized = value.toLowerCase()
  if (normalized === 'elara' || normalized === 'research') return 'Elara'
  if (normalized === 'solara' || normalized === 'creative') return 'Solara'
  return 'Nira'
}

function modeForTutor(name: TutorName) {
  return TUTORS.find((tutor) => tutor.name === name)?.mode || 'nira'
}

function Icon({ name }: { name: 'menu' | 'sun' | 'moon' | 'mic' | 'stop' | 'plus' | 'home' | 'chat' | 'folder' | 'book' | 'spark' | 'settings' | 'user' | 'logout' | 'search' | 'paperclip' | 'arrow-up' }) {
  const paths = {
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>,
    moon: <path d="M20.4 15.6A8.5 8.5 0 0 1 8.4 3.6 8.5 8.5 0 1 0 20.4 15.6Z" />,
    mic: <><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" /><path d="M19 11v1a7 7 0 0 1-14 0v-1M12 19v3M9 22h6" /></>,
    stop: <rect x="7" y="7" width="10" height="10" rx="1" />,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    chat: <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.4-.7L4 20l1.7-3.8A7.3 7.3 0 0 1 4.5 12 7.5 7.5 0 0 1 12 4.5a7.5 7.5 0 0 1 8 7Z" />,
    folder: <path d="M3 6.5h7l2 2h9v9.8a1.7 1.7 0 0 1-1.7 1.7H4.7A1.7 1.7 0 0 1 3 18.3V6.5Z" />,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /></>,
    spark: <><path d="m12 3 1.3 4.7L18 9l-4.7 1.3L12 15l-1.3-4.7L6 9l4.7-1.3L12 3Z" /><path d="m19 15 .6 2.4L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.6L19 15Z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L8 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6.7v-2.4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L8 8.6l1.7-1.7.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h2.4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.7 1.7-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.5 1Z" /></>,
    user: <><circle cx="12" cy="8" r="3" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.5 4.5" /></>,
    paperclip: <path d="m20.5 11.5-7.8 7.8a5 5 0 0 1-7.1-7.1l8.2-8.2a3.4 3.4 0 0 1 4.8 4.8l-8.3 8.3a1.8 1.8 0 0 1-2.5-2.5l7.8-7.8" />,
    'arrow-up': <><path d="M12 19V5M6 11l6-6 6 6" /></>
  }
  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

if (!API_URL) {
  throw new Error('Missing NEXT_PUBLIC_API_URL in environment variables')
}

const FRANCES_NAME = 'Frances'
const FRANCES_DESCRIPTION = "A special girl's name you're mentioning"
const IDENTITY_PHRASE = 'Lumora Cognita was created by Lumora Technologies.'

function normalizeQuestion(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, ' ')
    .replace(/[?!.]+$/, '')
}

export default function Page() {
  const { session, loading: authLoading, error: authError, signIn, signUp, signOut } = useSupabaseSession()
  const { account, updateProfile } = useAccountState(session, API_URL!)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authFormError, setAuthFormError] = useState<string | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const previousUserIdRef = useRef<string | null>(null)
  const [theme, setTheme] = useState<string>(() => {
    try { return localStorage.getItem('lumora_theme') || 'light' } catch { return 'light' }
  })
  const [showStats, setShowStats] = useState(false)
  const [workspaceView, setWorkspaceView] = useState<'chat' | 'projects' | 'plans'>('chat')
  const [projects, setProjects] = useState<Project[]>([])
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<StudyPlan | null>(null)
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [projectTitle, setProjectTitle] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectSubject, setProjectSubject] = useState('')
  const [projectLoading, setProjectLoading] = useState(false)
  const [studyPlanLoading, setStudyPlanLoading] = useState(false)
  const [projectTab, setProjectTab] = useState<'overview' | 'chats' | 'study-plan' | 'resources' | 'progress' | 'files'>('overview')
  const [activeProjectContext, setActiveProjectContext] = useState<ProjectContext | null>(null)
  const [planTitle, setPlanTitle] = useState('')
  const [planObjective, setPlanObjective] = useState('')
  const [planSubject, setPlanSubject] = useState('')
  const [planLevel, setPlanLevel] = useState('beginner')
  const [planTopics, setPlanTopics] = useState('')
  const [planProjectId, setPlanProjectId] = useState<string | undefined>(undefined)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)

  const defaultStats = { totalMessages: 0, responses: 0, understood: 0, subjects: {} as Record<string, { messages: number; understood: number }> }
  const [stats, setStats] = useState(() => defaultStats)
  const [messages, setMessages] = useState<Msg[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationSearch, setConversationSearch] = useState('')
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<string>('chat')
  const [activeMode, setActiveMode] = useState<string>(() => {
    try { return localStorage.getItem('lumora_mode') || 'nira' } catch { return 'nira' }
  })
  const [subject, setSubject] = useState<string>('mathematics')
  const [isThinking, setIsThinking] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const lastMessageRef = useRef<HTMLDivElement | null>(null)
  const recognitionRef = useRef<any>(null)
  const [micState, setMicState] = useState<'idle'|'listening'|'processing'|'error'>('idle')
  const [micError, setMicError] = useState<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const animationRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const barsRef = useRef<HTMLDivElement | null>(null)
  const preRecordingInputRef = useRef<string>('')
  const lastInterimRef = useRef<string>('')
  const voiceTimingRef = useRef<Record<string, number>>({})
  function markTiming(name: string) {
    try {
      if (!voiceTimingRef.current) voiceTimingRef.current = {}
      voiceTimingRef.current[name] = Date.now()
      console.log('[voice]', name, voiceTimingRef.current[name])
    } catch (e) {}
  }
  // Speech buffering and VAD refs
  const finalTranscriptRef = useRef<string>('')
  const interimTranscriptRef = useRef<string>('')
  const listeningActiveRef = useRef<boolean>(false)
  const userInitiatedStopRef = useRef<boolean>(false)
  const vadIntervalRef = useRef<number | null>(null)
  const lastVoiceTimeRef = useRef<number>(0)
  const SILENCE_TIMEOUT_MS = 3500 // 2.5-4s recommended
  const VAD_CHECK_INTERVAL_MS = 150
  const VAD_AMPLITUDE_THRESHOLD = 0.012
  const RESTART_DELAY_MS = 300

  function dedupeAppendFinal(newPart: string) {
    try {
      const np = (newPart || '').trim()
      if (!np) return
      const existing = (finalTranscriptRef.current || '').trim()
      if (!existing) { finalTranscriptRef.current = np; return }
      const exWords = existing.split(/\s+/).filter(Boolean)
      const newWords = np.split(/\s+/).filter(Boolean)
      const maxCheck = Math.min(exWords.length, newWords.length, 6)
      let overlap = 0
      for (let k = maxCheck; k > 0; k--) {
        const exSuffix = exWords.slice(exWords.length - k).join(' ').toLowerCase()
        const newPrefix = newWords.slice(0, k).join(' ').toLowerCase()
        if (exSuffix === newPrefix) { overlap = k; break }
      }
      const toAppend = newWords.slice(overlap).join(' ')
      finalTranscriptRef.current = (existing + (toAppend ? ' ' + toAppend : '')).trim()
    } catch (e) {}
  }

  function startVADMonitor() {
    if (vadIntervalRef.current) return
    lastVoiceTimeRef.current = Date.now()
    vadIntervalRef.current = window.setInterval(() => {
      try {
        const analyser = analyserRef.current
        if (!analyser) return
        const buf = new Uint8Array(analyser.fftSize || 2048)
        analyser.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / buf.length)
        if (rms > VAD_AMPLITUDE_THRESHOLD) {
          lastVoiceTimeRef.current = Date.now()
          try { if (!voiceTimingRef.current.speechDetected) markTiming('speechDetected') } catch (e) {}
        } else {
          if (listeningActiveRef.current && Date.now() - lastVoiceTimeRef.current > SILENCE_TIMEOUT_MS) {
            // considered silence — gracefully stop recognition to finalize
            userInitiatedStopRef.current = true
            try { recognitionRef.current && recognitionRef.current.stop() } catch (e) {}
          }
        }
      } catch (e) {}
    }, VAD_CHECK_INTERVAL_MS)
  }

  function stopVADMonitor() {
    if (vadIntervalRef.current) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null }
  }
  async function sendVoiceMetrics(extra: Record<string, any> = {}) {
    try {
      if (!API_URL) return
      if (!session?.access_token) return
      if (!voiceTimingRef.current || Object.keys(voiceTimingRef.current).length === 0) return
      const payload = { client: 'web', metrics: voiceTimingRef.current, extra }
      // best-effort POST; do not await
      authenticatedFetch(`${API_URL}/admin/voice-metrics`, session, {
        method: 'POST',
        body: JSON.stringify(payload)
      }).catch((err) => console.warn('voice metrics post failed', err))
    } catch (e) { console.warn('sendVoiceMetrics failed', e) }
  }
  const search = useSearchParams()
  const [envError, setEnvError] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && API_URL) {
        try {
          const u = new URL(API_URL)
          const isLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
          if (isLocal && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            const msg = 'This build was exported with NEXT_PUBLIC_API_URL set to a localhost address. Rebuild with a production backend URL to enable API calls.'
            console.error('[env-mismatch]', msg, API_URL)
            setEnvError(msg)
          }
        } catch (e) {
          // ignore URL parse errors
        }
      }
    } catch (e) {}
  }, [])

  useEffect(() => {
    async function load() {
      if (!session) {
        try { localStorage.removeItem('lumora_anonymous_messages') } catch {}
        setMessages([])
        return
      }
      try {
        const res = await authenticatedFetch(`${API_URL!}/history`, session)
        const data = await res.json()
        if (data?.ok && Array.isArray(data.history)) {
          setConversationId(data.conversationId || null)
          setMessages(data.history.map((m: any) => ({ role: m.role, text: m.text })))
        }
      } catch (err) {
        console.warn('failed to load history', err)
      }

      const pre = search?.get('prefill')
      if (pre) {
        setInput(decodeURIComponent(pre))
        setTimeout(() => {
          setInput(decodeURIComponent(pre))
          handleSend()
        }, 250)
      }
    }
    load()
  }, [search, session])

  useEffect(() => {
    async function loadConversations() {
      if (!session) {
        setConversations([])
        return
      }
      try {
        const query = conversationSearch.trim() ? `?search=${encodeURIComponent(conversationSearch.trim())}` : ''
        const res = await authenticatedFetch(`${API_URL!}/conversations${query}`, session)
        const data = await res.json()
        if (data?.ok && Array.isArray(data.conversations)) setConversations(data.conversations)
      } catch (err) {
        console.warn('failed to load conversations', err)
      }
    }
    loadConversations()
  }, [conversationSearch, session?.user.id, session?.access_token])

  useEffect(() => {
    if (!session) {
      try {
        const nextProjects = JSON.parse(localStorage.getItem('lumora_anonymous_projects') || '[]')
        const nextPlans = JSON.parse(localStorage.getItem('lumora_anonymous_study_plans') || '[]')
        setProjects(nextProjects)
        setStudyPlans(nextPlans)
        if (selectedProject && !nextProjects.some((project: Project) => project.id === selectedProject.id)) {
          setSelectedProject(null)
          setActiveProjectContext(null)
        }
      } catch { setProjects([]); setStudyPlans([]) }
      return
    }

    setProjectLoading(true)
    setStudyPlanLoading(true)
    Promise.all([
      authenticatedFetch(`${API_URL}/projects`, session).then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Projects unavailable')
        return data.projects || []
      }),
      authenticatedFetch(`${API_URL}/study-plans`, session).then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Study plans unavailable')
        return data.studyPlans || []
      })
    ]).then(([nextProjects, nextPlans]) => {
      setProjects(nextProjects)
      setStudyPlans(nextPlans)
      if (selectedProject) {
        const projectMatch = nextProjects.find((project: Project) => project.id === selectedProject.id)
        if (projectMatch) {
          const currentPlan = nextPlans.find((plan: StudyPlan) => plan.project_id === projectMatch.id)
          setActiveProjectContext({
            projectId: projectMatch.id,
            projectName: projectMatch.title,
            subject: projectMatch.subject || currentPlan?.subject,
            studyPlanId: currentPlan?.id || null
          })
        }
      }
    }).catch((error) => {
      setWorkspaceError(error instanceof Error ? error.message : 'Workspace data unavailable')
    }).finally(() => {
      setProjectLoading(false)
      setStudyPlanLoading(false)
    })
  }, [session])

  useEffect(() => {
    const nextUserId = session?.user.id || null
    if (previousUserIdRef.current !== null && previousUserIdRef.current !== nextUserId) {
      setMessages([])
      setConversationId(null)
      setInput('')
      setStats(defaultStats)
    }
    previousUserIdRef.current = nextUserId
  }, [session?.user.id])

  useEffect(() => {
    try { localStorage.setItem('lumora_mode', activeMode) } catch {}
  }, [activeMode])

  useEffect(() => {
    if (!session?.user.id) {
      setStats(defaultStats)
      return
    }
    try {
      const s = localStorage.getItem(userScopedStorageKey('lumora_stats', session.user.id)!)
      if (s) setStats(JSON.parse(s))
      else setStats(defaultStats)
    } catch (e) {}
    try {
      document.documentElement.classList.toggle('light-theme', theme === 'light')
    } catch (e) {}
  }, [session?.user.id])

  useEffect(() => {
    try { localStorage.setItem('lumora_theme', theme); document.documentElement.classList.toggle('light-theme', theme === 'light') } catch {}
  }, [theme])

  function isComplexResponse(text: string) {
    if (!text) return false
    const t = text.trim()
    if (t.length > 350) return true
    if (/```/.test(t)) return true
    if (/^\d+\./m.test(t)) return true
    if (/\bstep[s]?\b/i.test(t)) return true
    return false
  }

  function maybeAskUnderstandingCheck(originalMsg: Msg, isEdu: boolean) {
    try {
      if (!isEdu) return
      if (activeMode !== 'research' && originalMsg?.mode !== 'research') return
      const COOLDOWN_MS = 1000 * 60 * 5
      const last = (stats && (stats as any).lastCheckAt) || 0
      if (last && last > Date.now() - COOLDOWN_MS) return
      if (originalMsg && /\?\s*$/.test((originalMsg.text || '').trim())) return
      const PROB = 2 / 9
      if (Math.random() > PROB) return
      const checkText = 'Would you like a brief recap or a deeper explanation on any point?'
      const checkMsg: Msg = { role: 'assistant', text: checkText, id: `check-${Date.now()}`, subject: originalMsg.subject, mode: originalMsg.mode }
      setMessages((m) => [...m, checkMsg])
      saveStats((prev: any) => { const next = { ...prev }; next.checksAsked = (next.checksAsked || 0) + 1; next.lastCheckAt = Date.now(); return next })
    } catch (e) {}
  }

  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, isThinking])

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      recognitionRef.current = null
      return
    }
    try {
      const r = new SpeechRecognition()
      r.lang = 'en-US'
      r.interimResults = true
      r.continuous = true
      r.maxAlternatives = 1

      r.onstart = () => {
        setIsRecording(true)
        setMicState('listening')
        setMicError(null)
        listeningActiveRef.current = true
        userInitiatedStopRef.current = false
        lastVoiceTimeRef.current = Date.now()
        try { voiceTimingRef.current = {}; markTiming('micStart'); voiceTimingRef.current.sessionId = Date.now() } catch (e) {}
      }

      r.onresult = (ev: any) => {
        try {
          let interim = ''
          for (let i = ev.resultIndex; i < ev.results.length; ++i) {
            const res = ev.results[i]
            const t = (res[0] && res[0].transcript) || ''
            if (res.isFinal) {
              dedupeAppendFinal(t)
            } else {
              interim += (interim ? ' ' : '') + t
            }
          }
          interim = interim.trim()
          interimTranscriptRef.current = interim
          lastInterimRef.current = interim
          try { if (interim && !voiceTimingRef.current.firstInterim) markTiming('firstInterim') } catch (e) {}
          const base = (preRecordingInputRef.current || '').trim()
          const combined = [base, finalTranscriptRef.current, interimTranscriptRef.current].filter(Boolean).join(' ')
          setInput(combined)
        } catch (e) {}
      }

      r.onend = () => {
        try {
          // If we intentionally stopped (user or silence), finalize
          if (userInitiatedStopRef.current) {
            setIsRecording(false)
            setMicState('processing')
            stopVADMonitor()
            stopAnalyser()
            if (streamRef.current) { try { streamRef.current.getTracks().forEach((t: any) => t.stop()) } catch (_) {} streamRef.current = null }
            try { markTiming('transcriptReady') } catch (e) {}
            const base = (preRecordingInputRef.current || '').trim()
            const finalText = [base, finalTranscriptRef.current, interimTranscriptRef.current].filter(Boolean).join(' ').trim()
            setInput(finalText)
            userInitiatedStopRef.current = false
            listeningActiveRef.current = false
            setTimeout(() => setMicState('idle'), 600)
            return
          }
        } catch (e) {}

        // Unexpected end while still supposed to be listening — attempt quick restart
        if (listeningActiveRef.current) {
          setTimeout(() => {
            try { recognitionRef.current && recognitionRef.current.start() } catch (e) { console.warn('restart failed', e) }
          }, RESTART_DELAY_MS)
        } else {
          setIsRecording(false)
          setMicState('idle')
        }
      }

      r.onerror = (e: any) => {
        console.warn('Speech recognition error', e)
        setMicError(e?.message || e?.error || 'Recognition error')
        setMicState('error')
        setIsRecording(false)
        stopVADMonitor()
        stopAnalyser()
      }

      recognitionRef.current = r
    } catch (e) {
      recognitionRef.current = null
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (vadIntervalRef.current) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null }
      if (streamRef.current) { try { streamRef.current.getTracks().forEach((t: any) => t.stop()) } catch (_) {} streamRef.current = null }
      if (audioContextRef.current) { try { audioContextRef.current.close() } catch (_) {} audioContextRef.current = null }
    }
  }, [])

  // Audio analyser + waveform helpers
  function startAnalyser(stream: MediaStream) {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ac = new AudioCtx()
      audioContextRef.current = ac
      const source = ac.createMediaStreamSource(stream)
      const analyser = ac.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      analyserRef.current = analyser
      const bufferLength = analyser.frequencyBinCount
      dataArrayRef.current = new Uint8Array(bufferLength)

      const draw = () => {
        if (!analyserRef.current || !dataArrayRef.current || !barsRef.current) {
          animationRef.current = requestAnimationFrame(draw)
          return
        }
        // TS DOM typings can mismatch between ArrayBuffer/SharedArrayBuffer across TS versions.
        // The runtime value is a Uint8Array backed by an ArrayBuffer; ignore the strict check here.
        // @ts-ignore
        analyserRef.current.getByteTimeDomainData(dataArrayRef.current as any)
        const bars = Array.from(barsRef.current.children) as HTMLElement[]
        const step = Math.max(1, Math.floor(dataArrayRef.current.length / bars.length))
        for (let i = 0; i < bars.length; i++) {
          let sum = 0
          for (let j = 0; j < step; j++) {
            sum += Math.abs(dataArrayRef.current[i * step + j] - 128)
          }
          const avg = sum / step
          const height = Math.max(4, Math.min(40, (avg / 128) * 40))
          bars[i].style.height = `${height}px`
          bars[i].style.opacity = `${0.3 + (height / 40) * 0.7}`
        }
        animationRef.current = requestAnimationFrame(draw)
      }
      animationRef.current = requestAnimationFrame(draw)
    } catch (e) {
      console.warn('startAnalyser failed', e)
    }
  }

  function stopAnalyser() {
    stopVADMonitor()
    if (animationRef.current) { cancelAnimationFrame(animationRef.current); animationRef.current = null }
    if (analyserRef.current) { try { analyserRef.current.disconnect() } catch (e) {} analyserRef.current = null }
    if (audioContextRef.current) { try { audioContextRef.current.close() } catch (e) {} audioContextRef.current = null }
    dataArrayRef.current = null
  }

  const startRecording = useCallback(async () => {
    if (isRecording) return
    setMicError(null)
    preRecordingInputRef.current = input || ''
    finalTranscriptRef.current = ''
    interimTranscriptRef.current = ''
    userInitiatedStopRef.current = false
    listeningActiveRef.current = true
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMicError('Speech recognition not supported in this browser')
      setMicState('error')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      startAnalyser(stream)
      startVADMonitor()
      try { recognitionRef.current.start() } catch (e) { console.warn('recognition.start failed', e) }
      setIsRecording(true)
      setMicState('listening')
    } catch (err) {
      console.warn('startRecording failed', err)
      setMicError((err as any)?.message || 'Microphone access denied')
      setMicState('error')
      setIsRecording(false)
      if (streamRef.current) { try { streamRef.current.getTracks().forEach((t) => t.stop()) } catch (_) {} streamRef.current = null }
      stopAnalyser()
    }
  }, [input, isRecording])

  const stopRecording = useCallback(() => {
    if (!recognitionRef.current) return
    userInitiatedStopRef.current = true
    try {
      recognitionRef.current.stop()
    } catch (e) {
      console.warn('stopRecording failed', e)
    }
    // actual analyser/stream cleanup handled in recognition.onend
  }, [])

  function interceptSpecialQuestions(text: string): string | null {
    const n = normalizeQuestion(text)
    if (['who created you', 'who made you', 'who is your developer'].includes(n)) {
      return IDENTITY_PHRASE
    }
    if (n === 'who is frances' || n === `who is ${FRANCES_NAME.toLowerCase()}`) {
      return FRANCES_DESCRIPTION
    }
    if (n.includes('who is bastoni')) {
      return 'He is my maker.'
    }
    return null
  }

  function renderParsedText(text: string) {
    if (!text) return null
    const lines = text.replace(/\r/g, '').split('\n')
    const nodes: React.ReactNode[] = []
    let i = 0
    while (i < lines.length) {
      const raw = lines[i]
      const line = raw.trim()
      if (line === '') {
        nodes.push(<div key={`br-${i}`} style={{ height: 8 }} />)
        i++
        continue
      }
      if (/^[-\*\+]\s+/.test(line)) {
        const items: string[] = []
        while (i < lines.length && /^[-\*\+]\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^[-\*\+]\s+/, ''))
          i++
        }
        nodes.push(
          <ul key={`ul-${i}`}>
            {items.map((it, idx) => (
              <li key={idx} className="whitespace-pre-line">
                {it}
              </li>
            ))}
          </ul>
        )
        continue
      }
      if (/^\d+[\.)]\s+/.test(line)) {
        const items: string[] = []
        while (i < lines.length && /^\d+[\.)]\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^\d+[\.)]\s+/, ''))
          i++
        }
        nodes.push(
          <ol key={`ol-${i}`}>
            {items.map((it, idx) => (
              <li key={idx} className="whitespace-pre-line">
                {it}
              </li>
            ))}
          </ol>
        )
        continue
      }
      const paraLines: string[] = []
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !/^[-\*\+]\s+/.test(lines[i].trim()) &&
        !/^\d+[\.)]\s+/.test(lines[i].trim())
      ) {
        paraLines.push(lines[i])
        i++
      }
      const paraText = paraLines.join(' ').trim()
      nodes.push(
        <p key={`p-${i}`} className="whitespace-pre-line">
          {paraText}
        </p>
      )
    }
    return <div>{nodes}</div>
  }

  async function handleSend() {
    const text = input.trim()
    if (!text) return
    const norm = text.toLowerCase().trim()
    const blockedPos = ['i understood', 'i understand', 'understood', 'got it', 'i got it']
    const blockedNeg = ["i didn't understand", 'i didnt understand', "didn't understand", 'didnt understand', "i don't understand", 'i do not understand', 'did not understand']
    if (blockedPos.includes(norm) || blockedNeg.includes(norm)) {
      setInput('')
      return
    }
    if (isThinking) return

    setInput('')
    const userMsg: Msg = { role: 'user', text, id: `u-${Date.now()}`, subject, mode: activeMode }
    setMessages((m) => [...m, userMsg])
    try { setStats((s) => { const ns = { ...s, totalMessages: s.totalMessages + 1 }; const key = userScopedStorageKey('lumora_stats', session?.user.id); if (key) localStorage.setItem(key, JSON.stringify(ns)); return ns }) } catch {}

    const local = interceptSpecialQuestions(text)
    if (local) {
      const assistantLocal: Msg = { role: 'assistant', text: local, id: `a-local-${Date.now()}`, subject, mode: activeMode }
      setMessages((m) => [...m, assistantLocal])
      const isEduLocal = isComplexResponse(assistantLocal.text) || activeMode === 'research'
      recordResponseReceived(assistantLocal.id!, subject, assistantLocal.text, isEduLocal)
      maybeAskUnderstandingCheck(assistantLocal, isEduLocal)
      return
    }

    const learningMatch = text.match(/(?:want to learn|learn|study)\s+([a-z0-9+#.-]+)/i)
    if (learningMatch) {
      const topic = learningMatch[1]
      const assistantMsg: Msg = { role: 'assistant', text: `Let's set up a learning project for ${topic}. Add a goal and a few topics when you are ready.`, id: `a-project-${Date.now()}`, subject: topic, mode: activeMode }
      setMessages((m) => [...m, assistantMsg])
      setProjectTitle(`Learn ${topic.charAt(0).toUpperCase() + topic.slice(1)}`)
      setProjectSubject(topic)
      setProjectDescription(`Build confidence with ${topic}.`)
      setWorkspaceView('projects')
      setShowProjectForm(true)
      return
    }

    setIsThinking(true)
    try {
      try { markTiming('requestSent') } catch (e) {}
      const requestSubject = activeProjectContext?.subject || subject
      const projectContextPayload = activeProjectContext ? {
        projectId: activeProjectContext.projectId,
        projectName: activeProjectContext.projectName,
        subject: requestSubject,
        studyPlanId: activeProjectContext.studyPlanId || null
      } : undefined
      const res = session
        ? await authenticatedFetch(API_URL!, session, {
        method: 'POST',
        body: JSON.stringify({ message: text, conversationId, mode: activeMode, subject: requestSubject, skill: computeSkillForSubject(requestSubject), projectContext: projectContextPayload })
      })
        : await fetch(API_URL!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, mode: activeMode, subject: requestSubject, skill: computeSkillForSubject(requestSubject), projectContext: projectContextPayload })
        })
      const data = await res.json()
      try { markTiming('responseReceived') } catch (e) {}
      try { sendVoiceMetrics({ textLength: text.length, subject, mode: activeMode }) } catch (e) {}
      if (data?.ok) {
        if (session && data.conversationId) {
          setConversationId(data.conversationId)
          const conversationsResponse = await authenticatedFetch(`${API_URL!}/conversations`, session)
          const conversationsData = await conversationsResponse.json()
          if (conversationsData?.ok && Array.isArray(conversationsData.conversations)) setConversations(conversationsData.conversations)
        }
        const assistantText = data.text || (data.formatted && JSON.stringify(data.formatted)) || ''
        const assistantMsg: Msg = { role: 'assistant', text: assistantText, id: `a-${Date.now()}`, subject, mode: activeMode }
        setMessages((m) => [...m, assistantMsg])
        setMode(data.mode || activeMode || 'chat')
        const isEdu = isComplexResponse(assistantText) || activeMode === 'research'
        recordResponseReceived(assistantMsg.id!, subject, assistantText, isEdu)
        maybeAskUnderstandingCheck(assistantMsg, isEdu)
      } else {
        const assistantErr: Msg = { role: 'assistant', text: data?.error || 'Sorry, something went wrong.', id: `a-${Date.now()}`, subject, mode: activeMode }
        setMessages((m) => [...m, assistantErr])
      }
    } catch (err) {
      console.error(err)
      setMessages((m) => [...m, { role: 'assistant', text: err instanceof ApiAuthenticationError ? err.message : 'I could not reach Cognita. Please try again.' }])
    } finally {
      setIsThinking(false)
    }
  }

  function saveStats(ns: any) {
    try {
      const key = userScopedStorageKey('lumora_stats', session?.user.id)
      if (key) localStorage.setItem(key, JSON.stringify(ns))
    } catch {}
    setStats(ns)
  }

  function recordResponseReceived(messageId: string, subj: string, text?: string, isEdu?: boolean) {
    try {
      saveStats((prev: any) => {
        const next = { ...prev }
        next.responses = (next.responses || 0) + 1
        if (!next.subjects) next.subjects = {}
        if (!next.subjects[subj]) next.subjects[subj] = { messages: 0, understood: 0 }
        next.subjects[subj].messages = (next.subjects[subj].messages || 0) + 1
        if (isEdu || isComplexResponse(text || '')) next.eduResponses = (next.eduResponses || 0) + 1
        return next
      })
    } catch (e) {}
  }

  function computeSkillForSubject(subj: string) {
    const s = stats.subjects && (stats.subjects as any)[subj]
    if (!s || !s.messages) return 'beginner'
    const rate = (s.understood || 0) / s.messages
    if (rate < 0.5) return 'beginner'
    if (rate < 0.8) return 'intermediate'
    return 'advanced'
  }

  const overallProgress = stats.responses ? Math.round(((stats.understood || 0) / stats.responses) * 100) : 0
  const firstName = session?.user.email?.split('@')[0]?.split(/[._-]/)[0]
  const displayName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : null
    const authenticatedDisplayName = account?.profile?.display_name || displayName || 'Account'

    useEffect(() => {
      if (!session) {
        setProfileName('')
        setProfileMessage(null)
        return
      }
      setProfileName(account?.profile?.display_name || '')
    }, [account?.profile?.display_name, session?.user.id])

    async function saveProfile(event: React.FormEvent) {
      event.preventDefault()
      setProfileSaving(true)
      setProfileMessage(null)
      const result = await updateProfile(profileName)
      setProfileSaving(false)
      setProfileMessage(result.error ? result.error.message : 'Profile updated')
    }
  const activeTutor = tutorForMode(activeMode)
  const greetings = displayName
    ? [`What's up, ${displayName}?`, `Good to see you, ${displayName}.`, `What are we learning today, ${displayName}?`, `Ready to keep learning, ${displayName}?`]
    : ['What would you like to learn?', 'Where should we start?']
  const greeting = greetings[(new Date().getDate()) % greetings.length]

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault()
    setAuthFormError(null)
    const result = authMode === 'signin'
      ? await signIn(authEmail.trim(), authPassword)
      : await signUp(authEmail.trim(), authPassword, termsAccepted)
    if (result.error) setAuthFormError(result.error.message)
    else { setAuthPassword(''); setShowAuthModal(false) }
  }

  function openWorkspace(view: 'chat' | 'projects' | 'plans') {
    setWorkspaceView(view)
    if (view === 'chat') {
      setSelectedPlan(null)
    } else {
      setSelectedProject(null)
      setSelectedPlan(null)
      setActiveProjectContext(null)
    }
    setMobileNavOpen(false)
  }

  function formatConversationDate(value: string) {
    const date = new Date(value)
    const now = new Date()
    return date.toDateString() === now.toDateString() ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  async function openConversation(conversation: Conversation) {
    if (!session) return
    try {
      const res = await authenticatedFetch(`${API_URL!}/history?conversationId=${encodeURIComponent(conversation.id)}`, session)
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Conversation unavailable')
      setWorkspaceView('chat')
      setConversationId(conversation.id)
      setMessages(Array.isArray(data.history) ? data.history.map((message: any) => ({ role: message.role, text: message.text })) : [])
      setMobileNavOpen(false)
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Conversation unavailable')
    }
  }

  async function renameConversation(conversation: Conversation) {
    if (!session) return
    const title = window.prompt('Rename conversation', conversation.title)
    if (title === null) return
    try {
      const res = await authenticatedFetch(`${API_URL!}/conversations/${conversation.id}`, session, { method: 'PATCH', body: JSON.stringify({ title }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Conversation could not be renamed')
      setConversations((items) => items.map((item) => item.id === conversation.id ? data.conversation : item))
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Conversation could not be renamed')
    }
  }

  async function deleteConversation(conversation: Conversation) {
    if (!session || !window.confirm(`Delete "${conversation.title}"?`)) return
    try {
      const res = await authenticatedFetch(`${API_URL!}/conversations/${conversation.id}`, session, { method: 'DELETE' })
      if (!res.ok) throw new Error('Conversation could not be deleted')
      setConversations((items) => items.filter((item) => item.id !== conversation.id))
      if (conversationId === conversation.id) {
        setConversationId(null)
        setMessages([])
      }
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Conversation could not be deleted')
    }
  }

  function openProject(project: Project) {
    setSelectedProject(project)
    setWorkspaceView('projects')
    setProjectTab('overview')
    const plan = studyPlans.find((item) => item.project_id === project.id)
    setSelectedPlan(plan || null)
    setActiveProjectContext({
      projectId: project.id,
      projectName: project.title,
      subject: project.subject || plan?.subject,
      studyPlanId: plan?.id || null
    })
  }

  async function createProject(event: React.FormEvent) {
    event.preventDefault()
    const project = { id: `local-project-${Date.now()}`, title: projectTitle.trim(), description: projectDescription.trim(), subject: projectSubject.trim() }
    if (!project.title) return
    try {
      const next = [...projects, project]
      if (session) {
        const response = await authenticatedFetch(`${API_URL}/projects`, session, { method: 'POST', body: JSON.stringify(project) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Project could not be created')
        const createdProject = data.project
        setProjects([...projects, createdProject])
        setSelectedProject(createdProject)
        setProjectTab('overview')
        setActiveProjectContext({
          projectId: createdProject.id,
          projectName: createdProject.title,
          subject: createdProject.subject || undefined,
          studyPlanId: null
        })
      } else {
        setProjects(next)
        localStorage.setItem('lumora_anonymous_projects', JSON.stringify(next))
      }
      setProjectTitle(''); setProjectDescription(''); setProjectSubject(''); setShowProjectForm(false)
    } catch (error) { setWorkspaceError(error instanceof Error ? error.message : 'Project could not be created') }
  }

  async function createPlan(event: React.FormEvent) {
    event.preventDefault()
    const topics: PlanTopic[] = planTopics.split('\n').map((title, index) => title.trim()).filter(Boolean).map((title, index) => ({ id: `local-topic-${Date.now()}-${index}`, week_number: Math.floor(index / 3) + 1, title, lesson: `Study ${title}.`, exercise: `Explain or practise ${title}.`, completed: false, sort_order: index }))
    if (!planTitle.trim() || !planSubject.trim() || !topics.length) return
    const plan: StudyPlan = { id: `local-plan-${Date.now()}`, title: planTitle.trim(), objective: planObjective.trim(), subject: planSubject.trim(), learner_level: planLevel, estimated_duration: '', schedule: '', project_id: planProjectId, study_plan_topics: topics }
    try {
      if (session) {
        const response = await authenticatedFetch(`${API_URL}/study-plans`, session, { method: 'POST', body: JSON.stringify({ ...plan, topics }) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Study plan could not be created')
        const createdPlan = data.studyPlan
        setStudyPlans([createdPlan, ...studyPlans])
        if (createdPlan.project_id) {
          const relatedProject = projects.find((project) => project.id === createdPlan.project_id)
          if (relatedProject) {
            setSelectedProject(relatedProject)
            setActiveProjectContext({
              projectId: relatedProject.id,
              projectName: relatedProject.title,
              subject: relatedProject.subject || createdPlan.subject,
              studyPlanId: createdPlan.id
            })
          }
        }
      } else {
        const next = [...studyPlans, plan]
        setStudyPlans(next)
        localStorage.setItem('lumora_anonymous_study_plans', JSON.stringify(next))
      }
      setPlanTitle(''); setPlanObjective(''); setPlanSubject(''); setPlanTopics(''); setPlanProjectId(undefined); setShowPlanForm(false)
    } catch (error) { setWorkspaceError(error instanceof Error ? error.message : 'Study plan could not be created') }
  }

  async function toggleTopic(plan: StudyPlan, topic: PlanTopic) {
    const completed = !topic.completed
    try {
      if (session && topic.id) {
        const response = await authenticatedFetch(`${API_URL}/study-plans/topics/${topic.id}`, session, { method: 'PATCH', body: JSON.stringify({ completed }) })
        if (!response.ok) throw new Error('Topic could not be updated')
      }
      const update = (item: StudyPlan) => item.id !== plan.id ? item : { ...item, study_plan_topics: (item.study_plan_topics || []).map((current) => current.id === topic.id ? { ...current, completed } : current) }
      const next = studyPlans.map(update)
      setStudyPlans(next)
      setSelectedPlan(update(plan))
      if (!session) localStorage.setItem('lumora_anonymous_study_plans', JSON.stringify(next))
    } catch (error) { setWorkspaceError(error instanceof Error ? error.message : 'Topic could not be updated') }
  }

  function renderProjectView() {
    if (selectedProject) {
      const plan = studyPlans.find((item) => item.project_id === selectedProject.id)
      const projectInfo = [
        { label: 'Subject', value: selectedProject.subject || 'Not set' },
        { label: 'Goal', value: selectedProject.description || 'Add a clear objective for this project.' },
        { label: 'Study plan', value: plan ? plan.title : 'No study plan yet' },
        { label: 'Updated', value: selectedProject.updated_at ? new Date(selectedProject.updated_at).toLocaleDateString() : 'Recently' }
      ]

      return <section className="workspace-content">
        <button className="back-link" onClick={() => { setSelectedProject(null); setActiveProjectContext(null) }}>Projects</button>
        <h1>{selectedProject.title}</h1>
        <p className="workspace-muted">{selectedProject.description || 'No objective added yet.'}</p>

        <div className="workspace-tabs">
          <span className={projectTab === 'overview' ? 'active' : ''} onClick={() => setProjectTab('overview')}>Overview</span>
          <span className={projectTab === 'chats' ? 'active' : ''} onClick={() => { setWorkspaceView('chat'); setProjectTab('overview'); }}>Chats</span>
          <span className={projectTab === 'study-plan' ? 'active' : ''} onClick={() => { if (plan) { setSelectedPlan(plan); setWorkspaceView('plans'); } else { setPlanProjectId(selectedProject.id); setPlanSubject(selectedProject.subject); setPlanTitle(`${selectedProject.title} Plan`); setShowPlanForm(true) } }}>Study Plan</span>
          <span className={projectTab === 'resources' ? 'active' : ''} onClick={() => setProjectTab('resources')}>Resources</span>
          <span className={projectTab === 'progress' ? 'active' : ''} onClick={() => setProjectTab('progress')}>Progress</span>
          <span className={projectTab === 'files' ? 'active' : ''} onClick={() => setProjectTab('files')}>Files</span>
        </div>

        {projectTab === 'overview' && <div className="project-overview-grid">
          <div className="project-overview-card">
            <h2>Project overview</h2>
            <div className="project-meta-grid">
              {projectInfo.map((meta) => <div key={meta.label} className="project-meta-item"><span>{meta.label}</span><strong>{meta.value}</strong></div>)}
            </div>
            <div className="project-action-row">
              <button className="primary-button" onClick={() => setWorkspaceView('chat')}>Continue learning</button>
              {plan ? <button className="text-button" onClick={() => { setSelectedPlan(plan); setWorkspaceView('plans'); setSelectedProject(null) }}>Open study plan</button> : <button className="primary-button" onClick={() => { setPlanProjectId(selectedProject.id); setPlanSubject(selectedProject.subject); setPlanTitle(`${selectedProject.title} Plan`); setShowPlanForm(true) }}>Create study plan</button>}
            </div>
          </div>
          <div className="project-overview-card">
            <h2>Current status</h2>
            {plan ? <>
              <p className="workspace-muted">{plan.title}</p>
              <div className="mini-status">
                <span>Topics</span>
                <strong>{plan.study_plan_topics?.length || 0}</strong>
              </div>
              <div className="mini-status">
                <span>Completed</span>
                <strong>{plan.study_plan_topics?.filter((topic) => topic.completed).length || 0}</strong>
              </div>
            </> : <p className="workspace-muted">No study plan is attached yet. Create one to turn this project into a focused learning path.</p>}
          </div>
        </div>}

        {projectTab === 'chats' && <div className="workspace-section"><p className="workspace-muted">Return to your active chat to continue this project with the same context visible at the top of the workspace.</p><button className="primary-button" onClick={() => setWorkspaceView('chat')}>Open project chat</button></div>}
        {projectTab === 'resources' && <div className="workspace-section"><p className="workspace-muted">Resources are not available in this slice yet. This project can still keep the learning objective and study plan together while you continue in chat.</p></div>}
        {projectTab === 'progress' && <div className="workspace-section"><p className="workspace-muted">Progress tracking is intentionally left for a later slice. The current project already keeps objective and study-plan context in place.</p></div>}
        {projectTab === 'files' && <div className="workspace-section"><p className="workspace-muted">Files are not yet connected for this project. This placeholder keeps the workspace structure intact without creating fake functionality.</p></div>}
      </section>
    }

    if (projectLoading) {
      return <section className="workspace-content"><div className="empty-workspace">Loading your projects…</div></section>
    }

    return <section className="workspace-content">
      <div className="workspace-heading"><div><h1>Projects</h1><p className="workspace-muted">Keep conversations, plans, and learning context together.</p></div><button className="primary-button" onClick={() => session ? setShowProjectForm(true) : setShowAuthModal(true)}>New project</button></div>
      {projects.length === 0 ? <div className="empty-workspace">Create a learning project to keep conversations, plans, and resources together.</div> : <div className="workspace-list">{projects.map((project) => <button className="workspace-list-item" key={project.id} onClick={() => openProject(project)}><strong>{project.title}</strong><span>{project.subject || 'Learning project'}</span><small>{project.description || 'No objective added yet.'}</small></button>)}</div>}
    </section>
  }

  function renderPlanView() {
    if (selectedPlan) {
      const topics = selectedPlan.study_plan_topics || []
      const completed = topics.filter((topic) => topic.completed).length
      const completion = topics.length ? Math.round((completed / topics.length) * 100) : 0
      const groupedWeeks = Array.from(new Set(topics.map((topic) => topic.week_number))).sort((a, b) => a - b)
      return <section className="workspace-content"><button className="back-link" onClick={() => setSelectedPlan(null)}>Study Plans</button><h1>{selectedPlan.title}</h1><p className="workspace-muted">{selectedPlan.objective || `Learn ${selectedPlan.subject}.`}</p><div className="plan-summary-grid"><div className="plan-summary-item"><span>Subject</span><strong>{selectedPlan.subject || 'Unspecified'}</strong></div><div className="plan-summary-item"><span>Level</span><strong>{selectedPlan.learner_level || 'Beginner'}</strong></div><div className="plan-summary-item"><span>Duration</span><strong>{selectedPlan.estimated_duration || 'Flexible'}</strong></div><div className="plan-summary-item"><span>Schedule</span><strong>{selectedPlan.schedule || 'Flexible schedule'}</strong></div></div><div className="plan-progress">Progress: {completion}% ({completed}/{topics.length || 0} complete)</div>{groupedWeeks.map((week) => <div className="plan-week" key={week}><h2>Week {week}</h2>{topics.filter((topic) => topic.week_number === week).map((topic) => <label className="plan-topic" key={topic.id || `${topic.title}-${week}`}><input type="checkbox" checked={topic.completed} onChange={() => toggleTopic(selectedPlan, topic)} /><span><strong>{topic.title}</strong><small>{topic.lesson || 'Keep practising this topic.'}</small></span></label>)}</div>)}</section>
    }

    if (studyPlanLoading) {
      return <section className="workspace-content"><div className="empty-workspace">Loading your study plans…</div></section>
    }

    return <section className="workspace-content"><div className="workspace-heading"><div><h1>Study Plans</h1><p className="workspace-muted">Tell Cognita what you want to learn and build a plan around your goal.</p></div><button className="primary-button" onClick={() => session ? setShowPlanForm(true) : setShowAuthModal(true)}>New study plan</button></div>{studyPlans.length === 0 ? <div className="empty-workspace">Your first plan can turn a goal into clear weekly topics and practice.</div> : <div className="workspace-list">{studyPlans.map((plan) => <button className="workspace-list-item" key={plan.id} onClick={() => setSelectedPlan(plan)}><strong>{plan.title}</strong><span>{plan.subject} · {plan.learner_level}</span><small>{plan.study_plan_topics?.filter((topic) => topic.completed).length || 0} of {plan.study_plan_topics?.length || 0} topics complete</small></button>)}</div>}</section>
  }

  return (
    <div className="workspace-shell">
      <aside className={`workspace-sidebar ${mobileNavOpen ? 'is-open' : ''}`}>
        <div className="workspace-brand">
          <span className="brand-mark" aria-hidden="true">L</span>
          <span>Lumora Cognita</span>
        </div>
        <button className="new-chat-btn" onClick={() => { setMessages([]); setConversationId(null); setMobileNavOpen(false) }}><Icon name="plus" /> New Chat</button>

        <div className="sidebar-search">
          <Icon name="menu" />
          <input type="text" placeholder="Search conversations" value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} />
        </div>

        {session && <div className="conversation-history">
          {conversations.map((conversation) => (
            <div key={conversation.id} className="conversation-history-item">
              <button className="conversation-item" onClick={() => openConversation(conversation)}>
                <strong>{conversation.title}</strong><small>{formatConversationDate(conversation.updated_at)}</small>
              </button>
              <div className="conversation-actions">
                <button type="button" onClick={() => renameConversation(conversation)} aria-label={`Rename ${conversation.title}`}>Rename</button>
                <button type="button" onClick={() => deleteConversation(conversation)} aria-label={`Delete ${conversation.title}`}>Delete</button>
              </div>
            </div>
          ))}
        </div>}

        <nav className="workspace-nav" aria-label="Workspace">
          <div className="nav-section-label">Workspace</div>
          <button className="nav-item nav-icon-item" onClick={() => openWorkspace('chat')}><Icon name="home" /> <span>Home</span></button>
          <button className="nav-item nav-icon-item active" onClick={() => openWorkspace('chat')}><Icon name="chat" /> <span>Chats</span></button>
          <button className="nav-item nav-icon-item" onClick={() => openWorkspace('projects')}><Icon name="folder" /> <span>Projects</span></button>
          <div className="nav-section-label">Learning</div>
          <button className="nav-item nav-icon-item" onClick={() => openWorkspace('plans')}><Icon name="book" /> <span>Study Plans</span></button>
          <button className="nav-item nav-icon-item" disabled><Icon name="spark" /> <span>Homework Helper</span></button>
          <button className="nav-item nav-icon-item" disabled><Icon name="spark" /> <span>Practice</span></button>
          <button className="nav-item nav-icon-item" disabled><Icon name="spark" /> <span>Simulations</span></button>
          <div className="nav-section-label">Resources</div>
          <button className="nav-item nav-icon-item" disabled><Icon name="book" /> <span>YouTube</span></button>
          <button className="nav-item nav-icon-item" disabled><Icon name="book" /> <span>Wikipedia</span></button>
          <button className="nav-item nav-icon-item" disabled><Icon name="folder" /> <span>Saved Resources</span></button>
          <button className="nav-item nav-icon-item" disabled><Icon name="folder" /> <span>Files</span></button>
          <div className="nav-section-label">Personal</div>
          <button className="nav-item nav-icon-item" onClick={() => setShowStats(true)}><Icon name="home" /> <span>Progress</span></button>
          <button className="nav-item nav-icon-item" onClick={() => setShowStats(true)}><Icon name="user" /> <span>Memory</span></button>
          <div className="nav-section-label">Account</div>
          <button className="nav-item nav-icon-item" onClick={() => setShowStats(true)}><Icon name="settings" /> <span>Settings</span></button>
          {session && <button className="nav-item nav-icon-item" onClick={() => signOut()}><Icon name="logout" /> <span>Log out</span></button>}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-user">
          {session ? (
            <>
              <div className="user-avatar">{session.user.email?.[0]?.toUpperCase() || 'U'}</div>
              <span>{authenticatedDisplayName}</span>
            </>
          ) : (
            <>
              <div className="user-avatar">G</div>
              <span>Guest</span>
            </>
          )}
        </div>
      </aside>
      {mobileNavOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <main className="main" style={{ width: '100%' }}>
        {workspaceView !== 'chat' ? <div className="workspace-panel-shell">{workspaceError && <div className="workspace-error" role="alert">{workspaceError}</div>}{workspaceView === 'projects' ? renderProjectView() : renderPlanView()}</div> : <div className="chat-container" style={{ width: '100%' }}>
          <div className="chat-area">
            <div className="chat-header">
              <div className="chat-header-left">
                <button className="mobile-menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button>
              </div>
              <div className="chat-header-identity">
                <span className="identity-label"><span className="identity-indicator" aria-hidden="true" /> Now using {activeTutor}</span>
                <label className="tutor-selector-label">
                  <span className="sr-only">Select tutor</span>
                  <select className="identity-mode" value={activeTutor} onChange={(event) => setActiveMode(modeForTutor(event.target.value as TutorName))}>
                    {TUTORS.map((tutor) => <option key={tutor.name} value={tutor.name}>{tutor.name} · {tutor.description}</option>)}
                  </select>
                </label>
              </div>
              <div className="chat-header-right">
                <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme"><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
              </div>
            </div>

            {!session && <div className="anonymous-note">Anonymous mode: your current chat stays in this browser. Sign in to save learning progress.</div>}
            {activeProjectContext && (
              <div className="project-context-bar">
                <div className="project-context-kicker">Project context</div>
                <div className="project-context-main">
                  <strong>{activeProjectContext.projectName}</strong>
                  <span>{activeProjectContext.subject || 'Focused learning project'}</span>
                </div>
                {activeProjectContext.studyPlanId && <div className="project-context-badge">Study plan active</div>}
              </div>
            )}

            {/* Focused empty state keeps the first screen conversational. */}
            {messages.length === 0 && !isThinking && (
              <div className="welcome-hero" role="region" aria-label="Welcome">
                <div className="welcome-card">
                  <div className="welcome-title">Good evening, {displayName || 'there'}.</div>
                  <div className="welcome-sub">What is on your mind?</div>
                  <div className="welcome-actions">
                    <button className="action-btn" onClick={() => { setInput('Explain a concept'); setTimeout(() => handleSend(), 100) }}>Explain a concept</button>
                    <button className="action-btn" onClick={() => { setInput('Help me study'); setTimeout(() => handleSend(), 100) }}>Help me study</button>
                    <button className="action-btn" onClick={() => { setInput('Build a learning plan'); setTimeout(() => handleSend(), 100) }}>Build a learning plan</button>
                    <button className="action-btn" onClick={() => { setInput('Analyze a document'); setTimeout(() => handleSend(), 100) }}>Analyze a document</button>
                  </div>
                </div>
              </div>
            )}

            <div className="chat-messages" id="messages">
              {envError && (
                <div style={{ padding: 12, background: '#ffe6e6', color: '#6b0000', borderRadius: 8, marginBottom: 12 }} role="alert">
                  {envError}
                </div>
              )}
              {messages.filter((m) => m.role === 'user' || m.role === 'assistant').map((m, i) => (
                <div key={m.id || i} className={`message ${m.role}`}>
                  <div className={`bubble ${m.role === 'user' ? 'user' : 'assistant'}`}>
                    {m.role === 'assistant' ? renderParsedText(m.text) : <div className="whitespace-pre-line">{m.text}</div>}
                  </div>
                </div>
              ))}

              {isThinking && (
                <div className="message assistant">
                  <div className="bubble assistant">...<span className="dots">●●●</span></div>
                </div>
              )}

              <div ref={lastMessageRef} />
            </div>

            <div className="chat-input">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Cognita anything..."
                className="chat-input-field"
                rows={1}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              />

              <div className="mic-wrapper">
                <button
                  className={`mic-btn ${micState} ${isRecording ? 'recording' : ''}`}
                  onClick={() => (micState === 'listening' ? stopRecording() : startRecording())}
                  title={micState === 'listening' ? 'Stop recording' : 'Start voice input'}
                  aria-pressed={micState === 'listening'}
                >
                  <Icon name={micState === 'listening' ? 'stop' : 'mic'} />
                </button>

                <div className={`waveform ${micState}`} ref={barsRef} aria-hidden>
                  {Array.from({ length: 16 }).map((_, i) => (
                    <span key={i} className="bar" />
                  ))}
                </div>

                <div className="mic-status" aria-live="polite">
                  {micState === 'listening' ? 'Listening...' : micState === 'processing' ? 'Processing...' : micError ? `Error: ${micError}` : ''}
                </div>
              </div>

              <button
                onClick={handleSend}
                disabled={isThinking || !input.trim()}
                className={`send-btn ${isThinking ? '' : 'pulse'}`}
                aria-disabled={isThinking || !input.trim()}
              >
                {isThinking ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
          {showStats && (
            <aside className="stats-panel" role="region" aria-label="Learning statistics">
              {session && <form className="workspace-form" onSubmit={saveProfile}>
                <h4>Account</h4>
                <label className="small" htmlFor="display-name">Display name</label>
                <input id="display-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Your display name" maxLength={80} />
                <button className="send-btn" type="submit" disabled={profileSaving}>{profileSaving ? 'Saving...' : 'Save profile'}</button>
                {profileMessage && <div className="muted" role="status">{profileMessage}</div>}
              </form>}
              <h4>Learning Dashboard</h4>
              <div className="stat-row"><div>Total messages</div><div>{stats.totalMessages}</div></div>
              <div className="stat-row"><div>Responses</div><div>{stats.responses}</div></div>
              <div className="stat-row"><div>Understood</div><div>{stats.understood}</div></div>
              <div style={{ marginTop: 12 }}>
                <strong>By Subject</strong>
                <div className="stat-subject">
                  {Object.keys((stats.subjects as any) || {}).length === 0 && <div className="muted">No data yet</div>}
                  {Object.keys((stats.subjects as any) || {}).map((sub) => {
                    const s = (stats.subjects as any)[sub]
                    const pct = s && s.messages ? Math.round(((s.understood || 0) / s.messages) * 100) : 0
                    return (
                      <div key={sub} style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><div>{sub}</div><div>{pct}%</div></div>
                        <div className="subject-bar"><div className="subject-fill" style={{ width: `${pct}%` }} /></div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </aside>
          )}
        </div>}
      </main>
      {showProjectForm && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowProjectForm(false)}><form className="auth-modal workspace-form" onSubmit={createProject} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setShowProjectForm(false)} aria-label="Close">×</button><h2>New project</h2><input aria-label="Project title" placeholder="Project title" value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} required /><input aria-label="Subject" placeholder="Subject or topic" value={projectSubject} onChange={(event) => setProjectSubject(event.target.value)} /><textarea aria-label="Objective" placeholder="What do you want to achieve?" value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} /><button className="send-btn" type="submit">Create project</button></form></div>}
      {showPlanForm && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowPlanForm(false)}><form className="auth-modal workspace-form" onSubmit={createPlan} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setShowPlanForm(false)} aria-label="Close">×</button><h2>New study plan</h2><input aria-label="Plan title" placeholder="Plan title" value={planTitle} onChange={(event) => setPlanTitle(event.target.value)} required /><input aria-label="Plan subject" placeholder="Subject" value={planSubject} onChange={(event) => setPlanSubject(event.target.value)} required /><select aria-label="Learner level" value={planLevel} onChange={(event) => setPlanLevel(event.target.value)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select><textarea aria-label="Objective" placeholder="What should this plan help you achieve?" value={planObjective} onChange={(event) => setPlanObjective(event.target.value)} /><textarea aria-label="Topics" placeholder="Add one topic per line" value={planTopics} onChange={(event) => setPlanTopics(event.target.value)} required /><button className="send-btn" type="submit">Create study plan</button></form></div>}
      {showAuthModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowAuthModal(false)}>
          <form className="auth-modal" onSubmit={handleSignIn} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setShowAuthModal(false)} aria-label="Close">×</button>
            <h2>{authMode === 'signin' ? 'Welcome back' : 'Create your free account'}</h2>
            <p>Save conversations, learning progress, study plans, and personalized memory.</p>
            <input aria-label="Email" type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="Email" required />
            <input aria-label="Password" type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Password" minLength={6} required />
            {authMode === 'signup' && <label className="terms-check"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /> <span>I accept the <a href="/terms">Terms &amp; Conditions</a>.</span></label>}
            {(authFormError || authError) && <div role="alert" className="form-error">{authFormError || authError}</div>}
            <button className="send-btn" type="submit">{authMode === 'signin' ? 'Sign in' : 'Create account'}</button>
            <button type="button" className="auth-switch" onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setAuthFormError(null) }}>{authMode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}</button>
          </form>
        </div>
      )}
    </div>
  )
}
