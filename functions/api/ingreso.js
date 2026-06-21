/**
 * functions/api/ingreso.js — Worker de Cloudflare Pages
 * Ruta: POST /api/ingreso
 *
 * Registra una nueva nota académica y suma el monto
 * correspondiente al saldo total adeudado.
 *
 * Body esperado (JSON):
 *   { materia: string, nota: 8|9|10, imagen: string|null }
 *
 * "imagen" es un string en formato data URL base64
 * (ej: "data:image/jpeg;base64,/9j/4AAQ...") generado por el
 * frontend con FileReader. Se guarda tal cual en la columna
 * "imagen" de la tabla "movimientos".
 *
 * Respuesta exitosa:
 *   { ok: true, monto: number, nuevoSaldo: number }
 */

export async function onRequestPost(context) {
  try {
    const db = context.env.medebe_db;

    const body = await context.request.json();
    const { materia, nota, imagen } = body;

    // ── Validaciones ─────────────────────────────────────────────────────
    if (!materia || !String(materia).trim()) {
      return Response.json(
        { error: 'La materia es obligatoria.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const notaNum = parseInt(nota, 10);
    if (![8, 9, 10].includes(notaNum)) {
      return Response.json(
        { error: 'La nota debe ser 8, 9 o 10.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Validación básica del formato de la imagen (si se envió)
    let imagenData = null;
    if (imagen) {
      if (typeof imagen !== 'string' || !imagen.startsWith('data:image/')) {
        return Response.json(
          { error: 'El formato de la imagen no es válido.' },
          { status: 400, headers: corsHeaders() }
        );
      }

      // D1 tiene un límite de ~1MB por valor de texto/blob.
      // Validamos el tamaño aproximado del base64 antes de insertar.
      const aproxBytes = imagen.length * 0.75; // base64 ≈ 4/3 del tamaño real
      if (aproxBytes > 900 * 1024) {
        return Response.json(
          { error: 'La imagen es demasiado pesada. Probá con una foto más liviana (máx. ~900KB).' },
          { status: 400, headers: corsHeaders() }
        );
      }

      imagenData = imagen;
    }

    // ── Cálculo automático del monto según escala de recompensas ──────────
    // Nota 10 → $10.000 ARS | Nota 8 o 9 → $2.500 ARS
    const monto = notaNum === 10 ? 10000 : 2500;
    const fecha = new Date().toISOString();

    // ── Escritura atómica en D1 ─────────────────────────────────────────────
    // Insertamos el movimiento y actualizamos el saldo en una sola transacción
    await db.batch([
      db.prepare(
        `INSERT INTO movimientos (tipo, monto, materia, nota, imagen, fecha)
         VALUES ('ingreso', ?, ?, ?, ?, ?)`
      ).bind(monto, String(materia).trim(), notaNum, imagenData, fecha),

      db.prepare(
        `UPDATE saldo SET total = total + ? WHERE id = 1`
      ).bind(monto),
    ]);

    // Leemos el saldo actualizado para devolverlo al frontend
    const row = await db.prepare('SELECT total FROM saldo WHERE id = 1').first();

    return Response.json(
      { ok: true, monto, nuevoSaldo: row?.total ?? 0 },
      { headers: corsHeaders() }
    );

  } catch (err) {
    return Response.json(
      { error: 'Error al registrar el ingreso: ' + err.message },
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
