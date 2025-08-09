import StickerSelector from './components/StickerSelector';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import StickerSelector from './components/StickerSelector';
import { LayoutMode, ImageState, TextLayer, WatermarkState, BackgroundState, BackgroundType, WatermarkPosition } from './types';
import StickerSelector from './components/StickerSelector';
import { FONT_FACES } from './constants';
import BulkImageResizer from './components/BulkImageResizer';
// Ensure crisp rendering on high-DPI displays for runtime canvas (not export)
function ensureHiDPICanvas(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, (typeof window !== 'undefined' && (window.devicePixelRatio || 1)) ? window.devicePixelRatio : 1);
  const pw = Math.floor(rect.width * dpr);
  const ph = Math.floor(rect.height * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  // Use CSS pixels for layout math; scale context by DPR
  const logicalW = rect.width;
  const logicalH = rect.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;
  // setTransform is already applied in ensureHiDPICanvas

  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { logicalW, logicalH, dpr };
}

import FreeformCanvas from './components/FreeformCanvas';

// HELPER & UI COMPONENTS

/**
 * A hook that debounces a value.
 * @param value The value to debounce.
 * @param delay The debounce delay in milliseconds.
 * @returns The debounced value.
 */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

interface IconProps {
  name: string;
  className?: string;
}

const Icon: React.FC<IconProps> = ({ name, className = 'w-4 h-4' }) => (
  <i data-lucide={name} className={className}></i>
);

interface SliderProps {
  label: string;
  icon: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
}

const Slider = React.memo<SliderProps>(({ label, icon, value, onChange, min = 0, max = 100, step = 1, unit = '', disabled = false }) => (
  <div className="flex flex-col space-y-2">
    <label className={`flex items-center space-x-2 text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-600'}`}>
      <Icon name={icon} />
      <span>{label}</span>
    </label>
    <div className="flex items-center space-x-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full h-2 bg-gray-300 rounded-lg appearance-none ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} disabled:bg-gray-200`}
      />
      <span className={`text-sm font-mono bg-gray-200 text-gray-800 px-2 py-1 rounded-md w-16 text-center ${disabled ? 'text-gray-400' : ''}`}>{value}{unit}</span>
    </div>
  </div>
));

interface ToggleProps {
  label: string;
  icon: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

const Toggle = React.memo<ToggleProps>(({ label, icon, checked, onChange, disabled = false }) => (
    <label className={`flex items-center justify-between ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
        <div className="flex items-center space-x-2">
            <Icon name={icon} className={`w-5 h-5 ${disabled ? 'text-gray-400' : 'text-gray-500'}`} />
            <span className={`font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>{label}</span>
        </div>
        <div className="relative">
            <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} disabled={disabled}/>
            <div className={`block w-12 h-6 rounded-full ${disabled ? 'bg-gray-200' : (checked ? 'bg-lime-500' : 'bg-gray-300')}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? `transform translate-x-6` : ''}`}></div>
        </div>
    </label>
));

type InteractionState = {
  mode: 'idle' | 'dragging';
  target: 'text' | null;
  id?: string;
  offsetX?: number;
  offsetY?: number;
};

// MAIN APPLICATION COMPONENT
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const isResizingRef = useRef(false);
  
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  
  // Image & Layout State// Helper: determine if current mode uses a 'big' slot
  const isBigLayout = (mode: LayoutMode) =>
    mode === 'left-big' || mode === 'right-big' || mode === 'top-big' || mode === 'bottom-big';

  const [images, setImages] = useState<ImageState[]>([]);
  // Big Image selection for 'big' layouts
  const [bigImageId, setBigImageId] = useState<string | null>(null);
  // Keep bigImageId valid when image list changes
  useEffect(() => {
    if (images.length === 0) {
      if (bigImageId !== null) setBigImageId(null);
      return;
    }
    if (!bigImageId || !images.some(i => i.id === bigImageId)) {
      setBigImageId(images[0].id);
    }
  }, [images]);
  
  const [globalZoom, setGlobalZoom] = useState(1);
  const [gap, setGap] = useState(16);
  
  const [freeformTidyTick, setFreeformTidyTick] = useState(0);
const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
  const imageFit = 'contain'; // Hardcoded
  const [mainZoom, setMainZoom] = useState(1);
  const [bgBlur, setBgBlur] = useState(10);
  const [bgOpacity, setBgOpacity] = useState(0.3);
  useEffect(() => {
    if (layoutMode === 'freeform') {
      setFreeformTidyTick(t => t + 1); // signal Freeform to tidy on mode switch
    }
  }, [layoutMode]);


  // Debounced states for performance
  const debouncedGlobalZoom = useDebouncedValue(globalZoom, 50);
  const debouncedGap = useDebouncedValue(gap, 50);
  const debouncedMainZoom = useDebouncedValue(mainZoom, 50);
  const debouncedBgBlur = useDebouncedValue(bgBlur, 50);
  const debouncedBgOpacity = useDebouncedValue(bgOpacity, 50);

  // New State
  const [background, setBackground] = useState<BackgroundState>({ type: 'color', value: '#F3F4F6' });
  const [watermark, setWatermark] = useState<WatermarkState | null>(null);
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

