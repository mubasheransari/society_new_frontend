
export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
).replace(/\/$/, '');

export type ResidentSession = {
  id?: number;
  token: string;
  fullName: string;
  plotNo: string;
};

export function getResidentSession(): ResidentSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = localStorage.getItem('resident-token') || '';
    const raw = localStorage.getItem('resident-session');
    if (!token || !raw) return null;
    const parsed = JSON.parse(raw);
    return {
      id: Number(parsed.id || 0) || undefined,
      token,
      fullName: parsed.fullName || 'Resident',
      plotNo: parsed.plotNo || '',
    };
  } catch {
    return null;
  }
}

export function hasResidentSession(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('resident-token') || '';
  const raw = localStorage.getItem('resident-session');
  return !!token && !!raw;
}

export function saveResidentSession(
  token: string,
  resident: { id?: number; fullName?: string; plotNo?: string },
) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('resident-token', token);
  localStorage.setItem(
    'resident-session',
    JSON.stringify({
      id: resident.id || null,
      fullName: resident.fullName || 'Resident',
      plotNo: resident.plotNo || '',
    }),
  );
}

export function clearResidentSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('resident-token');
  localStorage.removeItem('resident-session');
}

export async function residentFetch(path: string, init: RequestInit = {}) {
  const session = getResidentSession();
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  if (session?.token) headers.set('Authorization', `Bearer ${session.token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || 'Request failed');
  return json;
}

export function money(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 2,
  });
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}
