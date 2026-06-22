const sql = require('mssql');
const { getConnection } = require('../config/db');

const redondear2 = (numero) => {
  return Math.round((Number(numero) + Number.EPSILON) * 100) / 100;
};

const listarIPC = async () => {
  const pool = await getConnection();

  const result = await pool.request().query(`
    SELECT 
      indice_ipc_id,
      anio,
      porcentaje_anual,
      fecha_publicacion,
      activo,
      created_at
    FROM finance.IndiceIPC
    WHERE activo = 1
    ORDER BY anio DESC
  `);

  return result.recordset;
};

const buscarIPCPorAnio = async (anio) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('anio', sql.Int, anio)
    .query(`
      SELECT TOP 1
        indice_ipc_id,
        anio,
        porcentaje_anual,
        fecha_publicacion,
        activo,
        created_at
      FROM finance.IndiceIPC
      WHERE anio = @anio
        AND activo = 1
    `);

  return result.recordset[0] || null;
};

const registrarIPC = async ({ anio, porcentaje_anual, fecha_publicacion }) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('anio', sql.Int, anio)
    .input('porcentaje_anual', sql.Decimal(6, 3), porcentaje_anual)
    .input('fecha_publicacion', sql.Date, fecha_publicacion || null)
    .query(`
      INSERT INTO finance.IndiceIPC (
        anio,
        porcentaje_anual,
        fecha_publicacion
      )
      OUTPUT INSERTED.*
      VALUES (
        @anio,
        @porcentaje_anual,
        @fecha_publicacion
      )
    `);

  return result.recordset[0];
};

const listarInmueblesConRenta = async (empresa_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .query(`
      SELECT
        i.inmueble_id,
        i.empresa_id,
        i.codigo,
        i.tipo_inmueble,
        i.nombre,
        i.direccion_linea1,
        i.distrito,
        i.ciudad,
        i.renta_base_mensual,
        i.moneda,
        i.estado_operativo,
        i.activo,
        p.publicacion_id,
        p.titulo AS titulo_publicacion,
        p.precio_publicado_mensual,
        p.estado_publicacion
      FROM catalog.Inmueble i
      LEFT JOIN catalog.Publicacion p
        ON p.inmueble_id = i.inmueble_id
      WHERE i.empresa_id = @empresa_id
        AND i.activo = 1
        AND i.renta_base_mensual IS NOT NULL
      ORDER BY i.tipo_inmueble, i.nombre
    `);

  return result.recordset;
};

const obtenerInmueblePorId = async (empresa_id, inmueble_id, transaction = null) => {
  const request = transaction
    ? new sql.Request(transaction)
    : (await getConnection()).request();

  const result = await request
    .input('empresa_id', sql.Int, empresa_id)
    .input('inmueble_id', sql.Int, inmueble_id)
    .query(`
      SELECT TOP 1
        inmueble_id,
        empresa_id,
        codigo,
        tipo_inmueble,
        nombre,
        direccion_linea1,
        distrito,
        ciudad,
        renta_base_mensual,
        moneda,
        estado_operativo,
        activo
      FROM catalog.Inmueble
      WHERE empresa_id = @empresa_id
        AND inmueble_id = @inmueble_id
        AND activo = 1
    `);

  return result.recordset[0] || null;
};

const verificarAplicacionIPC = async (inmueble_id, indice_ipc_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('inmueble_id', sql.Int, inmueble_id)
    .input('indice_ipc_id', sql.Int, indice_ipc_id)
    .query(`
      SELECT TOP 1
        tarifa_inmueble_id,
        inmueble_id,
        indice_ipc_id,
        vigencia_desde,
        vigencia_hasta,
        renta_base_mensual,
        porcentaje_ipc_aplicado,
        monto_incremento,
        motivo,
        aplicado_por_usuario_id,
        created_at
      FROM finance.TarifaInmueble
      WHERE inmueble_id = @inmueble_id
        AND indice_ipc_id = @indice_ipc_id
    `);

  return result.recordset[0] || null;
};

const cerrarTarifaVigente = async (inmueble_id, fecha_cierre, transaction) => {
  const request = new sql.Request(transaction);

  await request
    .input('inmueble_id', sql.Int, inmueble_id)
    .input('fecha_cierre', sql.Date, fecha_cierre)
    .query(`
      UPDATE finance.TarifaInmueble
      SET vigencia_hasta = @fecha_cierre
      WHERE inmueble_id = @inmueble_id
        AND vigencia_hasta IS NULL
    `);
};

const crearTarifaInmueble = async ({
  inmueble_id,
  indice_ipc_id,
  vigencia_desde,
  renta_base_mensual,
  porcentaje_ipc_aplicado,
  monto_incremento,
  motivo,
  aplicado_por_usuario_id
}, transaction) => {
  const request = new sql.Request(transaction);

  const result = await request
    .input('inmueble_id', sql.Int, inmueble_id)
    .input('indice_ipc_id', sql.Int, indice_ipc_id)
    .input('vigencia_desde', sql.Date, vigencia_desde)
    .input('renta_base_mensual', sql.Decimal(12, 2), renta_base_mensual)
    .input('porcentaje_ipc_aplicado', sql.Decimal(6, 3), porcentaje_ipc_aplicado)
    .input('monto_incremento', sql.Decimal(12, 2), monto_incremento)
    .input('motivo', sql.NVarChar(300), motivo || null)
    .input('aplicado_por_usuario_id', sql.Int, aplicado_por_usuario_id || null)
    .query(`
      INSERT INTO finance.TarifaInmueble (
        inmueble_id,
        indice_ipc_id,
        vigencia_desde,
        vigencia_hasta,
        renta_base_mensual,
        porcentaje_ipc_aplicado,
        monto_incremento,
        motivo,
        aplicado_por_usuario_id
      )
      OUTPUT INSERTED.*
      VALUES (
        @inmueble_id,
        @indice_ipc_id,
        @vigencia_desde,
        NULL,
        @renta_base_mensual,
        @porcentaje_ipc_aplicado,
        @monto_incremento,
        @motivo,
        @aplicado_por_usuario_id
      )
    `);

  return result.recordset[0];
};