  // Performance: Cached Bitmaps
  const [imageBitmaps, setImageBitmaps] = useState<Map<string, ImageBitmap>>(new Map());
  const [watermarkBitmap, setWatermarkBitmap] = useState<ImageBitmap | null>(null);
  const [backgroundBitmap, setBackgroundBitmap] = useState<ImageBitmap | null>(null);
  
  // Interaction State
  const [interactionState, setInteractionState] = useState<InteractionState>({ mode: 'idle', target: null});
  const [exportName, setExportName] = useState('mockup.png');
  const [isExporting, setIsExporting] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  
  // Sidebar & Drag-n-Drop state
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  // BulkImageResizer Modal State
  const [showBulkResizer, setShowBulkResizer] = useState(false);

  // Helper to generate compatible IDs
  const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

  // Image & File Handling
  const addImages = useCallback(async (files: FileList | File[]) => {
      const newImageStates: ImageState[] = [];
      const newBitmaps = new Map<string, ImageBitmap>();

      for (const file of Array.from(files).filter(f => f.type.startsWith('image/'))) {
          const id = generateId();
          const imageState: ImageState = {
              id,
              url: URL.createObjectURL(file),
              file,
          };
          newImageStates.push(imageState);
          try {
              const bitmap = await createImageBitmap(file);
              newBitmaps.set(id, bitmap);
          } catch (e) {
              console.error("Could not create bitmap for image", file.name, e);
          }
      }

      if (newImageStates.length > 0) {
          setImages(prev => [...prev, ...newImageStates]);
          setImageBitmaps(prev => new Map([...prev, ...newBitmaps]));
      }
  }, []);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addImages(event.target.files);
      event.target.value = ''; // Reset input
    }
  };

  const handleWatermarkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setWatermark({
        id: generateId(),
        url: URL.createObjectURL(file),
        file,
        opacity: 0.5,
        size: 20,
        position: 'bottom-right',
      });
       try {
            const bitmap = await createImageBitmap(file);
            setWatermarkBitmap(bitmap);
        } catch (e) {
            console.error("Could not create bitmap for watermark", e);
            setWatermark(null);
        }
    }
  };

  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
        const file = event.target.files[0];
        setBackground({
            type: 'image',
            value: {
                id: generateId(),
                url: URL.createObjectURL(file),
                file,
            },
        });
        try {
            const bitmap = await createImageBitmap(file);
            setBackgroundBitmap(bitmap);
        } catch(e) {
            console.error("Could not create bitmap for background", e);
            setBackground({ type: 'color', value: '#F3F4F6' });
        }
    }
  };

  // --- Canvas Setup ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setViewport({ width, height });
        if (canvasRef.current) {
          canvasRef.current.width = width;
          canvasRef.current.height = height;
        }
      }
    });
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // --- Drawing Logic ---
  const drawCanvas = useCallback((canvas: HTMLCanvasElement, forExport: boolean = false) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const EXPORT_WIDTH = 2000;
    const EXPORT_HEIGHT = 1500;

    const { logicalW: currentWidth, logicalH: currentHeight } = forExport ? { logicalW: EXPORT_WIDTH, logicalH: EXPORT_HEIGHT } : ensureHiDPICanvas(canvas);
    
    const scaleX = forExport ? EXPORT_WIDTH / viewport.width : 1;
    const scaleY = forExport ? EXPORT_HEIGHT / viewport.height : 1;
    
    // Use pre-created bitmaps for performance
    const loadedGridImages = images.map(img => imageBitmaps.get(img.id)).filter((b): b is ImageBitmap => !!b);

    // 1. Draw Background
    ctx.clearRect(0, 0, currentWidth, currentHeight);
    if (background.type === 'image' && backgroundBitmap) {
        ctx.drawImage(backgroundBitmap, 0, 0, currentWidth, currentHeight);
    } else {
        ctx.fillStyle = background.type === 'color' && background.value ? background.value as string : '#F3F4F6';
        ctx.fillRect(0, 0, currentWidth, currentHeight);
    }

    if (images.length === 0 && !forExport) {
        ctx.fillStyle = '#6b7280';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '24px Montserrat';
        ctx.fillText('Upload images to begin', currentWidth / 2, currentHeight / 2);
        return;
    }

    // 2. Draw Image Grid/Layout
    const drawImage = (img: ImageBitmap, x: number, y: number, w: number, h: number, extraZoom: number = 1) => {
        if (w <= 0 || h <= 0 || img.width <= 0 || img.height <= 0) return;
        const zoom = debouncedGlobalZoom * extraZoom;
        
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();

        const imgRatio = img.width / img.height;
        const cellRatio = w / h;
        
        let baseW, baseH;
        if (imgRatio > cellRatio) {
            baseW = w;
            baseH = w / imgRatio;
        } else {
            baseH = h;
            baseW = h * imgRatio;
        }

        const renderW = baseW * zoom;
        const renderH = baseH * zoom;
        const renderX = x + (w - renderW) / 2;
        const renderY = y + (h - renderH) / 2;

        ctx.drawImage(img, renderX, renderY, renderW, renderH);
        ctx.restore();
    };

    const exportGapX = debouncedGap * scaleX;
    const exportGapY = debouncedGap * scaleY;

    switch (layoutMode) {
        case 'freeform': {
            // Images drawn by FreeformCanvas overlay; skip here.
            break;
        }
        case 'grid': {
            if (loadedGridImages.length === 0) break;
            const cols = Math.max(1, Math.ceil(Math.sqrt(loadedGridImages.length)));
            const rows = Math.max(1, Math.ceil(loadedGridImages.length / cols));
            const cellWidth = Math.max(0, (currentWidth - (cols + 1) * exportGapX) / cols);
            const cellHeight = Math.max(0, (currentHeight - (rows + 1) * exportGapY) / rows);
            loadedGridImages.forEach((img, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const x = exportGapX + col * (cellWidth + exportGapX);
                const y = exportGapY + row * (cellHeight + exportGapY);
                drawImage(img, x, y, cellWidth, cellHeight);
            });
            break;
        }
        
        case 'left-big':
        case 'right-big': {
            const isLeftBig = layoutMode === 'left-big';
            if (loadedGridImages.length > 0) {
                const bigX = isLeftBig ? exportGapX : currentWidth / 2 + exportGapX / 2;
                const bigW = Math.max(0, currentWidth / 2 - exportGapX * 1.5);
                const bigH = Math.max(0, currentHeight - exportGapY * 2);
                // Determine selected big image
                const bigIdx = images.findIndex(i => i.id === (bigImageId ?? images[0]?.id));
                const bigBitmap = bigIdx >= 0 ? imageBitmaps.get(images[bigIdx].id) : loadedGridImages[0];
                if (bigBitmap) {
                    drawImage(bigBitmap, bigX, exportGapY, bigW, bigH);
                }
            }
            if (images.length > 1) {
                const gridImages = images
                    .filter((im, idx) => idx !== images.findIndex(i => i.id === (bigImageId ?? images[0]?.id)))
                    .map(im => imageBitmaps.get(im.id))
                    .filter((b): b is ImageBitmap => !!b);
                const cols = Math.max(1, Math.ceil(Math.sqrt(gridImages.length)));
                const rows = Math.max(1, Math.ceil(gridImages.length / cols));
                const startX = isLeftBig ? currentWidth / 2 + exportGapX / 2 : exportGapX;
                const availableWidth = Math.max(0, currentWidth / 2 - exportGapX * 1.5);
                const cellWidth = Math.max(0, (availableWidth - (cols - 1) * exportGapX) / cols);
                const cellHeight = Math.max(0, (currentHeight - (rows + 1) * exportGapY) / rows);
                gridImages.forEach((img, i) => {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    const x = startX + col * (cellWidth + exportGapX);
                    const y = exportGapY + row * (cellHeight + exportGapY);
                    drawImage(img, x, y, cellWidth, cellHeight);
                });
            }
            break;
        }
        case 'top-big':
        case 'bottom-big': {
            const isTopBig = layoutMode === 'top-big';
            if (loadedGridImages.length > 0) {
                const bigY = isTopBig ? exportGapY : currentHeight / 2 + exportGapY / 2;
                const bigW = Math.max(0, currentWidth - exportGapX * 2);
                const bigH = Math.max(0, currentHeight / 2 - exportGapY * 1.5);
                // Determine selected big image
                const bigIdx2 = images.findIndex(i => i.id === (bigImageId ?? images[0]?.id));
                const bigBitmap2 = bigIdx2 >= 0 ? imageBitmaps.get(images[bigIdx2].id) : loadedGridImages[0];
                if (bigBitmap2) {
                    drawImage(bigBitmap2, exportGapX, bigY, bigW, bigH);
                }
            }
            if (images.length > 1) {
                const gridImages = images
                    .filter((im, idx) => idx !== images.findIndex(i => i.id === (bigImageId ?? images[0]?.id)))
                    .map(im => imageBitmaps.get(im.id))
                    .filter((b): b is ImageBitmap => !!b);
                const startY = isTopBig ? currentHeight / 2 + exportGapY / 2 : exportGapY;
                const gridHeight = Math.max(0, currentHeight / 2 - exportGapY * 1.5);
                const cols = Math.max(1, Math.ceil(Math.sqrt(gridImages.length)));
                const rows = Math.max(1, Math.ceil(gridImages.length / cols));
                const cellWidth = Math.max(0, (currentWidth - (cols + 1) * exportGapX) / cols);
                const cellHeight = Math.max(0, (gridHeight - (rows - 1) * exportGapY) / rows);
                gridImages.forEach((img, i) => {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    const x = exportGapX + col * (cellWidth + exportGapX);
                    const y = startY + row * (cellHeight + exportGapY);
                    drawImage(img, x, y, cellWidth, cellHeight);
                });
            }
            break;
        }

        case 'single-blur': {
            const bgImages = loadedGridImages.slice(1);
            if (bgImages.length > 0) {
                ctx.save();
                ctx.filter = `blur(${debouncedBgBlur * scaleX}px)`;
                ctx.globalAlpha = debouncedBgOpacity;
                const cols = Math.max(1, Math.ceil(Math.sqrt(bgImages.length)));
                const rows = Math.max(1, Math.ceil(bgImages.length / cols));
                const cellWidth = currentWidth / cols;
                const cellHeight = currentHeight / rows;
                bgImages.forEach((img, i) => {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    ctx.drawImage(img, col * cellWidth, row * cellHeight, cellWidth, cellHeight);
                });
                ctx.restore();
            }
            if (loadedGridImages.length > 0) {
                const maxW = currentWidth * 0.8;
                const maxH = currentHeight * 0.9;
                const cellX = (currentWidth - maxW) / 2;
                const cellY = (currentHeight - maxH) / 2;
                drawImage(loadedGridImages[0], cellX, cellY, maxW, maxH, debouncedMainZoom);
            }
            break;
        }
    }

    // 3. Draw Watermark
    if (watermark && watermarkBitmap && watermarkBitmap.width > 0 && watermarkBitmap.height > 0) {
        ctx.save();
        ctx.globalAlpha = watermark.opacity;
        const aspect = watermarkBitmap.width / watermarkBitmap.height;
        const w = (currentWidth / 100) * watermark.size;
        const h = w / aspect;
        const marginX = exportGapX;
        const marginY = exportGapY;
        let x = 0, y = 0;
        switch (watermark.position) {
            case 'top-left': x = marginX; y = marginY; break;
            case 'top-right': x = currentWidth - w - marginX; y = marginY; break;
            case 'bottom-left': x = marginX; y = currentHeight - h - marginY; break;
            case 'bottom-right': x = currentWidth - w - marginX; y = currentHeight - h - marginY; break;
            case 'center': x = (currentWidth - w) / 2; y = (currentHeight - h) / 2; break;
        }
        ctx.drawImage(watermarkBitmap, x, y, w, h);
        ctx.restore();
    }
    
    // 4. Draw text layers (for both UI and export)
    for (const layer of textLayers) {
      ctx.save();
      const x = layer.x * scaleX;
      const y = layer.y * scaleY;
      ctx.translate(x, y);
      ctx.rotate(layer.rotation * Math.PI / 180);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const scaledFontSize = layer.fontSize * scaleY;
      const scaledPadding = layer.padding * scaleY;
      ctx.font = `${scaledFontSize}px '${layer.fontFamily}'`;

      if (layer.backgroundOpacity > 0) {
          const metrics = ctx.measureText(layer.text);
          const rectW = metrics.width + scaledPadding * 2;
          const rectH = scaledFontSize + scaledPadding * 2;
          ctx.globalAlpha = layer.backgroundOpacity;
          ctx.fillStyle = layer.backgroundColor;
          ctx.fillRect(-rectW / 2, -rectH / 2, rectW, rectH);
          ctx.globalAlpha = 1;
      }
      if (layer.shadow) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
          ctx.shadowBlur = 10 * scaleY;
          ctx.shadowOffsetX = 5 * scaleX;
          ctx.shadowOffsetY = 5 * scaleY;
      }
      ctx.fillStyle = layer.color;
      ctx.fillText(layer.text, 0, 0);
      ctx.restore();
    }
  }, [background, backgroundBitmap, debouncedBgBlur, debouncedBgOpacity, debouncedGap, debouncedGlobalZoom, debouncedMainZoom, imageBitmaps, images, layoutMode, textLayers, viewport.width, viewport.height, watermark, watermarkBitmap, bigImageId]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !viewport.width || !viewport.height) return;
    
    drawCanvas(canvas, false);
    
  }, [
      images, layoutMode, textLayers, watermark, background, 
      debouncedGap, debouncedGlobalZoom, debouncedMainZoom, debouncedBgBlur, debouncedBgOpacity,
      imageBitmaps, watermarkBitmap, backgroundBitmap, viewport.width, viewport.height,
      selectedTextId, drawCanvas
  , bigImageId]);
  
  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });
  
  // Text Layer Management
  const addTextLayer = () => {
    const canvas = canvasRef.current;
    const newLayer: TextLayer = {
      id: generateId(),
      text: 'New Text',
      x: canvas ? canvas.width / 2 : 400,
      y: canvas ? canvas.height / 2 : 300,
      fontSize: 48,
      fontFamily: 'Montserrat',
      color: '#FFFFFF',
      rotation: 0,
      shadow: true,
      backgroundColor: '#000000',
      backgroundOpacity: 0.5,
      padding: 10,
    };
    setTextLayers(prev => [...prev, newLayer]);
    setSelectedTextId(newLayer.id);
  };

  const updateSelectedLayer = (props: Partial<TextLayer>) => {
    if (!selectedTextId) return;
    setTextLayers(prev => prev.map(layer => 
      layer.id === selectedTextId ? { ...layer, ...props } : layer
    ));
  };
  
  const deleteTextLayer = (id: string) => {
    setTextLayers(prev => prev.filter(layer => layer.id !== id));
    if (selectedTextId === id) {
      setSelectedTextId(null);
    }
  }

  const selectedLayer = useMemo(() => {
    if (!selectedTextId) return null;
    return textLayers.find(layer => layer.id === selectedTextId);
  }, [selectedTextId, textLayers]);


  // Mouse Handlers for Canvas Interaction
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;

    // Check for text layer click first (in reverse order for Z-index)
    for (let i = textLayers.length - 1; i >= 0; i--) {
      const layer = textLayers[i];
      ctx.font = `${layer.fontSize}px ${layer.fontFamily}`;
      const textMetrics = ctx.measureText(layer.text);
      const textWidth = textMetrics.width + layer.padding * 2;
      const textHeight = layer.fontSize + layer.padding * 2;
      
      const angle = layer.rotation * Math.PI / 180;
      const cos = Math.cos(-angle);
      const sin = Math.sin(-angle);
      const dx = mouseX - layer.x;
      const dy = mouseY - layer.y;
      const rotatedX = dx * cos - dy * sin;
      const rotatedY = dx * sin + dy * cos;

      if (Math.abs(rotatedX) < textWidth / 2 && Math.abs(rotatedY) < textHeight / 2) {
          setSelectedTextId(layer.id);
          setInteractionState({
            mode: 'dragging',
            target: 'text',
            id: layer.id,
            offsetX: mouseX - layer.x,
            offsetY: mouseY - layer.y,
          });
          return;
      }
    }
    
    // If we clicked on the canvas but not a text layer, deselect.
    setSelectedTextId(null);
  }, [textLayers]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (interactionState.mode !== 'dragging') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = window.requestAnimationFrame(() => {
        if (interactionState.target === 'text' && interactionState.id) {
            setTextLayers(prev => prev.map(layer =>
                layer.id === interactionState.id ? { ...layer, x: mouseX - (interactionState.offsetX || 0), y: mouseY - (interactionState.offsetY || 0) } : layer
            ));
        }
    });
  }, [interactionState]);


  const handleMouseUp = useCallback(() => {
    if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
    }
    setInteractionState({ mode: 'idle', target: null });
  }, []);
  

  // Sidebar Resizer Handlers
  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    const newWidth = e.clientX;
    const constrainedWidth = Math.max(280, Math.min(newWidth, 600));
    setSidebarWidth(constrainedWidth);
  }, []);

  const handleResizeMouseUp = useCallback(() => {
    isResizingRef.current = false;
    document.removeEventListener('mousemove', handleResizeMouseMove);
    document.removeEventListener('mouseup', handleResizeMouseUp);
    document.body.style.cursor = 'default';
  }, [handleResizeMouseMove]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.addEventListener('mousemove', handleResizeMouseMove);
    document.addEventListener('mouseup', handleResizeMouseUp);
    document.body.style.cursor = 'col-resize';
  }, [handleResizeMouseMove, handleResizeMouseUp]);

  // Drag and Drop Handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDraggingOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addImages(e.dataTransfer.files);
        e.dataTransfer.clearData();
    }
  }, [addImages]);

  // Export
  const handleExport = async () => {
    if (!viewport.width || !viewport.height || isExporting) return;

    setIsExporting(true);

    try {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = 2000;
        exportCanvas.height = 1500;
        
        drawCanvas(exportCanvas, true);

        exportCanvas.toBlob((blob) => {
            if (blob) {
                const link = document.createElement('a');
                link.download = exportName || 'mockup.png';
                link.href = URL.createObjectURL(blob);
                link.click();
                URL.revokeObjectURL(link.href);
            } else {
                throw new Error("Canvas toBlob returned null");
            }
            setIsExporting(false);
        }, 'image/png');

    } catch (error) {
      console.error("Failed to export canvas:", error);
      alert("An error occurred during export. Please check the console for details.");
      setIsExporting(false);
    }
  };


  const handleDragStart = (id: string) => setDraggedId(id);
  
  const handleDropOnImage = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const draggedIndex = images.findIndex(img => img.id === draggedId);
    const targetIndex = images.findIndex(img => img.id === targetId);
    if (draggedIndex !== -1 && targetIndex !== -1) {
        const newImages = [...images];
        const [draggedItem] = newImages.splice(draggedIndex, 1);
        newImages.splice(targetIndex, 0, draggedItem);
        setImages(newImages);
    }
    setDraggedId(null);
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-gray-800 overflow-hidden">
      {/* Controls Panel */}
      <aside style={{ width: `${sidebarWidth}px` }} className="h-full bg-white p-6 overflow-y-auto flex-shrink-0 flex flex-col space-y-6 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200">
        <div className="flex items-center space-x-3 border-b border-gray-200 pb-4">
            <Icon name="layout-grid" className="w-8 h-8 text-lime-500" />
            <h1 className="text-xl font-bold text-gray-900">LavenderDragonDesign's Grid Mockup Generator v2.0</h1>
        </div>
        {/* Main Upload Button */}
        <div className="pt-4 pb-2 flex flex-col items-center">
          <label htmlFor="imageUpload" className="flex-shrink-0 flex flex-col items-center justify-center w-28 h-28 bg-gray-200 hover:bg-gray-300 rounded-lg cursor-pointer transition-colors text-gray-500 hover:text-gray-800">
            <Icon name="upload-cloud" className="w-10 h-10" />
            <span className="text-sm mt-1">Upload</span>
            <input id="imageUpload" type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
        </div>
        {/* Tools Section */}
        <div className="space-y-2 pt-2 pb-4 border-b border-gray-200">
          <div className="p-4 border border-gray-300 rounded-lg bg-gray-50 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Tools</h2>
            <button
              className="w-full bg-lime-500 hover:bg-lime-600 text-black font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
              onClick={() => setShowBulkResizer(true)}
            >
              <Icon name="resize" className="w-5 h-5" />
              <span>Bulk Image Resize</span>
            </button>
            <button
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
              onClick={() => {
                setImages([]);
                setImageBitmaps(new Map());
              }}
            >
              <Icon name="trash" className="w-5 h-5" />
              <span>Clear Canvas</span>
            </button>
            <button
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
              onClick={() => {
                setBackground({ type: 'color', value: '#F3F4F6' });
                setBackgroundBitmap(null);
                setWatermark(null);
                setWatermarkBitmap(null);
                setTextLayers([]);
                setSelectedTextId(null);
                setGlobalZoom(1);
                setGap(16);
                setLayoutMode('grid');
                setMainZoom(1);
                setBgBlur(10);
                setBgOpacity(0.3);
              }}
            >
              <Icon name="refresh-ccw" className="w-5 h-5" />
              <span>Reset Settings</span>
            </button>
          </div>
        </div>

        {/* Layout Controls */}
        <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-900">Layout</h2>
            <div className="flex flex-col space-y-4">
                <div>
                    <label htmlFor="layout-mode" className="text-sm font-medium text-gray-600 flex items-center space-x-2 mb-2"><Icon name="layout-template" /><span>Mode</span></label>
                    <select id="layout-mode" value={layoutMode} onChange={e => setLayoutMode(e.target.value as LayoutMode)} className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-lime-500 focus:border-lime-500 block w-full p-2.5">
                        <option value="grid">Grid</option>
                        <option value="freeform">Freeform (drag/zoom/rotate)</option>
                        <option value="single-blur">Single Focus</option>
                        <option value="left-big">Left Big</option>
                        <option value="right-big">Right Big</option>
                        <option value="top-big">Top Big</option>
                        <option value="bottom-big">Bottom Big</option>
                    </select>
                    {isBigLayout(layoutMode) && images.length > 0 && (
                      <div className="mt-3">
                        <label className="block text-xs font-semibold uppercase tracking-wide mb-2 text-gray-700">Big image</label>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {images.map(img => (
                            <button
                              key={img.id}
                              type="button"
                              onClick={() => setBigImageId(img.id)}
                              className={'relative flex-shrink-0 w-16 h-16 rounded-md border ' + (bigImageId === img.id ? 'border-lime-500 ring-2 ring-lime-400' : 'border-gray-300')}
                              title={img.name || ('Image ' + img.id)}
                            >
                              <img src={img.url} alt={'bigpick-' + img.id} className="w-full h-full object-cover rounded-md"/>
                              {bigImageId === img.id && (
                                <span className="absolute bottom-1 right-1 text-[10px] bg-lime-500 text-black rounded px-1">BIG</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                </div>
            </div>
            <Slider label="Gap" icon="space" value={gap} onChange={e => setGap(Number(e.target.value))} max={100} unit="px" disabled={layoutMode === 'single-blur'}/>
            <Slider label="Global Zoom" icon="zoom-in" value={globalZoom} onChange={e => setGlobalZoom(Number(e.target.value))} min={0.1} max={5} step={0.05} unit="x" disabled={layoutMode === 'single-blur'} />
        </div>

        {layoutMode === 'single-blur' && (
            <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h2 className="text-lg font-semibold text-gray-900">Single Focus Options</h2>
                <Slider label="Main Zoom" icon="star" value={mainZoom} onChange={e => setMainZoom(Number(e.target.value))} min={0.1} max={3} step={0.05} unit="x" />
                <Slider label="BG Blur" icon="git-fork" value={bgBlur} onChange={e => setBgBlur(Number(e.target.value))} max={50} unit="px" />
                <Slider label="BG Opacity" icon="blinds" value={bgOpacity} onChange={e => setBgOpacity(Number(e.target.value))} max={1} step={0.01} />
            </div>
        )}

        {/* Background Controls */}
        <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-900">Background</h2>
            <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2"><input type="radio" name="bg-type" checked={background.type === 'color'} onChange={() => { setBackground({type: 'color', value: '#F3F4F6'}); setBackgroundBitmap(null); }} className="form-radio text-lime-500 bg-gray-300"/><span>Color</span></label>
                <label className="flex items-center space-x-2"><input type="radio" name="bg-type" checked={background.type === 'image'} onChange={() => setBackground({type: 'image', value: null})} className="form-radio text-lime-500 bg-gray-300"/><span>Image</span></label>
            </div>
            {background.type === 'color' ? (
                <input type="color" value={typeof background.value === 'string' ? background.value : '#F3F4F6'} onChange={e => setBackground({type: 'color', value: e.target.value})} className="p-1 h-10 w-full block bg-white border border-gray-300 cursor-pointer rounded-lg" />
            ) : (
                <input type="file" accept="image/*" onChange={handleBackgroundUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-lime-200 file:text-lime-900 hover:file:bg-lime-300" />
            )}
        </div>

        {/* Watermark Controls */}
        <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Watermark / Logo</h2>
                {watermark && <button onClick={() => { setWatermark(null); setWatermarkBitmap(null); }}><Icon name="x-circle" className="text-red-500"/></button>}
            </div>
            {!watermark ? (
                <input type="file" accept="image/*" onChange={handleWatermarkUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-lime-200 file:text-lime-900 hover:file:bg-lime-300" />
            ) : (
                <div className="space-y-4">
                    <Slider label="Opacity" icon="blinds" value={watermark.opacity} onChange={e => setWatermark(w => w ? {...w, opacity: Number(e.target.value)} : null)} max={1} step={0.01} />
                    <Slider label="Size" icon="ruler" value={watermark.size} onChange={e => setWatermark(w => w ? {...w, size: Number(e.target.value)} : null)} min={1} max={100} unit="%" />
                    <select value={watermark.position} onChange={e => setWatermark(w => w ? {...w, position: e.target.value as WatermarkPosition} : null)} className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-lime-500 focus:border-lime-500 block w-full p-2.5">
                        <option value="top-left">Top Left</option>
                        <option value="top-right">Top Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-right">Bottom Right</option>
                        <option value="center">Center</option>
                    </select>
                </div>
            )}
        </div>
        
        {/* Text Controls */}
        <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">

Text Layers</h2>
                <button onClick={addTextLayer} className="bg-lime-500 hover:bg-lime-600 text-black font-bold py-1 px-2 rounded-lg flex items-center space-x-1 text-sm"><Icon name="plus" className="w-4 h-4"/><span>Add</span></button>
            </div>
            <div className="space-y-2 max-h-20 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200">
              {textLayers.map(layer => (
                <div key={layer.id} onClick={() => setSelectedTextId(layer.id)} className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${selectedTextId === layer.id ? 'bg-lime-500 text-black' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}>
                  <span className="truncate w-full">{layer.text || '[Empty]'}</span>
                  <button onClick={e => {e.stopPropagation(); deleteTextLayer(layer.id);}} className="text-gray-500 hover:text-red-500 pl-2"><Icon name="trash-2" className="w-4 h-4"/></button>
                </div>
              ))}
            </div>
            <input type="text" value={selectedLayer?.text || ''} onChange={e => updateSelectedLayer({text: e.target.value})} placeholder="Select a layer to edit" disabled={!selectedLayer} className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-lime-500 focus:border-lime-500 block w-full p-2.5 disabled:cursor-not-allowed disabled:bg-gray-200" />
            <div className="flex items-center space-x-2">
                <select value={selectedLayer?.fontFamily || 'Montserrat'} onChange={e => updateSelectedLayer({fontFamily: e.target.value})} disabled={!selectedLayer} className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-lime-500 focus:border-lime-500 block w-full p-2.5 disabled:cursor-not-allowed disabled:bg-gray-200">
                    {FONT_FACES.map(font => <option key={font} value={font}>{font}</option>)}
                </select>
                <input type="color" value={selectedLayer?.color || '#FFFFFF'} onChange={e => updateSelectedLayer({color: e.target.value})} disabled={!selectedLayer} className="p-1 h-10 w-12 block bg-white border border-gray-300 rounded-lg disabled:cursor-not-allowed" />
            </div>
            <Slider label="Font Size" icon="case-sensitive" value={selectedLayer?.fontSize || 0} onChange={e => updateSelectedLayer({fontSize: Number(e.target.value)})} min={8} max={256} unit="px" disabled={!selectedLayer} />
            <Slider label="Rotation" icon="rotate-cw" value={selectedLayer?.rotation || 0} onChange={e => updateSelectedLayer({rotation: Number(e.target.value)})} min={-180} max={180} unit="°" disabled={!selectedLayer} />
            <Toggle label="Text Shadow" icon="star" checked={selectedLayer?.shadow || false} onChange={e => updateSelectedLayer({shadow: e.target.checked})} disabled={!selectedLayer} />
            <h3 className={`text-md font-semibold ${!selectedLayer ? 'text-gray-400' : 'text-gray-700'}`}>Text Background</h3>
            <div className="flex items-center space-x-2">
              <span className={`text-sm ${!selectedLayer ? 'text-gray-400' : 'text-gray-600'}`}>Color</span>
              <input type="color" value={selectedLayer?.backgroundColor || '#000000'} onChange={e => updateSelectedLayer({backgroundColor: e.target.value})} disabled={!selectedLayer} className="p-1 h-10 w-12 block bg-white border border-gray-300 rounded-lg disabled:cursor-not-allowed" />
            </div>
            <Slider label="BG Opacity" icon="blinds" value={selectedLayer?.backgroundOpacity || 0} onChange={e => updateSelectedLayer({backgroundOpacity: Number(e.target.value)})} max={1} step={0.01} disabled={!selectedLayer} />
            <Slider label="BG Padding" icon="move" value={selectedLayer?.padding || 0} onChange={e => updateSelectedLayer({padding: Number(e.target.value)})} max={100} unit="px" disabled={!selectedLayer} />
        </div>

        {/* Export Controls */}
        <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
             <h2 className="text-lg font-semibold text-gray-900">Export</h2>
             <input type="text" value={exportName} onChange={e => setExportName(e.target.value)} placeholder="filename.png" className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-lime-500 focus:border-lime-500 block w-full p-2.5" />
             <button onClick={handleExport} disabled={isExporting} className="w-full bg-lime-500 hover:bg-lime-600 text-black font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors disabled:bg-gray-400 disabled:cursor-wait">
                {isExporting ? <Icon name="loader-2" className="animate-spin" /> : <Icon name="download" />}
                <span>{isExporting ? 'Exporting...' : 'Export as PNG (2000x1500)'}</span>
             </button>
        </div>

        {/* Buy Me A Coffee Footer */}
        <div className="mt-auto pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-500 mb-2">Dev. By A. Kessler - Made With ❤️</p>
            <a href="https://buymeacoffee.com/lavenderdragondesigns" target="_blank" rel="noopener noreferrer">
                <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" className="h-12 w-auto inline-block hover:scale-105 transition-transform" />
            </a>
        </div>
      </aside>
      
      {/* Resizer Handle */}
      <div 
        onMouseDown={handleResizeMouseDown}
        className="w-1.5 h-full cursor-col-resize bg-gray-200 hover:bg-lime-500 active:bg-lime-500 transition-colors duration-200 flex-shrink-0"
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 bg-gray-100 min-w-0"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={`flex-1 bg-white rounded-lg border-2 border-dashed relative overflow-hidden transition-all duration-300 ${isDraggingOver ? 'border-lime-500 border-solid ring-4 ring-lime-500/30' : 'border-gray-300'}`}>
          
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
          {layoutMode === 'freeform' && (
            <FreeformCanvas images={images} forceTidyTick={freeformTidyTick} />
          )}
    
          {isDraggingOver && (
            <div className="absolute inset-0 bg-gray-900/50 flex flex-col items-center justify-center text-white pointer-events-none z-10">
              <Icon name="upload-cloud" className="w-24 h-24" />
              <p className="text-2xl font-bold mt-4">Drop Images to Upload</p>
            </div>
          )}
        </div>
        <div className="h-20 flex-shrink-0 pt-4">
            <div className="bg-white rounded-lg h-full p-3 overflow-x-auto overflow-y-hidden flex items-center space-x-4 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200">
              <div className="text-sm text-yellow-400 bg-black border border-yellow-500 p-2 mb-2 rounded">
                ⚠️ Uploading images larger than 3000x3000 may slow down performance.
              </div>
              {images.map((img) => (
                <div
                  key={img.id}
                  className={`relative group flex-shrink-0 w-28 h-28 rounded-lg overflow-hidden border-2 transition-all duration-200 ${draggedId === img.id === bigImageId ? 'border-lime-500 scale-105 ring-2 ring-lime-400' : 'border-transparent'}`}
                  draggable
                  onDragStart={() => handleDragStart(img.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropOnImage(img.id)}
                >
                  
                  {isBigLayout(layoutMode) && (
                    <div className="absolute top-1 left-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setBigImageId(img.id);}}
                        className={`px-2 py-1 text-xs rounded-full border transition
                          ${bigImageId === img.id ? 'bg-lime-500 text-black border-lime-600' : 'bg-black/70 text-white border-white/30 hover:bg-black'}`}>
                        {bigImageId === img.id ? 'BIG ✓' : 'Make BIG'}
                      </button>
                    </div>
                  )}
<img src={img.url} alt={`upload-${img.id}`} className="w-full h-full object-cover"/>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button onClick={(e) => {
                      e.stopPropagation();
                      setImages(prev => prev.filter(i => i.id !== img.id));
                      setImageBitmaps(prev => {
                        const newMap = new Map(prev);
                        newMap.delete(img.id);
                        return newMap;
                      });
                    }} className="text-white p-2 rounded-full bg-red-600 hover:bg-red-700">
                      <Icon name="trash-2" className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
        </div>
      </main>
      {/* BulkImageResizer Modal */}
      {showBulkResizer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="relative bg-white rounded-lg shadow-lg p-0" style={{ maxWidth: 520, width: '100%' }}>
            <button
              className="absolute top-2 right-2 bg-gray-200 hover:bg-gray-300 rounded-full p-2 text-gray-600"
              onClick={() => setShowBulkResizer(false)}
              aria-label="Close"
            >
              <Icon name="x" className="w-5 h-5" />
            </button>
            <BulkImageResizer />
          </div>
        </div>
      )}
    </div>
  );
}

// Add a type declaration for the Lucide global object
declare global {
    interface Window {
      lucide: {
        createIcons: () => void;
      };
    }
}
// NOTE: When removing images, remember to call imageBitmap.close() to free memory.
  const isBigLayout = (mode: LayoutMode) =>
    mode === 'left-big' || mode === 'right-big' || mode === 'top-big' || mode === 'bottom-big';

