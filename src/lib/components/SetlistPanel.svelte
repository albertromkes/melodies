<script lang="ts">
  import { getCategoryDisplayName, isPrimaryCategory } from '../data/category-utils';
  import type { PsalmData } from '../types/music';
  import type { SetlistItem } from '../types/setlist';

  interface RenderableSetlistItem {
    item: SetlistItem;
    song: PsalmData;
  }

  interface Props {
    setlistName: string;
    items: RenderableSetlistItem[];
    activeItemId: string | null;
    onOpenItem: (itemId: string) => void;
    onMoveItemUp: (itemId: string) => void;
    onMoveItemDown: (itemId: string) => void;
    onRemoveItem: (itemId: string) => void;
    onClear: () => void;
    onClose: () => void;
  }

  let {
    setlistName,
    items,
    activeItemId,
    onOpenItem,
    onMoveItemUp,
    onMoveItemDown,
    onRemoveItem,
    onClear,
    onClose,
  }: Props = $props();

  function handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleOverlayKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClose();
    }
  }

  function getTransposeLabel(value: number): string | null {
    if (value === 0) {
      return null;
    }

    return value > 0 ? `+${value}` : `${value}`;
  }

  function getSongCategory(song: PsalmData): string | null {
    if (!song.category || isPrimaryCategory(song.category)) {
      return null;
    }

    return getCategoryDisplayName(song.category);
  }

  let subtitle = $derived(items.length === 1 ? '1 lied' : `${items.length} liederen`);
</script>

<div
  class="setlist-overlay"
  role="button"
  tabindex="0"
  aria-label="Sluit dienstlijst"
  onclick={handleOverlayClick}
  onkeydown={handleOverlayKeydown}
