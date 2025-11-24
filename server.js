const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

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

// Funkcja do wysyłania emaila - POPRAWIONA
async function sendOrderEmail(orderDetails) {
    try {
        console.log('📧 Próba wysłania emaila z zamówieniem...');
        
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        await transporter.verify();
        console.log('✅ Połączenie z serwerem SMTP OK');

        const mailOptions = {
            from: `"Sklep Kurwiel" <${process.env.EMAIL_USER}>`,
            to: 'kurwiellq@gmail.com',
            subject: `🚀 NOWE ZAMÓWIENIE - ${orderDetails.user.first_name} ${orderDetails.user.last_name}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #667eea; text-align: center;">🚀 NOWE ZAMÓWIENIE!</h1>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h2 style="color: #2d3748;">📋 Dane klienta:</h2>
                        <p><strong>👤 Imię i nazwisko:</strong> ${orderDetails.user.first_name} ${orderDetails.user.last_name}</p>
                        <p><strong>📧 Email:</strong> ${orderDetails.user.email}</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h2 style="color: #2d3748;">🛒 Szczegóły zamówienia:</h2>
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
                    
                    <div style="background: #48bb78; color: white; padding: 20px; border-radius: 10px; text-align: center;">
                        <h2 style="margin: 0;">💰 Łączna kwota: ${orderDetails.total}zł</h2>
                        <p style="margin: 10px 0 0 0;">📅 Data zamówienia: ${new Date().toLocaleString('pl-PL')}</p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email z zamówieniem został wysłany:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Błąd przy wysyłaniu emaila:', error);
        return false;
    }
}

// Routes

// Rejestracja użytkownika
app.post('/api/auth/register', async (req, res) => {
    try {
        const { first_name, last_name, email, password, newsletter } = req.body;

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

        if (!email || !password) {
            return res.status(400).json({ message: 'Email i hasło są wymagane' });
        }

        const [users] = await pool.execute(
            'SELECT * FROM users WHERE email = ?', [email.toLowerCase()]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: 'Nieprawidłowy email lub hasło' });
        }

        const user = users[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
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

// Składanie zamówienia - POPRAWIONE
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
            console.log('🎉 Zamówienie zakończone sukcesem');
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Serwer uruchomiony na porcie ${PORT}`);
    await testConnection();
});

module.exports = app;
