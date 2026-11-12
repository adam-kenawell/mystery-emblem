/**
 * Mystery Emblem - Campaign Chapter Battle Launcher (`chapterBattleLauncher.ts`)
 */

import {
  resolveChapterRecruitmentSpeciesIds,
  type CampaignChapterConfig,
} from '../data/campaignRegistry';
import { hasChapterMapOverride } from '../data/chapterMapRegistry';
import { getSpeciesById } from '../data/index';
import { DEMO_OVERWORLD_GRAPH } from '../data/overworldMapData';
import type { DungeonMapDefinition, ManualEnemyBattleSpawn } from '../types/schemas';
import type { AppRuntimeContext } from './appContext';

export async function launchCampaignChapterBattle(
  ctx: AppRuntimeContext,
  demoChapter: CampaignChapterConfig,
  opts?: { resumeSuspendJson?: string }
): Promise<void> {
  const { dom, manager, backStack } = ctx;
  if (!ctx.battleScene || ctx.demoLaunchInProgress) return;
  ctx.demoLaunchInProgress = true;
  ctx.pendingPostVictoryDemoNodeId = null;
  try {
    const newlyRecruitedIds: string[] = [];
    if (demoChapter.recruitment && !manager.hasRecruitedChapter(demoChapter.nodeId)) {
      const targetIds = resolveChapterRecruitmentSpeciesIds(
        demoChapter.recruitment,
        manager.getSave()
      );
      for (const spId of targetIds) {
        const sp = getSpeciesById(spId);
        if (!sp) continue;
        const alreadyOwned = manager.getSave()?.roster.some((u) => {
          return getSpeciesById(u.speciesId)?.lineId === sp.lineId;
        });
        if (alreadyOwned) continue;
        const created = manager.recruitPokemon({
          speciesId: spId,
          level: demoChapter.recruitment.joinLevel,
          scaleStatsToLevel: demoChapter.recruitment.scaleStatsToLevel,
        });
        newlyRecruitedIds.push(created.instanceId);
      }
      manager.markChapterRecruited(demoChapter.nodeId);
    }

    if (ctx.overworldScene?.isOpen()) {
      ctx.overworldReturnTarget = 'suppress';
      ctx.overworldScene.close();
    }
    if (ctx.quizScene?.isOpen()) ctx.quizScene.close();
    ctx.battleReturnTarget = 'overworld';
    if (dom.titleScreen) dom.titleScreen.hidden = true;
    if (dom.devToolsBackdrop) dom.devToolsBackdrop.hidden = true;

    const shouldPlayIntro =
      Boolean(ctx.dialogueOverlay) &&
      !manager.hasSeenChapterCutscene('intro', demoChapter.nodeId);
    const shouldPlayOutro =
      Boolean(ctx.dialogueOverlay) &&
      !manager.hasSeenChapterCutscene('outro', demoChapter.nodeId);

    await ctx.battleScene.open({
      levelId: demoChapter.levelId,
      customMap: demoChapter.buildMap(),
      enemyOverrides: hasChapterMapOverride(demoChapter.levelId)
        ? undefined
        : demoChapter.enemySpawns,
      objectiveType: demoChapter.objectiveType,
      objectiveLabel: demoChapter.objectiveLabel,
      surviveTurns: demoChapter.surviveTurns,
      defeatIfUnitIdsFall: demoChapter.defeatIfUnitIdsFall,
      reinforcements: demoChapter.reinforcements,
      events: demoChapter.events,
      eventScripts: demoChapter.eventScripts,
      commitToSaveOnVictory: true,
      clearRewardItems: demoChapter.clearRewardItems,
      preferredDeployInstanceIds: newlyRecruitedIds,
      skipPrepPhase: Boolean(demoChapter.skipPrepPhase),
      exitButtonLabel: 'Return to World Map',
      hideReplayOnVictory: true,
      suspendSource: { kind: 'chapter', nodeId: demoChapter.nodeId },
      resumeSuspendJson: opts?.resumeSuspendJson,
      onDungeonEnteredBeforePrep: shouldPlayIntro
        ? async () => {
            if (
              !ctx.dialogueOverlay ||
              manager.hasSeenChapterCutscene('intro', demoChapter.nodeId)
            ) {
              return;
            }
            await ctx.dialogueOverlay.playScript(
              demoChapter.buildIntroScript(manager.getSave())
            );
            manager.markChapterCutsceneSeen('intro', demoChapter.nodeId);
          }
        : undefined,
      onVictory: () => {
        manager.completeOverworldChapter(demoChapter.nodeId, { graph: DEMO_OVERWORLD_GRAPH });
        if (demoChapter.guaranteesKecleonShopOnClear) {
          manager.spawnOverworldKecleonShop(
            demoChapter.guaranteesKecleonShopOnClear.nodeId,
            demoChapter.guaranteesKecleonShopOnClear.shopType,
            Math.random,
            DEMO_OVERWORLD_GRAPH
          );
        }
        if (demoChapter.isDemoFinale) {
          manager.markDemoCompleted();
        }
        ctx.pendingPostVictoryDemoNodeId = demoChapter.nodeId;
      },
      onBeforeVictoryModal: shouldPlayOutro
        ? async () => {
            if (
              !ctx.dialogueOverlay ||
              manager.hasSeenChapterCutscene('outro', demoChapter.nodeId)
            ) {
              return;
            }
            await ctx.dialogueOverlay.playScript(
              demoChapter.buildOutroScript(manager.getSave())
            );
            manager.markChapterCutsceneSeen('outro', demoChapter.nodeId);
          }
        : undefined,
    });
    backStack.syncButtonLabel();
  } finally {
    ctx.demoLaunchInProgress = false;
  }
}

