/**
 * functions/api/historial.js — Worker de Cloudflare Pages
 * Ruta: GET /api/historial
 *
 * Devuelve todos los movimientos (ingresos y retiros)
 * ordenados del más reciente al más antiguo.
 *
 * El campo "imagen" (si existe) viaja como string base64
 * (data:image/...;base64,...) y el frontend lo usa
 * directamente como src="..." de un <img>.
 */

export async function onRequestGet(context) {
  try {
    const db = context.env.medebe_db;

    const { results } = await db
      .prepare(`
        SELECT id, tipo, monto, materia, nota, imagen, fecha
        FROM movimientos
        ORDER BY id DESC
      `)
      .all();

    return Response.json(results ?? [], { headers: corsHeaders() });

  } catch (err) {
    return Response.json(
      { error: 'Error al obtener el historial: ' + err.message },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}
