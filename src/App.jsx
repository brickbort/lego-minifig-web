import React, { useRef, useState } from 'react';
import './App.css';

// Backend base for BrickLink pricing (Render sets VITE_API_BASE, local uses localhost)
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

function App() {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function recognizeV3(file) {
    const fd = new FormData();
    // Brickognize v3 expects the field name "image"
    fd.append('image', file);
    const res = await fetch('https://api.brickognize.com/v3/recognize', { method: 'POST', body: fd });

    // Log full response for debugging
    const clone = res.clone();
    let bodyText = '';
    try { bodyText = await clone.text(); } catch {}
    console.log('[v3 recognize] status:', res.status, 'raw:', bodyText);

    if (!res.ok) throw new Error(`v3 failed ${res.status}: ${bodyText}`);
    const json = JSON.parse(bodyText || '{}');
    return json.items || [];
  }

  async function recognizePredict(file) {
    const fd = new FormData();
    // Legacy endpoint expects "query_image"
    fd.append('query_image', file, file.name);
    const res = await fetch('https://api.brickognize.com/predict/', { method: 'POST', body: fd });

    const clone = res.clone();
    let bodyText = '';
    try { bodyText = await clone.text(); } catch {}
    console.log('[predict recognize] status:', res.status, 'raw:', bodyText);

    if (!res.ok) throw new Error(`predict failed ${res.status}: ${bodyText}`);
    const json = JSON.parse(bodyText || '{}');
    return json.items || [];
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);
    setResults([]);

    try {
      // Try v3 first, fall back to predict if needed
      let items = [];
      try {
        items = await recognizeV3(file);
      } catch (e1) {
        console.warn('v3 recognize failed, trying predict…', e1);
        try {
          items = await recognizePredict(file);
        } catch (e2) {
          console.error('predict recognize also failed:', e2);
          throw new Error('Brickognize did not return results (v3 and predict failed).');
        }
      }

      if (!items.length) {
        setError('❌ No minifig match found.');
        setLoading(false);
        return;
      }

      // Enrich each item with BrickLink pricing via your backend
      const enriched = await Promise.all(
        items.map(async (item) => {
          const bricklinkSite =
            item.external_sites?.find((s) => s.name?.toLowerCase() === 'bricklink') || {};

          let priceData = null;
          try {
            const priceRes = await fetch(`${API_BASE}/priceguide/${item.id}`);
            const priceJson = await priceRes.json();
            console.log(`[price] ${item.id} status: ${priceRes.status}`, priceJson);
            priceData = priceJson?.data ?? null;
          } catch (err) {
            console.error(`Price fetch failed for ${item.id}:`, err);
          }

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
      console.error('Recognition error:', err);
      setError('❌ Failed to recognize the image. Please try another photo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      {/* Header (logo + title) */}
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
      {loading && <p className="loading">🔄 Working…</p>}
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

      {/* Footer */}
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