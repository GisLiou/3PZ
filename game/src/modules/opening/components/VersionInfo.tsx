/** 標題畫面下方的 Group / ID / Version 字樣 */
import { designUnit } from '@core/stage/stage';
import { TextLabel } from '@ui/components';
import { accountService } from '@modules/account';

export const GAME_VERSION = 'Version 0.1.0';

export function VersionInfo() {
  const shortAccountId = (accountService.current?.id ?? '').slice(0, 9).toUpperCase();
  return (
    <>
      <TextLabel x={14} style={{ bottom: designUnit(52) }} size={20} stroke={3}>Group:A</TextLabel>
      <TextLabel x={14} style={{ bottom: designUnit(14) }} size={20} stroke={3}>{`ID: ${shortAccountId}`}</TextLabel>
      <TextLabel style={{ right: designUnit(14), bottom: designUnit(14) }} size={20} stroke={3}>{GAME_VERSION}</TextLabel>
    </>
  );
}
