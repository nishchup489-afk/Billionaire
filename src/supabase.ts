import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_KEY as string;

export const supabase = createClient(url, key);

export type Bill = {
  id: string;
  user_id: string;
  title: string;
  story: string;
  category: string;
  amount_cents: number;
  currency: string;
  payment_link: string | null;
  image_path: string | null;
  status: 'open' | 'pledged' | 'paid' | 'removed';
  pledged_by: string | null;
  pledged_at: string | null;
  paid_at: string | null;
  report_count: number;
  created_at: string;
};

export const CATEGORIES = ['rent', 'medical', 'utilities', 'education', 'food', 'debt', 'other'] as const;

export const CATEGORY_EMOJI: Record<string, string> = {
  rent: '🏠', medical: '🩺', utilities: '💡', education: '🎓', food: '🛒', debt: '💳', other: '🧾',
};

export function money(cents: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

const urlCache = new Map<string, string>();
export async function imageUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (urlCache.has(path)) return urlCache.get(path)!;
  const { data } = await supabase.storage.from('bills').createSignedUrl(path, 60 * 60);
  if (data?.signedUrl) urlCache.set(path, data.signedUrl);
  return data?.signedUrl ?? null;
}
