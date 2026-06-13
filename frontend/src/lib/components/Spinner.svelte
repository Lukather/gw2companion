<script>
  import { cn } from '$lib/utils.js';
  import Loader2 from '@lucide/svelte/icons/loader-2';

  let { class: className = '' } = $props();
</script>

<Loader2 class={cn('h-5 w-5 animate-spin text-brand', className)} />
