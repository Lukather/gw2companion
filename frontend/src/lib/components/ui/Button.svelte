<script>
  import { cn } from '$lib/utils.js';

  let {
    children,
    variant = 'default',
    size = 'default',
    class: className = '',
    type = 'button',
    disabled = false,
    onclick = undefined,
    ...rest
  } = $props();

  const baseClasses = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

  const variantClasses = {
    default: 'bg-brand text-primary-foreground shadow hover:bg-brand-hover',
    destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
    outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-brand underline-offset-4 hover:underline',
  };

  const sizeClasses = {
    default: 'h-9 px-4 py-2',
    sm: 'h-8 rounded-md px-3 text-xs',
    lg: 'h-10 rounded-md px-8',
    icon: 'h-9 w-9',
  };
</script>

<button
  class={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
  {type}
  {disabled}
  {onclick}
>
  {@render children?.()}
</button>