>
  <div class="setlist-panel" role="dialog" aria-modal="true" aria-labelledby="setlist-title">
    <div class="setlist-header">
      <div>
        <h2 id="setlist-title">Dienstlijst</h2>
        <p>{subtitle}</p>
      </div>
      <button class="close-button" onclick={onClose} aria-label="Sluiten">
        ✕
      </button>
    </div>

    <div class="setlist-content">
      {#if items.length === 0}
        <div class="empty-state">
          <h3>{setlistName}</h3>
          <p>Nog geen liederen in de dienstlijst</p>
          <p>Open een lied en voeg het toe vanuit het detail-scherm.</p>
        </div>
      {:else}
        <div class="setlist-items" aria-label="Dienstlijst items">
          {#each items as { item, song }, index (item.id)}
            <article class="setlist-item" class:active={item.id === activeItemId}>
              <button
                class="item-main"
                onclick={() => onOpenItem(item.id)}
                aria-label={`Openen ${song.title}`}
              >
                <div class="item-number">{song.number}</div>
                <div class="item-copy">
                  <div class="item-title-row">
                    <h3>{song.title}</h3>
                    {#if getTransposeLabel(item.transposeSemitones)}
                      <span class="transpose-badge">{getTransposeLabel(item.transposeSemitones)}</span>
                    {/if}
                  </div>
                  {#if getSongCategory(song)}
                    <p class="item-meta">{getSongCategory(song)}</p>
                  {/if}
                </div>
              </button>

              <div class="item-actions">
                <button onclick={() => onOpenItem(item.id)}>Openen</button>
                <button onclick={() => onMoveItemUp(item.id)} disabled={index === 0}>Omhoog</button>
                <button onclick={() => onMoveItemDown(item.id)} disabled={index === items.length - 1}>Omlaag</button>
                <button class="danger" onclick={() => onRemoveItem(item.id)}>Verwijderen</button>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </div>

    <div class="setlist-footer">
      <button class="secondary" onclick={onClose}>Sluiten</button>
      <button class="danger" onclick={onClear} disabled={items.length === 0}>Leegmaken</button>
    </div>
  </div>
</div>

<style>
  .setlist-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1050;
    animation: fadeIn 0.2s ease-out;
  }

  .setlist-panel {
    width: min(92vw, 460px);
    max-height: 84vh;
    display: flex;
    flex-direction: column;
    background: var(--card-bg);
    border-radius: 14px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
    animation: slideUp 0.25s ease-out;
    overflow: hidden;
  }

  .setlist-header,
  .setlist-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 1rem 1.1rem;
    border-bottom: 1px solid var(--border-color);
  }

  .setlist-footer {
    border-top: 1px solid var(--border-color);
    border-bottom: none;
    justify-content: flex-end;
  }

  .setlist-header h2 {
    margin: 0;
    font-size: 1.2rem;
    color: var(--primary-color);
  }

  .setlist-header p {
    margin: 0.2rem 0 0;
    font-size: 0.9rem;
    color: var(--muted-color);
  }

  .close-button,
  .setlist-footer button,
  .item-actions button {
    border: 1px solid var(--border-color);
    background: var(--bg-color);
    color: var(--text-color);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .close-button {
    min-width: 40px;
    min-height: 40px;
    font-size: 1.2rem;
  }

  .setlist-content {
    overflow-y: auto;
    padding: 1rem 1.1rem;
  }

  .empty-state {
    padding: 1.5rem 0.4rem;
    text-align: center;
  }

  .empty-state h3 {
    margin: 0 0 0.5rem;
    color: var(--text-color);
    font-size: 1rem;
  }

  .empty-state p {
    margin: 0.4rem 0;
    color: var(--muted-color);
    line-height: 1.5;
  }

  .setlist-items {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .setlist-item {
    border: 1px solid var(--border-color);
    border-radius: 12px;
    background: var(--bg-color);
    overflow: hidden;
  }

  .setlist-item.active {
    border-color: color-mix(in srgb, var(--primary-color) 55%, var(--border-color) 45%);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary-color) 18%, transparent 82%);
  }

  .item-main {
    width: 100%;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.9rem;
    align-items: start;
    padding: 0.95rem;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-align: left;
  }

  .item-number {
    min-width: 2.5rem;
    padding: 0.45rem 0.55rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--primary-color) 14%, var(--bg-color) 86%);
    color: var(--primary-color);
    font-weight: 700;
    text-align: center;
  }

  .item-copy {
    min-width: 0;
  }

  .item-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .item-title-row h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-meta {
    margin: 0.35rem 0 0;
    color: var(--muted-color);
    font-size: 0.88rem;
  }

  .transpose-badge {
    flex-shrink: 0;
    padding: 0.2rem 0.45rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--primary-color) 12%, transparent 88%);
    color: var(--primary-color);
    font-size: 0.78rem;
    font-weight: 700;
  }

  .item-actions {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
    padding: 0 0.95rem 0.95rem;
  }

  .item-actions button,
  .setlist-footer button {
    min-height: 40px;
    padding: 0.55rem 0.7rem;
    font-size: 0.86rem;
  }

  .secondary {
    background: var(--bg-color);
  }

  .danger {
    color: #b54747;
  }

  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (hover: hover) and (pointer: fine) {
    .close-button:hover,
    .setlist-footer button:hover:not(:disabled),
    .item-actions button:hover:not(:disabled) {
      border-color: var(--primary-color);
      color: var(--primary-color);
    }

    .danger:hover:not(:disabled) {
      color: #b54747;
      border-color: color-mix(in srgb, #b54747 60%, var(--border-color) 40%);
    }

    .item-main:hover {
      background: var(--card-hover-bg);
    }
  }

  @media (max-width: 640px) {
    .setlist-panel {
      width: calc(100vw - 1rem);
      max-height: calc(100vh - 1rem);
      max-height: calc(100dvh - 1rem);
      border-radius: 16px;
    }

    .setlist-header,
    .setlist-content,
    .setlist-footer {
      padding-left: 0.9rem;
      padding-right: 0.9rem;
    }

    .item-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(18px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
