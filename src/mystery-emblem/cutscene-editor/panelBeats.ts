/**
 * Cutscene Editor Beats Panel: Storyboard List & Beat Inspector (`panelBeats.ts`)
 */

import type { PmdPortraitEmotion } from '../assets/pmdAssetLoader';
import { listSpriteAnimationNames } from '../assets/pmdAssetLoader';
import {
  EMOTE_KINDS,
  FACINGS,
  LIGHTING_MOODS,
  NARRATOR_SPEAKER_ID,
  WEATHER_KINDS,
  type Beat,
  type CastPlacement,
  type EmoteKind,
  type Facing,
  type LightingMood,
  type MusicChange,
  type PropPlacement,
  type ShowIfCondition,
  type StageAction,
  type StageActionType,
  type WalkSpeed,
  type WeatherKind,
} from '../data/cutscenes/cutsceneDocTypes';
import { listLocationDocs } from '../data/cutscenes/cutsceneRegistry';
import { interpolateCastNames } from '../data/cutscenes/dialogueCompiler';
import { interpolateCampaignText } from '../engine/speakerResolver';
import { CHAPTER_LEVEL_CATALOG } from '../data/chapterMapRegistry';
import { DRAGON_LORD_SPECIES_IDS } from '../data/campaignConfig';
import { getSpeciesById } from '../data/index';
import { LIGHTING_MOOD_LABELS, WEATHER_LABELS } from '../scenes/cutscene/cutsceneAtmosphere';
import type { EditorContext } from './editorContext';
import {
  button,
  checkbox,
  field,
  h,
  insertAtCaret,
  numberInput,
  row,
  section,
  segmented,
  selectInput,
  textInput,
} from './editorDom';
import {
  ACTION_TYPES,
  actionInfo,
  beatHeadline,
  createDefaultAction,
  EMOTE_LABELS,
  summarizeAction,
  summarizeCondition,
} from './editorLabels';
import { emotionGrid, mediaPicker, songPicker } from './editorPickers';
import type { SessionData } from './editorSession';
import { DIALOGUE_SOFT_LIMIT, measureDialogueLength, validateSession } from './editorValidation';

const facingOptions = (withAuto: boolean) => [
  ...(withAuto ? [{ value: '' as Facing | '', label: 'Auto (direction of travel)' }] : []),
  ...FACINGS.map((f) => ({ value: f as Facing | '', label: f.replace(/([a-z])([A-Z])/g, '$1-$2') })),
];

function newBeatId(data: SessionData): string {
  const taken = new Set(data.doc.beats.map((b) => b.id));
  let n = data.doc.beats.length + 1;
  while (taken.has(`beat_${n}`)) n++;
  return `beat_${n}`;
}

function castOptions(ctx: EditorContext, onStageOnly: boolean): Array<{ value: string; label: string }> {
  return ctx.session.data.doc.cast
    .filter((c) => !onStageOnly || !c.offStage)
    .map((c) => ({ value: c.id, label: ctx.nameOf(c.id) }));
}

