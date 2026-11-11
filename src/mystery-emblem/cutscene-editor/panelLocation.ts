/**
 * Cutscene Editor Location Panel: Shared Locations, Background Layers & Props (`panelLocation.ts`)
 */

import { PMD_TILESET_LIST } from '../assets/tilesetLoader';
import type {
  LocationDoc,
  LocationLayer,
  LocationLayerKind,
  PropPlacement,
} from '../data/cutscenes/cutsceneDocTypes';
import { getLocationDoc, listCutscenesUsingLocation, listLocationDocs } from '../data/cutscenes/cutsceneRegistry';
import {
  decodeLocationTileRows,
  encodeLocationTileRows,
  pickDominantTileset,
} from '../data/cutscenes/locationCodec';
import { decodeTileRows } from '../data/chapters/chapterCodec';
import { discardLegacyCutsceneStageOverride, getLegacyCutsceneStageOverrides } from '../data/mapOverrideStore';
import type { EditorContext } from './editorContext';
import { button, checkbox, field, h, numberInput, row, section, selectInput, textInput } from './editorDom';
import { mediaPicker } from './editorPickers';
import { slugifyId, uniqueId, type StorySessionData } from './editorSession';

/** Retired Map Editor stage ids → the locations they became. */
export const LEGACY_STAGE_TO_LOCATION: Readonly<Record<string, string>> = {
  cutscene_stage_01_coastal_meadow: 'coastal_meadow',
  cutscene_stage_02_sanctuary_glade: 'sanctuary_glade',
  cutscene_stage_03_bluff_camp: 'bluff_camp',
  cutscene_stage_04_watchtower_parapet: 'watchtower_parapet',
  cutscene_stage_05_shrine_courtyard: 'shrine_courtyard',
  cutscene_stage_06_orchard_twilight: 'orchard_twilight',
};

const LAYER_LABELS: Record<LocationLayerKind, string> = {
  tiles: 'Tile map',
  picture: 'Picture backdrop',
  texture: 'Repeating texture',
  parallax: 'Parallax layer',
};

export function blankLocation(id: string, name: string, width = 16, height = 11): LocationDoc {
  const rows = Array.from({ length: height }, () => Array.from({ length: width }, () => 'F:28').join(' '));
  return { id, name, width, height, layers: [{ id: 'tiles', kind: 'tiles', tileset: '042', rows }] };
}

function resizeLocation(loc: LocationDoc, width: number, height: number): void {
  for (const layer of loc.layers) {
    if (layer.kind !== 'tiles') continue;
    const grid = decodeLocationTileRows(layer.rows, layer.tileset, loc.width, loc.height);
    const next = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => grid[y]?.[x] ?? null));
    layer.rows = encodeLocationTileRows(next, layer.tileset);
  }
  loc.width = width;
  loc.height = height;
}

function legacyImportBanner(ctx: EditorContext, loc: LocationDoc): HTMLElement | null {
  const entries = getLegacyCutsceneStageOverrides();
  const legacyId = Object.keys(entries).find((k) => LEGACY_STAGE_TO_LOCATION[k] === loc.id);
  if (!legacyId) return null;
  const entry = entries[legacyId]!;
  const map = entry.map as unknown as { width: number; height: number; tiles?: unknown; rows?: string[]; defaultTilesetId?: string };
  return h('div', { class: 'cse-callout' },
    h('p', { text: 'Your browser has Map Editor edits for this stage that were never saved to the project. Use them for this location?' }),
    row(
      button(ctx.ui, 'Use my Map Editor version', () => {
        const tiles = Array.isArray(map.tiles)
          ? (map.tiles as Array<Array<{ terrainType: string; tilesetId: string; chunkIndex: number }>>)
          : decodeTileRows(map.rows ?? [], map.defaultTilesetId ?? '042');
        const grid = tiles.map((r) => r.map((c) => ({ terrainType: c.terrainType as 'floor', tilesetId: c.tilesetId, chunkIndex: c.chunkIndex })));
        const tileset = pickDominantTileset(grid);
        ctx.update((d) => {
          const s = d as StorySessionData;
          const target = s.locations[loc.id]!;
          target.width = map.width;
          target.height = map.height;
          const tileLayer = target.layers.find((l) => l.kind === 'tiles');
          const rows = encodeLocationTileRows(grid, tileset);
          if (tileLayer && tileLayer.kind === 'tiles') {
            tileLayer.rows = rows;
            tileLayer.tileset = tileset;
          } else target.layers.unshift({ id: 'tiles', kind: 'tiles', tileset, rows });
        });
        discardLegacyCutsceneStageOverride(legacyId);
        ctx.toast('Imported your Map Editor stage. Save to write it to the project.');
      }, { kind: 'primary' }),
      button(ctx.ui, 'Discard them', () => {
        discardLegacyCutsceneStageOverride(legacyId);
        ctx.rerender();
      }, { kind: 'danger' })
    ));
}

