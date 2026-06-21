/**
 * functions/api/perfiles/[id].js
 * DELETE /api/perfiles/:id → elimina un perfil y sus movimientos
 */

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

export async function onRequestGet(context) {
  try {
    const db = context.env.medebe_db;
    const id = context.params.id;
    const perfil = await db.prepare('SELECT * FROM perfiles WHERE id = ?').bind(id).first();
    if (!perfil) return Response.json({ error: 'Perfil no encontrado' }, { status: 404, headers: corsHeaders() });
    return Response.json(perfil, { headers: corsHeaders() });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function onRequestDelete(context) {
  try {
    const db = context.env.medebe_db;
    const id = context.params.id;
    await db.batch([
      db.prepare('DELETE FROM movimientos_perfil WHERE perfil_id = ?').bind(id),
      db.prepare('DELETE FROM perfiles WHERE id = ?').bind(id),
    ]);
    return Response.json({ ok: true }, { headers: corsHeaders() });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
