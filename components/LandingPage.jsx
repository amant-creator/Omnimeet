'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';

export default function LandingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [joinCode, setJoinCode] = useState('');
  const [userName, setUserName] = useState('');
  const [mode, setMode]   = useState(null); // 'create' | 'join'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If user already has a session, offer quick-rejoin
  const sessionName = session?.user?.name || '';

  const generateCode = () => {
    const seg = () => Math.random().toString(36).substring(2, 5);
    return `${seg()}-${seg()}-${seg()}`;
  };

  /**
   * Sign in with NextAuth Credentials provider (display-name only).
   * Returns true on success, false on failure.
   */
  const ensureSignedIn = async (name) => {
    if (session) return true; // already have a session
    setLoading(true);
    const res = await signIn('display-name', { name, redirect: false });
    setLoading(false);
    if (!res || res.error) {
      setError('Could not start session. Please try again.');
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    const name = (session ? sessionName : userName).trim();
    if (!name) { setError('Please enter your name'); return; }

    const ok = await ensureSignedIn(name);
    if (!ok) return;

    const roomId = generateCode();
    // Store isHost flag in sessionStorage only as a hint — server enforces it
    sessionStorage.setItem('isHost', 'true');
    router.push(`/room/${roomId}`);
  };

  const handleJoin = async () => {
    const name = (session ? sessionName : userName).trim();
    if (!name) { setError('Please enter your name'); return; }
    if (!joinCode.trim()) { setError('Please enter a meeting code'); return; }

    const ok = await ensureSignedIn(name);
    if (!ok) return;

    const code = joinCode.trim().toLowerCase();
    sessionStorage.setItem('isHost', 'false');
    router.push(`/room/${code}`);
  };

  // While checking session, show a subtle loading state
  if (status === 'loading') {
    return (
      <>
        <div className="bg-mesh" />
        <main className="landing" style={{ justifyContent: 'center' }}>
          <div className="landing-logo">
            <div className="landing-logo-icon">📹</div>
            <span className="landing-logo-text">OmniMeet</span>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <div className="bg-mesh" />

      <main className="landing">
        {/* Logo */}
        <div className="landing-logo">
          <div className="landing-logo-icon">📹</div>
          <span className="landing-logo-text">OmniMeet</span>
        </div>
        <p className="landing-tagline">
          Premium real-time video conferencing — free, instant, no sign-up
        </p>

        {/* Card */}
        <div className="landing-card">
          {mode === null && (
            <>
              <h2>Get started</h2>
              <p>Create a new meeting or join an existing one.</p>

              {/* Only show name input if not already signed in */}
              {!session && (
                <div className="form-group">
                  <label className="form-label" htmlFor="username-home">Your Name</label>
                  <input
                    id="username-home"
                    className="form-input"
                    type="text"
                    placeholder="Enter your display name"
                    value={userName}
                    onChange={(e) => { setUserName(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && setMode('join')}
                    autoComplete="off"
                    autoFocus
                    maxLength={50}
                  />
                </div>
              )}

              {session && (
                <p style={{ marginBottom: '1rem', color: 'var(--clr-text-secondary)' }}>
                  Welcome back, <strong style={{ color: 'var(--clr-primary)' }}>{sessionName}</strong>!
                </p>
              )}

              {error && (
                <p role="alert" style={{ color: 'var(--clr-danger)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                  ⚠ {error}
                </p>
              )}

              <button
                id="btn-new-meeting"
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginBottom: '0.75rem' }}
                disabled={loading}
                onClick={() => {
                  const name = (session ? sessionName : userName).trim();
                  if (!name) { setError('Please enter your name'); return; }
                  setError('');
                  setMode('create');
                }}
              >
                🎬 New Meeting
              </button>

              <div className="divider">or</div>

              <button
                id="btn-join-meeting"
                className="btn btn-secondary"
                style={{ width: '100%', padding: '0.85rem', fontSize: '1rem' }}
                disabled={loading}
                onClick={() => {
                  const name = (session ? sessionName : userName).trim();
                  if (!name) { setError('Please enter your name'); return; }
                  setError('');
                  setMode('join');
                }}
              >
                🔗 Join with Code
              </button>
            </>
          )}

          {mode === 'create' && (
            <>
              <button
                onClick={() => setMode(null)}
                style={{ background: 'none', color: 'var(--clr-text-secondary)', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                ← Back
              </button>
              <h2>New Meeting</h2>
              <p>
                Hi <strong style={{ color: 'var(--clr-primary)' }}>{session ? sessionName : userName}</strong>! A unique meeting code will be
                generated for you to share with others.
              </p>

              {error && (
                <p role="alert" style={{ color: 'var(--clr-danger)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                  ⚠ {error}
                </p>
              )}

              <button
                id="btn-start-meeting"
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.85rem', fontSize: '1rem' }}
                disabled={loading}
                onClick={handleCreate}
              >
                {loading ? 'Starting…' : '🚀 Start Meeting'}
              </button>
            </>
          )}

          {mode === 'join' && (
            <>
              <button
                onClick={() => setMode(null)}
                style={{ background: 'none', color: 'var(--clr-text-secondary)', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                ← Back
              </button>
              <h2>Join Meeting</h2>
              <p>Enter the meeting code shared with you.</p>

              <div className="form-group">
                <label className="form-label" htmlFor="meeting-code-input">Meeting Code</label>
                <input
                  id="meeting-code-input"
                  className="form-input"
                  type="text"
                  placeholder="e.g. abc-def-ghi"
                  value={joinCode}
                  onChange={(e) => { setJoinCode(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  autoFocus
                  maxLength={64}
                />
              </div>

              {error && (
                <p role="alert" style={{ color: 'var(--clr-danger)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                  ⚠ {error}
                </p>
              )}

              <button
                id="btn-join-now"
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.85rem', fontSize: '1rem' }}
                disabled={loading}
                onClick={handleJoin}
              >
                {loading ? 'Joining…' : 'Join Now →'}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: 'var(--clr-text-muted)', animation: 'fadeUp 0.7s ease 0.4s both' }}>
          No account required • End-to-end encrypted • Works in your browser
        </p>
      </main>
    </>
  );
}
