'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearAdminSession, getCurrentUser, hasAccess, type CurrentUser, type NavKey } from '../lib/access';

const items: Array<{ href: string; label: string; key: NavKey; icon: string }> = [
  { href: '/', label: 'Dashboard & Invoices', key: 'dashboard', icon: '▦' },
  { href: '/posts', label: 'Society Posts', key: 'posts', icon: '✦' },
  { href: '/complaints', label: 'Complaints', key: 'complaints', icon: '☏' },
  { href: '/add-house', label: 'Add New House', key: 'addHouse', icon: '+' },
  { href: '/category-charges', label: 'Category Charges', key: 'categoryCharges', icon: '₨' },
  { href: '/records', label: 'Records', key: 'records', icon: '☷' },
  { href: '/generate-noc', label: 'Generate NOC', key: 'generateNoc', icon: '✓' },
  { href: '/sub-admins', label: 'Sub Admins', key: 'subAdmins', icon: '♙' },
  { href: '/settings', label: 'Settings', key: 'settings', icon: '⚙' },
];

export default function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser>(getCurrentUser());

  useEffect(() => {
    const sync = () => setUser(getCurrentUser());
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  function logout() {
    clearAdminSession();
    onClose?.();
    router.push('/login');
  }

  const allowedItems = items.filter((it) => hasAccess(user, it.key));

  return (
    <aside className={`sb ${mobileOpen ? 'sbOpen' : ''}`}>
      <div className="brand">
        <div className="logo logoImgWrap"><img src="/logo.png" alt="Lucknow Co-operative Housing Society" className="logoImg" /></div>
        <div>
          <div className="title">Lucknow Society</div>
          <div className="sub">Modern admin panel</div>
        </div>
      </div>

      <div className="sideUserCard">
        <span>Signed in as</span>
        <strong>{user.name}</strong>
        <small>{user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'Sub Admin'}</small>
      </div>

      <nav className="nav">
        {allowedItems.map((it) => {
          const active = pathname === it.href;
          return (
            <Link key={it.href} href={it.href} className={`link ${active ? 'active' : ''}`} onClick={onClose}>
              <span className="navIcon">{it.icon}</span>
              <span>{it.label}</span>
            </Link>
          );
        })}
        <button className="link logoutNavBtn" onClick={logout}>
          <span className="navIcon">↪</span>
          <span>Logout</span>
        </button>
      </nav>
    </aside>
  );
}
