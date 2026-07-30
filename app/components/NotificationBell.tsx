'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../lib/resident';
import { getCurrentUser } from '../lib/access';
import { getResidentSession } from '../lib/resident';

type Notification = {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  link_url?: string;
  created_at?: string;
};

function fallbackPath(item: Notification, resident: boolean) {
  const text = `${item.title || ''} ${item.message || ''}`.toLowerCase();
  if (resident) {
    if (text.includes('gas')) return '/resident/posts?category=gas';
    if (text.includes('electricity')) return '/resident/posts?category=electricity';
    if (text.includes('water')) return '/resident/posts?category=water';
    if (text.includes('society')) return '/resident/posts?category=society';
    if (text.includes('noc')) return '/resident/nocs';
    if (text.includes('complaint')) return '/resident/complaints';
    if (text.includes('payment') || text.includes('invoice')) return '/resident/payments';
    return '/resident/dashboard';
  }
  if (text.includes('noc')) return '/generate-noc';
  if (text.includes('complaint')) return '/complaints';
  if (text.includes('post') || text.includes('update')) return '/posts';
  return '/';
}

function readLocalReadIds(key: string) {
  if (typeof window === 'undefined') return new Set<number>();
  try {
    const raw = window.localStorage.getItem(key);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set<number>(Array.isArray(ids) ? ids.map((x) => Number(x)).filter(Boolean) : []);
  } catch {
    return new Set<number>();
  }
}

function saveLocalReadId(key: string, id: number) {
  if (typeof window === 'undefined' || !id) return;
  const ids = readLocalReadIds(key);
  ids.add(Number(id));
  window.localStorage.setItem(key, JSON.stringify(Array.from(ids)));
}

function saveAllLocalReadIds(key: string, items: Notification[]) {
  if (typeof window === 'undefined') return;
  const ids = readLocalReadIds(key);
  items.forEach((item) => ids.add(Number(item.id)));
  window.localStorage.setItem(key, JSON.stringify(Array.from(ids)));
}

export default function NotificationBell({ resident = false }: { resident?: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const identity = useMemo(() => {
    if (resident) {
      const session = getResidentSession();
      return { userType: 'resident', userId: Number(session?.id || 0) };
    }
    const user = getCurrentUser();
    return { userType: 'admin', userId: Number(user.id || 1) };
  }, [resident]);

  const storageKey = useMemo(() => `notification-read:${identity.userType}:${identity.userId}`, [identity.userType, identity.userId]);

  async function load() {
    if (!identity.userId) return;
    const res = await fetch(`${API_BASE}/api/notifications?userType=${identity.userType}&userId=${identity.userId}`, { cache: 'no-store' });
    const json = await res.json();
    if (res.ok) {
      const localReadIds = readLocalReadIds(storageKey);
      const nextItems = (Array.isArray(json) ? json : []).map((item: Notification) => ({
        ...item,
        is_read: Boolean(item.is_read) || localReadIds.has(Number(item.id)),
      }));
      setItems(nextItems);
    }
  }

  async function markAllRead() {
    if (!identity.userId) return;
    saveAllLocalReadIds(storageKey, items);
    setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
    await fetch(`${API_BASE}/api/notifications/read`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(identity),
    }).catch(() => null);
  }

  async function openNotification(item: Notification) {
    if (!identity.userId) return;
    if (!item.is_read) {
      saveLocalReadId(storageKey, item.id);
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, is_read: true } : x)));
      await fetch(`${API_BASE}/api/notifications/${item.id}/read`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(identity),
      }).catch(() => null);
    }
    setOpen(false);
    router.push(item.link_url || fallbackPath(item, resident));
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [identity.userType, identity.userId]);

  const unread = items.filter((item) => !item.is_read).length;

  return (
    <div className="notifWrap">
      <button className="notifBtn" type="button" onClick={() => setOpen((prev) => !prev)}>
        <span>🔔</span>
        {unread > 0 ? <span className="notifBadge">{unread}</span> : null}
      </button>
      {open ? (
        <div className="notifDropdown">
          <div className="notifHead">
            <span>Notifications</span>
            {unread > 0 ? <button className="linkBtn" type="button" onClick={markAllRead}>Mark all read</button> : null}
          </div>
          {items.length ? items.map((item) => (
            <button key={item.id} type="button" className={`notifItem ${item.is_read ? '' : 'new'}`} onClick={() => openNotification(item)}>
              <strong>{item.title}</strong>
              <p>{item.message}</p>
              <small>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</small>
            </button>
          )) : <div className="mutedCell">No notifications.</div>}
        </div>
      ) : null}
    </div>
  );
}
