const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Jeremie@167',
    database: process.env.DB_NAME || 'buildit',
    waitForConnections: true,
    connectionLimit: 10
});
    
module.exports = db;