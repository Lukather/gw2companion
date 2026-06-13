<script>
  import { cn } from '$lib/utils.js';
  let { children, class: className = '', ...rest } = $props();
</script>

<div class={cn('p-6 pt-0', className)} {...rest}>
  {@render children?.()}
</div>
