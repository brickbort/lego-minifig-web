import React, { useEffect, useRef, useState } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

function fmt(val) {
  const n = Number(val);
  return isNaN(n) ? '—' : `$${n.toFixed(2)}`;
}

function PriceSection({ label, data }) {
  const avg = data?.avg_price || data?.qty_avg_price;
  return (
    <div className="price-section">
      <p className="price-section-label">{label}</p>
      <p className="price-avg">{avg ? fmt(avg) : '—'}</p>
    </div>
  );
}

function App() {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function fetchPrice(id) {
    try {
      const res = await fetch(`${API_BASE}/priceguide/${id}`);
      const json = await res.json();
      console.log('[priceguide]', id, json);
      if (!res.ok) throw new Error(JSON.stringify(json));

      // New backend format: { new: {...}, used: {...} }
      if ('new' in json || 'used' in json) return json;
      // Old backend format: { meta, data: {...} } — handle gracefully
      if (json.data) return { new: json.data, used: null };

      return null;
    } catch (e) {
      console.error('price fetch error:', e);
      return null;
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);
    setResults([]);

    try {
      const fd = new FormData();
      fd.append('image', file, file.name);
      const res = await fetch(`${API_BASE}/recognize`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(json));
      const items = json.items || [];

      if (!items.length) {
        setError('No minifig match found.');
        return;
      }

      const enriched = await Promise.all(
        items.map(async (item) => {
          const bricklinkSite =
            item.external_sites?.find((s) => s.name?.toLowerCase() === 'bricklink') || {};
          const priceData = await fetchPrice(item.id);
          return {
            id: item.id,
            name: item.name,
            img_url: item.img_url,
            external_url: bricklinkSite.url,
            priceData,
          };
        })
      );

      setResults(enriched);
    } catch (err) {
      console.error('recognize error:', err);
      setError('Failed to recognize the image. Please try another photo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header app-header--stack">
        <img src="/circle-logo-2.png" alt="Logo" className="app-logo" />
        <img src="/title.png" alt="App Title" className="app-title-image" />
      </header>

      <div className="controls">
        <button onClick={() => fileInputRef.current?.click()}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload Photo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
        />

        <button onClick={() => cameraInputRef.current?.click()}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          Take Photo
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
        />
      </div>

      {previewUrl && (
        <img
          src={previewUrl}
          alt="Preview"
          className="preview-image"
        />
      )}
      {loading && <p className="loading">Working…</p>}
      {error && <p className="error">{error}</p>}

      <div className="results-container">
        {results.map((r) => (
          <div key={r.id} className="minifig-card">
            <img src={r.img_url} alt={r.name} loading="lazy" />
            <h3>{r.name}</h3>
            <p>
              <strong>ID:</strong> {r.id}
            </p>

            {r.external_url && (
              <p>
                <a href={r.external_url} target="_blank" rel="noreferrer">
                  View on BrickLink
                </a>
              </p>
            )}

            {r.priceData ? (
              <div className="price-info">
                <PriceSection label="New" data={r.priceData.new} />
                <PriceSection label="Used" data={r.priceData.used} />
              </div>
            ) : (
              <p className="loading">Loading price data…</p>
            )}
          </div>
        ))}
      </div>

      <footer className="site-footer">
        <a
          href="https://www.instagram.com/brick_bort?igsh=MTFsY3FocnFtdTVweQ%3D%3D&utm_source=qr"
          target="_blank"
          rel="noreferrer"
          aria-label="Instagram"
        >
          <img src="/instagram.png" alt="Instagram" />
        </a>
        <a
          href="https://www.whatnot.com/s/K86deUgV"
          target="_blank"
          rel="noreferrer"
          aria-label="Whatnot"
        >
          <img src="/whatnot.png" alt="Whatnot" />
        </a>
      </footer>
    </div>
  );
}

export default App;
