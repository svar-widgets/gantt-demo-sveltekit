import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllTasks, createTask } from '$lib/server/db';

export const GET: RequestHandler = async () => {
  const tasks = getAllTasks();
  return json(tasks);
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const mode = body.mode ?? 'child';
  const target = body.target ?? 0;
  const id = createTask(body.task, mode, target);
  return json({ id: Number(id) });
};
