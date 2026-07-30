
'use client';

import { useEffect, useMemo, useState } from 'react';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

const DEFAULT_CHARGE_OPTIONS = [
  { value: '', label: 'Select plot category', monthlyCharge: 0, actualCharge: 0, discount: 0, rentalMonthlyCharge: 0, rentalActualCharge: 0, rentalDiscount: 0 },
];

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

function currentMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export default function AddHousePage() {
  const [form, setForm] = useState({
    plotNo: '',
    currentResidentName: '',
    ownerName: '',
    currentResidentNumber: '',
    ownerNumber: '',
    ownerCnic: '',
    plotMeasureSqYds: '',
    relationType: 'S/O',
    relationName: '',
    chargeCategory: '',
    previousDues: '',
    residentType: 'owner',
  });
  const [loading, setLoading] = useState(false);
  const [chargeOptions, setChargeOptions] = useState(DEFAULT_CHARGE_OPTIONS);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [portions, setPortions] = useState<Array<{ portionName: string; residentName: string; residentNumber: string; residentType: string; chargeCategory: string; previousDues: string }>>([]);

  const selectedCategory = useMemo(
    () => chargeOptions.find((item) => item.value === form.chargeCategory) || chargeOptions[0],
    [chargeOptions, form.chargeCategory]
  );

  const previousDuesNum = toNumber(form.previousDues);
  const isRental = form.residentType === 'rental';
  const categoryActualCharge = isRental ? selectedCategory.rentalActualCharge : selectedCategory.actualCharge;
  const categoryMonthlyCharge = isRental ? selectedCategory.rentalMonthlyCharge : selectedCategory.monthlyCharge;
  const categoryDiscount = Math.max(categoryActualCharge - categoryMonthlyCharge, 0);
  const openingMonth = currentMonthKey();

  // IMPORTANT:
  // While adding a new house, do NOT add category monthly charge immediately.
  // The entered Previous Dues already represents the opening balance.
  // Category monthly charge is stored separately as the resident/category rate.
  // It must be applied only when billing moves to the next month, for example June -> July.
  const openingDue = previousDuesNum;
  const statusPreview = openingDue > 0 ? 'UNPAID' : 'PAID';

  useEffect(() => {
    async function loadCategoryCharges() {
      try {
        const res = await fetch(`${API_BASE}/api/dues/charges-config`, { cache: 'no-store' });
        const json = await res.json().catch(() => []);
        if (!res.ok) throw new Error(json?.message || 'Failed to load category charges');
        const options = (Array.isArray(json) ? json : []).map((item) => ({
          value: String(item.categoryCode || '').toUpperCase(),
          label: `${String(item.label || item.categoryCode || '').toUpperCase()}${item.yard ? ` (${item.yard} yd)` : ''}`,
          monthlyCharge: toNumber(item.ownerDiscountedCharges ?? item.discountedCharges ?? item.monthlyCharges ?? item.monthlyCharge),
          actualCharge: toNumber(item.ownerActualCharges ?? item.actualCharges ?? item.monthlyCharges ?? item.monthlyCharge),
          discount: toNumber(item.ownerDiscount ?? Math.max(toNumber(item.ownerActualCharges ?? item.actualCharges ?? item.monthlyCharges ?? item.monthlyCharge) - toNumber(item.ownerDiscountedCharges ?? item.discountedCharges ?? item.monthlyCharges ?? item.monthlyCharge), 0)),
          rentalMonthlyCharge: toNumber(item.rentalDiscountedCharges ?? item.rentalMonthlyCharges),
          rentalActualCharge: toNumber(item.rentalActualCharges ?? item.rentalCharges),
          rentalDiscount: toNumber(item.rentalDiscount ?? Math.max(toNumber(item.rentalActualCharges ?? item.rentalCharges) - toNumber(item.rentalDiscountedCharges ?? item.rentalMonthlyCharges), 0)),
        })).filter((item) => item.value);
        setChargeOptions([{ value: '', label: 'Select plot category', monthlyCharge: 0, actualCharge: 0, discount: 0, rentalMonthlyCharge: 0, rentalActualCharge: 0, rentalDiscount: 0 }, ...options]);
      } catch {
        setChargeOptions(DEFAULT_CHARGE_OPTIONS);
      }
    }
    loadCategoryCharges();
  }, []);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave() {
    setMsg(null);
    setErr(null);

    if (!form.plotNo.trim()) return setErr('Plot No. is required');
    if (!form.chargeCategory) return setErr('Plot Category is required');

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/dues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plotNo: form.plotNo.trim(),
          currentResidentName: form.currentResidentName.trim(),
          ownerName: form.ownerName.trim(),
          currentResidentNumber: form.currentResidentNumber.trim(),
          ownerNumber: form.ownerNumber.trim(),
          ownerCnic: form.ownerCnic.trim(),
          plotMeasureSqYds: form.plotMeasureSqYds.trim(),
          relationType: form.relationType,
          relationName: form.relationName.trim(),
          plotCategory: form.chargeCategory,
          chargeCategory: form.chargeCategory,
          previousDues: previousDuesNum,
          // Do not send monthlyCharges as the current due on create because some backends
          // add monthlyCharges into remaining/totalDues immediately.
          // categoryMonthlyCharge/residentMonthlyCharge keeps the rate for future month-change billing.
          monthlyCharges: 0,
          currentMonthCharges: 0,
          residentType: form.residentType,
          categoryActualCharge,
          categoryMonthlyCharge,
          residentMonthlyCharge: categoryMonthlyCharge,
          perMonthDiscount: categoryDiscount,
          amountPaid: 0,
          totalDues: openingDue,
          remaining: openingDue,
          currentMonthStatus: statusPreview.toLowerCase(),
          openingMonth,
          lastBilledMonth: openingMonth,
          skipMonthlyChargeOnCreate: true,
          portions: portions.map((p) => ({
            portionName: p.portionName,
            residentName: p.residentName,
            residentNumber: p.residentNumber,
            residentType: p.residentType,
            chargeCategory: p.chargeCategory || form.chargeCategory,
            previousDues: toNumber(p.previousDues),
            openingMonth,
            lastBilledMonth: openingMonth,
          })).filter((p) => p.portionName),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Save failed');
      setMsg('House saved successfully. Opening dues saved only from Previous Dues. Category monthly charge will be added when the next month is billed. Resident login is Plot No + 123456.');
    } catch (e: any) {
      setErr(e?.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap wideWrap">
      <div className="card wideCard">
        <div className="pageHead">
          <div>
            <h1 className="h1">Add / Update House</h1>
            <p className="p">Save plot details and opening dues. Category monthly charge is stored for future monthly billing only.</p>
          </div>
        </div>

        <div className="formGrid3">
          <div className="field">
            <label className="lbl">Plot No. *</label>
            <input className="inp" value={form.plotNo} onChange={(e) => setField('plotNo', e.target.value)} />
          </div>
          <div className="field">
            <label className="lbl">Current Resident Name</label>
            <input className="inp" value={form.currentResidentName} onChange={(e) => setField('currentResidentName', e.target.value)} />
          </div>
          <div className="field">
            <label className="lbl">Owner Name</label>
            <input className="inp" value={form.ownerName} onChange={(e) => setField('ownerName', e.target.value)} />
          </div>
          <div className="field">
            <label className="lbl">Current Resident Number</label>
            <input className="inp" value={form.currentResidentNumber} onChange={(e) => setField('currentResidentNumber', e.target.value)} />
          </div>
          <div className="field">
            <label className="lbl">Owner Number</label>
            <input className="inp" value={form.ownerNumber} onChange={(e) => setField('ownerNumber', e.target.value)} />
          </div>
          <div className="field">
            <label className="lbl">Owner CNIC</label>
            <input className="inp" value={form.ownerCnic} onChange={(e) => setField('ownerCnic', e.target.value)} placeholder="e.g. 42101-1234567-1" />
          </div>
          <div className="field">
            <label className="lbl">Plot Measure (Sq. Yds)</label>
            <input className="inp" value={form.plotMeasureSqYds} onChange={(e) => setField('plotMeasureSqYds', e.target.value)} placeholder="Leave blank to use the Plot Category's registered size" />
          </div>
          <div className="field">
            <label className="lbl">Relation Type (for NOC documents)</label>
            <select className="inp" value={form.relationType} onChange={(e) => setField('relationType', e.target.value)}>
              <option value="S/O">S/O (Son of)</option>
              <option value="W/O">W/O (Wife of)</option>
              <option value="D/O">D/O (Daughter of)</option>
            </select>
          </div>
          <div className="field">
            <label className="lbl">Relation Name (Father/Husband Name)</label>
            <input className="inp" value={form.relationName} onChange={(e) => setField('relationName', e.target.value)} placeholder="e.g. Abdul Karim — shown on generated NOCs" />
          </div>
          <div className="field">
            <label className="lbl">Plot Category *</label>
            <select className="inp" value={form.chargeCategory} onChange={(e) => setField('chargeCategory', e.target.value)}>
              {chargeOptions.map((opt) => (
                <option key={opt.value || 'empty'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="lbl">Dues Type</label>
            <select className="inp" value={form.residentType} onChange={(e) => setField('residentType', e.target.value)}>
              <option value="owner">Owner dues</option>
              <option value="rental">Rental dues</option>
            </select>
          </div>
          <div className="field">
            <label className="lbl">Previous Dues</label>
            <input className="inp" inputMode="numeric" value={form.previousDues} onChange={(e) => setField('previousDues', e.target.value)} placeholder="0" />
          </div>

          <div className="chargeSummaryBox">
            <div className="summaryTitle">Charge Summary</div>
            <div className="summaryLine"><span>Dues Type</span><strong>{form.residentType === 'rental' ? 'RENTAL' : 'OWNER'}</strong></div>
            <div className="summaryLine"><span>Actual Monthly Charge</span><strong>{money(categoryActualCharge)}</strong></div>
            <div className="summaryLine"><span>Discounted Monthly Charge</span><strong>{money(categoryMonthlyCharge)}</strong></div>
            <div className="summaryLine"><span>Discount / Month</span><strong>{money(categoryDiscount)}</strong></div>
            <div className="summaryLine"><span>Opening Previous Dues</span><strong>{money(previousDuesNum)}</strong></div>
            <div className="summaryLine total"><span>Total Due On Save</span><strong>{money(openingDue)}</strong></div>
            <div className="summaryLine"><span>Status On Save</span><strong>{statusPreview}</strong></div>
            <div className="summaryHint">Discounted monthly charge is saved as a future rate only. It is not added on house creation.</div>
          </div>
        </div>

        <div className="infoNote">
          <strong>How it works</strong>
          <span>When you save a new house, only Previous Dues are saved as opening dues. Discounted category charge is saved as the resident rate and should be added as unpaid only during the month-change billing process, for example June to July.</span>
        </div>

        <div className="subCard" style={{ marginTop: 18 }}>
          <div className="pageHead">
            <div>
              <h3>House Portions</h3>
              <p className="p">Add multiple portions inside this house. Each portion can have its own resident, dues type, category fee and opening dues.</p>
            </div>
            <button className="btn" type="button" onClick={() => setPortions((prev) => [...prev, { portionName: '', residentName: '', residentNumber: '', residentType: 'owner', chargeCategory: form.chargeCategory, previousDues: '' }])}>Add Portion</button>
          </div>
          {portions.length === 0 && <div className="infoNote"><span>No portions added. Click Add Portion if this house has Ground Floor, First Floor, Shop, Back Portion, etc.</span></div>}
          {portions.map((portion, index) => (
            <div className="formGrid3 portionBox" key={index} style={{ marginTop: 12 }}>
              <div className="field"><label className="lbl">Portion Name *</label><input className="inp" value={portion.portionName} placeholder="Ground Floor / First Floor" onChange={(e) => setPortions((prev) => prev.map((p, i) => i === index ? { ...p, portionName: e.target.value } : p))} /></div>
              <div className="field"><label className="lbl">Resident Name</label><input className="inp" value={portion.residentName} onChange={(e) => setPortions((prev) => prev.map((p, i) => i === index ? { ...p, residentName: e.target.value } : p))} /></div>
              <div className="field"><label className="lbl">Resident Number</label><input className="inp" value={portion.residentNumber} onChange={(e) => setPortions((prev) => prev.map((p, i) => i === index ? { ...p, residentNumber: e.target.value } : p))} /></div>
              <div className="field"><label className="lbl">Dues Type</label><select className="inp" value={portion.residentType} onChange={(e) => setPortions((prev) => prev.map((p, i) => i === index ? { ...p, residentType: e.target.value } : p))}><option value="owner">Owner dues</option><option value="rental">Rental dues</option></select></div>
              <div className="field"><label className="lbl">Portion Category</label><select className="inp" value={portion.chargeCategory || form.chargeCategory} onChange={(e) => setPortions((prev) => prev.map((p, i) => i === index ? { ...p, chargeCategory: e.target.value } : p))}>{chargeOptions.map((opt) => <option key={`${index}-${opt.value || 'empty'}`} value={opt.value}>{opt.label}</option>)}</select></div>
              <div className="field"><label className="lbl">Opening Previous Dues</label><input className="inp" value={portion.previousDues} inputMode="numeric" onChange={(e) => setPortions((prev) => prev.map((p, i) => i === index ? { ...p, previousDues: e.target.value } : p))} /></div>
              <div className="actions"><button className="btn danger" type="button" onClick={() => setPortions((prev) => prev.filter((_, i) => i !== index))}>Remove Portion</button></div>
            </div>
          ))}
        </div>


        {err && <div className="alert error">{err}</div>}
        {msg && <div className="alert success">{msg}</div>}

        <div className="actions">
          <button className="btn primary" onClick={onSave} disabled={loading}>{loading ? 'Saving...' : 'Save House'}</button>
        </div>
      </div>
    </div>
  );
}
