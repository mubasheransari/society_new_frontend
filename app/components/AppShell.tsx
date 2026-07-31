
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import ResidentSidebar from './ResidentSidebar';
import NotificationBell from './NotificationBell';
import { hasAdminSession } from '../lib/access';
import { hasResidentSession } from '../lib/resident';

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const isResident = pathname.startsWith('/resident');
  const isResidentLogin = pathname === '/resident/login';
  const isAdminLogin = pathname === '/login';

  useEffect(() => {
    if (isResident) {
      if (!isResidentLogin && !hasResidentSession()) {
        router.replace('/resident/login');
        return;
      }
      setReady(true);
      return;
    }

    if (!isAdminLogin && !hasAdminSession()) {
      router.replace('/login');
      return;
    }

    setReady(true);
  }, [isResident, isResidentLogin, isAdminLogin, router]);

  // Close the mobile nav drawer whenever the route changes (e.g. after
  // tapping a link), so it doesn't stay open over the new page.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  if (isResidentLogin || isAdminLogin) {
    return <div className="appContent soloContent">{children}</div>;
  }

  if (!ready) {
    return <div className="appContent soloContent">Loading...</div>;
  }

  const title = isResident ? 'Resident Dashboard' : pathname === '/' ? 'Dashboard' : pathname.split('/').filter(Boolean).join(' / ').replace(/-/g, ' ') || 'Dashboard';

  return (
    <div className="appShell">
      {isResident ? (
        <ResidentSidebar mobileOpen={navOpen} onClose={() => setNavOpen(false)} />
      ) : (
        <Sidebar mobileOpen={navOpen} onClose={() => setNavOpen(false)} />
      )}
      {navOpen && <div className="navBackdrop no-print" onClick={() => setNavOpen(false)} />}
      <div className="appContent">
        <div className="topBar no-print">
          <div className="flatTopTitle">
            <button
              type="button"
              className="navToggleBtn"
              aria-label={navOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setNavOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
            <strong>{title}</strong>
          </div>
          <div className="topRightTools">
            <NotificationBell resident={isResident} />
            <div className="topAvatar">LS</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