export function renderBeatList(ctx: EditorContext, container: HTMLElement): void {
  const { session, sel, ui } = ctx;
  const data = session.data;
  const issues = validateSession(data);
  container.innerHTML = '';
  const list = h('ol', { class: 'cse-beat-list', 'data-testid': 'cse-beat-list' });

  if (data.kind === 'story') {
    const opening = h('li', { class: `cse-beat-card cse-beat-card--setup${sel.beatIndex === -1 ? ' is-selected' : ''}`, 'data-testid': 'cse-beat-setup' },
      h('span', { class: 'cse-beat-num', text: '⚑' }),
      h('div', { class: 'cse-beat-body' }, h('strong', { text: 'Opening setup' }), h('span', { class: 'cse-beat-text', text: 'Starting spots, props, camera' })));
    opening.addEventListener('pointerup', () => ctx.select({ beatIndex: -1, actionIndex: null }), { signal: ui.signal });
    list.append(opening);
  }

  data.doc.beats.forEach((beat, i) => {
    const { who, text } = beatHeadline(beat, ctx.nameOf, (t) =>
      interpolateCampaignText(interpolateCastNames(t, data.doc.cast, ctx.previewSave), ctx.previewSave, beat.say ? ctx.nameOf(beat.say.speaker) : undefined)
    );
    const beatIssues = issues.filter((x) => x.beatId === beat.id);
    const badges = h('span', { class: 'cse-beat-badges' });
    for (const a of beat.actions ?? []) badges.append(h('span', { class: 'cse-badge', title: actionInfo(a.type).label, text: actionInfo(a.type).icon }));
    if (beat.music) badges.append(h('span', { class: 'cse-badge', title: 'Music change', text: '♪' }));
    if (beat.sound) badges.append(h('span', { class: 'cse-badge', title: 'Sound', text: '🔊' }));
    if (beat.showIf?.length) badges.append(h('span', { class: 'cse-badge cse-badge--cond', title: beat.showIf.map((c) => summarizeCondition(c, ctx.nameOf)).join(' and '), text: 'if' }));
    if (beat.waitForActions) badges.append(h('span', { class: 'cse-badge', title: 'Box waits for actions', text: '⏳' }));
    if (beatIssues.length) badges.append(h('span', { class: `cse-badge cse-badge--${beatIssues.some((x) => x.level === 'error') ? 'error' : 'warn'}`, title: beatIssues.map((x) => x.message).join('\n'), text: '⚠' }));
    const card = h('li', { class: `cse-beat-card${beat.say ? '' : ' cse-beat-card--silent'}${sel.beatIndex === i ? ' is-selected' : ''}`, 'data-testid': `cse-beat-${i}` },
      h('span', { class: 'cse-beat-num', text: String(i + 1) }),
      h('div', { class: 'cse-beat-body' },
        h('strong', { class: 'cse-beat-who', text: `${beat.say ? '' : '🎬 '}${who}` }),
        h('span', { class: 'cse-beat-text', text: text.length > 70 ? `${text.slice(0, 68)}…` : text }),
        badges));
    card.addEventListener('pointerup', () => ctx.select({ beatIndex: i, actionIndex: null }), { signal: ui.signal });
    list.append(card);
  });
  container.append(list);

  const insertAt = () => Math.min(data.doc.beats.length, Math.max(0, sel.beatIndex + 1));
  const addBeat = (silent: boolean) => {
    const idx = insertAt();
    ctx.update((d) => {
      const prev = d.doc.beats[idx - 1];
      const speaker = prev?.say?.speaker ?? d.doc.cast[0]?.id ?? NARRATOR_SPEAKER_ID;
      const beat: Beat = silent
        ? { id: newBeatId(d), actions: [] }
        : { id: newBeatId(d), say: { speaker, emotion: 'Normal', side: 'auto', text: '' } };
      d.doc.beats.splice(idx, 0, beat);
    });
    ctx.select({ beatIndex: idx, actionIndex: null });
  };
  container.append(row(
    button(ui, '+ Dialogue', () => addBeat(false), { kind: 'primary', testid: 'cse-add-dialogue-beat', title: 'Add a dialogue box after the selected beat' }),
    data.kind === 'story' ? button(ui, '+ Silent beat', () => addBeat(true), { testid: 'cse-add-silent-beat', title: 'Add a beat with no dialogue box (movement, effects…)' }) : null
  ));
}

function textToolbar(ctx: EditorContext, textarea: HTMLTextAreaElement | HTMLInputElement): HTMLElement {
  const { ui } = ctx;
  const bar = h('div', { class: 'cse-text-toolbar' });
  for (const token of ['lord', 'partner', 'healer', 'mentor', 'advisor', 'speaker']) {
    bar.append(button(ui, `{${token}}`, () => insertAtCaret(textarea, `{${token}}`), { kind: 'chip', title: `Insert the ${token}'s current name` }));
  }
  const castNames = ctx.session.data.doc.cast.filter((c) => !['lord', 'partner', 'healer', 'mentor', 'advisor'].includes(c.who.kind));
  for (const c of castNames) {
    bar.append(button(ui, `{${ctx.nameOf(c.id)}}`, () => insertAtCaret(textarea, `{name:${c.id}}`), { kind: 'chip', title: `Insert ${ctx.nameOf(c.id)}'s name (follows nicknames)` }));
  }
  bar.append(
    button(ui, 'Pause', () => insertAtCaret(textarea, '[pause]'), { kind: 'chip', title: 'Half-second pause. Use [pause 1.5] for longer.' }),
    button(ui, 'Shake', () => insertAtCaret(textarea, '[shake]', '[/shake]'), { kind: 'chip', title: 'Shaky text (select words first)' }),
    button(ui, 'Slow', () => insertAtCaret(textarea, '[slow]', '[/slow]'), { kind: 'chip', title: 'Slowly typed text (select words first)' })
  );
  return bar;
}

function musicEditor(ctx: EditorContext, beat: Beat, beatIndex: number): HTMLElement {
  const { ui } = ctx;
  const kind = beat.music?.kind ?? 'none';
  const setMusic = (music: MusicChange | undefined) =>
    ctx.update((d) => {
      const b = d.doc.beats[beatIndex]!;
      if (music) b.music = music;
      else delete b.music;
    });
  const wrap = h('div', { class: 'cse-stack' },
    selectInput(ui, [
      { value: 'none', label: 'Keep the current song' },
      { value: 'song', label: 'Switch to another song (crossfade)' },
      { value: 'silence', label: 'Fade to silence' },
      { value: 'main', label: 'Back to the main song' },
    ], kind, (v) => {
      if (v === 'none') setMusic(undefined);
      else if (v === 'song') setMusic({ kind: 'song', song: beat.music?.kind === 'song' ? beat.music.song : 'calm_cutscene' });
      else setMusic({ kind: v });
    }, 'cse-beat-music-kind'));
  if (beat.music?.kind === 'song') {
    wrap.append(songPicker(ui, beat.music.song, (song) => setMusic({ kind: 'song', song }), { toast: ctx.toast, canSave: ctx.canSave }));
  }
  return wrap;
}

