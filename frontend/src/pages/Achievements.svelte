<script>
  import { api } from '../lib/api.js';
  import { loading, error } from '../lib/stores.js';
  import Card from '../lib/components/ui/Card.svelte';
  import CardContent from '../lib/components/ui/CardContent.svelte';
  import Button from '../lib/components/ui/Button.svelte';
  import Input from '../lib/components/ui/Input.svelte';
  import Spinner from '../lib/components/Spinner.svelte';

  let achievements = $state([]);
  let categories = $state([]);
  let summary = $state(null);
  let filterText = $state('');
  let filterCategory = $state('all');
  let filterNearOnly = $state(false);
  let showCompleted = $state(true);

  async function loadAchievements() {
    loading.set(true);
    error.set(null);
    achievements = [];
    categories = [];
    summary = null;

    try {
      const params = new URLSearchParams();
      if (filterNearOnly) params.set('filter', 'near');
      if (filterCategory !== 'all') params.set('category', filterCategory);

      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await api.getAchievements(query);
      achievements = data.achievements;
      categories = data.categories;
      summary = data.summary;
    } catch (err) {
      console.error('[Achievements] load error:', err);
      error.set(err.message || 'Failed to load achievements');
    } finally {
      loading.set(false);
    }
  }

  function applyLocalFilters() {
    let filtered = achievements;
    if (!showCompleted) {
      filtered = filtered.filter(a => !a.done);
    }
    if (filterText) {
      const lower = filterText.toLowerCase();
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(lower) ||
        a.description.toLowerCase().includes(lower)
      );
    }
    return filtered;
  }

  function getCategoryName(catId) {
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.name : `Category ${catId}`;
  }

  function formatCount(current, max) {
    if (max > 9999) return `${current.toLocaleString()} / ${max.toLocaleString()}`;
    return `${current} / ${max}`;
  }

  $effect(() => {
    loadAchievements();
  });
</script>

<div class="space-y-6">
  <!-- Toolbar -->
  <div class="flex items-center justify-between">
    <h2 class="text-2xl font-bold tracking-tight">Achievements</h2>
    <Button onclick={loadAchievements} disabled={$loading} size="sm">
      {$loading ? 'Loading...' : '🔄 Refresh'}
    </Button>
  </div>

  {#if $loading}
    <div class="flex items-center gap-3 py-8 text-muted-foreground">
      <Spinner />
      Loading achievements... (may take a moment for large accounts)
    </div>
  {/if}

  {#if $error}
    <div class="rounded-lg bg-destructive/15 p-4 text-sm text-destructive">
      <strong>Error:</strong> {$error}
    </div>
  {/if}

  {#if !$loading && !$error && summary}
    <!-- Summary Cards -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card class="text-center">
        <CardContent class="py-4">
          <div class="text-2xl font-bold">{summary.total.toLocaleString()}</div>
          <div class="mt-1 text-xs text-muted-foreground">Total</div>
        </CardContent>
      </Card>
      <Card class="text-center border-action-keep-bg bg-action-keep-bg/20 dark:bg-action-keep-bg/10">
        <CardContent class="py-4">
          <div class="text-2xl font-bold">{summary.completed.toLocaleString()}</div>
          <div class="mt-1 text-xs text-muted-foreground">✅ Completed</div>
        </CardContent>
      </Card>
      <Card class="text-center border-action-salvage-bg bg-action-salvage-bg/20 dark:bg-action-salvage-bg/10">
        <CardContent class="py-4">
          <div class="text-2xl font-bold">{summary.nearComplete.toLocaleString()}</div>
          <div class="mt-1 text-xs text-muted-foreground">🔶 Near Complete</div>
        </CardContent>
      </Card>
      <Card class="text-center border-action-sell-bg bg-action-sell-bg/20 dark:bg-action-sell-bg/10">
        <CardContent class="py-4">
          <div class="text-2xl font-bold">{summary.inProgress.toLocaleString()}</div>
          <div class="mt-1 text-xs text-muted-foreground">📋 In Progress</div>
        </CardContent>
      </Card>
    </div>

    <!-- Filter Bar -->
    <div class="flex flex-wrap items-center gap-3">
      <Input class="max-w-sm" placeholder="Search achievements..." bind:value={filterText} />
      <select
        bind:value={filterCategory}
        onchange={loadAchievements}
        class="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="all">All categories</option>
        {#each categories as cat, i (cat.id || 'cat-' + i)}
          <option value={cat.id}>{cat.name}</option>
        {/each}
      </select>
      <label class="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
        <input type="checkbox" bind:checked={filterNearOnly} onchange={loadAchievements} class="h-4 w-4 rounded accent-brand" />
        Near complete
      </label>
      <label class="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
        <input type="checkbox" bind:checked={showCompleted} class="h-4 w-4 rounded accent-brand" />
        Show completed
      </label>
    </div>

    <!-- Achievement List -->
    {#if applyLocalFilters().length === 0}
      <div class="py-12 text-center text-muted-foreground">No achievements match your filters.</div>
    {:else}
      <div class="divide-y rounded-lg border">
        {#each applyLocalFilters() as ach, i (ach.id || 'ach-' + i)}
          <div
            class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 {ach.done ? 'opacity-60' : ''} {ach.nearComplete ? 'border-l-2 border-l-amber-500' : ''}"
          >
            <!-- Icon -->
            <div class="flex h-10 w-10 shrink-0 items-center justify-center">
              {#if ach.icon}
                <img src={ach.icon} alt="" width="36" height="36" loading="lazy" />
              {/if}
            </div>

            <!-- Info -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="font-semibold text-sm">{ach.name}</span>
                {#if ach.done}
                  <span class="text-emerald-600 dark:text-emerald-400 font-bold text-xs">✓</span>
                {/if}
                {#if ach.repeated > 0}
                  <span class="rounded bg-brand-light/50 px-1.5 py-0 text-xs font-semibold text-brand">×{ach.repeated}</span>
                {/if}
              </div>
              {#if ach.description}
                <div class="truncate text-xs text-muted-foreground">{ach.description}</div>
              {/if}
              <div class="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>{getCategoryName(ach.category)}</span>
                {#if ach.max > 1}
                  <span class="tabular-nums">{formatCount(ach.current, ach.max)}</span>
                {/if}
                {#if ach.tiers?.length > 0}
                  <span class="flex gap-1">
                    {#each ach.tiers as tier, j}
                      <span
                        class="inline-block h-1.5 w-1.5 rounded-full"
                        class:bg-brand={ach.current >= tier.count}
                        class:bg-border={ach.current < tier.count}
                        title="Tier {j + 1}: {tier.count} — +{tier.points} AP"
                      ></span>
                    {/each}
                  </span>
                {/if}
              </div>
            </div>

            <!-- Progress -->
            <div class="flex shrink-0 items-center gap-2">
              <div class="h-1.5 w-20 overflow-hidden rounded-full bg-border">
                <div
                  class="h-full rounded-full bg-brand transition-all"
                  style="width: {ach.percent}%"
                ></div>
              </div>
              <span class="w-9 text-right text-xs tabular-nums text-muted-foreground">{ach.percent}%</span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  {#if !$loading && !$error && !summary}
    <div class="py-12 text-center text-muted-foreground">
      No achievements loaded. Check API key permissions (needs: account scope).
    </div>
  {/if}
</div>
