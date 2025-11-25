const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

// Resend - nowy provider email
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const app = express();

// MIDDLEWARE
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

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false
    },
    connectionLimit: 10
};

console.log('🔗 Konfiguracja bazy danych:', {
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
        console.log('✅ Połączono z bazą danych MySQL');
        connection.release();
    } catch (error) {
        console.error('❌ Błąd połączenia z bazą danych:', error.message);
    }
}

// Funkcja do tworzenia konta administratora
async function createAdminUser() {
    try {
        const hashedPassword = await bcrypt.hash('pracownikmaka2137', 12);
        
        await pool.execute(
            `INSERT INTO users (first_name, last_name, email, password, role, newsletter, created_at) 
             VALUES (?, ?, ?, ?, 'admin', FALSE, NOW())`,
            ['kurwisko', 'admin', 'kurwiellq@gmail.com', hashedPassword]
        );
        
        console.log('✅ Konto administratora utworzone: kurwiellq@gmail.com');
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            console.log('ℹ️ Konto administratora już istnieje');
        } else {
            console.error('❌ Błąd tworzenia konta administratora:', error);
        }
    }
}

// Automatyczna inicjalizacja bazy
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
                    role ENUM('user', 'admin') DEFAULT 'user',
                    is_banned BOOLEAN DEFAULT FALSE,
                    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    newsletter BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_email (email),
                    INDEX idx_role (role),
                    INDEX idx_banned (is_banned)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `;
            
            await pool.execute(createUsersTable);
            console.log('✅ Tabela users została utworzona');
            
            // Utwórz konto administratora
            await createAdminUser();
        } else {
            console.log('✅ Tabela users już istnieje');
            
            // Sprawdź czy kolumna role istnieje, jeśli nie - dodaj
            try {
                await pool.execute('SELECT role FROM users LIMIT 1');
            } catch (error) {
                console.log('🔄 Dodawanie kolumn administracyjnych do tabeli users...');
                await pool.execute('ALTER TABLE users ADD COLUMN role ENUM("user", "admin") DEFAULT "user"');
                await pool.execute('ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT FALSE');
                await pool.execute('ALTER TABLE users ADD COLUMN last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
                console.log('✅ Kolumny dodane pomyślnie');
                
                // Utwórz konto administratora
                await createAdminUser();
            }
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
            console.log('❌ Błąd weryfikacji tokena:', err.message);
            return res.status(403).json({ message: 'Nieprawidłowy token' });
        }
        req.user = user;
        next();
    });
};

// Middleware do sprawdzania uprawnień administratora
const requireAdmin = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        const [users] = await pool.execute('SELECT role, is_banned FROM users WHERE id = ?', [userId]);
        
        if (users.length === 0 || users[0].role !== 'admin' || users[0].is_banned) {
            return res.status(403).json({ message: 'Brak uprawnień administratora' });
        }
        
        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ message: 'Błąd serwera' });
    }
};

// Aktualizuj czas ostatniej aktywności użytkownika
const updateUserActivity = async (userId) => {
    try {
        await pool.execute(
            'UPDATE users SET last_active = NOW() WHERE id = ?',
            [userId]
        );
    } catch (error) {
        console.error('Error updating user activity:', error);
    }
};

// Funkcja do wysyłania emaila przez Resend
async function sendOrderEmail(orderDetails) {
    if (!process.env.RESEND_API_KEY) {
        console.log('⚠️ Brak Resend API Key - symulowanie wysłania emaila');
        return true;
    }

    try {
        console.log('📧 Wysyłanie emaila z zamówieniem przez Resend...');
        console.log('👤 Do: kurwiellq@gmail.com');
        console.log('📦 Zamówienie:', orderDetails.items.length + ' produktów');

        const { data, error } = await resend.emails.send({
            from: 'Sklep Kurwiel <onboarding@resend.dev>',
            to: ['kurwiellq@gmail.com'],
            subject: `🚀 NOWE ZAMÓWIENIE - ${orderDetails.user.first_name} ${orderDetails.user.last_name}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                    <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 24px;">🚀 NOWE ZAMÓWIENIE!</h1>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; margin: 10px 0; border-radius: 8px;">
                        <h2 style="color: #2d3748; margin-top: 0;">📋 Dane klienta:</h2>
                        <p><strong>👤 Imię i nazwisko:</strong> ${orderDetails.user.first_name} ${orderDetails.user.last_name}</p>
                        <p><strong>📧 Email:</strong> ${orderDetails.user.email}</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; margin: 10px 0; border-radius: 8px;">
                        <h2 style="color: #2d3748; margin-top: 0;">🛒 Szczegóły zamówienia:</h2>
                        ${orderDetails.items.map(item => `
                            <div style="border: 2px solid #667eea; padding: 15px; margin: 10px 0; border-radius: 8px; background: white;">
                                <p style="margin: 5px 0;"><strong>🍯 Produkt:</strong> ${item.name}</p>
                                <p style="margin: 5px 0;"><strong>📏 Rozmiar:</strong> ${item.size}</p>
                                <p style="margin: 5px 0;"><strong>🔢 Ilość:</strong> ${item.quantity}</p>
                                <p style="margin: 5px 0;"><strong>💰 Cena za sztukę:</strong> ${item.price}zł</p>
                                <p style="margin: 5px 0; font-weight: bold; color: #e53e3e;">💵 Razem: ${item.quantity * item.price}zł</p>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div style="background: #48bb78; color: white; padding: 20px; border-radius: 8px; text-align: center;">
                        <h2 style="margin: 0; font-size: 20px;">💰 Łączna kwota: ${orderDetails.total}zł</h2>
                        <p style="margin: 10px 0 0 0;">📅 Data zamówienia: ${new Date().toLocaleString('pl-PL')}</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px; color: #718096; font-size: 12px;">
                        <p>Wiadomość wygenerowana automatycznie ze sklepu Kurwiel</p>
                    </div>
                </div>
            `
        });

        if (error) {
            console.error('❌ Błąd Resend:', error);
            return false;
        }

        console.log('✅ Email wysłany pomyślnie przez Resend!');
        console.log('📨 ID wiadomości:', data.id);
        return true;

    } catch (error) {
        console.error('❌ Błąd przy wysyłaniu emaila:', error);
        return false;
    }
}

