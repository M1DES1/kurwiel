// Skrypt dla panelu administratora
const API_BASE_URL = 'https://kurwiel.onrender.com/api';

let currentUsers = [];

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Inicjalizacja panelu administratora');
    
    // Sprawdź uprawnienia i załaduj dane
    checkAdminAccess();
    
    // Inicjalizacja przycisków
    document.getElementById('refreshBtn').addEventListener('click', loadUsers);
    document.getElementById('refreshUsers').addEventListener('click', function(e) {
        e.preventDefault();
        loadUsers();
    });
    
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        logout();
    });
});

// Sprawdź czy użytkownik ma uprawnienia administratora
async function checkAdminAccess() {
    const token = localStorage.getItem('kurwiel-token');
    const user = localStorage.getItem('kurwiel-user');
    
    if (!token || !user) {
        alert('❌ Brak dostępu. Zaloguj się jako administrator.');
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const userData = JSON.parse(user);
        if (userData.role !== 'admin') {
            alert('❌ Brak uprawnień administratora.');
            window.location.href = 'index.html';
            return;
        }
        
        console.log('✅ Dostęp administratora potwierdzony');
        loadUsers();
        
        // Auto-odświeżanie co 30 sekund
        setInterval(loadUsers, 30000);
        
    } catch (error) {
        console.error('Błąd sprawdzania uprawnień:', error);
        alert('❌ Błąd weryfikacji uprawnień.');
        window.location.href = 'login.html';
    }
}

// Załaduj listę użytkowników
async function loadUsers() {
    const token = localStorage.getItem('kurwiel-token');
    
    try {
        showLoading('Ładowanie użytkowników...');
        
        const response = await fetch(`${API_BASE_URL}/admin/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 403) {
            throw new Error('Brak uprawnień administratora');
        }
        
        if (!response.ok) {
            throw new Error('Błąd ładowania danych');
        }
        
        const users = await response.json();
        currentUsers = users;
        
        updateStats(users);
        renderUsersTable(users);
        
        hideLoading();
        
    } catch (error) {
        hideLoading();
        console.error('❌ Błąd ładowania użytkowników:', error);
        alert('❌ ' + error.message);
        
        if (error.message.includes('Brak uprawnień')) {
            window.location.href = 'index.html';
        }
    }
}

// Aktualizuj statystyki
function updateStats(users) {
    const stats = {
        total: users.length,
        online: users.filter(u => u.is_online).length,
        admins: users.filter(u => u.role === 'admin').length,
        banned: users.filter(u => u.is_banned).length
    };
    
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${stats.total}</div>
            <div>Wszyscy użytkownicy</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" style="color: #48bb78;">${stats.online}</div>
            <div>Online</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" style="color: #805ad5;">${stats.admins}</div>
            <div>Administratorzy</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" style="color: #e53e3e;">${stats.banned}</div>
            <div>Zbanowani</div>
        </div>
    `;
}

// Renderuj tabelę użytkowników
function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Brak użytkowników</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.id}</td>
            <td>${user.first_name} ${user.last_name}</td>
            <td>${user.email}</td>
            <td><span class="role-${user.role}">${user.role}</span></td>
            <td><span class="banned-${user.is_banned}">${user.is_banned ? 'BAN' : 'AKTYWNY'}</span></td>
            <td><span class="status-${user.is_online ? 'online' : 'offline'}">${user.is_online ? '🟢 ONLINE' : '⚫ OFFLINE'}</span></td>
            <td>${new Date(user.created_at).toLocaleDateString('pl-PL')}</td>
            <td>
                ${user.role !== 'admin' ? `
                    ${user.is_banned ? 
                        `<button class="action-btn unban-btn" onclick="unbanUser(${user.id})">🎯 Odbanuj</button>` :
                        `<button class="action-btn ban-btn" onclick="banUser(${user.id})">🚫 Zbanuj</button>`
                    }
                    <button class="action-btn delete-btn" onclick="deleteUser(${user.id}, '${user.first_name} ${user.last_name}')">🗑️ Usuń</button>
                ` : '<span style="color: #a0aec0;">Brak akcji</span>'}
            </td>
        </tr>
    `).join('');
}

// Zbanuj użytkownika
async function banUser(userId) {
    if (!confirm('🚫 Czy na pewno chcesz zbanować tego użytkownika?')) {
        return;
    }
    
    const token = localStorage.getItem('kurwiel-token');
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/ban`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ banned: true })
        });
        
        if (response.ok) {
            alert('✅ Użytkownik został zbanowany');
            loadUsers();
        } else {
            throw new Error('Błąd podczas banowania');
        }
    } catch (error) {
        console.error('❌ Błąd banowania:', error);
        alert('❌ Błąd podczas banowania użytkownika');
    }
}

// Odbanuj użytkownika
async function unbanUser(userId) {
    if (!confirm('🎯 Czy na pewno chcesz odbanować tego użytkownika?')) {
        return;
    }
    
    const token = localStorage.getItem('kurwiel-token');
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/ban`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ banned: false })
        });
        
        if (response.ok) {
            alert('✅ Użytkownik został odbanowany');
            loadUsers();
        } else {
            throw new Error('Błąd podczas odbanowywania');
        }
    } catch (error) {
        console.error('❌ Błąd odbanowywania:', error);
        alert('❌ Błąd podczas odbanowywania użytkownika');
    }
}

// Usuń użytkownika
async function deleteUser(userId, userName) {
    if (!confirm(`🗑️ Czy na pewno chcesz USUNĄĆ użytkownika "${userName}"? Tej operacji NIE można cofnąć!`)) {
        return;
    }
    
    const token = localStorage.getItem('kurwiel-token');
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            alert('✅ Użytkownik został usunięty');
            loadUsers();
        } else {
            throw new Error('Błąd podczas usuwania');
        }
    } catch (error) {
        console.error('❌ Błąd usuwania:', error);
        alert('❌ Błąd podczas usuwania użytkownika');
    }
}

// Wyloguj
function logout() {
    localStorage.removeItem('kurwiel-token');
    localStorage.removeItem('kurwiel-user');
    window.location.href = 'index.html';
}

// Pokazywanie ładowania
function showLoading(message = 'Ładowanie...') {
    let overlay = document.querySelector('.loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
        `;
        
        const loader = document.createElement('div');
        loader.style.cssText = `
            background: #1a1f2e;
            padding: 2rem;
            border-radius: 15px;
            text-align: center;
            border: 1px solid #2d3748;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        `;
        
        const spinner = document.createElement('div');
        spinner.style.cssText = `
            width: 40px;
            height: 40px;
            border: 4px solid #2d3748;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        `;
        
        const text = document.createElement('p');
        text.textContent = message;
        text.style.color = '#e2e8f0';
        text.style.margin = '0';
        
        loader.appendChild(spinner);
        loader.appendChild(text);
        overlay.appendChild(loader);
        document.body.appendChild(overlay);
        
        // Dodaj animację
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
        overlay._styleElement = style;
    }
}

// Ukrywanie ładowania
function hideLoading() {
    const loaders = document.querySelectorAll('.loading-overlay');
    loaders.forEach(loader => {
        if (loader._styleElement) {
            loader._styleElement.remove();
        }
        loader.remove();
    });
}
