import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import Auth from './Auth';
import Swipe from './Swipe';
import PostBill from './PostBill';
import { MyBills, MyPledges } from './Lists';

type Tab = 'swipe' | 'post' | 'bills' | 'pledges';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('swipe');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!ready) return null;
  if (!session) return <Auth />;
  const uid = session.user.id;

  const tabs: [Tab, string][] = [['swipe', '🔥 Swipe'], ['post', '➕ Post'], ['bills', '🧾 My bills'], ['pledges', '💸 My pledges']];

  return (
    <div className="app">
      <header>
        <div className="brand"><span className="logo sm">$</span> Billionaire Swipe</div>
        <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>
      <nav>
        {tabs.map(([t, label]) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{label}</button>
        ))}
      </nav>
      <main>
        {tab === 'swipe' && <Swipe onPledged={() => setTick((n) => n + 1)} />}
        {tab === 'post' && <PostBill userId={uid} onDone={() => { setTick((n) => n + 1); setTab('bills'); }} />}
        {tab === 'bills' && <MyBills userId={uid} tick={tick} />}
        {tab === 'pledges' && <MyPledges userId={uid} tick={tick} />}
      </main>
    </div>
  );
}
