/**
 * functions/api/perfiles/index.js
 * GET  /api/perfiles   → lista todos los perfiles
 * POST /api/perfiles   → crea un nuevo perfil
 */

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

export async function onRequestGet(context) {
  try {
    const db = context.env.medebe_db;
    const { results } = await db
      .prepare('SELECT id, nombre, descripcion, saldo, creado_en FROM perfiles ORDER BY id DESC')
      .all();
    return Response.json(results ?? [], { headers: corsHeaders() });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function onRequestPost(context) {
  try {
    const db = context.env.medebe_db;
    const { nombre, descripcion } = await context.request.json();

    if (!nombre || !String(nombre).trim()) {
      return Response.json({ error: 'El nombre es obligatorio.' }, { status: 400, headers: corsHeaders() });
    }

    const fecha = new Date().toISOString();
    const result = await db
      .prepare('INSERT INTO perfiles (nombre, descripcion, saldo, creado_en) VALUES (?, ?, 0, ?)')
      .bind(String(nombre).trim(), descripcion ? String(descripcion).trim() : null, fecha)
      .run();

    return Response.json({ ok: true, id: result.meta.last_row_id }, { headers: corsHeaders() });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
