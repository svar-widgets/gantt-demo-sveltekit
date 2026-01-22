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
