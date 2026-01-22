import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLinksByTaskId, updateLink, deleteLink } from '$lib/server/db';

// GET treats id as taskId (returns links for that task)
export const GET: RequestHandler = async ({ params }) => {
  const links = getLinksByTaskId(Number(params.id));
  return json(links);
};

// PUT treats id as linkId
export const PUT: RequestHandler = async ({ params, request }) => {
  const body = await request.json();
  const linkId = updateLink(Number(params.id), body);
  return json({ id: Number(linkId) });
};

// DELETE treats id as linkId
export const DELETE: RequestHandler = async ({ params }) => {
  deleteLink(Number(params.id));
  return json({});
};