// Routes

// Rejestracja
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

// Logowanie
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
        
        // Sprawdź czy użytkownik jest zbanowany
        if (user.is_banned) {
            return res.status(403).json({ message: 'Twoje konto zostało zablokowane' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.log('❌ Nieprawidłowe hasło dla:', email);
            return res.status(401).json({ message: 'Nieprawidłowy email lub hasło' });
        }

        // Aktualizuj czas aktywności
        await updateUserActivity(user.id);

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
            role: user.role,
            newsletter: user.newsletter,
            created_at: user.created_at
        };

        console.log('✅ Użytkownik zalogowany:', user.id, 'Rola:', user.role);

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

        // Sprawdź czy użytkownik jest zbanowany
        const [userCheck] = await pool.execute('SELECT is_banned FROM users WHERE id = ?', [userId]);
        if (userCheck.length > 0 && userCheck[0].is_banned) {
            return res.status(403).json({ message: 'Twoje konto zostało zablokowane. Nie możesz składać zamówień.' });
        }

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
            'SELECT id, first_name, last_name, email, role, newsletter, created_at FROM users WHERE id = ?',
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

// Endpointy administracyjne

// Pobierz listę użytkowników (tylko admin)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [users] = await pool.execute(`
            SELECT 
                id, first_name, last_name, email, role, is_banned, 
                last_active, newsletter, created_at,
                CASE 
                    WHEN last_active >= NOW() - INTERVAL 5 MINUTE THEN true
                    ELSE false
                END as is_online
            FROM users 
            ORDER BY created_at DESC
        `);

        res.json(users);
    } catch (error) {
        console.error('❌ Admin users error:', error);
        res.status(500).json({ message: 'Błąd serwera' });
    }
});

// Zbanuj/odbanuj użytkownika
app.post('/api/admin/users/:userId/ban', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { banned } = req.body;

        await pool.execute(
            'UPDATE users SET is_banned = ? WHERE id = ?',
            [banned, userId]
        );

        res.json({ 
            message: banned ? 'Użytkownik zbanowany' : 'Użytkownik odbanowany',
            banned: banned
        });
    } catch (error) {
        console.error('❌ Ban user error:', error);
        res.status(500).json({ message: 'Błąd serwera' });
    }
});

// Usuń użytkownika
app.delete('/api/admin/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        await pool.execute('DELETE FROM users WHERE id = ?', [userId]);

        res.json({ 
            message: 'Użytkownik usunięty',
            deleted: true
        });
    } catch (error) {
        console.error('❌ Delete user error:', error);
        res.status(500).json({ message: 'Błąd serwera' });
    }
});

// Health check
app.get('/api/health', async (req, res) => {
    try {
        await pool.execute('SELECT 1');
        res.json({ 
            status: 'OK', 
            database: 'Connected',
            resend: process.env.RESEND_API_KEY ? 'Configured' : 'Not configured',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'Error', 
            database: 'Disconnected',
            error: error.message
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

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Serwer uruchomiony na porcie ${PORT}`);
    console.log(`🌐 Środowisko: ${process.env.NODE_ENV}`);
    console.log(`📧 Resend: ${process.env.RESEND_API_KEY ? 'OK' : 'BRAK API KEY'}`);
    console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? 'OK' : 'BRAK'}`);
    await testConnection();
    await initializeDatabaseOnStartup();
});

module.exports = app;
