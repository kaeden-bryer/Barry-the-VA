import { useRef, useState } from 'react'
import './App.css'

function App() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [assistantText, setAssistantText] = useState<string | null>(null)
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

      audio.onended = () => {
        try {
          URL.revokeObjectURL(url)
        } catch {}
        audioRef.current = null
        setLoading(false)
        setStatus(null)
      }

      await audio.play()
      setStatus('Playing response')
    } catch (err: any) {
      console.error(err)
      setStatus(err?.message ?? 'Error')
      setLoading(false)
    }
  }

  return (
    <div className="app-root">
      <h1>Ask the agent</h1>

      <form onSubmit={handleSubmit} className="ask-form">
        <label htmlFor="question">Your question</label>
        <input
          id="question"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask a short question..."
          disabled={loading}
        />

        <div className="controls">
          <button type="submit" disabled={loading}>
            {loading ? 'Waiting...' : 'Ask'}
          </button>
          <button
            type="button"
            onClick={() => {
              setText('')
            }}
            disabled={loading}
          >
            Clear
          </button>
        </div>
      </form>

      {status && <p className="status">{status}</p>}
      {assistantText && (
        <div className="assistant-text">
          <strong>Assistant:</strong> {assistantText}
        </div>
      )}
    </div>
  )
}

export default App
