
// components/OverlayUploadButton.tsx
import React, { useRef } from 'react';

type Props = {
  onUpload: (image: File) => void;
};

const OverlayUploadButton: React.FC<Props> = ({ onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <div>
      <button
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        onClick={handleClick}
      >
        Upload Overlay Image
      </button>
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default OverlayUploadButton;
