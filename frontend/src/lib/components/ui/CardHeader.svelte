<script>
  import { cn } from '$lib/utils.js';
  let { children, class: className = '', ...rest } = $props();
</script>

<div class={cn('flex flex-col space-y-1.5 p-6', className)} {...rest}>
  {@render children?.()}
</div>
