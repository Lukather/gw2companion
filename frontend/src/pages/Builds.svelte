<script>
  import { api } from '../lib/api.js';
  import { loading, error } from '../lib/stores.js';
  import Button from '../lib/components/ui/Button.svelte';
  import Spinner from '../lib/components/Spinner.svelte';

  let characterList = $state([]);
  let selectedChar = $state(null);
  let build = $state(null);
  let metaComparison = $state(null);
  let metaLastUpdated = $state('');
  let refreshing = $state(false);

  const slotLabels = {
    heal: 'Heal', utility1: 'U1', utility2: 'U2', utility3: 'U3', elite: 'Elite',
  };
  const equipmentSlots = {
    HelmAquatic: 'Aquatic Helm', Helm: 'Helm', Shoulders: 'Shoulders',
    Coat: 'Chest', Gloves: 'Gloves', Leggings: 'Leggings', Boots: 'Boots',
    WeaponA1: 'Wpn A1', WeaponA2: 'Wpn A2', WeaponB1: 'Wpn B1', WeaponB2: 'Wpn B2',
    WeaponAquaticA: 'Aquatic A', WeaponAquaticB: 'Aquatic B',
    Backpack: 'Back', Accessory1: 'Acc 1', Accessory2: 'Acc 2',
    Amulet: 'Amulet', Ring1: 'Ring 1', Ring2: 'Ring 2',
    Sickle: 'Sickle', Axe: 'Axe', Pick: 'Pick',
  };

  // ponytail: GW2 slot taxonomy → group/subgroup/display-order. Covers all 20 equippable slots.
  const slotGroup = {
    Helm:           { category: 'armor',    subgroup: 'land',    order: 1 },
    Shoulders:      { category: 'armor',    subgroup: 'land',    order: 2 },
    Coat:           { category: 'armor',    subgroup: 'land',    order: 3 },
    Gloves:         { category: 'armor',    subgroup: 'land',    order: 4 },
    Leggings:       { category: 'armor',    subgroup: 'land',    order: 5 },
    Boots:          { category: 'armor',    subgroup: 'land',    order: 6 },
    HelmAquatic:    { category: 'armor',    subgroup: 'aquatic', order: 1 },
    WeaponA1:       { category: 'weapons',  subgroup: 'set1',    order: 1 },
    WeaponA2:       { category: 'weapons',  subgroup: 'set1',    order: 2 },
    WeaponB1:       { category: 'weapons',  subgroup: 'set2',    order: 1 },
    WeaponB2:       { category: 'weapons',  subgroup: 'set2',    order: 2 },
    WeaponAquaticA: { category: 'weapons',  subgroup: 'aquatic', order: 1 },
    WeaponAquaticB: { category: 'weapons',  subgroup: 'aquatic', order: 2 },
    Backpack:       { category: 'trinkets', subgroup: null,      order: 1 },
    Amulet:         { category: 'trinkets', subgroup: null,      order: 2 },
    Accessory1:     { category: 'trinkets', subgroup: null,      order: 3 },
    Accessory2:     { category: 'trinkets', subgroup: null,      order: 4 },
    Ring1:          { category: 'trinkets', subgroup: null,      order: 5 },
    Ring2:          { category: 'trinkets', subgroup: null,      order: 6 },
    Sickle:         { category: 'tools',    subgroup: null,      order: 1 },
    Axe:            { category: 'tools',    subgroup: null,      order: 2 },
    Pick:           { category: 'tools',    subgroup: null,      order: 3 },
  };
  const categoryOrder = ['armor', 'weapons', 'trinkets', 'tools'];
  const categoryLabels = { armor: 'Armor', weapons: 'Weapons', trinkets: 'Trinkets', tools: 'Gathering Tools' };
  const subgroupOrder = { land: 1, aquatic: 2, set1: 1, set2: 2 };
  const subgroupLabels = {
    land: 'Land', aquatic: 'Aquatic', set1: 'Set 1 (main)', set2: 'Set 2 (swap)',
  };

  // Group equipment by category → subgroup, preserving the GW2 slot order within each.
  let groupedEquipment = $derived.by(() => {
    const buckets = {};
    for (const cat of categoryOrder) {
      buckets[cat] = { bySubgroup: {}, flat: [] };
    }
    for (const eq of (build?.equipment || [])) {
      const g = slotGroup[eq.slot];
      if (!g) continue;
      const sub = g.subgroup || '_main';
      if (!buckets[g.category].bySubgroup[sub]) buckets[g.category].bySubgroup[sub] = [];
      buckets[g.category].bySubgroup[sub].push(eq);
      buckets[g.category].flat.push(eq);
    }
    // Sort each subgroup bucket by configured order; items with unknown slots go last.
    for (const cat of categoryOrder) {
      for (const sub of Object.keys(buckets[cat].bySubgroup)) {
        buckets[cat].bySubgroup[sub].sort((a, b) =>
          (slotGroup[a.slot]?.order ?? 99) - (slotGroup[b.slot]?.order ?? 99));
      }
    }
    return buckets;
  });

  const rarityBorder = {
    Legendary: 'border-l-purple-500',
    Ascended: 'border-l-pink-500',
    Exotic:   'border-l-orange-400',
    Rare:     'border-l-yellow-400',
    Masterwork: 'border-l-green-400',
    Fine:     'border-l-blue-400',
    Basic:    'border-l-gray-400',
    Junk:     'border-l-gray-300',
  };

  function getRarityBorder(rarity) {
    return rarityBorder[rarity] || '';
  }

  function countMismatchedSkills() {
    if (!metaComparison?.skillMatches) return 0;
    return metaComparison.skillMatches.filter(sm => !sm.match).length;
  }

  function countMismatchedSpecs() {
    if (!metaComparison?.specializationMatches) return 0;
    return metaComparison.specializationMatches.filter(sm => !sm.match).length;
  }

  async function loadBuild(charName) {
    loading.set(true);
    error.set(null);
    build = null;
    metaComparison = null;
    try {
      const data = await api.getBuilds(charName);
      selectedChar = data.character;
      build = data.build;
      metaComparison = data.metaComparison;
      metaLastUpdated = data.metaLastUpdated;
      characterList = data.otherCharacters || [];
    } catch (err) {
      console.error('[Builds] load error:', err);
      error.set(err.message || 'Failed to load build');
    } finally {
      loading.set(false);
    }
  }

  async function refreshMeta() {
    refreshing = true;
    try {
      const result = await api.refreshMetaBuilds();
      if (result.success) {
        metaLastUpdated = result.lastUpdated;
        if (selectedChar) await loadBuild(selectedChar.name);
      }
    } catch (err) {
      error.set('Failed to refresh meta builds: ' + (err.message || ''));
    } finally {
      refreshing = false;
    }
  }

  let metaPrefix = $derived(metaComparison?.equipmentSummary?.prefix);
  let metaSlots = $derived(metaComparison?.metaSlots || {});
  let metaWeapons = $derived(metaComparison?.equipmentSummary?.weapons || []);
  let metaRunes = $derived(metaComparison?.equipmentSummary?.runes);
  let metaSigils = $derived(metaComparison?.equipmentSummary?.sigils || []);

  // Generate a human-readable meta suggestion for each equipment slot
  const armorWeight = {
    Guardian: 'Heavy', Warrior: 'Heavy', Revenant: 'Heavy',
    Engineer: 'Medium', Ranger: 'Medium', Thief: 'Medium',
    Elementalist: 'Light', Mesmer: 'Light', Necromancer: 'Light',
  };

  const slotLabelsMeta = {
    Helm: 'Helm', Shoulders: 'Shoulders', Coat: 'Chest', Gloves: 'Gloves',
    Leggings: 'Leggings', Boots: 'Boots',
    HelmAquatic: 'Aquatic Helm', WeaponAquaticA: 'Aquatic Weapon', WeaponAquaticB: 'Aquatic Weapon',
    WeaponA1: 'Weapon set 1', WeaponA2: 'Weapon set 1 offhand',
    WeaponB1: 'Weapon set 2', WeaponB2: 'Weapon set 2 offhand',
    Backpack: 'Back item', Accessory1: 'Accessory', Accessory2: 'Accessory',
    Amulet: 'Amulet', Ring1: 'Ring', Ring2: 'Ring',
    Sickle: 'Sickle', Axe: 'Axe', Pick: 'Pick',
  };

  function getMetaSuggestion(eq) {
    if (!metaPrefix) return null;
    const slot = eq.slot;
    const slotName = slotLabelsMeta[slot] || slot;

    // Armor pieces
    if (['Helm','Shoulders','Coat','Gloves','Leggings','Boots','HelmAquatic'].includes(slot)) {
      const weight = armorWeight[selectedChar?.profession] || '';
      return { name: `${metaPrefix} ${weight} ${slotName}`, extra: metaRunes ? `${metaRunes}` : null };
    }
    // Weapons
    if (slot?.startsWith('Weapon')) {
      const idx = slot === 'WeaponA1' || slot === 'WeaponB1' ? 0 : 1;
      const wpn = metaWeapons[idx] || 'weapon';
      const sigil = metaSigils[idx] || (metaSigils[0] || null);
      return { name: `${metaPrefix} ${wpn}`, extra: sigil || null };
    }
    // Trinkets/back
    if (['Backpack','Accessory1','Accessory2','Amulet','Ring1','Ring2'].includes(slot)) {
      return { name: `${metaPrefix} ${slotName}`, extra: null };
    }
    return null;
  }

  $effect(() => { loadBuild(); });
