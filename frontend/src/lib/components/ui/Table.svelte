<script>
  import { cn } from '$lib/utils.js';
  let { children, class: className = '', ...rest } = $props();
</script>

<div class={cn('relative w-full overflow-auto', className)} {...rest}>
  <table class="w-full caption-bottom text-sm">
    {@render children?.()}
  </table>
</div>
