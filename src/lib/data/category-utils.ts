import categoryConfig from './category-config.json';

const { aliases, displayNames, primaryCategory } = categoryConfig;

export function normalizeCategoryId(categoryId: string | undefined): string {
  if (!categoryId) return 'unknown';
  const normalized = categoryId.toLowerCase();
  return aliases[normalized as keyof typeof aliases] ?? normalized;
}

export function isPrimaryCategory(categoryId: string): boolean {
  return normalizeCategoryId(categoryId) === primaryCategory;
}

export function getCategoryDisplayName(categoryId: string): string {
  const normalized = normalizeCategoryId(categoryId);
  return displayNames[normalized as keyof typeof displayNames] ?? capitalizeFirst(normalized);
}

function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
