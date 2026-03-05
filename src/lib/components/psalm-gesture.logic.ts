interface RectLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

interface DoubleTapParams {
  x: number;
  y: number;
  containerRect: RectLike;
  staffRect: RectLike | null;
  hasPreviousSong: boolean;
  hasNextSong: boolean;
  transposeSemitones: number;
  minTranspose: number;
  maxTranspose: number;
  leftZone: number;
  rightZone: number;
  topZone: number;
  bottomZone: number;
}

export type DoubleTapAction =
  | { type: 'previous-song' }
  | { type: 'next-song' }
  | { type: 'transpose'; value: number }
  | { type: 'none' };

export function isDoubleTap(
  timeSinceLastTap: number,
  distanceFromLastTap: number,
  delayMs: number,
  radiusPx: number
): boolean {
  return timeSinceLastTap < delayMs && distanceFromLastTap < radiusPx;
}

export function resolveDoubleTapAction(params: DoubleTapParams): DoubleTapAction {
  const {
    x,
    y,
    containerRect,
    staffRect,
    hasPreviousSong,
    hasNextSong,
    transposeSemitones,
    minTranspose,
    maxTranspose,
    leftZone,
    rightZone,
    topZone,
    bottomZone,
  } = params;

  const relativeX = (x - containerRect.left) / containerRect.width;

  if (relativeX < leftZone) {
    return hasPreviousSong ? { type: 'previous-song' } : { type: 'none' };
  }

  if (relativeX > rightZone) {
    return hasNextSong ? { type: 'next-song' } : { type: 'none' };
  }

  if (!staffRect) return { type: 'none' };

  const isWithinStaff = x >= staffRect.left && x <= staffRect.right && y >= staffRect.top && y <= staffRect.bottom;
  if (!isWithinStaff) return { type: 'none' };

  const relativeYInStaff = (y - staffRect.top) / staffRect.height;

  if (relativeYInStaff < topZone) {
    return { type: 'transpose', value: Math.min(transposeSemitones + 1, maxTranspose) };
  }

  if (relativeYInStaff > bottomZone) {
    return { type: 'transpose', value: Math.max(transposeSemitones - 1, minTranspose) };
  }

  if (transposeSemitones !== 0) {
    return { type: 'transpose', value: 0 };
  }

  return { type: 'none' };
}

export function shouldCancelLongPress(deltaX: number, deltaY: number, moveTolerance: number): boolean {
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  return distance > moveTolerance;
}

export function resolveSwipeAction(
  deltaX: number,
  deltaY: number,
  deltaTime: number,
  minSwipeDistance: number,
  maxSwipeTime: number
): 'next-verse' | 'previous-verse' | null {
  if (deltaTime >= maxSwipeTime) return null;
  if (Math.abs(deltaX) <= minSwipeDistance) return null;
  if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.5) return null;
  return deltaX < 0 ? 'next-verse' : 'previous-verse';
}

export function getSwipePreviewText(
  deltaX: number,
  deltaY: number,
  allVerseNumbers: number[],
  activeVerseNumber: number
): string | null {
  if (Math.abs(deltaX) <= 50 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.5) {
    return null;
  }

  const currentIndex = allVerseNumbers.indexOf(activeVerseNumber);
  if (currentIndex === -1) return null;

  if (deltaX < 0 && currentIndex < allVerseNumbers.length - 1) {
    return `→ Vers ${allVerseNumbers[currentIndex + 1]}`;
  }

  if (deltaX > 0 && currentIndex > 0) {
    return `← Vers ${allVerseNumbers[currentIndex - 1]}`;
  }

  return null;
}

export function isTapGesture(distance: number, deltaTime: number): boolean {
  return distance < 20 && deltaTime < 300;
}
