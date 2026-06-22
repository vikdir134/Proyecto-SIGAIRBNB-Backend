const { getConnection, sql } = require('../config/db');

const columnasNecesarias = [
  `
  IF COL_LENGTH('finance.ConceptoCobro', 'categoria') IS NULL
  BEGIN
      ALTER TABLE finance.ConceptoCobro
      ADD categoria NVARCHAR(40) NOT NULL
          CONSTRAINT DF_ConceptoCobro_Categoria DEFAULT 'OTRO';
  END
  `,

  `
  IF COL_LENGTH('finance.ConceptoCobro', 'metodo_calculo') IS NULL
  BEGIN
      ALTER TABLE finance.ConceptoCobro
      ADD metodo_calculo NVARCHAR(40) NOT NULL
          CONSTRAINT DF_ConceptoCobro_MetodoCalculo DEFAULT 'MANUAL';
  END
  `,

  `
  IF COL_LENGTH('finance.ConceptoCobro', 'aplica_en') IS NULL
  BEGIN
      ALTER TABLE finance.ConceptoCobro
      ADD aplica_en NVARCHAR(20) NOT NULL
          CONSTRAINT DF_ConceptoCobro_AplicaEn DEFAULT 'AMBOS';
  END
  `,

  `
  IF COL_LENGTH('finance.ConceptoCobro', 'aplica_desde_dias') IS NULL
  BEGIN
      ALTER TABLE finance.ConceptoCobro
      ADD aplica_desde_dias INT NOT NULL
          CONSTRAINT DF_ConceptoCobro_AplicaDesdeDias DEFAULT 1;
  END
  `,

  `
  IF COL_LENGTH('finance.ConceptoCobro', 'prorrateable') IS NULL
  BEGIN
      ALTER TABLE finance.ConceptoCobro
      ADD prorrateable BIT NOT NULL
          CONSTRAINT DF_ConceptoCobro_Prorrateable DEFAULT 0;
  END
  `,

  `
  IF COL_LENGTH('finance.ConceptoCobro', 'permite_pago_online') IS NULL
  BEGIN
      ALTER TABLE finance.ConceptoCobro
      ADD permite_pago_online BIT NOT NULL
          CONSTRAINT DF_ConceptoCobro_PermitePagoOnline DEFAULT 0;
  END
  `,

  `
  IF COL_LENGTH('finance.ConceptoCobro', 'es_sistema') IS NULL
  BEGIN
      ALTER TABLE finance.ConceptoCobro
      ADD es_sistema BIT NOT NULL
          CONSTRAINT DF_ConceptoCobro_EsSistema DEFAULT 0;
  END
  `,

  `
  IF COL_LENGTH('finance.ConceptoCobro', 'editable') IS NULL
  BEGIN
      ALTER TABLE finance.ConceptoCobro
      ADD editable BIT NOT NULL
          CONSTRAINT DF_ConceptoCobro_Editable DEFAULT 1;
  END
  `,

  `
  IF COL_LENGTH('finance.ConceptoCobro', 'updated_at') IS NULL
  BEGIN
      ALTER TABLE finance.ConceptoCobro
      ADD updated_at DATETIME2 NULL;
  END
  `,

  `
  IF COL_LENGTH('finance.ConceptoCobro', 'deleted_at') IS NULL
  BEGIN
      ALTER TABLE finance.ConceptoCobro
      ADD deleted_at DATETIME2 NULL;
  END
  `
];

