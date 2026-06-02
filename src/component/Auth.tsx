import { useState } from 'react';
import { Shapes, ShieldCheck } from 'lucide-react';
import { signIn, signUp, sendOtp, verifyOtp, signInWithOAuth, type OAuthProvider } from '../lib/supabase';

type AuthStep = 'login' | 'signup' | 'verify';

export function AuthPage() {
  const [step, setStep] = useState<AuthStep>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg.includes('Invalid login')
        ? 'Invalid email or password!'
        : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: OAuthProvider) => {
    setError('');
    try {
      await signInWithOAuth(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${provider} sign-in failed`);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await signUp(email, password, displayName || undefined);
      if (result.user?.identities?.length === 0) {
        setError('An account with this email already exists. Please sign in.');
        return;
      }
      if (result.session) {
        await signIn(email, password);
      } else {
        await sendOtp(email);
        setSuccess('A verification code was sent to your email');
        setStep('verify');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await verifyOtp(email, otpCode);
      setSuccess('Email verified! Signing you in...');
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('login');
    setError('');
    setSuccess('');
    setOtpCode('');
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100svh',
      background: 'var(--bg)',
    }}>
      <div style={{
        background: 'var(--panel)',
        borderRadius: '12px',
        boxShadow: 'var(--shadow)',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        border: '1px solid var(--border)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Shapes size={40} style={{ color: 'var(--accent)', marginBottom: '12px' }} />
          <h1 style={{ margin: 0, fontSize: '24px' }}>Codic Studio</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
            {step === 'verify' ? 'Enter the code sent to your email' : 'Visual design to Java class code'}
          </p>
        </div>

        {step === 'verify' ? (
          <form onSubmit={handleVerify}>
            <div style={{ marginBottom: '8px', fontSize: '13px', color: 'var(--muted)', wordBreak: 'break-all' }}>
              {email}
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ marginBottom: '6px' }}>
                <ShieldCheck size={14} /> Verification Code
              </label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                placeholder="6-digit code"
                maxLength={6}
                style={{ letterSpacing: '8px', textAlign: 'center', fontSize: '18px', fontVariantNumeric: 'tabular-nums' }}
                autoFocus
              />
            </div>

            {error && <Message type="error" text={error} />}
            {success && <Message type="success" text={success} />}

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              style={{
                width: '100%',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                marginBottom: '12px',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--muted)', margin: 0 }}>
              <button
                type="button"
                onClick={reset}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', padding: 0, cursor: 'pointer', fontSize: '14px' }}
              >
                Back to login
              </button>
            </p>
          </form>
        ) : step === 'login' ? (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ marginBottom: '6px' }}>Email</label>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ marginBottom: '6px' }}>Password</label>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="At least 6 characters"
              />
            </div>

            {error && <Message type="error" text={error} />}
            {success && <Message type="success" text={success} />}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                marginBottom: '16px',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Please wait...' : 'Sign In'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>

            <OAuthButtons onOAuth={handleOAuth} loading={loading} />

            <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--muted)', margin: 0 }}>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => { setStep('signup'); setError(''); setSuccess(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', padding: 0, cursor: 'pointer', fontSize: '14px' }}
              >
                Sign up
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleSignup}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ marginBottom: '6px' }}>Email</label>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ marginBottom: '6px' }}>Full Name</label>
              <input
                type="text"
                name="name"
                autoComplete="name"
                value={displayName}
                required
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ marginBottom: '6px' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="At least 6 characters"
              />
            </div>

            {error && <Message type="error" text={error} />}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                marginBottom: '16px',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Please wait...' : 'Create Account'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--muted)', margin: 0 }}>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setStep('login'); setError(''); setSuccess(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', padding: 0, cursor: 'pointer', fontSize: '14px' }}
              >
                Sign in
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function Message({ type, text }: { type: 'error' | 'success'; text: string }) {
  return (
    <div style={{
      padding: '10px 14px',
      background: type === 'success' ? 'var(--accent-soft)' : '#fef2f2',
      color: type === 'success' ? 'var(--accent)' : 'var(--danger)',
      borderRadius: '8px',
      marginBottom: '16px',
      fontSize: '13px',
    }}>
      {text}
    </div>
  );
}

function OAuthButtons({ onOAuth, loading }: { onOAuth: (p: OAuthProvider) => void; loading: boolean }) {
  const btnStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px',
    background: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1,
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text)',
    minHeight: '40px',
  };

  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
      <button type="button" style={btnStyle} onClick={() => onOAuth('google')} disabled={loading || true}>
        <GoogleIcon />
        Google
      </button>
      <button type="button" style={btnStyle} onClick={() => onOAuth('github')} disabled={loading || true}>
        <GitHubIcon />
        GitHub
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}