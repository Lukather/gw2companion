<script>
  import Home from './pages/Home.svelte';
  import Setup from './pages/Setup.svelte';
  import Inventory from './pages/Inventory.svelte';
  import Materials from './pages/Materials.svelte';
  import Achievements from './pages/Achievements.svelte';
  import Story from './pages/Story.svelte';
  import Builds from './pages/Builds.svelte';
  import { hasKey, checkKey, selectedChar } from './lib/stores.js';
  import { theme } from './lib/theme.js';
  import { cn } from './lib/utils.js';
  import Button from './lib/components/ui/Button.svelte';
  import Separator from './lib/components/ui/Separator.svelte';
  import HomeIcon from '@lucide/svelte/icons/home';
  import Sword from '@lucide/svelte/icons/sword';
  import FlaskConical from '@lucide/svelte/icons/flask-conical';
  import Wrench from '@lucide/svelte/icons/wrench';
  import Trophy from '@lucide/svelte/icons/trophy';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Key from '@lucide/svelte/icons/key';
  import Sun from '@lucide/svelte/icons/sun';
  import Moon from '@lucide/svelte/icons/moon';
  import PanelLeftClose from '@lucide/svelte/icons/panel-left-close';
  import PanelLeft from '@lucide/svelte/icons/panel-left';
  import { fade } from 'svelte/transition';
  import logo from './lib/logo.svg';

  let currentPage = $state('setup');
  let sidebarOpen = $state(true);

  const navItems = [
    { id: 'home', label: 'Home', icon: HomeIcon },
    { id: 'inventory', label: 'Inventory', icon: Sword },
    { id: 'materials', label: 'Materials', icon: FlaskConical },
    { id: 'builds', label: 'Builds', icon: Wrench },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
    { id: 'story', label: 'Story', icon: BookOpen },
    { id: 'setup', label: 'Setup', icon: Key },
  ];

  // Check for existing key on app startup
  $effect(() => {
    checkKey();
  });

  $effect(() => {
    if ($hasKey) {
      currentPage = 'home';
    } else {
      currentPage = 'setup';
    }
  });

  function toggleTheme() {
    $theme = $theme === 'dark' ? 'light' : 'dark';
  }

  function navigateTo(page) {
    currentPage = page;
  }

  // Navigate to Inventory when a character is selected from Home
  $effect(() => {
    if ($selectedChar) {
      currentPage = 'inventory';
    }
  });
</script>

<div class="flex h-screen overflow-hidden bg-background">
  <!-- Sidebar backdrop (mobile) -->
  {#if sidebarOpen}
    <button
      class="fixed inset-0 z-20 bg-black/50 lg:hidden"
      onclick={() => sidebarOpen = false}
      aria-label="Close sidebar"
    ></button>
  {/if}

  <!-- Sidebar -->
  <aside
    class={cn(
      'fixed inset-y-0 left-0 z-30 flex w-56 flex-col border-r bg-card transition-transform duration-200 lg:static lg:translate-x-0',
      sidebarOpen ? 'translate-x-0' : '-translate-x-full'
    )}
  >
    <!-- Sidebar header -->
    <div class="flex h-16 items-center border-b px-4">
      <button onclick={() => navigateTo('home')} class="shrink-0" title="Home">
        <img src={logo} alt="GW2 Companion" class="h-11 w-auto" />
      </button>
      <button
        class="ml-auto rounded-md p-1 hover:bg-accent lg:hidden"
        onclick={() => sidebarOpen = false}
      >
        <PanelLeftClose class="h-5 w-5" />
      </button>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 space-y-1 overflow-y-auto p-3">
      {#each navItems as item}
        {@const Icon = item.icon}
        <button
          class={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            currentPage === item.id
              ? 'border-l-2 border-l-brand bg-brand/10 text-brand'
              : 'border-l-2 border-l-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
          onclick={() => navigateTo(item.id)}
        >
          <Icon class="h-4 w-4" />
          {item.label}
        </button>
      {/each}
    </nav>

    <!-- Sidebar footer -->
    <div class="border-t p-3">
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <span class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
        API: {$hasKey ? 'Connected' : 'Not set'}
      </div>
    </div>
  </aside>

  <!-- Main content area -->
  <div class="flex flex-1 flex-col overflow-hidden">
    <!-- Header -->
    <header class="flex h-16 items-center gap-4 border-b bg-card px-4 lg:px-6">
      <button
        class="rounded-md p-1 hover:bg-accent lg:hidden"
        onclick={() => sidebarOpen = true}
        aria-label="Open sidebar"
      >
        <PanelLeft class="h-5 w-5" />
      </button>

      <div class="flex-1"></div>

      <button
        onclick={toggleTheme}
        class="rounded-md p-2 hover:bg-accent"
        aria-label="Toggle light/dark mode"
        title="Toggle light/dark mode"
      >
        {#if $theme === 'dark'}
          <Sun class="h-5 w-5" />
        {:else}
          <Moon class="h-5 w-5" />
        {/if}
      </button>

      {#if $hasKey}
        <Button variant="outline" size="sm" onclick={() => navigateTo('setup')}>
          <Key class="mr-1 h-3.5 w-3.5" />
          API Key
        </Button>
      {/if}
    </header>

    <!-- Page content -->
    <main class="flex-1 overflow-y-auto p-4 lg:p-6">
      {#key currentPage}
        <div in:fade={{ duration: 150 }} out:fade={{ duration: 100 }}>
          {#if currentPage === 'home'}
            <Home />
          {:else if currentPage === 'setup'}
            <Setup />
          {:else if currentPage === 'inventory'}
            <Inventory />
          {:else if currentPage === 'materials'}
            <Materials />
          {:else if currentPage === 'achievements'}
            <Achievements />
          {:else if currentPage === 'story'}
            <Story />
          {:else if currentPage === 'builds'}
            <Builds />
          {/if}
        </div>
      {/key}
    </main>
  </div>
</div>
