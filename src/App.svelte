<script lang="ts">
  import type { PsalmData, Theme } from './lib/types/music';
  import { psalms } from './lib/data/psalms';
  import PsalmList from './lib/components/PsalmList.svelte';
  import PsalmDetail from './lib/components/PsalmDetail.svelte';
  import ThemeToggle from './lib/components/ThemeToggle.svelte';

  // Application state
  let currentView = $state<'list' | 'detail'>('list');
  let selectedPsalm = $state<PsalmData | null>(null);
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

  function handleSelectPsalm(psalm: PsalmData) {
    selectedPsalm = psalm;
    currentView = 'detail';
  }

  function handleBack() {
    currentView = 'list';
    selectedPsalm = null;
  }

  function handleSearchChange(query: string) {
    searchQuery = query;
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
</script>

<div class="app">
  <ThemeToggle {theme} onToggle={toggleTheme} />

  {#if currentView === 'list'}
    <header class="app-header">
      <h1>Psalm Melodies</h1>
      <p class="subtitle">Select a psalm to view its melody</p>
    </header>
    
    <main>
      <PsalmList
        {psalms}
        {searchQuery}
        {searchInVerses}
        {useFuzzyVerseSearch}
        onSelectPsalm={handleSelectPsalm}
        onSearchChange={handleSearchChange}
        onSearchInVersesChange={handleSearchInVersesChange}
        onUseFuzzyChange={handleUseFuzzyChange}
      />
    </main>
  {:else if currentView === 'detail' && selectedPsalm}
    <main>
      <PsalmDetail
        psalm={selectedPsalm}
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
