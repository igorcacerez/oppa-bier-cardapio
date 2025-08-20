const API_BASE_URL = '/api';

// Elementos DOM
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const loadingElement = document.getElementById('loading');
const toastContainer = document.getElementById('toast-container');

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    // Verificar se já está logado
    checkAuthStatus();
    
    // Setup event listeners
    setupEventListeners();
    
    // Focar no campo de usuário
    usernameInput.focus();
});

function setupEventListeners() {
    // Submit do formulário
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Enter nos campos
    if (usernameInput) {
        usernameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && passwordInput) {
                e.preventDefault();
                passwordInput.focus();
            }
        });
        
        // Limpar mensagens de erro ao digitar
        usernameInput.addEventListener('input', clearErrors);
    }
    
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLogin(e);
            }
        });
        
        // Limpar mensagens de erro ao digitar
        passwordInput.addEventListener('input', clearErrors);
    }
    
    // Click no botão de login
    if (loginBtn) {
        loginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleLogin(e);
        });
    }
}

async function checkAuthStatus() {
    const token = localStorage.getItem('admin_token');
    
    if (token) {
        // Já está logado, redirecionar para admin
        window.location.href = '/admin.html';
        return;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    // Validação básica
    if (!username || !password) {
        showToast('Erro', 'Por favor, preencha todos os campos', 'error');
        return;
    }
    
    // Mostrar loading
    setLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.token) {
            // Salvar token
            localStorage.setItem('admin_token', data.token);
            
            // Mostrar sucesso
            showToast('Sucesso', 'Login realizado com sucesso!', 'success');
            
            // Redirecionar após delay
            setTimeout(() => {
                window.location.href = '/admin.html';
            }, 1000);
        } else {
            // Erro de login
            showToast('Erro', data.error || 'Credenciais inválidas', 'error');
            passwordInput.value = '';
            passwordInput.focus();
        }
    } catch (error) {
        console.error('Erro no login:', error);
        showToast('Erro', 'Erro de conexão. Tente novamente.', 'error');
    } finally {
        setLoading(false);
    }
}

function setLoading(loading) {
    if (loginBtn) {
        loginBtn.disabled = loading;
        loginBtn.innerHTML = loading ? 
            '<i class="fas fa-spinner fa-spin"></i> Entrando...' : 
            '<i class="fas fa-sign-in-alt"></i> Entrar';
    }
    
    if (loadingElement) {
        if (loading) {
            loadingElement.classList.remove('hidden');
        } else {
            loadingElement.classList.add('hidden');
        }
    }
}

function clearErrors() {
    // Remove visual de erro dos campos
    if (usernameInput) usernameInput.style.borderColor = '';
    if (passwordInput) passwordInput.style.borderColor = '';
}

function togglePassword() {
    const passwordIcon = document.getElementById('password-icon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        if (passwordIcon) passwordIcon.className = 'fas fa-eye-slash';
    } else {
        passwordInput.type = 'password';
        if (passwordIcon) passwordIcon.className = 'fas fa-eye';
    }
}

// Sistema de Toast
function showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-exclamation-circle' : 
                 'fa-info-circle';
    
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${icon}"></i>
            <div class="toast-text">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
        </div>
        <button class="toast-close" onclick="closeToast(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    if (toastContainer) {
        toastContainer.appendChild(toast);
        
        // Auto remove após 5 segundos
        setTimeout(() => {
            if (toast.parentNode) {
                closeToast(toast.querySelector('.toast-close'));
            }
        }, 5000);
    }
}

function closeToast(button) {
    const toast = button.closest('.toast');
    if (toast) {
        toast.style.animation = 'slideOut 0.3s ease-in-out';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
}

// Animações
function animateElements() {
    const elements = document.querySelectorAll('.animate-on-load');
    elements.forEach((element, index) => {
        setTimeout(() => {
            element.classList.add('animated');
        }, index * 100);
    });
}

// Executar animações quando a página carregar
document.addEventListener('DOMContentLoaded', animateElements);

