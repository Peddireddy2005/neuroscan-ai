import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, setAccess } from '../api';
import { useAuth } from '../auth';
import './auth-page.css';

export default function AuthPage({ register = false }) {
  const { user, setUser, restoring } = useAuth();
  const navigate = useNavigate();
  const inFlight = useRef(false);
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const title = register ? 'Create your account' : 'Welcome back';
  const action = register ? 'Create account' : 'Sign in';

  if (user) return <Navigate to="/analyze" replace />;

  async function submit(event) {
    event.preventDefault();
    if (inFlight.current || restoring) return;
    const fields = new FormData(event.currentTarget);
    const email = fields.get('email').trim();
    const password = fields.get('password');

    if (register && password !== fields.get('confirm')) {
      setError('The passwords do not match. Enter the same password in both fields.');
      event.currentTarget.elements.namedItem('confirm').focus();
      return;
    }

    inFlight.current = true;
    setPending(true);
    setError('');
    try {
      const session = await api(register ? '/auth/register' : '/auth/login', {
        method: 'POST', json: { email, password },
      });
      setAccess(session.token);
      setUser(session.email);
      navigate('/analyze', { replace: true });
    } catch (failure) {
      setError(failure.message);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <section className="auth-layout" aria-labelledby="auth-title">
      <aside className="auth-intro">
        <div className="auth-intro-copy">
          <p className="auth-kicker">EEG RESEARCH WORKSPACE</p>
          <h2>Explore EEG recordings.</h2>
          <p>Preview multichannel signals, run model-assisted analyses, and revisit your results in one place.</p>
        </div>
        <div className="auth-trace" aria-hidden="true">
          <div className="auth-trace-label">ILLUSTRATIVE EEG TRACE</div>
          <svg viewBox="0 0 400 102" preserveAspectRatio="none" fill="none">
            <path d="M0 51H400" stroke="#56718e" strokeDasharray="3 5" />
            <path d="M0 53L10 55L18 49L28 55L38 46L47 53L55 48L62 57L72 51L80 59L89 45L97 55L108 52L116 62L125 47L135 53L143 30L150 74L160 44L170 55L182 50L194 57L205 46L213 51L224 42L233 55L242 47L251 63L259 53L268 57L277 46L286 51L295 27L303 78L313 40L322 56L331 48L341 57L351 49L361 54L372 44L381 57L391 48L400 52" stroke="#64ecd8" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        <p className="auth-research">For research use only</p>
      </aside>

      <div className="auth-content">
        <div className="auth-card">
          <nav className="auth-modes" aria-label="Account">
            <Link to="/login" aria-current={register ? undefined : 'page'} aria-disabled={pending} onClick={event => pending && event.preventDefault()}>Sign in</Link>
            <Link to="/signup" aria-current={register ? 'page' : undefined} aria-disabled={pending} onClick={event => pending && event.preventDefault()}>Create account</Link>
          </nav>
          <h1 id="auth-title">{title}</h1>
          <p className="auth-description">{register ? 'Set up an account to run analyses and keep your results together.' : 'Sign in to your NeuroScan AI research workspace.'}</p>

          <form onSubmit={submit} aria-busy={pending || restoring}>
            <fieldset disabled={pending || restoring} onChange={() => error && setError('')}>
              <label htmlFor="auth-email">Email address</label>
              <input id="auth-email" name="email" type="email" autoComplete="username" placeholder="you@example.com" maxLength={200} required />

              <label htmlFor="auth-password">Password</label>
              <div className="auth-password">
                <input id="auth-password" name="password" type={visible ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} required maxLength={200} minLength={register ? 8 : undefined} aria-describedby={register ? 'auth-password-hint' : undefined} />
                <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? 'Hide' : 'Show'}</button>
              </div>

              {register && <>
                <p className="auth-hint" id="auth-password-hint">Use at least 8 characters.</p>
                <label htmlFor="auth-confirm">Confirm password</label>
                <input id="auth-confirm" name="confirm" type={visible ? 'text' : 'password'} autoComplete="new-password" maxLength={200} required />
              </>}

              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="btn p auth-submit" type="submit">
                {restoring ? 'Checking session…' : pending ? (register ? 'Creating account…' : 'Signing in…') : action}
              </button>
            </fieldset>
          </form>
        </div>
      </div>
    </section>
  );
}
