/**
 * Cutscene Editor Scene Settings & Battle Dialogue Trigger Panels (`panelScene.ts`)
 */

import {
  LIGHTING_MOODS,
  WEATHER_KINDS,
  type DialogueDocRole,
  type LightingMood,
  type WeatherKind,
} from '../data/cutscenes/cutsceneDocTypes';
import { getCutsceneDoc } from '../data/cutscenes/cutsceneRegistry';
import { RAW_CHAPTER_JSON_LIST } from '../data/chapters/defaultCatalog';
import { getRawChapterJson } from '../data/chapters/index';
import { ITEMS_LIST } from '../data/index';
import { LIGHTING_MOOD_LABELS, WEATHER_LABELS } from '../scenes/cutscene/cutsceneAtmosphere';
import type { DungeonEventAction, DungeonEventDefinition, DungeonEventTrigger } from '../types/schemas';
import type { EditorContext } from './editorContext';
import { button, checkbox, field, h, numberInput, row, section, selectInput, textInput } from './editorDom';
import { songPicker } from './editorPickers';
import type { DialogueSessionData, StorySessionData } from './editorSession';

export interface ScenePanelHooks {
  onDelete: () => void;
  onAimCamera: () => void;
  aimingCamera: boolean;
  onRenameId: (nextId: string) => void;
}

function chapterLabel(id: string): string {
  return RAW_CHAPTER_JSON_LIST.find((c) => c.id === id)?.label ?? id;
}

export function renderStoryScenePanel(ctx: EditorContext, container: HTMLElement, hooks: ScenePanelHooks): void {
  const { ui } = ctx;
  const story = ctx.session.story!;
  const doc = story.doc;
  container.innerHTML = '';
  const setDoc = (fn: (s: StorySessionData) => void, coalesce?: string) =>
    ctx.update((d) => fn(d as StorySessionData), coalesce ? { coalesce, keepInspector: true } : undefined);

  const idInput = textInput(ui, doc.id, () => {}, { testid: 'cse-scene-id' });
  idInput.addEventListener('change', () => hooks.onRenameId(idInput.value), { signal: ui.signal });
  container.append(section('Cutscene',
    field('Title (shown in Story replays)', textInput(ui, doc.title, (v) => setDoc((s) => { s.doc.title = v; }, 'title'), { testid: 'cse-scene-title' })),
    field('Id (file name)', idInput, ctx.session.isNew ? 'Change before the first save.' : 'Renaming moves the file on save.'),
    field('Location banner', textInput(ui, doc.banner, (v) => setDoc((s) => { s.doc.banner = v; }, 'banner'), { placeholder: 'e.g. Coastal Village Trail · Verdant Commonwealth' }))));

  const linkValue = story.link ? `${story.link.when}:${story.link.chapterId}` : 'none';
  const linkOptions = [{ value: 'none', label: 'Not linked yet (never plays)' }];
  for (const ch of RAW_CHAPTER_JSON_LIST) {
    linkOptions.push({ value: `before:${ch.id}`, label: `Before ${ch.label}` });
    linkOptions.push({ value: `after:${ch.id}`, label: `After ${ch.label}` });
  }
  let occupiedNote = '';
  if (story.link) {
    const raw = getRawChapterJson(story.link.chapterId);
    const current = story.link.when === 'before' ? raw?.preStoryCutsceneId : raw?.postStoryCutsceneId;
    if (current && current !== doc.id) occupiedNote = `Saving replaces “${getCutsceneDoc(current)?.title ?? current}” in that slot (it becomes unlinked).`;
  }
  container.append(section('When it plays',
    selectInput(ui, linkOptions, linkValue, (v) => setDoc((s) => {
      if (v === 'none') s.link = null;
      else {
        const [when, chapterId] = v.split(':') as ['before' | 'after', string];
        s.link = { when, chapterId };
      }
    }), 'cse-scene-link'),
    occupiedNote ? h('p', { class: 'cse-hint is-warning', text: occupiedNote }) : null));

  container.append(section('Music',
    selectInput(ui, [{ value: 'song', label: 'Play a song' }, { value: 'silence', label: 'Silence' }], doc.music === null ? 'silence' : 'song', (v) => setDoc((s) => { s.doc.music = v === 'silence' ? null : (s.doc.music ?? 'calm_cutscene'); })),
    doc.music !== null ? songPicker(ui, doc.music, (song) => setDoc((s) => { s.doc.music = song; }), { toast: ctx.toast, canSave: ctx.canSave }) : null));

  container.append(section('Look',
    field('Lighting', selectInput(ui, LIGHTING_MOODS.map((m) => ({ value: m, label: LIGHTING_MOOD_LABELS[m] })), doc.lighting, (v: LightingMood) => setDoc((s) => { s.doc.lighting = v; }))),
    field('Weather', selectInput(ui, WEATHER_KINDS.map((w) => ({ value: w, label: WEATHER_LABELS[w] })), doc.weather ?? 'none', (v: WeatherKind) => setDoc((s) => {
      if (v === 'none') delete s.doc.weather;
      else s.doc.weather = v;
    }))),
    row(
      field('Camera X', numberInput(ui, doc.camera.x, (n) => setDoc((s) => { s.doc.camera.x = n; }), { step: 0.5 })),
      field('Camera Y', numberInput(ui, doc.camera.y, (n) => setDoc((s) => { s.doc.camera.y = n; }), { step: 0.5 })),
      button(ui, hooks.aimingCamera ? 'Tap the stage…' : '🎯 Aim on stage', () => hooks.onAimCamera(), { kind: 'chip', active: hooks.aimingCamera })
    ),
    h('p', { class: 'cse-hint', text: 'Switch the stage to “Game camera” view to see exactly what players see.' })));

  container.append(section('Danger zone', button(ui, 'Delete this cutscene…', () => hooks.onDelete(), { kind: 'danger', testid: 'cse-delete-cutscene' })));
}

