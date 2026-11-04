import { useEffect, useState } from 'react';
import { supabase, money } from './supabase';

type Stats = { open: number; pledged: number; paid: number; paid_cents: number };

export default function Auth() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    supabase.rpc('stats').then(({ data }) => data && setStats(data as Stats));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res =
      mode === 'signup'
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: name }, emailRedirectTo: window.location.origin + window.location.pathname },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (res.error) setMsg(res.error.message);
    else if (mode === 'signup' && !res.data.session) setMsg('Check your inbox to confirm your email, then sign in.');
  }

  return (
    <div className="landing">
      <div className="hero">
        <div className="logo">$</div>
        <h1>Billionaire Swipe</h1>
        <p className="tagline">Upload your bills. Bored billionaires swipe right to pay them.</p>
        {stats && (
          <div className="stats">
            <div><b>{stats.open}</b><span>waiting</span></div>
            <div><b>{stats.pledged}</b><span>pledged</span></div>
            <div><b>{money(stats.paid_cents)}</b><span>paid</span></div>
          </div>
        )}
        <ol className="how">
          <li><b>Post</b> a bill with a photo (hide personal info!) and a payment link.</li>
          <li><b>Patrons swipe</b> — right to pay, left to pass.</li>
          <li><b>They pay directly</b> through your link. You confirm it's paid.</li>
        </ol>
      </div>

      <form className="card auth" onSubmit={submit}>
        <div className="seg">
          <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>Sign up</button>
          <button type="button" className={mode === 'signin' ? 'on' : ''} onClick={() => setMode('signin')}>Sign in</button>
        </div>
        {mode === 'signup' && (
          <label>Display name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required /></label>
        )}
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <button className="primary" disabled={busy}>{busy ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
        {msg && <p className="msg">{msg}</p>}
      </form>
      <p className="fine">Fan-made project. Not affiliated with any billionaire, company or social network. Money never passes through this site.</p>
    </div>
  );
}
