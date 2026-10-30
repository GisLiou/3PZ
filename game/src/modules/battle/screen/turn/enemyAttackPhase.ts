/**
 * 敵人回合：殘數減一，歸零者攻擊。
 * 攻擊演出（v5 178 705～180 000）：敵人紅／正常交替閃爍約 480 ms → 全畫面泛紅、敵人身上濺出 3 個紅色血花（每 53 ms 一個）→
 * 我方 HP 條下降、HP 條上方紅色傷害數字從 0 數到傷害值（約 430 ms）→ 數字停留後淡出。
 */
import { nextFrame, wait } from '@core/animation/animate';
import { BATTLE_FONTS, DAMAGE_NUMBER_COLORS } from '../../assets/battleAssets';
import { attackTiming } from '../../timing/battleTiming';
import type { Enemy } from '../enemies/enemyLayer';
import { playBloodSplashes, playScreenRedFlash } from '../effects/hitEffects';
import { createImageElement, restartCssAnimation, setBitmapTextImage } from '../battleLayout';
import type { BattleContext } from './battleContext';

const ATTACK_TINT = 'sepia(1) saturate(6) hue-rotate(-35deg) brightness(.9)';
/** 閃爍序列：1＝紅、0＝正常，每格 53 ms */
const BLINK_PATTERN = [1, 1, 0, 1, 0, 1, 0, 1, 1];

export async function playEnemyTurn(context: BattleContext) {
  const { enemyLayer } = context;
  for (const enemy of enemyLayer.enemies.filter((candidate) => !candidate.isDead)) {
    enemy.countdown--;
    if (enemy.countdown <= 0) {
      enemy.countdown = enemy.attackInterval;
      await playEnemyStrike(context, enemy);
    }
    await enemyLayer.renderCountdown(enemy);
  }
}

async function playEnemyStrike({ screenElement, effectLayer, party }: BattleContext, enemy: Enemy) {
  for (const isRed of BLINK_PATTERN) { enemy.artElement.style.filter = isRed ? ATTACK_TINT : ''; await wait(attackTiming.enemyStrikeBlinkMs); }
  enemy.artElement.style.filter = '';
  playScreenRedFlash(screenElement);
  restartCssAnimation(screenElement, 'is-shaking');
  playBloodSplashes(effectLayer, [[455, enemy.y - 160], [235, enemy.y - 90], [330, enemy.y - 60]]);
  await wait(attackTiming.splashToDamageNumberMs);
  // HP 條下降＋紅色傷害數字 0 → 傷害
  const damage = enemy.attack, from = party.hp, to = Math.max(0, from - damage);
  const damageNumber = createImageElement(effectLayer);
  const startedAt = performance.now();
  for (;;) {
    const progress = Math.min(1, (performance.now() - startedAt) / attackTiming.enemyStrikeCountMs);
    party.hp = from + (to - from) * progress;
    await party.renderHp();
    await setBitmapTextImage(damageNumber, BATTLE_FONTS.number, String(Math.round(damage * progress)), DAMAGE_NUMBER_COLORS.wu, 38, 320, 478, 'center');
    if (progress >= 1) break;
    await nextFrame();
  }
  await wait(attackTiming.enemyStrikeHoldMs);
  await damageNumber.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).finished;
  damageNumber.remove();
}
