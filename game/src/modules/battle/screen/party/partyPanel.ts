/**
 * 我方區：武將頭像、頭上的小兵（token）、傷害數字、HP 條與回復量。
 * 頭像在 party 圖層；頭上小兵、數字、回復量畫在效果層（可跨區移動）。
 */
import { getAssetUrl } from '@core/assets/assetLoader';
import { nextFrame, wait } from '@core/animation/animate';
import { designUnit, translateUnits } from '@core/stage/stage';
import { BATTLE_ASSETS, BATTLE_FONTS, DAMAGE_NUMBER_COLORS } from '../../assets/battleAssets';
import { LAYOUT_PART, layoutPartStyle } from '../../assets/atlasParts';
import { matchTiming } from '../../timing/battleTiming';
import type { MatchGroup } from '../../board/boardRules';
import type { PartyMemberDefinition } from '../../battleTypes';
import { paintPieceSprite, type PiecePose } from '../../boardView/pieceSprite';
import { createImageElement, createRotatedLayoutPart, PORTRAIT_TOP, portraitCenterX, portraitLeft, setBitmapTextImage } from '../battleLayout';

/** 戰鬥中的一位武將 */
export interface PartyMember extends PartyMemberDefinition {
  portrait: HTMLElement;
  /** 本回合累積的傷害（未乘連擊倍率） */
  damage: number;
  /** 畫面上目前顯示的數字 */
  shownDamage: number;
  /** 頭上的小兵 */
  token: HTMLElement;
  tokenSprite: HTMLElement;
  damageNumber: HTMLElement;
  /** 數字上數動畫的佇列（依序播放） */
  counting: Promise<void>;
}

/** 傷害數字的位置：above＝頭像上方（數字在數）、onPortrait＝落在頭像上（數完）、atTokenFeet＝頭上小兵腳下 */
export type DamageNumberPosition = 'above' | 'onPortrait' | 'atTokenFeet';

export class PartyPanel {
  readonly members: PartyMember[];
  hp = 0;
  maxHp = 0;
  /** 本回合累積的回復量（未乘連擊倍率） */
  pendingHeal = 0;
  private hpFill: HTMLElement;
  private hpText: HTMLElement;
  private healText: HTMLElement;

  constructor(partyLayer: HTMLElement, effectLayer: HTMLElement, definitions: PartyMemberDefinition[]) {
    this.members = definitions.map((definition, index) => {
      const portrait = createImageElement(partyLayer, { left: designUnit(portraitLeft(index)), backgroundImage: `url(${getAssetUrl(definition.portraitAssetId)})` }, 'party-member');
      const token = document.createElement('div');
      token.className = 'party-token';
      token.style.display = 'none';
      const tokenSprite = createImageElement(token);
      paintPieceSprite(tokenSprite, definition.faction, 'raiseHand');
      effectLayer.appendChild(token);
      const damageNumber = createImageElement(effectLayer, {}, 'party-damage-number');
      return { ...definition, portrait, damage: 0, shownDamage: 0, token, tokenSprite, damageNumber, counting: Promise.resolve() };
    });
    this.maxHp = this.hp = definitions.reduce((sum, member) => sum + member.hp, 0);
    partyLayer.appendChild(createRotatedLayoutPart(LAYOUT_PART.hpBarBackground, 50, 513, 580, 28));
    this.hpFill = createImageElement(partyLayer, {
      left: designUnit(60), top: designUnit(519), width: designUnit(412), height: designUnit(16),
      backgroundImage: `url(${getAssetUrl(BATTLE_ASSETS.partyHpGauge)})`, backgroundSize: '100% 100%', transformOrigin: '0 50%',
    });
    createImageElement(partyLayer, { ...layoutPartStyle(LAYOUT_PART.heart, 0.8), left: designUnit(10), top: designUnit(508) });
    this.hpText = createImageElement(partyLayer);
    this.healText = createImageElement(effectLayer);
    void this.renderHp();
  }

