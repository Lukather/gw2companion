<script>
  import { api } from '../lib/api.js';
  import { loading, error, selectedChar } from '../lib/stores.js';
  import { professionColor } from '../lib/professions.js';
  import { formatGold } from '../lib/format.js';
  import Card from '../lib/components/ui/Card.svelte';
  import CardContent from '../lib/components/ui/CardContent.svelte';
  import Button from '../lib/components/ui/Button.svelte';
  import Input from '../lib/components/ui/Input.svelte';
  import Table from '../lib/components/ui/Table.svelte';
  import TableHeader from '../lib/components/ui/TableHeader.svelte';
  import TableBody from '../lib/components/ui/TableBody.svelte';
  import TableRow from '../lib/components/ui/TableRow.svelte';
  import TableHead from '../lib/components/ui/TableHead.svelte';
  import TableCell from '../lib/components/ui/TableCell.svelte';
  import Spinner from '../lib/components/Spinner.svelte';

  let results = $state([]);
  let summary = $state(null);
  let totalGold = $state(0);
  let filterText = $state('');
  let filterAction = $state('all');
  let includeWiki = $state(false);
  let elapsed = $state('');
  let debugInfo = $state(null);
  // loadStage is mutated explicitly in loadAnalysis()/clearSelection();
  // transitions are driven by the $effect below, so init just needs a safe default.
  let loadStage = $state('selecting');

  const actionStyles = {
    sell: 'bg-action-sell-bg text-action-sell-fg',
    salvage: 'bg-action-salvage-bg text-action-salvage-fg',
    keep: 'bg-action-keep-bg text-action-keep-fg',
    use: 'bg-action-use-bg text-action-use-fg',
  };
  const actionEmoji = { sell: '💰', salvage: '🔨', keep: '⭐', use: '👆' };

  function rarityClass(rarity) {
    return `bg-rarity-${(rarity || 'basic').toLowerCase()}-bg text-rarity-${(rarity || 'basic').toLowerCase()}-fg`;
  }

  function clearSelection() {
    selectedChar.set(null);
    results = [];
    summary = null;
    loadStage = 'selecting';
  }

  async function loadAnalysis() {
    if (!$selectedChar) return;
    loading.set(true);
    error.set(null);
    results = [];
    summary = null;
    loadStage = 'loading';

    const dc = new AbortController();
    const dt = setTimeout(() => dc.abort(), 3000);
    fetch('/api/debug', { signal: dc.signal })
      .then(r => r.json()).then(d => { debugInfo = d; })
      .catch(e => { debugInfo = { ok: false, error: e.message }; })
      .finally(() => clearTimeout(dt));

    try {
      const params = `?${includeWiki ? 'wiki=true&' : ''}character=${encodeURIComponent($selectedChar.name)}`;
      const data = await api.getAnalysis(params);
      results = data.results;
      summary = data.summary;
      elapsed = data.elapsed || '';
      totalGold = data.results.reduce((sum, i) => sum + i.itemGoldValue, 0);
      loadStage = 'done';
    } catch (err) {
      error.set(err.message || 'Failed to load analysis');
      loadStage = 'error';
    } finally {
      loading.set(false);
    }
  }

  function getFilteredResults() {
    let filtered = results;
    if (filterText) {
      const lower = filterText.toLowerCase();
      filtered = filtered.filter(i =>
        i.name.toLowerCase().includes(lower) ||
        i.type.toLowerCase().includes(lower) ||
        i.reason.toLowerCase().includes(lower)
      );
    }
    if (filterAction !== 'all') filtered = filtered.filter(i => i.action === filterAction);
    return filtered;
  }

  $effect(() => {
    if ($selectedChar) loadAnalysis();
  });
</script>