function chapterUnits(chapterId: string): Array<{ value: string; label: string }> {
  const raw = getRawChapterJson(chapterId);
  if (!raw) return [];
  const out: Array<{ value: string; label: string }> = [];
  for (const e of raw.enemySpawns) if (e.id) out.push({ value: e.id, label: `${e.nickname ?? e.speciesId} (enemy)` });
  for (const n of raw.npcSpawns ?? []) if (n.id) out.push({ value: n.id, label: `${n.nickname ?? n.speciesId} (ally NPC)` });
  for (const ev of raw.events ?? []) {
    for (const a of ev.actions) {
      if (a.type === 'spawn_units') for (const u of a.units) if (u.id) out.push({ value: u.id, label: `${u.nickname ?? u.speciesId} (arrives mid-battle)` });
    }
  }
  return out;
}

const TRIGGER_OPTIONS: Array<{ value: DungeonEventTrigger['type']; label: string }> = [
  { value: 'turn_start', label: 'Start of a turn' },
  { value: 'talk', label: 'A Talk with a unit' },
  { value: 'unit_defeated', label: 'A unit is defeated' },
  { value: 'tile_reached', label: 'A unit reaches an area' },
  { value: 'battle_victory', label: 'Battle won' },
  { value: 'unit_healed', label: 'A unit is healed' },
];

function defaultTrigger(type: DungeonEventTrigger['type'], firstUnit: string): DungeonEventTrigger {
  switch (type) {
    case 'turn_start':
      return { type, turnNumber: 2, phase: 'player_phase' };
    case 'talk':
      return { type, targetUnitId: firstUnit, initiator: 'lord' };
    case 'unit_defeated':
      return { type, targetUnitId: firstUnit };
    case 'tile_reached':
      return { type, x1: 1, y1: 1, x2: 2, y2: 2, by: 'any_player' };
    case 'battle_victory':
      return { type };
    case 'unit_healed':
      return { type };
  }
}

export interface DialoguePanelHooks {
  onDelete: () => void;
  pickingArea: boolean;
  onPickArea: () => void;
}

