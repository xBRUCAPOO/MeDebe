/**
 * functions/api/movimientos/[movId].js — Worker de Cloudflare Pages
 * Ruta: DELETE /api/movimientos/:movId
 *
 * Elimina un movimiento del Control Académico (tabla "movimientos")
 * y revierte automáticamente su efecto sobre el saldo total.
 * Mismo patrón que /api/perfiles/:perfilId/movimientos/:movId.
 */

export async function onRequestDelete(context) {
  try {
    const db = context.env.medebe_db;
    const { movId } = context.params;

    const mov = await db
      .prepare('SELECT * FROM movimientos WHERE id = ?')
      .bind(movId)
      .first();

    if (!mov) {
      return Response.json(
        { error: 'Movimiento no encontrado.' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Revertir: si era ingreso (+monto), restar del saldo; si era retiro (-monto), sumar.
    const reversion = mov.tipo === 'ingreso' ? -mov.monto : mov.monto;

    await db.batch([
      db.prepare('DELETE FROM movimientos WHERE id = ?').bind(movId),
      db.prepare('UPDATE saldo SET total = total + ? WHERE id = 1').bind(reversion),
    ]);

    const row = await db.prepare('SELECT total FROM saldo WHERE id = 1').first();

    return Response.json(
      { ok: true, nuevoSaldo: row?.total ?? 0 },
      { headers: corsHeaders() }
    );

  } catch (err) {
    return Response.json(
      { error: 'Error al eliminar el movimiento: ' + err.message },
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
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}