function layerEditor(ctx: EditorContext, loc: LocationDoc, layer: LocationLayer, index: number): HTMLElement {
  const { ui } = ctx;
  const set = (fn: (l: LocationLayer) => void, coalesce?: string) =>
    ctx.update((d) => {
      fn((d as StorySessionData).locations[loc.id]!.layers[index]!);
    }, coalesce ? { coalesce } : undefined);
  const notifier = { toast: ctx.toast, canSave: ctx.canSave };
  const card = h('div', { class: 'cse-layer-card', 'data-testid': `cse-layer-${index}` });
  card.append(h('div', { class: 'cse-cast-head' },
    h('strong', { text: `${index + 1}. ${LAYER_LABELS[layer.kind]}` }),
    row(
      button(ui, '▲', () => ctx.update((d) => {
        const layers = (d as StorySessionData).locations[loc.id]!.layers;
        if (index > 0) [layers[index - 1], layers[index]] = [layers[index]!, layers[index - 1]!];
      }), { kind: 'chip', title: 'Draw earlier (further back)', disabled: index === 0 }),
      button(ui, '▼', () => ctx.update((d) => {
        const layers = (d as StorySessionData).locations[loc.id]!.layers;
        if (index < layers.length - 1) [layers[index + 1], layers[index]] = [layers[index]!, layers[index + 1]!];
      }), { kind: 'chip', title: 'Draw later (further forward)', disabled: index === loc.layers.length - 1 }),
      button(ui, '✕', () => ctx.update((d) => { (d as StorySessionData).locations[loc.id]!.layers.splice(index, 1); }), { kind: 'chip', title: 'Remove layer' })
    )));
  card.append(row(
    checkbox(ui, 'In front of characters', Boolean(layer.front), (v) => set((l) => {
      if (v) l.front = true;
      else delete l.front;
    })),
    field('Opacity', numberInput(ui, layer.opacity ?? 1, (n) => set((l) => {
      const o = Math.max(0, Math.min(1, n));
      if (o >= 1) delete l.opacity;
      else l.opacity = o;
    }), { step: 0.05, min: 0, max: 1 }))
  ));
  switch (layer.kind) {
    case 'tiles':
      card.append(row(
        button(ui, '🖌 Paint tiles…', () => ctx.openLocationPainter(loc.id, index), { kind: 'primary', testid: 'cse-paint-tiles' }),
        field('Main tileset', selectInput(ui, PMD_TILESET_LIST.map((t) => ({ value: t.id, label: t.label })), layer.tileset, (v) => set((l) => {
          if (l.kind !== 'tiles') return;
          const grid = decodeLocationTileRows(l.rows, l.tileset, loc.width, loc.height);
          l.tileset = v;
          l.rows = encodeLocationTileRows(grid, v);
        })))
      ));
      card.append(h('p', { class: 'cse-hint', text: 'Opens the Map Editor on this layer. Its Empty brush makes see-through cells.' }));
      break;
    case 'picture':
      card.append(field('Image', mediaPicker(ui, 'cutscene-backgrounds', layer.image, (f) => set((l) => { (l as { image: string }).image = f; }), notifier)));
      card.append(row(
        field('Offset X (px)', numberInput(ui, layer.x ?? 0, (n) => set((l) => { (l as { x?: number }).x = Math.round(n); }))),
        field('Offset Y (px)', numberInput(ui, layer.y ?? 0, (n) => set((l) => { (l as { y?: number }).y = Math.round(n); })))
      ));
      break;
    case 'texture':
      card.append(field('Image', mediaPicker(ui, 'cutscene-backgrounds', layer.image, (f) => set((l) => { (l as { image: string }).image = f; }), notifier), 'Repeats across the whole screen.'));
      card.append(row(
        field('Frames', numberInput(ui, layer.frames ?? 1, (n) => set((l) => { (l as { frames?: number }).frames = Math.max(1, Math.round(n)); }), { min: 1 })),
        field('Frames / sec', numberInput(ui, layer.fps ?? 6, (n) => set((l) => { (l as { fps?: number }).fps = Math.max(0.1, n); }), { step: 0.5, min: 0.1 })),
        field('Drift X (px/s)', numberInput(ui, layer.driftX ?? 0, (n) => set((l) => { (l as { driftX?: number }).driftX = n; }))),
        field('Drift Y (px/s)', numberInput(ui, layer.driftY ?? 0, (n) => set((l) => { (l as { driftY?: number }).driftY = n; })))
      ));
      card.append(h('p', { class: 'cse-hint', text: 'Animated textures: put the frames side by side in one image and set the frame count.' }));
      break;
    case 'parallax':
      card.append(field('Image', mediaPicker(ui, 'cutscene-backgrounds', layer.image, (f) => set((l) => { (l as { image: string }).image = f; }), notifier)));
      card.append(row(
        field('Scroll (0 = fixed, 1 = with stage)', numberInput(ui, layer.scroll, (n) => set((l) => { (l as { scroll: number }).scroll = Math.max(0, Math.min(2, n)); }), { step: 0.05, min: 0, max: 2 })),
        field('Y (px)', numberInput(ui, layer.y ?? 0, (n) => set((l) => { (l as { y?: number }).y = Math.round(n); }))),
        field('Drift X (px/s)', numberInput(ui, layer.driftX ?? 0, (n) => set((l) => { (l as { driftX?: number }).driftX = n; })))
      ));
      card.append(checkbox(ui, 'Repeat sideways', Boolean(layer.repeatX), (v) => set((l) => { (l as { repeatX?: boolean }).repeatX = v || undefined; })));
      break;
  }
  return card;
}

