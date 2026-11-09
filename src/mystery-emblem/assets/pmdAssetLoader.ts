/**
 * PMD Asset Loader Barrel (`pmdAssetLoader.ts`)
 */

import { clearPortraitAndItemCache } from './portraitAndItemLoader';
import { clearSpriteBundleCache } from './spriteBundleLoader';

export * from './pmdAssetTypes';
export * from './subformResolver';
export * from './portraitAndItemLoader';
export * from './spriteBundleLoader';

export function clearPmdAssetCache(): void {
  clearSpriteBundleCache();
  clearPortraitAndItemCache();
}
