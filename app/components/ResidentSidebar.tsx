'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type ResidentSession = { fullName?: string; plotNo?: string };

const items = [
  { href: '/resident/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/resident/posts', label: 'Society Posts', icon: '✦' },
  { href: '/resident/payments', label: 'Payment Records', icon: '₨' },
  { href: '/resident/nocs', label: 'My NOCs', icon: '✓' },
  { href: '/resident/complaints', label: 'Complaints', icon: '☏' },
  { href: '/resident/change-password', label: 'Change Password', icon: '⚙' },
];

export default function ResidentSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [resident, setResident] = useState<ResidentSession>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem('resident-session');
      if (raw) setResident(JSON.parse(raw));
    } catch {}
  }, []);

  function logout() {
    localStorage.removeItem('resident-token');
    localStorage.removeItem('resident-session');
    router.push('/resident/login');
  }

  return (
    <aside className="sb">
      <div className="brand">
        <div className="logo logoImgWrap"><img src="/logo.png" alt="Lucknow Co-operative Housing Society" className="logoImg" /></div>
        <div>
          <div className="title">Resident Panel</div>
          <div className="sub">Lucknow Society</div>
        </div>
      </div>
      <div className="sideUserCard">
        <span>Signed in as</span>
        <strong>{resident.fullName || 'Resident'}</strong>
        <small>Plot {resident.plotNo || '-'}</small>
      </div>
      <nav className="nav">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className={`link ${pathname === it.href ? 'active' : ''}`}>
            <span className="navIcon">{it.icon}</span>
            <span>{it.label}</span>
          </Link>
        ))}
        <button className="link logoutNavBtn" onClick={logout}>
          <span className="navIcon">↪</span>
          <span>Logout</span>
        </button>
      </nav>
    </aside>
  );
}
