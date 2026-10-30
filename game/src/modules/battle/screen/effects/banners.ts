/** 戰鬥中的大字演出：「合戰 n/m」與「勝利！」 */
import { getAssetSize, getAssetUrl } from '@core/assets/assetLoader';
import { designUnit } from '@core/stage/stage';
import { renderBitmapText } from '@ui/bitmapText';
import { BATTLE_ASSETS, BATTLE_FONTS } from '../../assets/battleAssets';
import { attackTiming } from '../../timing/battleTiming';

/** 「合戰 n/m」（原版字型 BF_BattleCnt ＋ BF_BattleCntNum）淡入、停留、淡出 */
export async function playWaveBanner(layer: HTMLElement, wave: number, totalWaves: number) {
  const banner = document.createElement('div');
  Object.assign(banner.style, { position: 'absolute', left: '0', top: '0' });
  const [label, number] = await Promise.all([renderBitmapText(BATTLE_FONTS.waveLabel, '合戦'), renderBitmapText(BATTLE_FONTS.waveNumber, `${wave}/${totalWaves}`)]);
  const height = 64, gap = 14, top = 126;
  const labelWidth = label.width * height / label.height, numberWidth = number.width * height / number.height;
  const left = 320 - (labelWidth + gap + numberWidth) / 2;
  banner.innerHTML = `<i style="left:${designUnit(left)};top:${designUnit(top)};width:${designUnit(labelWidth)};height:${designUnit(height)};background:url(${label.url}) 0 0/100% 100%"></i>`
    + `<i style="left:${designUnit(left + labelWidth + gap)};top:${designUnit(top)};width:${designUnit(numberWidth)};height:${designUnit(height)};background:url(${number.url}) 0 0/100% 100%"></i>`;
  layer.appendChild(banner);
  await banner.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: attackTiming.waveBannerMs }).finished;
  banner.remove();
}

/** 「勝利！」：win_efe01～03 三個字依序縮放出現，再亮起背後的光 win_efe04。回傳整個圖層（由呼叫端決定何時移除） */
export async function playVictory(layer: HTMLElement): Promise<HTMLElement> {
  const victory = document.createElement('div');
  Object.assign(victory.style, { position: 'absolute', inset: '0' });
  const light = getAssetSize(BATTLE_ASSETS.victoryLight);
  const charIds = [BATTLE_ASSETS.victoryChar1, BATTLE_ASSETS.victoryChar2, BATTLE_ASSETS.victoryChar3];
  const charLefts = [70, 250, 470];
  victory.innerHTML = `<i class="victory-light" style="left:${designUnit(320 - light.width)};top:${designUnit(250 - light.height)};width:${designUnit(light.width * 2)};height:${designUnit(light.height * 2)};background:url(${getAssetUrl(BATTLE_ASSETS.victoryLight)}) 0 0/100% 100%"></i>`
    + charIds.map((id, index) => {
      const size = getAssetSize(id);
      return `<i class="victory-char" style="left:${designUnit(charLefts[index]!)};top:${designUnit(170)};width:${designUnit(size.width)};height:${designUnit(size.height)};background:url(${getAssetUrl(id)}) 0 0/100% 100%"></i>`;
    }).join('');
  layer.appendChild(victory);
  const chars = [...victory.querySelectorAll<HTMLElement>('.victory-char')];
  await Promise.all(chars.map((char, index) => char.animate(
    [{ transform: 'scale(2.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
    { duration: attackTiming.victoryCharMs, delay: index * attackTiming.victoryCharGapMs, fill: 'backwards', easing: 'ease-out' },
  ).finished));
  victory.querySelector<HTMLElement>('.victory-light')!.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 300, fill: 'forwards' });
  return victory;
}
