<script>
  import { cn } from '$lib/utils.js';
  let { children, class: className = '', tag = 'h3', ...rest } = $props();
</script>

<svelte:element
  this={tag}
  class={cn('font-semibold leading-none tracking-tight', className)}
  {...rest}
>
  {@render children?.()}
</svelte:element>
