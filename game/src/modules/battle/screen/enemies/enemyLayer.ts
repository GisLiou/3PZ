/**
 * 敵方區：敵人立繪、HP 條、「殘 N」攻擊倒數、名牌、瞄準符號、傷害數字的倒數，以及死亡演出。
 */
import { getAssetSize, getAssetUrl } from '@core/assets/assetLoader';
import { nextFrame } from '@core/animation/animate';
import { designUnit, translateUnits } from '@core/stage/stage';
import { renderBitmapText } from '@ui/bitmapText';
import { BATTLE_ASSETS, BATTLE_FONTS, DAMAGE_NUMBER_COLORS } from '../../assets/battleAssets';
import { LAYOUT_PART, layoutPartStyle } from '../../assets/atlasParts';
import { attackTiming } from '../../timing/battleTiming';
import type { PieceKind } from '../../board/pieceKinds';
import type { EnemyDefinition } from '../../battleTypes';
import { createImageElement, restartCssAnimation, setBitmapTextImage } from '../battleLayout';
import { playEnemyDeathSmoke, playHitBurst } from '../effects/hitEffects';

/** 戰鬥中的一個敵人 */
export interface Enemy extends EnemyDefinition {
  element: HTMLElement;
  artElement: HTMLElement;
  hpBar: HTMLElement;
  countdownElement: HTMLElement;
  damageNumber: HTMLElement;
  currentHp: number;
  /** 距離下次攻擊的回合數 */
  countdown: number;
  isDead: boolean;
  /** 已發出、尚未命中的傷害（決定下一隻小兵要打誰） */
  pendingDamage: number;
  /** 傷害數字倒數的狀態 */
  drain: { remaining: number; ratePerMs: number; running?: Promise<void> };
}

/** 敵人受擊時的紅色濾鏡 */
const HIT_TINT = 'sepia(1) saturate(6) hue-rotate(-35deg) brightness(.95)';

export class EnemyLayer {
  enemies: Enemy[] = [];
  /** 玩家鎖定的目標（null＝自動選擇） */
  target: Enemy | null = null;
  /** 教學用：敵人不會死（HP 最少留 1） */
  cannotDie = false;

  constructor(readonly element: HTMLElement, private effectLayer: HTMLElement) {}

  get waveCleared() { return this.enemies.every((enemy) => enemy.isDead); }

  setVisible(visible: boolean) { this.element.style.visibility = visible ? '' : 'hidden'; }

  /** 放上一個合戰的敵人（不動畫） */
  setEnemies(definitions: EnemyDefinition[]) {
    this.element.innerHTML = '';
    this.target = null;
    this.enemies = definitions.map((definition) => {
      const artSize = getAssetSize(definition.artAssetId), width = artSize.width * definition.scale, height = artSize.height * definition.scale;
      const element = document.createElement('div');
      element.className = 'enemy';
      element.style.transform = translateUnits(definition.x, definition.y);
      const artElement = createImageElement(element, {
        left: designUnit(-width / 2), top: designUnit(-height), width: designUnit(width), height: designUnit(height), backgroundImage: `url(${getAssetUrl(definition.artAssetId)})`,
      }, 'enemy-art');
      const frameSize = getAssetSize(BATTLE_ASSETS.enemyHpFrame), barWidth = Math.max(frameSize.width, width * 0.62);
      createImageElement(element, {
        left: designUnit(-barWidth / 2), top: designUnit(6), width: designUnit(barWidth), height: designUnit(frameSize.height),
        backgroundImage: `url(${getAssetUrl(BATTLE_ASSETS.enemyHpFrame)})`, backgroundSize: '100% 100%',
      });
      const hpBar = createImageElement(element, {
        left: designUnit(-barWidth / 2 + 2), top: designUnit(8), width: designUnit(barWidth - 4), height: designUnit(frameSize.height - 4),
        background: `url(${getAssetUrl(BATTLE_ASSETS.enemyHpFill)}) 0 0/100% 100%`, transformOrigin: '0 50%',
      });
      const countdownElement = createImageElement(element);
      const damageNumber = createImageElement(element);
      if (definition.showName && definition.name) {
        const plateSize = getAssetSize(BATTLE_ASSETS.enemyNamePlate);
        const namePlate = createImageElement(element, {
          left: designUnit(-plateSize.width * 0.6), top: designUnit(-8), width: designUnit(plateSize.width * 1.2), height: designUnit(plateSize.height * 1.2),
          backgroundImage: `url(${getAssetUrl(BATTLE_ASSETS.enemyNamePlate)})`, backgroundSize: '100% 100%',
          font: `900 ${designUnit(24)}/${designUnit(plateSize.height * 1.2)} sans-serif`, color: '#fff', textAlign: 'center',
        });
        namePlate.textContent = definition.name;
      }
      this.element.appendChild(element);
      const enemy: Enemy = {
        ...definition, element, artElement, hpBar, countdownElement, damageNumber,
        currentHp: definition.hp, countdown: definition.attackInterval, isDead: false, pendingDamage: 0, drain: { remaining: 0, ratePerMs: 0 },
      };
      void this.renderCountdown(enemy);
      return enemy;
    });
  }

  /** 敵人登場：由上往下淡入 */
  async playEntrance() {
    this.setVisible(true);
    await Promise.all(this.enemies.map((enemy, index) => enemy.element.animate(
      [{ opacity: 0, transform: translateUnits(enemy.x, enemy.y - 40) }, { opacity: 1, transform: translateUnits(enemy.x, enemy.y) }],
      { duration: 420, delay: index * 90, fill: 'backwards', easing: 'ease-out' },
    ).finished));
  }

