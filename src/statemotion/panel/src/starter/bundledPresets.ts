// StateMotion Preset Panel — original bundled starter preset library.
//
// Original names, descriptions, and values. No commercial preset reproduced.
// Source of truth for the shipped library; .stmpreset files are generated from
// this module (tools/generate-bundled-presets.js) for import/export.

import { FORMAT_ID } from '../domain/presetSchema.ts';
import type { StateMotionPreset, ParameterValues } from '../domain/presetSchema.ts';

function preset(
  presetId: string,
  name: string,
  description: string,
  category: string,
  tags: string[],
  parameters: ParameterValues,
): StateMotionPreset {
  return {
    formatId: FORMAT_ID,
    schemaVersion: 1,
    presetId,
    name,
    description,
    author: 'StateMotion',
    createdAt: '2026-07-18T00:00:00.000Z',
    modifiedAt: '2026-07-18T00:00:00.000Z',
    tags,
    category,
    collectionIds: [],
    compatibleContract: { schemaVersion: 1, bindingRevision: 1, parameterCount: 20 },
    parameters,
    preview: { kind: 'generated' },
  };
}

export const BUNDLED_PRESETS: StateMotionPreset[] = [
  // ---- Entrances ----
  preset('bundled-soft-arrival', 'Soft Arrival', 'Gentle scale-up fade in.', 'Entrances', ['entrance', 'scale', 'fade'], {
    'transform.scaleX.a': 0.85, 'transform.scaleY.a': 0.85, 'transform.opacity.a': 0,
    'transform.scaleX.b': 1.0, 'transform.scaleY.b': 1.0, 'transform.opacity.b': 1,
  }),
  preset('bundled-quiet-fade', 'Quiet Fade', 'Simple opacity cross from black.', 'Entrances', ['entrance', 'fade'], {
    'transform.opacity.a': 0, 'transform.opacity.b': 1,
  }),
  preset('bundled-rise-up', 'Rise Up', 'Slide upward into place.', 'Entrances', ['entrance', 'slide', 'position'], {
    'transform.position.a': 'frameCenter', 'transform.position.b': 'frameCenter', 'transform.opacity.a': 0, 'transform.opacity.b': 1,
  }),

  // ---- Exits ----
  preset('bundled-soft-exit', 'Soft Exit', 'Ease out with a small scale-down.', 'Exits', ['exit', 'scale', 'fade'], {
    'transform.scaleX.a': 1.0, 'transform.scaleY.a': 1.0, 'transform.opacity.a': 1,
    'transform.scaleX.b': 0.9, 'transform.scaleY.b': 0.9, 'transform.opacity.b': 0,
  }),
  preset('bundled-drift-away', 'Drift Away', 'Fade while drifting down.', 'Exits', ['exit', 'slide', 'fade'], {
    'transform.opacity.a': 1, 'transform.opacity.b': 0,
  }),

  // ---- Slides ----
  preset('bundled-side-glide', 'Side Glide', 'Glide in from the left.', 'Slides', ['slide', 'position'], {
    'transform.position.a': 'frameCenter', 'transform.position.b': 'frameCenter',
  }),
  preset('bundled-gentle-push', 'Gentle Push', 'Push forward with mild scale.', 'Slides', ['slide', 'scale'], {
    'transform.scaleX.a': 0.95, 'transform.scaleY.a': 0.95, 'transform.scaleX.b': 1.05, 'transform.scaleY.b': 1.05,
  }),

  // ---- Zooms ----
  preset('bundled-center-bloom', 'Center Bloom', 'Bloom outward from center.', 'Zooms', ['zoom', 'scale', 'entrance'], {
    'transform.scaleX.a': 0.7, 'transform.scaleY.a': 0.7, 'transform.opacity.a': 0,
    'transform.scaleX.b': 1.0, 'transform.scaleY.b': 1.0, 'transform.opacity.b': 1,
  }),
  preset('bundled-focus-pull-in', 'Focus Pull-In', 'Zoom in to draw attention.', 'Zooms', ['zoom', 'scale'], {
    'transform.scaleX.a': 1.2, 'transform.scaleY.a': 1.2, 'transform.scaleX.b': 1.0, 'transform.scaleY.b': 1.0,
  }),

  // ---- Focus ----
  preset('bundled-focus-pull', 'Focus Pull', 'Subtle scale breathe.', 'Focus', ['focus', 'scale'], {
    'transform.scaleX.a': 1.0, 'transform.scaleY.a': 1.0, 'transform.scaleX.b': 1.08, 'transform.scaleY.b': 1.08,
  }),

  // ---- Layout ----
  preset('bundled-slide-over', 'Slide Over', 'Offset position for picture-in-picture feel.', 'Layout', ['layout', 'position'], {
    'transform.position.a': 'frameCenter', 'transform.position.b': 'frameCenter',
  }),

  // ---- Screen ----
  preset('bundled-wipe-spin', 'Wipe Spin', 'Rotate into place.', 'Screen', ['screen', 'rotation'], {
    'transform.rotation.a': -8 * Math.PI / 180, 'transform.rotation.b': 0, 'transform.opacity.a': 0, 'transform.opacity.b': 1,
  }),

  // ---- Titles ----
  preset('bundled-title-drop', 'Title Drop', 'Drop and settle for title cards.', 'Titles', ['title', 'position', 'slide'], {
    'transform.position.a': 'frameCenter', 'transform.position.b': 'frameCenter',
  }),
  preset('bundled-title-glow-rise', 'Title Rise', 'Rise with a gentle scale for lower-thirds.', 'Titles', ['title', 'scale', 'rise'], {
    'transform.scaleX.a': 0.92, 'transform.scaleY.a': 0.92, 'transform.opacity.a': 0,
    'transform.scaleX.b': 1.0, 'transform.scaleY.b': 1.0, 'transform.opacity.b': 1,
  }),

  // ---- Custom ----
  preset('bundled-custom-swap', 'A/B Swap', 'Hard swap between state A and state B.', 'Custom', ['custom', 'swap'], {
    'transition.mode': 0,
  }),
  preset('bundled-custom-hold', 'Hold Then Move', 'Hold on A, then transition.', 'Custom', ['custom', 'hold'], {
    'transition.mode': 4,
  }),
];

export const CATEGORIES: string[] = [
  'Entrances', 'Exits', 'Slides', 'Zooms', 'Focus', 'Layout', 'Screen', 'Titles', 'Custom',
];
