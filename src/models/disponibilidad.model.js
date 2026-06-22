const { getConnection, sql } = require('../config/db');

const buscarInmueblePorEmpresa = async (empresa_id, inmueble_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('inmueble_id', sql.Int, inmueble_id)
    .query(`
      SELECT
        inmueble_id,
        empresa_id,
        edificio_id,
        codigo,
        tipo_inmueble,
        nombre,
        estado_operativo,
        activo
      FROM catalog.Inmueble
      WHERE inmueble_id = @inmueble_id
        AND empresa_id = @empresa_id
        AND activo = 1
        AND deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const listarBloqueosPorInmueble = async (empresa_id, inmueble_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('inmueble_id', sql.Int, inmueble_id)
    .query(`
      SELECT
        b.bloqueo_disponibilidad_id,
        b.bloqueo_padre_id,
        b.inmueble_id,
        i.codigo AS codigo_inmueble,
        i.nombre AS nombre_inmueble,
        i.tipo_inmueble,
        b.fecha_inicio,
        b.fecha_fin,
        b.motivo,
        b.origen,
        b.activo,
        b.created_at
      FROM catalog.BloqueoDisponibilidad b
      INNER JOIN catalog.Inmueble i
        ON i.inmueble_id = b.inmueble_id
      WHERE b.inmueble_id = @inmueble_id
        AND i.empresa_id = @empresa_id
        AND b.activo = 1
        AND i.activo = 1
        AND i.deleted_at IS NULL
      ORDER BY b.fecha_inicio ASC;
    `);

  return result.recordset;
};

const buscarBloqueosSolapados = async (empresa_id, inmueble_id, fecha_inicio, fecha_fin) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('inmueble_id', sql.Int, inmueble_id)
    .input('fecha_inicio', sql.Date, fecha_inicio)
    .input('fecha_fin', sql.Date, fecha_fin)
    .query(`
      SELECT
        b.bloqueo_disponibilidad_id,
        b.bloqueo_padre_id,
        b.inmueble_id,
        b.fecha_inicio,
        b.fecha_fin,
        b.motivo,
        b.origen,
        b.activo
      FROM catalog.BloqueoDisponibilidad b
      INNER JOIN catalog.Inmueble i
        ON i.inmueble_id = b.inmueble_id
      WHERE b.inmueble_id = @inmueble_id
        AND i.empresa_id = @empresa_id
        AND b.activo = 1
        AND i.activo = 1
        AND i.deleted_at IS NULL
        AND (
          @fecha_inicio <= b.fecha_fin
          AND @fecha_fin >= b.fecha_inicio
        );
    `);

  return result.recordset;
};

const registrarBloqueoDisponibilidad = async ({
  empresa_id,
  inmueble,
  fecha_inicio,
  fecha_fin,
  motivo,
  origen
}) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const requestPadre = new sql.Request(transaction);

    const resultPadre = await requestPadre
      .input('inmueble_id', sql.Int, inmueble.inmueble_id)
      .input('fecha_inicio', sql.Date, fecha_inicio)
      .input('fecha_fin', sql.Date, fecha_fin)
      .input('motivo', sql.NVarChar(300), motivo || null)
      .input('origen', sql.NVarChar(20), origen || 'MANUAL')
      .query(`
        INSERT INTO catalog.BloqueoDisponibilidad (
          inmueble_id,
          bloqueo_padre_id,
          fecha_inicio,
          fecha_fin,
          motivo,
          origen,
          activo
        )
        OUTPUT
          INSERTED.bloqueo_disponibilidad_id,
          INSERTED.bloqueo_padre_id,
          INSERTED.inmueble_id,
          INSERTED.fecha_inicio,
          INSERTED.fecha_fin,
          INSERTED.motivo,
          INSERTED.origen,
          INSERTED.activo,
          INSERTED.created_at
        VALUES (
          @inmueble_id,
          NULL,
          @fecha_inicio,
          @fecha_fin,
          @motivo,
          @origen,
          1
        );
      `);

    const bloqueoPadre = resultPadre.recordset[0];
    const bloqueosHijos = [];

    if (inmueble.tipo_inmueble === 'EDIFICIO') {
      const requestUnidades = new sql.Request(transaction);

      const unidadesResult = await requestUnidades
        .input('empresa_id', sql.Int, empresa_id)
        .input('edificio_id', sql.Int, inmueble.inmueble_id)
        .query(`
          SELECT
            inmueble_id,
            codigo,
            tipo_inmueble,
            nombre
          FROM catalog.Inmueble
          WHERE empresa_id = @empresa_id
            AND edificio_id = @edificio_id
            AND tipo_inmueble IN ('PISO', 'LOCAL')
            AND activo = 1
            AND deleted_at IS NULL;
        `);

      for (const unidad of unidadesResult.recordset) {
        const requestHijo = new sql.Request(transaction);

        const resultHijo = await requestHijo
          .input('inmueble_id', sql.Int, unidad.inmueble_id)
          .input('bloqueo_padre_id', sql.Int, bloqueoPadre.bloqueo_disponibilidad_id)
          .input('fecha_inicio', sql.Date, fecha_inicio)
          .input('fecha_fin', sql.Date, fecha_fin)
          .input('motivo', sql.NVarChar(300), motivo || null)
          .input('origen', sql.NVarChar(20), origen || 'MANUAL')
          .query(`
            INSERT INTO catalog.BloqueoDisponibilidad (
              inmueble_id,
              bloqueo_padre_id,
              fecha_inicio,
              fecha_fin,
              motivo,
              origen,
              activo
            )
            OUTPUT
              INSERTED.bloqueo_disponibilidad_id,
              INSERTED.bloqueo_padre_id,
              INSERTED.inmueble_id,
              INSERTED.fecha_inicio,
              INSERTED.fecha_fin,
              INSERTED.motivo,
              INSERTED.origen,
              INSERTED.activo,
              INSERTED.created_at
            VALUES (
              @inmueble_id,
              @bloqueo_padre_id,
              @fecha_inicio,
              @fecha_fin,
              @motivo,
              @origen,
              1
            );
          `);

        bloqueosHijos.push(resultHijo.recordset[0]);
      }
    }

    await transaction.commit();

    return {
      bloqueo_padre: bloqueoPadre,
      bloqueos_hijos: bloqueosHijos,
      total_bloqueos_generados: 1 + bloqueosHijos.length
    };

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const buscarBloqueoPorId = async (empresa_id, bloqueo_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('bloqueo_id', sql.Int, bloqueo_id)
    .query(`
      SELECT
        b.bloqueo_disponibilidad_id,
        b.inmueble_id,
        b.bloqueo_padre_id,
        i.codigo AS codigo_inmueble,
        i.nombre AS nombre_inmueble,
        i.tipo_inmueble,
        b.fecha_inicio,
        b.fecha_fin,
        b.motivo,
        b.origen,
        b.activo,
        b.created_at
      FROM catalog.BloqueoDisponibilidad b
      INNER JOIN catalog.Inmueble i
        ON i.inmueble_id = b.inmueble_id
      WHERE b.bloqueo_disponibilidad_id = @bloqueo_id
        AND i.empresa_id = @empresa_id
        AND b.activo = 1
        AND i.activo = 1
        AND i.deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const cancelarBloqueoDisponibilidad = async (empresa_id, bloqueo_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('bloqueo_id', sql.Int, bloqueo_id)
    .query(`
      UPDATE b
      SET b.activo = 0
      OUTPUT
        INSERTED.bloqueo_disponibilidad_id,
        INSERTED.bloqueo_padre_id,
        INSERTED.inmueble_id,
        INSERTED.fecha_inicio,
        INSERTED.fecha_fin,
        INSERTED.motivo,
        INSERTED.origen,
        INSERTED.activo,
        INSERTED.created_at
      FROM catalog.BloqueoDisponibilidad b
      INNER JOIN catalog.Inmueble i
        ON i.inmueble_id = b.inmueble_id
      WHERE i.empresa_id = @empresa_id
        AND b.activo = 1
        AND i.activo = 1
        AND i.deleted_at IS NULL
        AND (
          b.bloqueo_disponibilidad_id = @bloqueo_id
          OR b.bloqueo_padre_id = @bloqueo_id
        );
    `);

  return result.recordset;
};

const listarBloqueosPorRango = async (
  empresa_id,
  inmueble_id,
  fecha_inicio,
  fecha_fin
) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('inmueble_id', sql.Int, inmueble_id)
    .input('fecha_inicio', sql.Date, fecha_inicio)
    .input('fecha_fin', sql.Date, fecha_fin)
    .query(`
      SELECT
        b.bloqueo_disponibilidad_id,
        b.bloqueo_padre_id,
        b.inmueble_id,
        b.fecha_inicio,
        b.fecha_fin,
        b.motivo,
        b.origen,
        b.activo,
        b.created_at
      FROM catalog.BloqueoDisponibilidad b
      INNER JOIN catalog.Inmueble i
        ON i.inmueble_id = b.inmueble_id
      WHERE b.inmueble_id = @inmueble_id
        AND i.empresa_id = @empresa_id
        AND b.activo = 1
        AND i.activo = 1
        AND i.deleted_at IS NULL
        AND (
          @fecha_inicio <= b.fecha_fin
          AND @fecha_fin >= b.fecha_inicio
        )
      ORDER BY b.fecha_inicio ASC;
    `);

  return result.recordset;
};

const listarReservasPorRango = async (
  empresa_id,
  inmueble_id,
  fecha_inicio,
  fecha_fin
) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('inmueble_id', sql.Int, inmueble_id)
    .input('fecha_inicio', sql.Date, fecha_inicio)
    .input('fecha_fin', sql.Date, fecha_fin)
    .query(`
      SELECT
        r.reserva_id,
        r.inmueble_id,
        r.inquilino_id,
        r.estado_reserva,
        r.fecha_solicitud,
        r.fecha_inicio,
        r.fecha_fin,
        r.renta_pactada_mensual,
        r.monto_total_estimado,
        r.moneda,
        r.observacion_inquilino
      FROM booking.Reserva r
      INNER JOIN catalog.Inmueble i
        ON i.inmueble_id = r.inmueble_id
      WHERE r.inmueble_id = @inmueble_id
        AND i.empresa_id = @empresa_id
        AND i.activo = 1
        AND i.deleted_at IS NULL
        AND r.estado_reserva IN ('SOLICITADA', 'APROBADA', 'ACTIVA')
        AND (
          @fecha_inicio <= r.fecha_fin
          AND @fecha_fin >= r.fecha_inicio
        )
      ORDER BY r.fecha_inicio ASC;
    `);

  return result.recordset;
};

