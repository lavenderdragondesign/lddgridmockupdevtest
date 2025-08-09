
// speedUtils.ts

export function applyCanvasSettings(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
}

export function revokeObjectURLSafe(url: string) {
  try {
    URL.revokeObjectURL(url);
  } catch (err) {
    console.warn('Failed to revoke object URL:', err);
  }
}

export function clearCanvas(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, width: number, height: number) {
  ctx.clearRect(0, 0, width, height);
}
