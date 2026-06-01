import { useState } from 'react';
import { Shapes, ShieldCheck } from 'lucide-react';
import { signIn, signUp, sendOtp, verifyOtp } from '../lib/supabase';

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
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signUp(email, password, displayName || undefined);
      await sendOtp(email);
      setSuccess('A verification code was sent to your email');
      setStep('verify');
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
          <h1 style={{ margin: 0, fontSize: '24px' }}>UML Studio</h1>
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ marginBottom: '6px' }}>Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name (optional)"
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