function propsEditor(ctx: EditorContext): HTMLElement {
  const { ui } = ctx;
  const story = ctx.session.story!;
  const props = story.doc.props ?? [];
  const setProps = (fn: (list: PropPlacement[]) => void) => ctx.update((d) => {
    const s = d as StorySessionData;
    const list = [...(s.doc.props ?? [])];
    fn(list);
    if (list.length) s.doc.props = list;
    else delete s.doc.props;
  });
  const sec = section('Props at the start', h('p', { class: 'cse-hint', text: 'Drag props on the stage in Opening setup. Image props come from assets/cutscene-props/.' }));
  props.forEach((p, i) => {
    const card = h('div', { class: 'cse-layer-card' },
      h('div', { class: 'cse-cast-head' }, h('strong', { text: `${p.id} (${p.kind === 'campfire' ? 'campfire' : 'image'})` }),
        button(ui, '✕', () => setProps((l) => { l.splice(i, 1); }), { kind: 'chip', title: 'Remove prop' })));
    if (p.kind === 'image') {
      card.append(field('Image', mediaPicker(ui, 'cutscene-props', p.image, (f) => setProps((l) => { l[i] = { ...l[i]!, image: f }; }), { toast: ctx.toast, canSave: ctx.canSave })));
    }
    card.append(row(
      field('X', numberInput(ui, p.x, (n) => setProps((l) => { l[i] = { ...l[i]!, x: n }; }), { step: 0.5 })),
      field('Y', numberInput(ui, p.y, (n) => setProps((l) => { l[i] = { ...l[i]!, y: n }; }), { step: 0.5 })),
      field('Layer', selectInput(ui, [
        { value: 'auto', label: 'Sort with characters' },
        { value: 'behind', label: 'Behind everyone' },
        { value: 'front', label: 'In front of everyone' },
      ], p.layer ?? (p.kind === 'campfire' ? 'behind' : 'auto'), (v) => setProps((l) => { l[i] = { ...l[i]!, layer: v }; })))
    ));
    card.append(checkbox(ui, 'Starts hidden', Boolean(p.hidden), (v) => setProps((l) => { l[i] = { ...l[i]!, hidden: v || undefined }; })));
    sec.append(card);
  });
  const nextId = (base: string) => uniqueId(base, (id) => props.some((p) => p.id === id));
  sec.append(row(
    button(ui, '+ Campfire', () => setProps((l) => { l.push({ id: nextId('campfire'), kind: 'campfire', x: Math.floor(story.doc.camera.x), y: Math.floor(story.doc.camera.y) }); }), { kind: 'chip' }),
    button(ui, '+ Image prop', () => setProps((l) => { l.push({ id: nextId('prop'), kind: 'image', image: '', x: Math.floor(story.doc.camera.x), y: Math.floor(story.doc.camera.y) }); }), { kind: 'chip' })
  ));
  return sec;
}