function showIfEditor(ctx: EditorContext, beat: Beat, beatIndex: number): HTMLElement {
  const { ui } = ctx;
  const wrap = h('div', { class: 'cse-stack' });
  const conds = beat.showIf ?? [];
  const setConds = (fn: (list: ShowIfCondition[]) => void) =>
    ctx.update((d) => {
      const b = d.doc.beats[beatIndex]!;
      const list = [...(b.showIf ?? [])];
      fn(list);
      if (list.length) b.showIf = list;
      else delete b.showIf;
    });
  if (conds.length === 0) wrap.append(h('p', { class: 'cse-hint', text: 'Always shown. Add a condition to show this beat only sometimes.' }));
  conds.forEach((c, ci) => {
    const controls = h('div', { class: 'cse-row cse-row--wrap cse-cond' });
    controls.append(checkbox(ui, 'NOT', Boolean(c.negate), (v) => setConds((l) => { l[ci] = { ...l[ci]!, negate: v || undefined }; })));
    if (c.kind === 'in_party') {
      controls.append(selectInput(ui, castOptions(ctx, false), c.cast, (v) => setConds((l) => { l[ci] = { ...c, cast: v }; })), h('span', { text: 'is in the party' }));
    } else if (c.kind === 'hero_is') {
      controls.append(h('span', { text: 'Hero is' }));
      for (const sp of DRAGON_LORD_SPECIES_IDS) {
        controls.append(checkbox(ui, getSpeciesById(sp)?.name ?? sp, c.species.includes(sp), (v) =>
          setConds((l) => {
            const set = new Set(c.species);
            if (v) set.add(sp);
            else set.delete(sp);
            l[ci] = { ...c, species: [...set] };
          })));
      }
    } else {
      controls.append(selectInput(ui, CHAPTER_LEVEL_CATALOG.map((ch) => ({ value: ch.id, label: ch.label })), c.chapter, (v) => setConds((l) => { l[ci] = { ...c, chapter: v }; })), h('span', { text: 'is cleared' }));
    }
    controls.append(button(ui, '✕', () => setConds((l) => { l.splice(ci, 1); }), { kind: 'chip', title: 'Remove condition' }));
    wrap.append(controls);
  });
  const firstCast = ctx.session.data.doc.cast.find((c) => !['lord', 'partner', 'healer', 'advisor'].includes(c.who.kind))?.id ?? ctx.session.data.doc.cast[0]?.id ?? 'lord';
  wrap.append(row(
    button(ui, '+ Cast member in party', () => setConds((l) => { l.push({ kind: 'in_party', cast: firstCast }); }), { kind: 'chip' }),
    button(ui, '+ Hero is…', () => setConds((l) => { l.push({ kind: 'hero_is', species: ['axew'] }); }), { kind: 'chip' }),
    button(ui, '+ Chapter cleared', () => setConds((l) => { l.push({ kind: 'chapter_cleared', chapter: 'chapter_01' }); }), { kind: 'chip' })
  ));
  return wrap;
}

function dialogueSection(ctx: EditorContext, beat: Beat, beatIndex: number): HTMLElement {
  const { ui } = ctx;
  const say = beat.say!;
  const isStory = ctx.session.data.kind === 'story';
  const speakerOptions = [
    ...castOptions(ctx, false).map((o) => ({ ...o, label: `${o.label}` })),
    { value: NARRATOR_SPEAKER_ID, label: 'Narrator (no portrait)' },
  ];
  const sec = section('Dialogue box');
  sec.append(field('Speaker', selectInput(ui, speakerOptions, say.speaker, (v) => ctx.update((d) => { d.doc.beats[beatIndex]!.say!.speaker = v; }), 'cse-speaker-select')));
  if (say.speaker !== NARRATOR_SPEAKER_ID) {
    sec.append(field('Emotion', emotionGrid(ui, ctx.visualKeyOf(say.speaker), say.emotion, (emotion: PmdPortraitEmotion) => ctx.update((d) => { d.doc.beats[beatIndex]!.say!.emotion = emotion; }))));
    sec.append(field('Side', segmented(ui, [
      { value: 'auto', label: 'Auto', title: 'Stays where this speaker last spoke; new speakers take the other side' },
      { value: 'left', label: 'Left' },
      { value: 'right', label: 'Right' },
    ], say.side, (v) => ctx.update((d) => { d.doc.beats[beatIndex]!.say!.side = v; }))));
  }
  const counter = h('span', { class: 'cse-hint', 'data-testid': 'cse-length-counter' });
  const syncCounter = (text: string) => {
    const len = measureDialogueLength(text);
    counter.textContent = `${len}/${DIALOGUE_SOFT_LIMIT} characters (names counted at full length)${len > DIALOGUE_SOFT_LIMIT ? ' — too long for a phone, split it into two boxes' : ''}`;
    counter.classList.toggle('is-warning', len > DIALOGUE_SOFT_LIMIT);
  };
  const textarea = textInput(ui, say.text, (v) => {
    syncCounter(v);
    ctx.update((d) => { d.doc.beats[beatIndex]!.say!.text = v; }, { coalesce: `text:${beat.id}`, keepInspector: true });
  }, { multiline: true, rows: 4, testid: 'cse-line-text', placeholder: 'What do they say?' });
  syncCounter(say.text);
  sec.append(field('Text', textarea), textToolbar(ctx, textarea), counter);
  if (say.speaker !== NARRATOR_SPEAKER_ID) {
    sec.append(checkbox(ui, 'Hide the other portrait', Boolean(say.hideOtherPortrait), (v) => ctx.update((d) => {
      const s = d.doc.beats[beatIndex]!.say!;
      if (v) s.hideOtherPortrait = true;
      else delete s.hideOtherPortrait;
    })));
  }
  if (isStory) {
    sec.append(checkbox(ui, 'Hide the box until this beat’s actions finish', Boolean(beat.waitForActions), (v) => ctx.update((d) => {
      const b = d.doc.beats[beatIndex]!;
      if (v) b.waitForActions = true;
      else delete b.waitForActions;
    }), 'cse-wait-for-actions'));
  }
  return sec;
}

