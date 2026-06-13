<script>
  import { cn } from '$lib/utils.js';
  let { children, class: className = '', ...rest } = $props();
</script>

<td
  class={cn(
    'p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
    className
  )}
  {...rest}
>
  {@render children?.()}
</td>