export function renderDialogueSettingsPanel(ctx: EditorContext, container: HTMLElement, hooks: DialoguePanelHooks): void {
  const { ui } = ctx;
  const dlg = ctx.session.dialogue!;
  const doc = dlg.doc;
  container.innerHTML = '';
  const setData = (fn: (s: DialogueSessionData) => void, coalesce?: string) =>
    ctx.update((d) => fn(d as DialogueSessionData), coalesce ? { coalesce, keepInspector: true } : undefined);

  container.append(section('Battle dialogue',
    h('p', { class: 'cse-hint', text: `${chapterLabel(doc.chapter)} · plays over the battle map` }),
    field('Title', textInput(ui, doc.title ?? '', (v) => setData((s) => { s.doc.title = v || undefined; }, 'title'))),
    field('Plays as', selectInput(ui, [
      { value: 'intro', label: 'Chapter intro (before the battle)' },
      { value: 'outro', label: 'Chapter outro (after victory)' },
      { value: 'event', label: 'Mid-battle event (set a trigger)' },
    ], doc.role, (v: DialogueDocRole) => setData((s) => {
      s.doc.role = v;
      if (v !== 'event') s.event = null;
    }), 'cse-dialogue-role')),
    doc.role !== 'event' ? h('p', { class: 'cse-hint', text: 'Intros and outros are fixed per chapter: the file is named intro/outro.' }) : null));

  const musicMode = doc.music === undefined ? 'keep' : doc.music === null ? 'silence' : 'song';
  container.append(section('Music when it opens',
    selectInput(ui, [{ value: 'keep', label: 'Keep the battle music' }, { value: 'song', label: 'Play a song' }, { value: 'silence', label: 'Silence' }], musicMode, (v) => setData((s) => {
      if (v === 'keep') delete s.doc.music;
      else if (v === 'silence') s.doc.music = null;
      else s.doc.music = s.doc.music ?? 'calm_cutscene';
    })),
    musicMode === 'song' ? songPicker(ui, doc.music ?? null, (song) => setData((s) => { s.doc.music = song; }), { toast: ctx.toast, canSave: ctx.canSave }) : null,
    h('p', { class: 'cse-hint', text: 'The battle music comes back when the dialogue ends.' })));

  if (doc.role === 'event') container.append(triggerSection(ctx, dlg, hooks));
  container.append(section('Danger zone', button(ui, 'Delete this dialogue…', () => hooks.onDelete(), { kind: 'danger' })));
}

