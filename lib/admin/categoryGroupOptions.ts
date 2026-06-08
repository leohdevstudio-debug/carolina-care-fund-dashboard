export function buildCategoryGroupOptions(
  groups: Array<string | null | undefined>,
  selectedGroup?: string
): string[] {
  const options = new Set<string>();

  for (const group of [...groups, selectedGroup]) {
    const trimmed = group?.trim();

    if (trimmed) {
      options.add(trimmed);
    }
  }

  return [...options].sort((left, right) => left.localeCompare(right));
}
