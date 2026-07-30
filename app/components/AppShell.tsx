
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

  if (isResidentLogin || isAdminLogin) {
    return <div className="appContent soloContent">{children}</div>;
  }

  if (!ready) {
    return <div className="appContent soloContent">Loading...</div>;
  }

  const title = isResident ? 'Resident Dashboard' : pathname === '/' ? 'Dashboard' : pathname.split('/').filter(Boolean).join(' / ').replace(/-/g, ' ') || 'Dashboard';

  return (
    <div className="appShell">
      {isResident ? <ResidentSidebar /> : <Sidebar />}
      <div className="appContent">
        <div className="topBar no-print">
          <div className="flatTopTitle">
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
