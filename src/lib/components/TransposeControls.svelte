<script lang="ts">
  interface Props {
    currentSemitones: number;
    onTranspose: (semitones: number) => void;
  }

  let { currentSemitones, onTranspose }: Props = $props();

  // Preset transpositions as favorites
  const presets = [-3, -2, -1, 0, 1, 2, 3];

  function getLabel(semitones: number): string {
    if (semitones === 0) return 'Original';
    return semitones > 0 ? `+${semitones}` : `${semitones}`;
  }
</script>

<div class="transpose-controls">
  <div class="transpose-main">
    <button
      class="transpose-btn"
      onclick={() => onTranspose(currentSemitones - 1)}
      aria-label="Transpose down one semitone"
    >
      −1
    </button>
    
    <span class="current-transposition">
      {getLabel(currentSemitones)}
    </span>
    
    <button
      class="transpose-btn"
      onclick={() => onTranspose(currentSemitones + 1)}
      aria-label="Transpose up one semitone"
    >
      +1
    </button>
  </div>

  <div class="transpose-presets">
    {#each presets as preset}
      <button
        class="preset-btn"
        class:active={currentSemitones === preset}
        onclick={() => onTranspose(preset)}
        aria-label={`Transpose to ${getLabel(preset)}`}
      >
        {getLabel(preset)}
      </button>
    {/each}
  </div>
</div>

<style>
  .transpose-controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--card-bg);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .transpose-main {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  .transpose-btn {
    width: 48px;
    height: 48px;
    font-size: 1.25rem;
    font-weight: bold;
    border: 2px solid var(--primary-color);
    border-radius: 50%;
    background: var(--bg-color);
    color: var(--primary-color);
    cursor: pointer;
    transition: all 0.2s;
  }

  .transpose-btn:hover {
    background: var(--primary-color);
    color: var(--bg-color);
  }

  .transpose-btn:active {
    transform: scale(0.95);
  }

  .current-transposition {
    font-size: 1.25rem;
    font-weight: bold;
    color: var(--text-color);
    min-width: 5rem;
    text-align: center;
  }

  .transpose-presets {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }

  .preset-btn {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-color);
    color: var(--text-color);
    cursor: pointer;
    transition: all 0.2s;
  }

  .preset-btn:hover {
    border-color: var(--primary-color);
  }

  .preset-btn.active {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
  }
</style>