function silentSection(ctx: EditorContext, beat: Beat, beatIndex: number): HTMLElement {
  const { ui } = ctx;
  const adv = beat.advance ?? { kind: 'actions' as const };
  const sec = section('Silent beat', h('p', { class: 'cse-hint', text: 'The dialogue box is hidden. Players can tap to skip ahead.' }));
  sec.append(field('Moves on', segmented(ui, [
    { value: 'actions', label: 'When actions finish' },
    { value: 'seconds', label: 'After a set time' },
  ], adv.kind, (v) => ctx.update((d) => {
    const b = d.doc.beats[beatIndex]!;
    if (v === 'actions') delete b.advance;
    else b.advance = { kind: 'seconds', seconds: 1 };
  }))));
  if (adv.kind === 'seconds') {
    sec.append(field('Seconds', numberInput(ui, adv.seconds, (n) => ctx.update((d) => { d.doc.beats[beatIndex]!.advance = { kind: 'seconds', seconds: Math.max(0, n) }; }), { step: 0.1, min: 0 })));
  }
  return sec;
}

export function renderBeatInspector(ctx: EditorContext, container: HTMLElement): void {
  const { ui, session, sel } = ctx;
  const data = session.data;
  container.innerHTML = '';
  if (sel.beatIndex === -1 && data.kind === 'story') {
    container.append(h('p', { class: 'cse-hint', text: 'Opening setup: drag characters and props on the stage to set where everyone starts. Starting camera, location and props live in the Scene and Location tabs.' }));
    return;
  }
  const beat = data.doc.beats[sel.beatIndex];
  if (!beat) {
    container.append(h('p', { class: 'cse-hint', text: 'Add a beat to get started.' }));
    return;
  }
  const i = sel.beatIndex;
  const total = data.doc.beats.length;
  const move = (delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= total) return;
    ctx.update((d) => {
      const [b] = d.doc.beats.splice(i, 1);
      d.doc.beats.splice(j, 0, b!);
    });
    ctx.select({ beatIndex: j });
  };
  container.append(h('div', { class: 'cse-inspector-head' },
    h('strong', { text: `Beat ${i + 1} of ${total}` }),
    row(
      button(ui, '▲', () => move(-1), { kind: 'chip', title: 'Move up', disabled: i === 0 }),
      button(ui, '▼', () => move(1), { kind: 'chip', title: 'Move down', disabled: i === total - 1 }),
      button(ui, 'Duplicate', () => {
        ctx.update((d) => {
          const copy = JSON.parse(JSON.stringify(d.doc.beats[i])) as Beat;
          copy.id = newBeatId(d);
          d.doc.beats.splice(i + 1, 0, copy);
        });
        ctx.select({ beatIndex: i + 1 });
      }, { kind: 'chip' }),
      button(ui, 'Delete', () => {
        ctx.update((d) => { d.doc.beats.splice(i, 1); });
        ctx.select({ beatIndex: Math.min(i, total - 2), actionIndex: null });
      }, { kind: 'danger', testid: 'cse-delete-beat' }),
      button(ui, '▶ Preview from here', () => ctx.previewFrom(i), { kind: 'primary', testid: 'cse-preview-from-beat' })
    )));

  if (data.kind === 'story') {
    container.append(field('Type', segmented(ui, [
      { value: 'dialogue', label: '💬 Dialogue' },
      { value: 'silent', label: '🎬 Silent' },
    ], beat.say ? 'dialogue' : 'silent', (v) => ctx.update((d) => {
      const b = d.doc.beats[i]!;
      if (v === 'silent') {
        delete b.say;
        delete b.waitForActions;
      } else if (!b.say) {
        b.say = { speaker: d.doc.cast[0]?.id ?? NARRATOR_SPEAKER_ID, emotion: 'Normal', side: 'auto', text: '' };
        delete b.advance;
      }
    }))));
  }

  container.append(beat.say ? dialogueSection(ctx, beat, i) : silentSection(ctx, beat, i));
  if (data.kind === 'story') container.append(actionsSection(ctx, beat, i));
  container.append(section('Music', musicEditor(ctx, beat, i)));
  container.append(section('Sound as the beat starts', mediaPicker(ui, 'sfx', beat.sound, (f) => ctx.update((d) => {
    const b = d.doc.beats[i]!;
    if (f) b.sound = f;
    else delete b.sound;
  }), { toast: ctx.toast, canSave: ctx.canSave })));
  container.append(section('Show this beat only if…', showIfEditor(ctx, beat, i)));
}

