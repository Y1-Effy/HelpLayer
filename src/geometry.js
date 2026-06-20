/**
 * Pure geometry calculations. Takes no DOM elements, only numbers already read off.
 *
 * Clamping things that overflow the viewport is handled by Floating UI's shift()
 * middleware. toDocumentPosition is used for the virtual-element math of free placement, etc.
 */

/**
 * Given getBoundingClientRect() values (viewport-relative) and the scroll offset,
 * compute coordinates relative to the whole document.
 */
export function toDocumentPosition(rect, scroll) {
  return {
    top: rect.top + scroll.y,
    left: rect.left + scroll.x,
  };
}

/**
 * Convert a document-coordinate rect into a viewport-coordinate rect by subtracting
 * the current scroll offset. This is what the getBoundingClientRect of a Floating UI
 * virtual reference element (a free-placement marker) returns.
 * @param {{top:number,left:number,width?:number,height?:number}} docRect
 * @param {{x:number,y:number}} scroll
 */
export function docRectToViewportRect(docRect, scroll) {
  const width = docRect.width || 0;
  const height = docRect.height || 0;
  const left = docRect.left - scroll.x;
  const top = docRect.top - scroll.y;
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}