const actualizarRentaBaseInmueble = async (
  empresa_id,
  inmueble_id,
  nueva_renta,
  transaction
) => {
  const request = new sql.Request(transaction);

  await request
    .input('empresa_id', sql.Int, empresa_id)
    .input('inmueble_id', sql.Int, inmueble_id)
    .input('nueva_renta', sql.Decimal(12, 2), nueva_renta)
    .query(`
      UPDATE catalog.Inmueble
      SET renta_base_mensual = @nueva_renta,
          updated_at = SYSDATETIME()
      WHERE empresa_id = @empresa_id
        AND inmueble_id = @inmueble_id
    `);
};

const actualizarPrecioPublicacion = async (
  inmueble_id,
  nueva_renta,
  transaction
) => {
  const request = new sql.Request(transaction);

  await request
    .input('inmueble_id', sql.Int, inmueble_id)
    .input('nueva_renta', sql.Decimal(12, 2), nueva_renta)
    .query(`
      UPDATE catalog.Publicacion
      SET precio_publicado_mensual = @nueva_renta,
          updated_at = SYSDATETIME()
      WHERE inmueble_id = @inmueble_id
    `);
};

const aplicarIPCMasivo = async ({
  empresa_id,
  usuario_id,
  ipc,
  inmueble_ids,
  aplicar_a_publicacion,
  motivo
}) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const actualizados = [];
    const fechaAplicacion = new Date();

    for (const inmueble_id of inmueble_ids) {
      const inmueble = await obtenerInmueblePorId(
        empresa_id,
        inmueble_id,
        transaction
      );

      if (!inmueble) {
        throw new Error(`El inmueble ${inmueble_id} no existe o no pertenece a la empresa.`);
      }

      const rentaActual = Number(inmueble.renta_base_mensual || 0);

      if (rentaActual <= 0) {
        throw new Error(`El inmueble ${inmueble_id} no tiene una renta base mensual válida.`);
      }

      const porcentajeIPC = Number(ipc.porcentaje_anual);
      const montoIncremento = redondear2(rentaActual * (porcentajeIPC / 100));
      const nuevaRenta = redondear2(rentaActual + montoIncremento);

      await cerrarTarifaVigente(
        inmueble_id,
        fechaAplicacion,
        transaction
      );

      const motivoFinal = motivo
        ? `IPC ${ipc.anio} - ${motivo}`
        : `IPC ${ipc.anio} - Actualización anual de renta`;

      const tarifa = await crearTarifaInmueble(
        {
          inmueble_id,
          indice_ipc_id: ipc.indice_ipc_id,
          vigencia_desde: fechaAplicacion,
          renta_base_mensual: nuevaRenta,
          porcentaje_ipc_aplicado: porcentajeIPC,
          monto_incremento: montoIncremento,
          motivo: motivoFinal,
          aplicado_por_usuario_id: usuario_id
        },
        transaction
      );

      await actualizarRentaBaseInmueble(
        empresa_id,
        inmueble_id,
        nuevaRenta,
        transaction
      );

      if (aplicar_a_publicacion) {
        await actualizarPrecioPublicacion(
          inmueble_id,
          nuevaRenta,
          transaction
        );
      }

      actualizados.push({
        inmueble_id,
        nombre: inmueble.nombre,
        renta_anterior: rentaActual,
        porcentaje_ipc_aplicado: porcentajeIPC,
        monto_incremento: montoIncremento,
        nueva_renta: nuevaRenta,
        tarifa
      });
    }

    await transaction.commit();

    return actualizados;

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const listarHistorialTarifas = async (empresa_id, inmueble_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('inmueble_id', sql.Int, inmueble_id)
    .query(`
      SELECT
        t.tarifa_inmueble_id,
        t.inmueble_id,
        t.indice_ipc_id,
        ipc.anio,
        t.vigencia_desde,
        t.vigencia_hasta,
        t.renta_base_mensual,
        t.porcentaje_ipc_aplicado,
        t.monto_incremento,
        t.motivo,
        t.aplicado_por_usuario_id,
        pu.nombres AS aplicado_por_nombres,
        pu.apellidos AS aplicado_por_apellidos,
        t.created_at
      FROM finance.TarifaInmueble t
      INNER JOIN catalog.Inmueble i
        ON i.inmueble_id = t.inmueble_id
      LEFT JOIN finance.IndiceIPC ipc
        ON ipc.indice_ipc_id = t.indice_ipc_id
      LEFT JOIN core.PerfilUsuario pu
        ON pu.usuario_id = t.aplicado_por_usuario_id
      WHERE t.inmueble_id = @inmueble_id
        AND i.empresa_id = @empresa_id
      ORDER BY t.vigencia_desde DESC, t.tarifa_inmueble_id DESC
    `);

  return result.recordset;
};

module.exports = {
  listarIPC,
  buscarIPCPorAnio,
  registrarIPC,
  listarInmueblesConRenta,
  obtenerInmueblePorId,
  verificarAplicacionIPC,
  aplicarIPCMasivo,
  listarHistorialTarifas
};