import React, { useRef, useState } from 'react';
import './App.css';

// Backend base for BOTH recognition & pricing
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

function App() {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [condition, setCondition] = useState('N'); // N=new, U=used

  async function recognize(file) {
    const fd = new FormData();
    fd.append('image', file, file.name);
    const res = await fetch(`${API_BASE}/recognize`, { method: 'POST', body: fd });
    const json = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(json));
    return json.items || [];
  }

  async function fetchPrice(id) {
    try {
      const res = await fetch(`${API_BASE}/priceguide/${id}?cond=${condition}`);
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
      const items = await recognize(file);

      if (!items.length) {
        setError('❌ No minifig match found.');
        setLoading(false);
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
      setError('❌ Failed to recognize the image. Please try another photo.');
    } finally {
      setLoading(false);
    }
  };

  // If you want prices to refresh when switching New/Used:
  const handleConditionChange = async (e) => {
    const cond = e.target.value;
    setCondition(cond);
    if (!results.length) return;

    setLoading(true);
    const updated = await Promise.all(
      results.map(async (r) => ({
        ...r,
        priceData: await fetchPrice(r.id),
      }))
    );
    setResults(updated);
    setLoading(false);
  };

  return (
    <div className="app">
      {/* Header (images from /public) */}
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

        <label style={{ marginLeft: 8 }}>
          Condition:{' '}
          <select value={condition} onChange={handleConditionChange} aria-label="Price condition">
            <option value="N">New</option>
            <option value="U">Used</option>
          </select>
        </label>
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

      {/* Footer icons (optional) */}
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