function actionsSection(ctx: EditorContext, beat: Beat, beatIndex: number): HTMLElement {
  const { ui, sel } = ctx;
  const data = ctx.session.data;
  const story = data.kind === 'story' ? data : null;
  const sec = section('Stage actions');
  const actions = beat.actions ?? [];
  if (actions.length === 0) sec.append(h('p', { class: 'cse-hint', text: 'Nothing moves yet. Add an action, or drag a character on the stage to make them walk.' }));
  const list = h('ol', { class: 'cse-action-list', 'data-testid': 'cse-action-list' });
  actions.forEach((a, ai) => {
    const item = h('li', { class: `cse-action-item${sel.actionIndex === ai ? ' is-selected' : ''}` },
      h('span', { class: 'cse-action-icon', text: actionInfo(a.type).icon }),
      h('span', { class: 'cse-action-text', text: summarizeAction(a, ctx.nameOf) }),
      button(ui, '▲', () => {
        if (ai === 0) return;
        ctx.update((d) => {
          const list2 = d.doc.beats[beatIndex]!.actions!;
          [list2[ai - 1], list2[ai]] = [list2[ai]!, list2[ai - 1]!];
        });
        ctx.select({ actionIndex: ai - 1 });
      }, { kind: 'chip', title: 'Move up', disabled: ai === 0 }),
      button(ui, '✕', () => {
        ctx.update((d) => { d.doc.beats[beatIndex]!.actions!.splice(ai, 1); });
        ctx.select({ actionIndex: null });
      }, { kind: 'chip', title: 'Remove' }));
    item.addEventListener('pointerup', (ev) => {
      if ((ev.target as HTMLElement).closest('button')) return;
      ctx.select({ actionIndex: sel.actionIndex === ai ? null : ai });
    }, { signal: ui.signal });
    list.append(item);
  });
  sec.append(list);

  const addOptions = [{ value: '' as StageActionType | '', label: '+ Add action…' }, ...ACTION_TYPES.map((t) => ({ value: t.type as StageActionType | '', label: `${t.icon} ${t.label}`, group: t.group }))];
  sec.append(selectInput(ui, addOptions, '', (v) => {
    if (!v || !story) return;
    const castFirst = ctx.sel.castId ?? story.doc.cast.find((c) => !c.offStage)?.id;
    const firstProp = story.doc.props?.[0]?.id;
    const action = createDefaultAction(v, { firstCast: castFirst, firstProp, locationId: story.doc.location, camera: story.doc.camera });
    if (action.type === 'location') {
      action.placements = story.doc.placements.map((p) => ({ ...p }));
      action.camera = { ...story.doc.camera };
    }
    const newIndex = beat.actions?.length ?? 0;
    ctx.update((d) => {
      const b = d.doc.beats[beatIndex]!;
      b.actions = [...(b.actions ?? []), action];
    });
    ctx.select({ actionIndex: newIndex });
  }, 'cse-add-action'));

  const selected = sel.actionIndex !== null ? actions[sel.actionIndex] : undefined;
  if (selected && sel.actionIndex !== null) sec.append(actionEditor(ctx, selected, beatIndex, sel.actionIndex));
  return sec;
}

