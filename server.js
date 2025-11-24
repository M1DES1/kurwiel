const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

// SendGrid zamiast nodemailer
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const app = express();

// MIDDLEWARE CORS
app.use(cors({
    origin: [
        'https://kurwiel.work.gd',
        'http://kurwiel.work.gd',
        'https://kurwiel.onrender.com',
        'http://kurwiel.onrender.com',
        'http://localhost:3000',
        'http://localhost:8000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.options('*', cors());
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(__dirname));

// Database connection
const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    connectionLimit: 10
};

console.log('🔗 Konfiguracja bazy danych:', {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    hasPassword: !!process.env.DB_PASSWORD
});

const pool = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Połączono z bazą danych MySQL na Aiven');
        
        const [rows] = await connection.execute('SELECT 1 as test');
        console.log('✅ Test zapytania do bazy: OK');
        
        connection.release();
    } catch (error) {
        console.error('❌ Błąd połączenia z bazą danych:', error.message);
    }
}

// Automatyczna inicjalizacja bazy przy starcie
async function initializeDatabaseOnStartup() {
    try {
        console.log('🔄 Sprawdzanie inicjalizacji bazy danych...');
        
        const [tables] = await pool.execute(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
        `, [process.env.DB_NAME]);
        
        if (tables.length === 0) {
            console.log('📦 Tabela users nie istnieje, tworzenie...');
            
            const createUsersTable = `
                CREATE TABLE users (
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
            
            await pool.execute(createUsersTable);
            console.log('✅ Tabela users została utworzona');
        } else {
            console.log('✅ Tabela users już istnieje');
            
            const [users] = await pool.execute('SELECT COUNT(*) as count FROM users');
            console.log(`📊 Liczba użytkowników w bazie: ${users[0].count}`);
        }
    } catch (error) {
        console.error('❌ Błąd podczas inicjalizacji bazy:', error);
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

// Funkcja do wysyłania emaila przez SendGrid - POPRAWIONA
async function sendOrderEmail(orderDetails) {
    try {
        console.log('📧 Próba wysłania emaila z zamówieniem przez SendGrid...');
        console.log('📦 Dane zamówienia:', {
            user: orderDetails.user,
            itemsCount: orderDetails.items.length,
            total: orderDetails.total
        });

        const msg = {
            to: 'kurwiellq@gmail.com',
            from: {
                email: 'noreply@kurwiel.work.gd',
                name: 'Sklep Kurwiel'
            },
            subject: `🚀 NOWE ZAMÓWIENIE - ${orderDetails.user.first_name} ${orderDetails.user.last_name}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; }
                        .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                        .section { background: #f8f9fa; padding: 20px; margin: 10px 0; border-radius: 8px; }
                        .item { border: 2px solid #667eea; padding: 15px; margin: 10px 0; border-radius: 8px; background: white; }
                        .total { background: #48bb78; color: white; padding: 20px; border-radius: 8px; text-align: center; }
                        .footer { text-align: center; margin-top: 20px; color: #718096; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>🚀 NOWE ZAMÓWIENIE!</h1>
                    </div>
                    
                    <div class="section">
                        <h2>📋 Dane klienta:</h2>
                        <p><strong>👤 Imię i nazwisko:</strong> ${orderDetails.user.first_name} ${orderDetails.user.last_name}</p>
                        <p><strong>📧 Email:</strong> ${orderDetails.user.email}</p>
                    </div>
                    
                    <div class="section">
                        <h2>🛒 Szczegóły zamówienia:</h2>
                        ${orderDetails.items.map(item => `
                            <div class="item">
                                <p><strong>🍯 Produkt:</strong> ${item.name}</p>
                                <p><strong>📏 Rozmiar:</strong> ${item.size}</p>
                                <p><strong>🔢 Ilość:</strong> ${item.quantity}</p>
                                <p><strong>💰 Cena za sztukę:</strong> ${item.price}zł</p>
                                <p style="font-weight: bold; color: #e53e3e;">💵 Razem: ${item.quantity * item.price}zł</p>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="total">
                        <h2>💰 Łączna kwota: ${orderDetails.total}zł</h2>
                        <p>📅 Data zamówienia: ${new Date().toLocaleString('pl-PL')}</p>
                    </div>
                    
                    <div class="footer">
                        <p>Wiadomość wygenerowana automatycznie ze sklepu Kurwiel</p>
                    </div>
                </body>
                </html>
            `
        };

        console.log('🔄 Wysyłanie emaila przez SendGrid...');
        const result = await sgMail.send(msg);
        console.log('✅ Email z zamówieniem został wysłany przez SendGrid');
        console.log('📨 SendGrid Response:', result[0].statusCode);
        return true;
    } catch (error) {
        console.error('❌ Błąd przy wysyłaniu emaila przez SendGrid:');
        console.error('SendGrid Error:', error.message);
        if (error.response) {
            console.error('SendGrid Response Body:', error.response.body);
        }
        return false;
    }
}

// Routes

// Rejestracja użytkownika
app.post('/api/auth/register', async (req, res) => {
    try {
        const { first_name, last_name, email, password, newsletter } = req.body;

        console.log('📝 Rejestracja użytkownika:', { email, first_name, last_name });

        if (!first_name || !last_name || !email || !password) {
            return res.status(400).json({ message: 'Wszystkie pola są wymagane' });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: 'Hasło musi mieć co najmniej 8 znaków' });
        }

        const [existingUsers] = await pool.execute(
            'SELECT id FROM users WHERE email = ?', [email.toLowerCase()]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'Użytkownik z tym emailem już istnieje' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
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
        res.status(500).json({ message: 'Wewnętrzny błąd serwera' });
    }
});

// Logowanie użytkownika
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('🔐 Logowanie użytkownika:', email);

        if (!email || !password) {
            return res.status(400).json({ message: 'Email i hasło są wymagane' });
        }

        const [users] = await pool.execute(
            'SELECT * FROM users WHERE email = ?', [email.toLowerCase()]
        );

        if (users.length === 0) {
            console.log('❌ Użytkownik nie znaleziony:', email);
            return res.status(401).json({ message: 'Nieprawidłowy email lub hasło' });
        }

        const user = users[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.log('❌ Nieprawidłowe hasło dla:', email);
            return res.status(401).json({ message: 'Nieprawidłowy email lub hasło' });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

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
        res.status(500).json({ message: 'Wewnętrzny błąd serwera' });
    }
});

// Składanie zamówienia
app.post('/api/orders/create', authenticateToken, async (req, res) => {
    try {
        const { items, total } = req.body;
        const userId = req.user.userId;

        console.log('🛒 Składanie zamówienia:', { userId, items, total });

        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'Koszyk jest pusty' });
        }

        const [users] = await pool.execute(
            'SELECT first_name, last_name, email FROM users WHERE id = ?', [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
        }

        const user = users[0];
        const orderDetails = { user, items, total };

        console.log('📦 Szczegóły zamówienia:', orderDetails);

        // Wyślij email
        const emailSent = await sendOrderEmail(orderDetails);

        if (emailSent) {
            console.log('🎉 Zamówienie zakończone sukcesem - email wysłany');
            res.json({
                message: 'Zamówienie zostało złożone! Email z potwierdzeniem został wysłany.',
                orderId: Date.now()
            });
        } else {
            console.log('⚠️ Zamówienie złożone, ale bez emaila');
            res.json({ 
                message: 'Zamówienie zostało złożone! Wkrótce skontaktujemy się w celu potwierdzenia.' 
            });
        }

    } catch (error) {
        console.error('❌ Order error:', error);
        res.status(500).json({ message: 'Wewnętrzny błąd serwera' });
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
            return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
        }

        res.json(users[0]);
    } catch (error) {
        console.error('❌ Profile error:', error);
        res.status(500).json({ message: 'Wewnętrzny błąd serwera' });
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
    res.status(404).json({ message: 'Endpoint nie znaleziony' });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('❌ Global error handler:', error);
    res.status(500).json({ message: 'Wewnętrzny błąd serwera' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Serwer uruchomiony na porcie ${PORT}`);
    console.log(`🌐 Środowisko: ${process.env.NODE_ENV}`);
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
    console.log(`📧 SendGrid API: ${process.env.SENDGRID_API_KEY ? 'Skonfigurowany' : 'Brak konfiguracji'}`);
    await testConnection();
    await initializeDatabaseOnStartup();
});

module.exports = app;
