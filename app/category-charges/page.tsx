'use client';

import { useEffect, useMemo, useState } from 'react';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

type ChargeRow = {
  categoryCode: string;
  label: string;
  yard: number;
  ownerActualCharges: number;
  ownerDiscountedCharges: number;
  rentalActualCharges: number;
  rentalDiscountedCharges: number;
  monthlyCharges?: number;
};

const emptyRow: ChargeRow = {
  categoryCode: '',
  label: '',
  yard: 0,
  ownerActualCharges: 0,
  ownerDiscountedCharges: 0,
  rentalActualCharges: 0,
  rentalDiscountedCharges: 0,
};

function toNumber(value: string | number | null | undefined) {
  const clean = String(value ?? '').replace(/[^0-9.-]/g, '');
  const num = Number(clean);
  return Number.isFinite(num) ? num : 0;
}

function money(value: number) {
  return Number(value || 0).toLocaleString('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function normalizeRow(item: any): ChargeRow {
  const ownerActual = toNumber(item.ownerActualCharges ?? item.actualCharges ?? item.actualMonthlyCharges ?? item.currentOwnerDues ?? item.monthlyCharges);
  const ownerDiscounted = toNumber(item.ownerDiscountedCharges ?? item.discountedCharges ?? item.discountedMonthlyCharges ?? item.revisedOwnerDues ?? item.monthlyCharges ?? ownerActual);
  const rentalActual = toNumber(item.rentalActualCharges ?? item.currentRentalDues ?? item.rentalCharges);
  const rentalDiscounted = toNumber(item.rentalDiscountedCharges ?? item.revisedRentalDues ?? item.rentalMonthlyCharges ?? rentalActual);
  return {
    categoryCode: String(item.categoryCode || item.value || '').toUpperCase(),
    label: String(item.label || item.categoryCode || '').toUpperCase(),
    yard: toNumber(item.yard),
    ownerActualCharges: ownerActual,
    ownerDiscountedCharges: ownerDiscounted,
    rentalActualCharges: rentalActual,
    rentalDiscountedCharges: rentalDiscounted,
    monthlyCharges: ownerDiscounted,
  };
}

function rowPayload(row: ChargeRow) {
  return {
    categoryCode: row.categoryCode.trim().toUpperCase(),
    label: (row.label || row.categoryCode).trim().toUpperCase(),
    yard: toNumber(row.yard),
    ownerActualCharges: toNumber(row.ownerActualCharges),
    ownerDiscountedCharges: toNumber(row.ownerDiscountedCharges),
    ownerDiscount: Math.max(toNumber(row.ownerActualCharges) - toNumber(row.ownerDiscountedCharges), 0),
    rentalActualCharges: toNumber(row.rentalActualCharges),
    rentalDiscountedCharges: toNumber(row.rentalDiscountedCharges),
    rentalDiscount: Math.max(toNumber(row.rentalActualCharges) - toNumber(row.rentalDiscountedCharges), 0),
    monthlyCharges: toNumber(row.ownerDiscountedCharges),
  };
}

export default function CategoryChargesPage() {
  const [rows, setRows] = useState<ChargeRow[]>([]);
  const [newRow, setNewRow] = useState<ChargeRow>(emptyRow);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc.ownerActual += toNumber(row.ownerActualCharges);
    acc.ownerDiscounted += toNumber(row.ownerDiscountedCharges);
    acc.rentalActual += toNumber(row.rentalActualCharges);
    acc.rentalDiscounted += toNumber(row.rentalDiscountedCharges);
    return acc;
  }, { ownerActual: 0, ownerDiscounted: 0, rentalActual: 0, rentalDiscounted: 0 }), [rows]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_BASE}/api/dues/charges-config`, { cache: 'no-store' });
      const json = await res.json().catch(() => []);
      if (!res.ok) throw new Error(json?.message || 'Failed to load category charges');
      setRows((Array.isArray(json) ? json : []).map(normalizeRow));
    } catch (e: any) {
      setErr(e?.message || 'Failed to load category charges');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function setRow(index: number, key: keyof ChargeRow, value: string | number) {
    setRows((prev) => prev.map((row, i) => i === index ? {
      ...row,
      [key]: key === 'categoryCode' || key === 'label' ? String(value).toUpperCase() : toNumber(value),
    } : row));
  }

  function setNewField(key: keyof ChargeRow, value: string | number) {
    setNewRow((prev) => ({
      ...prev,
      [key]: key === 'categoryCode' || key === 'label' ? String(value).toUpperCase() : toNumber(value),
    }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const payload = rows.map(rowPayload);
      const res = await fetch(`${API_BASE}/api/dues/charges-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to save category charges');
      setRows((json.items || payload).map(normalizeRow));
      setMsg(`Category charges updated successfully. ${json.updatedHouses || 0} existing house record(s) updated.`);
    } catch (e: any) {
      setErr(e?.message || 'Failed to save category charges');
    } finally {
      setSaving(false);
    }
  }

  async function addCategory() {
    setAdding(true);
    setMsg(null);
    setErr(null);
    try {
      if (!newRow.categoryCode.trim()) throw new Error('Category code is required');
      if (!newRow.label.trim()) throw new Error('Category label is required');
      const res = await fetch(`${API_BASE}/api/dues/charges-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rowPayload(newRow)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to add category');
      setRows((json.items || []).map(normalizeRow));
      setNewRow(emptyRow);
      setMsg('New category added successfully. It will now appear in Add New House.');
    } catch (e: any) {
      setErr(e?.message || 'Failed to add category');
    } finally {
      setAdding(false);
    }
  }

  async function deleteCategory(code: string) {
    if (!confirm(`Delete category ${code}? Existing houses will keep their saved category but this option will be removed from new selections.`)) return;
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/dues/charges-config/${encodeURIComponent(code)}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to delete category');
      setRows((json.items || []).map(normalizeRow));
      setMsg('Category deleted successfully.');
    } catch (e: any) {
      setErr(e?.message || 'Failed to delete category');
    }
  }

  return (
    <div className="wrap wideWrap">
      <div className="card wideCard">
        <div className="pageHead">
          <div>
            <h1 className="h1">Category Charges</h1>
            <p className="p">Display and manage actual charges, discounted charges, and monthly discount category-wise.</p>
          </div>
          <button className="btn" onClick={load} disabled={loading}>Refresh</button>
        </div>

        <div className="infoNote">
          <strong>How this works</strong>
          <span>Actual charges are the original dues. Discounted charges are the revised payable dues. Future invoices use the owner discounted amount by default. Add New House will show these category options automatically.</span>
        </div>

   

        <div className="sectionTitle">Add New Category</div>
        <div className="formGrid4 compactGrid">
          <div className="field"><label className="lbl">Category</label><input className="inp" value={newRow.categoryCode} onChange={(e) => setNewField('categoryCode', e.target.value)} placeholder="G" /></div>
          <div className="field"><label className="lbl">Label</label><input className="inp" value={newRow.label} onChange={(e) => setNewField('label', e.target.value)} placeholder="G" /></div>
          <div className="field"><label className="lbl">Yards</label><input className="inp" inputMode="numeric" value={newRow.yard || ''} onChange={(e) => setNewField('yard', e.target.value)} placeholder="120" /></div>
          <div className="field"><label className="lbl">Owner actual</label><input className="inp" inputMode="numeric" value={newRow.ownerActualCharges || ''} onChange={(e) => setNewField('ownerActualCharges', e.target.value)} /></div>
          <div className="field"><label className="lbl">Owner discounted</label><input className="inp" inputMode="numeric" value={newRow.ownerDiscountedCharges || ''} onChange={(e) => setNewField('ownerDiscountedCharges', e.target.value)} /></div>
          <div className="field"><label className="lbl">Rental actual</label><input className="inp" inputMode="numeric" value={newRow.rentalActualCharges || ''} onChange={(e) => setNewField('rentalActualCharges', e.target.value)} /></div>
          <div className="field"><label className="lbl">Rental discounted</label><input className="inp" inputMode="numeric" value={newRow.rentalDiscountedCharges || ''} onChange={(e) => setNewField('rentalDiscountedCharges', e.target.value)} /></div>
          <div className="field actionField"><button className="btn primary" onClick={addCategory} disabled={adding}>{adding ? 'Adding...' : 'Add Category'}</button></div>
        </div>

        <div className="sectionTitle">Existing Category Charges</div>
        {loading ? <div className="p">Loading category charges...</div> : (
          <div className="tableWrap">
            <table className="tbl categoryTbl">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Label</th>
                  <th>Yards</th>
                  <th>Owner actual</th>
                  <th>Owner discounted</th>
                  <th>Owner discount</th>
                  <th>Rental actual</th>
                  <th>Rental discounted</th>
                  <th>Rental discount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const ownerDiscount = Math.max(toNumber(row.ownerActualCharges) - toNumber(row.ownerDiscountedCharges), 0);
                  const rentalDiscount = Math.max(toNumber(row.rentalActualCharges) - toNumber(row.rentalDiscountedCharges), 0);
                  return (
                    <tr key={row.categoryCode || index}>
                      <td><input className="inp codeInp" value={row.categoryCode} onChange={(e) => setRow(index, 'categoryCode', e.target.value)} /></td>
                      <td><input className="inp" value={row.label} onChange={(e) => setRow(index, 'label', e.target.value)} /></td>
                      <td><input className="inp smallInp" inputMode="numeric" value={row.yard || ''} onChange={(e) => setRow(index, 'yard', e.target.value)} /></td>
                      <td><input className="inp" inputMode="numeric" value={row.ownerActualCharges || ''} onChange={(e) => setRow(index, 'ownerActualCharges', e.target.value)} /></td>
                      <td><input className="inp" inputMode="numeric" value={row.ownerDiscountedCharges || ''} onChange={(e) => setRow(index, 'ownerDiscountedCharges', e.target.value)} /></td>
                      <td><strong>{money(ownerDiscount)}</strong></td>
                      <td><input className="inp" inputMode="numeric" value={row.rentalActualCharges || ''} onChange={(e) => setRow(index, 'rentalActualCharges', e.target.value)} /></td>
                      <td><input className="inp" inputMode="numeric" value={row.rentalDiscountedCharges || ''} onChange={(e) => setRow(index, 'rentalDiscountedCharges', e.target.value)} /></td>
                      <td><strong>{money(rentalDiscount)}</strong></td>
                      <td><button className="btn danger" onClick={() => deleteCategory(row.categoryCode)}>Delete</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {err && <div className="alert error">{err}</div>}
        {msg && <div className="alert success">{msg}</div>}

        <div className="actions">
          <button className="btn primary" onClick={save} disabled={saving || loading}>{saving ? 'Saving...' : 'Save All Category Charges'}</button>
        </div>
      </div>
    </div>
  );
}
