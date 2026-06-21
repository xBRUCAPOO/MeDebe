/**
 * functions/api/retiro.js — Worker de Cloudflare Pages
 * Ruta: POST /api/retiro
 *
 * Registra un retiro de dinero y resta el monto del saldo.
 * El saldo puede quedar negativo (por diseño del sistema):
 * la app frontend ya le pregunta al usuario si está seguro
 * antes de llamar a este endpoint.
 *
 * Body esperado (JSON):
 *   { monto: number }
 *
 * Respuesta exitosa:
 *   { ok: true, monto: number, nuevoSaldo: number }
 */

export async function onRequestPost(context) {
  try {
    const db = context.env.medebe_db;

    const body  = await context.request.json();
    const monto = parseFloat(body.monto);

    // ── Validación ────────────────────────────────────────────────────────
    if (isNaN(monto) || monto <= 0) {
      return Response.json(
        { error: 'El monto debe ser un número positivo.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const fecha = new Date().toISOString();

    // ── Escritura atómica: insertamos el retiro y descontamos del saldo ────
    await db.batch([
      db.prepare(
        `INSERT INTO movimientos (tipo, monto, fecha) VALUES ('retiro', ?, ?)`
      ).bind(monto, fecha),

      db.prepare(
        `UPDATE saldo SET total = total - ? WHERE id = 1`
      ).bind(monto),
    ]);

    const row = await db.prepare('SELECT total FROM saldo WHERE id = 1').first();

    return Response.json(
      { ok: true, monto, nuevoSaldo: row?.total ?? 0 },
      { headers: corsHeaders() }
    );

  } catch (err) {
    return Response.json(
      { error: 'Error al registrar el retiro: ' + err.message },
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}
