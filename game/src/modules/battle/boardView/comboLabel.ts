/** 「N連擊」：原版字型 BFComboNumber，先紅後黃（v5 149224 → 149438） */
import { designUnit, translateUnits } from '@core/stage/stage';
import { renderBitmapText } from '@ui/bitmapText';
import { BATTLE_FONTS } from '../assets/battleAssets';
import { matchTiming } from '../timing/battleTiming';

/** 字高（v5 149 706 量測）：數字 32、連擊 30 */
const NUMBER_HEIGHT = 32;
const WORD_HEIGHT = 30;

export async function createComboLabel(parent: HTMLElement, combo: number, x: number, y: number): Promise<HTMLElement> {
  const [number, word] = await Promise.all([renderBitmapText(BATTLE_FONTS.comboNumber, String(combo)), renderBitmapText(BATTLE_FONTS.comboNumber, '連撃')]);
  const label = document.createElement('div');
  label.className = 'combo-label';
  label.style.transform = translateUnits(x, y);
  const numberWidth = number.width * (NUMBER_HEIGHT / number.height), wordWidth = word.width * (WORD_HEIGHT / word.height);
  label.innerHTML = `<i style="background:url(${number.url}) 0 0/100% 100%;width:${designUnit(numberWidth)};height:${designUnit(NUMBER_HEIGHT)};left:${designUnit(-numberWidth / 2)};top:${designUnit(-NUMBER_HEIGHT)}"></i>`
    + `<i style="background:url(${word.url}) 0 0/100% 100%;width:${designUnit(wordWidth)};height:${designUnit(WORD_HEIGHT)};left:${designUnit(-wordWidth / 2)};top:0"></i>`;
  parent.appendChild(label);
  const reddish = 'hue-rotate(-40deg) saturate(1.6)';
  label.animate([{ opacity: 0, filter: reddish }, { opacity: 1, filter: reddish, offset: 0.3 }, { opacity: 1, filter: 'none' }], { duration: matchTiming.comboLabelColorMs + 50, fill: 'forwards' });
  return label;
}
