import { useRef, useState } from 'react'
import './App.css'

function App() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [assistantText, setAssistantText] = useState<string | null>(null)
  const [sprite, setSprite] = useState<'default' | 'thinking' | 'talking'>('default')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const apiUrl = 'http://127.0.0.1:8000/ask'

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!text.trim()) return

    // Stop previous audio if playing
    if (audioRef.current) {
      try {
        audioRef.current.pause()
        URL.revokeObjectURL(audioRef.current.src)
      } catch {}
      audioRef.current = null
    }

    setLoading(true)
    setStatus('Loading...')

    try {
      // show thinking sprite while waiting for response
      setSprite('thinking')
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!resp.ok) {
        const body = await resp.text()
        throw new Error(`Server returned ${resp.status}: ${body}`)
      }

      // Read assistant text from response headers (URL-encoded by backend)
      const encodedText = resp.headers.get('x-assistant-text')
      if (encodedText) {
        try {
          setAssistantText(decodeURIComponent(encodedText))
        } catch {
          setAssistantText(encodedText)
        }
      } else {
        setAssistantText(null)
      }

      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio

      // switch to talking when audio starts playing
      audio.onended = () => {
        try {
          URL.revokeObjectURL(url)
        } catch {}
        audioRef.current = null
        setLoading(false)
        setStatus(null)
        setSprite('default')
      }

      // attempt to play; if successful set talking sprite
      const p = audio.play()
      if (p && typeof p.then === 'function') {
        p.then(() => {
          setSprite('talking')
          setStatus('Playing response')
        }).catch((e) => {
          // Play failed (autoplay policy); keep sprite default and show error
          console.warn('Audio play failed', e)
          setStatus('Playing failed: ' + (e?.message ?? ''))
          setSprite('default')
          setLoading(false)
        })
      } else {
        // synchronous play
        setSprite('talking')
        setStatus('Playing response')
      }
    } catch (err: any) {
      console.error(err)
      setStatus(err?.message ?? 'Error')
      setLoading(false)
      setSprite('default')
    }
  }

  return (
    <div className="app-root">
      <header className="hero">
        <div className="hero-left">
          <img
            src={
              sprite === 'default'
                ? '/Barry-default.png'
                : sprite === 'thinking'
                ? '/Barry-thinking.png'
                : '/Barry-talking.png'
            }
            alt={`Barry is ${sprite}`}
            className={`barry-sprite ${sprite}`}
          />
        </div>
        <div className="hero-right">
          <h1>Barry the Voice Assistant</h1>
          <p className="subtitle">Ask Barry a short question and he'll speak the answer.</p>
        </div>
      </header>

      <main className="panel">
        <form onSubmit={handleSubmit} className="ask-form" aria-label="Ask Barry">
          <label htmlFor="question">Your question</label>
          <input
            id="question"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask a short question..."
            disabled={loading}
            aria-label="Question input"
          />

          <div className="controls">
            <button type="submit" disabled={loading} className="btn primary">
              {loading ? 'Waiting...' : 'Ask Barry'}
            </button>
            <button
              type="button"
              onClick={() => {
                setText('')
                setAssistantText(null)
              }}
              disabled={loading}
              className="btn"
            >
              Clear
            </button>
          </div>
        </form>

        <section className="response">
          {status && <p className="status">{status}</p>}
          {assistantText && (
            <div className="assistant-text">
              <strong>Barry says:</strong> {assistantText}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
