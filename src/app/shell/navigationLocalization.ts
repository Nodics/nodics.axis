import {
  navigationDisplayLabel,
  type AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisLocalizationState } from '../../localization/localizationContracts';
export function localizeNavigationItem<T extends AxisNavigationItem>(
  item: T,
  format: AxisLocalizationState['format'],
): T {
  const key =
    item.labelKey ||
    'axis.navigation.' + item.moduleName.toLowerCase() + '.' + item.id.toLowerCase();
  const label =
    item.labelKey ||
    (format(key + '.source', '') !== '' &&
      navigationDisplayLabel(format(key + '.source', '')) ===
        navigationDisplayLabel(item.label))
      ? format(key, item.label)
      : item.label;
  return label === item.label ? item : { ...item, label };
}
export function localizeNavigationGroup(
  id: string,
  label: string,
  format: AxisLocalizationState['format'],
): string {
  const key = 'axis.navigation-group.' + id;
  const source = format(key + '.source', '');
  return source !== '' &&
    navigationDisplayLabel(source) === navigationDisplayLabel(label)
    ? format(key, label)
    : label;
}
