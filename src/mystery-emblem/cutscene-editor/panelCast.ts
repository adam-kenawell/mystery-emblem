/**
 * Cutscene Editor Cast Panel (`panelCast.ts`)
 */

import {
  FACINGS,
  type CastIdentity,
  type CastMember,
  type Facing,
} from '../data/cutscenes/cutsceneDocTypes';
import type { QuizSeedSlotKey } from '../types/schemas';
import type { EditorContext } from './editorContext';
import { button, checkbox, field, h, numberInput, row, section, selectInput, textInput } from './editorDom';
import { describeIdentity, QUIZ_SLOT_LABELS } from './editorLabels';
import { pokemonPicker, speciesOptions } from './editorPickers';
import { slugifyId, uniqueId, type SessionData } from './editorSession';

type IdentityKind = CastIdentity['kind'];

const KIND_OPTIONS: Array<{ value: IdentityKind; label: string }> = [
  { value: 'lord', label: 'Hero (your Dragon)' },
  { value: 'partner', label: 'Partner (Piplup)' },
  { value: 'healer', label: 'Healer (Flabébé)' },
  { value: 'mentor', label: 'Sir Empoleon' },
  { value: 'advisor', label: 'Wimpod / Golisopod' },
  { value: 'quiz_slot', label: 'Quiz-chosen recruit' },
  { value: 'recruit', label: 'Story recruit (fixed species)' },
  { value: 'party_extra', label: 'Extra party member #N' },
  { value: 'npc', label: 'Any Pokémon (NPC with a name)' },
];

function defaultIdentity(kind: IdentityKind): CastIdentity {
  switch (kind) {
    case 'quiz_slot':
      return { kind, slot: 'slot1Flying', fallbackSpeciesId: 'pidgey' };
    case 'recruit':
      return { kind, speciesId: 'duskull' };
    case 'party_extra':
      return { kind, slotIndex: 0 };
    case 'npc':
      return { kind, pokemon: '0497', name: 'King Serperior', speciesName: 'Serperior' };
    default:
      return { kind } as CastIdentity;
  }
}

/** Renames a cast id everywhere it's referenced. */
export function renameCastId(data: SessionData, from: string, to: string): void {
  const doc = data.doc;
  for (const c of doc.cast) if (c.id === from) c.id = to;
  for (const beat of doc.beats) {
    if (beat.say?.speaker === from) beat.say.speaker = to;
    if (beat.say) beat.say.text = beat.say.text.split(`{name:${from}}`).join(`{name:${to}}`);
    for (const cond of beat.showIf ?? []) if (cond.kind === 'in_party' && cond.cast === from) cond.cast = to;
    for (const a of beat.actions ?? []) {
      if ('who' in a && a.who === from) (a as { who: string }).who = to;
      if (a.type === 'face' && a.toward === from) a.toward = to;
      if (a.type === 'location') for (const p of a.placements) if (p.id === from) p.id = to;
    }
  }
  if (data.kind === 'story') for (const p of data.doc.placements) if (p.id === from) p.id = to;
}

function castUsage(data: SessionData, id: string): number {
  let n = 0;
  for (const beat of data.doc.beats) {
    if (beat.say?.speaker === id) n++;
    for (const a of beat.actions ?? []) if (('who' in a && a.who === id) || (a.type === 'face' && a.toward === id)) n++;
  }
  return n;
}

function identityEditor(ctx: EditorContext, member: CastMember, index: number): HTMLElement {
  const { ui } = ctx;
  const who = member.who;
  const setWho = (next: CastIdentity) => ctx.update((d) => { d.doc.cast[index]!.who = next; });
  const wrap = h('div', { class: 'cse-stack' });
  wrap.append(field('Who is this?', selectInput(ui, KIND_OPTIONS, who.kind, (k) => setWho(defaultIdentity(k)))));
  if (who.kind === 'quiz_slot') {
    wrap.append(field('Quiz slot', selectInput(ui, Object.entries(QUIZ_SLOT_LABELS).map(([value, label]) => ({ value: value as QuizSeedSlotKey, label })), who.slot, (slot) => setWho({ ...who, slot }))));
    wrap.append(field('Preview / fallback species', selectInput(ui, speciesOptions((f) => f === 'playable'), who.fallbackSpeciesId ?? '', (sp) => setWho({ ...who, fallbackSpeciesId: sp }))));
  } else if (who.kind === 'recruit') {
    wrap.append(field('Species', selectInput(ui, speciesOptions((f) => f === 'playable'), who.speciesId, (sp) => setWho({ ...who, speciesId: sp })), 'Shows their nickname once recruited.'));
  } else if (who.kind === 'party_extra') {
    wrap.append(field('Party slot (beyond the core five)', numberInput(ui, who.slotIndex + 1, (n) => setWho({ ...who, slotIndex: Math.max(0, Math.round(n) - 1) }), { min: 1, max: 12 }), 'Hidden when the party is smaller.'));
  } else if (who.kind === 'npc') {
    wrap.append(field('Pokémon', pokemonPicker(ui, who.pokemon, (pokemon, name) => setWho({ ...who, pokemon, speciesName: name }))));
    wrap.append(field('Display name', textInput(ui, who.name, (v) => ctx.update((d) => {
      const w = d.doc.cast[index]!.who;
      if (w.kind === 'npc') w.name = v;
    }, { coalesce: `npcname:${member.id}`, keepInspector: true }))));
  }
  return wrap;
}

