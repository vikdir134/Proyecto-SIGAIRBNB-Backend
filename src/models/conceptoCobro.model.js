const { getConnection, sql } = require('../config/db');

const listarConceptosCobro = async () => {
  const pool = await getConnection();

  const result = await pool.request().query(`
    SELECT
      concepto_cobro_id,
      codigo,
      nombre,
      descripcion,
      tipo_concepto,
      es_obligatorio,
      aplica_igv,
      monto_default,
      orden_impresion,
      activo,
      categoria,
      metodo_calculo,
      aplica_en,
      aplica_desde_dias,
      prorrateable,
      permite_pago_online,
      es_sistema,
      editable,
      created_at,
      updated_at
    FROM finance.ConceptoCobro
    WHERE deleted_at IS NULL
    ORDER BY orden_impresion ASC, nombre ASC;
  `);

  return result.recordset;
};

const obtenerConceptoCobroPorId = async (concepto_cobro_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('concepto_cobro_id', sql.Int, concepto_cobro_id)
    .query(`
      SELECT
        concepto_cobro_id,
        codigo,
        nombre,
        descripcion,
        tipo_concepto,
        es_obligatorio,
        aplica_igv,
        monto_default,
        orden_impresion,
        activo,
        categoria,
        metodo_calculo,
        aplica_en,
        aplica_desde_dias,
        prorrateable,
        permite_pago_online,
        es_sistema,
        editable,
        created_at,
        updated_at
      FROM finance.ConceptoCobro
      WHERE concepto_cobro_id = @concepto_cobro_id
        AND deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const obtenerConceptoCobroPorCodigo = async (codigo) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('codigo', sql.NVarChar(30), codigo)
    .query(`
      SELECT
        concepto_cobro_id,
        codigo
      FROM finance.ConceptoCobro
      WHERE codigo = @codigo
        AND deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const crearConceptoCobro = async (data) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('codigo', sql.NVarChar(30), data.codigo)
    .input('nombre', sql.NVarChar(100), data.nombre)
    .input('descripcion', sql.NVarChar(300), data.descripcion || null)
    .input('tipo_concepto', sql.NVarChar(20), data.tipo_concepto)
    .input('es_obligatorio', sql.Bit, data.es_obligatorio || false)
    .input('aplica_igv', sql.Bit, data.aplica_igv || false)
    .input('monto_default', sql.Decimal(12, 2), data.monto_default || 0)
    .input('orden_impresion', sql.Int, data.orden_impresion || 1)
    .input('categoria', sql.NVarChar(40), data.categoria)
    .input('metodo_calculo', sql.NVarChar(40), data.metodo_calculo)
    .input('aplica_en', sql.NVarChar(20), data.aplica_en)
    .input('aplica_desde_dias', sql.Int, data.aplica_desde_dias || 1)
    .input('prorrateable', sql.Bit, data.prorrateable || false)
    .input('permite_pago_online', sql.Bit, data.permite_pago_online || false)
    .query(`
      INSERT INTO finance.ConceptoCobro (
        codigo,
        nombre,
        descripcion,
        tipo_concepto,
        es_obligatorio,
        aplica_igv,
        monto_default,
        orden_impresion,
        activo,
        categoria,
        metodo_calculo,
        aplica_en,
        aplica_desde_dias,
        prorrateable,
        permite_pago_online,
        es_sistema,
        editable
      )
      OUTPUT INSERTED.*
      VALUES (
        @codigo,
        @nombre,
        @descripcion,
        @tipo_concepto,
        @es_obligatorio,
        @aplica_igv,
        @monto_default,
        @orden_impresion,
        1,
        @categoria,
        @metodo_calculo,
        @aplica_en,
        @aplica_desde_dias,
        @prorrateable,
        @permite_pago_online,
        0,
        1
      );
    `);

  return result.recordset[0];
};

const actualizarConceptoCobro = async (concepto_cobro_id, data) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('concepto_cobro_id', sql.Int, concepto_cobro_id)
    .input('nombre', sql.NVarChar(100), data.nombre)
    .input('descripcion', sql.NVarChar(300), data.descripcion || null)
    .input('tipo_concepto', sql.NVarChar(20), data.tipo_concepto)
    .input('es_obligatorio', sql.Bit, data.es_obligatorio || false)
    .input('aplica_igv', sql.Bit, data.aplica_igv || false)
    .input('monto_default', sql.Decimal(12, 2), data.monto_default || 0)
    .input('orden_impresion', sql.Int, data.orden_impresion || 1)
    .input('categoria', sql.NVarChar(40), data.categoria)
    .input('metodo_calculo', sql.NVarChar(40), data.metodo_calculo)
    .input('aplica_en', sql.NVarChar(20), data.aplica_en)
    .input('aplica_desde_dias', sql.Int, data.aplica_desde_dias || 1)
    .input('prorrateable', sql.Bit, data.prorrateable || false)
    .input('permite_pago_online', sql.Bit, data.permite_pago_online || false)
    .query(`
      UPDATE finance.ConceptoCobro
      SET
        nombre = @nombre,
        descripcion = @descripcion,
        tipo_concepto = @tipo_concepto,
        es_obligatorio = @es_obligatorio,
        aplica_igv = @aplica_igv,
        monto_default = @monto_default,
        orden_impresion = @orden_impresion,
        categoria = @categoria,
        metodo_calculo = @metodo_calculo,
        aplica_en = @aplica_en,
        aplica_desde_dias = @aplica_desde_dias,
        prorrateable = @prorrateable,
        permite_pago_online = @permite_pago_online,
        updated_at = SYSDATETIME()
      OUTPUT INSERTED.*
      WHERE concepto_cobro_id = @concepto_cobro_id
        AND deleted_at IS NULL
        AND editable = 1;
    `);

  return result.recordset[0];
};

const cambiarEstadoConceptoCobro = async (concepto_cobro_id, activo) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('concepto_cobro_id', sql.Int, concepto_cobro_id)
    .input('activo', sql.Bit, activo)
    .query(`
      UPDATE finance.ConceptoCobro
      SET
        activo = @activo,
        updated_at = SYSDATETIME()
      OUTPUT INSERTED.*
      WHERE concepto_cobro_id = @concepto_cobro_id
        AND deleted_at IS NULL
        AND editable = 1;
    `);

  return result.recordset[0];
};

module.exports = {
  listarConceptosCobro,
  obtenerConceptoCobroPorId,
  obtenerConceptoCobroPorCodigo,
  crearConceptoCobro,
  actualizarConceptoCobro,
  cambiarEstadoConceptoCobro
};