const conceptosBase = [
  {
    codigo: 'RENTA_RESERVA',
    nombre: 'Renta de la reserva',
    descripcion: 'Concepto automático generado desde la renta pactada de la reserva.',
    tipo_concepto: 'FIJO',
    es_obligatorio: true,
    aplica_igv: true,
    monto_default: 0,
    orden_impresion: 1,
    activo: true,
    categoria: 'RENTA',
    metodo_calculo: 'RENTA_RESERVA',
    aplica_en: 'AMBOS',
    aplica_desde_dias: 1,
    prorrateable: false,
    permite_pago_online: true,
    es_sistema: true,
    editable: false
  },
  {
    codigo: 'LIMPIEZA_FINAL',
    nombre: 'Limpieza final',
    descripcion: 'Cobro por limpieza al finalizar la reserva.',
    tipo_concepto: 'FIJO',
    es_obligatorio: false,
    aplica_igv: true,
    monto_default: 80,
    orden_impresion: 2,
    activo: true,
    categoria: 'LIMPIEZA',
    metodo_calculo: 'MONTO_FIJO',
    aplica_en: 'RESERVA',
    aplica_desde_dias: 1,
    prorrateable: false,
    permite_pago_online: false,
    es_sistema: false,
    editable: true
  },
  {
    codigo: 'MANT_MENSUAL',
    nombre: 'Mantenimiento mensual',
    descripcion: 'Cobro de mantenimiento aplicable a reservas mensuales o de larga duración.',
    tipo_concepto: 'FIJO',
    es_obligatorio: false,
    aplica_igv: true,
    monto_default: 120,
    orden_impresion: 3,
    activo: true,
    categoria: 'MANTENIMIENTO',
    metodo_calculo: 'POR_MES',
    aplica_en: 'MENSUAL',
    aplica_desde_dias: 30,
    prorrateable: true,
    permite_pago_online: false,
    es_sistema: false,
    editable: true
  },
  {
    codigo: 'AGUA',
    nombre: 'Agua',
    descripcion: 'Cobro variable por consumo de agua.',
    tipo_concepto: 'SERVICIO',
    es_obligatorio: false,
    aplica_igv: false,
    monto_default: 0,
    orden_impresion: 4,
    activo: true,
    categoria: 'SERVICIO',
    metodo_calculo: 'MANUAL',
    aplica_en: 'MENSUAL',
    aplica_desde_dias: 1,
    prorrateable: false,
    permite_pago_online: false,
    es_sistema: false,
    editable: true
  },
  {
    codigo: 'LUZ',
    nombre: 'Luz',
    descripcion: 'Cobro variable por consumo de energía eléctrica.',
    tipo_concepto: 'SERVICIO',
    es_obligatorio: false,
    aplica_igv: false,
    monto_default: 0,
    orden_impresion: 5,
    activo: true,
    categoria: 'SERVICIO',
    metodo_calculo: 'MANUAL',
    aplica_en: 'MENSUAL',
    aplica_desde_dias: 1,
    prorrateable: false,
    permite_pago_online: false,
    es_sistema: false,
    editable: true
  },
  {
    codigo: 'INTERNET',
    nombre: 'Internet',
    descripcion: 'Cobro por servicio de internet.',
    tipo_concepto: 'SERVICIO',
    es_obligatorio: false,
    aplica_igv: true,
    monto_default: 0,
    orden_impresion: 6,
    activo: true,
    categoria: 'SERVICIO',
    metodo_calculo: 'MANUAL',
    aplica_en: 'MENSUAL',
    aplica_desde_dias: 1,
    prorrateable: false,
    permite_pago_online: false,
    es_sistema: false,
    editable: true
  },
  {
    codigo: 'PENALIDAD_RETRASO',
    nombre: 'Penalidad por retraso',
    descripcion: 'Cobro adicional aplicado manualmente por retrasos o incumplimientos.',
    tipo_concepto: 'VARIABLE',
    es_obligatorio: false,
    aplica_igv: false,
    monto_default: 0,
    orden_impresion: 7,
    activo: true,
    categoria: 'PENALIDAD',
    metodo_calculo: 'MANUAL',
    aplica_en: 'AMBOS',
    aplica_desde_dias: 1,
    prorrateable: false,
    permite_pago_online: false,
    es_sistema: false,
    editable: true
  },
  {
    codigo: 'GARANTIA',
    nombre: 'Garantía',
    descripcion: 'Monto de garantía definido manualmente para una reserva o alquiler.',
    tipo_concepto: 'VARIABLE',
    es_obligatorio: false,
    aplica_igv: false,
    monto_default: 0,
    orden_impresion: 8,
    activo: true,
    categoria: 'GARANTIA',
    metodo_calculo: 'MANUAL',
    aplica_en: 'AMBOS',
    aplica_desde_dias: 1,
    prorrateable: false,
    permite_pago_online: false,
    es_sistema: false,
    editable: true
  },
  {
    codigo: 'AJUSTE_IPC',
    nombre: 'Ajuste IPC',
    descripcion: 'Ajuste aplicado según actualización del alquiler o variación acordada.',
    tipo_concepto: 'VARIABLE',
    es_obligatorio: false,
    aplica_igv: true,
    monto_default: 0,
    orden_impresion: 9,
    activo: true,
    categoria: 'AJUSTE',
    metodo_calculo: 'MANUAL',
    aplica_en: 'MENSUAL',
    aplica_desde_dias: 30,
    prorrateable: false,
    permite_pago_online: false,
    es_sistema: false,
    editable: true
  }
];

