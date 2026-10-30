/** 回合各階段共用的戰鬥畫面零件（由 BattleScreen 提供） */
import type { BoardView } from '../../boardView/BoardView';
import type { EnemyLayer } from '../enemies/enemyLayer';
import type { PartyPanel } from '../party/partyPanel';

export interface BattleContext {
  /** 整個戰鬥畫面的根元素（全畫面泛紅、晃動用） */
  readonly screenElement: HTMLElement;
  /** 效果層：小兵、魂、數字、命中特效都畫在這層，可跨區移動 */
  readonly effectLayer: HTMLElement;
  readonly board: BoardView;
  readonly party: PartyPanel;
  readonly enemyLayer: EnemyLayer;
}
