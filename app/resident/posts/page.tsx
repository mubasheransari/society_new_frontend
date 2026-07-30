'use client';
import { useEffect, useMemo, useState } from 'react';
import ImagePreview from '../../components/ImagePreview';
import { residentFetch, formatDate } from '../../lib/resident';

const categories = ['all','society','water','electricity','gas','general'];

export default function ResidentPostsPage(){
  const [items,setItems]=useState<any[]>([]);
  const [error,setError]=useState('');
  const [category,setCategory]=useState('all');
  const [search,setSearch]=useState('');

  async function load(nextCategory='all'){
    try{
      const queryCategory = nextCategory === 'all' ? '' : nextCategory;
      const path = queryCategory ? `/api/resident/posts?category=${encodeURIComponent(queryCategory)}` : '/api/resident/posts';
      const json = await residentFetch(path);
      setItems(Array.isArray(json) ? json : []);
    }catch(e:any){setError(e.message);}
  }

  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    const categoryFromUrl = (params.get('category') || '').toLowerCase();
    if (['society','electricity','gas','water','general'].includes(categoryFromUrl)) setCategory(categoryFromUrl);
  },[]);

  useEffect(()=>{load(category);},[category]);

  const filteredItems = useMemo(()=>{
    const q = search.trim().toLowerCase();
    if(!q) return items;
    return items.filter((i)=>`${i.title} ${i.description} ${i.category}`.toLowerCase().includes(q));
  },[items,search]);

  return <div className="residentPageShell">
    <section className="residentCard residentPostsHeroCard">
      <div className="residentSectionHead residentPostsHead">
        <div><span className="residentEyebrow">Resident updates</span><h1>Society Updates</h1><p>Stay updated with notices, utility updates and society announcements.</p></div>
        <input className="inp residentSearch" placeholder="Search updates..." value={search} onChange={(e)=>setSearch(e.target.value)} />
      </div>
      {error?<div className="alert error">{error}</div>:null}
      <div className="residentCategoryTabs">{categories.map((cat)=><button key={cat} className={`residentCategoryTab ${category===cat?'active':''}`} onClick={()=>setCategory(cat)}>{cat === 'all' ? 'All' : cat}</button>)}</div>
      <div className="residentPostMasonry">{filteredItems.map((i)=> {
        const images = i.imageUrls || [];
        return <article key={i.id} className="residentPostTile">
          <div className="residentPostVisual">{images[0] ? <ImagePreview src={images[0]} className="residentPostVisualImg" /> : <div className="residentNoticePlaceholder">Notice</div>}</div>
          <div className="residentPostContent">
            <div className="postCardTop"><span className="residentChip">{i.category || 'Society'}</span><span className="feedMeta">{formatDate(i.createdAt)}</span></div>
            <h3>{i.title}</h3><p>{i.description}</p>
            {images.length > 1 && <div className="miniImageStrip">{images.slice(1,4).map((src:string, idx:number)=><ImagePreview key={idx} src={src} className="miniPostImg" />)}</div>}
            <div className="postStats"><span>👍 0</span><span>💬 0</span><button className="btn small">Read More</button></div>
          </div>
        </article>
      })}{!filteredItems.length?<div className="residentEmpty">No posts found.</div>:null}</div>
    </section>
  </div>;
}
