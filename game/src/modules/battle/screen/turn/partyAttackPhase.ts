/**
 * 我方攻擊（v1 123 400～125 800）：數字落到頭像上 → 頭上小兵依序走向目標（667 ms，每隻錯開 200 ms）→
 * 命中爆光、頭像數字消失、敵人頭上出現傷害數字並隨 HP 條往下數 → 死亡的敵人變暗爆開。
 */
import { wait } from '@core/animation/animate';
import { translateUnits } from '@core/stage/stage';
import { attackTiming, matchTiming } from '../../timing/battleTiming';
import { playHitBurst } from '../effects/hitEffects';
import { paintTroopSprite } from '../troops/troopSprite';
import { createImageElement, PORTRAIT_TOP } from '../battleLayout';
import type { PartyMember } from '../party/partyPanel';
import type { BattleContext } from './battleContext';

export async function playPartyAttack(context: BattleContext) {
  const { party } = context;
  const attackers = party.members.filter((member) => member.damage);
  await Promise.all(attackers.map((member) => party.drawDamageNumber(member, member.shownDamage, 'onPortrait')));
  await wait(attackTiming.damageNumberDropMs);
  await Promise.all(attackers.map((member, index) => marchAndHit(context, member, index)));
  party.resetAfterAttack();
  await wait(attackTiming.afterAttackMs);
  context.enemyLayer.resolveDeaths();
  await wait(attackTiming.enemyDeathFadeMs);
}

/** 一位武將的小兵跑向目標並命中 */
async function marchAndHit({ party, enemyLayer, effectLayer }: BattleContext, member: PartyMember, index: number) {
  await wait(index * attackTiming.marchStaggerMs);
  const target = enemyLayer.pickAttackTarget();
  if (!target) return;
  const damage = member.shownDamage;
  target.pendingDamage += damage;
  // 頭上的小兵換成戰鬥特效圖集裡的大隻小兵（背面），左右腳交替跑向敵人腳下（v1 123 533～124 200）
  const fromX = party.centerXOf(member), fromY = PORTRAIT_TOP + 40, toX = target.x + (index % 3 - 1) * 14, toY = target.y - 6;
  member.token.style.display = 'none';
  const troop = document.createElement('div');
  troop.className = 'troop';
  const troopSprite = createImageElement(troop);
  effectLayer.appendChild(troop);
  const startedAt = performance.now();
  const march = troop.animate([{ transform: translateUnits(fromX, fromY, ' scale(.55)') }, { transform: translateUnits(toX, toY, ' scale(1)') }], { duration: attackTiming.marchMs, fill: 'forwards', easing: 'linear' });
  const animateLegs = () => {
    const elapsed = performance.now() - startedAt;
    if (elapsed < attackTiming.marchMs) { paintTroopSprite(troopSprite, member.faction, Math.floor(elapsed / matchTiming.walkFrameMs) % 2); requestAnimationFrame(animateLegs); }
  };
  animateLegs();
  await march.finished;
  march.cancel(); troop.style.transform = translateUnits(toX, toY);
  member.damageNumber.style.display = 'none';
  // 命中：小兵先變一禎全黑（v1 124 167、v5 159 711），接著爆光、小兵變白後淡出；敵人變紅、晃動
  troop.style.filter = 'brightness(0)';
  await wait(attackTiming.hitBlackMs);
  void playHitBurst(effectLayer, toX, toY - 50, '', member.faction !== 'wu');
  void troop.animate([
    { filter: 'brightness(3)', opacity: 1 }, { filter: 'brightness(3)', opacity: 1, offset: attackTiming.hitWhiteMs / attackTiming.troopFadeMs }, { filter: 'brightness(1)', opacity: 0 },
  ], { duration: attackTiming.troopFadeMs, fill: 'forwards' }).finished.then(() => troop.remove());
  enemyLayer.playHitReaction(target);
  await enemyLayer.drainHp(target, damage, member.faction);
}
