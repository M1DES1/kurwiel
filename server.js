const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: [
        'https://kurwiel.work.gd',
        'http://kurwiel.work.gd',
        'http://localhost:3000',
        'http://localhost:8000',
        'https://kurwiel-backend.onrender.com'
    ],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(__dirname));

// Database connection pool
const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false
    },
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
};

console.log('🔗 Łączenie z bazą danych:', {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    database: process.env.DB_NAME
});

const pool = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Połączono z bazą danych MySQL na Aiven');
        
        // Test zapytania
        const [rows] = await connection.execute('SELECT 1 as test');
        console.log('✅ Test zapytania do bazy: OK');
        
        connection.release();
    } catch (error) {
        console.error('❌ Błąd połączenia z bazą danych:', error.message);
        console.error('Szczegóły błędu:', error);
    }
}

// Middleware do weryfikacji tokena JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Token dostępu wymagany' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Nieprawidłowy token' });
        }
        req.user = user;
        next();
    });
};

// Routes

// Rejestracja użytkownika
app.post('/api/auth/register', async (req, res) => {
    try {
        const { first_name, last_name, email, password, newsletter } = req.body;

        console.log('📝 Rejestracja użytkownika:', { email, first_name, last_name });

        // Walidacja
        if (!first_name || !last_name || !email || !password) {
            return res.status(400).json({ 
                message: 'Wszystkie pola są wymagane' 
            });
        }

        if (password.length < 8) {
            return res.status(400).json({ 
                message: 'Hasło musi mieć co najmniej 8 znaków' 
            });
        }

        // Sprawdź czy użytkownik już istnieje
        const [existingUsers] = await pool.execute(
            'SELECT id FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({ 
                message: 'Użytkownik z tym emailem już istnieje' 
            });
        }

        // Hashowanie hasła
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Tworzenie użytkownika
        const [result] = await pool.execute(
            `INSERT INTO users (first_name, last_name, email, password, newsletter, created_at) 
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [first_name, last_name, email.toLowerCase(), hashedPassword, newsletter || false]
        );

        console.log('✅ Użytkownik zarejestrowany:', result.insertId);

        res.status(201).json({
            message: 'Użytkownik został pomyślnie zarejestrowany',
            userId: result.insertId
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ 
            message: 'Wewnętrzny błąd serwera' 
        });
    }
});

// Logowanie użytkownika
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('🔐 Logowanie użytkownika:', email);

        if (!email || !password) {
            return res.status(400).json({ 
                message: 'Email i hasło są wymagane' 
            });
        }

        // Znajdź użytkownika
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        if (users.length === 0) {
            console.log('❌ Użytkownik nie znaleziony:', email);
            return res.status(401).json({ 
                message: 'Nieprawidłowy email lub hasło' 
            });
        }

        const user = users[0];

        // Sprawdź hasło
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.log('❌ Nieprawidłowe hasło dla:', email);
            return res.status(401).json({ 
                message: 'Nieprawidłowy email lub hasło' 
            });
        }

        // Generuj token JWT
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Zwróć dane użytkownika (bez hasła)
        const userResponse = {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            newsletter: user.newsletter,
            created_at: user.created_at
        };

        console.log('✅ Użytkownik zalogowany:', user.id);

        res.json({
            message: 'Logowanie udane',
            token: token,
            user: userResponse
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ 
            message: 'Wewnętrzny błąd serwera' 
        });
    }
});

// Pobierz profil użytkownika
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, first_name, last_name, email, newsletter, created_at FROM users WHERE id = ?',
            [req.user.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ 
                message: 'Użytkownik nie znaleziony' 
            });
        }

        res.json(users[0]);
    } catch (error) {
        console.error('❌ Profile error:', error);
        res.status(500).json({ 
            message: 'Wewnętrzny błąd serwera' 
        });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        await pool.execute('SELECT 1');
        res.json({ 
            status: 'OK', 
            database: 'Connected',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'Error', 
            database: 'Disconnected',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

// Obsługa błędów 404 dla API
app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        message: 'Endpoint nie znaleziony' 
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('❌ Global error handler:', error);
    res.status(500).json({ 
        message: 'Wewnętrzny błąd serwera' 
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Serwer uruchomiony na porcie ${PORT}`);
    console.log(`🌐 Środowisko: ${process.env.NODE_ENV}`);
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
    await testConnection();
});

module.exports = app;
