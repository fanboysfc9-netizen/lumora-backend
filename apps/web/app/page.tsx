"use client"
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Msg = { role: 'user' | 'assistant' | 'system'; text: string; id?: string; subject?: string; mode?: string; targetId?: string }

const API_URL = process.env.NEXT_PUBLIC_API_URL

if (!API_URL) {
  throw new Error('Missing NEXT_PUBLIC_API_URL in environment variables')
}

const FRANCES_NAME = 'Frances'
const FRANCES_DESCRIPTION = "A special girl's name you're mentioning"
const IDENTITY_PHRASE = 'I was created by Nana Yaw Boakye Yiadom, also known as Bastoni.'

function normalizeQuestion(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, ' ')
    .replace(/[?!.]+$/, '')
}

export default function Page() {
  const [theme, setTheme] = useState<string>(() => {
    try { return localStorage.getItem('lumora_theme') || 'dark' } catch { return 'dark' }
  })
  const [showStats, setShowStats] = useState(false)

  const defaultStats = { totalMessages: 0, responses: 0, understood: 0, subjects: {} as Record<string, { messages: number; understood: number }> }
  const [stats, setStats] = useState(() => defaultStats)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<string>('chat')
  const [activeMode, setActiveMode] = useState<string>(() => {
    try { return localStorage.getItem('lumora_mode') || 'standard' } catch { return 'standard' }
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
  const userId = 'demo-user'
  async function sendVoiceMetrics(extra: Record<string, any> = {}) {
    try {
      if (!API_URL) return
      if (!voiceTimingRef.current || Object.keys(voiceTimingRef.current).length === 0) return
      const payload = { client: 'web', userId, metrics: voiceTimingRef.current, extra }
      // best-effort POST; do not await
      fetch(`${API_URL}/admin/voice-metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      try {
        const res = await fetch(`${API_URL!}/history?userId=${encodeURIComponent(userId)}`)
        const data = await res.json()
        if (data?.ok && Array.isArray(data.history)) {
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
  }, [search])

  useEffect(() => {
    try { localStorage.setItem('lumora_mode', activeMode) } catch {}
  }, [activeMode])

  useEffect(() => {
    try {
      const s = localStorage.getItem('lumora_stats')
      if (s) setStats(JSON.parse(s))
    } catch (e) {}
    try {
      document.documentElement.classList.toggle('light-theme', theme === 'light')
    } catch (e) {}
  }, [])

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
    try { setStats((s) => { const ns = { ...s, totalMessages: s.totalMessages + 1 }; localStorage.setItem('lumora_stats', JSON.stringify(ns)); return ns }) } catch {}

    const local = interceptSpecialQuestions(text)
    if (local) {
      const assistantLocal: Msg = { role: 'assistant', text: local, id: `a-local-${Date.now()}`, subject, mode: activeMode }
      setMessages((m) => [...m, assistantLocal])
      const isEduLocal = isComplexResponse(assistantLocal.text) || activeMode === 'research'
      recordResponseReceived(assistantLocal.id!, subject, assistantLocal.text, isEduLocal)
      maybeAskUnderstandingCheck(assistantLocal, isEduLocal)
      return
    }

    setIsThinking(true)
    try {
      try { markTiming('requestSent') } catch (e) {}
      const res = await fetch(API_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message: text, mode: activeMode, subject, skill: computeSkillForSubject(subject) })
      })
      const data = await res.json()
      try { markTiming('responseReceived') } catch (e) {}
      try { sendVoiceMetrics({ textLength: text.length, subject, mode: activeMode }) } catch (e) {}
      if (data?.ok) {
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
      setMessages((m) => [...m, { role: 'assistant', text: 'Network error' }])
    } finally {
      setIsThinking(false)
    }
  }

  function saveStats(ns: any) {
    try { localStorage.setItem('lumora_stats', JSON.stringify(ns)) } catch {}
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

  return (
    <div className="app">
      <main className="main" style={{ width: '100%' }}>
        <div className="chat-container" style={{ width: '100%' }}>
          <div className="chat-area">
            <div className="chat-header">
              <div>
                <strong>Lumora Cognita</strong>
                <div className="muted" style={{ fontSize: 13 }}>Your adaptive learning assistant</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={`mode-btn ${activeMode === 'standard' ? 'active' : ''}`} onClick={() => setActiveMode('standard')}>Standard</button>
                  <button className={`mode-btn ${activeMode === 'coding' ? 'active' : ''}`} onClick={() => setActiveMode('coding')}>Coding</button>
                  <button className={`mode-btn ${activeMode === 'creative' ? 'active' : ''}`} onClick={() => setActiveMode('creative')}>Creative</button>
                  <button className={`mode-btn ${activeMode === 'research' ? 'active' : ''}`} onClick={() => setActiveMode('research')}>Research</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                  <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">{theme === 'dark' ? '☀️' : '🌙'}</button>
                  <button className="mode-btn" onClick={() => setShowStats((s) => !s)}>{showStats ? 'Close Stats' : 'Stats'}</button>
                </div>
              </div>
            </div>

            {/* Welcome hero when no conversation yet */}
            {messages.length === 0 && !isThinking && (
              <div className="welcome-hero" role="region" aria-label="Welcome">
                <div className="welcome-card">
                  <div className="welcome-title">Welcome to Lumora Cognita</div>
                  <div className="welcome-sub">Your adaptive learning companion</div>
                  <div className="welcome-cta muted">Start by typing a question below</div>
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
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Lumora anything..."
                className="chat-input-field"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend() } }}
              />

              <div className="mic-wrapper">
                <button
                  className={`mic-btn ${micState} ${isRecording ? 'recording' : ''}`}
                  onClick={() => (micState === 'listening' ? stopRecording() : startRecording())}
                  title={micState === 'listening' ? 'Stop recording' : 'Start voice input'}
                  aria-pressed={micState === 'listening'}
                >
                  <span aria-hidden>{micState === 'listening' ? '●' : '🎤'}</span>
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
        </div>
      </main>
    </div>
  )
}