const buscarBloqueosSolapadosExcepto = async (
  empresa_id,
  inmueble_id,
  bloqueo_id,
  fecha_inicio,
  fecha_fin
) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('inmueble_id', sql.Int, inmueble_id)
    .input('bloqueo_id', sql.Int, bloqueo_id)
    .input('fecha_inicio', sql.Date, fecha_inicio)
    .input('fecha_fin', sql.Date, fecha_fin)
    .query(`
      SELECT
        b.bloqueo_disponibilidad_id,
        b.bloqueo_padre_id,
        b.inmueble_id,
        b.fecha_inicio,
        b.fecha_fin,
        b.motivo,
        b.origen,
        b.activo
      FROM catalog.BloqueoDisponibilidad b
      INNER JOIN catalog.Inmueble i
        ON i.inmueble_id = b.inmueble_id
      WHERE b.inmueble_id = @inmueble_id
        AND b.bloqueo_disponibilidad_id <> @bloqueo_id
        AND i.empresa_id = @empresa_id
        AND b.activo = 1
        AND i.activo = 1
        AND i.deleted_at IS NULL
        AND (
          @fecha_inicio <= b.fecha_fin
          AND @fecha_fin >= b.fecha_inicio
        );
    `);

  return result.recordset;
};

const actualizarBloqueoDisponibilidad = async ({
  empresa_id,
  bloqueo_id,
  fecha_inicio,
  fecha_fin,
  motivo,
  origen
}) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('bloqueo_id', sql.Int, bloqueo_id)
    .input('fecha_inicio', sql.Date, fecha_inicio)
    .input('fecha_fin', sql.Date, fecha_fin)
    .input('motivo', sql.NVarChar(300), motivo || null)
    .input('origen', sql.NVarChar(20), origen || 'MANUAL')
    .query(`
      UPDATE b
      SET
        b.fecha_inicio = @fecha_inicio,
        b.fecha_fin = @fecha_fin,
        b.motivo = @motivo,
        b.origen = @origen
      OUTPUT
        INSERTED.bloqueo_disponibilidad_id,
        INSERTED.inmueble_id,
        INSERTED.fecha_inicio,
        INSERTED.fecha_fin,
        INSERTED.motivo,
        INSERTED.origen,
        INSERTED.activo,
        INSERTED.created_at
      FROM catalog.BloqueoDisponibilidad b
      INNER JOIN catalog.Inmueble i
        ON i.inmueble_id = b.inmueble_id
      WHERE b.bloqueo_disponibilidad_id = @bloqueo_id
        AND i.empresa_id = @empresa_id
        AND b.activo = 1
        AND i.activo = 1
        AND i.deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const listarInmueblesParaDisponibilidad = async (empresa_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .query(`
      SELECT
        i.inmueble_id,
        i.empresa_id,
        i.edificio_id,

        edificio.codigo AS codigo_edificio,
        edificio.nombre AS nombre_edificio,

        i.codigo,
        i.tipo_inmueble,
        i.nombre,
        i.subtipo_unidad,

        i.direccion_linea1,
        i.numero,
        i.distrito,
        i.ciudad,
        i.provincia,
        i.departamento,

        i.planta,
        i.letra,

        i.estado_operativo,
        i.es_publicable,
        i.activo,
        i.created_at
      FROM catalog.Inmueble i
      LEFT JOIN catalog.Inmueble edificio
        ON edificio.inmueble_id = i.edificio_id
      WHERE i.empresa_id = @empresa_id
        AND i.activo = 1
        AND i.deleted_at IS NULL
        AND i.estado_operativo <> 'INACTIVO'
      ORDER BY
        CASE 
          WHEN i.tipo_inmueble = 'EDIFICIO' THEN 1
          WHEN i.tipo_inmueble = 'PISO' THEN 2
          WHEN i.tipo_inmueble = 'LOCAL' THEN 3
          ELSE 4
        END,
        i.nombre ASC;
    `);

  return result.recordset;
};

module.exports = {
  buscarInmueblePorEmpresa,
  listarBloqueosPorInmueble,
  buscarBloqueosSolapados,
  registrarBloqueoDisponibilidad,
  buscarBloqueoPorId,
  cancelarBloqueoDisponibilidad,
  listarBloqueosPorRango,
  listarReservasPorRango,
  buscarBloqueosSolapadosExcepto,
  actualizarBloqueoDisponibilidad,
  listarInmueblesParaDisponibilidad
};