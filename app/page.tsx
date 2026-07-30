'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';

type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid';

type MonthlyInvoice = {
  id: number;
  billMonth: string;
  billMonthLabel: string;
  invoiceNumber: string;
  currentCharges?: number;
  perMonthDiscount?: number;
  chargesAfterDiscount: number;
  previousDues: number;
  installmentsPaid: number;
  outstandingAmount: number;
  status: InvoiceStatus;
  generatedAt?: string | null;
  generatedBy?: string;
  notes?: string;
};

type Portion = {
  id: number;
  portionName: string;
  residentName?: string;
  residentNumber?: string;
  residentType?: string;
  currentCharges?: number;
  chargesAfterDiscount?: number;
  perMonthDiscount?: number;
  previousDues?: number;
  totalDues?: number;
  amountPaid?: number;
  remaining?: number;
  status?: string;
};

type InvoiceResponse = {
  plotNo: string;
  portionId?: number | null;
  portionName?: string;
  portions?: Portion[];
  ownerName: string;
  contact?: string;
  currentBillMonth: string;
  currentBillMonthLabel: string;
  currentMonthStatus: InvoiceStatus;
  actualMonthlyCharges?: number;
  monthlyCurrentCharges?: number;
  perMonthDiscount?: number;
  monthlyDiscount?: number;
  monthlyCharges: number;
  monthlyChargesAfterDiscount?: number;
  categoryMonthlyCharge?: number;
  residentMonthlyCharge?: number;
  openingMonth?: string | null;
  lastBilledMonth?: string | null;
  totalDues: number;
  amountPaid: number;
  remaining: number;
  previousDues?: number;
  selectedBillMonth: string;
  selectedBillMonthLabel: string;
  selectedInvoice: MonthlyInvoice | null;
  payments: Array<{ id: number; amountPaid: number; paymentDate?: string | null; receivedBy?: string; notes?: string }>;
  invoices: MonthlyInvoice[];
};

type Row = {
  plotNo: string;
  ownerName: string;
  contact?: string;
  currentMonthStatus?: InvoiceStatus;
  monthlyCharges?: number;
  categoryMonthlyCharge?: number;
  residentMonthlyCharge?: number;
  openingMonth?: string | null;
  lastBilledMonth?: string | null;
  previousDues?: number;
  totalDues?: number;
  amountPaid?: number;
  remaining?: number;
  plotCategory?: string;
  chargeCategory?: string;
  chargeCategoryLabel?: string;
  category?: string;
};

type Settings = {
  operatorName: string;
  operatorRole: string;
  societyName: string;
  societyArea: string;
  secretaryName: string;
  secretaryDesignation: string;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const SETTINGS_KEY = 'invoice-suite-settings';
const defaultSettings: Settings = {
  operatorName: 'System Admin',
  operatorRole: 'Super Admin',
  societyName: 'Lucknow Co-operative Housing Society Ltd',
  societyArea: 'Sector 31-E Korangi Karachi',
  secretaryName: 'MALIK FAHAD',
  secretaryDesignation: 'HON. SECRETARY',
};

function monthInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function normalizeMonth(value?: string | null) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : '';
}

function isLaterMonth(targetMonth?: string | null, baseMonth?: string | null) {
  const target = normalizeMonth(targetMonth);
  const base = normalizeMonth(baseMonth);
  return Boolean(target && base && target > base);
}

function getStoredMonthlyRate(data: InvoiceResponse | null) {
  if (!data) return 0;
  return Number(data.categoryMonthlyCharge ?? data.residentMonthlyCharge ?? data.monthlyCharges ?? 0);
}

function getApplicableMonthlyCharge(data: InvoiceResponse | null) {
  if (!data) return 0;
  if (data.selectedInvoice) return Number(data.selectedInvoice.chargesAfterDiscount ?? 0);

  // New house rule: creation month uses Previous Dues only.
  // Apply category monthly charge only after billing moves to a later month.
  const baseMonth = data.lastBilledMonth || data.openingMonth || data.currentBillMonth;
  return isLaterMonth(data.selectedBillMonth, baseMonth) ? getStoredMonthlyRate(data) : 0;
}