export function renderCastPanel(ctx: EditorContext, container: HTMLElement): void {
  const { ui, session } = ctx;
  const data = session.data;
  container.innerHTML = '';
  container.append(h('p', { class: 'cse-hint', text: 'Everyone who appears or speaks. Drag characters on the stage (Opening setup) to set where they start.' }));

  data.doc.cast.forEach((member, index) => {
    const placement = data.kind === 'story' ? data.doc.placements.find((p) => p.id === member.id) : undefined;
    const selected = ctx.sel.castId === member.id;
    const card = h('div', { class: `cse-cast-card${selected ? ' is-selected' : ''}`, 'data-testid': `cse-cast-${member.id}` });
    card.append(h('div', { class: 'cse-cast-head' },
      h('strong', { text: ctx.nameOf(member.id) }),
      h('span', { class: 'cse-hint', text: describeIdentity(member.who) }),
      button(ui, selected ? 'Close' : 'Edit', () => ctx.select({ castId: selected ? null : member.id }), { kind: 'chip' })));
    if (selected) {
      const idInput = textInput(ui, member.id, () => {}, { testid: 'cse-cast-id' });
      idInput.addEventListener('change', () => {
        const next = slugifyId(idInput.value, member.id);
        if (next === member.id) return;
        if (data.doc.cast.some((c) => c.id === next)) {
          ctx.toast(`"${next}" is already used`);
          idInput.value = member.id;
          return;
        }
        ctx.update((d) => renameCastId(d, member.id, next));
        ctx.select({ castId: next });
      }, { signal: ui.signal });
      card.append(field('Id (used in the file)', idInput));
      card.append(identityEditor(ctx, member, index));
      if (data.kind === 'story') {
        card.append(checkbox(ui, 'Off-stage voice (no sprite)', Boolean(member.offStage), (v) => ctx.update((d) => {
          const c = d.doc.cast[index]!;
          if (v) c.offStage = true;
          else delete c.offStage;
        })));
        if (!member.offStage) {
          const setPlacement = (fn: (p: { x: number; y: number; facing: Facing; hidden?: boolean }) => void) => ctx.update((d) => {
            if (d.kind !== 'story') return;
            let p = d.doc.placements.find((pl) => pl.id === member.id);
            if (!p) {
              p = { id: member.id, x: Math.floor(d.doc.camera.x), y: Math.floor(d.doc.camera.y), facing: 'Down' };
              d.doc.placements.push(p);
            }
            fn(p);
          });
          if (!placement) {
            card.append(button(ui, 'Place on stage', () => setPlacement(() => {}), { kind: 'chip' }));
          } else {
            card.append(row(
              field('Start X', numberInput(ui, placement.x, (n) => setPlacement((p) => { p.x = n; }), { step: 0.5 })),
              field('Start Y', numberInput(ui, placement.y, (n) => setPlacement((p) => { p.y = n; }), { step: 0.5 })),
              field('Facing', selectInput(ui, FACINGS.map((f) => ({ value: f, label: f })), placement.facing, (v) => setPlacement((p) => { p.facing = v; })))
            ));
            card.append(checkbox(ui, 'Starts hidden (appears later with Show)', Boolean(placement.hidden), (v) => setPlacement((p) => {
              if (v) p.hidden = true;
              else delete p.hidden;
            })));
          }
        }
      }
      const uses = castUsage(data, member.id);
      card.append(button(ui, 'Remove from cast', () => {
        if (uses > 0 && !window.confirm(`${ctx.nameOf(member.id)} is used ${uses} time(s). Remove anyway? Those lines/actions will show as errors.`)) return;
        ctx.update((d) => {
          d.doc.cast.splice(index, 1);
          if (d.kind === 'story') d.doc.placements = d.doc.placements.filter((p) => p.id !== member.id);
        });
        ctx.select({ castId: null });
      }, { kind: 'danger' }));
    }
    container.append(card);
  });

  const addMember = (kind: IdentityKind) => {
    const who = defaultIdentity(kind);
    const base = kind === 'npc' ? 'npc' : kind === 'recruit' ? (who as { speciesId: string }).speciesId : kind;
    const id = uniqueId(base, (candidate) => session.data.doc.cast.some((c) => c.id === candidate));
    ctx.update((d) => {
      d.doc.cast.push({ id, who });
      if (d.kind === 'story') d.doc.placements.push({ id, x: Math.floor(d.doc.camera.x), y: Math.floor(d.doc.camera.y), facing: 'Down' });
    });
    ctx.select({ castId: id });
  };
  container.append(section('Add to cast', selectInput(ui, [{ value: '' as IdentityKind | '', label: '+ Add a character…' }, ...KIND_OPTIONS.map((o) => ({ ...o, value: o.value as IdentityKind | '' }))], '', (k) => {
    if (k) addMember(k);
  }, 'cse-add-cast')));
}