function prepareStageForOverworldBattle(ctx: AppRuntimeContext): void {
  const { dom } = ctx;
  if (ctx.overworldScene?.isOpen()) {
    ctx.overworldReturnTarget = 'suppress';
    ctx.overworldScene.close();
  }
  if (ctx.quizScene?.isOpen()) ctx.quizScene.close();
  ctx.battleReturnTarget = 'overworld';
  if (dom.titleScreen) dom.titleScreen.hidden = true;
  if (dom.devToolsBackdrop) dom.devToolsBackdrop.hidden = true;
}

/** Plain overworld node battle (no campaign chapter config). */
export async function launchOverworldNodeBattle(
  ctx: AppRuntimeContext,
  params: { nodeId: string; levelId: string },
  opts?: { resumeSuspendJson?: string }
): Promise<void> {
  if (!ctx.battleScene) return;
  prepareStageForOverworldBattle(ctx);
  const { nodeId, levelId } = params;
  await ctx.battleScene.open({
    levelId,
    commitToSaveOnVictory: true,
    exitButtonLabel: 'Return to World Map',
    hideReplayOnVictory: true,
    suspendSource: { kind: 'node', nodeId, levelId },
    resumeSuspendJson: opts?.resumeSuspendJson,
    onVictory: () => ctx.manager.completeOverworldChapter(nodeId, { graph: DEMO_OVERWORLD_GRAPH }),
  });
  ctx.backStack.syncButtonLabel();
}

/** Randomly generated overworld skirmish; its map travels inside the suspend source. */
export async function launchSkirmishBattle(
  ctx: AppRuntimeContext,
  params: {
    nodeId: string;
    customMap: DungeonMapDefinition;
    enemyOverrides?: ReadonlyArray<ManualEnemyBattleSpawn>;
    goldBounty: number;
  },
  opts?: { resumeSuspendJson?: string }
): Promise<void> {
  if (!ctx.battleScene) return;
  prepareStageForOverworldBattle(ctx);
  const { nodeId, customMap, enemyOverrides, goldBounty } = params;
  await ctx.battleScene.open({
    customMap,
    enemyOverrides,
    commitToSaveOnVictory: true,
    exitButtonLabel: 'Return to World Map',
    hideReplayOnVictory: true,
    suspendSource: { kind: 'skirmish', nodeId, goldBounty, customMap, enemyOverrides },
    resumeSuspendJson: opts?.resumeSuspendJson,
    onVictory: () => ctx.manager.clearOverworldSkirmish(nodeId, goldBounty, DEMO_OVERWORLD_GRAPH),
  });
  ctx.backStack.syncButtonLabel();
}
