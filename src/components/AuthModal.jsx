import { useState } from 'react'
import { supabase } from '../supabase'

export default function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('login') // login | signup | forgot | reset
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onSuccess?.()
        onClose()
      }

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Account created! Check your email to confirm.')
      }

      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setMessage('Password reset link sent to your email.')
      }

      if (mode === 'reset') {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setMessage('Password updated successfully!')
        setTimeout(() => {
          setMode('login')
          setMessage('')
        }, 1500)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose}>×</button>

        <h2>
          {mode === 'login' && 'Login'}
          {mode === 'signup' && 'Create Account'}
          {mode === 'forgot' && 'Forgot Password'}
          {mode === 'reset' && 'Reset Password'}
        </h2>

        <form onSubmit={handleSubmit}>
          {(mode === 'login' || mode === 'signup' || mode === 'forgot') && (
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}

          {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          )}

          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-success">{message}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Please wait...' : 
              mode === 'login' ? 'Login' :
              mode === 'signup' ? 'Create Account' :
              mode === 'forgot' ? 'Send Reset Link' : 'Update Password'}
          </button>
        </form>

        <div className="auth-links">
          {mode === 'login' && (
            <>
              <button type="button" onClick={() => setMode('signup')}>
                Create account
              </button>
              <button type="button" onClick={() => setMode('forgot')}>
                Forgot password?
              </button>
            </>
          )}
          {mode === 'signup' && (
            <button type="button" onClick={() => setMode('login')}>
              Already have an account? Login
            </button>
          )}
          {mode === 'forgot' && (
            <button type="button" onClick={() => setMode('login')}>
              Back to Login
            </button>
          )}
        </div>

        <div className="auth-guest">
          <button type="button" onClick={() => { onSuccess?.('guest'); onClose() }}>
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  )
}
