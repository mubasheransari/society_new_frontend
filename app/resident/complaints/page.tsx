'use client';
import { useEffect, useState } from 'react';
import ImagePreview from '../../components/ImagePreview';
import { residentFetch } from '../../lib/resident';

function readFiles(files: FileList | null) {
  return Promise.all(Array.from(files || []).map((file) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}

export default function ResidentComplaintsPage(){
  const [items,setItems]=useState<any[]>([]);
  const [subject,setSubject]=useState('');
  const [description,setDescription]=useState('');
  const [imageUrls,setImageUrls]=useState<string[]>([]);
  const [drafts,setDrafts]=useState<Record<number,{message:string;imageUrls:string[]}>>({});
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  async function load(){ try{ const json = await residentFetch('/api/complaints/mine'); setItems(Array.isArray(json)?json:[]);}catch(e:any){setError(e.message);} }
  useEffect(()=>{load();},[]);
  async function submit(){ try{ const json = await residentFetch('/api/complaints/mine',{method:'POST',body:JSON.stringify({subject,description,imageUrls})}); setMessage(json.message||'Complaint submitted'); setSubject(''); setDescription(''); setImageUrls([]); load(); }catch(e:any){setError(e.message);} }
  async function sendMessage(item:any){ try{ const draft=drafts[item.id]||{message:'',imageUrls:[]}; const json = await residentFetch(`/api/complaints/${item.id}/message`,{method:'POST',body:JSON.stringify({sender:'resident',message:draft.message,imageUrls:draft.imageUrls})}); setMessage(json.message||'Message sent'); setDrafts((prev)=>({...prev,[item.id]:{message:'',imageUrls:[]}})); load(); }catch(e:any){setError(e.message);} }

  return <div className="residentPageShell">
    <section className="residentCard residentComplaintForm">
      <div className="residentSectionHead"><div><span className="residentEyebrow">Resident support</span><h1>Submit Complaint</h1><p>Share your complaint with details and pictures. Track replies from society admin below.</p></div></div>
      {error?<div className="alert error">{error}</div>:null}{message?<div className="alert success">{message}</div>:null}
      <div className="residentComplaintGrid">
        <label className="field"><span className="lbl">Subject</span><input className="inp" placeholder="e.g. Water leakage" value={subject} onChange={(e)=>setSubject(e.target.value)} /></label>
        <label className="field span2"><span className="lbl">Complaint Details</span><textarea className="inp ta" placeholder="Write complete details here..." value={description} onChange={(e)=>setDescription(e.target.value)} /></label>
        <label className="residentUploadBox"><span>Pictures</span><small>Upload one or more images</small><input type="file" accept="image/*" multiple onChange={async (e)=>{ const images=await readFiles(e.target.files); setImageUrls((prev)=>[...prev,...images]); e.currentTarget.value=''; }} /></label>
      </div>
      {!!imageUrls.length?<div className="previewGrid residentPreviewGrid">{imageUrls.map((src,idx)=><div key={idx} className="previewCard"><ImagePreview src={src} className="previewImg" /><button className="btn small" type="button" onClick={()=>setImageUrls((prev)=>prev.filter((_,i)=>i!==idx))}>Remove</button></div>)}</div>:null}
      <button className="btn primary residentActionBtn" onClick={submit}>Submit Complaint</button>
    </section>

    <section className="residentCard">
      <div className="residentSectionHead"><div><h2>Complaint History</h2><p>Your submitted complaints and conversation updates.</p></div></div>
      <div className="residentComplaintList">
        {items.map((item)=><article key={item.id} className="residentComplaintCard">
          <div className="residentComplaintHead"><div><h3>{item.subject}</h3><p>Status updates and replies from society.</p></div><span className={`badge status ${String(item.status).toLowerCase()==='resolved'?'paid':String(item.status).toLowerCase()==='in_progress'?'partially_paid':'unpaid'}`}>{item.status}</span></div>
          <div className="residentThread">{(item.updates||[]).map((u:any, idx:number)=><div key={idx} className={`residentBubble ${u.sender || 'system'}`}><p>{u.message}</p>{(u.imageUrls||[]).length?<div className="thumbRow">{u.imageUrls.map((src:string, i:number)=><ImagePreview key={i} src={src} className="thumbImg" />)}</div>:null}<small>{u.createdAt ? new Date(u.createdAt).toLocaleString() : ''}</small></div>)}</div>
          {String(item.status).toUpperCase()!=='RESOLVED'?<div className="residentReplyBox"><textarea className="inp ta" placeholder="Send follow-up update..." value={drafts[item.id]?.message || ''} onChange={(e)=>setDrafts((prev)=>({...prev,[item.id]:{message:e.target.value,imageUrls:prev[item.id]?.imageUrls||[]}}))} /><input className="inp" type="file" accept="image/*" multiple onChange={async (e)=>{ const images = await readFiles(e.target.files); setDrafts((prev)=>({...prev,[item.id]:{message:prev[item.id]?.message || '',imageUrls:[...(prev[item.id]?.imageUrls||[]),...images]}})); e.currentTarget.value=''; }} />{!!(drafts[item.id]?.imageUrls||[]).length?<div className="thumbRow">{(drafts[item.id]?.imageUrls||[]).map((src, idx)=><ImagePreview key={idx} src={src} className="thumbImg" />)}</div>:null}<button className="btn primary" onClick={()=>sendMessage(item)}>Send Update</button></div>:null}
        </article>)}
        {!items.length?<div className="residentEmpty">No complaints found.</div>:null}
      </div>
    </section>
  </div>;
}
