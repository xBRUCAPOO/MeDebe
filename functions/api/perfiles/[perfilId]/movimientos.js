/**
 * GET  /api/perfiles/:perfilId/movimientos
 * POST /api/perfiles/:perfilId/movimientos
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
    const pid = context.params.perfilId;
    const { results } = await db
      .prepare('SELECT * FROM movimientos_perfil WHERE perfil_id = ? ORDER BY id DESC')
      .bind(pid)
      .all();
    return Response.json(results ?? [], { headers: corsHeaders() });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function onRequestPost(context) {
  try {
    const db = context.env.medebe_db;
    const pid = context.params.perfilId;
    const { tipo, monto, asunto, descripcion, imagen } = await context.request.json();

    if (!asunto || !String(asunto).trim()) {
      return Response.json({ error: 'El asunto es obligatorio.' }, { status: 400, headers: corsHeaders() });
    }
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      return Response.json({ error: 'El monto debe ser positivo.' }, { status: 400, headers: corsHeaders() });
    }
    if (!['cargo', 'pago'].includes(tipo)) {
      return Response.json({ error: 'Tipo inválido.' }, { status: 400, headers: corsHeaders() });
    }

    let imagenData = null;
    if (imagen) {
      if (typeof imagen !== 'string' || !imagen.startsWith('data:image/')) {
        return Response.json({ error: 'Formato de imagen inválido.' }, { status: 400, headers: corsHeaders() });
      }
      if (imagen.length * 0.75 > 900 * 1024) {
        return Response.json({ error: 'Imagen demasiado pesada.' }, { status: 400, headers: corsHeaders() });
      }
      imagenData = imagen;
    }

    const fecha = new Date().toISOString();
    // cargo = le deben (saldo +), pago = le pagan / él paga (saldo -)
    const delta = tipo === 'cargo' ? montoNum : -montoNum;

    await db.batch([
      db.prepare(
        'INSERT INTO movimientos_perfil (perfil_id, tipo, monto, asunto, descripcion, imagen, fecha) VALUES (?,?,?,?,?,?,?)'
      ).bind(pid, tipo, montoNum, String(asunto).trim(), descripcion ? String(descripcion).trim() : null, imagenData, fecha),
      db.prepare('UPDATE perfiles SET saldo = saldo + ? WHERE id = ?').bind(delta, pid),
    ]);

    const perfil = await db.prepare('SELECT saldo FROM perfiles WHERE id = ?').bind(pid).first();
    return Response.json({ ok: true, nuevoSaldo: perfil?.saldo ?? 0 }, { headers: corsHeaders() });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
