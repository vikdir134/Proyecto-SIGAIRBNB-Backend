const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: Number(process.env.DB_PORT),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
  }
};

let pool;

const getConnection = async () => {
  try {
    if (pool) {
      return pool;
    }

    console.log('Intentando conectar a SQL Server...');
    console.log('Servidor:', process.env.DB_SERVER);
    console.log('Puerto:', process.env.DB_PORT);
    console.log('Base de datos:', process.env.DB_DATABASE);

    pool = await sql.connect(dbConfig);

    console.log('Conexión exitosa a SQL Server');
    return pool;
  } catch (error) {
    console.error('Error al conectar con SQL Server:', error.message);
    throw error;
  }
};

module.exports = {
  sql,
  getConnection
};