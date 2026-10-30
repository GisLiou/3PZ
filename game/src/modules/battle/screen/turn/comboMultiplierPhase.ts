/**
 * 連擊倍率（v1 121 900～123 400）：有傷害的武將頭上小兵上下跳（267 ms 一次，跳起時張開雙手），
 * 每 533 ms 亮一下；數字在小兵腳下往上數到 ×倍率。回復量同時上數。
 */
import { nextFrame } from '@core/animation/animate';
import { attackTiming, matchTiming } from '../../timing/battleTiming';
import type { BattleContext } from './battleContext';

const HOP_HEIGHT = 14;

export async function playComboMultiplier({ party, board }: BattleContext, multiplier: number, combos: number) {
  const attackers = party.members.filter((member) => member.damage);
  // 時間長度＝(連擊數−1)×533 ms（v5 9 連擊：153 933→158 213 約 4 280 ms；v1 4 連擊：約 1 600 ms）
  const startedAt = performance.now(), durationMs = Math.max(matchTiming.groupIntervalMs, (combos - 1) * matchTiming.groupIntervalMs);
  const startValues = new Map(attackers.map((member) => [member, member.shownDamage]));
  const startHeal = party.pendingHeal, labelCount = combos - 1;
  let fadedLabels = 0;
  for (;;) {
    const elapsed = performance.now() - startedAt, progress = Math.min(1, elapsed / durationMs);
    const isUp = Math.floor(elapsed / attackTiming.tokenHopMs) % 2 === 0, isBright = (elapsed % attackTiming.tokenFlashMs) < 100;
    // 連擊字依序淡出：第 j 個在 (j−0.5)×533 ms
    while (fadedLabels < labelCount && elapsed >= (fadedLabels + 0.5) * matchTiming.groupIntervalMs) board.fadeComboLabel(fadedLabels++);
    for (const member of attackers) {
      party.showToken(member, isUp ? 'armsOpen' : 'raiseHand', isUp ? HOP_HEIGHT : 0);
      member.token.style.filter = isBright ? 'brightness(1.6)' : '';
      const from = startValues.get(member)!;
      member.shownDamage = Math.round(from + (member.damage * multiplier - from) * progress);
      await party.drawDamageNumber(member, member.shownDamage, 'atTokenFeet');
    }
    // 回復量一起上數（HP 條上的大字，v5：+35 → +99）
    if (startHeal) await party.setHealText(`+${Math.round(startHeal * (1 + (multiplier - 1) * progress))}`, 56, 330, 494);
    if (progress >= 1) break;
    await nextFrame();
  }
  // 數完後回復字縮小（v5 158 213：高度約 32）
  if (startHeal) await party.setHealText(`+${Math.round(startHeal * multiplier)}`, 32, 322, 508);
  for (const member of attackers) { member.token.style.filter = ''; party.showToken(member, 'raiseHand'); }
}
