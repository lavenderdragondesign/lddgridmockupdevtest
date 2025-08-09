
import React, { useState } from 'react';
import JSZip from 'jszip';

// CRC32 implementation for PNG chunk
type CRC32Func = ((buf: Uint8Array) => number) & { table?: number[] };
const crc32: CRC32Func = (buf) => {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      }
      table[i] = c >>> 0;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ -1) >>> 0;
};

function setDPI(blob, dpi = 300, type = 'image/png') {
  // For PNG, add pHYs chunk. For JPEG, add APP0 segment. This is a best-effort browser-side hack.
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const result = e.target.result;
      if (!result || typeof result === 'string') return resolve(blob); // fallback
      let arr = new Uint8Array(result);
      if (type === 'image/png') {
        // Insert pHYs chunk after IHDR with correct CRC
        const xppm = Math.round(dpi / 0.0254);
        const yppm = xppm;
        const chunkData = new Uint8Array(9);
        chunkData.set([
          (xppm >> 24) & 0xFF, (xppm >> 16) & 0xFF, (xppm >> 8) & 0xFF, xppm & 0xFF,
          (yppm >> 24) & 0xFF, (yppm >> 16) & 0xFF, (yppm >> 8) & 0xFF, yppm & 0xFF,
          0x01 // unit: meter
        ]);
        const chunkType = new Uint8Array([0x70,0x48,0x59,0x73]); // 'pHYs'
        const chunk = new Uint8Array(4 + 4 + 9 + 4); // len + type + data + crc
        chunk.set([0x00,0x00,0x00,0x09], 0); // length 9
        chunk.set(chunkType, 4);
        chunk.set(chunkData, 8);
        // CRC is over type+data
        const crc = crc32(new Uint8Array([...chunkType, ...chunkData]));
        chunk.set([
          (crc >> 24) & 0xFF, (crc >> 16) & 0xFF, (crc >> 8) & 0xFF, crc & 0xFF
        ], 17);
        // Find IHDR end
        let ihdrEnd = 8 + 25; // PNG sig + IHDR chunk
        let before = arr.slice(0, ihdrEnd);
        let after = arr.slice(ihdrEnd);
        let out = new Uint8Array(before.length + chunk.length + after.length);
        out.set(before, 0);
        out.set(chunk, before.length);
        out.set(after, before.length + chunk.length);
        resolve(new Blob([out], { type }));
      } else if (type === 'image/jpeg') {
        // Insert APP0 JFIF segment with DPI after SOI marker (FFD8)
        let app0 = new Uint8Array([
          0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,0x01,0x01,
          0x00,0xC8,0x00,0xC8,0x00,0x00 // 300x300 DPI
        ]);
        // Find SOI (FFD8)
        if (arr[0] === 0xFF && arr[1] === 0xD8) {
          let out = new Uint8Array(arr.length + app0.length);
          out.set(arr.slice(0,2), 0);
          out.set(app0, 2);
          out.set(arr.slice(2), 2 + app0.length);
          resolve(new Blob([out], { type }));
        } else {
          resolve(blob);
        }
      } else {
        resolve(blob);
      }
    };
    reader.readAsArrayBuffer(blob);
  });
}

function resizeImage(file, width, height, dpi = 300) {
  return new Promise(async (resolve, reject) => {
    const img = new window.Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(async (blob) => {
        if (blob) {
          const withDPI = await setDPI(blob, dpi, file.type);
          resolve(withDPI);
        } else {
          reject(new Error('Canvas is empty'));
        }
      }, file.type, 0.95);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}


const BulkImageResizer = () => {
  const [files, setFiles] = useState([]);
  const [width, setWidth] = useState(256);
  const [height, setHeight] = useState(256);
  const [resized, setResized] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFiles = (e) => {
    setFiles(Array.from(e.target.files));
    setResized([]);
  };

  const handleResize = async () => {
    setLoading(true);
    const results = await Promise.all(
      files.map(async (file) => {
        try {
          const blob = await resizeImage(file, width, height, 300);
          return {
            name: file.name.replace(/\.(png|jpg|jpeg)$/i, `_resized.$1`),
            url: URL.createObjectURL(blob as Blob),
            type: file.type,
            blob: blob as Blob,
          };
        } catch {
          return null;
        }
      })
    );
    setResized(results.filter(Boolean));
    setLoading(false);
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    resized.forEach(img => {
      zip.file(img.name, img.blob);
    });
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resized_images.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  const presets = [
    { label: 'POD Default', w: 4500, h: 5400 },
    { label: 'Tumbler Wrap', w: 2790, h: 2460 },
    { label: 'Square', w: 1024, h: 1024 },
    { label: 'Standard Mockup', w: 2000, h: 1500 },
    { label: '11 oz Mug Wrap (SwiftPOD)', w: 2625, h: 1050 },
    { label: '11 oz Mug Wrap (District Photo)', w: 2475, h: 1156 },
  ];

  return (
    <div style={{ maxWidth: 480, margin: '32px auto', background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #0001', padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><rect width="24" height="24" rx="12" fill="#84cc16"/><path d="M8 12h8m-4-4v8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
        <h3 style={{ fontSize: 24, fontWeight: 700, marginLeft: 12, color: '#222' }}>Bulk Image Resizer</h3>
      </div>
      <input
        type="file"
        accept=".png,.jpg,.jpeg"
        multiple
        onChange={handleFiles}
        style={{ marginBottom: 16 }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {presets.map(preset => (
          <button
            key={preset.label}
            type="button"
            onClick={() => { setWidth(preset.w); setHeight(preset.h); }}
            style={{
              background: width === preset.w && height === preset.h ? '#84cc16' : '#f3f4f6',
              color: width === preset.w && height === preset.h ? '#222' : '#333',
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: '6px 12px',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {preset.label}<br /><span style={{ fontWeight: 400, fontSize: 12 }}>{preset.w}×{preset.h}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <label style={{ flex: 1 }}>
          <span style={{ fontWeight: 500 }}>Width</span>
          <input
            type="number"
            value={width}
            min={1}
            onChange={e => setWidth(Number(e.target.value))}
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd', marginTop: 4 }}
          />
        </label>
        <label style={{ flex: 1 }}>
          <span style={{ fontWeight: 500 }}>Height</span>
          <input
            type="number"
            value={height}
            min={1}
            onChange={e => setHeight(Number(e.target.value))}
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd', marginTop: 4 }}
          />
        </label>
      </div>
      <button onClick={handleResize} disabled={!files.length || loading} style={{ width: '100%', background: '#84cc16', color: '#222', fontWeight: 700, border: 'none', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16, cursor: loading ? 'wait' : 'pointer' }}>
        {loading ? 'Resizing...' : 'Resize Images (300 DPI)'}
      </button>
      {resized.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <h4 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Resized Images Ready</h4>
            <button onClick={handleDownloadZip} style={{ background: '#222', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>Download All as ZIP</button>
            <span style={{ fontSize: 13, color: '#888', marginTop: 8 }}>{resized.length} images, total size: {((resized.reduce((sum, img) => sum + img.blob.size, 0))/1024).toFixed(1)} KB</span>
          </div>
        </div>
      )}
      <div style={{ marginTop: 24, fontSize: 13, color: '#888', textAlign: 'center' }}>
        All images are resized in your browser. DPI is set to 300 for print quality.
      </div>
    </div>
  );
};

export default BulkImageResizer;
