// Skrypt dla stron logowania i rejestracji
const API_BASE_URL = 'https://kurwiel-backend.onrender.com/api';

document.addEventListener('DOMContentLoaded', function() {
    // Inicjalizacja dla strony logowania
    if (document.getElementById('loginForm')) {
        initLoginForm();
    }
    
    // Inicjalizacja dla strony rejestracji
    if (document.getElementById('registerForm')) {
        initRegisterForm();
    }
    
    // Inicjalizacja przycisków social
    initSocialButtons();
    
    // Sprawdź status połączenia z backendem
    checkBackendStatus();
});

// Sprawdź status backendu
async function checkBackendStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        
        if (data.status === 'OK') {
            console.log('✅ Backend jest dostępny');
        } else {
            console.warn('⚠️ Backend ma problemy:', data);
        }
    } catch (error) {
        console.error('❌ Backend nie jest dostępny:', error);
    }
}

// Inicjalizacja formularza logowania
function initLoginForm() {
    const loginForm = document.getElementById('loginForm');
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        if (email && password) {
            try {
                showLoading('Logowanie...');
                
                const response = await fetch(`${API_BASE_URL}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                });
                
                const data = await response.json();
                
                hideLoading();
                
                if (response.ok) {
                    // Zapisujemy token do localStorage
                    localStorage.setItem('kurwiel-token', data.token);
                    localStorage.setItem('kurwiel-user', JSON.stringify(data.user));
                    
                    showNotification('Logowanie udane! Przekierowujemy...', 'success');
                    
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1500);
                } else {
                    showNotification(data.message || 'Błąd logowania!', 'error');
                }
            } catch (error) {
                hideLoading();
                showNotification('Błąd połączenia z serwerem! Sprawdź swoje połączenie internetowe.', 'error');
                console.error('Login error:', error);
            }
        } else {
            showNotification('Proszę wypełnić wszystkie pola!', 'error');
        }
    });
    
    // Obsługa "Zapomniałem hasła"
    const forgotPassword = document.querySelector('.forgot-password');
    if (forgotPassword) {
        forgotPassword.addEventListener('click', function(e) {
            e.preventDefault();
            const email = prompt('Podaj swój email do resetu hasła:');
            if (email) {
                showNotification(`Link do resetu hasła został wysłany na: ${email}`, 'success');
            }
        });
    }
}

// Inicjalizacja formularza rejestracji
function initRegisterForm() {
    const registerForm = document.getElementById('registerForm');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
    // Sprawdzanie siły hasła
    if (passwordInput) {
        passwordInput.addEventListener('input', function(e) {
            checkPasswordStrength(e.target.value);
        });
    }
    
    // Sprawdzanie zgodności haseł
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', function() {
            checkPasswordMatch();
        });
    }
    
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const email = document.getElementById('email').value;
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const ageCheck = document.querySelector('input[name="age"]').checked;
        const termsCheck = document.querySelector('input[name="terms"]').checked;
        const newsletter = document.querySelector('input[name="newsletter"]').checked;
        
        // Walidacja
        let isValid = true;
        let errorMessage = '';
        
        if (!firstName || !lastName || !email || !password) {
            isValid = false;
            errorMessage = 'Proszę wypełnić wszystkie wymagane pola!';
        } else if (password !== confirmPassword) {
            isValid = false;
            errorMessage = 'Hasła nie są identyczne!';
        } else if (!ageCheck) {
            isValid = false;
            errorMessage = 'Musisz potwierdzić, że masz ukończone 18 lat!';
        } else if (!termsCheck) {
            isValid = false;
            errorMessage = 'Musisz zaakceptować regulamin!';
        } else if (password.length < 8) {
            isValid = false;
            errorMessage = 'Hasło musi mieć co najmniej 8 znaków!';
        }
        
        if (isValid) {
            try {
                showLoading('Rejestracja...');
                
                const response = await fetch(`${API_BASE_URL}/auth/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        first_name: firstName,
                        last_name: lastName,
                        email: email,
                        password: password,
                        newsletter: newsletter
                    })
                });
                
                const data = await response.json();
                
                hideLoading();
                
                if (response.ok) {
                    showNotification('Rejestracja udana! Witamy w Kurwiel!', 'success');
                    
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 1500);
                } else {
                    showNotification(data.message || 'Błąd rejestracji!', 'error');
                }
            } catch (error) {
                hideLoading();
                showNotification('Błąd połączenia z serwerem! Sprawdź swoje połączenie internetowe.', 'error');
                console.error('Registration error:', error);
            }
        } else {
            showNotification(errorMessage, 'error');
        }
    });
}

