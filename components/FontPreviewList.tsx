
// components/FontPreviewList.tsx
import React from 'react';

type FontOption = {
  label: string;
  value: string;
};

type Props = {
  fonts: FontOption[];
  previewText?: string;
  onFontSelect: (font: string) => void;
};

const FontPreviewList: React.FC<Props> = ({ fonts, previewText = 'Sample Text', onFontSelect }) => {
  return (
    <div className="max-h-64 overflow-y-auto border rounded p-2 space-y-2 bg-white">
      {fonts.map((font, idx) => (
        <div
          key={idx}
          className="cursor-pointer p-2 rounded hover:bg-gray-100"
          onClick={() => onFontSelect(font.value)}
          style={{ fontFamily: font.value }}
        >
          {previewText} - <span className="text-xs text-gray-600">{font.label}</span>
        </div>
      ))}
    </div>
  );
};

export default FontPreviewList;
