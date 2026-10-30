/** 「注意」：黑底白字，停留 openingTiming.noticeHoldMs 後硬切到標題 */
import { useEffect } from 'react';
import { sceneRouter } from '@core/navigation/sceneRouter';
import { TextLabel } from '@ui/components';
import { openingTiming } from '../openingTiming';

export function NoticeScene() {
  useEffect(() => {
    const timer = setTimeout(() => sceneRouter.replace('title'), openingTiming.noticeHoldMs);
    sceneRouter.setBackHandler(() => false);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="scene" style={{ background: '#000' }}>
      <TextLabel x={0} w={640} y={204} size={26} align="center" stroke={0}>注意</TextLabel>
      <TextLabel x={40} w={560} y={322} size={24} align="center" stroke={0}>本遊戲為免費遊玩，部分道具付費制。</TextLabel>
      <TextLabel x={20} w={600} y={398} size={24} align="center" stroke={0}>{'未成年者在購買付費道具時，需得到監護\n人的許可，或者在監護人的陪同下購買。'}</TextLabel>
      <TextLabel x={30} w={580} y={520} size={24} align="center" stroke={0} color="#ffe23a">{'※進行遊戲時若有出現遊戲不正常關閉問\n題，請嘗試關閉其他執行中的APP，即可\n解決此問題。'}</TextLabel>
    </div>
  );
}
