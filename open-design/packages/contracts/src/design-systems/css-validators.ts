/**
 * Shared CSS value validators for design system token classification.
 * Single source of truth — import from here instead of duplicating regexes.
 */

/** Check if a CSS value looks like a color */
export function isColorValue(value: string): boolean {
  return /^(#(?:[0-9a-f]{3,8})|rgb[a]?\(|hsl[a]?\(|oklch\(|color-mix\(|var\()/i.test(value.trim());
}

/** Check if a CSS value looks like a length/dimension */
export function isLengthLike(value: string): boolean {
  return /^(?:\d+(?:\.\d+)?(?:px|rem|em|ch|vw|vh|%)|clamp\(|calc\(|var\()/i.test(value.trim());
}

/** Check if a CSS value looks like a font declaration */
export function isFontValue(value: string): boolean {
  return /\b(?:font-family|font-size|font-weight|font-style|line-height|letter-spacing)\s*:/i.test(value.trim());
}

/** Check if a CSS value looks like a duration */
export function isDurationValue(value: string): boolean {
  return /^\d+(?:\.\d+)?m?s\b|^var\(/i.test(value.trim());
}

/** Check if a CSS value looks like an easing function */
export function isEasingValue(value: string): boolean {
  return /^(?:ease(?:-in(?:-out)?|-out)?|linear|cubic-bezier|steps|var\()/i.test(value.trim());
}

/** Check if a CSS value looks like a box shadow */
export function isShadowValue(value: string): boolean {
  return /^(?:none|inset\s+|(?:(?:-?\d+(?:\.\d+)?)(?:px|rem|em)\s+){2,4})/i.test(value.trim()) || /(?:drop-shadow|box-shadow)\s*\(/i.test(value.trim());
}
