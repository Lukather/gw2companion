<script>
  import { cn } from '$lib/utils.js';
  let { children, class: className = '', ...rest } = $props();
</script>

<thead class={cn('[&_tr]:border-b', className)} {...rest}>
  {@render children?.()}
</thead>
