/**
 * Keybinding scheme helpers.
 *
 * Two schemes:
 *   - 'arrows' (default): Arrow keys for navigation, all letter keys available for commands.
 *   - 'vim': hjkl for navigation. Letters h/j/k/l are consumed by navigation,
 *     so commands bound to 'l' (toggle legend) move to '?' in vim mode.
 *
 * Each direction check tests the arrow key first, then (if vim) the hjkl key.
 * This means arrow keys always work, even in vim mode.
 */

export function isUp(e, scheme) {
  if (e.key === 'ArrowUp') return true;
  if (scheme === 'vim' && e.key === 'k') return true;
  return false;
}

export function isDown(e, scheme) {
  if (e.key === 'ArrowDown') return true;
  if (scheme === 'vim' && e.key === 'j') return true;
  return false;
}

export function isLeft(e, scheme) {
  if (e.key === 'ArrowLeft') return true;
  if (scheme === 'vim' && e.key === 'h') return true;
  return false;
}

export function isRight(e, scheme) {
  if (e.key === 'ArrowRight') return true;
  if (scheme === 'vim' && e.key === 'l') return true;
  return false;
}

/** Check if key is a vim nav key (to prevent it from falling through to commands) */
export function isVimNavKey(e, scheme) {
  if (scheme !== 'vim') return false;
  return ['h', 'j', 'k', 'l', 'H', 'J', 'K', 'L'].includes(e.key);
}

/**
 * In vim mode, the 'l' key is consumed for navigation (right), so
 * "toggle legend" moves to '?'.
 */
export function isToggleLegend(e, scheme) {
  if (scheme === 'vim') return e.key === '?';
  return e.key === 'l';
}

/**
 * Display labels for the legend, per scheme.
 */
export function getNavLabels(scheme) {
  if (scheme === 'vim') {
    return {
      up: 'k',
      down: 'j',
      left: 'h',
      right: 'l',
      upSymbol: 'k',
      downSymbol: 'j',
      leftSymbol: 'h',
      rightSymbol: 'l',
      toggleLegend: '?',
      schemeName: 'Vim (hjkl)',
    };
  }
  return {
    up: '\u2191',
    down: '\u2193',
    left: '\u2190',
    right: '\u2192',
    upSymbol: '\u25B2',
    downSymbol: '\u25BC',
    leftSymbol: '\u25C4',
    rightSymbol: '\u25BA',
    toggleLegend: 'l',
    schemeName: 'Arrow Keys',
  };
}
