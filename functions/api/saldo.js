/**
 * functions/api/saldo.js — Worker de Cloudflare Pages
 * Ruta: GET /api/saldo
 *
 * Devuelve el saldo total actual adeudado al alumno.
 * Cloudflare inyecta automáticamente "context.env.medebe_db"
 * porque así se llama el binding definido en wrangler.toml.
 */

export async function onRequestGet(context) {
  try {
    const db = context.env.medebe_db;

    // Consultamos la única fila de la tabla saldo (id = 1)
    const row = await db
      .prepare('SELECT total FROM saldo WHERE id = 1')
      .first();

    const total = row?.total ?? 0;

    return Response.json({ total }, { headers: corsHeaders() });

  } catch (err) {
    return Response.json(
      { error: 'Error al obtener el saldo: ' + err.message },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// El navegador hace un preflight OPTIONS antes del fetch real.
// Si no respondemos esto, el fetch falla con error de CORS.
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
