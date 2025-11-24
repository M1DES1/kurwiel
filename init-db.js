const mysql = require('mysql2/promise');
require('dotenv').config();

async function initializeDatabase() {
    const connectionConfig = {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: {
            rejectUnauthorized: false
        }
    };

    let connection;
    
    try {
        connection = await mysql.createConnection(connectionConfig);
        console.log('✅ Połączono z bazą danych');

        // Tworzenie tabeli users
        const createUsersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                newsletter BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        await connection.execute(createUsersTable);
        console.log('✅ Tabela users została utworzona/sprawdzona');

        // Sprawdź czy tabela ma dane
        const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
        console.log(`📊 Liczba użytkowników w bazie: ${users[0].count}`);

        console.log('🎉 Inicjalizacja bazy danych zakończona pomyślnie!');

    } catch (error) {
        console.error('❌ Błąd podczas inicjalizacji bazy danych:', error.message);
        console.error('Szczegóły błędu:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

initializeDatabase();