function triggerSection(ctx: EditorContext, dlg: DialogueSessionData, hooks: DialoguePanelHooks): HTMLElement {
  const { ui } = ctx;
  const units = chapterUnits(dlg.doc.chapter);
  const firstUnit = units[0]?.value ?? '';
  const sec = section('Trigger');
  const ev = dlg.event;
  const setEvent = (fn: (e: DungeonEventDefinition) => void) => ctx.update((d) => {
    const s = d as DialogueSessionData;
    if (!s.event) {
      s.event = { id: `ev_${s.doc.id}`, once: true, trigger: defaultTrigger('turn_start', firstUnit), actions: [{ type: 'play_dialogue', scriptId: s.doc.id }] };
    }
    fn(s.event);
  });
  if (!ev) {
    sec.append(h('p', { class: 'cse-hint is-warning', text: 'No trigger yet, so this dialogue never plays.' }), button(ui, 'Add a trigger', () => setEvent(() => {}), { kind: 'primary' }));
    return sec;
  }
  const t = ev.trigger;
  sec.append(field('When', selectInput(ui, TRIGGER_OPTIONS, t.type, (v) => setEvent((e) => { e.trigger = defaultTrigger(v, firstUnit); }), 'cse-trigger-type')));
  const unitSelect = (value: string, onPick: (v: string) => void) =>
    selectInput(ui, units.length ? units : [{ value: '', label: '(this chapter has no named units)' }], value, onPick);
  if (t.type === 'turn_start') {
    sec.append(row(
      field('Turn', numberInput(ui, t.turnNumber, (n) => setEvent((e) => { (e.trigger as typeof t).turnNumber = Math.max(1, Math.round(n)); }), { min: 1 })),
      field('Phase', selectInput(ui, [{ value: 'player_phase', label: 'Player phase' }, { value: 'enemy_phase', label: 'Enemy phase' }], t.phase ?? 'player_phase', (v) => setEvent((e) => { (e.trigger as typeof t).phase = v; })))
    ));
  } else if (t.type === 'talk') {
    sec.append(field('Talk to', unitSelect(t.targetUnitId, (v) => setEvent((e) => { (e.trigger as typeof t).targetUnitId = v; }))));
    sec.append(field('Who can talk', selectInput(ui, [{ value: 'lord', label: 'Only the hero' }, { value: 'any_player', label: 'Anyone on your team' }], t.initiator ?? 'any_player', (v) => setEvent((e) => { (e.trigger as typeof t).initiator = v; }))));
  } else if (t.type === 'unit_defeated') {
    sec.append(field('Unit', unitSelect(t.targetUnitId, (v) => setEvent((e) => { (e.trigger as typeof t).targetUnitId = v; }))));
  } else if (t.type === 'tile_reached') {
    sec.append(row(
      field('From X', numberInput(ui, t.x1 ?? 1, (n) => setEvent((e) => { (e.trigger as typeof t).x1 = Math.round(n); }))),
      field('From Y', numberInput(ui, t.y1 ?? 1, (n) => setEvent((e) => { (e.trigger as typeof t).y1 = Math.round(n); }))),
      field('To X', numberInput(ui, t.x2 ?? 2, (n) => setEvent((e) => { (e.trigger as typeof t).x2 = Math.round(n); }))),
      field('To Y', numberInput(ui, t.y2 ?? 2, (n) => setEvent((e) => { (e.trigger as typeof t).y2 = Math.round(n); })))
    ));
    sec.append(row(
      field('Reached by', selectInput(ui, [{ value: 'any_player', label: 'Anyone on your team' }, { value: 'lord', label: 'Only the hero' }], t.by ?? 'any_player', (v) => setEvent((e) => { (e.trigger as typeof t).by = v; }))),
      button(ui, hooks.pickingArea ? 'Tap two corners on the map…' : '🎯 Pick area on map', () => hooks.onPickArea(), { kind: 'chip', active: hooks.pickingArea })
    ));
  }
  sec.append(checkbox(ui, 'Only once per battle', ev.once !== false, (v) => setEvent((e) => { e.once = v ? true : false; })));

  const extras = section('Also do');
  const findAction = <T extends DungeonEventAction['type']>(type: T) => ev.actions.find((a) => a.type === type) as Extract<DungeonEventAction, { type: T }> | undefined;
  const toggleAction = (type: DungeonEventAction['type'], make: () => DungeonEventAction, on: boolean) => setEvent((e) => {
    e.actions = e.actions.filter((a) => a.type !== type);
    if (on) e.actions.push(make());
  });
  if (t.type === 'talk') {
    const convert = findAction('convert_unit');
    extras.append(checkbox(ui, 'Recruit them after the Talk', Boolean(convert), (v) => toggleAction('convert_unit', () => ({
      type: 'convert_unit', targetUnitId: t.targetUnitId, toFaction: 'player', healToFull: true, addToPermanentRoster: true, calloutText: 'RECRUITED!',
    }), v), 'cse-extra-recruit'));
  }
  const banner = findAction('show_banner');
  extras.append(checkbox(ui, 'Show a banner', Boolean(banner), (v) => toggleAction('show_banner', () => ({ type: 'show_banner', text: 'Something happened!' }), v)));
  if (banner) {
    extras.append(textInput(ui, banner.text, (val) => ctx.update((d) => {
      const b = (d as DialogueSessionData).event?.actions.find((a) => a.type === 'show_banner') as { text: string } | undefined;
      if (b) b.text = val;
    }, { coalesce: 'banner', keepInspector: true })));
  }
  const grant = findAction('grant_items');
  extras.append(checkbox(ui, 'Give items or gold', Boolean(grant), (v) => toggleAction('grant_items', () => ({ type: 'grant_items', items: [{ itemId: 'oran_berry', quantity: 1 }], gold: 0 }), v)));
  if (grant) {
    const item = grant.items?.[0];
    const setGrant = (fn: (g: Extract<DungeonEventAction, { type: 'grant_items' }>) => void) => setEvent((e) => {
      const g = e.actions.find((a) => a.type === 'grant_items') as Extract<DungeonEventAction, { type: 'grant_items' }> | undefined;
      if (g) fn(g);
    });
    extras.append(row(
      field('Item', selectInput(ui, [{ value: '', label: '(no item)' }, ...ITEMS_LIST.map((it) => ({ value: it.id, label: it.name }))], item?.itemId ?? '', (v) => setGrant((g) => { g.items = v ? [{ itemId: v, quantity: g.items?.[0]?.quantity ?? 1 }] : []; }))),
      field('Qty', numberInput(ui, item?.quantity ?? 1, (n) => setGrant((g) => { if (g.items?.[0]) g.items[0].quantity = Math.max(1, Math.round(n)); }), { min: 1 })),
      field('Gold', numberInput(ui, grant.gold ?? 0, (n) => setGrant((g) => { g.gold = Math.max(0, Math.round(n)); }), { min: 0, step: 50 }))
    ));
  }
  const others = ev.actions.filter((a) => !['play_dialogue', 'convert_unit', 'show_banner', 'grant_items'].includes(a.type));
  if (others.length) {
    extras.append(h('p', { class: 'cse-hint', text: `Also does (kept as is): ${others.map((a) => a.type.replace(/_/g, ' ')).join(', ')}.` }));
  }
  sec.append(extras);
  return sec;
}
