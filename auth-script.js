// Skrypt dla stron logowania i rejestracji
const API_BASE_URL = 'https://kurwiel.onrender.com/api';

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Inicjalizacja auth-script.js');
    
    // Sprawdź status backendu
    checkBackendStatus();
    
    // Sprawdź czy użytkownik jest już zalogowany
    checkUserAuth();
    
    // Inicjalizacja dla strony logowania
    if (document.getElementById('loginForm')) {
        initLoginForm();
    }
    
    // Inicjalizacja dla strony rejestracji
    if (document.getElementById('registerForm')) {
        initRegisterForm();
    }
});

// Sprawdź status backendu
async function checkBackendStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        console.log('✅ Backend jest dostępny:', data);
        return true;
    } catch (error) {
        console.error('❌ Backend niedostępny:', error);
        return false;
    }
}

// Sprawdzamy czy użytkownik jest już zalogowany
function checkUserAuth() {
    const token = localStorage.getItem('kurwiel-token');
    const user = localStorage.getItem('kurwiel-user');
    
    if (token && user) {
        console.log('👤 Użytkownik już zalogowany:', JSON.parse(user));
        
        // Jeśli jest na stronie logowania/rejestracji, przekieruj na stronę główną
        if (window.location.pathname.includes('login.html') || 
            window.location.pathname.includes('register.html')) {
            console.log('🔄 Przekierowanie na stronę główną...');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        }
    }
}

// Inicjalizacja formularza logowania
function initLoginForm() {
    const loginForm = document.getElementById('loginForm');
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        console.log('🔐 Próba logowania użytkownika');
        
        const formData = new FormData(this);
        const loginData = {
            email: formData.get('email'),
            password: formData.get('password')
        };

        console.log('📦 Dane logowania:', { email: loginData.email });

        // Walidacja
        if (!loginData.email || !loginData.password) {
            alert('Email i hasło są wymagane!');
            return;
        }

        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        try {
            submitBtn.textContent = 'Logowanie...';
            submitBtn.disabled = true;

            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(loginData)
            });

            const data = await response.json();

            if (response.ok) {
                console.log('✅ Logowanie udane:', data);
                
                // Zapisz token i dane użytkownika
                localStorage.setItem('kurwiel-token', data.token);
                localStorage.setItem('kurwiel-user', JSON.stringify(data.user));
                
                alert('Logowanie zakończone sukcesem!');
                window.location.href = 'index.html';
            } else {
                console.error('❌ Błąd logowania:', data);
                alert(data.message || 'Błąd podczas logowania!');
            }
        } catch (error) {
            console.error('❌ Błąd połączenia:', error);
            alert('Błąd połączenia z serwerem! Spróbuj ponownie.');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Inicjalizacja formularza rejestracji
function initRegisterForm() {
    const registerForm = document.getElementById('registerForm');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
    // Sprawdzanie siły hasła
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            checkPasswordStrength(this.value);
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
        
        console.log('📝 Próba rejestracji użytkownika');
        
        const formData = new FormData(this);
        const userData = {
            first_name: formData.get('firstName'),
            last_name: formData.get('lastName'),
            email: formData.get('email'),
            password: formData.get('password'),
            newsletter: formData.get('newsletter') === 'on'
        };

        console.log('📦 Dane rejestracji:', userData);

        // Walidacja
        if (!userData.first_name || !userData.last_name || !userData.email || !userData.password) {
            alert('Wszystkie pola są wymagane!');
            return;
        }

        if (userData.password.length < 8) {
            alert('Hasło musi mieć co najmniej 8 znaków!');
            return;
        }

        if (formData.get('confirmPassword') !== userData.password) {
            alert('Hasła nie są identyczne!');
            return;
        }

        // Sprawdź checkbox wieku
        const ageCheckbox = document.querySelector('input[name="age"]');
        if (!ageCheckbox || !ageCheckbox.checked) {
            alert('Musisz potwierdzić, że masz ukończone 18 lat!');
            return;
        }

        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        try {
            submitBtn.textContent = 'Rejestracja...';
            submitBtn.disabled = true;

            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok) {
                console.log('✅ Rejestracja udana:', data);
                alert('Rejestracja zakończona sukcesem! Możesz się teraz zalogować.');
                window.location.href = 'login.html';
            } else {
                console.error('❌ Błąd rejestracji:', data);
                alert(data.message || 'Błąd podczas rejestracji!');
            }
        } catch (error) {
            console.error('❌ Błąd połączenia:', error);
            alert('Błąd połączenia z serwerem! Spróbuj ponownie.');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Sprawdzanie siły hasła
function checkPasswordStrength(password) {
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');
    
    if (!strengthBar || !strengthText) return;
    
    let strength = 0;
    let color = '#e53e3e';
    let text = 'słabe';
    
    if (password.length >= 8) strength += 25;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength += 25;
    if (password.match(/\d/)) strength += 25;
    if (password.match(/[^a-zA-Z\d]/)) strength += 25;
    
    if (strength >= 75) {
        color = '#48bb78';
        text = 'silne';
    } else if (strength >= 50) {
        color = '#ed8936';
        text = 'średnie';
    } else if (strength >= 25) {
        color = '#ecc94b';
        text = 'słabe';
    }
    
    strengthBar.style.width = strength + '%';
    strengthBar.style.background = color;
    strengthText.textContent = 'Siła hasła: ' + text;
    strengthText.style.color = color;
}

// Sprawdzanie zgodności haseł
function checkPasswordMatch() {
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const confirmInput = document.getElementById('confirmPassword');
    
    if (!confirmInput) return;
    
    if (confirmPassword && password !== confirmPassword) {
        confirmInput.style.borderColor = '#e74c3c';
    } else if (confirmPassword) {
        confirmInput.style.borderColor = '#27ae60';
    } else {
        confirmInput.style.borderColor = '#4a5568';
    }
}
