/** 尚未復刻的畫面（顯示「尚在復刻中」，見 docs/開發步驟.md） */
import { TextLabel } from '@ui/components';

export function PlaceholderScene({ title }: { title: string }) {
  return (
    <div className="scene" style={{ background: '#000' }}>
      <TextLabel x={0} w={640} y={440} size={28} align="center" stroke={0}>{`「${title}」尚在復刻中`}</TextLabel>
      <TextLabel x={0} w={640} y={490} size={20} align="center" stroke={0} color="#aaa">見 docs/開發步驟.md</TextLabel>
    </div>
  );
}
