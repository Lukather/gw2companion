<script>
  import { cn } from '$lib/utils.js';
  let { children, class: className = '', ...rest } = $props();
</script>

<p class={cn('text-sm text-muted-foreground', className)} {...rest}>
  {@render children?.()}
</p>
