/** 軍略（v5 158 534）：武將列上方黑色訊息帶，該勢力小兵冒出光焰，數字再上數 */
import { getAssetSize, getAssetUrl } from '@core/assets/assetLoader';
import { nextFrame } from '@core/animation/animate';
import { designUnit } from '@core/stage/stage';
import { FACTION_AURA_ASSETS } from '../../assets/battleAssets';
import { LAYOUT_PART } from '../../assets/atlasParts';
import { attackTiming } from '../../timing/battleTiming';
import type { LeaderSkill } from '../../battleTypes';
import { createImageElement, createRotatedLayoutPart } from '../battleLayout';
import type { BattleContext } from './battleContext';

/** 播放軍略演出；回傳收起訊息帶與光焰的函式（訊息帶在小兵出發後才收起） */
export async function playLeaderSkill({ party, effectLayer }: BattleContext, skill: LeaderSkill): Promise<() => void> {
  const boosted = party.members.filter((member) => member.faction === skill.faction && member.damage);
  if (!boosted.length) return () => {};
  const band = createRotatedLayoutPart(LAYOUT_PART.messageBand, 0, 364, 640, 34);
  band.style.opacity = '0.8';
  const message = document.createElement('b');
  Object.assign(message.style, { left: designUnit(0), top: designUnit(366), width: designUnit(640), textAlign: 'center', font: `700 ${designUnit(22)}/${designUnit(30)} 'PingFang TC','Noto Sans TC',sans-serif`, color: '#fff' });
  message.textContent = `使我方「${skill.factionName}」武將的攻擊力變為${skill.multiplier}倍`;
  effectLayer.appendChild(band); effectLayer.appendChild(message);
  const auras = boosted.map((member) => {
    const assetId = FACTION_AURA_ASSETS[member.faction], size = getAssetSize(assetId), scale = 120 / size.width;
    const aura = createImageElement(null, { left: designUnit(party.centerXOf(member) - 60), top: designUnit(330), width: designUnit(120), height: designUnit(size.height * scale), background: `url(${getAssetUrl(assetId)}) 0 0/100% 100%`, opacity: '0.85' });
    effectLayer.insertBefore(aura, effectLayer.firstChild);
    return aura;
  });
  await Promise.all(boosted.map(async (member) => {
    const from = member.shownDamage, to = Math.round(member.shownDamage * skill.multiplier), startedAt = performance.now();
    for (;;) {
      const progress = Math.min(1, (performance.now() - startedAt) / attackTiming.leaderSkillCountMs);
      member.shownDamage = Math.round(from + (to - from) * progress);
      await party.drawDamageNumber(member, member.shownDamage, 'atTokenFeet');
      if (progress >= 1) break;
      await nextFrame();
    }
  }));
  // 訊息帶不在這裡收起：小兵出發後還留約 540 ms（v5 158 534～159 390）
  return () => { band.remove(); message.remove(); auras.forEach((aura) => aura.remove()); };
}
