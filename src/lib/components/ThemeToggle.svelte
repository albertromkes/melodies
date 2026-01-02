<script lang="ts">
  import type { Theme } from '../types/music';

  interface Props {
    theme: Theme;
    onToggle: () => void;
  }

  let { theme, onToggle }: Props = $props();
</script>

<button
  class="theme-toggle"
  onclick={onToggle}
  aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
>
  {#if theme === 'light'}
    <span class="icon">🌙</span>
  {:else}
    <span class="icon">☀️</span>
  {/if}
</button>

<style>
  .theme-toggle {
    position: fixed;
    top: 1rem;
    right: 1rem;
    width: 44px;
    height: 44px;
    border: 1px solid var(--border-color);
    border-radius: 50%;
    background: var(--card-bg);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    z-index: 100;
  }

  .theme-toggle:hover {
    border-color: var(--primary-color);
    transform: scale(1.05);
  }

  .icon {
    font-size: 1.25rem;
  }
</style>
