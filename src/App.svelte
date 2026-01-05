<script lang="ts">
  import type { PsalmData, Theme } from './lib/types/music';
  import type { Category } from './lib/types';
  import { allSongs, getCategories } from './lib/data';
  import SongList from './lib/components/SongList.svelte';
  import PsalmDetail from './lib/components/PsalmDetail.svelte';
  import ThemeToggle from './lib/components/ThemeToggle.svelte';

  // Application state
  let currentView = $state<'list' | 'detail'>('list');
  let selectedSong = $state<PsalmData | null>(null);
  let categories = $state<Category[]>(getCategories());
  // Default to first category (psalms should be first due to sorting)
  let selectedCategory = $state<string | null>(getCategories()[0]?.id ?? null);
  let searchQuery = $state('');
  let searchInVerses = $state(false);
  let useFuzzyVerseSearch = $state(false);
  let theme = $state<Theme>('dark');

  // Load theme from localStorage on mount
  $effect(() => {
    const savedTheme = localStorage.getItem('psalm-app-theme') as Theme | null;
    if (savedTheme) {
      theme = savedTheme;
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      theme = 'light';
    }
  });

  // Apply theme to document
  $effect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('psalm-app-theme', theme);
  });

  function handleSelectSong(song: PsalmData) {
    selectedSong = song;
    currentView = 'detail';
  }

  function handleBack() {
    currentView = 'list';
    selectedSong = null;
  }

  function handleSelectCategory(categoryId: string | null) {
    selectedCategory = categoryId;
  }

  function handleSearchChange(query: string) {
    searchQuery = query;
    // When searching, search across all categories
    if (query.trim()) {
      // Keep selected category for filtering, don't auto-clear
    }
  }

  function handleSearchInVersesChange(value: boolean) {
    searchInVerses = value;
  }

  function handleUseFuzzyChange(value: boolean) {
    useFuzzyVerseSearch = value;
  }

  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
  }

  // Get app title based on selected category
  let appTitle = $derived.by(() => {
    if (!selectedCategory) return 'All Songs';
    const cat = categories.find(c => c.id === selectedCategory);
    return cat?.name || 'Songs';
  });
</script>

<div class="app">
  <ThemeToggle {theme} onToggle={toggleTheme} />

  {#if currentView === 'list'}
    <header class="app-header">
      <h1>{appTitle}</h1>
      <p class="subtitle">Select a song to view its melody</p>
    </header>
    
    <main>
      <SongList
        songs={allSongs}
        {categories}
        {selectedCategory}
        {searchQuery}
        {searchInVerses}
        {useFuzzyVerseSearch}
        onSelectSong={handleSelectSong}
        onSelectCategory={handleSelectCategory}
        onSearchChange={handleSearchChange}
        onSearchInVersesChange={handleSearchInVersesChange}
        onUseFuzzyChange={handleUseFuzzyChange}
      />
    </main>
  {:else if currentView === 'detail' && selectedSong}
    <main>
      <PsalmDetail
        psalm={selectedSong}
        onBack={handleBack}
      />
    </main>
  {/if}
</div>

<style>
  .app {
    min-height: 100vh;
    padding-bottom: 2rem;
  }

  .app-header {
    text-align: center;
    padding: 2rem 1rem 1rem;
  }

  .app-header h1 {
    margin: 0;
    font-size: 2rem;
    color: var(--primary-color);
  }

  .subtitle {
    margin: 0.5rem 0 0;
    color: var(--muted-color);
    font-size: 1rem;
  }

  main {
    max-width: 800px;
    margin: 0 auto;
  }
</style>