</script>

<div class="space-y-6">
  <!-- Header + Toolbar -->
  <div class="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm">
    <div>
      <h2 class="text-xl font-bold tracking-tight">Build Viewer</h2>
      {#if selectedChar}
        <p class="text-sm text-muted-foreground">{selectedChar.name} — {selectedChar.profession} (Level {selectedChar.level})</p>
      {/if}
    </div>
    <div class="flex flex-wrap items-center gap-2">
      {#if metaLastUpdated}
        <span class="text-xs text-muted-foreground">Meta: {new Date(metaLastUpdated).toLocaleDateString()}</span>
      {/if}
      <Button variant="outline" size="sm" onclick={refreshMeta} disabled={refreshing}>
        {refreshing ? 'Refreshing...' : '↻ Refresh from Wiki'}
      </Button>
      <Button size="sm" onclick={() => loadBuild(selectedChar?.name)} disabled={$loading}>
        {$loading ? 'Loading...' : '🔄 Reload'}
      </Button>
    </div>
  </div>

  {#if $loading}
    <div class="flex items-center gap-3 py-8 text-muted-foreground">
      <Spinner />
      Loading build data...
    </div>
  {/if}

  {#if $error}
    <div class="rounded-lg bg-destructive/15 p-4 text-sm text-destructive"><strong>Error:</strong> {$error}</div>
  {/if}

  {#if !$loading && !$error && selectedChar && build}
    <!-- Other Characters -->
    {#if characterList.length > 0}
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-muted-foreground">Other characters:</span>
        {#each characterList as name, i (name || 'char-' + i)}
          <button class="rounded-md border px-3 py-1 text-sm text-brand transition-colors hover:bg-brand-light/50" onclick={() => loadBuild(name)}>
            {name}
          </button>
        {/each}
      </div>
    {/if}

    <!-- PvE Specializations -->
    <div class="rounded-xl border bg-card p-6 shadow-sm">
      <div class="mb-4 flex items-center gap-2">
        <h4 class="text-sm font-semibold text-foreground">PvE — Specializations & Traits</h4>
        {#if metaComparison && countMismatchedSpecs() > 0}
          <span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
            ⚠ {countMismatchedSpecs()} spec{countMismatchedSpecs() > 1 ? 's' : ''} differ from meta
          </span>
        {/if}
      </div>
      {#if !build.pve?.specializations?.length}
        <p class="text-sm italic text-muted-foreground">No PvE specializations equipped.</p>
      {:else}
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {#each build.pve.specializations as spec, i (spec.id || 'spec-' + i)}
            <div class="rounded-lg border bg-background p-4">
              <div class="mb-3 flex items-center gap-2">
                {#if spec.icon}<img src={spec.icon} alt="" width="28" height="28" />{/if}
                <span class="font-semibold">{spec.name}</span>
              </div>
              <div class="space-y-1.5">
                {#each spec.traits as trait, j (trait.id || spec.id + '-trait-' + j)}
                  <div class="grid grid-cols-[1fr_auto] items-center gap-2 text-sm">
                    <div class="flex min-w-0 items-center gap-1.5">
                      {#if trait.icon}<img src={trait.icon} alt="" width="16" height="16" />{/if}
                      {#if trait.wikiUrl}
                        <a class="truncate text-brand hover:underline" href={trait.wikiUrl} target="_blank">{trait.name}</a>
                      {:else}
                        <span class="truncate">{trait.name}</span>
                      {/if}
                    </div>
                    <div class="shrink-0 text-right">
                      {#if metaComparison}
                        {@const specMatch = metaComparison.specializationMatches?.find(m => m.name === spec.name)}
                        {#if specMatch}
                          {@const metaTrait = specMatch.metaTraits?.[j]}
                          {#if metaTrait != null && metaTrait === trait.id}
                            <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">✓</span>
                          {:else if metaTrait != null}
                            <span class="text-xs font-bold text-red-600 dark:text-red-400">✗</span>
                          {/if}
                        {/if}
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- PvE Skills -->
    <div class="rounded-xl border bg-card p-6 shadow-sm">
      <div class="mb-4 flex items-center gap-2">
        <h4 class="text-sm font-semibold text-foreground">PvE — Skill Bar</h4>
        {#if metaComparison && countMismatchedSkills() > 0}
          <span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/50 dark:text-red-400">
            ⚠ {countMismatchedSkills()} skill{countMismatchedSkills() > 1 ? 's' : ''} outdated
          </span>
        {:else if metaComparison && countMismatchedSkills() === 0}
          <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
            ✓ All match meta
          </span>
        {/if}
      </div>
      {#if !build.pve?.skills?.length}
        <p class="text-sm italic text-muted-foreground">No skill data.</p>
      {:else}
        <div class="flex flex-wrap gap-3">
          {#each build.pve.skills as skill, i (skill.slot || 'skill-' + i)}
            {@const sm = metaComparison?.skillMatches?.find(m => m.slot === skill.slot)}
            <div
              class="group relative flex flex-col items-center rounded-lg border bg-background p-3 text-center min-w-[90px] {sm?.match ? 'border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/20' : sm ? 'border-red-400/50 bg-red-50/30 dark:bg-red-950/20' : ''}"
              title={skill.name}
            >
              <span class="text-[10px] uppercase text-muted-foreground">{slotLabels[skill.slot] || skill.slot}</span>
              {#if skill.icon}
                <img src={skill.icon} alt="" width="40" height="40" class="my-1.5" />
              {/if}
              <span class="max-w-[100px] truncate text-xs font-medium">
                {#if skill.wikiUrl}
                  <a href={skill.wikiUrl} target="_blank" class="text-brand hover:underline">{skill.name}</a>
                {:else}
                  {skill.name}
                {/if}
              </span>
              {#if sm && !sm.match}
                <span class="mt-1 text-[10px] text-muted-foreground">Meta: {sm.expectedName}</span>
              {/if}
              <!-- Hover tooltip for full name -->
              <div class="pointer-events-none absolute -top-2 left-1/2 z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md opacity-0 transition-opacity group-hover:opacity-100">
                {skill.name}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Equipment -->
    <div class="rounded-xl border bg-card p-6 shadow-sm">
      <div class="mb-4 flex items-center gap-2">
        <h4 class="text-sm font-semibold text-foreground">Equipment</h4>
        {#if metaComparison?.equipmentSummary?.prefix}
          {@const metaPrefix = metaComparison.equipmentSummary.prefix}
          {@const allMatches = (build.equipment || []).map(eq => {
            const sm = metaSlots[eq.slot];
            if (sm) return sm.match;
            return eq.prefix === metaPrefix ? 'exact' : (eq.prefix ? 'off' : 'unknown');
          })}
          {@const total = allMatches.filter(m => m !== 'unknown').length}
          {@const matching = allMatches.filter(m => m === 'exact' || m === 'prefix').length}
          <!-- Three-state summary (curated slots only) -->
          {@const curated = Object.values(metaSlots || {})}
          {@const exactCount = curated.filter(m => m.match === 'exact').length}
          {@const prefixCount = curated.filter(m => m.match === 'prefix').length}
          {@const offCount = curated.filter(m => m.match === 'off').length}
          <div class="flex flex-wrap items-center gap-1.5">
            {#if curated.length > 0}
              <span class="rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
                {exactCount} ✓ exact
              </span>
              <span class="rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
                {prefixCount} ~ aligned
              </span>
              {#if offCount > 0}
                <span class="rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400">
                  {offCount} ✗ off
                </span>
              {/if}
            {:else}
              <span class="text-xs text-muted-foreground">No meta data</span>
            {/if}
            <span class="rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground border">
              {matching.length}/{total} {metaPrefix}
            </span>
          </div>
        {/if}
      </div>

      {#if !build.equipment?.length}
        <p class="text-sm italic text-muted-foreground">No equipment data.</p>
      {:else}
        <div class="space-y-5">
          {#each categoryOrder as cat (cat)}
            {@const bucket = groupedEquipment[cat]}
            {#if bucket.flat.length > 0}
              <div>
                <div class="mb-2 flex items-baseline gap-2">
                  <h5 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{categoryLabels[cat]}</h5>
                  <span class="h-px flex-1 bg-border"></span>
                </div>

                {#if cat === 'armor' || cat === 'weapons'}
                  {@const subgroupKeys = Object.keys(bucket.bySubgroup).sort((a, b) => (subgroupOrder[a] ?? 99) - (subgroupOrder[b] ?? 99))}
                  <div class="space-y-3">
                    {#each subgroupKeys as sub (sub)}
                      {#if bucket.bySubgroup[sub]?.length}
                        <div>
                          <div class="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                            {subgroupLabels[sub] || sub}
                          </div>
                          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {#each bucket.bySubgroup[sub] as eq, i (eq.slot || cat + '-' + sub + '-' + i)}
                              {@render eqRow(eq)}
                            {/each}
                          </div>
                        </div>
                      {/if}
                    {/each}
                  </div>
                {:else}
                  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {#each bucket.flat as eq, i (eq.slot || cat + '-' + i)}
                      {@render eqRow(eq)}
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          {/each}
        </div>

        {#snippet eqRow(eq)}
          <div class="grid grid-cols-[1fr_1fr] gap-2 rounded-lg border bg-background p-2.5 text-sm">
            <!-- Left: Character item -->
            <div class="flex items-center gap-2 min-w-0">
              {#if eq.icon}<img src={eq.icon} alt="" width="24" height="24" class="shrink-0" />{/if}
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-[11px] uppercase text-muted-foreground">{equipmentSlots[eq.slot] || eq.slot}</span>
                  <span class="rounded border-l-4 {getRarityBorder(eq.rarity)}"></span>
                </div>
                <div class="truncate" title={eq.name}>
                  {#if eq.wikiUrl}
                    <a class="text-brand hover:underline" href={eq.wikiUrl} target="_blank">{eq.name}</a>
                  {:else}
                    {eq.name}
                  {/if}
                </div>
                {#if eq.prefix}
                  <span class="text-[11px] text-muted-foreground">Prefix: {eq.prefix}</span>
                {/if}
                {#if eq.upgrades?.length > 0}
                  <span class="text-[11px] text-gold" title={eq.upgrades.map(u => u.name).join(', ')}>
                    ⚙ {eq.upgrades.map(u => u.name).join(', ')}
                  </span>
                {/if}
              </div>
            </div>

            <!-- Right: Meta recommendation -->
            <div class="flex items-center gap-2 min-w-0">
              <div class="min-w-0 flex-1">
                {#if metaPrefix}
                  {@const suggestion = getMetaSuggestion(eq)}
                  {@const slotMatch = metaSlots[eq.slot]}
                  <div class="flex items-center gap-1.5">
                    <span class="text-[11px] uppercase text-muted-foreground">Meta</span>
                    {#if slotMatch}
                      {#if slotMatch.match === 'exact'}
                        <span class="text-emerald-600 dark:text-emerald-400 font-bold" title="Exact match — you have the meta item">✓</span>
                      {:else if slotMatch.match === 'prefix'}
                        <span class="text-amber-600 dark:text-amber-400 font-bold" title="Prefix match — same stats ({slotMatch.prefix}), different item">~</span>
                      {:else if slotMatch.match === 'off'}
                        <span class="text-red-600 dark:text-red-400 font-bold" title="Off-meta — {eq.prefix || 'no prefix'} vs meta {slotMatch.prefix}">✗</span>
                      {:else}
                        <span class="text-muted-foreground" title="No meta data for this slot">—</span>
                      {/if}
                    {:else}
                      {#if eq.prefix === metaPrefix}
                        <span class="text-emerald-600 dark:text-emerald-400 font-bold" title="Prefix matches meta ({metaPrefix})">✓</span>
                      {:else if eq.prefix}
                        <span class="text-amber-600 dark:text-amber-400 font-bold" title="Different prefix: {eq.prefix} vs meta {metaPrefix}">✗</span>
                      {:else}
                        <span class="text-muted-foreground" title="No prefix detected">—</span>
                      {/if}
                    {/if}
                  </div>
                  {#if metaSlots[eq.slot]}
                    <div class="flex items-center gap-1.5 min-w-0">
                      <img src={metaSlots[eq.slot].icon} alt="" width="24" height="24" class="shrink-0" />
                      <a class="truncate text-xs font-medium text-brand hover:underline" href={metaSlots[eq.slot].wikiUrl} target="_blank" title={metaSlots[eq.slot].name}>{metaSlots[eq.slot].name}</a>
                    </div>
                  {:else if suggestion}
                    <div class="truncate text-xs font-medium text-foreground" title={suggestion.name}>{suggestion.name}</div>
                    {#if suggestion.extra}
                      <div class="truncate text-[11px] text-muted-foreground">{suggestion.extra}</div>
                    {/if}
                  {:else}
                    <div class="text-xs text-foreground">{metaPrefix}</div>
                  {/if}
                {:else}
                  <span class="text-xs text-muted-foreground">No meta</span>
                {/if}
              </div>
            </div>
          </div>
        {/snippet}
      {/if}
    </div>

    <!-- Other Game Modes -->
    {#if build.pvp?.specializations?.length || build.wvw?.specializations?.length}
      <div class="rounded-xl border bg-card p-6 shadow-sm">
        <h4 class="mb-3 text-sm font-semibold text-foreground">Other Game Modes</h4>
        {#if build.pvp?.specializations?.length}
          <div class="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <strong>PvP:</strong>
            {#each build.pvp.specializations as spec, i (spec.id || 'pvp-' + i)}
              <span class="rounded bg-muted px-2 py-0.5 text-xs">{spec.name}</span>
            {/each}
          </div>
        {/if}
        {#if build.wvw?.specializations?.length}
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <strong>WvW:</strong>
            {#each build.wvw.specializations as spec, i (spec.id || 'wvw-' + i)}
              <span class="rounded bg-muted px-2 py-0.5 text-xs">{spec.name}</span>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Meta Comparison Summary -->
    {#if metaComparison}
      <div class="rounded-xl border-l-4 border-l-brand border bg-card p-6 shadow-sm">
        <h4 class="mb-4 text-sm font-semibold text-foreground">
          Meta Build: {metaComparison.source} — {metaComparison.metaName}
        </h4>
        <div class="space-y-1">
          {#each metaComparison.specializationMatches as sm, i (sm.name || 'meta-spec-' + i)}
            <div class="flex items-baseline gap-3 text-sm">
              <span class="w-32 shrink-0 font-semibold">{sm.name}</span>
              {#if sm.match}
                <span class="text-emerald-600 dark:text-emerald-400">✅ All traits match</span>
              {:else}
                <span class="text-red-600 dark:text-red-400">
                  ❌ {sm.reason || 'Different traits'}
                  {#if sm.missingTraits?.length}
                    — missing:
                    {#each sm.missingTraits as mt, mi}
                      {#if mt.wikiUrl}
                        <a href={mt.wikiUrl} target="_blank" class="text-brand hover:underline">{mt.name}</a>
                      {:else}
                        {mt.name}
                      {/if}
                      {mi < sm.missingTraits.length - 1 ? ', ' : ''}
                    {/each}
                  {/if}
                </span>
              {/if}
            </div>
          {/each}

          <div class="my-2 border-t"></div>

          {#each metaComparison.skillMatches as sm, i (sm.slot || 'meta-skill-' + i)}
            <div class="flex items-baseline gap-3 text-sm">
              <span class="w-32 shrink-0 font-semibold">{slotLabels[sm.slot] || sm.slot}</span>
              {#if sm.match}
                <span class="text-emerald-600 dark:text-emerald-400">✅ {sm.expectedName}</span>
              {:else}
                <span class="text-red-600 dark:text-red-400">❌ Yours: "{sm.actualName}" — Meta: "{sm.expectedName}"</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {:else if selectedChar}
      <div class="py-8 text-center text-sm text-muted-foreground">
        No meta build found for {selectedChar.profession}. Try "Refresh from Wiki" or add one to meta-builds.json.
      </div>
    {/if}
  {:else if !$loading && !$error}
    <div class="py-12 text-center text-muted-foreground">No character data available. Check your API key permissions.</div>
  {/if}
</div>