  /** 頭像中心 x */
  centerXOf(member: PartyMember) { return portraitCenterX(this.members.indexOf(member)); }

  membersOfFaction(faction: string) { return this.members.filter((member) => member.faction === faction); }

  async renderHp() {
    this.hpFill.style.transform = `scaleX(${Math.max(0, this.hp / this.maxHp)})`;
    await setBitmapTextImage(this.hpText, BATTLE_FONTS.number, `${Math.round(this.hp)}/${this.maxHp}`, DAMAGE_NUMBER_COLORS.shu, 32, 628, 510, 'right');
  }

  /** 消除一組（變白那一禎）：記錄傷害（同勢力武將）或回復（桃子） */
  recordGroup(group: MatchGroup) {
    const sizeBonus = 1 + 0.25 * (group.cells.length - 3);
    if (group.kind === 'peach') { this.pendingHeal += this.members.reduce((sum, member) => sum + member.recovery, 0) * sizeBonus; return; }
    for (const member of this.membersOfFaction(group.kind)) member.damage += member.attack * sizeBonus;
  }

  /** HP 條上方的回復量（綠字）；text 為空字串時隱藏 */
  async setHealText(text: string, height = 0, x = 0, y = 0) {
    await setBitmapTextImage(this.healText, BATTLE_FONTS.number, text, text ? DAMAGE_NUMBER_COLORS.peach : '', height, x, y, 'center');
  }

  async drawDamageNumber(member: PartyMember, value: number, position: DamageNumberPosition) {
    const y = position === 'above' ? PORTRAIT_TOP - 44 : position === 'atTokenFeet' ? PORTRAIT_TOP - 22 : PORTRAIT_TOP + 4;
    await setBitmapTextImage(member.damageNumber, BATTLE_FONTS.number, String(value), DAMAGE_NUMBER_COLORS[member.faction], position === 'onPortrait' ? 34 : 40, this.centerXOf(member), y, 'center');
  }

  /** 新的傷害到：頭上小兵先收起，數字在頭像上出現 → 移到上方往上數 → 落回頭像，小兵再出現（v1 119 433～119 900） */
  queueDamageCountUp(member: PartyMember) {
    member.counting = member.counting.then(() => this.countUpDamage(member, Math.round(member.damage)));
  }

  private async countUpDamage(member: PartyMember, to: number) {
    member.token.style.display = 'none';
    await this.drawDamageNumber(member, member.shownDamage, 'onPortrait');
    await wait(matchTiming.damageNumberLiftMs);
    const from = member.shownDamage, startedAt = performance.now();
    for (;;) {
      const progress = Math.min(1, (performance.now() - startedAt) / matchTiming.damageCountUpMs);
      member.shownDamage = Math.round(from + (to - from) * progress);
      await this.drawDamageNumber(member, member.shownDamage, 'above');
      if (progress >= 1) break;
      await nextFrame();
    }
    await wait(matchTiming.damageSettleMs);
    await this.drawDamageNumber(member, member.shownDamage, 'onPortrait');
    this.showToken(member, 'raiseHand');
  }

  /** 顯示頭上小兵；hopHeight＞0 時往上跳起 */
  showToken(member: PartyMember, pose: PiecePose, hopHeight = 0) {
    paintPieceSprite(member.tokenSprite, member.faction, pose);
    member.token.style.display = 'block';
    member.token.style.transform = translateUnits(this.centerXOf(member), PORTRAIT_TOP - 18 - hopHeight);
  }

  /** 等所有武將的數字動畫播完 */
  async waitForCounting() { await Promise.all(this.members.map((member) => member.counting)); }

  /** 回合結束：清除傷害、隱藏頭上小兵與數字 */
  resetAfterAttack() {
    for (const member of this.members) {
      member.damage = 0; member.shownDamage = 0;
      member.token.style.display = 'none'; member.damageNumber.style.display = 'none';
    }
  }
}
