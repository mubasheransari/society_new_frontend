'use client';

import { useState } from 'react';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const upload = async () => {
    if (!file) {
      setErr('Please choose an Excel file (.xlsx).');
      return;
    }

    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch(`${API_BASE}/api/dues/upload`, {
        method: 'POST',
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || `Upload failed (${res.status})`);
      }

      setMsg(
        data?.message ||
          'Upload successful. Records were saved and monthly charge category data is also supported when Excel contains Charge Category / Plot Category column.'
      );
      setFile(null);
      const input = document.getElementById('excelFile') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch (e: any) {
      setErr(e?.message || 'Upload failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wrap">
      <div className="pageHead">
        <div>
          <h1 className="h1">File Uploading</h1>
          <p className="p">
            Upload Excel to import dues. Plot No is the unique key. You can also include a Charge Category / Plot Category column to auto-apply monthly maintenance charges.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="grid2">
          <div className="field">
            <label className="lbl">Excel File (.xlsx)</label>
            <input
              id="excelFile"
              className="inp"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="actions">
            <button className="btn primary" onClick={upload} disabled={loading}>
              {loading ? 'Uploading...' : 'Upload & Save'}
            </button>
            <a className="btn" href="/" style={{ textDecoration: 'none' }}>
              Go to Search
            </a>
          </div>

          {err && <div className="alert">{err}</div>}
          {msg && (
            <div
              className="alert"
              style={{
                borderColor: 'rgba(34,197,94,.35)',
                background: 'rgba(34,197,94,.10)',
                color: '#166534',
              }}
            >
              {msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
