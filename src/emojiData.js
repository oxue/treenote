import { gemoji } from 'gemoji';

export const emojis = gemoji
  .filter(g => g.names.length > 0)
  .map(g => ({ emoji: g.emoji, shortcode: g.names[0] }));
