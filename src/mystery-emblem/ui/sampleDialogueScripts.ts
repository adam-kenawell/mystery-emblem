import type { DialogueScript } from './DialogueOverlay';

export const PROLOGUE_AWAKENING_TEST_SCRIPT: DialogueScript = {
  id: 'step2_prologue_awakening_preview',
  title: 'Prologue: Washed Ashore at Beach Cave',
  bgm: 'beach_at_dusk',
  lines: [
    {
      speaker: { kind: 'partner' },
      side: 'right',
      emotion: 'Worried',
      bgm: 'beach_at_dusk', // 004. On the Beach at Dusk
      text: 'Hold on, {healer}! Someone washed up on the sand after last night’s storm...',
    },
    {
      speaker: { kind: 'lord' },
      side: 'left',
      emotion: 'Pain',
      text: 'Ugh... my head is spinning. Where am I?',
    },
    {
      speaker: { kind: 'healer' },
      side: 'right',
      emotion: 'Surprised',
      bgm: 'growing_anxiety', // 016. Growing Anxiety
      text: 'Whoa—you’re awake! Careful, {lord}, Ironscale scouts were spotted along the bluff!',
    },
    {
      speaker: { kind: 'species', speciesId: 'sandile', nickname: 'Scout Sandile' },
      side: 'right',
      emotion: 'Angry',
      bgm: 'oh_no', // 017. Oh No!
      text: 'Found ’em! Hand over your supplies in the name of Emperor Kingambit!',
    },
    {
      speaker: { kind: 'lord' },
      side: 'left',
      emotion: 'Sad',
      text: 'I can’t remember my past... yet I won’t let you hurt those who saved me.',
    },
    {
      speaker: { kind: 'lord' },
      side: 'left',
      emotion: 'Determined',
      bgm: 'boss_battle', // 019. Boss Battle!
      sfx: 'select',
      text: 'What is this golden crest burning in my chest?! Stand behind me, {partner}!',
    },
    {
      speaker: { kind: 'partner' },
      side: 'right',
      emotion: 'Happy',
      text: 'We fight side-by-side, {lord}! Let’s push these raiders off the beach!',
    },
    {
      speaker: { kind: 'npc', pmdAssetId: '0497', speciesName: 'Serperior', nickname: 'Chancellor Serperior' },
      side: 'right',
      emotion: 'Normal',
      bgm: 'time_gear_remix', // 020. Time Gear Remix
      text: 'Unmistakable... After all these years, the royal Dragon Aura shines once more.',
    },
  ],
};
