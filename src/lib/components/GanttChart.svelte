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
      <Toolbar {api} />
      <Gantt {tasks} {links} {scales} {init} />
      <Editor {api} />
  </Willow>
</div>
