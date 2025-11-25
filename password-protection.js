// System ochrony hasłem
function checkPassword() {
    // Sprawdź czy użytkownik już wpisał poprawne hasło
    const passwordEntered = sessionStorage.getItem('kurwiel-access-granted');
    
    if (!passwordEntered) {
        // Pokaż modal z hasłem
        showPasswordModal();
    }
}

function showPasswordModal() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.95);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-family: Arial, sans-serif;
    `;

    modal.innerHTML = `
        <div style="
            background: #1a1f2e;
            padding: 3rem;
            border-radius: 15px;
            border: 2px solid #667eea;
            text-align: center;
            max-width: 400px;
            width: 90%;
            color: white;
        ">
            <h2 style="color: #667eea; margin-bottom: 1rem;">🔒 Dostęp ograniczony</h2>
            <p style="margin-bottom: 2rem; color: #a0aec0;">
                Ta strona jest przeznaczona wyłącznie dla osób pełnoletnich.<br>
                Wprowadź hasło dostępu:
            </p>
            <input type="password" id="passwordInput" placeholder="Wprowadź hasło" style="
                width: 100%;
                padding: 1rem;
                margin-bottom: 1rem;
                background: #2d3748;
                border: 1px solid #4a5568;
                border-radius: 8px;
                color: white;
                font-size: 1.1rem;
                text-align: center;
            ">
            <button id="submitPassword" style="
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                border: none;
                padding: 1rem 2rem;
                border-radius: 8px;
                font-size: 1.1rem;
                cursor: pointer;
                width: 100%;
                font-weight: bold;
            ">Wejdź na stronę</button>
            <p id="passwordError" style="color: #e53e3e; margin-top: 1rem; display: none;">
                ❌ Nieprawidłowe hasło!
            </p>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const passwordInput = document.getElementById('passwordInput');
    const submitBtn = document.getElementById('submitPassword');
    const errorMsg = document.getElementById('passwordError');

    // Focus na input
    passwordInput.focus();

    // Obsługa kliknięcia przycisku
    submitBtn.addEventListener('click', function() {
        const password = passwordInput.value.trim();
        if (password === 'kurwielLQ2025') {
            // Poprawne hasło
            sessionStorage.setItem('kurwiel-access-granted', 'true');
            document.body.removeChild(modal);
            document.body.style.overflow = 'auto';
        } else {
            // Nieprawidłowe hasło
            errorMsg.style.display = 'block';
            passwordInput.value = '';
            passwordInput.focus();
        }
    });

    // Obsługa klawisza Enter
    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            submitBtn.click();
        }
    });
}

// Sprawdź hasło przy załadowaniu strony
document.addEventListener('DOMContentLoaded', function() {
    checkPassword();
});
