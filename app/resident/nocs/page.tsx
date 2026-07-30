'use client';

import { useEffect, useMemo, useState } from 'react';
import { API_BASE, residentFetch } from '../../lib/resident';
import ImagePreview from '../../components/ImagePreview';

function readFiles(files: FileList | null) {
  return Promise.all(Array.from(files || []).map((file) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}

type NocRow = {
  id: string;
  noc_number?: string;
  nocNumber?: string;
  noc_type?: string;
  nocType?: string;
  status?: string;
  issued_at?: string;
  issuedAt?: string;
};

type NocDetail = {
  id: string;
  nocNumber: string;
  qrImage?: string;
  nocType: string;
  plotNo: string;
  plotMeasureSqYds?: string;
  applicantName?: string;
  relationType?: string;
  relationName?: string;
  ownerType?: string;
  cnic?: string;
  duesClearedUpTo?: string | null;
  buildingType?: string;
  transferredName?: string;
  remarks?: string;
  status?: string;
  issuedAt?: string;
  signingAuthority?: { name?: string; designation?: string; organization?: string };
};

const typeLabel: Record<string, string> = {
  sale: 'NOC FOR SALE',
  noDues: 'NO DUES CERTIFICATE',
  no_dues: 'NO DUES CERTIFICATE',
  water: 'NOC FOR WATER CONNECTION',
  gas: 'NOC FOR SUPPLY OF GAS CONNECTION',
  electricity: 'NOC FOR SUPPLY OF ELECTRICITY CONNECTION',
  building: 'FORWARDED FOR APPROVAL OF BUILDING PLAN',
  verification: 'VERIFICATION',
  construction: 'NOC FOR CONSTRUCTION',
  transfer: 'TRANSFER OF PLOT',
  general: 'GENERAL NOC',
};

function getNocNo(row: NocRow) {
  return row.noc_number || row.nocNumber || '';
}

function getNocType(row: NocRow) {
  return row.noc_type || row.nocType || '';
}

function getIssuedAt(row: NocRow) {
  return row.issued_at || row.issuedAt || '';
}

function friendlyType(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  return typeLabel[raw] || typeLabel[raw.toLowerCase()] || raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function isUnknown(value?: string | null) {
  const v = String(value || '').trim().toLowerCase();
  return !v || v === 'n/a' || v === 'na' || v === '-';
}

function buildNocBody(noc: NocDetail) {
  const label = typeLabel[noc.nocType] || typeLabel[String(noc.nocType || '').toLowerCase()] || String(noc.nocType || 'NOC').toUpperCase();
  const relation = [isUnknown(noc.relationType) ? '' : noc.relationType, isUnknown(noc.relationName) ? '' : noc.relationName].filter(Boolean).join(' ');
  const measure = isUnknown(noc.plotMeasureSqYds) ? '' : noc.plotMeasureSqYds;
  const measureClause = measure ? `, measuring ${measure} sq. yards,` : ',';
  const applicant = noc.applicantName || '-';
  const plotNo = noc.plotNo || '-';

  if (noc.nocType === 'transfer') {
    return `This is to certify that the transfer document has been issued for Plot No. ${plotNo}${measure ? ` measuring ${measure} sq. yards` : ''} in favour of ${applicant}${relation ? ` ${relation}` : ''}.`;
  }

  if (noc.nocType === 'building') {
    return `The application for approval of building plan for Plot No. ${plotNo}${measure ? `, measuring ${measure} sq. yards,` : ','} submitted by ${applicant}${relation ? ` ${relation}` : ''}, has been forwarded as per society record.`;
  }

  if (noc.nocType === 'gas' || noc.nocType === 'electricity' || noc.nocType === 'water') {
    return `The society has no objection for ${label.toLowerCase()} on Plot No. ${plotNo}${measureClause} in the name of ${applicant}${relation ? ` ${relation}` : ''}.`;
  }

  return `This ${label.toLowerCase()} has been issued for Plot No. ${plotNo}${measureClause} in the name of ${applicant}${relation ? ` ${relation}` : ''}.`;
}

export default function ResidentNocsPage() {
  const [items, setItems] = useState<NocRow[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [requestType, setRequestType] = useState('general');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedNoc, setSelectedNoc] = useState<NocDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [expandedRequestId, setExpandedRequestId] = useState<string | number | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, { message: string; imageUrls: string[] }>>({});
  const [replyBusyId, setReplyBusyId] = useState<string | number | null>(null);

  async function load() {
    try {
      setError('');
      const [nocs, reqs] = await Promise.all([
        residentFetch('/api/resident/nocs'),
        residentFetch('/api/resident/noc-requests'),
      ]);
      setItems(Array.isArray(nocs) ? nocs : []);
      setRequests(Array.isArray(reqs) ? reqs : []);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function requestNoc() {
    try {
      setError('');
      const json = await residentFetch('/api/noc/requests/mine', {
        method: 'POST',
        body: JSON.stringify({ requestType, notes }),
      });
      setMessage(json.message || 'Request sent');
      setNotes('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function toggleRequestView(id: string | number) {
    setExpandedRequestId((prev) => (prev === id ? null : id));
  }

  async function sendReply(item: any) {
    const key = String(item.id);
    const draft = replyDrafts[key] || { message: '', imageUrls: [] };
    if (!draft.message.trim() && !draft.imageUrls.length) return;
    try {
      setReplyBusyId(item.id);
      setError('');
      const json = await residentFetch(`/api/resident/noc-requests/${item.id}/message`, {
        method: 'POST',
        body: JSON.stringify({ message: draft.message, imageUrls: draft.imageUrls }),
      });
      setMessage(json.message || 'Message sent');
      setReplyDrafts((prev) => ({ ...prev, [key]: { message: '', imageUrls: [] } }));
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setReplyBusyId(null);
    }
  }

  async function viewNoc(row: NocRow) {
    const nocNo = getNocNo(row);
    if (!nocNo) return;
    try {
      setError('');
      setViewLoading(true);
      const res = await fetch(`${API_BASE}/api/noc/verify/${encodeURIComponent(nocNo)}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.isSuccess === false) throw new Error(json?.message || 'Failed to load NOC');
      setSelectedNoc(json.result || json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setViewLoading(false);
    }
  }

  const selectedTitle = useMemo(() => {
    if (!selectedNoc) return '';
    return typeLabel[selectedNoc.nocType] || typeLabel[String(selectedNoc.nocType || '').toLowerCase()] || String(selectedNoc.nocType || 'NOC').toUpperCase();
  }, [selectedNoc]);

  return (
    <div className="wrap wideWrap">
      <div className="pageGrid">
        <section className="card wideCard no-print">
          <h1 className="h1">My NOCs</h1>
          <p className="p">See issued NOCs and request a new NOC only when your dues are cleared.</p>
          {error ? <div className="alert error">{error}</div> : null}
          {message ? <div className="alert success">{message}</div> : null}
          <div className="formGrid3">
            <label className="field">
              <span className="lbl">Request Type</span>
              <select className="inp" value={requestType} onChange={(e) => setRequestType(e.target.value)}>
                <option value="general">General</option>
                <option value="sale">Sale</option>
                <option value="no_dues">No Dues</option>
                <option value="water">Water</option>
                <option value="gas">Gas</option>
                <option value="electricity">Electricity</option>
                <option value="construction">Construction</option>
                <option value="transfer">Transfer</option>
              </select>
            </label>
            <label className="field span2">
              <span className="lbl">Notes</span>
              <textarea className="inp ta" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn primary" onClick={requestNoc}>Request NOC</button>
          </div>
        </section>

        <section className="card wideCard no-print residentNocSection">
          <div className="residentNocSectionHead"><div><h2 className="h2">Issued NOCs</h2><p className="p">Documents issued for your plot.</p></div><span className="nocCountPill">{items.length}</span></div>
          <div className="tableWrap">
            <table className="tbl residentNocTable">
              <thead>
                <tr><th>NOC No</th><th>Type</th><th>Status</th><th>Issued At</th><th>Action</th></tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id || getNocNo(i)}>
                    <td>{getNocNo(i)}</td>
                    <td><span className="nocTypeText">{friendlyType(getNocType(i))}</span></td>
                    <td><span className={`badge status ${String(i.status).toLowerCase() === 'active' ? 'paid' : 'unpaid'}`}>{i.status}</span></td>
                    <td>{formatDate(getIssuedAt(i))}</td>
                    <td><button className="btn small" onClick={() => viewNoc(i)} disabled={viewLoading}>View NOC</button></td>
                  </tr>
                ))}
                {!items.length ? <tr><td colSpan={5} className="mutedCell">No NOCs found.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card wideCard no-print residentNocSection">
          <div className="residentNocSectionHead"><div><h2 className="h2">Request History</h2><p className="p">Track approval progress and chat with the society admin.</p></div><span className="nocCountPill">{requests.length}</span></div>
          <div className="residentComplaintList">
            {requests.map((r) => {
              const key = String(r.id);
              const status = String(r.status || 'PENDING').toUpperCase();
              const isClosed = status === 'APPROVED' || status === 'DECLINED' || status === 'REJECTED';
              const expanded = expandedRequestId === r.id;
              const draft = replyDrafts[key] || { message: '', imageUrls: [] };
              const busy = replyBusyId === r.id;
              return (
                <article key={r.id} className="residentComplaintCard">
                  <div className="residentComplaintHead">
                    <div><h3>{friendlyType(r.request_type)}</h3><p>{r.notes || 'No additional notes'}</p></div>
                    <span className={`badge status ${status === 'APPROVED' ? 'paid' : status === 'REVIEWING' ? 'partially_paid' : 'unpaid'}`}>{status}</span>
                  </div>
                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="btn small" onClick={() => toggleRequestView(r.id)}>{expanded ? 'Hide chat' : 'View / Chat'}</button>
                  </div>
                  {expanded ? (
                    <>
                      <div className="residentThread" style={{ marginTop: 14 }}>
                        {(r.updates || []).map((u: any, idx: number) => (
                          <div key={idx} className={`residentBubble ${u.sender || 'system'}`}>
                            <p>{u.message}</p>
                            {(u.imageUrls || []).length ? <div className="thumbRow">{u.imageUrls.map((src: string, i: number) => <ImagePreview key={i} src={src} className="thumbImg" />)}</div> : null}
                            <small>{u.createdAt ? new Date(u.createdAt).toLocaleString() : ''}</small>
                          </div>
                        ))}
                        {!(r.updates || []).length ? <div className="mutedCell">No messages yet.</div> : null}
                      </div>
                      {!isClosed ? (
                        <div className="residentReplyBox">
                          <textarea
                            className="inp ta"
                            placeholder="Send a message to the society admin..."
                            value={draft.message}
                            onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [key]: { message: e.target.value, imageUrls: prev[key]?.imageUrls || [] } }))}
                          />
                          <input
                            className="inp"
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={async (e) => {
                              const images = await readFiles(e.target.files);
                              setReplyDrafts((prev) => ({ ...prev, [key]: { message: prev[key]?.message || '', imageUrls: [...(prev[key]?.imageUrls || []), ...images] } }));
                              e.currentTarget.value = '';
                            }}
                          />
                          {(draft.imageUrls || []).length ? <div className="thumbRow">{draft.imageUrls.map((src, idx) => <ImagePreview key={idx} src={src} className="thumbImg" />)}</div> : null}
                          <button className="btn primary" disabled={busy} onClick={() => sendReply(r)}>Send Message</button>
                        </div>
                      ) : (
                        <div className="smallMuted" style={{ marginTop: 10 }}>This request is {status.toLowerCase()} and no longer accepts new messages.</div>
                      )}
                    </>
                  ) : null}
                </article>
              );
            })}
            {!requests.length ? <div className="residentEmpty">No requests found.</div> : null}
          </div>
        </section>

        {selectedNoc ? (
          <div className="nocModalOverlay no-print" role="dialog" aria-modal="true" onClick={() => setSelectedNoc(null)}>
            <div className="nocModalCard" onClick={(e) => e.stopPropagation()}>
              <div className="row no-print" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 className="h2" style={{ margin: 0 }}>View Generated NOC</h2>
                <div className="row" style={{ gap: 10 }}>
                  <button className="btn" onClick={() => window.print()}>Print / Save PDF</button>
                  <button className="btn" onClick={() => setSelectedNoc(null)}>Close</button>
                </div>
              </div>

            <div className="doc nocDoc nocPrintDoc" style={{ boxShadow: 'none', border: '1px solid #dbe7ff', margin: 0 }}>
              <div className="nocTop" style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <div>
                  <h2 className="nocOrg">LUCKNOW CO-OPERATIVE HOUSING SOCIETY LTD.</h2>
                  <div className="nocArea">Karachi</div>
                  <div className="nocTitle">{selectedTitle}</div>
                </div>
                {selectedNoc.qrImage ? <img src={selectedNoc.qrImage} alt="NOC QR" className="nocQr" /> : null}
              </div>

              <div className="body" style={{ marginTop: 18, lineHeight: 2 }}>
                <p><b>NOC No:</b> {selectedNoc.nocNumber}</p>
                <p><b>Issued At:</b> {formatDate(selectedNoc.issuedAt)}</p>
                <p>{buildNocBody(selectedNoc)}</p>
                {/* Remarks intentionally not shown on the generated NOC */}
              </div>

              <div className="nocSignOnly" style={{ marginTop: 60, textAlign: 'right' }}>
                <div className="line" />
                <div className="signNameOnly"><b>{selectedNoc.signingAuthority?.name || 'MALIK FAHAD'}</b></div>
                <div>{selectedNoc.signingAuthority?.designation || 'SECRETARY'}</div>
                <div>{selectedNoc.signingAuthority?.organization || 'Lucknow Co-operative Housing Society Ltd'}</div>
              </div>
            </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
