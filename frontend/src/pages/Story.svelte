<script>
  import { api } from '../lib/api.js';
  import { loading, error } from '../lib/stores.js';
  import { professionColor } from '../lib/professions.js';
  import Card from '../lib/components/ui/Card.svelte';
  import CardContent from '../lib/components/ui/CardContent.svelte';
  import Button from '../lib/components/ui/Button.svelte';
  import Spinner from '../lib/components/Spinner.svelte';

  let characters = $state([]);
  let campaigns = $state([]);
  let selectedCharIdx = $state(0);

  async function loadStory() {
    loading.set(true);
    error.set(null);
    characters = [];
    campaigns = [];

    try {
      const data = await api.getStory(null);
      characters = data.characters;
      campaigns = data.campaigns;
    } catch (err) {
      error.set(err.message || 'Failed to load story progress');
    } finally {
      loading.set(false);
    }
  }

  function getProgressStatus(campaign) {
    if (campaign.completedCount > 10) return 'done';
    if (campaign.started) return 'in-progress';
    return 'not-started';
  }

  function getProgressLabel(campaign) {
    if (campaign.completedCount > 10) return `${campaign.completedCount} steps completed`;
    if (campaign.started) return `${campaign.completedCount} steps completed`;
    return 'Not started';
  }

  $effect(() => {
    loadStory();
  });
</script>

<div class="space-y-6">
  <!-- Toolbar -->
  <div class="flex items-center justify-between">
    <h2 class="text-2xl font-bold tracking-tight">Story Journal</h2>
    <Button onclick={loadStory} disabled={$loading} size="sm">
      {$loading ? 'Loading...' : '🔄 Refresh'}
    </Button>
  </div>

  {#if $loading}
    <div class="flex items-center gap-3 py-8 text-muted-foreground">
      <Spinner />
      Loading story progress...
    </div>
  {/if}

  {#if $error}
    <div class="rounded-lg bg-destructive/15 p-4 text-sm text-destructive">
      <strong>Error:</strong> {$error}
    </div>
  {/if}

  {#if !$loading && characters.length > 0}
    <!-- Character tabs -->
    {#if characters.length > 1}
      <div class="flex flex-wrap gap-2">
        {#each characters as char, i}
          <button
            class="rounded-lg border px-4 py-2 text-sm font-medium transition-colors {i === selectedCharIdx ? 'border-brand bg-brand-light/50' : 'border-input hover:border-brand'}"
            onclick={() => selectedCharIdx = i}
          >
            <span style="color:{professionColor(char.profession)}">
              {char.profession}
            </span>{' '}
            {char.name}
          </button>
        {/each}
      </div>
    {/if}

    <!-- Character campaigns -->
    {#if characters[selectedCharIdx]}
      {@const char = characters[selectedCharIdx]}
      <div>
        <h3 class="text-lg font-semibold">
          <span style="color:{professionColor(char.profession)}">{char.profession}</span>
          {' '}{char.name}
        </h3>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each char.campaigns as camp (camp.key)}
          <div
            class="rounded-lg border-l-4 bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            style="border-left-color: {camp.color || '#888'}"
            class:opacity-60={getProgressStatus(camp) === 'not-started'}
            class:opacity-75={getProgressStatus(camp) === 'done'}
          >
            <div class="mb-2 font-semibold">{camp.name}</div>
            <div class="text-sm">
              {#if getProgressStatus(camp) === 'done'}
                <span class="text-emerald-600 dark:text-emerald-400">✅ Completed</span>
              {:else if getProgressStatus(camp) === 'in-progress'}
                <span class="text-amber-600 dark:text-amber-400">📖 In progress</span>
              {:else}
                <span class="text-muted-foreground">⬜ Not started</span>
              {/if}
            </div>
            <div class="mt-1 text-xs text-muted-foreground">{getProgressLabel(camp)}</div>
          </div>
        {/each}
      </div>

      {#if char.campaigns.every(c => !c.started)}
        <div class="py-12 text-center text-muted-foreground">
          No story progress found for this character. Start your personal story in-game!
        </div>
      {/if}
    {/if}
  {:else if !$loading && !$error}
    <div class="py-12 text-center text-muted-foreground">
      No characters found. Check your API key permissions.
    </div>
  {/if}
</div>