  artHeightOf(enemy: Enemy) { return getAssetSize(enemy.artAssetId).height * enemy.scale; }

  /** 「殘N」：數字用原版 BFEnemyCountDown；「殘」字的原版字型尚未找到，暫用文字（自製素材 README #6） */
  async renderCountdown(enemy: Enemy) {
    const height = this.artHeightOf(enemy);
    const digits = await renderBitmapText(BATTLE_FONTS.enemyCountdown, String(enemy.countdown), '#ffffff');
    const scale = 30 / digits.height;
    enemy.countdownElement.innerHTML = `<b style="left:${designUnit(-34)};top:0;width:${designUnit(30)};height:${designUnit(30)};font:900 ${designUnit(26)}/${designUnit(30)} sans-serif;color:#d01818;-webkit-text-stroke:${designUnit(4)} #200;paint-order:stroke fill">殘</b>`
      + `<b style="left:0;top:0;width:${designUnit(digits.width * scale)};height:${designUnit(30)};background:url(${digits.url}) 0 0/100% 100%"></b>`;
    Object.assign(enemy.countdownElement.style, { left: designUnit(-8), top: designUnit(-height - 34) });
  }

  /** 下一隻小兵要攻擊的敵人：鎖定目標優先，否則選第一個還沒被打死的 */
  pickAttackTarget(): Enemy | undefined {
    const alive = this.enemies.filter((enemy) => !enemy.isDead && enemy.currentHp - enemy.pendingDamage > 0);
    return this.target && !this.target.isDead ? this.target : alive[0] ?? this.enemies.find((enemy) => !enemy.isDead);
  }

  /** 命中時敵人變紅、晃動 */
  playHitReaction(enemy: Enemy) {
    restartCssAnimation(enemy.artElement, 'is-shaking');
    void enemy.artElement.animate([{ filter: HIT_TINT }, { filter: HIT_TINT, offset: 0.7 }, { filter: 'none' }], { duration: attackTiming.enemyHitTintMs });
  }

  /**
   * 敵人頭上的傷害數字：命中時加上傷害，之後隨 HP 條下降往下數（v1 124 400 → 125 133，約 700 ms 數完一次命中）。
   * 連續命中同一個敵人時數字累加，共用同一個倒數。數字顏色依傷害來源的勢力。
   */
  drainHp(enemy: Enemy, damage: number, sourceKind: PieceKind): Promise<void> {
    const drain = enemy.drain;
    drain.remaining += damage;
    drain.ratePerMs = Math.max(drain.ratePerMs, drain.remaining / attackTiming.enemyHpDrainMs);
    if (drain.running) return drain.running;
    const artHeight = this.artHeightOf(enemy), minimumHp = this.cannotDie ? 1 : 0;
    drain.running = (async () => {
      let lastTime = performance.now();
      while (drain.remaining > 0) {
        await nextFrame();
        const now = performance.now(), amount = Math.min(drain.remaining, drain.ratePerMs * (now - lastTime));
        lastTime = now; drain.remaining -= amount;
        enemy.currentHp = Math.max(minimumHp, enemy.currentHp - amount);
        enemy.hpBar.style.transform = `scaleX(${Math.max(0, enemy.currentHp / enemy.hp)})`;
        await setBitmapTextImage(enemy.damageNumber, BATTLE_FONTS.number, String(Math.ceil(drain.remaining)), DAMAGE_NUMBER_COLORS[sourceKind], 36, 0, -artHeight * 0.7, 'center');
      }
      enemy.currentHp = Math.round(enemy.currentHp);
      enemy.damageNumber.style.display = 'none';
      drain.ratePerMs = 0; drain.running = undefined;
    })();
    return drain.running;
  }

  /** 攻擊結算後：HP 歸零的敵人播放死亡演出 */
  resolveDeaths() {
    for (const enemy of this.enemies) {
      enemy.pendingDamage = 0;
      if (!enemy.isDead && enemy.currentHp <= 0) { enemy.isDead = true; void this.playDeath(enemy); }
    }
  }

  /** 死亡（v5 160 888～、v1 125 267～125 600）：先變全黑剪影 → 爆光 → 煙霧散開，敵人消失（金幣素材尚未找到，未畫） */
  private async playDeath(enemy: Enemy) {
    const centerY = enemy.y - this.artHeightOf(enemy) * 0.5;
    await enemy.artElement.animate([{ filter: 'brightness(0)' }, { filter: 'brightness(0)' }], { duration: attackTiming.enemyDeathBlackMs, fill: 'forwards' }).finished;
    void playHitBurst(this.effectLayer, enemy.x, centerY);
    playEnemyDeathSmoke(this.effectLayer, enemy.x, centerY);
    await enemy.element.animate([{ opacity: 1 }, { opacity: 0 }], { duration: attackTiming.enemyDeathFadeMs, fill: 'forwards' }).finished;
  }

  /** 鎖定目標：太極圖（puzzlelayout 50） */
  setTarget(index: number) {
    this.target = this.enemies[index] ?? null;
    this.enemies.forEach((enemy) => enemy.element.querySelector('.target-marker')?.remove());
    if (!this.target) return;
    const enemy = this.target, height = this.artHeightOf(enemy);
    createImageElement(enemy.element, { ...layoutPartStyle(LAYOUT_PART.target, 0.75), left: designUnit(-0.75 * 50), top: designUnit(-height * 0.55 - 37) }, 'target-marker');
  }
}
