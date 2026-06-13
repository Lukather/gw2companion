<script>
  import { api } from '../lib/api.js';
  import { hasKey } from '../lib/stores.js';
  import Card from '../lib/components/ui/Card.svelte';
  import CardHeader from '../lib/components/ui/CardHeader.svelte';
  import CardTitle from '../lib/components/ui/CardTitle.svelte';
  import CardDescription from '../lib/components/ui/CardDescription.svelte';
  import CardContent from '../lib/components/ui/CardContent.svelte';
  import CardFooter from '../lib/components/ui/CardFooter.svelte';
  import Button from '../lib/components/ui/Button.svelte';
  import Input from '../lib/components/ui/Input.svelte';

  let apiKey = $state('');
  let submitting = $state(false);
  let errorMsg = $state('');
  let successMsg = $state('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!apiKey.trim()) return;

    submitting = true;
    errorMsg = '';
    successMsg = '';

    try {
      const result = await api.setKey(apiKey.trim());
      successMsg = `Key validated! Account: ${result.tokenInfo.name}`;
      hasKey.set(true);
    } catch (err) {
      errorMsg = err.body?.error || err.message || 'Failed to validate key';
    } finally {
      submitting = false;
    }
  }
</script>

<div class="mx-auto max-w-lg py-8">
  <Card>
    <CardHeader>
      <CardTitle>Welcome to GW2 Companion</CardTitle>
      <CardDescription>
        Enter your Guild Wars 2 API key to get started.
      </CardDescription>
    </CardHeader>

    <CardContent>
      <div class="mb-6 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
        <p>
          You can create an API key at{' '}
          <a
            href="https://account.arena.net/applications"
            target="_blank"
            rel="noopener"
            class="font-medium text-brand underline underline-offset-4 hover:text-brand-hover"
          >
            account.arena.net/applications
          </a>.
        </p>
        <p class="mt-1">
          Required permissions:{' '}
          <span class="font-semibold text-foreground">characters</span>,{' '}
          <span class="font-semibold text-foreground">inventories</span>,{' '}
          <span class="font-semibold text-foreground">tradingpost</span>,{' '}
          <span class="font-semibold text-foreground">account</span>.
        </p>
      </div>

      <form onsubmit={handleSubmit} class="space-y-4">
        <div class="space-y-2">
          <label for="apikey" class="text-sm font-medium text-foreground">
            API Key
          </label>
          <Input
            id="apikey"
            type="password"
            bind:value={apiKey}
            placeholder="Paste your GW2 API key here..."
            disabled={submitting}
            class="font-mono"
          />
        </div>

        <Button type="submit" disabled={submitting || !apiKey.trim()} class="w-full">
          {submitting ? 'Validating...' : 'Save & Validate'}
        </Button>
      </form>

      {#if errorMsg}
        <div class="mt-4 rounded-lg bg-destructive/15 p-3 text-sm text-destructive">
          {errorMsg}
        </div>
      {/if}

      {#if successMsg}
        <div class="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {successMsg}
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
