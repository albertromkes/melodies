<script lang="ts">
  import type { Theme } from '../types/music';

  interface Props {
    theme: Theme;
    onToggleTheme: () => void;
    onClose: () => void;
  }

  let { theme, onToggleTheme, onClose }: Props = $props();
</script>

<div class="settings-overlay" onclick={onClose} role="dialog" aria-modal="true" aria-labelledby="settings-title">
  <div class="settings-panel" onclick={(e) => e.stopPropagation()}>
    <div class="settings-header">
      <h2 id="settings-title">Instellingen</h2>
      <button class="close-button" onclick={onClose} aria-label="Sluiten">
        ✕
      </button>
    </div>

    <div class="settings-content">
      <div class="setting-group">
        <h3>Thema</h3>
        <p>Kies tussen licht en donker thema</p>

        <div class="theme-options">
          <button
            class="theme-option {theme === 'light' ? 'active' : ''}"
            onclick={() => {
              if (theme !== 'light') onToggleTheme();
            }}
          >
            <div class="theme-preview light">
              <div class="preview-icon">☀️</div>
              <span>Licht</span>
            </div>
          </button>

          <button
            class="theme-option {theme === 'dark' ? 'active' : ''}"
            onclick={() => {
              if (theme !== 'dark') onToggleTheme();
            }}
          >
            <div class="theme-preview dark">
              <div class="preview-icon">🌙</div>
              <span>Donker</span>
            </div>
          </button>
        </div>
      </div>

      <div class="setting-group">
        <h3>Over deze app</h3>
        <p>Psalm Melodies - Nederlandse psalm melodieën</p>
        <p class="version">Versie 1.0.0</p>
      </div>
    </div>
  </div>
</div>

<style>
  .settings-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease-out;
  }

  .settings-panel {
    background: var(--card-bg);
    border-radius: 12px;
    width: 90%;
    max-width: 400px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    animation: slideUp 0.3s ease-out;
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .settings-header h2 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--primary-color);
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--muted-color);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-button:hover {
    background: var(--card-hover-bg);
    color: var(--text-color);
  }

  .settings-content {
    padding: 1.5rem;
  }

  .setting-group {
    margin-bottom: 2rem;
  }

  .setting-group h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: var(--text-color);
  }

  .setting-group p {
    margin: 0 0 1rem 0;
    color: var(--muted-color);
    font-size: 0.9rem;
  }

  .theme-options {
    display: flex;
    gap: 1rem;
  }

  .theme-option {
    flex: 1;
    background: none;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
  }

  .theme-option:hover {
    border-color: var(--primary-color);
    transform: translateY(-2px);
  }

  .theme-option.active {
    border-color: var(--primary-color);
    background: var(--card-hover-bg);
  }

  .theme-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .theme-preview span {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-color);
  }

  .preview-icon {
    font-size: 1.5rem;
  }

  .version {
    font-size: 0.8rem;
    color: var(--muted-color);
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
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Mobile responsive */
  @media (max-width: 640px) {
    .settings-panel {
      width: 95%;
      margin: 1rem;
    }

    .settings-header,
    .settings-content {
      padding: 1rem;
    }

    .theme-options {
      flex-direction: column;
    }
  }
</style>