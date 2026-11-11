/**
 * Cutscene Editor Context Shared by All Panels (`editorContext.ts`)
 */

import type { SessionData } from './editorSession';
import type { EditorSession } from './editorSession';
import type { UiContext } from './editorDom';
import type { SaveData } from '../types/schemas';

export interface EditorSelection {
  /** -1 = opening setup (starting positions, props, camera) */
  beatIndex: number;
  actionIndex: number | null;
  castId: string | null;
}

export interface UpdateOptions {
  /** Merge rapid edits (typing) into one undo step */
  coalesce?: string;
  /** Keep the inspector DOM (so a focused text box isn't rebuilt mid-typing) */
  keepInspector?: boolean;
}

export interface EditorContext {
  ui: UiContext;
  session: EditorSession;
  sel: EditorSelection;
  canSave: boolean;
  previewSave: SaveData;
  update: (mutator: (data: SessionData) => void | boolean, opts?: UpdateOptions) => void;
  select: (next: Partial<EditorSelection>) => void;
  nameOf: (castId: string) => string;
  visualKeyOf: (castId: string) => string | null;
  toast: (msg: string) => void;
  openLocationPainter: (locationId: string, layerIndex: number) => void;
  previewFrom: (beatIndex: number) => void;
  rerender: () => void;
}