function actionEditor(ctx: EditorContext, action: StageAction, beatIndex: number, actionIndex: number): HTMLElement {
  const { ui } = ctx;
  const story = ctx.session.story!;
  const set = (fn: (a: StageAction) => void, coalesce?: string) =>
    ctx.update((d) => {
      fn(d.doc.beats[beatIndex]!.actions![actionIndex]!);
    }, coalesce ? { coalesce } : undefined);
  const box = h('div', { class: 'cse-action-editor', 'data-testid': 'cse-action-editor' }, h('h5', { text: `${actionInfo(action.type).icon} ${actionInfo(action.type).label}` }));

  if ('who' in action && action.type !== 'follow') {
    box.append(field('Who', selectInput(ui, castOptions(ctx, true), action.who, (v) => set((a) => { (a as { who: string }).who = v; }))));
  }

  switch (action.type) {
    case 'walk': {
      box.append(h('p', { class: 'cse-hint', text: 'Tap tiles on the stage to add steps (straight lines between them), or drag the character to its destination.' }));
      box.append(h('div', { class: 'cse-path-readout', text: action.path.length ? action.path.map((p) => `(${p[0]}, ${p[1]})`).join(' → ') : 'No steps yet' }));
      box.append(row(
        button(ui, 'Remove last step', () => set((a) => { (a as { path: unknown[] }).path.pop(); }), { kind: 'chip', disabled: !action.path.length }),
        button(ui, 'Clear path', () => set((a) => { (a as { path: unknown[] }).path = []; }), { kind: 'chip', disabled: !action.path.length })
      ));
      const speedKey = typeof action.speed === 'number' ? 'custom' : (action.speed ?? 'walk');
      box.append(field('Speed', segmented(ui, [
        { value: 'slow', label: 'Slow' },
        { value: 'walk', label: 'Walk' },
        { value: 'run', label: 'Run' },
        { value: 'custom', label: 'Custom' },
      ], speedKey, (v) => set((a) => { (a as { speed?: WalkSpeed }).speed = v === 'custom' ? 3 : v; }))));
      if (typeof action.speed === 'number') box.append(field('Tiles per second', numberInput(ui, action.speed, (n) => set((a) => { (a as { speed?: WalkSpeed }).speed = Math.max(0.8, n); }), { step: 0.1, min: 0.8 })));
      box.append(field('Face at the end', selectInput(ui, facingOptions(true), action.facing ?? '', (v) => set((a) => {
        const w = a as { facing?: Facing };
        if (v) w.facing = v;
        else delete w.facing;
      }))));
      break;
    }
    case 'face':
      box.append(field('Face', selectInput(ui, [
        ...facingOptions(false),
        ...castOptions(ctx, true).filter((o) => o.value !== action.who).map((o) => ({ value: `toward:${o.value}` as Facing | '', label: `Toward ${o.label}` })),
      ], action.toward ? (`toward:${action.toward}` as Facing) : (action.facing ?? 'Down'), (v) => set((a) => {
        const f = a as { facing?: Facing; toward?: string };
        if (v.startsWith('toward:')) {
          f.toward = v.slice(7);
          delete f.facing;
        } else {
          f.facing = v as Facing;
          delete f.toward;
        }
      }))));
      break;
    case 'emote':
      box.append(field('Bubble', selectInput(ui, EMOTE_KINDS.map((e) => ({ value: e, label: EMOTE_LABELS[e] })), action.emote, (v: EmoteKind) => set((a) => { (a as { emote: EmoteKind }).emote = v; }))));
      box.append(field('Shown for (s)', numberInput(ui, action.duration ?? 1.35, (n) => set((a) => { (a as { duration?: number }).duration = Math.max(0.4, n); }), { step: 0.05, min: 0.4 })));
      break;
    case 'pose': {
      const animSelect = selectInput(ui, [{ value: action.anim, label: action.anim }], action.anim, (v) => set((a) => { (a as { anim: string }).anim = v; }), 'cse-pose-select');
      const vis = ctx.visualKeyOf(action.who);
      if (vis) {
        void listSpriteAnimationNames(vis).then((names) => {
          const all = Array.from(new Set(['Attack', 'Special', 'Hurt', 'Idle', ...names]));
          animSelect.innerHTML = '';
          for (const n of all) animSelect.append(h('option', { value: n, text: n }));
          animSelect.value = action.anim;
        });
      }
      box.append(field('Animation', animSelect, 'Every animation this Pokémon has in the sprite collection.'));
      box.append(checkbox(ui, 'Hold until changed (sleeping, sitting…)', Boolean(action.hold), (v) => set((a) => {
        const p = a as { hold?: boolean };
        if (v) p.hold = true;
        else delete p.hold;
      })));
      if (!action.hold) box.append(field('Length (s, blank = one play)', numberInput(ui, action.duration, (n) => set((a) => { (a as { duration?: number }).duration = Math.max(0.2, n); }), { step: 0.05, min: 0.2 })));
      break;
    }
    case 'hop':
      box.append(field('Hops', segmented(ui, [{ value: '1', label: 'Once' }, { value: '2', label: 'Twice' }], String(action.count ?? 1), (v) => set((a) => { (a as { count?: 1 | 2 }).count = v === '2' ? 2 : 1; }))));
      break;
    case 'shake':
    case 'aura':
      if (action.type === 'aura') box.append(field('Color', (() => {
        const input = h('input', { type: 'color', class: 'cse-input cse-input--color' });
        input.value = action.color ?? '#ffe066';
        input.addEventListener('change', () => set((a) => { (a as { color?: string }).color = input.value; }), { signal: ui.signal });
        return input;
      })()));
      box.append(field('Duration (s)', numberInput(ui, action.duration ?? (action.type === 'aura' ? 0.95 : 0.42), (n) => set((a) => { (a as { duration?: number }).duration = Math.max(0.12, n); }), { step: 0.05 })));
      break;
    case 'show':
      box.append(field('Make them', segmented(ui, [{ value: 'show', label: 'Appear' }, { value: 'hide', label: 'Disappear' }], action.visible ? 'show' : 'hide', (v) => set((a) => { (a as { visible: boolean }).visible = v === 'show'; }))));
      box.append(checkbox(ui, 'Fade in/out', Boolean(action.fade), (v) => set((a) => { (a as { fade?: boolean }).fade = v || undefined; })));
      break;
    case 'place':
      box.append(h('p', { class: 'cse-hint', text: 'Tap the stage to choose where they appear.' }));
      box.append(row(
        field('X', numberInput(ui, action.x, (n) => set((a) => { (a as { x: number }).x = n; }), { step: 0.5 })),
        field('Y', numberInput(ui, action.y, (n) => set((a) => { (a as { y: number }).y = n; }), { step: 0.5 })),
        field('Facing', selectInput(ui, facingOptions(true), action.facing ?? '', (v) => set((a) => {
          const p = a as { facing?: Facing };
          if (v) p.facing = v;
          else delete p.facing;
        })))
      ));
      break;
    case 'camera':
      box.append(h('p', { class: 'cse-hint', text: 'Tap the stage to aim the camera there.' }));
      box.append(row(
        field('X', numberInput(ui, action.x, (n) => set((a) => { (a as { x: number }).x = n; }), { step: 0.5 })),
        field('Y', numberInput(ui, action.y, (n) => set((a) => { (a as { y: number }).y = n; }), { step: 0.5 })),
        field('Pan time (s)', numberInput(ui, action.duration ?? 0.52, (n) => set((a) => { (a as { duration?: number }).duration = Math.max(0, n); }), { step: 0.05, min: 0 }))
      ));
      break;
    case 'follow':
      box.append(field('Follow', selectInput(ui, [{ value: '', label: '(stop following)' }, ...castOptions(ctx, true)], action.who ?? '', (v) => set((a) => { (a as { who: string | null }).who = v || null; }))));
      break;
    case 'fade':
      box.append(field('Fade', segmented(ui, [
        { value: 'black', label: 'To black' },
        { value: 'white', label: 'To white' },
        { value: 'clear', label: 'Back in' },
      ], action.to, (v) => set((a) => { (a as { to: 'black' | 'white' | 'clear' }).to = v; }))));
      box.append(field('Duration (s)', numberInput(ui, action.duration ?? 0.5, (n) => set((a) => { (a as { duration?: number }).duration = Math.max(0, n); }), { step: 0.05, min: 0 })));
      break;
    case 'flash':
      box.append(field('Color', segmented(ui, [{ value: 'white', label: 'White' }, { value: 'black', label: 'Black' }], action.color ?? 'white', (v) => set((a) => { (a as { color?: 'white' | 'black' }).color = v; }))));
      box.append(field('Duration (s)', numberInput(ui, action.duration ?? 0.3, (n) => set((a) => { (a as { duration?: number }).duration = Math.max(0.06, n); }), { step: 0.05 })));
      break;
    case 'screenShake':
      box.append(row(
        field('Duration (s)', numberInput(ui, action.duration ?? 0.38, (n) => set((a) => { (a as { duration?: number }).duration = Math.max(0.08, n); }), { step: 0.05 })),
        field('Strength', numberInput(ui, action.intensity ?? 2, (n) => set((a) => { (a as { intensity?: number }).intensity = Math.max(1, Math.min(6, Math.round(n))); }), { min: 1, max: 6 }))
      ));
      break;
    case 'weather':
      box.append(field('Weather', selectInput(ui, WEATHER_KINDS.map((w) => ({ value: w, label: WEATHER_LABELS[w] })), action.weather, (v: WeatherKind) => set((a) => { (a as { weather: WeatherKind }).weather = v; }))));
      break;
    case 'lighting':
      box.append(field('Lighting', selectInput(ui, LIGHTING_MOODS.map((m) => ({ value: m, label: LIGHTING_MOOD_LABELS[m] })), action.mood, (v: LightingMood) => set((a) => { (a as { mood: LightingMood }).mood = v; }))));
      box.append(field('Blend time (s)', numberInput(ui, action.duration ?? 1, (n) => set((a) => { (a as { duration?: number }).duration = Math.max(0, n); }), { step: 0.1, min: 0 })));
      break;
    case 'sound':
      box.append(field('Sound', mediaPicker(ui, 'sfx', action.sound, (f) => set((a) => { (a as { sound: string }).sound = f; }), { toast: ctx.toast, canSave: ctx.canSave })));
      break;
    case 'location':
      box.append(locationActionEditor(ctx, action, set));
      break;
    case 'prop': {
      const propIds = new Set((story.doc.props ?? []).map((p) => p.id));
      for (const b of story.doc.beats) for (const a2 of b.actions ?? []) if (a2.type === 'location') for (const p of a2.props ?? []) propIds.add(p.id);
      box.append(field('Prop', selectInput(ui, [{ value: '', label: '— pick a prop —' }, ...[...propIds].map((id) => ({ value: id, label: id }))], action.prop, (v) => set((a) => { (a as { prop: string }).prop = v; }))));
      box.append(field('Visibility', selectInput(ui, [
        { value: 'same', label: 'Leave as is' },
        { value: 'show', label: 'Show' },
        { value: 'hide', label: 'Hide' },
      ], action.visible === undefined ? 'same' : action.visible ? 'show' : 'hide', (v) => set((a) => {
        const p = a as { visible?: boolean };
        if (v === 'same') delete p.visible;
        else p.visible = v === 'show';
      }))));
      box.append(h('p', { class: 'cse-hint', text: 'Tap the stage to move the prop along a path.' }));
      box.append(h('div', { class: 'cse-path-readout', text: action.path?.length ? action.path.map((p) => `(${p[0]}, ${p[1]})`).join(' → ') : 'Not moving' }));
      box.append(button(ui, 'Clear path', () => set((a) => { delete (a as { path?: unknown }).path; }), { kind: 'chip', disabled: !action.path?.length }));
      break;
    }
  }

  box.append(h('div', { class: 'cse-timing' },
    field('Starts', segmented(ui, [
      { value: 'with', label: 'With the beat' },
      { value: 'after', label: 'After the previous action' },
    ], action.start ?? 'with', (v) => set((a) => {
      if (v === 'after') a.start = 'after';
      else delete a.start;
    }))),
    field('Extra delay (s)', numberInput(ui, action.delay ?? 0, (n) => set((a) => {
      if (n > 0) a.delay = Math.round(n * 100) / 100;
      else delete a.delay;
    }), { step: 0.05, min: 0 }))
  ));
  return box;
}