// Sprawdzanie siły hasła
function checkPasswordStrength(password) {
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');
    
    if (!strengthBar || !strengthText) return;
    
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    
    strengthBar.style.width = strength + '%';
    
    if (strength < 50) {
        strengthBar.style.background = '#e74c3c';
        strengthText.textContent = 'Siła hasła: słabe';
    } else if (strength < 75) {
        strengthBar.style.background = '#f39c12';
        strengthText.textContent = 'Siła hasła: średnie';
    } else {
        strengthBar.style.background = '#27ae60';
        strengthText.textContent = 'Siła hasła: mocne';
    }
}

// Sprawdzanie zgodności haseł
function checkPasswordMatch() {
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const confirmInput = document.getElementById('confirmPassword');
    
    if (confirmPassword && password !== confirmPassword) {
        confirmInput.style.borderColor = '#e74c3c';
    } else if (confirmPassword) {
        confirmInput.style.borderColor = '#27ae60';
    } else {
        confirmInput.style.borderColor = '#4a5568';
    }
}

// Inicjalizacja przycisków social
function initSocialButtons() {
    const googleButtons = document.querySelectorAll('.google-btn');
    const facebookButtons = document.querySelectorAll('.facebook-btn');
    
    googleButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            showLoading('Przekierowanie do Google...');
            setTimeout(() => {
                hideLoading();
                showNotification('Funkcjonalność logowania przez Google będzie dostępna wkrótce!', 'info');
            }, 1500);
        });
    });
    
    facebookButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            showLoading('Przekierowanie do Facebook...');
            setTimeout(() => {
                hideLoading();
                showNotification('Funkcjonalność logowania przez Facebook będzie dostępna wkrótce!', 'info');
            }, 1500);
        });
    });
}

// Pokazywanie powiadomień
function showNotification(message, type = 'info') {
    const existingNotifications = document.querySelectorAll('.custom-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `custom-notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 2rem;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        max-width: 400px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    `;
    
    const colors = {
        success: 'linear-gradient(135deg, #48bb78, #38a169)',
        error: 'linear-gradient(135deg, #e53e3e, #c53030)',
        info: 'linear-gradient(135deg, #667eea, #764ba2)',
        warning: 'linear-gradient(135deg, #ed8936, #dd6b20)'
    };
    
    notification.style.background = colors[type] || colors.info;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// Pokazywanie ładowania
function showLoading(message = 'Ładowanie...') {
    const existingLoaders = document.querySelectorAll('.loading-overlay');
    existingLoaders.forEach(loader => loader.remove());
    
    const overlay = document.createElement('div');
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
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    loader.appendChild(spinner);
    loader.appendChild(text);
    overlay.appendChild(loader);
    document.body.appendChild(overlay);
    
    overlay._styleElement = style;
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

// Sprawdzamy czy użytkownik jest już zalogowany
function checkUserAuth() {
    const token = localStorage.getItem('kurwiel-token');
    if (token) {
        // Możemy zaktualizować UI - np. zmienić przyciski logowania na profil
        console.log('Użytkownik jest zalogowany');
        
        // Aktualizuj nawigację jeśli użytkownik jest zalogowany
        updateNavigationForLoggedInUser();
    }
}

// Aktualizacja nawigacji dla zalogowanego użytkownika
function updateNavigationForLoggedInUser() {
    const userData = localStorage.getItem('kurwiel-user');
    if (userData) {
        try {
            const user = JSON.parse(userData);
            const nav = document.querySelector('nav ul');
            
            if (nav) {
                // Znajdź przyciski logowania/rejestracji
                const loginBtn = nav.querySelector('.login-btn');
                const registerBtn = nav.querySelector('.register-btn');
                
                if (loginBtn && registerBtn) {
                    // Zamień na przycisk profilu
                    loginBtn.innerHTML = `👋 ${user.first_name}`;
                    loginBtn.href = '#profile';
                    loginBtn.classList.remove('login-btn');
                    loginBtn.classList.add('profile-btn');
                    
                    // Dodaj przycisk wylogowania
                    const logoutBtn = document.createElement('li');
                    logoutBtn.innerHTML = `<a href="#" class="logout-btn">Wyloguj</a>`;
                    nav.appendChild(logoutBtn);
                    
                    // Usuń przycisk rejestracji
                    registerBtn.parentElement.remove();
                    
                    // Obsługa wylogowania
                    logoutBtn.querySelector('.logout-btn').addEventListener('click', function(e) {
                        e.preventDefault();
                        localStorage.removeItem('kurwiel-token');
                        localStorage.removeItem('kurwiel-user');
                        window.location.reload();
                    });
                }
            }
        } catch (error) {
            console.error('Błąd podczas aktualizacji nawigacji:', error);
        }
    }
}

// Sprawdź autoryzację przy załadowaniu strony
checkUserAuth();
