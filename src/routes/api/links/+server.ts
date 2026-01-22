import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllLinks, createLink } from '$lib/server/db';

export const GET: RequestHandler = async () => {
  const links = getAllLinks();
  return json(links);
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const id = createLink(body);
  return json({ id: Number(id) });
};
