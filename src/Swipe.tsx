import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, Bill } from './supabase';
import BillCard from './BillCard';

export default function Swipe({ onPledged }: { onPledged: () => void }) {
  const [deck, setDeck] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [dx, setDx] = useState(0);
  const [flying, setFlying] = useState<'left' | 'right' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const start = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('next_bills', { lim: 15 });
    if (error) setToast(error.message);
    setDeck((data as Bill[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(t: string) {
    setToast(t);
    setTimeout(() => setToast(null), 2500);
  }

  async function decide(dir: 'left' | 'right') {
    const top = deck[0];
    if (!top || flying) return;
    setFlying(dir);
    const { data, error } = await supabase.rpc('swipe', { p_bill: top.id, p_direction: dir });
    setTimeout(() => {
      setDeck((d) => d.slice(1));
      setFlying(null);
      setDx(0);
      if (deck.length <= 2) load();
    }, 250);
    if (error) return flash(error.message);
    if (data === 'pledged') { flash('💸 Pledged! Find it under "My pledges" to pay.'); onPledged(); }
    else if (data === 'taken') flash('Someone beat you to it!');
  }

  async function report() {
    const top = deck[0];
    if (!top) return;
    const reason = prompt('Why are you reporting this bill? (scam, personal info visible, offensive…)');
    if (!reason || reason.trim().length < 3) return;
    const { error } = await supabase.rpc('report_bill', { p_bill: top.id, p_reason: reason.trim() });
    flash(error ? error.message : 'Thanks — reported.');
    if (!error) { await supabase.rpc('swipe', { p_bill: top.id, p_direction: 'left' }); setDeck((d) => d.slice(1)); }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') decide('left');
      if (e.key === 'ArrowRight') decide('right');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const top = deck[0];
  const next = deck[1];
  const offset = flying === 'right' ? 600 : flying === 'left' ? -600 : dx;

  return (
    <div className="swipe">
      <div className="stack">
        {loading && !top && <p className="empty">Loading bills…</p>}
        {!loading && !top && (
          <div className="empty">
            <p>🎉 No more bills right now.</p>
            <button onClick={load}>Refresh</button>
          </div>
        )}
        {next && <div className="slot behind"><BillCard bill={next} /></div>}
        {top && (
          <div
            className="slot top"
            style={{
              transform: `translateX(${offset}px) rotate(${offset / 18}deg)`,
              transition: start.current === null ? 'transform .25s ease' : 'none',
            }}
            onPointerDown={(e) => { start.current = e.clientX; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
            onPointerMove={(e) => { if (start.current !== null) setDx(e.clientX - start.current); }}
            onPointerUp={() => {
              const d = dx;
              start.current = null;
              if (d > 110) decide('right');
              else if (d < -110) decide('left');
              else setDx(0);
            }}
            onPointerCancel={() => { start.current = null; setDx(0); }}
          >
            <div className="stamp pay" style={{ opacity: Math.max(0, offset / 110) }}>PAY</div>
            <div className="stamp pass" style={{ opacity: Math.max(0, -offset / 110) }}>PASS</div>
            <BillCard bill={top} />
          </div>
        )}
      </div>
      {top && (
        <div className="actions">
          <button className="round pass" onClick={() => decide('left')} aria-label="Pass">✕</button>
          <button className="link" onClick={report}>Report</button>
          <button className="round pay" onClick={() => decide('right')} aria-label="Pay">$</button>
        </div>
      )}
      <p className="hint">Swipe or use ← → keys. Swiping right is a promise to pay.</p>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