function getActualMonthlyCharge(data: InvoiceResponse | null) {
  if (!data) return 0;
  if (data.selectedInvoice) {
    return Number(data.selectedInvoice.currentCharges ?? data.selectedInvoice.chargesAfterDiscount ?? 0);
  }
  const discounted = getApplicableMonthlyCharge(data);
  return Number(data.actualMonthlyCharges ?? data.monthlyCurrentCharges ?? discounted);
}

function getMonthlyDiscount(data: InvoiceResponse | null) {
  if (!data) return 0;
  if (data.selectedInvoice) {
    const actual = Number(data.selectedInvoice.currentCharges ?? data.selectedInvoice.chargesAfterDiscount ?? 0);
    const discounted = Number(data.selectedInvoice.chargesAfterDiscount ?? 0);
    return Number(data.selectedInvoice.perMonthDiscount ?? Math.max(actual - discounted, 0));
  }
  const actual = getActualMonthlyCharge(data);
  const discounted = getApplicableMonthlyCharge(data);
  return Number(data.perMonthDiscount ?? data.monthlyDiscount ?? Math.max(actual - discounted, 0));
}

function money(value: number) {
  return Number(value || 0).toLocaleString('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 2,
  });
}

function calculateStatus(totalDue: number, paid: number): InvoiceStatus {
  const remaining = Math.max(totalDue - paid, 0);
  if (remaining <= 0 && totalDue > 0) return 'paid';
  if (paid > 0) return 'partially_paid';
  return 'unpaid';
}

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="heroStat">
      <div className="heroStatLabel">{title}</div>
      <div className="heroStatValue">{value}</div>
      <div className="heroStatSub">{subtitle}</div>
    </div>
  );
}

function getRowCategory(row: Row) {
  return row.chargeCategoryLabel || row.plotCategory || row.chargeCategory || row.category || 'General';
}

