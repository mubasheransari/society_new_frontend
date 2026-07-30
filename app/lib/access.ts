export type NavKey = 'dashboard' | 'addHouse' | 'categoryCharges' | 'records' | 'generateNoc' | 'settings' | 'subAdmins' | 'posts' | 'complaints';

export const NAV_KEYS: NavKey[] = ['dashboard', 'addHouse', 'categoryCharges', 'records', 'generateNoc', 'settings', 'subAdmins', 'posts', 'complaints'];

export const DEFAULT_PERMISSIONS: Record<NavKey, boolean> = {
  dashboard: true,
  addHouse: false,
  categoryCharges: false,
  records: true,
  generateNoc: true,
  settings: false,
  subAdmins: false,
  posts: true,
  complaints: true,
};

export type CurrentUser = {
  id?: number;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'sub_admin';
  permissions: Record<NavKey, boolean>;
};

export const CURRENT_USER_KEY = 'invoice-suite-current-user';
export const ADMIN_TOKEN_KEY = 'invoice-suite-admin-token';
const DEFAULT_SUPER_ADMIN_EMAIL = 'admin@invoice.com';

export function normalizePermissions(input?: Partial<Record<NavKey, boolean>>, forceAll = false) {
  if (forceAll) {
    return NAV_KEYS.reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<NavKey, boolean>);
  }

  return { ...DEFAULT_PERMISSIONS, ...(input || {}) };
}

function normalizeRole(rawRole: unknown, email?: string) {
  const role = String(rawRole || '').trim().toLowerCase();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (normalizedEmail === DEFAULT_SUPER_ADMIN_EMAIL) return 'super_admin';
  if (role === 'super_admin' || role === 'superadmin' || role === 'super-admin') return 'super_admin';
  if (role === 'admin') return 'admin';
  return 'sub_admin';
}

export function normalizeCurrentUser(input?: Partial<CurrentUser> & { role?: string | null }) {
  const email = String(input?.email || DEFAULT_SUPER_ADMIN_EMAIL).trim().toLowerCase();
  const role = normalizeRole(input?.role, email);

  return {
    id: input?.id,
    name: String(input?.name || 'System Admin').trim() || 'System Admin',
    email,
    role,
    permissions: normalizePermissions(input?.permissions, role === 'super_admin'),
  } as CurrentUser;
}

export function getDefaultUser(): CurrentUser {
  return normalizeCurrentUser({
    name: 'System Admin',
    email: DEFAULT_SUPER_ADMIN_EMAIL,
    role: 'super_admin',
  });
}

export function getCurrentUser(): CurrentUser {
  if (typeof window === 'undefined') return getDefaultUser();
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return getDefaultUser();
    return normalizeCurrentUser(JSON.parse(raw));
  } catch {
    return getDefaultUser();
  }
}

export function saveCurrentUser(user: CurrentUser) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeCurrentUser(user);
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event('storage'));
}

export function getAdminToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

export function saveAdminSession(token: string, user: CurrentUser) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  saveCurrentUser(normalizeCurrentUser(user));
}

export function clearAdminSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
  window.dispatchEvent(new Event('storage'));
}

export function hasAdminSession() {
  return Boolean(getAdminToken());
}

export function hasAccess(user: CurrentUser, key: NavKey) {
  const normalized = normalizeCurrentUser(user);
  if (normalized.role === 'super_admin') return true;
  return Boolean(normalized.permissions[key]);
}

export function isSuperAdmin(user?: CurrentUser) {
  const current = user ? normalizeCurrentUser(user) : getCurrentUser();
  return current.role === 'super_admin';
}
