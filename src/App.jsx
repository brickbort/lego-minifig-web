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
  const [wantedLists, setWantedLists] = useState(null); // null=hidden, array=show picker

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function loadWantedListItems(listId) {
    setLoading(true);
    setError('');
    setWantedLists(null);
    try {
      const res = await fetch(`${API_BASE}/wantedlists/${listId}/items`);
      const items = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(items));

      const minifigs = items.filter((entry) => entry.item?.type === 'MINIFIG');
      if (!minifigs.length) {
        setError('No minifigs found in this wanted list.');
        return;
      }

      const enriched = await Promise.all(
        minifigs.map(async (entry) => {
          const id = entry.item.no;
          const priceData = await fetchPrice(id);
          return {
            id,
            name: entry.item.name,
            img_url: `https://img.bricklink.com/ItemImage/MN/0/${id}.png`,
            external_url: `https://www.bricklink.com/v2/catalog/catalogitem.page?M=${id}`,
            priceData,
            quantity: entry.quantity,
          };
        })
      );

      setResults(enriched);
    } catch (e) {
      console.error('wanted list items error:', e);
      setError('Failed to load wanted list items.');
    } finally {
      setLoading(false);
    }
  }

  async function handleWantedList() {
    setError('');
    setResults([]);
    setPreviewUrl(null);
    setWantedLists(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/wantedlists`);
      const lists = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(lists));

      if (!lists.length) {
        setError('No wanted lists found on your BrickLink account.');
        return;
      }

      if (lists.length === 1) {
        await loadWantedListItems(lists[0].id);
      } else {
        setWantedLists(lists);
        setLoading(false);
      }
    } catch (e) {
      console.error('wanted lists fetch error:', e);
      setError('Failed to load wanted lists.');
      setLoading(false);
    }
  }

  async function fetchPrice(id) {
    try {
      const res = await fetch(`${API_BASE}/priceguide/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(json));

      // New backend format: { new: {...}, used: {...} }
      if ('new' in json || 'used' in json) return json;

      // Old backend format: { meta, data } — make a second call for Used
      if (json.data) {
        const usedRes = await fetch(`${API_BASE}/priceguide/${id}?cond=U`);
        const usedJson = await usedRes.json();
        return { new: json.data, used: usedJson.data || null };
      }

      return null;
    } catch (e) {
      console.error('price fetch error:', e);
      return null;
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset so selecting the same file again re-triggers onChange
    e.target.value = '';

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
        <button onClick={handleWantedList}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          Wanted List
        </button>
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

      {wantedLists && wantedLists.length > 1 && (
        <div className="list-picker">
          <p className="list-picker-label">Select a wanted list:</p>
          <div className="list-picker-buttons">
            {wantedLists.map((list) => (
              <button
                key={list.id}
                className="btn-secondary"
                onClick={() => loadWantedListItems(list.id)}
              >
                {list.name || `List #${list.id}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {previewUrl && (
        <img src={previewUrl} alt="Preview" className="preview-image" />
      )}

      {loading && (
        <div className="loading-state">
          <span className="spinner" role="status" aria-label="Loading" />
          <p className="loading">Identifying…</p>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {results.length > 0 && (
        <div className="results-container">
          {results.map((r) => (
            <div key={r.id} className="minifig-card">
              <img
                src={r.img_url}
                alt={r.name}
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <h3>{r.name}</h3>
              <p><strong>ID:</strong> {r.id}{r.quantity > 1 ? ` · Qty: ${r.quantity}` : ''}</p>

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
                <p className="muted">Price unavailable</p>
              )}
            </div>
          ))}
        </div>
      )}

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
