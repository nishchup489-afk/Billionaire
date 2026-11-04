import { useEffect, useState } from 'react';
import { supabase, Bill } from './supabase';
import BillCard from './BillCard';

function useBills(column: 'user_id' | 'pledged_by', userId: string, tick: number) {
  const [bills, setBills] = useState<Bill[] | null>(null);
  const reload = async () => {
    const { data } = await supabase.from('bills').select('*').eq(column, userId).neq('status', 'removed').order('created_at', { ascending: false });
    setBills((data as Bill[]) ?? []);
  };
  useEffect(() => { reload(); }, [userId, tick]);
  return [bills, reload] as const;
}

export function MyBills({ userId, tick }: { userId: string; tick: number }) {
  const [bills, reload] = useBills('user_id', userId, tick);
  if (!bills) return <p className="empty">Loading…</p>;
  if (!bills.length) return <p className="empty">You haven't posted any bills yet.</p>;

  async function setStatus(b: Bill, status: 'paid' | 'removed') {
    if (status === 'removed' && !confirm('Remove this bill?')) return;
    const { error } = await supabase.from('bills').update({ status }).eq('id', b.id);
    if (error) alert(error.message);
    if (status === 'removed' && b.image_path) await supabase.storage.from('bills').remove([b.image_path]);
    reload();
  }

  return (
    <div className="list">
      {bills.map((b) => (
        <BillCard key={b.id} bill={b}>
          {b.status === 'pledged' && <p className="note">🙌 A patron pledged to pay this. Once the money arrives, confirm it.</p>}
          <div className="btns">
            {b.status === 'pledged' && <button className="primary" onClick={() => setStatus(b, 'paid')}>Confirm paid</button>}
            {b.status !== 'paid' && <button onClick={() => setStatus(b, 'removed')}>Remove</button>}
          </div>
        </BillCard>
      ))}
    </div>
  );
}

export function MyPledges({ userId, tick }: { userId: string; tick: number }) {
  const [bills, reload] = useBills('pledged_by', userId, tick);
  if (!bills) return <p className="empty">Loading…</p>;
  if (!bills.length) return <p className="empty">No pledges yet. Swipe right on a bill to pledge.</p>;

  async function release(b: Bill) {
    if (!confirm('Release this pledge so someone else can pay it?')) return;
    const { error } = await supabase.rpc('release_pledge', { p_bill: b.id });
    if (error) alert(error.message);
    reload();
  }

  return (
    <div className="list">
      {bills.map((b) => (
        <BillCard key={b.id} bill={b}>
          {b.status === 'pledged' && (
            <>
              <p className="note">Pay directly using the link below. The poster will mark it paid once received.</p>
              <div className="btns">
                {b.payment_link
                  ? <a className="button primary" href={b.payment_link} target="_blank" rel="noopener noreferrer nofollow">Pay now ↗</a>
                  : <span className="note">No payment link provided.</span>}
                <button onClick={() => release(b)}>Release</button>
              </div>
              {b.payment_link && <p className="fine">Opens {safeHost(b.payment_link)} — check it looks legit before paying.</p>}
            </>
          )}
          {b.status === 'paid' && <p className="note">✅ Confirmed paid. You're a legend.</p>}
        </BillCard>
      ))}
    </div>
  );
}

function safeHost(u: string) {
  try { return new URL(u).host; } catch { return 'an external site'; }
}
