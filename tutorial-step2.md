# Adding Backend to SVAR Gantt

This tutorial continues from where [Part 1](./tutorial-step1.md) left off. We have a working Gantt chart with client-side data and editing. Now let's add a backend to persist changes.

The complete source code is available at [github.com/svar-widgets/gantt-demo¬sveltekit](https://github.com/svar-widgets/gantt-demo-sveltekit/tree/backend), this tutorial covers the `backend` branch.

## Why a Backend?

Our current Gantt works great, but changes disappear on page refresh. For a real application we need:

- Persistent storage for tasks and links
- Multi-user access to the same project data
- Server-side validation and business logic

We'll use SQLite for simplicity — it's file-based, requires no separate server, and works well for demos and small teams.

## Setting Up the Database

First, let's add the SQLite package:

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

The database module lives at `src/lib/server/db.ts`. The schema has two tables:

```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT DEFAULT '',
  start TEXT,
  end TEXT,
  duration INTEGER,
  progress INTEGER DEFAULT 0,
  type TEXT,
  parent INTEGER DEFAULT 0,
  orderId INTEGER DEFAULT 0
);

CREATE TABLE links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source INTEGER NOT NULL,
  target INTEGER NOT NULL,
  type TEXT NOT NULL
);
```

A few notes on the schema:

- **`start`** and **`end`** are stored as TEXT (ISO date strings)
- **`parent`** references another task's ID for hierarchical structures (0 = top level)
- **`orderId`** maintains display order within each branch — siblings are sorted by this value
- **`type`** on tasks can be "summary", "milestone", or null for regular tasks
- **`type`** on links defines the dependency: "e2s" (end-to-start), "s2s", "e2e", "s2e"

The database initializes on first access. If tables are empty, it seeds them with sample data so there's something to display.

## Loading Data

### Server Side

The server needs to expose tasks and links through REST endpoints. In SvelteKit, we create `+server.ts` files. Here's what the tasks route looks like at `src/routes/api/tasks/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllTasks, createTask } from '$lib/server/db';

export const GET: RequestHandler = async () => {
  const tasks = getAllTasks();
  return json(tasks);
};
```

The links route follows the same pattern. One thing worth noting: dates are stored as ISO strings in the database. We'll handle conversion on the client.

### Client Side

To connect the Gantt to our backend, we'll use the data provider package:

```bash
npm install @svar-ui/gantt-data-provider
```

The component changes are minimal. Instead of hardcoded arrays, we initialize a `RestDataProvider` and call its `getData()` method:

```svelte
<script lang="ts">
  import { browser } from "$app/environment";
  import { RestDataProvider } from "@svar-ui/gantt-data-provider";

  let tasks = $state<any[]>([]);
  let links = $state<any[]>([]);

  const server = new RestDataProvider("/api");

  if (browser) {
    server.getData().then((data) => {
      tasks = data.tasks;
      links = data.links;
    });
  }
</script>
```

Here we use a `browser` check to limit data loading to client-side code only and start it as fast as possible. The Gantt component can render without data — it will show an empty chart initially, then populate when data arrives. This provides better UX: users see the Gantt interface immediately rather than waiting for the full page to load.

Alternatively, you could move data loading to `+page.server.ts` using SvelteKit's `load` function for server-side fetching. This avoids the empty state entirely but introduces a delay in page loading — the Gantt will only appear once data has been fetched. Here's how that would look (not used in this demo):

```typescript
// src/routes/+page.server.ts
import { getAllTasks, getAllLinks } from '$lib/server/db';

export function load() {
  return {
    tasks: getAllTasks(),
    links: getAllLinks()
  };
}
```

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  let { data } = $props();
</script>

<GanttChart tasks={data.tasks} links={data.links} />
```

> ADD SCREENSHOT HERE

What's `RestDataProvider` actually doing? It's a thin wrapper around `fetch` with two jobs:

1. Fetches `/api/tasks` and `/api/links` in parallel
2. Converts date strings from JSON into JavaScript `Date` objects

That's it for loading. The provider knows the REST conventions and handles parsing, so the component receives ready-to-use data.

## Saving Data

To persist changes, we need a full set of REST endpoints:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/tasks | Get all tasks |
| POST | /api/tasks | Create task |
| PUT | /api/tasks/{id} | Update task |
| DELETE | /api/tasks/{id} | Delete task |
| GET | /api/links | Get all links |
| POST | /api/links | Create link |
| PUT | /api/links/{id} | Update link |
| DELETE | /api/links/{id} | Delete link |

For POST and PUT, the response should include the ID: `{ "id": 123 }`. For DELETE, return an empty object: `{}`.

### SvelteKit Route Structure

In SvelteKit, the routes are organized as:

```
src/routes/api/
├── tasks/
│   ├── +server.ts          # GET, POST
│   └── [taskId]/
│       └── +server.ts      # GET, PUT, DELETE
└── links/
    ├── +server.ts          # GET, POST
    └── [id]/
        └── +server.ts      # GET, PUT, DELETE
```

Here's the task update/delete route at `src/routes/api/tasks/[taskId]/+server.ts`:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTaskById, updateTask, deleteTask, moveTask } from '$lib/server/db';

export const GET: RequestHandler = async ({ params }) => {
  const task = getTaskById(Number(params.taskId));
  if (!task) {
    throw error(404, 'Task not found');
  }
  return json(task);
};

export const PUT: RequestHandler = async ({ params, request }) => {
  const body = await request.json();

  if (body.operation === 'move') {
    const id = moveTask(Number(params.taskId), body.target, body.mode);
    return json({ id: Number(id) });
  }

  const id = updateTask(Number(params.taskId), body);
  return json({ id: Number(id) });
};

export const DELETE: RequestHandler = async ({ params }) => {
  deleteTask(Number(params.taskId));
  return json({});
};
```

See the [REST routes documentation](https://docs.svar.dev/svelte/gantt/api/overview/restroutes_overview) for detailed request/response formats.

### Connecting the Component

With endpoints ready, we connect the data provider to the Gantt through its `init` callback:

```svelte
<script lang="ts">
  function init(ganttApi: any) {
    api = ganttApi;
    ganttApi.setNext(server);
  }
</script>

<Gantt {tasks} {links} {scales} {init} />
```

The `setNext` call plugs the provider into the component's action pipeline. From this point, when something happens in the Gantt — a task is created, updated, deleted, or moved — the action flows through the provider to the appropriate REST endpoint.

How does this work internally? The Gantt emits [actions](https://docs.svar.dev/svelte/gantt/api/overview/actions_overview) for every data operation: `add-task`, `update-task`, `delete-task`, and so on. The `RestDataProvider` intercepts these, maps them to HTTP methods, ensures only valid data is sent, and handles the server response (including updating local IDs after creation).

No need to wire up event handlers or manage optimistic updates — the provider handles the mapping between component actions and REST calls.

## Row Reordering

Users can drag tasks to reorder them within the grid. The client side already handles this — the `RestDataProvider` sends move operations automatically. But the server needs special handling to track display order.

When a task is moved, the request includes extra fields:

```json
{
  "operation": "move",
  "mode": "after",
  "target": 4
}
```

This means "place this task after task #4". The `mode` can be "after", "before", or "child" (to nest under another task).

To handle this on the server, we added logic in the PUT endpoint that checks for the `operation` field. When it's a move operation, instead of updating task properties, we recalculate the task's `parent` and `orderId` based on where it's being placed. Siblings get their `orderId` values shifted to make room.

Similarly, POST requests for new tasks can include `mode` and `target` to specify where in the hierarchy the task should appear.

## Adding the Toolbar

To better test the reordering we just implemented — along with other operations like adding tasks, deleting and indenting — let's add the `Toolbar` component. It's included in the gantt package, no extra install needed.

The toolbar needs the Gantt's API reference to trigger actions. We capture it during initialization and pass it to both the Toolbar and Editor:

```svelte
<Willow>
  {#if browser}
    <Toolbar {api} />
    <Gantt {tasks} {links} {scales} {init} />
    <Editor {api} />
  {/if}
</Willow>
```

Clicking "Add Task" in the toolbar creates a task through the same action pipeline — which flows through the data provider to the REST endpoint. Everything stays in sync.

> ADD SCREENSHOT HERE

## Handling Errors

What happens when something goes wrong? There are several layers where errors can be caught.

### Loading Errors

`getData()` returns a promise, so handling fetch failures is straightforward:

```svelte
<script lang="ts">
  if (browser) {
    server.getData()
      .then((data) => {
        tasks = data.tasks;
        links = data.links;
      })
      .catch((error) => {
        // Show error UI, retry option, etc.
        console.error("Failed to load data:", error);
      });
  }
</script>
```

### Save Operation Errors

When a save operation fails, the action bubbles through the component's event system with error information. You can listen for specific actions and react accordingly — for instance, removing a row that failed to save.

However, this approach has limits. The server shouldn't act as a validation layer. Validation belongs on the client side, where you can prevent invalid operations before they're attempted. Server errors should be rare exceptions, not part of the normal flow.

For most applications, the pragmatic solution is: inform the user something went wrong, and on their consent, reload the Gantt with fresh data from the server. This ensures the UI stays in sync with the actual database state.

### Custom Error Handling with RestDataProvider

For centralized error handling, you can subclass `RestDataProvider` and override the `send` method:

```typescript
class MyDataProvider extends RestDataProvider {
  async send<T>(
    url: string,
    method: string,
    data?: any,
    customHeaders: any = {}
  ): Promise<T> {
    try {
      return await super.send(url, method, data, customHeaders);
    } catch (error) {
      // Show toast notification, log to monitoring service, etc.
      showErrorNotification("Failed to save changes");
      throw error;
    }
  }
}
```

This intercepts all REST operations in one place — the simplest way to detect failures and surface them in your UI.

## Progress and Sync State

Related to error handling is tracking operation progress. While showing a loading spinner for initial data fetch is usually unnecessary (data loads fast, spinner causes flickering), you might want to indicate when changes are being saved.

### Loading Progress

If you do need a loading indicator, wrap the `getData()` promise:

```svelte
<script lang="ts">
  let loading = $state(true);

  if (browser) {
    server.getData()
      .then((data) => {
        tasks = data.tasks;
        links = data.links;
      })
      .finally(() => loading = false);
  }
</script>
```

### Tracking All Server Operations

To show progress for save operations as well, override `send` in a custom provider. The `onProgress` callback is your own function — pass it when creating the provider:

```typescript
class MyDataProvider extends RestDataProvider {
  constructor(url: string, private onProgress: (active: boolean) => void) {
    super(url);
  }

  async send<T>(url: string, method: string, data?: any, headers: any = {}): Promise<T> {
    this.onProgress(true);
    try {
      return await super.send(url, method, data, headers);
    } finally {
      this.onProgress(false);
    }
  }
}

// Usage:
let saving = $state(false);
const server = new MyDataProvider("/api", (active) => saving = active);
```

This fires on every REST call — initial load and all subsequent saves.

## Complete Component Code

Here's the full `GanttChart.svelte` with all pieces in place:

```svelte
<script lang="ts">
  import { browser } from "$app/environment";
  import { Gantt, Willow, Editor, Toolbar } from "@svar-ui/svelte-gantt";
  import { RestDataProvider } from "@svar-ui/gantt-data-provider";

  let api = $state<any>(null);
  let tasks = $state<any[]>([]);
  let links = $state<any[]>([]);

  const server = new RestDataProvider("/api");

  const scales = [
    { unit: "month", step: 1, format: "%M %Y" },
    { unit: "week", step: 1, format: "Week %w" },
  ];

  if (browser) {
    server.getData().then((data) => {
      tasks = data.tasks;
      links = data.links;
    });
  }

  function init(ganttApi: any) {
    api = ganttApi;
    ganttApi.setNext(server);
  }
</script>

<div style="height: 100%; width: 100%;">
  <Willow>
    {#if browser}
      <Toolbar {api} />
      <Gantt {tasks} {links} {scales} {init} />
      <Editor {api} />
    {/if}
  </Willow>
</div>
```

## Summary

We now have a Gantt that syncs all changes to the server:

- **Loading**: `RestDataProvider.getData()` fetches and parses data
- **Saving**: Actions flow through `api.setNext(server)` to REST endpoints
- **Reordering**: Special `operation: "move"` requests update task positions
- **UI**: Toolbar provides common operations, Editor allows detailed editing

The component handles the complexity of mapping UI interactions to API calls. You can use this demo as a starting point for your application — the REST endpoints and database layer are ready to extend with your own business logic.
