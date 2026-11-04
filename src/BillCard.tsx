import { useEffect, useState } from 'react';
import { Bill, CATEGORY_EMOJI, imageUrl, money } from './supabase';

export default function BillCard({ bill, children }: { bill: Bill; children?: React.ReactNode }) {
  const [img, setImg] = useState<string | null>(null);
  useEffect(() => {
    imageUrl(bill.image_path).then(setImg);
  }, [bill.image_path]);
  return (
    <div className="bill">
      <div className="bill-img">
        {img ? <img src={img} alt="Bill" draggable={false} /> : <div className="placeholder">{CATEGORY_EMOJI[bill.category] ?? '🧾'}</div>}
        <span className="amount">{money(bill.amount_cents, bill.currency)}</span>
      </div>
      <div className="bill-body">
        <div className="row">
          <h3>{bill.title}</h3>
          <span className={`tag ${bill.status}`}>{bill.status}</span>
        </div>
        <p className="cat">{CATEGORY_EMOJI[bill.category]} {bill.category}</p>
        {bill.story && <p className="story">{bill.story}</p>}
        {children}
      </div>
    </div>
  );
}
