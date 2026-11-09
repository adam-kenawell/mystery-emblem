/**
 * Mystery Emblem — Overworld `Story & Credits` Replay Subbox (`overworldStoryReplayBox.ts`)
 */

import type { AudioManager } from '../../audio/AudioManager';
import {
  DEMO_STORY_CUTSCENES,
  POST_CHAPTER_STORY_CUTSCENE_BY_NODE_ID,
  PRE_CHAPTER_STORY_CUTSCENE_BY_NODE_ID,
} from '../../data/storyCutscenes';
import type { SaveData } from '../../types/schemas';
import { bindPointerTap } from '../../ui/pointerControls';

export function buildStoryReplaySubbox(params: {
  save: SaveData;
  audioManager: AudioManager;
  onCloseSystemMenu: () => void;
  onReplayCutscene?: (cutsceneId: string) => void;
  onReplayCredits?: () => void;
}): HTMLElement | null {
  const { save, audioManager, onCloseSystemMenu, onReplayCutscene, onReplayCredits } = params;
  if (!onReplayCutscene && !onReplayCredits) return null;

  const seenSet = new Set(save.campaign.seenStoryCutsceneIds ?? []);
  const completedNodes = new Set(save.campaign.completedChapterIds ?? []);
  const nodeIdByPreCutscene = new Map<string, string>(
    Object.entries(PRE_CHAPTER_STORY_CUTSCENE_BY_NODE_ID).map(([nodeId, csId]) => [csId, nodeId])
  );
  const nodeIdByPostCutscene = new Map<string, string>(
    Object.entries(POST_CHAPTER_STORY_CUTSCENE_BY_NODE_ID).map(([nodeId, csId]) => [csId, nodeId])
  );

  const unlockedCutscenes = DEMO_STORY_CUTSCENES.filter((cs) => {
    if (seenSet.has(cs.id)) return true;
    const preNode = nodeIdByPreCutscene.get(cs.id);
    if (preNode) {
      return (
        preNode === 'prologue' ||
        completedNodes.has(preNode) ||
        Boolean(save.overworld.nodes[preNode]?.unlocked)
      );
    }
    const reqNode = nodeIdByPostCutscene.get(cs.id);
    return Boolean(reqNode && completedNodes.has(reqNode));
  });
  const creditsUnlocked = Boolean(save.campaign.demoCompleted || save.campaign.creditsSeen);
  if (unlockedCutscenes.length === 0 && !creditsUnlocked) return null;

  const box = document.createElement('div');
  box.className = 'pmd-overworld-subbox';
  box.dataset.testid = 'overworld-story-replay-box';
  box.style.marginTop = '0.5rem';

  const title = document.createElement('p');
  title.className = 'pmd-overworld-subbox-title';
  title.textContent = 'Story & Credits';
  box.appendChild(title);

  const btnWrap = document.createElement('div');
  btnWrap.className = 'pmd-inline-btns';

  for (const cs of unlockedCutscenes) {
    if (!onReplayCutscene) break;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pmd-btn pmd-chip-btn';
    btn.dataset.testid = `overworld-replay-cutscene-${cs.id}`;
    btn.textContent = `${cs.chapterOrder}. ${cs.title}`;
    bindPointerTap(btn, () => {
      audioManager.playSfx('select');
      onCloseSystemMenu();
      onReplayCutscene(cs.id);
    });
    btnWrap.appendChild(btn);
  }

  if (creditsUnlocked && onReplayCredits) {
    const creditsBtn = document.createElement('button');
    creditsBtn.type = 'button';
    creditsBtn.className = 'pmd-btn pmd-btn-gold pmd-chip-btn';
    creditsBtn.dataset.testid = 'overworld-replay-credits-btn';
    creditsBtn.textContent = 'Ending Credits ★';
    bindPointerTap(creditsBtn, () => {
      audioManager.playSfx('select');
      onCloseSystemMenu();
      onReplayCredits();
    });
    btnWrap.appendChild(creditsBtn);
  }

  box.appendChild(btnWrap);
  return box;
}
