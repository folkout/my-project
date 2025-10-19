const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config({ path: './my-config.env' });

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,  // 最大接続数
    queueLimit: 0         // クエリの待機数無制限
});

// プールを使ってクエリを実行できるようにする
module.exports = db.promise();
