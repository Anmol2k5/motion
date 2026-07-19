// StateMotion — product version (single source of truth for the product release).
//
// Do NOT conflate with the three CONTRACT dimensions, which live in the generated
// bindings and must NOT change when the product version changes:
//   - SCHEMA_VERSION     (preset format version)
//   - BINDING_REVISION   (native/panel parameter binding revision)
//   - PARAMETER_COUNT    (expected native parameter count)
//
// A product release bumps PRODUCT_VERSION independently. Tests assert the three
// contract dimensions are NOT re-derived from the product version.

export const PRODUCT_VERSION = '0.1.0-alpha.1';
export const PRODUCT_NAME = 'StateMotion';
export const PRODUCT_EDITION = 'Alpha';

export interface ProductVersionInfo {
  name: string;
  version: string;
  edition: string;
  isAlpha: boolean;
}

export function getProductVersion(): ProductVersionInfo {
  return {
    name: PRODUCT_NAME,
    version: PRODUCT_VERSION,
    edition: PRODUCT_EDITION,
    isAlpha: PRODUCT_EDITION.toLowerCase() === 'alpha',
  };
}