<div class="space-y-6">
  {#if !$selectedChar}
    <div class="rounded-xl border bg-card p-12 text-center">
      <h2 class="mb-2 text-xl font-semibold">No character selected</h2>
      <p class="text-muted-foreground">Go to <span class="font-medium text-brand">Home</span> and click a character to view their inventory.</p>
    </div>
  {:else}
    <!-- Toolbar -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onclick={clearSelection}>← Back to Home</Button>
        <h2 class="text-xl font-bold">{$selectedChar.name}'s Inventory</h2>
        <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" style="background:{professionColor($selectedChar.profession)}20; color:{professionColor($selectedChar.profession)}">
          {$selectedChar.profession} · {$selectedChar.race} · Lv.{$selectedChar.level}
        </span>
      </div>
      <div class="flex items-center gap-3">
        <label class="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" bind:checked={includeWiki} onchange={loadAnalysis} class="h-4 w-4 rounded accent-brand" />
          Wiki data
        </label>
        <Button onclick={loadAnalysis} disabled={$loading} size="sm">
          {$loading ? 'Analyzing...' : '🔄 Re-analyze'}
        </Button>
      </div>
    </div>

    <!-- Loading -->
    {#if $loading || loadStage === 'loading'}
      <Card>
        <CardContent class="flex flex-col gap-3 pt-6">
          <div class="flex items-center gap-3 text-muted-foreground">
            <Spinner />
            Analyzing {$selectedChar.name}'s inventory...
          </div>
          {#if debugInfo}
            <div class="rounded bg-muted p-3 font-mono text-xs">
              {debugInfo.ok ? '✅ Backend connected' : '❌ Backend: ' + debugInfo.error}
            </div>
          {/if}
        </CardContent>
      </Card>
    {/if}

    <!-- Error -->
    {#if !$loading && $error}
      <div class="rounded-lg bg-destructive/15 p-4 text-sm text-destructive"><strong>Error:</strong> {$error}</div>
    {/if}

    <!-- Summary Cards -->
    {#if !$loading && summary}
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card class="text-center"><CardContent class="py-4"><div class="text-2xl font-bold">{summary.totalItems}</div><div class="mt-1 text-xs text-muted-foreground">Items</div></CardContent></Card>
        <Card class="text-center border-action-sell-bg bg-action-sell-bg/20"><CardContent class="py-4"><div class="text-2xl font-bold">{summary.sell}</div><div class="mt-1 text-xs text-muted-foreground">💰 Sell</div></CardContent></Card>
        <Card class="text-center border-action-salvage-bg bg-action-salvage-bg/20"><CardContent class="py-4"><div class="text-2xl font-bold">{summary.salvage}</div><div class="mt-1 text-xs text-muted-foreground">🔨 Salvage</div></CardContent></Card>
        <Card class="text-center border-action-keep-bg bg-action-keep-bg/20"><CardContent class="py-4"><div class="text-2xl font-bold">{summary.keep}</div><div class="mt-1 text-xs text-muted-foreground">⭐ Keep</div></CardContent></Card>
        <Card class="text-center border-action-use-bg bg-action-use-bg/20"><CardContent class="py-4"><div class="text-2xl font-bold">{summary.use}</div><div class="mt-1 text-xs text-muted-foreground">👆 Use</div></CardContent></Card>
        <Card class="text-center bg-brand-light/50"><CardContent class="py-4"><div class="text-2xl font-bold text-gold">{formatGold(summary.potentialGold)}</div><div class="mt-1 text-xs text-muted-foreground">Potential gold</div></CardContent></Card>
      </div>

      <div class="flex items-center gap-6 text-sm text-muted-foreground">
        <span>Total value: <span class="font-semibold text-gold">{formatGold(totalGold)}</span></span>
        {#if elapsed}<span class="italic">Completed in {elapsed}</span>{/if}
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-3">
        <Input class="max-w-sm" placeholder="Filter by name, type, or reason..." bind:value={filterText} />
        <select bind:value={filterAction} class="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <option value="all">All actions</option>
          <option value="sell">💰 Sell</option>
          <option value="salvage">🔨 Salvage</option>
          <option value="keep">⭐ Keep</option>
          <option value="use">👆 Use</option>
        </select>
      </div>

      <!-- Table -->
      <div class="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-10"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Rarity</TableHead>
              <TableHead class="text-right">Qty</TableHead>
              <TableHead class="text-right">Value</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#each getFilteredResults() as item (item.uid || Math.random())}
              <TableRow>
                <TableCell class="px-2">{#if item.icon}<img src={item.icon} alt="" width="28" height="28" loading="lazy" />{/if}</TableCell>
                <TableCell class="max-w-[180px] truncate font-medium" title={item.name}>{item.name}</TableCell>
                <TableCell class="text-muted-foreground">{item.type}</TableCell>
                <TableCell><span class="inline-block rounded px-2 py-0.5 text-xs font-semibold {rarityClass(item.rarity)}">{item.rarity}</span></TableCell>
                <TableCell class="text-right tabular-nums">{item.count}</TableCell>
                <TableCell class="text-right tabular-nums text-gold">{formatGold(item.itemGoldValue)}</TableCell>
                <TableCell>
                  <span class="group relative inline-block cursor-default rounded px-2 py-0.5 text-xs font-semibold capitalize {actionStyles[item.action] || ''}">
                    {actionEmoji[item.action] || ''} {item.action}
                    <span class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-normal rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100" style="max-width:320px">{item.reason}</span>
                  </span>
                </TableCell>
              </TableRow>
            {/each}
          </TableBody>
        </Table>
      </div>
    {/if}
  {/if}
</div>
