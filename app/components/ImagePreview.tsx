
'use client';

import { useState } from 'react';

export default function ImagePreview({ src, alt = 'image', className = 'thumbImg' }: { src: string; alt?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!src) return null;
  return (
    <>
      <img src={src} alt={alt} className={className} onClick={() => setOpen(true)} style={{ cursor: 'zoom-in' }} />
      {open ? (
        <div className="imageOverlay" onClick={() => setOpen(false)}>
          <img src={src} alt={alt} className="imageOverlayImg" />
        </div>
      ) : null}
    </>
  );
}
