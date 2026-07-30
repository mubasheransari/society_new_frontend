'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ImagePreview from '../../components/ImagePreview';
import { API_BASE, getResidentSession, money, residentFetch, formatDate } from '../../lib/resident';

type DashboardData = any;

function toAmount(value: any) {
  if (value === null || value === undefined || value === '') return 0;
  const cleaned = String(value).replace(/,/g, '').replace(/PKR|Rs\.?/gi, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(value: any) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function getInvoiceRemaining(row: any) {
  return toAmount(
    row?.outstanding_amount ??
    row?.outstandingAmount ??
    row?.remaining_amount ??
    row?.remainingAmount ??
    row?.remaining ??
    0,
  );
}

function getHouseRemaining(row: any) {
  return toAmount(
    row?.remaining ??
    row?.remainingAmount ??
    row?.outstandingAmount ??
    row?.outstanding_amount ??
    row?.totalDues ??
    row?.total_dues ??
    row?.previousDues ??
    row?.previous_dues ??
    0,
  );
}


type StatProps = {
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  tone: 'purple' | 'teal' | 'amber' | 'blue';
};

function ResidentMetric({ title, value, subtitle, icon, tone }: StatProps) {
  return (
    <div className={`residentMetric ${tone}`}>
      <div className="residentMetricIcon">{icon}</div>
      <div>
        <div className="residentMetricValue">{value}</div>
        <div className="residentMetricTitle">{title}</div>
        <div className="residentMetricSub">{subtitle}</div>
      </div>
    </div>
  );
}

function MiniPostCard({ item }: { item: any }) {
  const img = (item.imageUrls || [])[0];
  return (
    <article className="residentMiniPost">
      <div className="residentMiniImage">
        {img ? <ImagePreview src={img} className="residentMiniImg" /> : <span>Notice</span>}
      </div>
      <div className="residentMiniBody">
        <div className="residentMiniTop">
          <span className="residentChip">{item.category || 'Society'}</span>
          <span>{formatDate(item.createdAt)}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.description || '-'}</p>
      </div>
    </article>
  );
}

export default function ResidentDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const session = getResidentSession();

  useEffect(() => {
    let mounted = true;
    async function loadDashboard() {
      try {
        const activeSession = getResidentSession();
        if (!activeSession) {
          router.replace('/resident/login');
          return;
        }
        setLoading(true);
        setError('');
        const activeSessionForDues = activeSession;
        const response = await residentFetch('/api/resident/dashboard');
        let houseDueSnapshot = null;
        try {
          const duesRes = await fetch(`${API_BASE}/api/dues`, { cache: 'no-store' });
          const duesJson = await duesRes.json().catch(() => []);
          const rows = Array.isArray(duesJson) ? duesJson : (Array.isArray(duesJson?.data) ? duesJson.data : []);
          houseDueSnapshot = rows.find((row: any) => String(row?.plotNo || row?.plot_no || '').trim().toLowerCase() === String(activeSessionForDues.plotNo || '').trim().toLowerCase()) || null;
        } catch {
          houseDueSnapshot = null;
        }
        if (!mounted) return;
        setData({ ...response, houseDueSnapshot });
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load resident dashboard');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadDashboard();
    return () => { mounted = false; };
  }, [router]);

  const posts = (data?.posts || []).slice(0, 4);
  const payments = (data?.recentPayments || []).slice(0, 5);
  const nocs = (data?.recentNocs || []).slice(0, 4);
  const recentInvoices = Array.isArray(data?.recentInvoices) ? data.recentInvoices : [];
  const houseSnapshot = data?.houseDueSnapshot || null;
  const invoiceOutstanding = recentInvoices.reduce((sum: number, item: any) => sum + getInvoiceRemaining(item), 0);
  const houseOutstanding = houseSnapshot ? getHouseRemaining(houseSnapshot) : 0;
  const outstandingAmount = Math.max(invoiceOutstanding, houseOutstanding);
  const statusList = recentInvoices.map((item: any) => normalizeStatus(item?.status));
  const hasPendingInvoice = statusList.some((status: string) => status === 'unpaid' || status === 'partially_paid' || status === 'partial' || status === 'partially paid');
  const hasPendingDues = outstandingAmount > 0 || hasPendingInvoice;
  const unpaidInvoices = hasPendingDues ? Math.max(Number(data?.summary?.unpaidInvoices || 0), hasPendingInvoice ? 1 : 0) : 0;
  const partialInvoices = hasPendingDues ? Number(data?.summary?.partiallyPaidInvoices || 0) : 0;

  return (
    <div className="residentPageShell">
      <section className="residentHero">
        <div className="residentHeroText">
          <span className="residentEyebrow">Resident panel</span>
          <h1>Welcome back, {session?.fullName || 'Resident'}</h1>
          <p>Manage payments, society updates, NOCs and complaints from a modern resident workspace.</p>
          {error ? <div className="alert error">{error}</div> : null}
        </div>
        <div className="residentStatusCard">
          <span>Account Status</span>
          <strong>{loading ? 'Loading...' : error ? 'Needs attention' : 'Active'}</strong>
          <small>Plot {session?.plotNo || '-'}</small>
        </div>
      </section>

      <section className={`residentDuesBanner ${hasPendingDues ? 'pending' : 'clear'}`}>
        <div className="residentDuesIcon">{hasPendingDues ? '!' : '✓'}</div>
        <div>
          <span className="residentEyebrow">Dues status</span>
          <h2>{hasPendingDues ? 'Dues pending' : 'No pending dues'}</h2>
          <p>{hasPendingDues ? 'Your account still has pending maintenance dues. Please clear outstanding dues before requesting a new NOC.' : 'Your account is clear. Any new monthly invoice will appear here.'}</p>
        </div>
        <div className="residentDuesAmount"><span>Outstanding</span><strong>{money(outstandingAmount)}</strong></div>
      </section>

      <div className="residentMetricsGrid">
        <ResidentMetric tone="purple" icon="₨" title="Unpaid Invoices" value={unpaidInvoices} subtitle="Pending monthly bills" />
        <ResidentMetric tone="teal" icon="✓" title="Partially Paid" value={partialInvoices} subtitle="Balance still remaining" />
        <ResidentMetric tone="amber" icon="★" title="Issued NOCs" value={data?.summary?.issuedNocs ?? 0} subtitle="Generated documents" />
        <ResidentMetric tone="blue" icon="🔔" title="Notifications" value={data?.summary?.unreadNotifications ?? 0} subtitle="Unread updates" />
      </div>

      <div className="residentDashGrid">
        <section className="residentCard residentPostsPanel">
          <div className="residentSectionHead">
            <div><h2>Latest Society Updates</h2><p>Important notices and maintenance announcements.</p></div>
            <button className="btn small" onClick={() => router.push('/resident/posts')}>View All</button>
          </div>
          <div className="residentMiniPostsGrid">
            {posts.map((item: any) => <MiniPostCard key={item.id} item={item} />)}
            {!loading && !posts.length ? <div className="residentEmpty">No posts found.</div> : null}
          </div>
        </section>

        <section className="residentCard">
          <div className="residentSectionHead">
            <div><h2>Recent Payments</h2><p>Latest received payment history.</p></div>
            <button className="btn small" onClick={() => router.push('/resident/payments')}>View All</button>
          </div>
          <div className="residentList">
            {payments.map((item: any) => (
              <div key={item.id} className="residentListRow">
                <div><strong>{item.bill_month || '-'}</strong><span>{item.payment_date ? new Date(item.payment_date).toLocaleDateString() : '-'}</span></div>
                <b>{money(item.amount_paid)}</b>
              </div>
            ))}
            {!loading && !payments.length ? <div className="residentEmpty">No payments found.</div> : null}
          </div>
        </section>
      </div>

      <section className="residentCard">
        <div className="residentSectionHead">
          <div><h2>Recent NOCs</h2><p>Generated documents for your plot.</p></div>
          <button className="btn small" onClick={() => router.push('/resident/nocs')}>View All</button>
        </div>
        <div className="residentTableCards">
          {nocs.map((item: any) => (
            <div key={item.id} className="residentDocCard">
              <span>{item.noc_type || item.nocType || 'NOC'}</span>
              <strong>{item.noc_number || item.nocNumber || '-'}</strong>
              <small>{(item.issued_at || item.issuedAt) ? new Date(item.issued_at || item.issuedAt).toLocaleString() : '-'}</small>
            </div>
          ))}
          {!loading && !nocs.length ? <div className="residentEmpty">No NOCs found.</div> : null}
        </div>
      </section>
    </div>
  );
}
