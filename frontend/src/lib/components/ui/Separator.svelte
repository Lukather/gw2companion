<script>
  import { cn } from '$lib/utils.js';

  let { class: className = '', orientation = 'horizontal', decorative = true, ...rest } = $props();
</script>

{#if orientation === 'horizontal'}
  <div
    role={decorative ? 'none' : 'separator'}
    aria-orientation="horizontal"
    class={cn('shrink-0 bg-border h-[1px] w-full', className)}
    {...rest}
  ></div>
{:else}
  <div
    role={decorative ? 'none' : 'separator'}
    aria-orientation="vertical"
    class={cn('shrink-0 bg-border w-[1px] h-full', className)}
    {...rest}
  ></div>
{/if}
