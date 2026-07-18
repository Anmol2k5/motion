// StateMotion Preset Panel — deterministic preview cards.
//
// Pure SVG generated from preset transform values. Communicates direction,
// scale, rotation, and opacity. No video decoding; the native renderer remains
// the source of truth for actual pixels.

import type { StateMotionPreset } from '../domain/presetSchema.ts';

function num(p: StateMotionPreset, id: string, fallback: number): number {
  const v = p.parameters[id];
  return typeof v === 'number' ? v : fallback;
}

export function describePresetMotion(p: StateMotionPreset): string {
  const parts: string[] = [];
  const sx = num(p, 'transform.scaleX.b', 100) / 100;
  const sy = num(p, 'transform.scaleY.b', 100) / 100;
  const rot = num(p, 'transform.rotation.b', 0);
  const opA = num(p, 'transform.opacity.a', 100);
  const opB = num(p, 'transform.opacity.b', 100);
  if (sx !== 1 || sy !== 1) parts.push(`scale ${sx.toFixed(2)}x/${sy.toFixed(2)}x`);
  if (rot !== 0) parts.push(`rotate ${rot}°`);
  if (opA !== opB) parts.push(`opacity ${opA}→${opB}`);
  return parts.length ? parts.join(', ') : 'static';
}

export function renderPreviewSvg(p: StateMotionPreset): string {
  const sx = num(p, 'transform.scaleX.b', 100) / 100;
  const sy = num(p, 'transform.scaleY.b', 100) / 100;
  const rot = num(p, 'transform.rotation.b', 0);
  const opB = num(p, 'transform.opacity.b', 100) / 100;
  const accent = '#36C5D6';
  // Two shapes: A (ghost, origin) and B (final transform). Direction arrow from
  // A center to B center when position delta is informational (we show a simple
  // proportional offset). Position presets use frameCenter for both states, so
  // we encode scale/rotation/opacity which are the visible motion cues.
  const W = 120, H = 90, cx = W / 2, cy = H / 2;
  const bw = 34 * sx, bh = 34 * sy;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(p.name)} preview">`,
    `<rect width="${W}" height="${H}" fill="#1b1d21"/>`,
    // ghost A
    `<rect x="${cx - 17}" y="${cy - 17}" width="34" height="34" rx="4" fill="none" stroke="#555" stroke-dasharray="3 3"/>`,
    // final B
    `<g transform="translate(${cx} ${cy}) rotate(${rot})" opacity="${opB.toFixed(2)}">`,
    `<rect x="${-bw / 2}" y="${-bh / 2}" width="${bw}" height="${bh}" rx="4" fill="${accent}"/>`,
    `</g>`,
    `<text x="6" y="${H - 6}" fill="#cfd3d8" font-size="9">${escapeXml(p.name)}</text>`,
    `</svg>`,
  ].join('');
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] as string));
}
