<script lang="ts">
  import type { PsalmData, Theme, UserPreferences } from './lib/types/music';
  import type { Category } from './lib/types';
  import type { ActiveSetlist, NavigationContext } from './lib/types/setlist';
  import { allSongs, getCategories } from './lib/data';
  import SongList from './lib/components/SongList.svelte';
  import { setupBackButtonHandler, exitApp, setStatusBarTheme, isNativePlatform, getPlatform } from './lib/utils/capacitor';
  import { clampTranspose } from './lib/constants/transposition';
  import {
    addSongToSetlist,
    clearSetlist,
    createDefaultActiveSetlist,
    getNextSetlistItem,
    getPreviousSetlistItem,
    loadActiveSetlist,
    moveSetlistItemDown,
    moveSetlistItemUp,
    removeSetlistItem,
    resolveRenderableSetlistItems,
    saveActiveSetlist,
    updateSetlistItemTranspose,
  } from './lib/utils/setlist';

  type PsalmDetailComponentType = typeof import('./lib/components/PsalmDetail.svelte').default;
  type SettingsComponentType = typeof import('./lib/components/Settings.svelte').default;
  type SetlistPanelComponentType = typeof import('./lib/components/SetlistPanel.svelte').default;

  // Default preferences
  const DEFAULT_PREFERENCES: UserPreferences = {
    showLyricsByDefault: true,
    showChordsByDefault: false,
    showVerseWatermark: true,
  };

  // Application state
  let currentView = $state<'list' | 'detail'>('list');
  let selectedSong = $state<PsalmData | null>(null);
  const categories: Category[] = getCategories();
  // Default to psalmen category explicitly
  let selectedCategory = $state<string | null>('psalmen');
  let searchQuery = $state('');
  let searchInVerses = $state(false);
  let useFuzzyVerseSearch = $state(false);
  let theme = $state<Theme>('dark');
  let showSettings = $state(false);
  let showSetlist = $state(false);
  let PsalmDetailComponent = $state<PsalmDetailComponentType | null>(null);
  let SettingsComponent = $state<SettingsComponentType | null>(null);
  let SetlistPanelComponent = $state<SetlistPanelComponentType | null>(null);
  let activeSetlist = $state<ActiveSetlist>(createDefaultActiveSetlist());
  let navigationContext = $state<NavigationContext>({ type: 'category' });
  let setlistToast = $state<string | null>(null);
  let hasLoadedActiveSetlist = $state(false);

  // Back button state management
  let lastSearchType = $state<'number' | 'text' | null>(null);
  let hasNavigatedFromSearch = $state(false);

  // Song-level transposition persistence (key: songId, value: semitones)
  let songTranspositions = $state<Record<string, number>>({});
  let setlistToastTimeout: ReturnType<typeof setTimeout> | null = null;

  // User preferences state
  let preferences = $state<UserPreferences>({ ...DEFAULT_PREFERENCES });
  const nativeApp = isNativePlatform();
  const platform = nativeApp ? getPlatform() : 'web';

  // Get songs in current category for navigation
  let songsInCurrentCategory = $derived.by(() => {
    if (!selectedSong) return [];
    const currentCategory = selectedSong.category;
    return allSongs
      .filter(s => s.category === currentCategory)
      .sort((a, b) => a.number - b.number);
  });

  // Current song index for navigation
  let currentSongIndex = $derived.by(() => {
    if (!selectedSong) return -1;
    return songsInCurrentCategory.findIndex(s => s.id === selectedSong!.id);
  });

  let renderableSetlistItems = $derived.by(() => {
    return resolveRenderableSetlistItems(activeSetlist, allSongs);
  });

  let currentSetlistItem = $derived.by(() => {
    if (navigationContext.type !== 'setlist') return null;
    const itemId = navigationContext.itemId;
    return activeSetlist.items.find((item) => item.id === itemId) ?? null;
  });

  let currentSetlistRenderableIndex = $derived.by(() => {
    if (!currentSetlistItem) return -1;
    return renderableSetlistItems.findIndex(({ item }) => item.id === currentSetlistItem.id);
  });

  let setlistPositionLabel = $derived.by(() => {
    if (currentSetlistRenderableIndex < 0) return null;
    return `Dienst ${currentSetlistRenderableIndex + 1}/${renderableSetlistItems.length}`;
  });

  // Current song transposition (loads from object, defaults to 0)
  let currentTransposeSemitones = $derived.by(() => {
    if (!selectedSong) return 0;
    if (navigationContext.type === 'setlist') {
      return currentSetlistItem?.transposeSemitones ?? 0;
    }
    return songTranspositions[selectedSong.id] ?? 0;
  });

  // Navigation availability
  let hasNextSong = $derived.by(() => {
    if (navigationContext.type === 'setlist') {
      return currentSetlistRenderableIndex >= 0 && currentSetlistRenderableIndex < renderableSetlistItems.length - 1;
    }

    return currentSongIndex >= 0 && currentSongIndex < songsInCurrentCategory.length - 1;
  });

  let hasPreviousSong = $derived.by(() => {
    if (navigationContext.type === 'setlist') {
      return currentSetlistRenderableIndex > 0;
    }

    return currentSongIndex > 0;
  });

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
    void setStatusBarTheme(theme === 'dark');
  });

  // Load preferences from localStorage on mount
  $effect(() => {
    const savedPreferences = localStorage.getItem('psalm-app-preferences');
    if (savedPreferences) {
      try {
        const parsed = JSON.parse(savedPreferences);
        preferences = { ...DEFAULT_PREFERENCES, ...parsed };
      } catch {
        // Keep defaults if JSON is invalid
      }
    }
  });

  // Save preferences to localStorage when they change
  $effect(() => {
    localStorage.setItem('psalm-app-preferences', JSON.stringify(preferences));
  });

  // Load active setlist once on mount
  $effect(() => {
    if (hasLoadedActiveSetlist) {
      return;
    }

    const validSongIds = new Set(allSongs.map((song) => song.id));
    const loadedSetlist = loadActiveSetlist();
    const items = loadedSetlist.items.filter((item) => validSongIds.has(item.songId));

    activeSetlist = items.length === loadedSetlist.items.length
      ? loadedSetlist
      : {
          ...loadedSetlist,
          items,
          updatedAt: Date.now(),
        };

    hasLoadedActiveSetlist = true;
  });

  // Save setlist whenever it changes
  $effect(() => {
    if (!hasLoadedActiveSetlist) {
      return;
    }

    saveActiveSetlist(activeSetlist);
  });

  // Setup hardware back button handler on mount
  $effect(() => {
    let disposed = false;
    let removeListener: (() => void) | void;

    void setupBackButtonHandler(handleHardwareBackButton).then((cleanup) => {
      if (disposed) {
        cleanup?.();
        return;
      }
      removeListener = cleanup;
    });

    return () => {
      disposed = true;
      removeListener?.();
    };
  });

  // Lazy-load detail view component (includes heavy rendering path)
  $effect(() => {
    if (currentView === 'detail' && !PsalmDetailComponent) {
      void import('./lib/components/PsalmDetail.svelte').then((module) => {
        PsalmDetailComponent = module.default;
      });
    }
  });

  // Lazy-load settings component
  $effect(() => {
    if (showSettings && !SettingsComponent) {
      void import('./lib/components/Settings.svelte').then((module) => {
        SettingsComponent = module.default;
      });
    }
  });

  // Lazy-load setlist component
  $effect(() => {
    if (showSetlist && !SetlistPanelComponent) {
      void import('./lib/components/SetlistPanel.svelte').then((module) => {
        SetlistPanelComponent = module.default;
      });
    }
  });

  $effect(() => {
    return () => {
      if (setlistToastTimeout) {
        clearTimeout(setlistToastTimeout);
      }
    };
  });

  function handleSelectSong(song: PsalmData) {
    selectedSong = song;
    currentView = 'detail';
    navigationContext = { type: 'category' };
    resetDetailScroll();
    
    // Track if we navigated from a search
    if (searchQuery.trim()) {
      hasNavigatedFromSearch = true;
    }
    
    // Transposition will be loaded automatically via derived state
  }

  function handleBack() {
    currentView = 'list';
    selectedSong = null;
    navigationContext = { type: 'category' };
  }

  function resetDetailScroll() {
    if (typeof window === 'undefined') {
      return;
    }

    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }

  function handleClearSearch() {
    searchQuery = '';
    lastSearchType = null;
    hasNavigatedFromSearch = false;
  }

  // Enhanced hardware back button handler
  function handleHardwareBackButton() {
    if (showSettings) {
      closeSettings();
      return;
    }

    if (showSetlist) {
      closeSetlist();
      return;
    }

    if (currentView === 'detail') {
      // Always go back to list from detail
      handleBack();
    } else if (currentView === 'list') {
      // On list screen: handle search or exit
      if (searchQuery.trim()) {
        if (lastSearchType === 'number' && hasNavigatedFromSearch) {
          // Clear number search and exit search context
          handleClearSearch();
        } else {
          // Text search or haven't navigated: exit app
          exitApp();
        }
      } else {
        // Not searching: exit app
        exitApp();
      }
    }
  }

  function handleNextSong() {
    if (navigationContext.type === 'setlist') {
      const nextItem = getNextSetlistItem(activeSetlist, navigationContext.itemId);
      if (!nextItem) {
        return;
      }

      const song = allSongs.find((entry) => entry.id === nextItem.songId);
      if (!song) {
        return;
      }

      selectedSong = song;
      navigationContext = { type: 'setlist', itemId: nextItem.id };
      resetDetailScroll();
      return;
    }

    if (hasNextSong) {
      selectedSong = songsInCurrentCategory[currentSongIndex + 1];
      resetDetailScroll();
    }
  }

  function handlePreviousSong() {
    if (navigationContext.type === 'setlist') {
      const previousItem = getPreviousSetlistItem(activeSetlist, navigationContext.itemId);
      if (!previousItem) {
        return;
      }

      const song = allSongs.find((entry) => entry.id === previousItem.songId);
      if (!song) {
        return;
      }

      selectedSong = song;
      navigationContext = { type: 'setlist', itemId: previousItem.id };
      resetDetailScroll();
      return;
    }

    if (hasPreviousSong) {
      selectedSong = songsInCurrentCategory[currentSongIndex - 1];
      resetDetailScroll();
    }
  }

  function handleSelectCategory(categoryId: string | null) {
    selectedCategory = categoryId;
  }

  function handleSearchChange(query: string, searchType?: 'number' | 'text') {
    searchQuery = query;
    lastSearchType = query.trim() ? (searchType || null) : null;
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

  function handleTransposeChange(newTranspose: number) {
    if (!selectedSong) {
      return;
    }

    const clampedTranspose = clampTranspose(newTranspose);

    if (navigationContext.type === 'setlist') {
      handleUpdateCurrentSetlistItemTranspose(clampedTranspose);
      return;
    }

    songTranspositions[selectedSong.id] = clampedTranspose;
  }

  function openSettings() {
    showSettings = true;
  }

  function closeSettings() {
    showSettings = false;
  }

  function openSetlist() {
    showSettings = false;
    showSetlist = true;
  }

  function closeSetlist() {
    showSetlist = false;
  }

  function handleAddCurrentSongToSetlist() {
    if (!selectedSong) {
      return;
    }

    activeSetlist = addSongToSetlist(activeSetlist, selectedSong.id, currentTransposeSemitones);
    setlistToast = 'Toegevoegd aan dienstlijst';

    if (setlistToastTimeout) {
      clearTimeout(setlistToastTimeout);
    }

    setlistToastTimeout = setTimeout(() => {
      setlistToast = null;
      setlistToastTimeout = null;
    }, 1000);
  }

  function handleOpenSongFromSetlist(itemId: string) {
    const item = activeSetlist.items.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    const song = allSongs.find((entry) => entry.id === item.songId);
    if (!song) {
      return;
    }

    selectedSong = song;
    currentView = 'detail';
    navigationContext = { type: 'setlist', itemId };
    resetDetailScroll();
    closeSetlist();
  }

  function handleRemoveSetlistItem(itemId: string) {
    const isCurrentItem = navigationContext.type === 'setlist' && navigationContext.itemId === itemId;
    const nextSetlist = removeSetlistItem(activeSetlist, itemId);

    activeSetlist = nextSetlist;

    if (isCurrentItem) {
      currentView = 'list';
      selectedSong = null;
      navigationContext = { type: 'category' };
    }
  }

  function handleMoveSetlistItemUp(itemId: string) {
    activeSetlist = moveSetlistItemUp(activeSetlist, itemId);
  }

  function handleMoveSetlistItemDown(itemId: string) {
    activeSetlist = moveSetlistItemDown(activeSetlist, itemId);
  }

  function handleClearSetlist() {
    const wasInSetlistContext = navigationContext.type === 'setlist';
    activeSetlist = clearSetlist(activeSetlist);

    if (wasInSetlistContext) {
      currentView = 'list';
      selectedSong = null;
      navigationContext = { type: 'category' };
    }
  }

  function handleUpdateCurrentSetlistItemTranspose(newTranspose: number) {
    if (navigationContext.type !== 'setlist') {
      return;
    }

    activeSetlist = updateSetlistItemTranspose(activeSetlist, navigationContext.itemId, newTranspose);
  }

  function handleUpdatePreferences(updates: Partial<UserPreferences>) {
    preferences = { ...preferences, ...updates };
  }

  // Get app title based on selected category
  let appTitle = $derived.by(() => {
    if (!selectedCategory) return 'Alle liederen';
    const cat = categories.find(c => c.id === selectedCategory);
    return cat?.name || 'Liederen';
  });
</script>

<div
  class="app"
  class:list-view={currentView === 'list'}
  class:detail-view={currentView === 'detail'}
  class:native-app={nativeApp}
  class:android-app={platform === 'android'}
  class:web-app={!nativeApp}
>

  {#if currentView === 'list'}
    <header class="app-header">
      <h1>{appTitle}</h1>
      <p class="subtitle">Kies een lied om de melodie te bekijken</p>
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
        onOpenSettings={openSettings}
      />
    </main>
  {:else if currentView === 'detail' && selectedSong}
    <main>
      {#if PsalmDetailComponent}
        <PsalmDetailComponent
          psalm={selectedSong}
          transposeSemitones={currentTransposeSemitones}
          showLyricsByDefault={preferences.showLyricsByDefault}
          showChordsByDefault={preferences.showChordsByDefault}
          showVerseWatermark={preferences.showVerseWatermark}
          onTransposeChange={handleTransposeChange}
          onBack={handleBack}
          onNextSong={handleNextSong}
          onPreviousSong={handlePreviousSong}
          {hasNextSong}
          {hasPreviousSong}
          onToggleTheme={toggleTheme}
          onAddToSetlist={handleAddCurrentSongToSetlist}
          {setlistPositionLabel}
        />
      {:else}
        <div class="view-loading">Melodie laden...</div>
      {/if}
    </main>
  {/if}

  {#if showSettings}
    {#if SettingsComponent}
      <SettingsComponent
        {theme}
        {preferences}
        setlistCount={activeSetlist.items.length}
        onOpenSetlist={openSetlist}
        onToggleTheme={toggleTheme}
        onUpdatePreferences={handleUpdatePreferences}
        onClose={closeSettings}
      />
    {/if}
  {/if}

  {#if showSetlist}
    {#if SetlistPanelComponent}
      <SetlistPanelComponent
        setlistName={activeSetlist.name}
        items={renderableSetlistItems}
        activeItemId={navigationContext.type === 'setlist' ? navigationContext.itemId : null}
        onOpenItem={handleOpenSongFromSetlist}
        onMoveItemUp={handleMoveSetlistItemUp}
        onMoveItemDown={handleMoveSetlistItemDown}
        onRemoveItem={handleRemoveSetlistItem}
        onClear={handleClearSetlist}
        onClose={closeSetlist}
      />
    {/if}
  {/if}

  {#if setlistToast}
    <div class="setlist-toast" role="status" aria-live="polite">{setlistToast}</div>
  {/if}
</div>

<style>
  .app {
    min-height: 100vh;
    min-height: 100dvh;
    --list-safe-top: 0px;
    --detail-safe-top: 0px;
    --detail-safe-bottom: 0px;
  }

  .app.native-app {
    --list-safe-top: var(--safe-area-top);
    --detail-safe-top: var(--safe-area-top);
    --detail-safe-bottom: var(--safe-area-bottom);
  }

  .app.list-view {
    padding-bottom: calc(2rem + var(--detail-safe-bottom));
  }

  .app-header {
    text-align: center;
    padding: calc(var(--list-safe-top) + 2rem) calc(1rem + var(--safe-area-right)) 1rem calc(1rem + var(--safe-area-left));
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

  .view-loading {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 50vh;
    color: var(--muted-color);
    font-size: 1rem;
  }

  .setlist-toast {
    position: fixed;
    left: 50%;
    bottom: calc(6.2rem + var(--detail-safe-bottom));
    transform: translateX(-50%);
    padding: 0.7rem 1rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--bg-color) 84%, black 16%);
    color: var(--text-color);
    border: 1px solid color-mix(in srgb, var(--border-color) 70%, transparent 30%);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16);
    z-index: 1100;
    font-size: 0.9rem;
    white-space: nowrap;
  }
</style>
