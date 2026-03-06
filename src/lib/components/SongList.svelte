<script lang="ts">
  import MiniSearch from 'minisearch';
  import type { PsalmData } from '../types/music';
  import type { Category, SongMeta } from '../types';
  import { isPrimaryCategory, normalizeCategoryId } from '../data/category-utils';
  import { detectNumericSearchType } from '../utils/search';
  import { filterSongs } from './song-list.logic';
  import SongListCategoryTabs from './SongListCategoryTabs.svelte';
  import SongListSearchControls from './SongListSearchControls.svelte';
  import SongListResults from './SongListResults.svelte';

  interface Props {
    songs: PsalmData[];
    categories: Category[];
    selectedCategory: string | null; // null means "all"
    searchQuery: string;
    searchInVerses: boolean;
    useFuzzyVerseSearch: boolean;
    onSelectSong: (song: PsalmData) => void;
    onSelectCategory: (categoryId: string | null) => void;
    onSearchChange: (query: string, searchType?: 'number' | 'text') => void;
    onSearchInVersesChange: (value: boolean) => void;
    onUseFuzzyChange: (value: boolean) => void;
    onOpenSettings: () => void;
  }

  let {
    songs,
    categories,
    selectedCategory,
    searchQuery,
    searchInVerses,
    useFuzzyVerseSearch,
    onSelectSong,
    onSelectCategory,
    onSearchChange,
    onSearchInVersesChange,
    onUseFuzzyChange,
    onOpenSettings
  }: Props = $props();
  
  let songsMeta = $state<SongMeta[]>([]);
  let versesIndex = $state<MiniSearch | null>(null);
  let versesIndexLoading = $state(false);

  // Detect Android for optimized keyboard
  let isAndroid = $state(false);
  let useNumberPad = $state(false);

  // Detect Android platform and check if Psalms category is selected
  $effect(() => {
    isAndroid = navigator.userAgent.includes('Android');
    useNumberPad = isAndroid && (!selectedCategory || isPrimaryCategory(selectedCategory));
  });

  // Load metadata index on mount
  $effect(() => {
    fetch('/search/songs-meta.json')
      .then(res => res.json())
      .then(data => { songsMeta = data; })
      .catch(err => console.warn('Failed to load search metadata:', err));
  });

  // Lazy-load verses index when checkbox enabled
  $effect(() => {
    if (searchInVerses && !versesIndex && !versesIndexLoading) {
      versesIndexLoading = true;
      fetch('/search/verses-index.json')
        .then(res => res.text())
        .then(data => {
          versesIndex = MiniSearch.loadJSON(data, {
            fields: ['text'],
            storeFields: ['songId', 'songNumber', 'category', 'text'],
            idField: 'docId',
          });
          versesIndexLoading = false;
        })
        .catch(err => {
          console.warn('Failed to load verses index:', err);
          versesIndexLoading = false;
        });
    }
  });

  // Filter songs based on selected category (before search)
  let effectiveCategory = $derived(searchQuery.trim() ? null : selectedCategory);

  let categoryFilteredSongs = $derived.by(() => {
    if (!effectiveCategory) return songs;
    const normalizedSelectedCategory = normalizeCategoryId(effectiveCategory);
    return songs.filter((song) => normalizeCategoryId(song.category || 'psalmen') === normalizedSelectedCategory);
  });

  let filteredSongs = $derived.by(() => {
    return filterSongs({
      songs,
      categoryFilteredSongs,
      songsMeta,
      searchQuery,
      searchInVerses,
      useFuzzyVerseSearch,
      versesIndex,
    });
  });

  // Detect if search is primarily numeric (psalm number search)
  // Enhanced search change handler with type detection
  function handleSearchInput(query: string) {
    const searchType = query.trim()
      ? detectNumericSearchType(
        query,
        categoryFilteredSongs.map((song) => song.number),
        songs.map((song) => song.number)
      )
      : undefined;
    onSearchChange(query, searchType);
  }

</script>

<div class="song-list">
  <SongListCategoryTabs {categories} {selectedCategory} {onSelectCategory} />

  <SongListSearchControls
    {useNumberPad}
    {searchQuery}
    {searchInVerses}
    {useFuzzyVerseSearch}
    {versesIndexLoading}
    selectedCategory={effectiveCategory}
    onSearchInput={handleSearchInput}
    {onSearchInVersesChange}
    {onUseFuzzyChange}
    {onOpenSettings}
  />

  <SongListResults
    {filteredSongs}
    {searchQuery}
    selectedCategory={effectiveCategory}
    {categories}
    {onSelectSong}
  />
</div>

<style>
  .song-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }
</style>
