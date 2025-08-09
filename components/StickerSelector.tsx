
// components/StickerSelector.tsx
import React, { useRef } from 'react';

type StickerOption = {
  label: string;
  url: string;
  position?: 'bottom' | 'draggable';
};

type Props = {
  hostedStickers: StickerOption[];
  onSelectSticker: (sticker: StickerOption) => void;
  onUpload: (file: File) => void;
};

const StickerSelector: React.FC<Props> = ({ hostedStickers, onSelectSticker, onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold">Add Sticker from List</label>
      <select
        className="w-full p-2 border rounded"
        onChange={(e) => {
          const selected = hostedStickers.find(s => s.url === e.target.value);
          if (selected) onSelectSticker(selected);
        }}
        defaultValue=""
      >
        <option value="" disabled>Select a sticker</option>
        {hostedStickers.map((sticker, index) => (
          <option key={index} value={sticker.url}>
            {sticker.label}
          </option>
        ))}
      </select>

      <div className="mt-4">
        <label className="block text-sm font-semibold mb-1">Or Upload Custom Image</label>
        <button
          onClick={handleUploadClick}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Upload Image
        </button>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};

export default StickerSelector;
