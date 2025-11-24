// Koszyk
let cart = [];
let cartCount = document.getElementById('cart-count');
let cartModal = document.getElementById('cart-modal');
let cartItems = document.getElementById('cart-items');
let cartTotal = document.getElementById('cart-total');
let checkoutBtn = document.getElementById('checkout');

// Otwieranie/kontynuacja koszyka
document.querySelector('.cart-icon').addEventListener('click', function() {
    updateCartDisplay();
    cartModal.style.display = 'block';
});

// Zamykanie modala
document.querySelector('.close').addEventListener('click', function() {
    cartModal.style.display = 'none';
});

// Dodawanie do koszyka z wyborem rozmiaru
document.querySelectorAll('.add-to-cart').forEach(button => {
    button.addEventListener('click', function() {
        const product = this.getAttribute('data-product');
        const basePrice = parseInt(this.getAttribute('data-price'));
        
        // Tworzymy modal do wyboru rozmiaru
        const sizeModal = createSizeModal(product, basePrice);
        document.body.appendChild(sizeModal);
        sizeModal.style.display = 'block';
    });
});

// Funkcja tworząca modal wyboru rozmiaru
function createSizeModal(product, basePrice) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <span class="close-size-modal">&times;</span>
            <h3>Wybierz rozmiar dla ${product}</h3>
            <div class="size-options">
                <div class="size-option" data-size="10ml" data-price="${basePrice}">
                    <span>10ml</span>
                    <span class="price">${basePrice}zł</span>
                </div>
                <div class="size-option" data-size="30ml" data-price="${basePrice * 3}">
                    <span>30ml</span>
                    <span class="price">${basePrice * 3}zł</span>
                </div>
                <div class="size-option" data-size="60ml" data-price="${basePrice * 6}">
                    <span>60ml</span>
                    <span class="price">${basePrice * 6}zł</span>
                </div>
            </div>
            <button class="btn confirm-size">Dodaj do koszyka</button>
        </div>
    `;
    
    // Styl dla modal size
    const style = document.createElement('style');
    style.textContent = `
        .size-options {
            margin: 2rem 0;
        }
        .size-option {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            margin-bottom: 0.5rem;
            background: rgba(45, 55, 72, 0.5);
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.3s;
            border: 2px solid transparent;
        }
        .size-option:hover {
            background: rgba(45, 55, 72, 0.8);
        }
        .size-option.selected {
            border-color: #667eea;
            background: rgba(102, 126, 234, 0.2);
        }
        .size-option .price {
            font-weight: bold;
            color: #48bb78;
        }
        .close-size-modal {
            color: #a0aec0;
            float: right;
            font-size: 2rem;
            font-weight: bold;
            cursor: pointer;
        }
        .close-size-modal:hover {
            color: #e2e8f0;
        }
    `;
    document.head.appendChild(style);
    
    let selectedSize = null;
    let selectedPrice = null;
    
    // Wybór rozmiaru
    modal.querySelectorAll('.size-option').forEach(option => {
        option.addEventListener('click', function() {
            modal.querySelectorAll('.size-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            selectedSize = this.getAttribute('data-size');
            selectedPrice = parseInt(this.getAttribute('data-price'));
        });
    });
    
    // Potwierdzenie wyboru
    modal.querySelector('.confirm-size').addEventListener('click', function() {
        if (selectedSize && selectedPrice) {
            addToCart(product, selectedSize, selectedPrice);
            modal.remove();
            style.remove();
        } else {
            alert('Proszę wybrać rozmiar!');
        }
    });
    
    // Zamykanie modala
    modal.querySelector('.close-size-modal').addEventListener('click', function() {
        modal.remove();
        style.remove();
    });
    
    // Zamykanie po kliknięciu poza modalem
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
            style.remove();
        }
    });
    
    return modal;
}

// Funkcja dodająca produkt do koszyka
function addToCart(product, size, price) {
    // Sprawdzamy czy produkt już jest w koszyku
    const existingItem = cart.find(item => item.name === product && item.size === size);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            name: product,
            size: size,
            quantity: 1,
            price: price
        });
    }
    
    updateCartCount();
    
    // Powiadomienie
    showNotification(`Dodano ${product} (${size}) do koszyka!`);
}

// Pokazanie powiadomienia
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #48bb78, #38a169);
        color: white;
        padding: 1rem 2rem;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        z-index: 1001;
        font-weight: bold;
        transform: translateX(400px);
        transition: transform 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Aktualizacja licznika koszyka
function updateCartCount() {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    cartCount.textContent = totalItems;
}

// Aktualizacja wyświetlania koszyka
function updateCartDisplay() {
    cartItems.innerHTML = '';
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<p style="text-align: center; color: #a0aec0;">Koszyk jest pusty</p>';
        cartTotal.textContent = '0';
        return;
    }
    
    let total = 0;
    
    cart.forEach((item, index) => {
        const itemTotal = item.quantity * item.price;
        total += itemTotal;
        
        const cartItemElement = document.createElement('div');
        cartItemElement.className = 'cart-item';
        cartItemElement.innerHTML = `
            <div>
                <h4>${item.name}</h4>
                <p>${item.size} • Ilość: ${item.quantity} x ${item.price}zł</p>
            </div>
            <div>
                <strong>${itemTotal}zł</strong>
                <button class="remove-item" data-index="${index}">Usuń</button>
            </div>
        `;
        
        cartItems.appendChild(cartItemElement);
    });
    
    cartTotal.textContent = total;
    
    // Dodajemy event listener do przycisków usuwania
    document.querySelectorAll('.remove-item').forEach(button => {
        button.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            removeFromCart(index);
        });
    });
}

// Usuwanie z koszyka
function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartCount();
    updateCartDisplay();
}

// Zamówienie
checkoutBtn.addEventListener('click', function() {
    if (cart.length === 0) {
        alert('Koszyk jest pusty!');
        return;
    }
    
    const orderDetails = cart.map(item => 
        `${item.name} (${item.size}) x${item.quantity} - ${item.quantity * item.price}zł`
    ).join('\n');
    
    const total = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    
    alert(`Dziękujemy za złożenie zamówienia!\n\n${orderDetails}\n\nRAZEM: ${total}zł\n\nSkontaktujemy się z Tobą w celu potwierdzenia szczegółów.`);
    
    cart = [];
    updateCartCount();
    updateCartDisplay();
    cartModal.style.display = 'none';
});

// Zamykanie modala po kliknięciu poza nim
window.addEventListener('click', function(event) {
    if (event.target === cartModal) {
        cartModal.style.display = 'none';
    }
});

// Płynne przewijanie do sekcji
document.querySelectorAll('nav a').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        if (this.getAttribute('href').startsWith('#')) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                window.scrollTo({
                    top: targetSection.offsetTop - 100,
                    behavior: 'smooth'
                });
            }
        }
    });
});

// Inicjalizacja
document.addEventListener('DOMContentLoaded', function() {
    updateCartCount();
    
    // Ładujemy koszyk z localStorage
    const savedCart = localStorage.getItem('kurwiel-cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartCount();
    }
});

// Zapisujemy koszyk do localStorage przy zmianach
function saveCartToLocalStorage() {
    localStorage.setItem('kurwiel-cart', JSON.stringify(cart));
}

// Modyfikujemy funkcje dodawania i usuwania z koszyka, aby zapisywały do localStorage
const originalAddToCart = addToCart;
addToCart = function(product, size, price) {
    originalAddToCart(product, size, price);
    saveCartToLocalStorage();
};

const originalRemoveFromCart = removeFromCart;
removeFromCart = function(index) {
    originalRemoveFromCart(index);
    saveCartToLocalStorage();
};