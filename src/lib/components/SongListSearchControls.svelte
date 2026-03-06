<script lang="ts">
  interface Props {
    useNumberPad: boolean;
    searchQuery: string;
    searchInVerses: boolean;
    useFuzzyVerseSearch: boolean;
    versesIndexLoading: boolean;
    selectedCategory: string | null;
    onSearchInput: (query: string) => void;
    onSearchInVersesChange: (value: boolean) => void;
    onUseFuzzyChange: (value: boolean) => void;
    onOpenSettings: () => void;
  }

  let {
    useNumberPad,
    searchQuery,
    searchInVerses,
    useFuzzyVerseSearch,
    versesIndexLoading,
    selectedCategory,
    onSearchInput,
    onSearchInVersesChange,
    onUseFuzzyChange,
    onOpenSettings,
  }: Props = $props();

  let searchInput: HTMLInputElement | null = null;

  function clearSearch() {
    onSearchInput('');
    searchInput?.focus();
  }
</script>

<div class="search-container">
  <div class="search-header">
    <button class="settings-button" onclick={onOpenSettings} aria-label="Instellingen">
      ⚙️
    </button>
  </div>
  <div class="search-input-wrapper">
    <input
      bind:this={searchInput}
      type={useNumberPad ? 'tel' : 'search'}
      inputmode={useNumberPad ? 'numeric' : undefined}
      pattern={useNumberPad ? '[0-9]*' : undefined}
      placeholder={useNumberPad ? "Zoek psalmnummer..." : `Zoek op nummer, titel${searchInVerses ? ', of verstekst' : ', of tags'}...`}
      value={searchQuery}
      oninput={(e) => onSearchInput(e.currentTarget.value)}
      class="search-input {useNumberPad ? 'numeric-keyboard' : ''}"
      aria-label="Zoek op lied"
    />

    {#if searchQuery}
      <button class="clear-search-button" onclick={clearSearch} aria-label="Zoekopdracht wissen">
        x
      </button>
    {/if}
  </div>

  <div class="search-options">
    <label class="checkbox-label">
      <input
        type="checkbox"
        checked={searchInVerses}
        onchange={(e) => onSearchInVersesChange(e.currentTarget.checked)}
      />
      <span>Zoek in verzen</span>
      {#if versesIndexLoading}
        <span class="loading-indicator">⏳</span>
      {/if}
    </label>

    {#if searchInVerses}
      <label class="checkbox-label">
        <input
          type="checkbox"
          checked={useFuzzyVerseSearch}
          onchange={(e) => onUseFuzzyChange(e.currentTarget.checked)}
          disabled={versesIndexLoading}
        />
        <span>Fuzzy</span>
      </label>
    {/if}
  </div>

  {#if searchQuery && !selectedCategory}
    <p class="search-hint">Zoeken in alle categorieën</p>
  {/if}
</div>

<style>
  .search-container {
    position: sticky;
    top: 0;
    background: var(--bg-color);
    padding: 0.5rem 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .search-header {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 0.5rem;
  }

  .settings-button {
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
    font-size: 1.25rem;
  }

  .settings-button:hover {
    border-color: var(--primary-color);
    transform: scale(1.05);
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 3rem 0.75rem 1rem;
    font-size: 1rem;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    background: var(--input-bg);
    color: var(--text-color);
    transition: border-color 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--primary-color);
  }

  .search-input.numeric-keyboard {
    font-size: 1.5rem;
    letter-spacing: 0.2em;
    text-align: center;
  }

  .search-input-wrapper {
    position: relative;
  }

  .clear-search-button {
    position: absolute;
    top: 50%;
    right: 0.5rem;
    transform: translateY(-50%);
    width: 2rem;
    height: 2rem;
    border: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--border-color) 45%, transparent);
    color: var(--text-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    line-height: 1;
    padding: 0;
  }

  .clear-search-button:hover,
  .clear-search-button:focus-visible {
    background: color-mix(in srgb, var(--primary-color) 22%, var(--input-bg));
    outline: none;
  }

  .search-options {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--muted-color);
    cursor: pointer;
    user-select: none;
  }

  .checkbox-label input[type='checkbox'] {
    width: 1rem;
    height: 1rem;
    cursor: pointer;
    accent-color: var(--primary-color);
  }

  .search-hint {
    font-size: 0.75rem;
    color: var(--muted-color);
    margin: 0;
  }

  .loading-indicator {
    font-size: 0.75rem;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
