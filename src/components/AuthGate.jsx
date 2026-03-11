import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './AuthGate.css';

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="auth-loading">Loading...</div>;
  }

  if (!session) {
    return <LoginPage error={error} setError={setError} />;
  }

  return children(session);
}

function LoginPage({ error, setError }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function signInWith(provider) {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
        scopes: provider === 'google' ? 'https://www.googleapis.com/auth/calendar.events' : undefined,
        queryParams: provider === 'google' ? { access_type: 'offline', prompt: 'consent' } : undefined,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  async function signInWithEmail(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      setError(error.message);
    } else {
      setMagicLinkSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Treenote</h1>
        <p className="login-subtitle">A keyboard-driven tree editor</p>

        {magicLinkSent ? (
          <div className="magic-link-sent">
            <p>Check your email for a login link!</p>
            <button className="login-btn" onClick={() => setMagicLinkSent(false)}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <form className="email-form" onSubmit={signInWithEmail}>
              <input
                type="email"
                className="email-input"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              <button type="submit" className="login-btn email" disabled={loading || !email.trim()}>
                Sign in with Email
              </button>
            </form>

            <div className="login-divider">
              <span>or</span>
            </div>

            <div className="login-buttons">
              <button
                className="login-btn google"
                onClick={() => signInWith('google')}
                disabled={loading}
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>
            </div>
          </>
        )}

        {error && <div className="login-error">{error}</div>}
      </div>
    </div>
  );
}
