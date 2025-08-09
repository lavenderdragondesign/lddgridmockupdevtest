// components/FreeformCanvas.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { ImageState } from '../types';

/**
 * Freeform canvas with:
 * - Per-image drag
 * - Wheel zoom (over selected)
 * - Hold R to rotate
 * - Grid overlay + snap to grid
 * - Cell grid (rows/cols) overlay, auto-arrange into cells
 * - Smart auto-align snap to canvas and other items (centers/edges)
 * - Keyboard: arrows to nudge (Shift = 10px), Alt to temporarily disable snapping
 */
type Item = {
  id: string;
  img: HTMLImageElement;
  x: number;
  y: number;
  scale: number;
  rotation: number; // radians
};

type Props = {
  images: ImageState[];
  forceTidyTick?: number;
};

export default function FreeformCanvas({ images }: Props) {
  // --- Neat thumbnails options ---
  const [neatMode, setNeatMode] = useState(true);     // when true, keep things tidy by default
  const [thumbWidth, setThumbWidth] = useState(160);  // target thumb width in px
  const [thumbGap, setThumbGap] = useState(12);
  const [maxCols, setMaxCols] = useState(5);
  const [autoTidy, setAutoTidy] = useState(true);     // re-run tidy on new images

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [size, setSize] = useState<{w:number; h:number}>({ w: 800, h: 800 });

  // UI toggles
  const [showGrid, setShowGrid] = useState(true);              // pixel grid
  const [gridSize, setGridSize] = useState(40);
  const [snapGrid, setSnapGrid] = useState(true);

  const [showCells, setShowCells] = useState(true);            // rows/cols cells
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(3);
  const [cellGapX, setCellGapX] = useState(16);
  const [cellGapY, setCellGapY] = useState(16);
  const [snapSmart, setSnapSmart] = useState(true);            // align to centers/edges
// drag/rotate state via refs (stable listeners)
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef<{dx:number; dy:number} | null>(null);
  const rotatingRef = useRef(false);
  const activeIdRef = useRef<string | null>(null);
  const itemsRef = useRef<Item[]>([]);
  const lastGuidesRef = useRef<{vx:number[]; vy:number[]}>({ vx: [], vy: [] });

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // measure parent size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => {
      const rect = parent.getBoundingClientRect();
      setSize({ w: Math.max(100, rect.width), h: Math.max(100, rect.height) });
    });
    ro.observe(parent);
    const rect = parent.getBoundingClientRect();
    setSize({ w: Math.max(100, rect.width), h: Math.max(100, rect.height) });
    return () => ro.disconnect();
  }, []);

  // preload images & initialize layout if new
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = new Map(itemsRef.current.map(i => [i.id, i]));
      const next: Item[] = [];
      let idx = 0;
      for (const im of images) {
        const prev = existing.get(im.id);
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.src = im.url;
        await new Promise<void>((res) => {
          if (el.complete) return res();
          el.onload = () => res();
          el.onerror = () => res();
        });
        if (cancelled) return;
        if (prev) {
          next.push({ ...prev, img: el });
        } else {
          const angle = (idx / Math.max(1, images.length)) * Math.PI * 2;
          const radius = 60 + (idx % 5) * 25;
          next.push({
            id: im.id,
            img: el,
            x: size.w / 2 + Math.cos(angle) * radius,
            y: size.h / 2 + Math.sin(angle) * radius,
            scale: 0.4,
            rotation: 0
          });
        }
        idx++;
      }
      if (!cancelled) setItems(next);
    })();
    return () => { cancelled = true; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.map(i => i.id + ':' + i.url).join('|')]);

  const dpr = Math.max(1, (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = size;
    const pw = Math.floor(w * dpr);
    const ph = Math.floor(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // pixel grid
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.07)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
      }
      for (let y = 0; y <= h; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
      }
      ctx.restore();
    }

    // cell grid
    if (showCells && rows > 0 && cols > 0) {
      const cellW = (w - (cols + 1) * cellGapX) / cols;
      const cellH = (h - (rows + 1) * cellGapY) / rows;
      ctx.save();
      ctx.strokeStyle = 'rgba(34,197,94,0.35)'; // lime-ish
      ctx.lineWidth = 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = cellGapX + c * (cellW + cellGapX);
          const y = cellGapY + r * (cellH + cellGapY);
          ctx.strokeRect(x + 0.5, y + 0.5, cellW, cellH);
        }
      }
      ctx.restore();
    }

    // draw guides (from last snap)
    const gx = lastGuidesRef.current.vx;
    const gy = lastGuidesRef.current.vy;
    if (gx.length || gy.length) {
      ctx.save();
      ctx.strokeStyle = 'rgba(59,130,246,0.6)'; // blue
      ctx.lineWidth = 1.5;
      gx.forEach(x => { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke(); });
      gy.forEach(y => { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke(); });
      ctx.restore();
    }

    // images
    for (const it of itemsRef.current) {
      const iw = it.img.naturalWidth || 1;
      const ih = it.img.naturalHeight || 1;
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rotation);
      ctx.scale(it.scale, it.scale);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(it.img, -iw/2, -ih/2);
      if (it.id === activeIdRef.current) {
        ctx.setLineDash([6/it.scale, 6/it.scale]);
        ctx.lineWidth = 2/it.scale;
        ctx.strokeStyle = '#22c55e';
        ctx.strokeRect(-iw/2, -ih/2, iw, ih);
      }
      ctx.restore();
    }
  }, [size, dpr, showGrid, gridSize, showCells, rows, cols, cellGapX, cellGapY]);

  useEffect(() => { draw(); }, [draw, items, activeId, showGrid, gridSize, showCells, rows, cols, cellGapX, cellGapY]);

  // helpers
  const clientToCanvas = useCallback((e: MouseEvent | WheelEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const cx = (e as MouseEvent).clientX ?? (e as WheelEvent).clientX;
    const cy = (e as MouseEvent).clientY ?? (e as WheelEvent).clientY;
    const x = (cx - rect.left) * (size.w / rect.width);
    const y = (cy - rect.top) * (size.h / rect.height);
    return { x, y };
  }, [size]);

  // Calculate snap candidates and return snapped (nx, ny) + guides

  function setCanvasCursor(canvas: HTMLCanvasElement, hovering: boolean) {
    const rotating = rotatingRef.current;
    const dragging = draggingRef.current;
    if (rotating || dragging) {
      canvas.style.cursor = 'grabbing';
    } else if (hovering) {
      canvas.style.cursor = 'grab';
    } else {
      canvas.style.cursor = 'default';
    }
  }

  const getSnapped = useCallback(
(nx: number, ny: number, ignoreSnap: boolean) => {
    const { w, h } = size;
    const guidesX: number[] = [];
    const guidesY: number[] = [];

    if (ignoreSnap) return { x: nx, y: ny, guidesX, guidesY };

    const thresh = 8; // px
    const candX: number[] = [];
    const candY: number[] = [];

    // Canvas centers/edges
    candX.push(0, w/2, w);
    candY.push(0, h/2, h);

    // Pixel grid
    if (snapGrid) {
      candX.push(Math.round(nx / gridSize) * gridSize);
      candY.push(Math.round(ny / gridSize) * gridSize);
    }

    // Cell centers/edges
    if (showCells && rows > 0 && cols > 0) {
      const cellW = (w - (cols + 1) * cellGapX) / cols;
      const cellH = (h - (rows + 1) * cellGapY) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = cellGapX + c * (cellW + cellGapX);
          const y = cellGapY + r * (cellH + cellGapY);
          const cx = x + cellW / 2;
          const cy = y + cellH / 2;
          candX.push(x, cx, x + cellW);
          candY.push(y, cy, y + cellH);
        }
      }
    }

    // Other items (centers)
    if (snapSmart && itemsRef.current.length > 1) {
      for (const it of itemsRef.current) {
        if (it.id === activeIdRef.current) continue;
        candX.push(it.x);
        candY.push(it.y);
      }
    }

    // Find nearest within threshold
    let sx = nx, sy = ny;
    let bestDX = thresh + 1, bestDY = thresh + 1;
    let gx: number | null = null, gy: number | null = null;

    for (const tx of candX) {
      const dx = Math.abs(tx - nx);
      if (dx < bestDX && dx <= thresh) { bestDX = dx; sx = tx; gx = tx; }
    }
    for (const ty of candY) {
      const dy = Math.abs(ty - ny);
      if (dy < bestDY && dy <= thresh) { bestDY = dy; sy = ty; gy = ty; }
    }

    if (gx !== null) guidesX.push(gx);
    if (gy !== null) guidesY.push(gy);
    return { x: sx, y: sy, guidesX, guidesY };
  }, [size, snapGrid, gridSize, showCells, rows, cols, cellGapX, cellGapY, snapSmart]);

  const hitTest = useCallback((px: number, py: number) => {
    const list = itemsRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const it = list[i];
      const iw = it.img.naturalWidth || 1;
      const ih = it.img.naturalHeight || 1;
      const tx = px - it.x;
      const ty = py - it.y;
      const cos = Math.cos(-it.rotation);
      const sin = Math.sin(-it.rotation);
      const rx = (tx * cos - ty * sin) / it.scale;
      const ry = (tx * sin + ty * cos) / it.scale;
      if (rx >= -iw/2 && rx <= iw/2 && ry >= -ih/2 && ry <= ih/2) {
        return { i, it };
      }
    }
    return null;
  }, []);

  // Arrange items into cell centers
  const autoArrangeToCells = useCallback(() => {
    const { w, h } = size;
    if (!(showCells && rows > 0 && cols > 0)) return;
    const cellW = (w - (cols + 1) * cellGapX) / cols;
    const cellH = (h - (rows + 1) * cellGapY) / rows;
    const centers: {x:number;y:number}[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = cellGapX + c * (cellW + cellGapX) + cellW/2;
        const y = cellGapY + r * (cellH + cellGapY) + cellH/2;
        centers.push({ x, y });
      }
    }
    setItems(prev => prev.map((p, i) => ({
      ...p,
      x: centers[i % centers.length].x,
      y: centers[i % centers.length].y
    })));
  }, [size, showCells, rows, cols, cellGapX, cellGapY]);


  // Arrange items as small, uniform thumbnails in tidy rows/cols
  const tidyArrange = useCallback(() => {
    const { w } = size;
    const cols = Math.max(1, Math.min(maxCols, Math.floor((w - thumbGap) / (thumbWidth + thumbGap))));
    const effectiveCols = Math.max(1, cols);
    setItems(prev => prev.map((p, idx) => {
      const iw = p.img.naturalWidth || 1;
      const scale = (thumbWidth / iw) * 1; // fit width to thumbWidth
      const col = idx % effectiveCols;
      const row = Math.floor(idx / effectiveCols);
      const x = thumbGap + col * (thumbWidth + thumbGap) + thumbWidth / 2;
      const y = thumbGap + row * (thumbWidth + thumbGap) + thumbWidth / 2; // square-ish spacing
      return { ...p, x, y, scale };
    }));
  }, [size, thumbWidth, thumbGap, maxCols]);


  // Auto-tidy when items change (first load or when images added)
  useEffect(() => {
    if (!autoTidy) return;
    if (items.length > 0) tidyArrange();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, size.w, thumbWidth, thumbGap, maxCols, autoTidy]);

  // Native listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setAndRedraw = (next: Item[] | ((p: Item[]) => Item[])) => {
      setItems(prev => {
        const out = typeof next === 'function' ? (next as any)(prev) : next;
        return out;
      });
    };

    const onMouseDown = (e: MouseEvent) => {
      const { x, y } = clientToCanvas(e);
      const hit = hitTest(x, y);
      if (hit) {
        draggingRef.current = true;
        setActiveId(hit.it.id);
        activeIdRef.current = hit.it.id;
        // bring to top
        setAndRedraw(prev => {
          const next = prev.slice();
          const idx = next.findIndex(p => p.id === hit.it.id);
          if (idx >= 0) {
            const [sp] = next.splice(idx, 1);
            next.push(sp);
          }
          return next;
        });
        // store offset from pointer to item center
        const dx = x - hit.it.x;
        const dy = y - hit.it.y;
        dragOffsetRef.current = { dx, dy };
        const canvas = canvasRef.current as HTMLCanvasElement;
        if (canvas) setCanvasCursor(canvas, true);
      } else {
        setActiveId(null);
        activeIdRef.current = null;
        dragOffsetRef.current = null;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current as HTMLCanvasElement;
      const { x, y } = clientToCanvas(e);

      // update hover cursor if not dragging
      if (!draggingRef.current && canvas) {
        const hit = hitTest(x, y);
        setCanvasCursor(canvas, !!hit);
      }

      if (!draggingRef.current || !dragOffsetRef.current || !activeIdRef.current) return;
      const { dx, dy } = dragOffsetRef.current;
      let nx = x - dx;
      let ny = y - dy;

      const altDown = (e as any).altKey;
      if (snapSmart || snapGrid || showCells) {
        const snapped = getSnapped(nx, ny, altDown === true);
        lastGuidesRef.current = { vx: snapped.guidesX, vy: snapped.guidesY };
        nx = snapped.x; ny = snapped.y;
      }

      const id = activeIdRef.current;
      setAndRedraw(prev => prev.map(p => p.id === id ? { ...p, x: nx, y: ny } : p));

      // dragging cursor
      if (canvas) setCanvasCursor(canvas, true);
    };

      const id = activeIdRef.current;
      setAndRedraw(prev => prev.map(p => p.id === id ? { ...p, x: snapped.x, y: snapped.y } : p));
    };

    const onMouseUp = () => {
      draggingRef.current = false;
      dragOffsetRef.current = null;
      rotatingRef.current = false;
      lastGuidesRef.current = { vx: [], vy: [] };
      const canvas = canvasRef.current as HTMLCanvasElement;
      if (canvas) setCanvasCursor(canvas, false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') {
        rotatingRef.current = true;
        (canvas as any).focus?.();
      const canvas = canvasRef.current as HTMLCanvasElement;
      if (canvas) setCanvasCursor(canvas, true);
      }
      // arrow key nudge
      if (activeIdRef.current) {
        const step = e.shiftKey ? 10 : 1;
        let dx = 0, dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;
        if (dx || dy) {
          e.preventDefault();
          const id = activeIdRef.current;
          // snapping after nudge
          const cur = itemsRef.current.find(p => p.id === id);
          if (!cur) return;
          const snapped = getSnapped(cur.x + dx, cur.y + dy, false);
          lastGuidesRef.current = { vx: snapped.guidesX, vy: snapped.guidesY };
          setAndRedraw(prev => prev.map(p => p.id === id ? { ...p, x: snapped.x, y: snapped.y } : p));
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') rotatingRef.current = false;
    };
      const canvas = canvasRef.current as HTMLCanvasElement;
      if (canvas) setCanvasCursor(canvas, false);

    const onMouseMoveRotate = (e: MouseEvent) => {
      if (!rotatingRef.current || !activeIdRef.current) return;
      const { x, y } = clientToCanvas(e);
      const id = activeIdRef.current;
      const it = itemsRef.current.find(i => i.id === id);
      if (!it) return;
      const ang = Math.atan2(y - it.y, x - it.x);
      setAndRedraw(prev => prev.map(p => p.id === id ? { ...p, rotation: ang } : p));
    };

    const onWheel = (e: WheelEvent) => {
      if (!activeIdRef.current) return;
      e.preventDefault();
      const delta = Math.sign(e.deltaY) * -0.08;
      const id = activeIdRef.current;
      setAndRedraw(prev => prev.map(p => p.id === id ? { ...p, scale: Math.min(5, Math.max(0.1, p.scale * (1 + delta))) } : p));
    };

    canvas.tabIndex = 0;
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMoveRotate);
    canvas.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMoveRotate);
      canvas.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('wheel', onWheel as any);
    };
  }, [clientToCanvas, hitTest, getSnapped]);

  useEffect(() => { draw(); }, [items, activeId, size, showGrid, gridSize, showCells, rows, cols, cellGapX, cellGapY, draw]);

  return (
    <>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full outline-none"
        aria-label="Freeform canvas"
        style={{ background: "transparent" }}
      />

      {/* Floating controls */}
      <div className="absolute top-2 left-2 bg-black/70 text-white rounded-lg p-2 space-y-2 shadow-lg max-w-[90%]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Neat thumbnails */}
          <label className="flex items-center gap-1 text-xs ml-2">
            <input type="checkbox" checked={neatMode} onChange={e => setNeatMode(e.target.checked)} />
            Neat
          </label>
          <span className="text-[18px]">Thumb W</span>
          <input className="w-12 text-black text-xs px-1 rounded" type="number" min={40} max={600} value={thumbWidth} onChange={e => setThumbWidth(Number(e.target.value)||160)} />
          <span className="text-[18px]">Gap</span>
          <input className="w-12 text-black text-xs px-1 rounded" type="number" min={0} max={100} value={thumbGap} onChange={e => setThumbGap(Number(e.target.value)||12)} />
          <span className="text-[18px]">Max Cols</span>
          <input className="w-12 text-black text-xs px-1 rounded" type="number" min={1} max={20} value={maxCols} onChange={e => setMaxCols(Number(e.target.value)||5)} />
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={autoTidy} onChange={e => setAutoTidy(e.target.checked)} />
            Auto Tidy
          </label>
          <button className="text-xs px-2 py-1 bg-lime-600 rounded hover:bg-lime-500" onClick={tidyArrange}>
            Tidy Now
          </button>
          {/* Pixel Grid */}
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} />
            Grid
          </label>
          <label className="flex items-center gap-1 text-xs">
            Size
            <input type="range" min={8} max={200} step={2} value={gridSize} onChange={e => setGridSize(Number(e.target.value))} />
            <span className="tabular-nums text-[18px]">{gridSize}px</span>
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={snapGrid} onChange={e => setSnapGrid(e.target.checked)} />
            Snap to Grid
          </label>

          {/* Cell Grid */}
          <label className="flex items-center gap-1 text-xs ml-2">
            <input type="checkbox" checked={showCells} onChange={e => setShowCells(e.target.checked)} />
            Cells
          </label>
          <span className="text-[18px]">Rows</span>
          <input className="w-10 text-black text-xs px-1 rounded" type="number" min={1} max={12} value={rows} onChange={e => setRows(Number(e.target.value)||1)} />
          <span className="text-[18px]">Cols</span>
          <input className="w-10 text-black text-xs px-1 rounded" type="number" min={1} max={12} value={cols} onChange={e => setCols(Number(e.target.value)||1)} />
          <span className="text-[18px]">GapX</span>
          <input className="w-12 text-black text-xs px-1 rounded" type="number" min={0} max={200} value={cellGapX} onChange={e => setCellGapX(Number(e.target.value)||0)} />
          <span className="text-[18px]">GapY</span>
          <input className="w-12 text-black text-xs px-1 rounded" type="number" min={0} max={200} value={cellGapY} onChange={e => setCellGapY(Number(e.target.value)||0)} />

          <button className="text-xs px-2 py-1 bg-lime-600 rounded hover:bg-lime-500"
            onClick={autoArrangeToCells}>
            Auto Arrange
          </button>

          {/* Smart align */}
          <label className="flex items-center gap-1 text-xs ml-2">
            <input type="checkbox" checked={snapSmart} onChange={e => setSnapSmart(e.target.checked)} />
            Auto Align
          </label>

          <button className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600" onClick={() => setShowHelp(h => !h)}>
            {showHelp ? 'Hide' : 'Shortcuts'}
          </button>
        </div>
</div>
    </>
  );
}