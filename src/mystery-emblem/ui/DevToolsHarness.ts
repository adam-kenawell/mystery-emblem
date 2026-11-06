/**
 * Admin-Only Step 2 Dev Tools Harness (`adam.kenawell.family@gmail.com`)
 *
 * Houses all developer-facing Step 2 verification controls so the public player UI remains clean:
 * - Tab 1 (`audit`): Step 1 Registry & Faction Audit + Cloud Firestore Sync Diagnostics
 * - Tab 2 (`sprites`): 8-Directional Sprite Animator (`Idle`, `Walk`, `Attack`, `Special`, `Hurt`),
 *   8-Emotion Portrait Strip (`Normal`..`Sad` + Left/Right Mirror), Evolutionary Line Stage Swapper,
 *   and Live Active Party Unit Stage Promotion
 * - Tab 3 (`dialogue`): `DIALOGUE_OVERLAY` Multi-Emotion Cutscene & Live Stage-Swap Test Launcher
 */

import {
  PMD_DIRECTION_INFO,
  PMD_PORTRAIT_EMOTIONS,
  PMD_SPRITE_ACTIONS,
  type PmdDirection,
  type PmdPortraitEmotion,
  type PmdSpriteAction,
} from '../assets/pmdAssetLoader';
import {
  getAudioManager,
  type AudioManager,
} from '../audio/AudioManager';
import {
  POKEMON_SPECIES_LIST,
  getSpeciesById,
  getSpeciesByLineId,
} from '../data/index';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { DialogueOverlay } from './DialogueOverlay';
import { PmdPortraitView, PmdSpriteActor } from './PmdSpriteCanvas';
import { bindPointerTap } from './pointerControls';
import { PROLOGUE_AWAKENING_TEST_SCRIPT } from './sampleDialogueScripts';

export type DevToolsSubTab = 'audit' | 'sprites' | 'dialogue' | 'skirmish';

const QUICK_LINE_PRESETS: ReadonlyArray<{ label: string; speciesId: string }> = [
  { label: 'Dratini Line', speciesId: 'dratini' },
  { label: 'Bulbasaur Line', speciesId: 'bulbasaur' },
  { label: 'Eevee (8-Way)', speciesId: 'eevee' },
  { label: 'Pidove (WIP Test)', speciesId: 'pidove' },
  { label: 'G-Mime (Nested)', speciesId: 'mime_jr_galar' },
  { label: 'Kingambit Boss', speciesId: 'pawniard' },
];

export interface DevToolsHarnessOptions {
  modalEl: HTMLElement;
  saveManager: SaveStateManager;
  dialogueOverlay: DialogueOverlay;
  audioManager?: AudioManager;
  onLaunchTestDungeon?: () => void;
  onLaunchBattle?: () => void;
  signal: AbortSignal;
}

export class DevToolsHarness {
  private readonly modalEl: HTMLElement;
  private readonly saveManager: SaveStateManager;
  private readonly dialogueOverlay: DialogueOverlay;
  private readonly audioManager: AudioManager;
  private readonly onLaunchTestDungeon?: () => void;
  private readonly onLaunchBattle?: () => void;
  private readonly signal: AbortSignal;

  private activeSubTab: DevToolsSubTab = 'audit';
  private selectedSpeciesId = 'dratini';
  private selectedAction: PmdSpriteAction = 'Idle';
  private selectedDirection: PmdDirection = 0;
  private mirrorPortraits = false;
  private instantDialogue = false;

  private previewSpriteActor: PmdSpriteActor | null = null;
  private readonly portraitViews = new Map<PmdPortraitEmotion, PmdPortraitView>();
  private readonly portraitMetaEls = new Map<PmdPortraitEmotion, HTMLElement>();
  private unsubscribeAudio: (() => void) | null = null;

  private speciesSelectEl: HTMLSelectElement | null = null;
  private stageButtonsRow: HTMLElement | null = null;
  private spriteMetaEl: HTMLElement | null = null;
  private rosterStageBox: HTMLElement | null = null;
  private dialogueStatusEl: HTMLElement | null = null;

  constructor(options: DevToolsHarnessOptions) {
    this.modalEl = options.modalEl;
    this.saveManager = options.saveManager;
    this.dialogueOverlay = options.dialogueOverlay;
    this.audioManager = options.audioManager ?? getAudioManager();
    this.onLaunchTestDungeon = options.onLaunchTestDungeon;
    this.onLaunchBattle = options.onLaunchBattle;
    this.signal = options.signal;

    this.mountControls();
  }

