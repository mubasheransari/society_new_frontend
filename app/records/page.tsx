'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useState } from 'react';

type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid';

type Portion = {
  id?: number;
  portionName?: string;
  residentName?: string;
  residentNumber?: string;
  residentType?: string;
  chargeCategory?: string;
  chargeCategoryLabel?: string;
  currentCharges?: number;
  chargesAfterDiscount?: number;
  perMonthDiscount?: number;
  previousDues?: number;
  amountPaid?: number;
  remaining?: number;
  status?: string;
  openingMonth?: string | null;
  lastBilledMonth?: string | null;
};

type ApiRow = {
  id?: number;
  plotNo: string;
  currentResidentName?: string;
  residentName?: string;
  ownerName: string;
  currentResidentNumber?: string;
  ownerNumber?: string;
  contact?: string;
  plotCategory?: string;
  chargeCategory?: string;
  chargeCategoryLabel?: string;
  category?: string;
  totalDues: number;
  amountPaid: number;
  remaining: number;
  previousDues?: number;
  monthlyCharges?: number;
  categoryMonthlyCharge?: number;
  residentMonthlyCharge?: number;
  openingMonth?: string | null;
  lastBilledMonth?: string | null;
  currentMonthStatus?: InvoiceStatus;
  portions?: Portion[];
};

type ChargeOption = {
  value: string;
  label: string;
  ownerActualCharges: number;
  ownerDiscountedCharges: number;
  rentalActualCharges: number;
  rentalDiscountedCharges: number;
};

type PortionForm = {
  portionName: string;
  residentName: string;
  residentNumber: string;
  residentType: 'owner' | 'rental';
  chargeCategory: string;
  previousDues: string;
};