function locationActionEditor(
  ctx: EditorContext,
  action: Extract<StageAction, { type: 'location' }>,
  set: (fn: (a: StageAction) => void) => void
): HTMLElement {
  const { ui } = ctx;
  const story = ctx.session.story!;
  const wrap = h('div', { class: 'cse-stack' });
  const locOptions = Object.values(story.locations).map((l) => ({ value: l.id, label: l.name }));
  for (const l of listLocationDocs()) if (!story.locations[l.id]) locOptions.push({ value: l.id, label: l.name });
  wrap.append(field('New location', selectInput(ui, locOptions, action.location, (v) => {
    ctx.update((d) => {
      const s = d as typeof story;
      const loc = listLocationDocs().find((l) => l.id === v);
      if (loc && !s.locations[v]) s.locations[v] = JSON.parse(JSON.stringify(loc));
      const a = s.doc.beats[ctx.sel.beatIndex]!.actions![ctx.sel.actionIndex!]! as typeof action;
      a.location = v;
    });
  })));
  wrap.append(field('Transition', segmented(ui, [
    { value: 'black', label: 'Fade black' },
    { value: 'white', label: 'Fade white' },
    { value: 'cut', label: 'Instant cut' },
  ], action.transition, (v) => set((a) => { (a as typeof action).transition = v; }))));
  wrap.append(field('Location banner', textInput(ui, action.banner ?? '', (v) => set((a) => {
    const l = a as typeof action;
    if (v.trim()) l.banner = v;
    else delete l.banner;
  }), { placeholder: 'Defaults to the location name' })));
  wrap.append(row(
    field('Camera X', numberInput(ui, action.camera?.x, (n) => set((a) => { const l = a as typeof action; l.camera = { x: n, y: l.camera?.y ?? 5 }; }), { step: 0.5 })),
    field('Camera Y', numberInput(ui, action.camera?.y, (n) => set((a) => { const l = a as typeof action; l.camera = { x: l.camera?.x ?? 7, y: n }; }), { step: 0.5 }))
  ));
  wrap.append(h('p', { class: 'cse-hint', text: 'Who is there after the change? Drag them on the stage to place them. Unticked cast members are hidden.' }));
  for (const member of story.doc.cast.filter((c) => !c.offStage)) {
    const pl = action.placements.find((p) => p.id === member.id);
    wrap.append(checkbox(ui, ctx.nameOf(member.id), Boolean(pl), (v) => set((a) => {
      const l = a as typeof action;
      if (v && !l.placements.some((p) => p.id === member.id)) {
        const start = story.doc.placements.find((p) => p.id === member.id);
        l.placements.push({ id: member.id, x: start?.x ?? 1, y: start?.y ?? 1, facing: start?.facing ?? 'Down' } satisfies CastPlacement);
      } else if (!v) {
        l.placements = l.placements.filter((p) => p.id !== member.id);
      }
    })));
  }
  const props = action.props ?? [];
  wrap.append(h('p', { class: 'cse-hint', text: `Props after the change: ${props.length ? props.map((p) => p.id).join(', ') : 'none'}` }));
  wrap.append(row(
    button(ui, '+ Campfire', () => set((a) => {
      const l = a as typeof action;
      l.props = [...(l.props ?? []), { id: `campfire_${(l.props?.length ?? 0) + 1}`, kind: 'campfire', x: 3, y: 3 } satisfies PropPlacement];
    }), { kind: 'chip' }),
    button(ui, 'Clear props', () => set((a) => { delete (a as typeof action).props; }), { kind: 'chip', disabled: !props.length })
  ));
  return wrap;
}
