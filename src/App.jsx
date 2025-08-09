import React, { useRef, useState } from 'react';
import './App.css';

// Use env in prod (Render), fallback to local in dev
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

function App() {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);
    setResults([]);

    try {
      // Brickognize v3: field name must be "image"
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('https://api.brickognize.com/v3/recognize', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      if (!json.items?.length) {
        setError('❌ No minifig match found.');
        setLoading(false);
        return;
      }

      // Enrich each item with BrickLink pricing via your backend
      const enriched = await Promise.all(
        json.items.map(async (item) => {
          let priceData = null;
          try {
            const priceRes = await fetch(`${API_BASE}/priceguide/${item.id}`);
            const priceJson = await priceRes.json();
            priceData = priceJson?.data ?? null;
          } catch (err) {
            console.error(`Price fetch failed for ${item.id}:`, err);
          }

          const bricklinkSite =
            item.external_sites?.find((s) => s.name?.toLowerCase() === 'bricklink') || {};

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
      console.error('Brickognize error:', err);
      setError('❌ Failed to contact Brickognize.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      {/* Header (if you're using these images from /public) */}
      <header className="app-header app-header--stack">
        <img src="/circle-logo-2.png" alt="Logo" className="app-logo" />
        <img src="/title.png" alt="App Title" className="app-title-image" />
      </header>

      {/* Controls */}
      <div className="controls">
        <button onClick={() => fileInputRef.current?.click()}>Choose Photo or File</button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
        />

        <button onClick={() => cameraInputRef.current?.click()}>Take Photo</button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
        />
      </div>

      {/* Preview + status */}
      {previewUrl && (
        <img
          src={previewUrl}
          alt="Preview"
          style={{ display: 'block', margin: '16px auto', maxWidth: 300 }}
        />
      )}
      {loading && <p className="loading">🔄 Searching…</p>}
      {error && <p className="error">{error}</p>}

      {/* Results */}
      <div className="results-container">
        {results.map((r) => (
          <div key={r.id} className="minifig-card">
            <img src={r.img_url} alt={r.name} />
            <h3>{r.name}</h3>
            <p><strong>ID:</strong> {r.id}</p>

            {r.external_url && (
              <p>
                <a href={r.external_url} target="_blank" rel="noreferrer">
                  View on BrickLink
                </a>
              </p>
            )}

            {r.priceData ? (
              <div className="price-info">
                <p><strong>Avg Price:</strong> ${Number(r.priceData.avg_price).toFixed(2)}</p>
                <p>
                  <strong>Min:</strong> ${Number(r.priceData.min_price).toFixed(2)} |{' '}
                  <strong>Max:</strong> ${Number(r.priceData.max_price).toFixed(2)}
                </p>
                <p><strong>Available:</strong> {r.priceData.total_quantity}</p>
              </div>
            ) : (
              <p className="loading">Loading price data…</p>
            )}
          </div>
        ))}
      </div>

      {/* Social footer (optional) */}
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