export function renderLocationPanel(ctx: EditorContext, container: HTMLElement, editingId: string, setEditingId: (id: string) => void): void {
  const { ui } = ctx;
  const story = ctx.session.story!;
  container.innerHTML = '';
  const knownIds = new Set([...Object.keys(story.locations), ...listLocationDocs().map((l) => l.id)]);
  const options = [...knownIds].map((id) => ({ value: id, label: story.locations[id]?.name ?? getLocationDoc(id)?.name ?? id }));

  container.append(section('Starting location',
    selectInput(ui, options, story.doc.location, (v) => {
      ctx.update((d) => {
        const s = d as StorySessionData;
        const reg = getLocationDoc(v);
        if (reg && !s.locations[v]) s.locations[v] = JSON.parse(JSON.stringify(reg));
        s.doc.location = v;
      });
      setEditingId(v);
    }, 'cse-location-select'),
    row(
      button(ui, '+ New location', () => {
        const name = window.prompt('Name for the new location:', 'New location');
        if (!name) return;
        const id = uniqueId(slugifyId(name, 'location'), (c) => knownIds.has(c));
        ctx.update((d) => {
          const s = d as StorySessionData;
          s.locations[id] = blankLocation(id, name);
          s.doc.location = id;
        });
        setEditingId(id);
      }, { kind: 'chip', testid: 'cse-new-location' }),
      button(ui, 'Make a copy', () => {
        const src = story.locations[editingId];
        if (!src) return;
        const name = window.prompt('Name for the copy:', `${src.name} (copy)`);
        if (!name) return;
        const id = uniqueId(slugifyId(name, 'location'), (c) => knownIds.has(c));
        ctx.update((d) => {
          const s = d as StorySessionData;
          s.locations[id] = { ...JSON.parse(JSON.stringify(src)), id, name };
          if (s.doc.location === editingId) s.doc.location = id;
          for (const b of s.doc.beats) for (const a of b.actions ?? []) if (a.type === 'location' && a.location === editingId) a.location = id;
        });
        setEditingId(id);
      }, { kind: 'chip', title: 'Edit a variation without changing other cutscenes' })
    )));

  const editable = Object.values(story.locations);
  if (editable.length > 1) {
    container.append(field('Editing location', selectInput(ui, editable.map((l) => ({ value: l.id, label: l.name })), editingId, (v) => setEditingId(v))));
  }
  const loc = story.locations[editingId];
  if (!loc) {
    container.append(h('p', { class: 'cse-hint', text: 'Pick a location above.' }));
    return;
  }
  const users = listCutscenesUsingLocation(loc.id).filter((d) => d.id !== story.doc.id);
  container.append(h('p', { class: `cse-hint${users.length ? ' is-warning' : ''}`, 'data-testid': 'cse-location-usage', text: users.length ? `Shared: also used by ${users.length} other cutscene${users.length === 1 ? '' : 's'} (${users.map((u) => u.title).join(', ')}). Edits change them too; use “Make a copy” for a variation.` : 'Only this cutscene uses this location.' }));
  const banner = legacyImportBanner(ctx, loc);
  if (banner) container.append(banner);

  const setLoc = (fn: (l: LocationDoc) => void, coalesce?: string) => ctx.update((d) => fn((d as StorySessionData).locations[loc.id]!), coalesce ? { coalesce, keepInspector: true } : undefined);
  container.append(section('Location',
    field('Name', textInput(ui, loc.name, (v) => setLoc((l) => { l.name = v; }, `locname:${loc.id}`))),
    row(
      field('Width (tiles)', numberInput(ui, loc.width, (n) => setLoc((l) => resizeLocation(l, Math.max(4, Math.min(64, Math.round(n))), l.height)), { min: 4, max: 64 })),
      field('Height (tiles)', numberInput(ui, loc.height, (n) => setLoc((l) => resizeLocation(l, l.width, Math.max(4, Math.min(48, Math.round(n))))), { min: 4, max: 48 }))
    ),
    h('p', { class: 'cse-hint', text: 'Size sets the placement grid and how far the camera can pan. 1 tile = 24 image pixels.' })));

  const layersSec = section('Background layers (back to front)');
  loc.layers.forEach((layer, i) => layersSec.append(layerEditor(ctx, loc, layer, i)));
  const addLayer = (kind: LocationLayerKind) => setLoc((l) => {
    const id = uniqueId(kind, (c) => l.layers.some((x) => x.id === c));
    const layer: LocationLayer =
      kind === 'tiles'
        ? { id, kind, tileset: '042', rows: Array.from({ length: l.height }, () => Array.from({ length: l.width }, () => '.').join(' ')) }
        : kind === 'picture'
          ? { id, kind, image: '' }
          : kind === 'texture'
            ? { id, kind, image: '', frames: 1, fps: 6, driftX: 0, driftY: 0 }
            : { id, kind, image: '', scroll: 0.5, repeatX: true };
    if (kind === 'texture' || kind === 'parallax') l.layers.unshift(layer);
    else l.layers.push(layer);
  });
  layersSec.append(row(
    button(ui, '+ Tile map', () => addLayer('tiles'), { kind: 'chip' }),
    button(ui, '+ Picture', () => addLayer('picture'), { kind: 'chip' }),
    button(ui, '+ Repeating texture', () => addLayer('texture'), { kind: 'chip', testid: 'cse-add-texture-layer' }),
    button(ui, '+ Parallax', () => addLayer('parallax'), { kind: 'chip' })
  ));
  container.append(layersSec);
  container.append(propsEditor(ctx));
}
