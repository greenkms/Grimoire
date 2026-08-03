interface ComparableMode {
  description?: string;
  id: string;
  name: string;
}

interface ComparableDiscoveredModel {
  description?: string;
  label: string;
  rawId: string;
}

interface ComparableOption {
  description?: string;
  label: string;
  value: string;
}

export function sameStringList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length
    && left.every((entry, index) => entry === right[index]);
}

export function sameStringMap(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): boolean {
  const leftEntries = Object.entries(left);
  return leftEntries.length === Object.keys(right).length
    && leftEntries.every(([key, value]) => right[key] === value);
}

export function sameModes(
  left: readonly ComparableMode[],
  right: readonly ComparableMode[],
): boolean {
  return left.length === right.length && left.every((mode, index) => (
    mode.id === right[index]?.id
    && mode.name === right[index]?.name
    && (mode.description ?? '') === (right[index]?.description ?? '')
  ));
}

export function sameDiscoveredModels(
  left: readonly ComparableDiscoveredModel[],
  right: readonly ComparableDiscoveredModel[],
): boolean {
  return left.length === right.length && left.every((model, index) => (
    model.rawId === right[index]?.rawId
    && model.label === right[index]?.label
    && (model.description ?? '') === (right[index]?.description ?? '')
  ));
}

export function sameThinkingOptionsByModel(
  left: Readonly<Record<string, readonly ComparableOption[]>>,
  right: Readonly<Record<string, readonly ComparableOption[]>>,
): boolean {
  const leftEntries = Object.entries(left);
  if (leftEntries.length !== Object.keys(right).length) {
    return false;
  }

  return leftEntries.every(([rawId, leftOptions]) => {
    const rightOptions = right[rawId] ?? [];
    return leftOptions.length === rightOptions.length
      && leftOptions.every((option, index) => (
        option.value === rightOptions[index]?.value
        && option.label === rightOptions[index]?.label
        && (option.description ?? '') === (rightOptions[index]?.description ?? '')
      ));
  });
}
