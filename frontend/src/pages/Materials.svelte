<script>
  import { api } from '../lib/api.js';
  import { loading, error } from '../lib/stores.js';
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

  let materials = $state([]);
  let summary = $state(null);
  let totalValue = $state(0);
  let filterText = $state('');
  let filterAction = $state('all');
  let filterCategory = $state('all');

  const actionStyles = {
    sell:   'bg-action-sell-bg text-action-sell-fg',
    refine: 'bg-action-salvage-bg text-action-salvage-fg',
    keep:   'bg-action-keep-bg text-action-keep-fg',
  };

  const actionEmoji = {
    sell: '💰', refine: '⚗️', keep: '⭐',
  };

  async function loadMaterials() {
    loading.set(true);
    error.set(null);
    materials = [];
    summary = null;

    try {
      const data = await api.getMaterials();
      materials = data.materials;
      summary = data.summary;
      totalValue = data.materials.reduce((sum, m) => sum + m.totalValue, 0);
    } catch (err) {
      console.error('[Materials] load error:', err);
      error.set(err.message || 'Failed to load materials');
    } finally {
      loading.set(false);
    }
  }

  function getFilteredMaterials() {
    let filtered = materials;
    if (filterText) {
      const lower = filterText.toLowerCase();
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(lower) ||
        m.categoryName.toLowerCase().includes(lower) ||
        m.reason.toLowerCase().includes(lower)
      );
    }
    if (filterAction !== 'all') {
      filtered = filtered.filter(m => m.action === filterAction);
    }
    if (filterCategory !== 'all') {
      filtered = filtered.filter(m => String(m.category) === filterCategory);
    }
    return filtered;
  }

  function getCategories() {
    const cats = new Map();
    for (const m of materials) {
      if (!cats.has(m.category)) {
        cats.set(m.category, { id: m.category, name: m.categoryName, count: 0 });
      }
      cats.get(m.category).count += m.count;
    }
    return [...cats.values()].sort((a, b) => b.count - a.count);
  }

  $effect(() => {
    loadMaterials();
  });
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h2 class="text-2xl font-bold tracking-tight">Material Storage</h2>
    <Button onclick={loadMaterials} disabled={$loading} size="sm">
      {$loading ? 'Loading...' : '🔄 Refresh'}
    </Button>
  </div>

  {#if $loading}
    <div class="flex items-center gap-3 py-8 text-muted-foreground">
      <Spinner />
      Loading material storage...
    </div>
  {/if}

  {#if $error}
    <div class="rounded-lg bg-destructive/15 p-4 text-sm text-destructive">
      <strong>Error:</strong> {$error}
    </div>
  {/if}

  {#if !$loading && !$error && summary}
    <!-- Summary Cards -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Card class="text-center">
        <CardContent class="py-4">
          <div class="text-2xl font-bold">{summary.totalItems.toLocaleString()}</div>
          <div class="mt-1 text-xs text-muted-foreground">Total Items</div>
        </CardContent>
      </Card>
      <Card class="text-center bg-brand-light/50 dark:bg-brand-light/10">
        <CardContent class="py-4">
          <div class="text-2xl font-bold text-gold">{formatGold(summary.totalValue)}</div>
          <div class="mt-1 text-xs text-muted-foreground">Total Value</div>
        </CardContent>
      </Card>
      <Card class="text-center border-action-sell-bg bg-action-sell-bg/20 dark:bg-action-sell-bg/10">
        <CardContent class="py-4">
          <div class="text-2xl font-bold">{summary.sell}</div>
          <div class="mt-1 text-xs text-muted-foreground">💰 Sell</div>
        </CardContent>
      </Card>
      <Card class="text-center border-action-salvage-bg bg-action-salvage-bg/20 dark:bg-action-salvage-bg/10">
        <CardContent class="py-4">
          <div class="text-2xl font-bold">{summary.refine}</div>
          <div class="mt-1 text-xs text-muted-foreground">⚗️ Refine</div>
        </CardContent>
      </Card>
      <Card class="text-center border-action-keep-bg bg-action-keep-bg/20 dark:bg-action-keep-bg/10">
        <CardContent class="py-4">
          <div class="text-2xl font-bold">{summary.keep}</div>
          <div class="mt-1 text-xs text-muted-foreground">⭐ Keep</div>
        </CardContent>
      </Card>
    </div>

    <!-- Filter Bar -->
    <div class="flex flex-wrap gap-3">
      <Input
        class="max-w-sm"
        placeholder="Filter by name, category, or reason..."
        bind:value={filterText}
      />
      <select
        bind:value={filterAction}
        class="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="all">All actions</option>
        <option value="sell">💰 Sell</option>
        <option value="refine">⚗️ Refine</option>
        <option value="keep">⭐ Keep</option>
      </select>
      <select
        bind:value={filterCategory}
        class="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="all">All categories</option>
        {#each getCategories() as cat (cat.id)}
          <option value={cat.id}>{cat.name} ({cat.count.toLocaleString()})</option>
        {/each}
      </select>
    </div>

    <!-- Table -->
    <div class="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-10"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead class="text-right">Count</TableHead>
            <TableHead class="text-right">Unit Price</TableHead>
            <TableHead class="text-right">Total Value</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each getFilteredMaterials() as mat, i (mat.id + '-' + (mat.binding || 'none') + '-' + i)}
            <TableRow>
              <TableCell class="px-2">
                {#if mat.icon}
                  <img src={mat.icon} alt="" width="28" height="28" loading="lazy" />
                {/if}
              </TableCell>
              <TableCell class="max-w-[200px] truncate font-medium" title={mat.name}>
                {mat.name}
              </TableCell>
              <TableCell class="text-muted-foreground">{mat.categoryName}</TableCell>
              <TableCell class="text-right tabular-nums">{mat.count.toLocaleString()}</TableCell>
              <TableCell class="text-right tabular-nums text-gold">{formatGold(mat.sellPrice || mat.vendorValue)}</TableCell>
              <TableCell class="text-right tabular-nums text-gold">{formatGold(mat.totalValue)}</TableCell>
              <TableCell>
                <span
                  class="group relative inline-block cursor-default rounded px-2 py-0.5 text-xs font-semibold capitalize {actionStyles[mat.action] || ''}"
                >
                  {actionEmoji[mat.action] || ''} {mat.action}
                  <span
                    class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-normal rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100"
                    style="max-width:300px"
                  >
                    {mat.reason}
                  </span>
                </span>
              </TableCell>
            </TableRow>
          {/each}
        </TableBody>
      </Table>
    </div>
  {/if}

  {#if !$loading && !$error && !summary}
    <div class="py-12 text-center text-muted-foreground">
      No materials found. Check API key permissions (needs: inventories scope).
    </div>
  {/if}
</div>
