import { useState } from 'react';
import { supabase, CATEGORIES } from './supabase';

export default function PostBill({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [category, setCategory] = useState('other');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [link, setLink] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents <= 0) return setErr('Enter a valid amount.');
    if (link && !link.startsWith('https://')) return setErr('Payment link must start with https://');
    if (file && file.size > 5 * 1024 * 1024) return setErr('Image must be under 5 MB.');
    setBusy(true);
    let image_path: string | null = null;
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      image_path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from('bills').upload(image_path, file, { contentType: file.type });
      if (up.error) { setBusy(false); return setErr(up.error.message); }
    }
    const { error } = await supabase.from('bills').insert({
      title: title.trim(), story: story.trim(), category, amount_cents: cents,
      currency: currency.toUpperCase(), payment_link: link.trim() || null, image_path,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    onDone();
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h2>Post a bill</h2>
      <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} minLength={3} maxLength={80} placeholder="Electricity bill for October" required /></label>
      <div className="two">
        <label>Amount<input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
        <label>Currency<input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} minLength={3} required /></label>
      </div>
      <label>Category
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label>Your story <small>({story.length}/600)</small>
        <textarea value={story} onChange={(e) => setStory(e.target.value)} maxLength={600} rows={4} placeholder="Why this bill matters to you" />
      </label>
      <label>Payment link <small>(the biller's pay page, or your PayPal/Venmo/etc.)</small>
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
      </label>
      <label>Photo of the bill <small>(JPG/PNG/WebP, max 5 MB)</small>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <p className="warn">⚠️ Cover your account numbers, address and other personal details before uploading. Signed-in users can see this photo.</p>
      <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> This bill is real and mine to share.</label>
      {err && <p className="msg">{err}</p>}
      <button className="primary" disabled={busy || !agree}>{busy ? 'Posting…' : 'Post bill'}</button>
    </form>
  );
}
