<script>
  import { api } from '../lib/api.js';
  import { hasKey, selectedChar } from '../lib/stores.js';
  import { professionColor } from '../lib/professions.js';
  import Spinner from '../lib/components/Spinner.svelte';

  let characters = $state([]);
  let loadingChars = $state(false);

  async function loadCharacters() {
    loadingChars = true;
    try {
      const data = await api.getCharacters();
      characters = data.characters.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      // Silently fail — characters may not be available
    } finally {
      loadingChars = false;
    }
  }

  function selectCharacter(char) {
    selectedChar.set(char);
  }

  $effect(() => {
    if ($hasKey) loadCharacters();
  });
</script>

<div class="space-y-8">
  <!-- Hero section -->
  <div class="rounded-xl border bg-card p-8 shadow-sm">
    <h1 class="mb-2 text-3xl font-bold tracking-tight">GW2 Companion</h1>
    <p class="mb-6 text-lg text-muted-foreground">
      Your Guild Wars 2 inventory, builds, achievements, and story progress — all in one place.
    </p>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div class="rounded-lg border bg-background p-4">
        <div class="mb-1 text-lg font-semibold">🎒 Inventory</div>
        <p class="text-sm text-muted-foreground">Analyze any character's bags. Get sell/salvage/keep recommendations with Trading Post prices.</p>
      </div>
      <div class="rounded-lg border bg-background p-4">
        <div class="mb-1 text-lg font-semibold">⚙️ Builds</div>
        <p class="text-sm text-muted-foreground">View your equipped traits and skills. Compare against curated meta builds.</p>
      </div>
      <div class="rounded-lg border bg-background p-4">
        <div class="mb-1 text-lg font-semibold">🏆 Achievements</div>
        <p class="text-sm text-muted-foreground">Track your achievement progress. Filter by category or find near-complete ones.</p>
      </div>
      <div class="rounded-lg border bg-background p-4">
        <div class="mb-1 text-lg font-semibold">📦 Materials</div>
        <p class="text-sm text-muted-foreground">Browse your material storage with current TP values. Know what to sell or refine.</p>
      </div>
      <div class="rounded-lg border bg-background p-4">
        <div class="mb-1 text-lg font-semibold">📖 Story</div>
        <p class="text-sm text-muted-foreground">Per-character story journal progress across all campaigns and living world seasons.</p>
      </div>
    </div>
  </div>

  <!-- Character Selection -->
  <div>
    <h2 class="mb-1 text-2xl font-bold tracking-tight">Your Characters</h2>
    <p class="mb-6 text-muted-foreground">Select a character to start analyzing their inventory and builds.</p>

    {#if loadingChars}
      <div class="flex items-center gap-3 py-8 text-muted-foreground">
        <Spinner />
        Loading characters...
      </div>
    {:else if characters.length === 0}
      <div class="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        <p class="text-lg">No characters found</p>
        <p class="mt-1 text-sm">Check that your API key has the <strong>characters</strong> permission.</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {#each characters as char (char.name)}
          <button
            class="group rounded-xl border bg-card p-5 text-left shadow-sm transition-all hover:border-brand hover:shadow-md"
            onclick={() => selectCharacter(char)}
          >
            <div class="mb-3 text-lg font-bold text-foreground">{char.name}</div>
            <div class="flex justify-between text-sm text-muted-foreground">
              <span style="color:{professionColor(char.profession)}">{char.profession}</span>
              <span>{char.race}</span>
            </div>
            <div class="mt-1 flex justify-between text-sm text-muted-foreground">
              <span>{char.gender}</span>
              <span>Level {char.level}</span>
            </div>
            <div class="mt-3 text-xs text-muted-foreground">👜 {char.bagCount} bags</div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