  public destroy(): void {
    this.previewSpriteActor?.destroy();
    this.previewSpriteActor = null;
    if (this.unsubscribeAudio) {
      this.unsubscribeAudio();
      this.unsubscribeAudio = null;
    }
    this.portraitViews.clear();
    this.portraitMetaEls.clear();
  }

  public getPreviewActor(): PmdSpriteActor | null {
    return this.previewSpriteActor;
  }

  public switchSubTab(tab: DevToolsSubTab): void {
    this.activeSubTab = tab;
    this.modalEl.querySelectorAll<HTMLElement>('[data-devtab-btn]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.devtabBtn === tab);
    });
    this.modalEl.querySelectorAll<HTMLElement>('[data-devtab-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.devtabPanel !== tab;
    });

    if (tab === 'sprites') {
      void this.refreshSpriteAndPortraits();
      this.renderActiveRosterStageControls();
    } else if (tab === 'dialogue') {
      this.renderDialogueTabSummary();
    }
  }

  public onSaveChanged(): void {
    if (this.activeSubTab === 'sprites') {
      this.renderActiveRosterStageControls();
    } else if (this.activeSubTab === 'dialogue') {
      this.renderDialogueTabSummary();
    }
  }

  public async selectSpecies(speciesId: string): Promise<void> {
    if (!getSpeciesById(speciesId)) return;
    this.selectedSpeciesId = speciesId;
    if (this.speciesSelectEl) {
      this.speciesSelectEl.value = speciesId;
    }
    this.renderStageButtons();
    await this.refreshSpriteAndPortraits();
  }

  private mountControls(): void {
    // Sub-tab navigation buttons
    this.modalEl.querySelectorAll<HTMLElement>('[data-devtab-btn]').forEach((btn) => {
      bindPointerTap(
        btn,
        () => {
          const tab = btn.dataset.devtabBtn as DevToolsSubTab | undefined;
          if (tab) this.switchSubTab(tab);
        },
        { signal: this.signal }
      );
    });

    // --- TAB 2: SPRITES & STAGES ---
    const presetRow = this.modalEl.querySelector<HTMLElement>('#devtools-line-presets');
    if (presetRow) {
      presetRow.innerHTML = '';
      for (const preset of QUICK_LINE_PRESETS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pmd-btn pmd-chip-btn';
        btn.dataset.testid = `devtools-preset-${preset.speciesId}`;
        btn.textContent = preset.label;
        bindPointerTap(btn, () => void this.selectSpecies(preset.speciesId), {
          signal: this.signal,
        });
        presetRow.appendChild(btn);
      }
    }

    this.speciesSelectEl = this.modalEl.querySelector<HTMLSelectElement>('#devtools-species-select');
    if (this.speciesSelectEl) {
      this.speciesSelectEl.innerHTML = '';
      for (const sp of POKEMON_SPECIES_LIST) {
        const opt = document.createElement('option');
        opt.value = sp.id;
        opt.textContent = `#${String(sp.dexNumber).padStart(4, '0')} ${sp.name} (Stage ${sp.stage} · ${sp.pmdAssetId})`;
        this.speciesSelectEl.appendChild(opt);
      }
      this.speciesSelectEl.value = this.selectedSpeciesId;
      this.speciesSelectEl.addEventListener(
        'change',
        () => {
          if (this.speciesSelectEl) {
            void this.selectSpecies(this.speciesSelectEl.value);
          }
        },
        { signal: this.signal }
      );
    }

    this.stageButtonsRow = this.modalEl.querySelector<HTMLElement>('#devtools-stage-buttons');
    this.spriteMetaEl = this.modalEl.querySelector<HTMLElement>('#devtools-sprite-meta');
    this.rosterStageBox = this.modalEl.querySelector<HTMLElement>('#devtools-roster-evo-box');

    const spriteMount = this.modalEl.querySelector<HTMLElement>('#devtools-sprite-stage');
    if (spriteMount) {
      spriteMount.innerHTML = '';
      this.previewSpriteActor = new PmdSpriteActor({
        speciesIdOrAssetId: this.selectedSpeciesId,
        initialAction: this.selectedAction,
        initialDirection: this.selectedDirection,
        testId: 'devtools-sprite-canvas',
      });
      spriteMount.appendChild(this.previewSpriteActor.canvas);
    }

    const actionsRow = this.modalEl.querySelector<HTMLElement>('#devtools-action-buttons');
    if (actionsRow) {
      actionsRow.innerHTML = '';
      for (const act of PMD_SPRITE_ACTIONS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `pmd-btn pmd-chip-btn${act === this.selectedAction ? ' is-active' : ''}`;
        btn.dataset.testid = `devtools-action-${act}`;
        btn.dataset.action = act;
        btn.textContent = act;
        bindPointerTap(
          btn,
          () => {
            this.selectedAction = act;
            actionsRow.querySelectorAll<HTMLElement>('[data-action]').forEach((b) => {
              b.classList.toggle('is-active', b.dataset.action === act);
            });
            this.previewSpriteActor?.setAction(act, { loop: true });
            this.updateSpriteMetaText();
          },
          { signal: this.signal }
        );
        actionsRow.appendChild(btn);
      }
    }

    const dirsRow = this.modalEl.querySelector<HTMLElement>('#devtools-direction-buttons');
    if (dirsRow) {
      dirsRow.innerHTML = '';
      for (const info of PMD_DIRECTION_INFO) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `pmd-btn pmd-chip-btn${info.dir === this.selectedDirection ? ' is-active' : ''}`;
        btn.dataset.testid = `devtools-dir-${info.code}`;
        btn.dataset.dir = String(info.dir);
        btn.textContent = info.code;
        bindPointerTap(
          btn,
          () => {
            this.selectedDirection = info.dir;
            dirsRow.querySelectorAll<HTMLElement>('[data-dir]').forEach((b) => {
              b.classList.toggle('is-active', Number(b.dataset.dir) === info.dir);
            });
            this.previewSpriteActor?.setDirection(info.dir);
            this.updateSpriteMetaText();
          },
          { signal: this.signal }
        );
        dirsRow.appendChild(btn);
      }
    }

    const mirrorBtn = this.modalEl.querySelector<HTMLButtonElement>('#devtools-portrait-mirror-btn');
    bindPointerTap(
      mirrorBtn,
      () => {
        this.mirrorPortraits = !this.mirrorPortraits;
        if (mirrorBtn) {
          mirrorBtn.textContent = this.mirrorPortraits
            ? 'Facing: Right Slot (Mirrored)'
            : 'Facing: Left Slot (Default)';
          mirrorBtn.classList.toggle('is-active', this.mirrorPortraits);
        }
        for (const pv of this.portraitViews.values()) {
          pv.setMirrored(this.mirrorPortraits);
        }
      },
      { signal: this.signal }
    );

    const portraitGrid = this.modalEl.querySelector<HTMLElement>('#devtools-portrait-grid');
    if (portraitGrid) {
      portraitGrid.innerHTML = '';
      for (const emotion of PMD_PORTRAIT_EMOTIONS) {
        const cell = document.createElement('div');
        cell.className = 'pmd-devtools-portrait-cell';
        const pv = new PmdPortraitView({
          testId: `devtools-portrait-${emotion}`,
        });
        const label = document.createElement('span');
        label.className = 'pmd-devtools-portrait-label';
        label.textContent = emotion;
        const meta = document.createElement('span');
        meta.className = 'pmd-devtools-portrait-sub';
        meta.dataset.testid = `devtools-portrait-meta-${emotion}`;
        meta.textContent = '—';

        this.portraitViews.set(emotion, pv);
        this.portraitMetaEls.set(emotion, meta);
        cell.append(pv.canvas, label, meta);
        portraitGrid.appendChild(cell);
      }
    }

    // --- TAB 3: DIALOGUE TEST ---
    this.dialogueStatusEl = this.modalEl.querySelector<HTMLElement>('#devtools-dialogue-status');

    const btnLaunchDialogue = this.modalEl.querySelector<HTMLButtonElement>(
      '#devtools-launch-dialogue'
    );
    bindPointerTap(
      btnLaunchDialogue,
      () => {
        void this.dialogueOverlay
          .playScript(PROLOGUE_AWAKENING_TEST_SCRIPT, {
            typewriterMsPerChar: this.instantDialogue ? 0 : 10,
          })
          .then((reason) => {
            if (this.dialogueStatusEl) {
              this.dialogueStatusEl.textContent = `Last run finished: ${reason}`;
            }
          });
      },
      { signal: this.signal }
    );

    const btnInstantToggle = this.modalEl.querySelector<HTMLButtonElement>(
      '#devtools-instant-dialogue-toggle'
    );
    bindPointerTap(
      btnInstantToggle,
      () => {
        this.instantDialogue = !this.instantDialogue;
        if (btnInstantToggle) {
          btnInstantToggle.textContent = this.instantDialogue
            ? 'Text Reveal: Instant (0ms)'
            : 'Text Reveal: Typewriter';
          btnInstantToggle.classList.toggle('is-active', this.instantDialogue);
        }
      },
      { signal: this.signal }
    );

    const btnCycleLord = this.modalEl.querySelector<HTMLButtonElement>(
      '#devtools-cycle-lord-stage'
    );
    bindPointerTap(
      btnCycleLord,
      () => {
        const save = this.saveManager.getSave();
        const lord =
          save?.roster.find((u) => u.instanceId === save.campaign.lordInstanceId) ??
          save?.roster[0];
        if (!lord) {
          if (this.dialogueStatusEl) {
            this.dialogueStatusEl.textContent =
              'Start a New Game first to cycle the active Lord’s evolution stage.';
          }
          return;
        }
        const curSp = getSpeciesById(lord.speciesId);
        if (!curSp) return;
        const stages = getSpeciesByLineId(curSp.lineId).filter((s) => s.faction !== 'enemy');
        const idx = stages.findIndex((s) => s.id === curSp.id);
        const nextStage = stages[(idx + 1) % stages.length];
        if (nextStage) {
          this.saveManager.evolveUnitToSpecies(lord.instanceId, nextStage.id);
          this.renderDialogueTabSummary();
          if (this.dialogueStatusEl) {
            this.dialogueStatusEl.textContent = `Evolved ${lord.nickname} -> ${nextStage.name} (Stage ${nextStage.stage}).`;
          }
        }
      },
      { signal: this.signal }
    );

    // --- AUDIO ENGINE & JUKEBOX HARNESS ---
    const bgmSelectEl = this.modalEl.querySelector<HTMLSelectElement>('#devtools-bgm-select');
    const audioStatusEl = this.modalEl.querySelector<HTMLElement>('#devtools-audio-status');
    const btnBgmPlay = this.modalEl.querySelector<HTMLButtonElement>('#devtools-bgm-play');
    const btnBgmStop = this.modalEl.querySelector<HTMLButtonElement>('#devtools-bgm-stop');
    const btnAudioMute = this.modalEl.querySelector<HTMLButtonElement>('#devtools-audio-mute');
    const btnSfxSelect = this.modalEl.querySelector<HTMLButtonElement>('#devtools-sfx-select');
    const btnSfxCancel = this.modalEl.querySelector<HTMLButtonElement>('#devtools-sfx-cancel');
    const btnSfxAdvance = this.modalEl.querySelector<HTMLButtonElement>('#devtools-sfx-advance');
    const bgmVolInput = this.modalEl.querySelector<HTMLInputElement>('#devtools-bgm-volume');
    const sfxVolInput = this.modalEl.querySelector<HTMLInputElement>('#devtools-sfx-volume');

    if (bgmSelectEl) {
      bgmSelectEl.innerHTML = '';
      for (const track of this.audioManager.getAvailableTracks()) {
        const opt = document.createElement('option');
        opt.value = track.id;
        opt.textContent = track.trackNumber
          ? `#${track.trackNumber} · ${track.title}${track.loop ? '' : ' (Fanfare)'}`
          : track.title;
        bgmSelectEl.appendChild(opt);
      }
      const curId = this.audioManager.getCurrentTrackId();
      if (curId) bgmSelectEl.value = curId;
    }

    bindPointerTap(
      btnBgmPlay,
      () => {
        const chosen = bgmSelectEl?.value;
        if (chosen) {
          this.audioManager.playSfx('select');
          this.audioManager.playBgm(chosen, { fadeMs: 250, restart: true });
        }
      },
      { signal: this.signal }
    );

    bindPointerTap(
      btnBgmStop,
      () => {
        this.audioManager.playSfx('cancel');
        this.audioManager.stopBgm({ fadeMs: 250 });
      },
      { signal: this.signal }
    );

    bindPointerTap(
      btnAudioMute,
      () => {
        const nowMuted = this.audioManager.toggleMute();
        if (!nowMuted) {
          this.audioManager.playSfx('select');
        }
      },
      { signal: this.signal }
    );

    bindPointerTap(btnSfxSelect, () => this.audioManager.playSfx('select'), { signal: this.signal });
    bindPointerTap(btnSfxCancel, () => this.audioManager.playSfx('cancel'), { signal: this.signal });
    bindPointerTap(btnSfxAdvance, () => this.audioManager.playSfx('dialogue_advance'), {
      signal: this.signal,
    });

    bgmVolInput?.addEventListener(
      'input',
      () => {
        this.audioManager.setBgmVolume(Number(bgmVolInput.value) / 100);
      },
      { signal: this.signal }
    );

    sfxVolInput?.addEventListener(
      'input',
      () => {
        this.audioManager.setSfxVolume(Number(sfxVolInput.value) / 100);
      },
      { signal: this.signal }
    );

    this.unsubscribeAudio = this.audioManager.subscribe((snap) => {
      if (audioStatusEl) {
        const trackLabel = snap.currentTrack
          ? `#${snap.currentTrack.trackNumber ?? snap.currentTrack.id} · ${snap.currentTrack.title}`
          : 'None';
        const stateLabel = snap.settings.muted
          ? 'Muted'
          : snap.isPlaying
            ? 'Playing'
            : snap.awaitingUserUnlock
              ? 'Armed (Tap to unlock)'
              : snap.currentTrack
                ? 'Paused'
                : 'Stopped';
        audioStatusEl.textContent = [
          `Tracks in assets/audio: ${snap.discoveredTrackCount}`,
          `Now Playing: ${trackLabel}`,
          `State: ${stateLabel}`,
          `BGM: ${Math.round(snap.settings.bgmVolume * 100)}% · SFX: ${Math.round(snap.settings.sfxVolume * 100)}%`,
        ].join(' · ');
      }
      if (btnAudioMute) {
        btnAudioMute.textContent = snap.settings.muted ? 'Unmute Audio' : 'Mute Audio';
        btnAudioMute.classList.toggle('is-active', snap.settings.muted);
      }
      if (bgmVolInput && document.activeElement !== bgmVolInput) {
        bgmVolInput.value = String(Math.round(snap.settings.bgmVolume * 100));
      }
      if (sfxVolInput && document.activeElement !== sfxVolInput) {
        sfxVolInput.value = String(Math.round(snap.settings.sfxVolume * 100));
      }
      if (bgmSelectEl && snap.currentTrack && document.activeElement !== bgmSelectEl) {
        bgmSelectEl.value = snap.currentTrack.id;
      }
    });

    // --- TAB 4: TEST DUNGEON (SKIRMISH) LAUNCHER ---
    const btnLaunchBattle = this.modalEl.querySelector<HTMLButtonElement>(
      '#devtools-launch-battle'
    );
    bindPointerTap(
      btnLaunchBattle,
      () => {
        this.audioManager.playSfx('select');
        this.onLaunchBattle?.();
      },
      { signal: this.signal }
    );

    const btnLaunchDungeon = this.modalEl.querySelector<HTMLButtonElement>(
      '#devtools-launch-test-dungeon'
    );
    bindPointerTap(
      btnLaunchDungeon,
      () => {
        this.audioManager.playSfx('select');
        this.onLaunchTestDungeon?.();
      },
      { signal: this.signal }
    );

    this.renderStageButtons();
  }

  private renderStageButtons(): void {
    if (!this.stageButtonsRow) return;
    this.stageButtonsRow.innerHTML = '';
    const curSp = getSpeciesById(this.selectedSpeciesId);
    if (!curSp) return;

    const lineMembers = getSpeciesByLineId(curSp.lineId);
    for (const member of lineMembers) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `pmd-btn pmd-chip-btn${member.id === this.selectedSpeciesId ? ' is-active' : ''}`;
      btn.dataset.testid = `devtools-stage-btn-${member.id}`;
      btn.textContent = `S${member.stage}: ${member.name}`;
      bindPointerTap(btn, () => void this.selectSpecies(member.id), {
        signal: this.signal,
      });
      this.stageButtonsRow.appendChild(btn);
    }
  }

  private async refreshSpriteAndPortraits(): Promise<void> {
    if (!this.previewSpriteActor) return;
    const targetId = this.selectedSpeciesId;

    await Promise.all([
      this.previewSpriteActor.setSpecies(targetId),
      ...PMD_PORTRAIT_EMOTIONS.map(async (emotion) => {
        const pv = this.portraitViews.get(emotion);
        const metaEl = this.portraitMetaEls.get(emotion);
        if (!pv) return;
        const asset = await pv.setPortrait({
          speciesIdOrAssetId: targetId,
          emotion,
          mirrorHorizontal: this.mirrorPortraits,
        });
        if (asset && metaEl) {
          metaEl.textContent =
            asset.resolvedEmotion === emotion
              ? 'Native'
              : `-> ${asset.resolvedEmotion}`;
        }
      }),
    ]);

    this.previewSpriteActor.setAction(this.selectedAction, { loop: true });
    this.previewSpriteActor.setDirection(this.selectedDirection);
    this.updateSpriteMetaText();
  }

  private updateSpriteMetaText(): void {
    if (!this.spriteMetaEl || !this.previewSpriteActor) return;
    const snap = this.previewSpriteActor.getSnapshot();
    if (!snap) {
      this.spriteMetaEl.textContent = 'Loading sprite metadata...';
      return;
    }
    const dirInfo = PMD_DIRECTION_INFO[snap.direction];
    this.spriteMetaEl.textContent = [
      `Asset: ${snap.pmdAssetId}`,
      `Action: ${snap.action} (XML: ${snap.xmlAnimName} -> Sheet: ${snap.sheetName})`,
      `Dir: ${dirInfo?.label ?? snap.direction}`,
      `Frame: ${snap.frameWidth}x${snap.frameHeight}px · Scale: ${snap.scale}x (${snap.displayWidthPx}x${snap.displayHeightPx}px)`,
      `Smoothing: ${snap.imageSmoothingEnabled ? 'ON (ERROR)' : 'OFF (Pixelated)'}`,
      snap.synthesizedFallback ? 'Mode: Portrait Token Fallback' : 'Mode: Native PMD Sheet',
    ].join(' · ');
  }

  private renderActiveRosterStageControls(): void {
    if (!this.rosterStageBox) return;
    this.rosterStageBox.innerHTML = '';

    const save = this.saveManager.getSave();
    if (!save || save.roster.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'pmd-subcard-text';
      msg.textContent = 'No active campaign save. Start a New Game to test live Party stage swaps.';
      this.rosterStageBox.appendChild(msg);
      return;
    }

    save.roster.forEach((unit, slotIdx) => {
      const sp = getSpeciesById(unit.speciesId);
      if (!sp) return;
      const stages = getSpeciesByLineId(sp.lineId).filter((m) => m.faction !== 'enemy');

      const row = document.createElement('div');
      row.className = 'pmd-devtools-roster-row';

      const label = document.createElement('span');
      label.className = 'pmd-subcard-text';
      label.textContent = `${unit.nickname} (${sp.name} · Lv.${unit.level}):`;
      row.appendChild(label);

      const btns = document.createElement('div');
      btns.className = 'pmd-inline-btns';
      for (const st of stages) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `pmd-btn pmd-chip-btn${st.id === unit.speciesId ? ' is-active' : ''}`;
        btn.dataset.testid = `devtools-evolve-slot${slotIdx}-${st.id}`;
        btn.textContent = st.name;
        bindPointerTap(
          btn,
          () => {
            this.saveManager.evolveUnitToSpecies(unit.instanceId, st.id);
            void this.selectSpecies(st.id);
          },
          { signal: this.signal }
        );
        btns.appendChild(btn);
      }
      row.appendChild(btns);
      this.rosterStageBox!.appendChild(row);
    });
  }

  private renderDialogueTabSummary(): void {
    const summaryEl = this.modalEl.querySelector<HTMLElement>('#devtools-dialogue-cast');
    if (!summaryEl) return;
    const save = this.saveManager.getSave();
    const lord = this.dialogueOverlay.resolveSpeaker({ kind: 'lord' }, save);
    const partner = this.dialogueOverlay.resolveSpeaker({ kind: 'partner' }, save);
    const healer = this.dialogueOverlay.resolveSpeaker({ kind: 'healer' }, save);
    summaryEl.textContent = `Active Cast — Lord: ${lord.nickname} (${lord.speciesName}) · Partner: ${partner.nickname} (${partner.speciesName}) · Healer: ${healer.nickname} (${healer.speciesName})`;
  }
}
