/** 戰鬥畫面最上方（固定在螢幕頂端）：寶箱數、勢力相剋圖、Menu 鈕 */
import { getAssetSize, getAssetUrl } from '@core/assets/assetLoader';
import { designUnit } from '@core/stage/stage';
import { BATTLE_ASSETS, BATTLE_FONTS } from '../../assets/battleAssets';
import { LAYOUT_PART, layoutPartStyle } from '../../assets/atlasParts';
import { createImageElement, setBitmapTextImage } from '../battleLayout';

/** 勢力相剋圖的縮放（v5：x366～411、y100～ 的五角形，約 80 設計單位寬） */
const RELATION_CHART_SCALE = 0.57;

export class BattleTopBar {
  readonly element: HTMLDivElement;
  private chestCount: HTMLElement;

  constructor(parent: HTMLElement) {
    const bar = (this.element = document.createElement('div'));
    bar.className = 'battle-top-bar';
    parent.appendChild(bar);

    createImageElement(bar, { ...layoutPartStyle(LAYOUT_PART.chest, 0.45), left: designUnit(8), top: designUnit(48) });
    this.chestCount = createImageElement(bar);
    void this.setChestCount(0);

    const scale = RELATION_CHART_SCALE;
    createImageElement(bar, {
      left: designUnit(545 - 54 * scale), top: designUnit(107 - 4 * scale), width: designUnit(248 * scale), height: designUnit(142 * scale),
      backgroundImage: `url(${getAssetUrl(BATTLE_ASSETS.factionRelationChart)})`, backgroundSize: '100% 100%',
    });

    const menuSize = getAssetSize(BATTLE_ASSETS.menuButton);
    const menu = createImageElement(null, {
      left: designUnit(493), top: designUnit(46), width: designUnit(menuSize.width * 0.95), height: designUnit(menuSize.height * 0.95),
      backgroundImage: `url(${getAssetUrl(BATTLE_ASSETS.menuButton)})`, backgroundSize: '100% 100%',
    });
    createImageElement(menu, { ...layoutPartStyle(LAYOUT_PART.menuText, 0.8, -90), left: designUnit(48), top: designUnit(-12) });
    bar.appendChild(menu);
  }

  /** 寶箱數 */
  async setChestCount(count: number) {
    await setBitmapTextImage(this.chestCount, BATTLE_FONTS.number, String(count), '#ffffff', 30, 52, 47);
  }
}
