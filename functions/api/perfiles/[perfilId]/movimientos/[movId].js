/**
 * DELETE /api/perfiles/:perfilId/movimientos/:movId
 * Elimina el movimiento y revierte su efecto sobre el saldo del perfil.
 */

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

export async function onRequestDelete(context) {
  try {
    const db = context.env.medebe_db;
    const { perfilId, movId } = context.params;

    const mov = await db
      .prepare('SELECT * FROM movimientos_perfil WHERE id = ? AND perfil_id = ?')
      .bind(movId, perfilId)
      .first();

    if (!mov) return Response.json({ error: 'Movimiento no encontrado.' }, { status: 404, headers: corsHeaders() });

    // Revertir: si era cargo (+delta), restar; si era pago (-delta), sumar
    const reversion = mov.tipo === 'cargo' ? -mov.monto : mov.monto;

    await db.batch([
      db.prepare('DELETE FROM movimientos_perfil WHERE id = ?').bind(movId),
      db.prepare('UPDATE perfiles SET saldo = saldo + ? WHERE id = ?').bind(reversion, perfilId),
    ]);

    const perfil = await db.prepare('SELECT saldo FROM perfiles WHERE id = ?').bind(perfilId).first();
    return Response.json({ ok: true, nuevoSaldo: perfil?.saldo ?? 0 }, { headers: corsHeaders() });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
