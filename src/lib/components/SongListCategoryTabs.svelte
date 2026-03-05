<script lang="ts">
  import type { Category } from '../types';

  interface Props {
    categories: Category[];
    selectedCategory: string | null;
    onSelectCategory: (categoryId: string | null) => void;
  }

  let { categories, selectedCategory, onSelectCategory }: Props = $props();
</script>

{#if categories.length > 1}
  <div class="category-selector">
    {#each categories as category (category.id)}
      <button
        class="category-button"
        class:selected={selectedCategory === category.id}
        onclick={() => onSelectCategory(category.id)}
      >
        {category.name}
        <span class="category-count">{category.count}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .category-selector {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .category-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    font-size: 0.9375rem;
    font-weight: 500;
    background: var(--card-bg);
    border: 2px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    color: var(--text-color);
    transition: all 0.2s;
    min-height: 44px;
  }

  .category-button:hover {
    background: var(--card-hover-bg);
    border-color: var(--primary-color);
  }

  .category-button.selected {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
  }

  .category-count {
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
  }

  .category-button.selected .category-count {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
