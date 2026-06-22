const { getConnection, sql } = require('../config/db');

const buscarEdificioPorCodigo = async (empresa_id, codigo) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('codigo', sql.NVarChar(30), codigo)
    .query(`
      SELECT 
        inmueble_id,
        empresa_id,
        codigo,
        nombre,
        tipo_inmueble,
        activo
      FROM catalog.Inmueble
      WHERE empresa_id = @empresa_id
        AND codigo = @codigo
        AND deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const registrarEdificio = async ({
  empresa_id,
  codigo,
  nombre,
  descripcion,
  direccion_linea1,
  direccion_linea2,
  numero,
  distrito,
  ciudad,
  provincia,
  departamento,
  codigo_postal,
  pais,
  area_m2,
  latitud,
  longitud
}) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('codigo', sql.NVarChar(30), codigo)
    .input('nombre', sql.NVarChar(150), nombre)
    .input('descripcion', sql.NVarChar(1000), descripcion || null)
    .input('direccion_linea1', sql.NVarChar(255), direccion_linea1)
    .input('direccion_linea2', sql.NVarChar(255), direccion_linea2 || null)
    .input('numero', sql.NVarChar(30), numero || null)
    .input('distrito', sql.NVarChar(100), distrito || null)
    .input('ciudad', sql.NVarChar(100), ciudad || null)
    .input('provincia', sql.NVarChar(100), provincia || null)
    .input('departamento', sql.NVarChar(100), departamento || null)
    .input('codigo_postal', sql.NVarChar(20), codigo_postal || null)
    .input('pais', sql.NVarChar(100), pais || 'Perú')
    .input('area_m2', sql.Decimal(10, 2), area_m2 || null)
    .input('latitud', sql.Decimal(9, 6), latitud || null)
    .input('longitud', sql.Decimal(9, 6), longitud || null)
    .query(`
      INSERT INTO catalog.Inmueble (
        empresa_id,
        edificio_id,
        codigo,
        tipo_inmueble,
        nombre,
        descripcion,
        direccion_linea1,
        direccion_linea2,
        numero,
        distrito,
        ciudad,
        provincia,
        departamento,
        codigo_postal,
        pais,
        planta,
        letra,
        area_m2,
        latitud,
        longitud,
        estado_operativo,
        es_publicable,
        activo
      )
      OUTPUT 
        INSERTED.inmueble_id,
        INSERTED.empresa_id,
        INSERTED.codigo,
        INSERTED.nombre,
        INSERTED.tipo_inmueble,
        INSERTED.direccion_linea1,
        INSERTED.numero,
        INSERTED.codigo_postal,
        INSERTED.ciudad,
        INSERTED.estado_operativo,
        INSERTED.created_at
      VALUES (
        @empresa_id,
        NULL,
        @codigo,
        'EDIFICIO',
        @nombre,
        @descripcion,
        @direccion_linea1,
        @direccion_linea2,
        @numero,
        @distrito,
        @ciudad,
        @provincia,
        @departamento,
        @codigo_postal,
        @pais,
        NULL,
        NULL,
        @area_m2,
        @latitud,
        @longitud,
        'DISPONIBLE',
        1,
        1
      );
    `);

  return result.recordset[0];
};

const listarEdificios = async (empresa_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .query(`
      SELECT
        inmueble_id,
        codigo,
        nombre,
        descripcion,
        direccion_linea1,
        direccion_linea2,
        numero,
        distrito,
        ciudad,
        provincia,
        departamento,
        codigo_postal,
        pais,
        area_m2,
        estado_operativo,
        activo,
        created_at
      FROM catalog.Inmueble
      WHERE empresa_id = @empresa_id
        AND tipo_inmueble = 'EDIFICIO'
        AND deleted_at IS NULL
      ORDER BY created_at DESC;
    `);

  return result.recordset;
};

const buscarEdificioPadrePorId = async (empresa_id, edificio_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('edificio_id', sql.Int, edificio_id)
    .query(`
      SELECT
        inmueble_id,
        empresa_id,
        codigo,
        nombre,
        tipo_inmueble,
        direccion_linea1,
        direccion_linea2,
        numero,
        distrito,
        ciudad,
        provincia,
        departamento,
        codigo_postal,
        pais,
        activo
      FROM catalog.Inmueble
      WHERE inmueble_id = @edificio_id
        AND empresa_id = @empresa_id
        AND tipo_inmueble = 'EDIFICIO'
        AND activo = 1
        AND deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const registrarPisoLocal = async ({
  empresa_id,
  edificio_id,
  codigo,
  tipo_inmueble,
  nombre,
  subtipo_unidad,
  descripcion,
  planta,
  letra,
  area_m2,
  num_habitaciones,
  num_banos,
  capacidad_personas,
  renta_base_mensual,
  moneda
}) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('edificio_id', sql.Int, edificio_id)
    .input('codigo', sql.NVarChar(30), codigo)
    .input('tipo_inmueble', sql.NVarChar(20), tipo_inmueble)
    .input('nombre', sql.NVarChar(150), nombre)
    .input('subtipo_unidad', sql.NVarChar(50), subtipo_unidad || null)
    .input('descripcion', sql.NVarChar(1000), descripcion || null)
    .input('planta', sql.NVarChar(20), planta)
    .input('letra', sql.NVarChar(20), letra)
    .input('area_m2', sql.Decimal(10, 2), area_m2 || null)
    .input('num_habitaciones', sql.Int, num_habitaciones || null)
    .input('num_banos', sql.Int, num_banos || null)
    .input('capacidad_personas', sql.Int, capacidad_personas || null)
    .input('renta_base_mensual', sql.Decimal(12, 2), renta_base_mensual || null)
    .input('moneda', sql.Char(3), moneda || 'PEN')
    .query(`
      INSERT INTO catalog.Inmueble (
        empresa_id,
        edificio_id,
        codigo,
        tipo_inmueble,
        nombre,
        subtipo_unidad,
        descripcion,

        direccion_linea1,
        direccion_linea2,
        numero,
        distrito,
        ciudad,
        provincia,
        departamento,
        codigo_postal,
        pais,

        planta,
        letra,
        area_m2,
        num_habitaciones,
        num_banos,
        capacidad_personas,
        renta_base_mensual,
        moneda,

        estado_operativo,
        es_publicable,
        activo
      )
      OUTPUT
        INSERTED.inmueble_id,
        INSERTED.edificio_id,
        INSERTED.codigo,
        INSERTED.tipo_inmueble,
        INSERTED.nombre,
        INSERTED.subtipo_unidad,
        INSERTED.planta,
        INSERTED.letra,
        INSERTED.area_m2,
        INSERTED.renta_base_mensual,
        INSERTED.moneda,
        INSERTED.estado_operativo,
        INSERTED.created_at
      SELECT
        @empresa_id,
        e.inmueble_id,
        @codigo,
        @tipo_inmueble,
        @nombre,
        @subtipo_unidad,
        @descripcion,

        e.direccion_linea1,
        e.direccion_linea2,
        e.numero,
        e.distrito,
        e.ciudad,
        e.provincia,
        e.departamento,
        e.codigo_postal,
        e.pais,

        @planta,
        @letra,
        @area_m2,
        @num_habitaciones,
        @num_banos,
        @capacidad_personas,
        @renta_base_mensual,
        @moneda,

        'DISPONIBLE',
        1,
        1
      FROM catalog.Inmueble e
      WHERE e.inmueble_id = @edificio_id
        AND e.empresa_id = @empresa_id
        AND e.tipo_inmueble = 'EDIFICIO'
        AND e.activo = 1
        AND e.deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const listarPisosLocalesPorEdificio = async (empresa_id, edificio_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('edificio_id', sql.Int, edificio_id)
    .query(`
      SELECT
        unidad.inmueble_id,
        unidad.edificio_id,
        edificio.codigo AS codigo_edificio,
        edificio.nombre AS nombre_edificio,

        unidad.codigo,
        unidad.tipo_inmueble,
        unidad.nombre,
        unidad.subtipo_unidad,
        unidad.descripcion,
        unidad.planta,
        unidad.letra,
        unidad.area_m2,
        unidad.num_habitaciones,
        unidad.num_banos,
        unidad.capacidad_personas,
        unidad.renta_base_mensual,
        unidad.moneda,
        unidad.estado_operativo,
        unidad.es_publicable,
        unidad.activo,
        unidad.created_at
      FROM catalog.Inmueble unidad
      INNER JOIN catalog.Inmueble edificio
        ON edificio.inmueble_id = unidad.edificio_id
      WHERE unidad.empresa_id = @empresa_id
        AND unidad.edificio_id = @edificio_id
        AND unidad.tipo_inmueble IN ('PISO', 'LOCAL')
        AND unidad.deleted_at IS NULL
        AND edificio.tipo_inmueble = 'EDIFICIO'
        AND edificio.deleted_at IS NULL
      ORDER BY 
        unidad.tipo_inmueble,
        unidad.planta,
        unidad.letra,
        unidad.created_at DESC;
    `);

  return result.recordset;
};

const buscarUnidadPorUbicacion = async (empresa_id, edificio_id, planta, letra) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('edificio_id', sql.Int, edificio_id)
    .input('planta', sql.NVarChar(20), planta)
    .input('letra', sql.NVarChar(20), letra)
    .query(`
      SELECT
        inmueble_id,
        edificio_id,
        codigo,
        tipo_inmueble,
        nombre,
        planta,
        letra,
        activo
      FROM catalog.Inmueble
      WHERE empresa_id = @empresa_id
        AND edificio_id = @edificio_id
        AND planta = @planta
        AND letra = @letra
        AND tipo_inmueble IN ('PISO', 'LOCAL')
        AND deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const buscarUnidadPorId = async (empresa_id, unidad_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('unidad_id', sql.Int, unidad_id)
    .query(`
      SELECT
        unidad.inmueble_id,
        unidad.empresa_id,
        unidad.edificio_id,

        edificio.codigo AS codigo_edificio,
        edificio.nombre AS nombre_edificio,

        unidad.codigo,
        unidad.tipo_inmueble,
        unidad.nombre,
        unidad.subtipo_unidad,
        unidad.descripcion,

        unidad.direccion_linea1,
        unidad.direccion_linea2,
        unidad.numero,
        unidad.distrito,
        unidad.ciudad,
        unidad.provincia,
        unidad.departamento,
        unidad.codigo_postal,
        unidad.pais,

        unidad.planta,
        unidad.letra,
        unidad.area_m2,
        unidad.num_habitaciones,
        unidad.num_banos,
        unidad.capacidad_personas,
        unidad.renta_base_mensual,
        unidad.moneda,

        unidad.latitud,
        unidad.longitud,
        unidad.estado_operativo,
        unidad.es_publicable,
        unidad.activo,
        unidad.created_at,
        unidad.updated_at
      FROM catalog.Inmueble unidad
      INNER JOIN catalog.Inmueble edificio
        ON edificio.inmueble_id = unidad.edificio_id
      WHERE unidad.inmueble_id = @unidad_id
        AND unidad.empresa_id = @empresa_id
        AND unidad.tipo_inmueble IN ('PISO', 'LOCAL')
        AND unidad.deleted_at IS NULL
        AND edificio.tipo_inmueble = 'EDIFICIO'
        AND edificio.deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const listarInmueblesMantenimiento = async (empresa_id) => {
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
        i.descripcion,

        i.direccion_linea1,
        i.direccion_linea2,
        i.numero,
        i.distrito,
        i.ciudad,
        i.provincia,
        i.departamento,
        i.codigo_postal,
        i.pais,

        i.planta,
        i.letra,
        i.area_m2,
        i.num_habitaciones,
        i.num_banos,
        i.capacidad_personas,
        i.renta_base_mensual,
        i.moneda,

        i.latitud,
        i.longitud,
        i.estado_operativo,
        i.es_publicable,
        i.activo,
        i.created_at,
        i.updated_at
      FROM catalog.Inmueble i
      LEFT JOIN catalog.Inmueble edificio
        ON edificio.inmueble_id = i.edificio_id
      WHERE i.empresa_id = @empresa_id
        AND i.deleted_at IS NULL
      ORDER BY 
        CASE 
          WHEN i.tipo_inmueble = 'EDIFICIO' THEN 1
          WHEN i.tipo_inmueble = 'PISO' THEN 2
          WHEN i.tipo_inmueble = 'LOCAL' THEN 3
          ELSE 4
        END,
        i.created_at DESC;
    `);

  return result.recordset;
};

const buscarInmuebleMantenimientoPorId = async (empresa_id, inmueble_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('inmueble_id', sql.Int, inmueble_id)
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
        i.descripcion,

        i.direccion_linea1,
        i.direccion_linea2,
        i.numero,
        i.distrito,
        i.ciudad,
        i.provincia,
        i.departamento,
        i.codigo_postal,
        i.pais,

        i.planta,
        i.letra,
        i.area_m2,
        i.num_habitaciones,
        i.num_banos,
        i.capacidad_personas,
        i.renta_base_mensual,
        i.moneda,

        i.latitud,
        i.longitud,
        i.estado_operativo,
        i.es_publicable,
        i.activo,
        i.created_at,
        i.updated_at
      FROM catalog.Inmueble i
      LEFT JOIN catalog.Inmueble edificio
        ON edificio.inmueble_id = i.edificio_id
      WHERE i.inmueble_id = @inmueble_id
        AND i.empresa_id = @empresa_id
        AND i.deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const contarUnidadesActivasPorEdificio = async (empresa_id, edificio_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('edificio_id', sql.Int, edificio_id)
    .query(`
      SELECT COUNT(*) AS total
      FROM catalog.Inmueble
      WHERE empresa_id = @empresa_id
        AND edificio_id = @edificio_id
        AND tipo_inmueble IN ('PISO', 'LOCAL')
        AND activo = 1
        AND deleted_at IS NULL;
    `);

  return result.recordset[0].total;
};

const darBajaLogicaInmueble = async (empresa_id, inmueble_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('inmueble_id', sql.Int, inmueble_id)
    .query(`
      UPDATE catalog.Inmueble
      SET
        activo = 0,
        es_publicable = 0,
        estado_operativo = 'INACTIVO',
        deleted_at = SYSDATETIME(),
        updated_at = SYSDATETIME()
      OUTPUT
        INSERTED.inmueble_id,
        INSERTED.codigo,
        INSERTED.tipo_inmueble,
        INSERTED.nombre,
        INSERTED.estado_operativo,
        INSERTED.es_publicable,
        INSERTED.activo,
        INSERTED.deleted_at,
        INSERTED.updated_at
      WHERE inmueble_id = @inmueble_id
        AND empresa_id = @empresa_id
        AND deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const actualizarInmuebleMantenimiento = async ({
  empresa_id,
  inmueble_id,
  nombre,
  descripcion,
  direccion_linea1,
  direccion_linea2,
  numero,
  distrito,
  ciudad,
  provincia,
  departamento,
  codigo_postal,
  pais,
  subtipo_unidad,
  planta,
  letra,
  area_m2,
  num_habitaciones,
  num_banos,
  capacidad_personas,
  renta_base_mensual,
  moneda,
  latitud,
  longitud,
  estado_operativo,
  es_publicable
}) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('inmueble_id', sql.Int, inmueble_id)

    .input('nombre', sql.NVarChar(150), nombre)
    .input('descripcion', sql.NVarChar(1000), descripcion || null)

    .input('direccion_linea1', sql.NVarChar(255), direccion_linea1 || null)
    .input('direccion_linea2', sql.NVarChar(255), direccion_linea2 || null)
    .input('numero', sql.NVarChar(30), numero || null)
    .input('distrito', sql.NVarChar(100), distrito || null)
    .input('ciudad', sql.NVarChar(100), ciudad || null)
    .input('provincia', sql.NVarChar(100), provincia || null)
    .input('departamento', sql.NVarChar(100), departamento || null)
    .input('codigo_postal', sql.NVarChar(20), codigo_postal || null)
    .input('pais', sql.NVarChar(100), pais || 'Perú')

    .input('subtipo_unidad', sql.NVarChar(50), subtipo_unidad || null)
    .input('planta', sql.NVarChar(20), planta || null)
    .input('letra', sql.NVarChar(20), letra || null)

    .input('area_m2', sql.Decimal(10, 2), area_m2)
    .input('num_habitaciones', sql.Int, num_habitaciones)
    .input('num_banos', sql.Int, num_banos)
    .input('capacidad_personas', sql.Int, capacidad_personas)
    .input('renta_base_mensual', sql.Decimal(12, 2), renta_base_mensual)
    .input('moneda', sql.Char(3), moneda || 'PEN')

    .input('latitud', sql.Decimal(9, 6), latitud)
    .input('longitud', sql.Decimal(9, 6), longitud)
    .input('estado_operativo', sql.NVarChar(20), estado_operativo)
    .input('es_publicable', sql.Bit, es_publicable)
    .query(`
      UPDATE catalog.Inmueble
      SET
        nombre = @nombre,
        descripcion = @descripcion,

        direccion_linea1 = CASE 
          WHEN tipo_inmueble = 'EDIFICIO' THEN @direccion_linea1
          ELSE direccion_linea1
        END,
        direccion_linea2 = CASE 
          WHEN tipo_inmueble = 'EDIFICIO' THEN @direccion_linea2
          ELSE direccion_linea2
        END,
        numero = CASE 
          WHEN tipo_inmueble = 'EDIFICIO' THEN @numero
          ELSE numero
        END,
        distrito = CASE 
          WHEN tipo_inmueble = 'EDIFICIO' THEN @distrito
          ELSE distrito
        END,
        ciudad = CASE 
          WHEN tipo_inmueble = 'EDIFICIO' THEN @ciudad
          ELSE ciudad
        END,
        provincia = CASE 
          WHEN tipo_inmueble = 'EDIFICIO' THEN @provincia
          ELSE provincia
        END,
        departamento = CASE 
          WHEN tipo_inmueble = 'EDIFICIO' THEN @departamento
          ELSE departamento
        END,
        codigo_postal = CASE 
          WHEN tipo_inmueble = 'EDIFICIO' THEN @codigo_postal
          ELSE codigo_postal
        END,
        pais = CASE 
          WHEN tipo_inmueble = 'EDIFICIO' THEN @pais
          ELSE pais
        END,

        subtipo_unidad = CASE 
          WHEN tipo_inmueble IN ('PISO', 'LOCAL') THEN @subtipo_unidad
          ELSE NULL
        END,
        planta = CASE 
          WHEN tipo_inmueble IN ('PISO', 'LOCAL') THEN @planta
          ELSE NULL
        END,
        letra = CASE 
          WHEN tipo_inmueble IN ('PISO', 'LOCAL') THEN @letra
          ELSE NULL
        END,

        area_m2 = @area_m2,
        num_habitaciones = CASE 
          WHEN tipo_inmueble IN ('PISO', 'LOCAL') THEN @num_habitaciones
          ELSE NULL
        END,
        num_banos = CASE 
          WHEN tipo_inmueble IN ('PISO', 'LOCAL') THEN @num_banos
          ELSE NULL
        END,
        capacidad_personas = CASE 
          WHEN tipo_inmueble IN ('PISO', 'LOCAL') THEN @capacidad_personas
          ELSE NULL
        END,
        renta_base_mensual = CASE 
          WHEN tipo_inmueble IN ('PISO', 'LOCAL') THEN @renta_base_mensual
          ELSE renta_base_mensual
        END,
        moneda = @moneda,

        latitud = CASE 
          WHEN tipo_inmueble = 'EDIFICIO' THEN @latitud
          ELSE latitud
        END,
        longitud = CASE 
          WHEN tipo_inmueble = 'EDIFICIO' THEN @longitud
          ELSE longitud
        END,

        estado_operativo = @estado_operativo,
        es_publicable = @es_publicable,
        updated_at = SYSDATETIME()
      OUTPUT
        INSERTED.inmueble_id,
        INSERTED.edificio_id,
        INSERTED.codigo,
        INSERTED.tipo_inmueble,
        INSERTED.nombre,
        INSERTED.subtipo_unidad,
        INSERTED.descripcion,
        INSERTED.direccion_linea1,
        INSERTED.numero,
        INSERTED.distrito,
        INSERTED.ciudad,
        INSERTED.codigo_postal,
        INSERTED.planta,
        INSERTED.letra,
        INSERTED.area_m2,
        INSERTED.num_habitaciones,
        INSERTED.num_banos,
        INSERTED.capacidad_personas,
        INSERTED.renta_base_mensual,
        INSERTED.moneda,
        INSERTED.latitud,
        INSERTED.longitud,
        INSERTED.estado_operativo,
        INSERTED.es_publicable,
        INSERTED.activo,
        INSERTED.updated_at
      WHERE inmueble_id = @inmueble_id
        AND empresa_id = @empresa_id
        AND deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const listarCatalogoCaracteristicas = async () => {
  const pool = await getConnection();

  const result = await pool.request()
    .query(`
      SELECT
        caracteristica_id,
        nombre,
        tipo_dato,
        descripcion,
        activo,
        created_at
      FROM catalog.Caracteristica
      WHERE activo = 1
      ORDER BY nombre ASC;
    `);

  return result.recordset;
};

const listarCaracteristicasPorInmueble = async (empresa_id, inmueble_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('inmueble_id', sql.Int, inmueble_id)
    .query(`
      SELECT
        ic.inmueble_caracteristica_id,
        ic.inmueble_id,
        c.caracteristica_id,
        c.nombre,
        c.tipo_dato,
        c.descripcion,
        ic.valor_texto,
        ic.valor_numero,
        ic.valor_boolean,
        ic.created_at
      FROM catalog.InmuebleCaracteristica ic
      INNER JOIN catalog.Caracteristica c
        ON c.caracteristica_id = ic.caracteristica_id
      INNER JOIN catalog.Inmueble i
        ON i.inmueble_id = ic.inmueble_id
      WHERE ic.inmueble_id = @inmueble_id
        AND i.empresa_id = @empresa_id
        AND i.deleted_at IS NULL
        AND c.activo = 1
      ORDER BY c.nombre ASC;
    `);

  return result.recordset;
};

const actualizarCaracteristicasInmueble = async (empresa_id, inmueble_id, caracteristicas) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const deleteRequest = new sql.Request(transaction);

    await deleteRequest
      .input('empresa_id', sql.Int, empresa_id)
      .input('inmueble_id', sql.Int, inmueble_id)
      .query(`
        DELETE ic
        FROM catalog.InmuebleCaracteristica ic
        INNER JOIN catalog.Inmueble i
          ON i.inmueble_id = ic.inmueble_id
        WHERE ic.inmueble_id = @inmueble_id
          AND i.empresa_id = @empresa_id
          AND i.deleted_at IS NULL;
      `);

    for (const item of caracteristicas) {
      const insertRequest = new sql.Request(transaction);

      await insertRequest
        .input('inmueble_id', sql.Int, inmueble_id)
        .input('caracteristica_id', sql.Int, item.caracteristica_id)
        .input('valor_texto', sql.NVarChar(200), item.valor_texto || null)
        .input('valor_numero', sql.Decimal(12, 2), item.valor_numero)
        .input('valor_boolean', sql.Bit, item.valor_boolean)
        .query(`
          INSERT INTO catalog.InmuebleCaracteristica (
            inmueble_id,
            caracteristica_id,
            valor_texto,
            valor_numero,
            valor_boolean
          )
          VALUES (
            @inmueble_id,
            @caracteristica_id,
            @valor_texto,
            @valor_numero,
            @valor_boolean
          );
        `);
    }

    await transaction.commit();

    return await listarCaracteristicasPorInmueble(empresa_id, inmueble_id);

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  buscarEdificioPorCodigo,
  registrarEdificio,
  listarEdificios,
  buscarEdificioPadrePorId,
  registrarPisoLocal,
  listarPisosLocalesPorEdificio,
  buscarUnidadPorUbicacion,
  buscarUnidadPorId,

  // HU05 - Mantenimiento de Datos
  listarInmueblesMantenimiento,
  buscarInmuebleMantenimientoPorId,
  contarUnidadesActivasPorEdificio,
  darBajaLogicaInmueble,
  actualizarInmuebleMantenimiento,
  listarCatalogoCaracteristicas,
  listarCaracteristicasPorInmueble,
  actualizarCaracteristicasInmueble
};