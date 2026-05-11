import React, { useEffect, useRef, useState } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

function App() {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  const toggleDark = () => {
    setDark((d) => {
      const next = !d;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function fetchPrice(id) {
    try {
      const res = await fetch(`${API_BASE}/priceguide/${id}?cond=N`);
      const json = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(json));
      return json.data || null;
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
        <button className="theme-toggle" onClick={toggleDark} aria-label="Toggle dark mode">
          {dark ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          )}
        </button>
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
          style={{ display: 'block', margin: '16px auto', maxWidth: 300 }}
        />
      )}
      {loading && <p className="loading">Working…</p>}
      {error && <p className="error">{error}</p>}

      <div className="results-container">
        {results.map((r) => (
          <div key={r.id} className="minifig-card">
            <img src={r.img_url} alt={r.name} />
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
                <p>
                  <strong>Avg Price:</strong> ${Number(r.priceData.avg_price).toFixed(2)}
                </p>
                <p>
                  <strong>Min:</strong> ${Number(r.priceData.min_price).toFixed(2)} |{' '}
                  <strong>Max:</strong> ${Number(r.priceData.max_price).toFixed(2)}
                </p>
                <p>
                  <strong>Available:</strong> {r.priceData.total_quantity}
                </p>
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
