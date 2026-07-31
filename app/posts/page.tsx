'use client';

import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../lib/resident';
import { getCurrentUser } from '../lib/access';
import ImagePreview from '../components/ImagePreview';

type Post = { id:number; title:string; description:string; category:string; imageUrls?:string[]; isActive:boolean; createdAt?:string };
const initialForm = { title:'', description:'', category:'', imageUrls:[] as string[], isActive:true };
const categories = ['all','society','water','electricity','gas','general'];

function readFiles(files: FileList | null) {
  return Promise.all(Array.from(files || []).map((file) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-PK', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

export default function PostsPage() {
  const currentUser = getCurrentUser();
  const [items, setItems] = useState<Post[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');

  async function load() {
    const res = await fetch(`${API_BASE}/api/posts`, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || 'Failed to load posts');
    setItems(json);
  }
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const categoryOk = activeCategory === 'all' || (item.category || '').toLowerCase() === activeCategory;
      const searchOk = !q || `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(q);
      return categoryOk && searchOk;
    });
  }, [items, activeCategory, search]);

  async function save() {
    setError(''); setMessage('');
    if (!form.title.trim()) throw new Error('Title is required');
    if (!form.category) throw new Error('Please select a category');
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `${API_BASE}/api/posts/${editingId}` : `${API_BASE}/api/posts`;
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, createdBy: currentUser.name }) });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || 'Failed to save post');
    setMessage(json.message || 'Saved');
    setForm(initialForm); setEditingId(null); load();
  }

  async function remove(id: number) {
    const res = await fetch(`${API_BASE}/api/posts/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || 'Failed to delete');
    setMessage(json.message || 'Deleted'); load();
  }

  return <div className="wrap wideWrap"><div className="pageGrid modernPageGrid">
    <section className="card wideCard modernFormCard">
      <div className="pageHead modernPageHead">
        <div>
          <span className="sectionEyebrow">Admin Communication</span>
          <h1 className="h1">Society Posts</h1>
          <p className="p">Create updates for society, electricity, gas and water. Residents get notified automatically.</p>
        </div>
        <div className="postCounter"><strong>{items.length}</strong><span>Total Posts</span></div>
      </div>
      {error ? <div className="alert error">{error}</div> : null}
      {message ? <div className="alert success">{message}</div> : null}
      <div className="modernPostForm">
        <label className="field postTitleField"><span className="lbl">Title</span><input className="inp" placeholder="Enter announcement title" value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} /></label>
        <label className="field"><span className="lbl">Category</span><select className="inp" value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})}><option value="" disabled>Select Category</option><option value="society">Society</option><option value="water">Water</option><option value="electricity">Electricity</option><option value="gas">Gas</option><option value="general">General</option></select></label>
        <label className="field postDescField"><span className="lbl">Description</span><textarea className="inp ta" placeholder="Write update details for residents" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} /></label>
        <label className="field"><span className="lbl">Pictures</span><input className="inp" type="file" accept="image/*" multiple onChange={async (e)=>{ const images = await readFiles(e.target.files); setForm((prev)=>({...prev, imageUrls:[...prev.imageUrls, ...images]})); e.currentTarget.value=''; }} /></label>
      </div>
      {!!form.imageUrls.length && <div className="previewGrid modernPreviewGrid" style={{marginTop:12}}>{form.imageUrls.map((src, idx)=><div key={idx} className="previewCard"><ImagePreview src={src} className="previewImg" /><button className="btn small" type="button" onClick={()=>setForm((prev)=>({...prev, imageUrls: prev.imageUrls.filter((_,i)=>i!==idx)}))}>Remove</button></div>)}</div>}
      <div className="row modernActionRow" style={{marginTop:14}}><button className="btn primary" onClick={()=>save().catch((e)=>setError(e.message))}>{editingId ? 'Update Post' : '+ Create Post'}</button>{editingId ? <button className="btn" onClick={()=>{setEditingId(null);setForm(initialForm);}}>Cancel</button> : null}</div>
    </section>

    <section className="card wideCard modernPostsSection">
      <div className="sectionTitleRow modernSectionTitleRow">
        <div><h2 className="h2">Post History</h2><p className="p">Manage all published posts with category filters and image previews.</p></div>
        <input className="inp postSearch" placeholder="Search posts..." value={search} onChange={(e)=>setSearch(e.target.value)} />
      </div>
      <div className="categoryTabs modernTabs">{categories.map((cat)=><button key={cat} className={`categoryTab ${activeCategory===cat?'active':''}`} onClick={()=>setActiveCategory(cat)}>{cat === 'all' ? 'All' : cat}</button>)}</div>
      <div className="modernPostGrid">{filteredItems.map((item)=><article key={item.id} className="modernPostCard"><div className="modernPostMedia">{(item.imageUrls||[])[0] ? <ImagePreview src={(item.imageUrls||[])[0]} className="modernPostImage" /> : <div className="emptyPostImage">No Image</div>}{(item.imageUrls||[]).length > 1 && <span className="imageCount">+{(item.imageUrls||[]).length - 1}</span>}</div><div className="modernPostBody"><div className="postCardTop"><span className="feedTag">{item.category || 'society'}</span><span className="feedMeta">{formatDate(item.createdAt)}</span></div><h3 className="feedTitle">{item.title}</h3><p className="feedDesc">{item.description}</p><div className="postStats"><span>Admin</span></div><div className="row postActionButtons"><button className="btn small" onClick={()=>{setEditingId(item.id); setForm({ title:item.title, description:item.description, category:item.category || '', imageUrls:item.imageUrls||[], isActive:item.isActive }); window.scrollTo({top:0, behavior:'smooth'});}}>Edit</button><button className="btn small danger" onClick={()=>remove(item.id).catch((e)=>setError(e.message))}>Delete</button></div></div></article>)}{!filteredItems.length?<div className="mutedCell">No posts found.</div>:null}</div>
    </section>
  </div></div>;
}
