const DEFAULT_WINDOW_SIZE = 60;

export function commandWindowRange(total: number, activeIndex: number, windowSize = DEFAULT_WINDOW_SIZE): { start: number; end: number } {
  const start = Math.max(0, Math.min(Math.max(0, activeIndex - 20), Math.max(0, total - windowSize)));
  return { start, end: Math.min(total, start + windowSize) };
}