const verificarTabla = async (pool) => {
  await pool.request().query(`
    IF OBJECT_ID('finance.ConceptoCobro', 'U') IS NULL
    BEGIN
        THROW 50001, 'No existe la tabla finance.ConceptoCobro.', 1;
    END
  `);
};

const agregarColumnas = async (pool) => {
  for (const consulta of columnasNecesarias) {
    await pool.request().query(consulta);
  }
};

const upsertConcepto = async (pool, concepto) => {
  await pool.request()
    .input('codigo', sql.NVarChar(30), concepto.codigo)
    .input('nombre', sql.NVarChar(100), concepto.nombre)
    .input('descripcion', sql.NVarChar(300), concepto.descripcion)
    .input('tipo_concepto', sql.NVarChar(20), concepto.tipo_concepto)
    .input('es_obligatorio', sql.Bit, concepto.es_obligatorio)
    .input('aplica_igv', sql.Bit, concepto.aplica_igv)
    .input('monto_default', sql.Decimal(12, 2), concepto.monto_default)
    .input('orden_impresion', sql.Int, concepto.orden_impresion)
    .input('activo', sql.Bit, concepto.activo)
    .input('categoria', sql.NVarChar(40), concepto.categoria)
    .input('metodo_calculo', sql.NVarChar(40), concepto.metodo_calculo)
    .input('aplica_en', sql.NVarChar(20), concepto.aplica_en)
    .input('aplica_desde_dias', sql.Int, concepto.aplica_desde_dias)
    .input('prorrateable', sql.Bit, concepto.prorrateable)
    .input('permite_pago_online', sql.Bit, concepto.permite_pago_online)
    .input('es_sistema', sql.Bit, concepto.es_sistema)
    .input('editable', sql.Bit, concepto.editable)
    .query(`
      IF EXISTS (
          SELECT 1
          FROM finance.ConceptoCobro
          WHERE codigo = @codigo
      )
      BEGIN
          UPDATE finance.ConceptoCobro
          SET
              nombre = @nombre,
              descripcion = @descripcion,
              tipo_concepto = @tipo_concepto,
              es_obligatorio = @es_obligatorio,
              aplica_igv = @aplica_igv,
              monto_default = @monto_default,
              orden_impresion = @orden_impresion,
              activo = @activo,
              categoria = @categoria,
              metodo_calculo = @metodo_calculo,
              aplica_en = @aplica_en,
              aplica_desde_dias = @aplica_desde_dias,
              prorrateable = @prorrateable,
              permite_pago_online = @permite_pago_online,
              es_sistema = @es_sistema,
              editable = @editable,
              updated_at = SYSDATETIME(),
              deleted_at = NULL
          WHERE codigo = @codigo;
      END
      ELSE
      BEGIN
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
          VALUES (
              @codigo,
              @nombre,
              @descripcion,
              @tipo_concepto,
              @es_obligatorio,
              @aplica_igv,
              @monto_default,
              @orden_impresion,
              @activo,
              @categoria,
              @metodo_calculo,
              @aplica_en,
              @aplica_desde_dias,
              @prorrateable,
              @permite_pago_online,
              @es_sistema,
              @editable
          );
      END
    `);
};

const listarConceptos = async (pool) => {
  const result = await pool.request().query(`
    SELECT
        concepto_cobro_id,
        codigo,
        nombre,
        tipo_concepto,
        categoria,
        metodo_calculo,
        aplica_en,
        aplica_desde_dias,
        aplica_igv,
        monto_default,
        prorrateable,
        permite_pago_online,
        es_sistema,
        editable,
        activo
    FROM finance.ConceptoCobro
    WHERE deleted_at IS NULL
    ORDER BY orden_impresion;
  `);

  console.table(result.recordset);
};

const ejecutar = async () => {
  try {
    console.log('Conectando a SQL Server...');
    const pool = await getConnection();

    console.log('Verificando tabla finance.ConceptoCobro...');
    await verificarTabla(pool);

    console.log('Agregando columnas faltantes...');
    await agregarColumnas(pool);

    console.log('Insertando/actualizando conceptos base...');
    for (const concepto of conceptosBase) {
      await upsertConcepto(pool, concepto);
      console.log(`OK: ${concepto.codigo}`);
    }

    console.log('Conceptos registrados:');
    await listarConceptos(pool);

    console.log('HU17 - Script ejecutado correctamente.');
    process.exit(0);
  } catch (error) {
    console.error('Error ejecutando script HU17:', error.message);
    console.error(error);
    process.exit(1);
  }
};

ejecutar();