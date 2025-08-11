export type LayoutMode =
  | 'grid'
  | 'left-big'
  | 'right-big'
  | 'top-big'
  | 'bottom-big'
  | 'single-blur'
  | 'grid-square'
  | 'justified';

export interface ImageState {
  id: string;
  url: string;
  file: File;
}

export interface TextLayer {
  id:string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  rotation: number;
  shadow: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  padding: number;
}

export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

export interface WatermarkState {
  id: string;
  url: string;
  file: File;
  opacity: number;
  size: number; // percentage of canvas width
  position: WatermarkPosition;
}

export type BackgroundType = 'color' | 'image';

export interface BackgroundState {
    type: BackgroundType;
    value: string | ImageState | null; 
}

// ---- Web Worker Specific Types ----

// Serializable versions of state objects that can be passed to Web Workers.
// The `File` object is removed as it's not clonable.
export type SerializableImageState = Omit<ImageState, 'file'>;
export type SerializableWatermarkState = Omit<WatermarkState, 'file'>;
export interface SerializableBackgroundState {
    type: BackgroundType;
    value: string | SerializableImageState | null;
}

// Payload for bitmap data transferred to workers
export interface WorkerBitmapsPayload {
  grid: ImageBitmap[];
  watermark: ImageBitmap | null;
  background: ImageBitmap | null;
}

// Payload for state data sent to the UI worker
export interface WorkerStatePayload {
    layoutMode: LayoutMode;
    images: SerializableImageState[];
    watermark: SerializableWatermarkState | null;
    background: SerializableBackgroundState;
    gap: number;
    globalZoom: number;
    mainZoom: number;
    bgBlur: number;
    bgOpacity: number;
}

// Message from main thread to UI worker
export interface UIWorkerMessageData {
    type: 'init' | 'draw';
    canvas?: OffscreenCanvas;
    viewport?: { width: number; height: number };
    state?: WorkerStatePayload;
    bitmaps?: WorkerBitmapsPayload;
}

// Message from main thread to Export worker
export interface WorkerMessageData {
    canvas: OffscreenCanvas;
    sourceDimensions: { width: number; height: number };
    state: {
        layoutMode: LayoutMode;
        images: SerializableImageState[];
        textLayers: TextLayer[];
        watermark: SerializableWatermarkState | null;
        background: SerializableBackgroundState;
        gap: number;
        globalZoom: number;
        mainZoom: number;
        bgBlur: number;
        bgOpacity: number;
    };
    bitmaps: WorkerBitmapsPayload;
}