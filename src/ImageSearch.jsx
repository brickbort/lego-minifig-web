import React, { useState } from 'react';
import axios from 'axios';

function ImageSearch() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedImage(URL.createObjectURL(file));
    setLoading(true);
    setResults([]);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await axios.post('https://api.brickognize.com/v3/recognize', formData);
      const items = res.data.items || [];

      const enriched = await Promise.all(
        items.map(async (item) => {
          let priceData = null;
          try {
            const priceRes = await axios.get(`http://localhost:3001/priceguide/${item.id}`);
            priceData = priceRes.data.data;
          } catch (err) {
            console.error('Error fetching price data:', err);
          }

          return { ...item, priceData };
        })
      );

      setResults(enriched);
    } catch (err) {
      console.error('Error contacting Brickognize:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <h2>Upload a LEGO Minifig Image</h2>
      <input type="file" accept="image/*" onChange={handleImageUpload} />
      {selectedImage && <img src={selectedImage} alt="Uploaded" style={{ maxWidth: '200px', margin: '1rem 0' }} />}
      {loading && <p>🔄 Searching...</p>}
      {!loading && results.length === 0 && selectedImage && <p>No match found.</p>}

      {results.map((res) => (
        <div key={res.id} style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }}>
          <img src={res.img_url} alt={res.name} style={{ width: '100px' }} />
          <h3>{res.name}</h3>
          <p><strong>ID:</strong> {res.id}</p>
          <a href={`https://www.bricklink.com/v2/catalog/catalogitem.page?M=${res.id}`} target="_blank" rel="noreferrer">
            View on BrickLink
          </a>

          {res.priceData ? (
            <div style={{ marginTop: '0.5rem' }}>
              <p><strong>Avg Price:</strong> ${Number(res.priceData.avg_price).toFixed(2)}</p>
              <p>
                <strong>Min:</strong> ${Number(res.priceData.min_price).toFixed(2)} | 
                <strong> Max:</strong> ${Number(res.priceData.max_price).toFixed(2)}
              </p>
              <p><strong>Available:</strong> {res.priceData.total_quantity}</p>
            </div>
          ) : (
            <p style={{ color: 'gray' }}>No price data available.</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default ImageSearch;