type PortionPaymentForm = {
  billMonth: string;
  amount: string;
  notes: string;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const emptyPortionForm: PortionForm = {
  portionName: '',
  residentName: '',
  residentNumber: '',
  residentType: 'owner',
  chargeCategory: '',
  previousDues: '',
};

const emptyPortionPaymentForm = (): PortionPaymentForm => ({
  billMonth: currentMonthKey(),
  amount: '',
  notes: '',
});

function toNumber(value: unknown) {
  const num = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : 0;
}

function money(value: number | undefined | null) {
  return Number(value || 0).toLocaleString('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 2 });
}

function currentMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return <div className="heroStat"><div className="heroStatLabel">{title}</div><div className="heroStatValue">{value}</div><div className="heroStatSub">{subtitle}</div></div>;
}

function statusText(value?: string) {
  return String(value || 'unpaid').replace('_', ' ').toUpperCase();
}

export default function RecordsPage() {
  const [rows, setRows] = useState<ApiRow[]>([]);
  const [chargeOptions, setChargeOptions] = useState<ChargeOption[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [addPortionRows, setAddPortionRows] = useState<Record<string, boolean>>({});
  const [portionForms, setPortionForms] = useState<Record<string, PortionForm>>({});
  const [savingPortion, setSavingPortion] = useState<Record<string, boolean>>({});
  const [activePaymentRows, setActivePaymentRows] = useState<Record<string, boolean>>({});
  const [portionPaymentForms, setPortionPaymentForms] = useState<Record<string, PortionPaymentForm>>({});
  const [savingPayment, setSavingPayment] = useState<Record<string, boolean>>({});

  async function load() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/dues`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to load records');
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }

  async function loadChargeOptions() {
    try {
      const res = await fetch(`${API_BASE}/api/dues/charges-config`, { cache: 'no-store' });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.message || 'Failed to load category charges');
      const options = (Array.isArray(data) ? data : []).map((item) => ({
        value: String(item.categoryCode || '').toUpperCase(),
        label: `${String(item.label || item.categoryCode || '').toUpperCase()}${item.yard ? ` (${item.yard} yd)` : ''}`,
        ownerActualCharges: toNumber(item.ownerActualCharges ?? item.actualCharges),
        ownerDiscountedCharges: toNumber(item.ownerDiscountedCharges ?? item.discountedCharges ?? item.monthlyCharges),
        rentalActualCharges: toNumber(item.rentalActualCharges),
        rentalDiscountedCharges: toNumber(item.rentalDiscountedCharges),
      })).filter((item) => item.value);
      setChargeOptions(options);
    } catch {
      setChargeOptions([]);
    }
  }

  useEffect(() => {
    load();
    loadChargeOptions();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      const resident = r.currentResidentName || r.residentName || '';
      const portionText = (r.portions || []).map((p) => `${p.portionName || ''} ${p.residentName || ''} ${p.residentNumber || ''}`).join(' ');
      const textMatch = !s || [r.plotNo, resident, r.ownerName, portionText].join(' ').toLowerCase().includes(s);
      const statusMatch = filter === 'all' || (r.currentMonthStatus || 'unpaid') === filter;
      return textMatch && statusMatch;
    });
  }, [q, rows, filter]);

  const filteredPortions = useMemo(() => {
    return filtered.flatMap((row) => {
      const portions = Array.isArray(row.portions) ? row.portions : [];
      return portions.map((portion) => ({ row, portion }));
    });
  }, [filtered]);

  function toggleRow(plotNo: string) {
    setOpenRows((prev) => ({ ...prev, [plotNo]: !prev[plotNo] }));
  }

  function toggleAddPortion(plotNo: string, row: ApiRow) {
    setAddPortionRows((prev) => ({ ...prev, [plotNo]: !prev[plotNo] }));
    setPortionForms((prev) => ({
      ...prev,
      [plotNo]: prev[plotNo] || {
        ...emptyPortionForm,
        chargeCategory: row.chargeCategory || row.plotCategory || row.category || '',
      },
    }));
  }

  function updatePortionForm(plotNo: string, patch: Partial<PortionForm>) {
    setPortionForms((prev) => ({
      ...prev,
      [plotNo]: { ...(prev[plotNo] || emptyPortionForm), ...patch },
    }));
  }


  function portionKey(plotNo: string, portionId?: number) {
    return `${plotNo}-${portionId || 'new'}`;
  }

  function togglePortionPayment(plotNo: string, portion: Portion) {
    const key = portionKey(plotNo, portion.id);
    setActivePaymentRows((prev) => ({ ...prev, [key]: !prev[key] }));
    setPortionPaymentForms((prev) => ({
      ...prev,
      [key]: prev[key] || emptyPortionPaymentForm(),
    }));
  }

  function updatePortionPaymentForm(key: string, patch: Partial<PortionPaymentForm>) {
    setPortionPaymentForms((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || emptyPortionPaymentForm()), ...patch },
    }));
  }

  async function submitPortionPayment(row: ApiRow, portion: Portion) {
    if (!portion.id) return setErr('Portion ID is missing. Refresh records and try again.');
    const key = portionKey(row.plotNo, portion.id);
    const form = portionPaymentForms[key] || emptyPortionPaymentForm();
    const paymentAmount = toNumber(form.amount);
    if (paymentAmount <= 0) return setErr('Please enter a valid payment amount.');

    setErr(null);
    setMessage(null);
    setSavingPayment((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/dues/${encodeURIComponent(row.plotNo)}/generate-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billMonth: form.billMonth || currentMonthKey(),
          generatedBy: 'System Admin (Super Admin)',
          notes: form.notes,
          paymentNotes: form.notes,
          portionId: portion.id,
          portionName: portion.portionName || '',
          residentName: portion.residentName || '',
          residentNumber: portion.residentNumber || '',
          actualMonthlyCharges: toNumber(portion.currentCharges),
          monthlyCurrentCharges: toNumber(portion.currentCharges),
          perMonthDiscount: toNumber(portion.perMonthDiscount),
          monthlyDiscount: toNumber(portion.perMonthDiscount),
          monthlyCharges: toNumber(portion.chargesAfterDiscount || portion.currentCharges),
          chargesAfterDiscount: toNumber(portion.chargesAfterDiscount || portion.currentCharges),
          previousDues: toNumber(portion.previousDues),
          paymentAmount,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to submit portion payment');
      setMessage(`Payment submitted for Plot ${row.plotNo} - ${portion.portionName || 'portion'}.`);
      setPortionPaymentForms((prev) => ({ ...prev, [key]: emptyPortionPaymentForm() }));
      setActivePaymentRows((prev) => ({ ...prev, [key]: false }));
      await load();
      setOpenRows((prev) => ({ ...prev, [row.plotNo]: true }));
    } catch (e: any) {
      setErr(e?.message || 'Failed to submit portion payment');
    } finally {
      setSavingPayment((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function savePortion(plotNo: string) {
    const form = portionForms[plotNo] || emptyPortionForm;
    if (!form.portionName.trim()) return setErr('Portion name is required.');
    if (!form.chargeCategory) return setErr('Portion category is required.');
    setErr(null);
    setMessage(null);
    setSavingPortion((prev) => ({ ...prev, [plotNo]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/dues/${encodeURIComponent(plotNo)}/portions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portionName: form.portionName.trim(),
          residentName: form.residentName.trim(),
          residentNumber: form.residentNumber.trim(),
          residentType: form.residentType,
          chargeCategory: form.chargeCategory,
          previousDues: toNumber(form.previousDues),
          openingMonth: currentMonthKey(),
          lastBilledMonth: currentMonthKey(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to save portion');
      setMessage(`Portion added successfully in plot ${plotNo}.`);
      setPortionForms((prev) => ({ ...prev, [plotNo]: { ...emptyPortionForm } }));
      setAddPortionRows((prev) => ({ ...prev, [plotNo]: false }));
      await load();
      setOpenRows((prev) => ({ ...prev, [plotNo]: true }));
    } catch (e: any) {
      setErr(e?.message || 'Failed to save portion');
    } finally {
      setSavingPortion((prev) => ({ ...prev, [plotNo]: false }));
    }
  }

  async function deletePortion(plotNo: string, portionId?: number) {
    if (!portionId) return;
    if (!window.confirm('Delete this portion?')) return;
    setErr(null);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/dues/${encodeURIComponent(plotNo)}/portions/${portionId}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to delete portion');
      setMessage('Portion deleted successfully.');
      await load();
      setOpenRows((prev) => ({ ...prev, [plotNo]: true }));
    } catch (e: any) {
      setErr(e?.message || 'Failed to delete portion');
    }
  }

  function residentDisplay(row: ApiRow) {
    return row.currentResidentName || row.residentName || '—';
  }

  function categoryDisplay(row: ApiRow) {
    return row.plotCategory || row.chargeCategoryLabel || row.chargeCategory || row.category || '—';
  }

  const stats = useMemo(() => {
    const totalHouses = rows.length;
    const monthlyPaid = rows.filter((r) => r.currentMonthStatus === 'paid').length;
    const monthlyUnpaid = rows.filter((r) => r.currentMonthStatus === 'unpaid').length;
    const partiallyPaid = rows.filter((r) => r.currentMonthStatus === 'partially_paid').length;
    return { totalHouses, monthlyPaid, monthlyUnpaid, partiallyPaid };
  }, [rows]);

  async function upload() {
    if (!file) return setErr('Please choose an Excel file first.');
    setUploading(true);
    setErr(null);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/api/dues/upload`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Upload failed');
      setMessage(data?.message || 'File uploaded successfully.');
      setFile(null);
      const input = document.getElementById('recordsExcelUpload') as HTMLInputElement | null;
      if (input) input.value = '';
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="wrap wideWrap">
      <div className="card recordsCard">
        <div className="pageHead">
          <div>
            <h1 className="h1">Records</h1>
            <p className="p">Upload files, track monthly payment status, add portions to existing plots, and open invoice details from one place.</p>
          </div>
          <Link href="/" className="btn primary no-print">Back to Dashboard</Link>
        </div>

        <div className="heroStatsGrid" style={{ marginBottom: 18 }}>
          <StatCard title="Total Houses" value={String(stats.totalHouses)} subtitle="All available records" />
          <StatCard title="Monthly Paid" value={String(stats.monthlyPaid)} subtitle="Fully paid for current month" />
          <StatCard title="Monthly Unpaid" value={String(stats.monthlyUnpaid)} subtitle="No payment received" />
          <StatCard title="Partially Paid" value={String(stats.partiallyPaid)} subtitle="Balance still pending" />
        </div>

        <div className="subCard" style={{ marginBottom: 16 }}>
          <div className="sectionTitleRow"><h2 className="h2">File Uploading</h2></div>
          <div className="searchRow">
            <div className="field growField">
              <label className="lbl">Excel File (.xlsx)</label>
              <input id="recordsExcelUpload" className="inp" type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="stackEnd"><button className="btn primary" onClick={upload} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload File'}</button></div>
          </div>
          {message && <div className="alert success">{message}</div>}
        </div>

        <div className="searchRow">
          <div className="field growField">
            <label className="lbl">Search</label>
            <input className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by plot no, resident name, owner name, or portion" />
          </div>
          <div className="stackEnd"><button className="btn" onClick={load} disabled={loading}>Refresh</button></div>
        </div>

        <div className="tabRow no-print" style={{ marginBottom: 14 }}>
          {[
            ['all', 'All'],
            ['paid', 'Paid'],
            ['unpaid', 'Unpaid'],
            ['partially_paid', 'Partially Paid'],
          ].map(([value, label]) => (
            <button key={value} className={`tabBtn ${filter === value ? 'active' : ''}`} onClick={() => setFilter(value as any)}>{label}</button>
          ))}
        </div>

        {err && <div className="alert error">{err}</div>}

        {!loading && (
          <div className="subCard" style={{ marginBottom: 18 }}>
            <div className="sectionTitleRow" style={{ alignItems: 'center' }}>
              <div>
                <h2 className="h2">Portions Overview</h2>
                <p className="p">All portions added inside existing plots are shown here before the main records list.</p>
              </div>
              <span className="badge soft">{filteredPortions.length} portion{filteredPortions.length === 1 ? '' : 's'}</span>
            </div>

            {filteredPortions.length === 0 ? (
              <div className="mutedBlock">No portions added in the selected records yet.</div>
            ) : (
              <div className="tableWrap">
                <table className="tbl wideTbl">
                  <thead>
                    <tr>
                      <th>Main Plot / Portion</th>
                      <th>Resident</th>
                      <th>Number</th>
                      <th>Dues Type</th>
                      <th>Category</th>
                      <th className="r">Actual Charge</th>
                      <th className="r">Discounted Charge</th>
                      <th className="r">Previous Dues</th>
                      <th className="r">Remaining</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPortions.map(({ row, portion }, idx) => {
                      const key = portionKey(row.plotNo, portion.id);
                      const paymentForm = portionPaymentForms[key] || emptyPortionPaymentForm();
                      const isPayOpen = !!activePaymentRows[key];
                      return (
                        <Fragment key={portion.id || `${row.plotNo}-portion-${idx}`}>
                          <tr>
                            <td>
                              <div><strong>Plot {row.plotNo}</strong></div>
                              <div className="smallMuted">Portion: {portion.portionName || '—'}</div>
                            </td>
                            <td>{portion.residentName || '—'}</td>
                            <td>{portion.residentNumber || '—'}</td>
                            <td>{String(portion.residentType || 'owner').toUpperCase()}</td>
                            <td>{portion.chargeCategoryLabel || portion.chargeCategory || '—'}</td>
                            <td className="r">{money(portion.currentCharges || 0)}</td>
                            <td className="r">{money(portion.chargesAfterDiscount || 0)}</td>
                            <td className="r">{money(portion.previousDues || 0)}</td>
                            <td className="r">{money(portion.remaining || 0)}</td>
                            <td>
                              <span className={`badge status ${String(portion.status || 'UNPAID').toLowerCase().replace(' ', '_')}`}>
                                {String(portion.status || 'UNPAID').toUpperCase()}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button className="btn small primary" type="button" onClick={() => togglePortionPayment(row.plotNo, portion)}>
                                  {isPayOpen ? 'Cancel Payment' : 'Submit Payment'}
                                </button>
                                <button
                                  className="btn small"
                                  type="button"
                                  onClick={() => {
                                    setOpenRows((prev) => ({ ...prev, [row.plotNo]: true }));
                                    setTimeout(() => document.getElementById(`record-row-${row.plotNo}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
                                  }}
                                >
                                  View Plot
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isPayOpen && (
                            <tr>
                              <td colSpan={11}>
                                <div className="subCard" style={{ margin: 0, borderColor: '#d8d1ff' }}>
                                  <div className="sectionTitleRow"><h2 className="h2">Submit Payment - Plot {row.plotNo} / {portion.portionName || 'Portion'}</h2></div>
                                  <div className="formGrid3">
                                    <div className="field">
                                      <label className="lbl">Bill Month</label>
                                      <input className="inp" type="month" value={paymentForm.billMonth} onChange={(e) => updatePortionPaymentForm(key, { billMonth: e.target.value })} />
                                    </div>
                                    <div className="field">
                                      <label className="lbl">Amount Received</label>
                                      <input className="inp" inputMode="numeric" value={paymentForm.amount} onChange={(e) => updatePortionPaymentForm(key, { amount: e.target.value })} placeholder="Enter received amount" />
                                    </div>
                                    <div className="field">
                                      <label className="lbl">Payment Notes</label>
                                      <input className="inp" value={paymentForm.notes} onChange={(e) => updatePortionPaymentForm(key, { notes: e.target.value })} placeholder="Optional note" />
                                    </div>
                                  </div>
                                  <div className="chargeSummaryBox" style={{ marginTop: 12 }}>
                                    <div className="summaryTitle">Portion Payment Summary</div>
                                    <div className="summaryLine"><span>Main Plot</span><b>{row.plotNo}</b></div>
                                    <div className="summaryLine"><span>Portion</span><b>{portion.portionName || '—'}</b></div>
                                    <div className="summaryLine"><span>Resident</span><b>{portion.residentName || '—'}</b></div>
                                    <div className="summaryLine"><span>Remaining</span><b>{money(portion.remaining || 0)}</b></div>
                                  </div>
                                  <button className="btn primary" style={{ marginTop: 12 }} type="button" onClick={() => submitPortionPayment(row, portion)} disabled={!!savingPayment[key]}>
                                    {savingPayment[key] ? 'Submitting...' : 'Submit Portion Payment'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {loading ? <div className="mutedBlock">Loading records...</div> : (
          <div className="tableWrap">
            <table className="tbl wideTbl">
              <thead>
                <tr>
                  <th>Plot No</th>
                  <th>Current Resident</th>
                  <th className="r">Previous Dues</th>
                  <th className="r">Monthly Charges</th>
                  <th className="r">Amount Paid</th>
                  <th className="r">Remaining</th>
                  <th>Portions</th>
                  <th>Status</th>
                  <th>Details</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isOpen = !!openRows[r.plotNo];
                  const showAddPortion = !!addPortionRows[r.plotNo];
                  const portionForm = portionForms[r.plotNo] || emptyPortionForm;
                  const portions = Array.isArray(r.portions) ? r.portions : [];
                  const selectedCategory = chargeOptions.find((item) => item.value === portionForm.chargeCategory);
                  const isRental = portionForm.residentType === 'rental';
                  const actual = isRental ? selectedCategory?.rentalActualCharges : selectedCategory?.ownerActualCharges;
                  const discounted = isRental ? selectedCategory?.rentalDiscountedCharges : selectedCategory?.ownerDiscountedCharges;
                  const discount = Math.max(toNumber(actual) - toNumber(discounted), 0);
                  return (
                    <Fragment key={r.plotNo}>
                      <tr id={`record-row-${r.plotNo}`}>
                        <td className="mono">{r.plotNo}</td>
                        <td>{residentDisplay(r)}</td>
                        <td className="r">{money(r.previousDues || 0)}</td>
                        <td className="r">{money(r.monthlyCharges || 0)}</td>
                        <td className="r">{money(r.amountPaid || 0)}</td>
                        <td className="r">{money(r.remaining || 0)}</td>
                        <td>{portions.length ? <span className="badge soft">{portions.length} portion{portions.length > 1 ? 's' : ''}</span> : <span className="smallMuted">No portions</span>}</td>
                        <td><span className={`badge status ${r.currentMonthStatus || 'unpaid'}`}>{statusText(r.currentMonthStatus)}</span></td>
                        <td>
                          <button className="btn small" type="button" onClick={() => toggleRow(r.plotNo)} aria-expanded={isOpen}>
                            {isOpen ? '▲ Hide' : '▼ Show'}
                          </button>
                        </td>
                        <td><Link className="btn small" href={`/?plot=${encodeURIComponent(r.plotNo)}`}>Open</Link></td>
                      </tr>
                      {isOpen && (
                        <tr key={`${r.plotNo}-details`}>
                          <td colSpan={10}>
                            <div className="subCard" style={{ margin: 0 }}>
                              <div className="sectionTitleRow" style={{ alignItems: 'center' }}>
                                <div>
                                  <h2 className="h2">Plot Details</h2>
                                  <p className="p">Main plot details and all portions added inside this plot.</p>
                                </div>
                                <button className="btn small primary" type="button" onClick={() => toggleAddPortion(r.plotNo, r)}>
                                  {showAddPortion ? 'Cancel Portion' : '+ Add Portion'}
                                </button>
                              </div>

                              <div className="formGrid3">
                                <div><span className="smallMuted">Current Resident Name</span><strong>{residentDisplay(r)}</strong></div>
                                <div><span className="smallMuted">Owner Name</span><strong>{r.ownerName || '—'}</strong></div>
                                <div><span className="smallMuted">Plot Category</span><strong>{categoryDisplay(r)}</strong></div>
                                <div><span className="smallMuted">Current Resident Number</span><strong>{r.currentResidentNumber || r.contact || '—'}</strong></div>
                                <div><span className="smallMuted">Owner Number</span><strong>{r.ownerNumber || '—'}</strong></div>
                                <div><span className="smallMuted">Total Dues</span><strong>{money(r.totalDues || 0)}</strong></div>
                                <div><span className="smallMuted">Previous Dues</span><strong>{money(r.previousDues || 0)}</strong></div>
                                <div><span className="smallMuted">Monthly Charges</span><strong>{money(r.monthlyCharges || r.categoryMonthlyCharge || r.residentMonthlyCharge || 0)}</strong></div>
                                <div><span className="smallMuted">Remaining</span><strong>{money(r.remaining || 0)}</strong></div>
                                <div><span className="smallMuted">Opening Month</span><strong>{r.openingMonth || '—'}</strong></div>
                                <div><span className="smallMuted">Last Billed Month</span><strong>{r.lastBilledMonth || '—'}</strong></div>
                                <div><span className="smallMuted">Status</span><strong>{statusText(r.currentMonthStatus)}</strong></div>
                              </div>

                              {showAddPortion && (
                                <div className="subCard" style={{ marginTop: 16, borderColor: '#d8d1ff' }}>
                                  <div className="sectionTitleRow"><h2 className="h2">Add Portion in Plot {r.plotNo}</h2></div>
                                  <div className="formGrid3">
                                    <div className="field">
                                      <label className="lbl">Portion Name *</label>
                                      <input className="inp" value={portionForm.portionName} onChange={(e) => updatePortionForm(r.plotNo, { portionName: e.target.value })} placeholder="Ground Floor / First Floor" />
                                    </div>
                                    <div className="field">
                                      <label className="lbl">Resident Name</label>
                                      <input className="inp" value={portionForm.residentName} onChange={(e) => updatePortionForm(r.plotNo, { residentName: e.target.value })} />
                                    </div>
                                    <div className="field">
                                      <label className="lbl">Resident Number</label>
                                      <input className="inp" value={portionForm.residentNumber} onChange={(e) => updatePortionForm(r.plotNo, { residentNumber: e.target.value })} />
                                    </div>
                                    <div className="field">
                                      <label className="lbl">Dues Type</label>
                                      <select className="inp" value={portionForm.residentType} onChange={(e) => updatePortionForm(r.plotNo, { residentType: e.target.value as 'owner' | 'rental' })}>
                                        <option value="owner">Owner dues</option>
                                        <option value="rental">Rental dues</option>
                                      </select>
                                    </div>
                                    <div className="field">
                                      <label className="lbl">Portion Category *</label>
                                      <select className="inp" value={portionForm.chargeCategory} onChange={(e) => updatePortionForm(r.plotNo, { chargeCategory: e.target.value })}>
                                        <option value="">Select plot category</option>
                                        {chargeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                                      </select>
                                    </div>
                                    <div className="field">
                                      <label className="lbl">Opening Previous Dues</label>
                                      <input className="inp" inputMode="numeric" value={portionForm.previousDues} onChange={(e) => updatePortionForm(r.plotNo, { previousDues: e.target.value })} placeholder="0" />
                                    </div>
                                  </div>
                                  <div className="chargeSummaryBox" style={{ marginTop: 12 }}>
                                    <div className="summaryTitle">Portion Charge Summary</div>
                                    <div className="summaryLine"><span>Dues Type</span><b>{portionForm.residentType.toUpperCase()}</b></div>
                                    <div className="summaryLine"><span>Actual Monthly Charge</span><b>{money(toNumber(actual))}</b></div>
                                    <div className="summaryLine"><span>Discounted Monthly Charge</span><b>{money(toNumber(discounted))}</b></div>
                                    <div className="summaryLine"><span>Discount / Month</span><b>{money(discount)}</b></div>
                                    <div className="summaryLine"><span>Opening Previous Dues</span><b>{money(toNumber(portionForm.previousDues))}</b></div>
                                  </div>
                                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                                    <button className="btn primary" type="button" onClick={() => savePortion(r.plotNo)} disabled={!!savingPortion[r.plotNo]}>
                                      {savingPortion[r.plotNo] ? 'Saving...' : 'Save Portion'}
                                    </button>
                                    <button className="btn" type="button" onClick={() => toggleAddPortion(r.plotNo, r)}>Cancel</button>
                                  </div>
                                </div>
                              )}

                              <div style={{ marginTop: 18 }}>
                                <div className="sectionTitleRow"><h2 className="h2">House Portions</h2></div>
                                {portions.length === 0 ? (
                                  <div className="mutedBlock">No portions added in this plot yet.</div>
                                ) : (
                                  <div className="tableWrap">
                                    <table className="tbl wideTbl">
                                      <thead>
                                        <tr>
                                          <th>Main Plot / Portion</th>
                                          <th>Resident</th>
                                          <th>Number</th>
                                          <th>Dues Type</th>
                                          <th>Category</th>
                                          <th className="r">Actual Charge</th>
                                          <th className="r">Discounted Charge</th>
                                          <th className="r">Previous Dues</th>
                                          <th className="r">Remaining</th>
                                          <th>Status</th>
                                          <th>Action</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {portions.map((p, idx) => {
                                          const key = portionKey(r.plotNo, p.id);
                                          const paymentForm = portionPaymentForms[key] || emptyPortionPaymentForm();
                                          const isPayOpen = !!activePaymentRows[key];
                                          return (
                                            <Fragment key={p.id || `${r.plotNo}-${idx}`}>
                                              <tr>
                                                <td><div><strong>Plot {r.plotNo}</strong></div><div className="smallMuted">Portion: {p.portionName || '—'}</div></td>
                                                <td>{p.residentName || '—'}</td>
                                                <td>{p.residentNumber || '—'}</td>
                                                <td>{String(p.residentType || 'owner').toUpperCase()}</td>
                                                <td>{p.chargeCategoryLabel || p.chargeCategory || '—'}</td>
                                                <td className="r">{money(p.currentCharges || 0)}</td>
                                                <td className="r">{money(p.chargesAfterDiscount || 0)}</td>
                                                <td className="r">{money(p.previousDues || 0)}</td>
                                                <td className="r">{money(p.remaining || 0)}</td>
                                                <td><span className={`badge status ${String(p.status || 'UNPAID').toLowerCase().replace(' ', '_')}`}>{String(p.status || 'UNPAID').toUpperCase()}</span></td>
                                                <td>
                                                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                    <button className="btn small primary" type="button" onClick={() => togglePortionPayment(r.plotNo, p)}>{isPayOpen ? 'Cancel' : 'Payment'}</button>
                                                    <button className="btn small danger" type="button" onClick={() => deletePortion(r.plotNo, p.id)}>Delete</button>
                                                  </div>
                                                </td>
                                              </tr>
                                              {isPayOpen && (
                                                <tr>
                                                  <td colSpan={11}>
                                                    <div className="subCard" style={{ margin: 0, borderColor: '#d8d1ff' }}>
                                                      <div className="sectionTitleRow"><h2 className="h2">Submit Payment - Plot {r.plotNo} / {p.portionName || 'Portion'}</h2></div>
                                                      <div className="formGrid3">
                                                        <div className="field">
                                                          <label className="lbl">Bill Month</label>
                                                          <input className="inp" type="month" value={paymentForm.billMonth} onChange={(e) => updatePortionPaymentForm(key, { billMonth: e.target.value })} />
                                                        </div>
                                                        <div className="field">
                                                          <label className="lbl">Amount Received</label>
                                                          <input className="inp" inputMode="numeric" value={paymentForm.amount} onChange={(e) => updatePortionPaymentForm(key, { amount: e.target.value })} placeholder="Enter received amount" />
                                                        </div>
                                                        <div className="field">
                                                          <label className="lbl">Payment Notes</label>
                                                          <input className="inp" value={paymentForm.notes} onChange={(e) => updatePortionPaymentForm(key, { notes: e.target.value })} placeholder="Optional note" />
                                                        </div>
                                                      </div>
                                                      <div className="chargeSummaryBox" style={{ marginTop: 12 }}>
                                                        <div className="summaryTitle">Portion Payment Summary</div>
                                                        <div className="summaryLine"><span>Main Plot</span><b>{r.plotNo}</b></div>
                                                        <div className="summaryLine"><span>Portion</span><b>{p.portionName || '—'}</b></div>
                                                        <div className="summaryLine"><span>Resident</span><b>{p.residentName || '—'}</b></div>
                                                        <div className="summaryLine"><span>Remaining</span><b>{money(p.remaining || 0)}</b></div>
                                                      </div>
                                                      <button className="btn primary" style={{ marginTop: 12 }} type="button" onClick={() => submitPortionPayment(r, p)} disabled={!!savingPayment[key]}>
                                                        {savingPayment[key] ? 'Submitting...' : 'Submit Portion Payment'}
                                                      </button>
                                                    </div>
                                                  </td>
                                                </tr>
                                              )}
                                            </Fragment>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={10} className="mutedCell">No records found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