function shortMoney(value: number) {
  const amount = Number(value || 0);
  if (amount >= 1000000) return `PKR ${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `PKR ${(amount / 1000).toFixed(0)}K`;
  return `PKR ${amount.toFixed(0)}`;
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const extraClass = title.toLowerCase().includes('unpaid dues') ? ' unpaidDuesCard' : '';
  return (
    <div className={`flatChartCard${extraClass}`}>
      <div className="flatChartHead">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <div className="chartDots">↻ ⋮</div>
      </div>
      {children}
    </div>
  );
}

function TotalCollectionChart({ items, total }: { items: Array<{ category: string; paid: number }>; total: number }) {
  const safeItems = items.length ? items : [{ category: 'No Data', paid: 0 }];
  const max = Math.max(...safeItems.map((i) => i.paid), 1);
  const points = safeItems.map((item, index) => {
    const x = safeItems.length === 1 ? 300 : 38 + (index * 524) / Math.max(safeItems.length - 1, 1);
    const y = 178 - (item.paid / max) * 118;
    return `${x},${y}`;
  }).join(' ');
  const area = `38,190 ${points} 562,190`;
  const topCategory = [...safeItems].sort((a, b) => b.paid - a.paid)[0];
  return (
    <div className="modernCollectionChart">
      <div className="modernMetricRow">
        <div>
          <span>Total Collection</span>
          <strong>{shortMoney(total)}</strong>
        </div>
        <div>
          <span>Top Category</span>
          <strong>{topCategory?.category || 'No Data'}</strong>
        </div>
      </div>
      <svg viewBox="0 0 600 210" role="img" aria-label="Total collection amount chart">
        <defs>
          <linearGradient id="collectionFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#7c6bd6" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#17c3ad" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="collectionLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#17c3ad" />
            <stop offset="100%" stopColor="#7c6bd6" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((line) => <line key={line} x1="38" x2="562" y1={60 + line * 38} y2={60 + line * 38} />)}
        <polygon points={area} />
        <polyline points={points} />
        {safeItems.map((item, index) => {
          const x = safeItems.length === 1 ? 300 : 38 + (index * 524) / Math.max(safeItems.length - 1, 1);
          const y = 178 - (item.paid / max) * 118;
          return <circle key={item.category} cx={x} cy={y} r="5" />;
        })}
      </svg>
      <div className="modernLegendRow">{safeItems.map((item) => <span key={item.category}>{item.category}</span>)}</div>
    </div>
  );
}

function VerticalCategoryChart({ items }: { items: Array<{ category: string; paid: number }> }) {
  const safeItems = items.length ? items : [{ category: 'No Data', paid: 0 }];
  const max = Math.max(...safeItems.map((i) => i.paid), 1);
  return (
    <div className="modernVerticalBars">
      {safeItems.map((item) => {
        const height = Math.max((item.paid / max) * 100, item.paid ? 12 : 0);
        return (
          <div className="modernVBarItem" key={item.category}>
            <div className="modernVBarValue">{shortMoney(item.paid)}</div>
            <div className="modernVBarTrack"><div className="modernVBar" style={{ height: `${height}%` }} /></div>
            <div className="modernVBarLabel" title={item.category}>{item.category}</div>
          </div>
        );
      })}
    </div>
  );
}

function HorizontalCategoryChart({ items }: { items: Array<{ category: string; unpaid: number }> }) {
  const safeItems = items.length ? items : [{ category: 'No Data', unpaid: 0 }];
  const max = Math.max(...safeItems.map((i) => i.unpaid), 1);
  return (
    <div className="modernHorizontalBars">
      {safeItems.map((item, index) => {
        const width = Math.max((item.unpaid / max) * 100, item.unpaid ? 8 : 0);
        return (
          <div className="modernHBarItem" key={item.category}>
            <div className="modernHBarTop">
              <span><b>{index + 1}</b>{item.category}</span>
              <strong>{shortMoney(item.unpaid)}</strong>
            </div>
            <div className="modernHBarTrack"><div className="modernHBar" style={{ width: `${width}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const searchParams = useSearchParams();
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [plotNo, setPlotNo] = useState('');
  const [selectedBillMonth, setSelectedBillMonth] = useState(monthInputValue());
  const [data, setData] = useState<InvoiceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [selectedPortionId, setSelectedPortionId] = useState('');
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) setSettings({ ...defaultSettings, ...JSON.parse(raw) });
    } catch {}
  }, []);

  async function loadDashboard() {
    setDashboardLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/dues`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to load dashboard');
      setAllRows(Array.isArray(json) ? json : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setDashboardLoading(false);
    }
  }

  async function fetchInvoices(targetPlot = plotNo, targetMonth = selectedBillMonth) {
    const cleanPlot = targetPlot.trim();
    if (!cleanPlot) {
      setError('Plot No. is required');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const portionQuery = selectedPortionId ? `&portionId=${encodeURIComponent(selectedPortionId)}` : '';
      const res = await fetch(`${API_BASE}/api/dues/${encodeURIComponent(cleanPlot)}/invoices?billMonth=${encodeURIComponent(targetMonth)}${portionQuery}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to fetch invoice data');
      setData(json);
    } catch (err: any) {
      setData(null);
      setError(err?.message || 'Failed to fetch invoice data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    const qp = searchParams.get('plot') || '';
    if (qp) {
      setPlotNo(qp);
      fetchInvoices(qp, selectedBillMonth);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generatedBy = `${settings.operatorName} (${settings.operatorRole})`;
  const previousDues = Number(data?.selectedInvoice?.previousDues ?? data?.previousDues ?? 0);
  const actualMonthlyCharges = getActualMonthlyCharge(data);
  const monthlyDiscount = getMonthlyDiscount(data);
  const monthlyCharges = getApplicableMonthlyCharge(data);
  const alreadyPaid = Number(data?.selectedInvoice?.installmentsPaid ?? 0);
  const totalDue = previousDues + monthlyCharges;
  const remaining = Math.max(totalDue - alreadyPaid, 0);
  const status = calculateStatus(totalDue, alreadyPaid);

  const stats = useMemo(() => {
    const totalHouses = allRows.length;
    const monthlyPaid = allRows.filter((r) => r.currentMonthStatus === 'paid').length;
    const monthlyUnpaid = allRows.filter((r) => r.currentMonthStatus === 'unpaid').length;
    const partiallyPaid = allRows.filter((r) => r.currentMonthStatus === 'partially_paid').length;
    return { totalHouses, monthlyPaid, monthlyUnpaid, partiallyPaid };
  }, [allRows]);

  const categorySummary = useMemo(() => {
    const map = new Map<string, { category: string; paid: number; unpaid: number; total: number }>();
    allRows.forEach((row) => {
      const category = getRowCategory(row);
      const paid = Number(row.amountPaid || 0);
      const unpaid = Number(row.remaining ?? row.totalDues ?? 0);
      const current = map.get(category) || { category, paid: 0, unpaid: 0, total: 0 };
      current.paid += paid;
      current.unpaid += Math.max(unpaid, 0);
      current.total += paid + Math.max(unpaid, 0);
      map.set(category, current);
    });
    const list = Array.from(map.values()).sort((a, b) => (b.paid + b.unpaid) - (a.paid + a.unpaid)).slice(0, 6);
    return list.length ? list : [{ category: 'No Data', paid: 0, unpaid: 0, total: 0 }];
  }, [allRows]);

  const totalCollectionAmount = useMemo(() => allRows.reduce((sum, row) => sum + Number(row.amountPaid || 0), 0), [allRows]);

  const suggestions = useMemo(() => {
    const q = plotNo.trim().toLowerCase();
    const base = q
      ? allRows.filter((r) => (`${r.plotNo} ${r.ownerName}`).toLowerCase().includes(q))
      : allRows;
    return base.slice(0, 8);
  }, [allRows, plotNo]);

  async function handleGenerateInvoice() {
    if (!data) return;
    setBusyAction(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/dues/${encodeURIComponent(data.plotNo)}/generate-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billMonth: selectedBillMonth,
          generatedBy,
          notes: invoiceNotes,
          paymentNotes,
          actualMonthlyCharges,
          monthlyCurrentCharges: actualMonthlyCharges,
          perMonthDiscount: monthlyDiscount,
          monthlyDiscount,
          monthlyCharges,
          chargesAfterDiscount: monthlyCharges,
          previousDues,
          paymentAmount: Number(paymentAmount || 0),
          portionId: data.portionId || (selectedPortionId ? Number(selectedPortionId) : null),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to generate invoice');
      setMessage('Invoice generated successfully. Payment status updated.');
      await Promise.all([fetchInvoices(data.plotNo, selectedBillMonth), loadDashboard()]);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate invoice');
    } finally {
      setBusyAction(false);
    }
  }

  const printableInvoice = data?.selectedInvoice;

  return (
    <div className="wrap wideWrap">
      <div className="pageGrid">
        {!data && (
          <section className="card wideCard heroCard no-print">
            <div className="pageHead">
              <div>
                <div className="heroEyebrow">Society management dashboard</div>
                <h1 className="heroTitle">Dashboard & Monthly Invoices</h1>
                <p className="p">Search plot records, enter received amount, and generate both society and resident invoice copies in one step.</p>
              </div>
              <div className="operatorCard">
                <span>Current operator</span>
                <strong>{generatedBy}</strong>
              </div>
            </div>

            <div className="heroStatsGrid">
              <StatCard title="Total Houses" value={dashboardLoading ? '...' : String(stats.totalHouses)} subtitle="All houses available in records" />
              <StatCard title="Monthly Paid" value={dashboardLoading ? '...' : String(stats.monthlyPaid)} subtitle="Fully paid for current month" />
              <StatCard title="Monthly Unpaid" value={dashboardLoading ? '...' : String(stats.monthlyUnpaid)} subtitle="No payment received" />
              <StatCard title="Partially Paid" value={dashboardLoading ? '...' : String(stats.partiallyPaid)} subtitle="Payment received but balance pending" />
            </div>
          </section>
        )}

        {!data && (
          <section className="flatChartsGrid no-print">
            <ChartCard title="Total Collection" subtitle="Total amount received from all records">
              <TotalCollectionChart items={categorySummary.map((item) => ({ category: item.category, paid: item.paid }))} total={totalCollectionAmount} />
            </ChartCard>
            <ChartCard title="Category Wise Payment" subtitle="Received amount by plot category">
              <VerticalCategoryChart items={categorySummary.map((item) => ({ category: item.category, paid: item.paid }))} />
            </ChartCard>
            <ChartCard title="Category Wise Unpaid Dues" subtitle="Pending dues by plot category">
              <HorizontalCategoryChart items={categorySummary.map((item) => ({ category: item.category, unpaid: item.unpaid }))} />
            </ChartCard>
          </section>
        )}

        <section className="card wideCard no-print">
          <div className="pageHead">
            <div>
              <h1 className="h1">Search & Manage Maintenance Invoice</h1>
              <p className="p">Search the plot from records, enter the received amount first, then generate the invoice directly.</p>
            </div>
          </div>

          <div className="searchRow">
            <div className="field growField">
              <label className="lbl">Plot No.</label>
              <input
                className="inp"
                list="plot-suggestions"
                value={plotNo}
                onChange={(e) => setPlotNo(e.target.value)}
                placeholder="Type plot no or owner name"
                onKeyDown={(e) => { if (e.key === 'Enter') fetchInvoices(); }}
              />
              <datalist id="plot-suggestions">
                {suggestions.map((item) => (
                  <option key={item.plotNo} value={item.plotNo}>{item.ownerName}</option>
                ))}
              </datalist>
            </div>
            <div className="field">
              <label className="lbl">Bill Month</label>
              <input className="inp" type="month" value={selectedBillMonth} onChange={(e) => setSelectedBillMonth(e.target.value)} />
            </div>
            <div className="stackEnd">
              <button className="btn primary" onClick={() => fetchInvoices()} disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {suggestions.length > 0 && plotNo.trim() && !data && (
            <div className="quickHints no-print">
              {suggestions.map((item) => (
                <button key={item.plotNo} className="hintChip" onClick={() => { setPlotNo(item.plotNo); fetchInvoices(item.plotNo, selectedBillMonth); }}>
                  {item.plotNo} · {item.ownerName || 'Owner'}
                </button>
              ))}
            </div>
          )}

          {data?.portions && data.portions.length > 0 && (
            <div className="subCard no-print" style={{ marginTop: 14 }}>
              <h3>House Portions</h3>
              <p className="p">This house has multiple portions. Select a portion to generate a separate invoice for that portion.</p>
              <div className="searchRow">
                <div className="field growField">
                  <label className="lbl">Select Portion</label>
                  <select className="inp" value={selectedPortionId || String(data.portionId || '')} onChange={(e) => setSelectedPortionId(e.target.value)}>
                    <option value="">Main House / Owner</option>
                    {data.portions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.portionName} {p.residentName ? `- ${p.residentName}` : ''} ({money(Number(p.chargesAfterDiscount || 0))})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="stackEnd">
                  <button className="btn primary" onClick={() => fetchInvoices(data.plotNo, selectedBillMonth)}>Load Portion</button>
                </div>
              </div>
            </div>
          )}

          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}

          {data && (
            <>
              <div className="infoGrid">
                <div className="infoTile"><span>{data.portionName ? 'Resident' : 'Owner'}</span><strong>{data.ownerName || '—'}</strong></div>
                {data.portionName && <div className="infoTile"><span>Portion</span><strong>{data.portionName}</strong></div>}
                <div className="infoTile"><span>Contact</span><strong>{data.contact || '—'}</strong></div>
                <div className="infoTile"><span>Previous Dues</span><strong>{money(previousDues)}</strong></div>
                <div className="infoTile"><span>Actual Monthly Charges</span><strong>{money(actualMonthlyCharges)}</strong></div>
                <div className="infoTile"><span>Monthly Discount</span><strong>{money(monthlyDiscount)}</strong></div>
                <div className="infoTile"><span>Discounted Monthly Charges</span><strong>{money(monthlyCharges)}</strong></div>
                <div className="infoTile"><span>Total Due</span><strong>{money(totalDue)}</strong></div>
                <div className="infoTile"><span>Status</span><strong className={`statusText ${status}`}>{status.replace('_', ' ').toUpperCase()}</strong></div>
              </div>

              <div className="actionGrid oneCol">
                <div className="subCard">
                  <h3>Generate Invoice</h3>
                  <div className="formGrid3">
                    <div className="field">
                      <label className="lbl">Generated By</label>
                      <div className="previewBox">{generatedBy}</div>
                    </div>
                    <div className="field">
                      <label className="lbl">Selected Bill Month</label>
                      <div className="previewBox">{data.selectedBillMonthLabel}</div>
                    </div>
                    <div className="field">
                      <label className="lbl">Remaining Amount</label>
                      <div className="previewBox">{money(remaining)}</div>
                    </div>
                    <div className="field">
                      <label className="lbl">Amount Received</label>
                      <input className="inp" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Enter received amount" />
                    </div>
                    <div className="field span2">
                      <label className="lbl">Payment / Invoice Notes</label>
                      <textarea className="inp ta" value={paymentNotes || invoiceNotes} onChange={(e) => { setPaymentNotes(e.target.value); setInvoiceNotes(e.target.value); }} placeholder="Optional note" />
                    </div>
                  </div>
                  <button className="btn primary full" onClick={handleGenerateInvoice} disabled={busyAction}>
                    {busyAction ? 'Generating...' : 'Generate Invoice'}
                  </button>
                  {data.payments?.length > 0 && (
                    <div className="paymentHistory">
                      <h4>Recent Payments</h4>
                      <div className="tableWrap">
                        <table className="tbl">
                          <thead><tr><th>Date</th><th>Amount</th><th>Received By</th><th>Notes</th></tr></thead>
                          <tbody>
                            {data.payments.map((item) => (
                              <tr key={item.id}>
                                <td>{item.paymentDate ? new Date(item.paymentDate).toLocaleString() : '—'}</td>
                                <td>{money(item.amountPaid)}</td>
                                <td>{item.receivedBy || '—'}</td>
                                <td>{item.notes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        {data && (
          <section className="card wideCard printArea">
            <div className="printCopies modernCopies">
              <InvoiceCopy title="Society Copy" data={data} invoice={printableInvoice} settings={settings} />
              <InvoiceCopy title="Resident Copy" data={data} invoice={printableInvoice} settings={settings} />
            </div>
            <div className="printActions no-print">
              <button className="btn" onClick={() => window.print()} disabled={!printableInvoice}>Print 2 Copies</button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function InvoiceCopy({ title, data, invoice, settings }: { title: string; data: InvoiceResponse; invoice: MonthlyInvoice | null | undefined; settings: Settings }) {
  const actualMonthlyCharges = invoice?.currentCharges ?? getActualMonthlyCharge(data);
  const monthlyDiscount = invoice?.perMonthDiscount ?? getMonthlyDiscount(data);
  const monthlyCharges = invoice?.chargesAfterDiscount ?? getApplicableMonthlyCharge(data);
  const previousDues = invoice?.previousDues ?? data.previousDues ?? 0;
  const paid = invoice?.installmentsPaid ?? 0;
  const remaining = invoice?.outstandingAmount ?? data.remaining ?? 0;
  const currentStatus = invoice?.status || data.currentMonthStatus || 'unpaid';

  return (
    <div className="invoiceDoc prettyInvoice">
      <div className="invoiceRibbon">{title}</div>
      <div className="invoiceHeader modernHeader">
        <div>
          <div className="invoiceTitle">{settings.societyName}</div>
          <div className="invoiceSub">{settings.societyArea}</div>
        </div>
        <div className="invoiceMetaRight">
          <div className="invoiceNumber">{invoice?.invoiceNumber || 'Pending'}</div>
          <div className={`badge status ${currentStatus}`}>{currentStatus.replace('_', ' ').toUpperCase()}</div>
        </div>
      </div>

      <div className="invoiceInfoGrid compactGrid">
        <div><span>Plot No.</span><strong>{data.plotNo}</strong></div>
        {data.portionName && <div><span>Portion</span><strong>{data.portionName}</strong></div>}
        <div><span>{data.portionName ? 'Resident' : 'Owner'}</span><strong>{data.ownerName || '—'}</strong></div>
        <div><span>Bill Month</span><strong>{data.selectedBillMonthLabel}</strong></div>
        <div><span>Generated By</span><strong>{invoice?.generatedBy || '—'}</strong></div>
      </div>

      <table className="invoiceTable">
        <tbody>
          <tr><td>Previous Dues</td><td>{money(previousDues)}</td></tr>
          <tr><td>Actual Monthly Charges</td><td>{money(actualMonthlyCharges)}</td></tr>
          <tr><td>Monthly Discount</td><td>- {money(monthlyDiscount)}</td></tr>
          <tr><td>Discounted Monthly Charges</td><td>{money(monthlyCharges)}</td></tr>
          <tr><td>Amount Paid</td><td>{money(paid)}</td></tr>
          <tr className="grandRow"><td>Remaining Amount</td><td>{money(remaining)}</td></tr>
        </tbody>
      </table>

      <div className="invoiceFooter modernFooter">
        <div>
          <div className="signLabel">Secretary</div>
          <div>{settings.secretaryName}</div>
          <div>{settings.secretaryDesignation}</div>
        </div>
        <div>
          <div className="signLabel">Date</div>
          <div>{invoice?.generatedAt ? new Date(invoice.generatedAt).toLocaleDateString() : new Date().toLocaleDateString()}</div>
        </div>
      </div>
    </div>
  );
}
