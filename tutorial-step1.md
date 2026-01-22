# Using SVAR Gantt in SvelteKit

This tutorial walks you through integrating the SVAR Gantt chart component into a SvelteKit application. We'll build it step by step, encountering and solving common issues along the way.

The complete source code is available at [github.com/svar-widgets/svelte-gantt-sveltekit](https://github.com/svar-widgets/gantt-demos-svelte/tree/basic), this tutorial code covers the `basic` branch of the repo.

## Creating the Project

Let's start by creating a new SvelteKit application:

```bash
npx sv create my-gantt-app --template minimal --types ts
cd my-gantt-app
npm install
```

Now add the SVAR Gantt package:

```bash
npm install @svar-ui/svelte-gantt
```

## Configuring Vite

Before we start, we need to configure Vite. The SVAR Gantt package requires a build-time variable. Update your `vite.config.ts`:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  define: {
    __APP_VERSION__: JSON.stringify("2.5.0")
  }
});
```

## Adding the Gantt Component

With the package installed, let's import the Gantt widget. Let's create `src/lib/components/GanttChart.svelte`:

```svelte
<script lang="ts">
  import { browser } from "$app/environment";
  import { Gantt } from "@svar-ui/svelte-gantt";

  const tasks = [
    {
      id: 1,
      text: "Project Planning",
      start: new Date(2024, 0, 1),
      end: new Date(2024, 0, 10),
      progress: 100,
      type: "summary",
      open: true,
    },
    {
      id: 2,
      text: "Requirements Gathering",
      start: new Date(2024, 0, 1),
      end: new Date(2024, 0, 5),
      progress: 100,
      parent: 1,
    },
    // ... more tasks
  ];

  const links = [
    { id: 1, source: 2, target: 3, type: "e2s" },
  ];

  const scales = [
    { unit: "month", step: 1, format: "%M %Y" },
    { unit: "week", step: 1, format: "Week %w" },
  ];
</script>

<div style="height: 600px; width: 100%;">
  {#if browser}
    <Gantt {tasks} {links} {scales} />
  {/if}
</div>
```

Notice the `{#if browser}` check — the Gantt component sizes itself based on its container dimensions and renders content accordingly. Server-side rendering would produce incorrect output since the actual container size isn't known until the page loads in the browser. Skipping SSR for the Gantt avoids a wasteful double render (server pass followed by client repaint).

Let's also update the page to display our component. In `src/routes/+page.svelte`:

```svelte
<script>
  import GanttChart from "$lib/components/GanttChart.svelte";
</script>

<div class="container">
  <header>
    <h1>My Gantt Chart</h1>
  </header>
  <main>
    <GanttChart />
  </main>
</div>
```

Time to see what we've got — run `npm run dev` and... the component renders, but something's off. Elements are misaligned, there's no proper styling. What did we miss?

## Adding the Theme

The Svelte package embeds its styles directly in the components — no separate CSS import needed. However, SVAR components use a theme provider for visual styling. We need to wrap our Gantt with the `Willow` theme:

```svelte
<script lang="ts">
  import { browser } from "$app/environment";
  import { Gantt, Willow } from "@svar-ui/svelte-gantt";

  // ... tasks, links, scales definitions ...
</script>

<div style="height: 600px; width: 100%;">
  <Willow>
    {#if browser}
      <Gantt {tasks} {links} {scales} />
    {/if}
  </Willow>
</div>
```

That's more like it — styled headers, colored task bars, proper visual feedback.

> ADD SCREENSHOT HERE

## Fixing the Layout

If you're going for a flexible layout where the Gantt should fill available space (instead of our fixed 600px height), you might run into another issue. Let's try changing the container to use percentage height:

```svelte
<div style="height: 100%; width: 100%;">
  <Willow>
    {#if browser}
      <Gantt {tasks} {links} {scales} />
    {/if}
  </Willow>
</div>
```

Hmm, now the Gantt might collapse or not fill the space correctly. The issue here is that the theme wrapper needs explicit height. Let's create `src/app.css` and add this:

```css
html,
body {
  height: 100%;
  margin: 0;
}

.wx-theme {
  height: 100%;
  overflow: hidden;
}
```

The `.wx-theme` class is used internally by SVAR's theme providers. Without explicit height, it defaults to content-based sizing, which breaks the percentage-based layout chain.

Don't forget to import the CSS in your layout. Update `src/routes/+layout.svelte`:

```svelte
<script>
  import "../app.css";

  let { children } = $props();
</script>

{@render children()}
```

Now the Gantt properly fills its container.

## Enabling Edit Operations

So far our Gantt displays tasks, but users can't edit them. Let's add an editor panel that allows modifying task properties.

The Gantt component exposes its API through a `bind:this` directive. We can capture this reference and pass it to an `Editor` component:

```svelte
<script lang="ts">
  import { browser } from "$app/environment";
  import { Gantt, Willow, Editor } from "@svar-ui/svelte-gantt";

  let api = $state<any>(null);

  // ... tasks, links, scales definitions ...
</script>

<div style="height: 100%; width: 100%;">
  <Willow>
    {#if browser}
      <Gantt {tasks} {links} {scales} bind:this={api} />
      <Editor {api} />
    {/if}
  </Willow>
</div>
```

A few things happening here:

- **`bind:this={api}`** — When the Gantt initializes, Svelte stores the component instance in our `api` variable
- **`Editor`** — Renders a side panel that appears when a task is selected, allowing users to modify its properties

Now double-clicking on a task opens an editor panel where users can change the task name, dates, progress, and other properties.

> ADD SCREENSHOT HERE

## Next Steps

At this point you have a working Gantt chart with task editing. Here's where to go from here depending on what you want to build.

**Working with task data** — We used a simple array of tasks in this tutorial, but real applications need more. The [tasks API reference](https://docs.svar.dev/svelte/gantt/api/properties/tasks) covers all available task properties including custom fields, duration-based tasks, and handling different task types.

**Setting up dependencies** — Task links define how work flows through your project. The [links API reference](https://docs.svar.dev/svelte/gantt/api/properties/links) explains all dependency types and how to configure lag time between connected tasks.

**Customizing the editor** — The default editor works well, but you might want to add custom fields or change the layout. The [editor guide](https://docs.svar.dev/svelte/editor/guides/initialization) shows how to configure fields, validation, and create custom editor layouts.

**Formatting dates and scales** — The `%M %Y` format we used is just the beginning. The [localization guide](https://docs.svar.dev/svelte/core/guides/localization#date-and-time-format-specification) has the complete list of format specifiers and explains how to set up different locales.
