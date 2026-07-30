'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, saveCurrentUser } from '../lib/access';

const STORAGE_KEY = 'invoice-suite-settings';

const defaultSettings = {
  operatorName: 'System Admin',
  operatorRole: 'Super Admin',
  societyName: 'Lucknow Co-operative Housing Society Ltd',
  societyArea: 'Sector 31-E Korangi Karachi',
  secretaryName: 'MALIK FAHAD',
  secretaryDesignation: 'HON. SECRETARY',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [message, setMessage] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...defaultSettings, ...JSON.parse(raw) });
      const user = getCurrentUser();
      setSettings((prev) => ({ ...prev, operatorName: user.name, operatorRole: user.role === 'super_admin' ? 'Super Admin' : 'Sub Admin' }));
    } catch {}
  }, []);

  function update<K extends keyof typeof defaultSettings>(key: K, value: (typeof defaultSettings)[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    const current = getCurrentUser();
    saveCurrentUser({ ...current, name: settings.operatorName, role: settings.operatorRole.toLowerCase().includes('sub') ? 'sub_admin' : 'super_admin' });
    window.dispatchEvent(new Event('storage'));
    setMessage('Settings saved successfully.');
    setTimeout(() => setMessage(''), 2500);
  }

  return (
    <div className="wrap wideWrap">
      <div className="card wideCard" style={{ width: 'min(100%, 980px)' }}>
        <div className="pageHead">
          <div>
            <h1 className="h1">Settings</h1>
            <p className="p">These values are used in invoice and NOC output.</p>
          </div>
        </div>

        {message && <div className="alert success">{message}</div>}

        <div className="formGrid3">
          <div className="field">
            <label className="lbl">Operator Name</label>
            <input className="inp" value={settings.operatorName} onChange={(e) => update('operatorName', e.target.value)} />
          </div>
          <div className="field">
            <label className="lbl">Operator Role</label>
            <input className="inp" value={settings.operatorRole} onChange={(e) => update('operatorRole', e.target.value)} />
          </div>
          <div className="field">
            <label className="lbl">Secretary Name</label>
            <input className="inp" value={settings.secretaryName} onChange={(e) => update('secretaryName', e.target.value)} />
          </div>
          <div className="field span2">
            <label className="lbl">Society Name</label>
            <input className="inp" value={settings.societyName} onChange={(e) => update('societyName', e.target.value)} />
          </div>
          <div className="field">
            <label className="lbl">Society / Area</label>
            <input className="inp" value={settings.societyArea} onChange={(e) => update('societyArea', e.target.value)} />
          </div>
          <div className="field span2">
            <label className="lbl">Secretary Designation</label>
            <input className="inp" value={settings.secretaryDesignation} onChange={(e) => update('secretaryDesignation', e.target.value)} />
          </div>
        </div>

        <div className="printActions" style={{ marginTop: 20 }}>
          <button className="btn primary" onClick={save}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}
