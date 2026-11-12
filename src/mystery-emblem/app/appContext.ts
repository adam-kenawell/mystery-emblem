/**
 * Mystery Emblem - Shared App Shell Runtime Context (`appContext.ts`)
 */

import type { AudioManager } from '../audio/AudioManager';
import type { BattleScene } from '../scenes/BattleScene';
import type { ChapterMapEditorScene } from '../scenes/ChapterMapEditorScene';
import type { CreditsScene } from '../scenes/CreditsScene';
import type { CutsceneScene } from '../scenes/CutsceneScene';
import type { OverworldScene } from '../scenes/OverworldScene';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { DevToolsHarness } from '../ui/DevToolsHarness';
import type { DialogueOverlay } from '../ui/DialogueOverlay';
import type { QuizScene } from '../ui/QuizScene';
import type { RecruitNicknameOverlay } from '../ui/RecruitNicknameOverlay';
import type { TutorialOverlay } from '../ui/TutorialOverlay';
import type { BackStackController } from '../ui/pointerControls';

export interface AppDomRefs {
  viewportEl: HTMLElement | null;
  landingBackdrop: HTMLElement | null;
  titleScreen: HTMLElement | null;
  devToolsBackdrop: HTMLElement | null;
  devToolsModal: HTMLElement | null;
  devToolsBtn: HTMLElement | null;
  cornerMenuBtn: HTMLButtonElement | null;
  statusMsgEl: HTMLElement | null;
  btnContinue: HTMLButtonElement | null;
  btnContinueLabel: HTMLElement | null;
  btnContinueChapter: HTMLElement | null;
}

export interface AppRuntimeContext {
  dom: AppDomRefs;
  manager: SaveStateManager;
  audioManager: AudioManager;
  signal: AbortSignal;
  backStack: BackStackController;
  dialogueOverlay: DialogueOverlay | null;
  cutsceneScene: CutsceneScene | null;
  creditsScene: CreditsScene | null;
  recruitNicknameOverlay: RecruitNicknameOverlay | null;
  tutorialOverlay: TutorialOverlay | null;
  quizScene: QuizScene | null;
  battleScene: BattleScene | null;
  mapEditorScene: ChapterMapEditorScene | null;
  overworldScene: OverworldScene | null;
  devToolsHarness: DevToolsHarness | null;
  battleReturnTarget: 'devtools' | 'overworld' | 'title';
  pendingPostVictoryDemoNodeId: string | null;
  overworldReturnTarget: 'title' | 'suppress';
  demoLaunchInProgress: boolean;
}
