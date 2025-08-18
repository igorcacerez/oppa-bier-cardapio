// Configurações da API
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
        try {
            const response = await fetch(`${API_BASE_URL}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                // Já está logado, redirecionar para admin
                window.location.href = '/admin.html';
                return;
            }
        } catch (error) {
            console.error('Erro ao verificar autenticação:', error);
        }
        
        // Token inválido, remover
        localStorage.removeItem('admin_token');
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
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Salvar token
            localStorage.setItem('admin_token', data.token);
            
            // Mostrar sucesso
            showToast('Sucesso', 'Login realizado com sucesso!', 'success');
            
            // Redirecionar após um breve delay
            setTimeout(() => {
                window.location.href = '/admin.html';
            }, 1000);
            
        } else {
            showToast('Erro de Login', data.error || 'Credenciais inválidas', 'error');
            
            // Limpar campos em caso de erro
            passwordInput.value = '';
            passwordInput.focus();
        }
        
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        showToast('Erro', 'Erro de conexão. Tente novamente.', 'error');
    } finally {
        setLoading(false);
    }
}

function setLoading(loading) {
    if (loading) {
        if (loadingElement) loadingElement.classList.remove('hidden');
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.classList.add('loading');
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
        }
    } else {
        if (loadingElement) loadingElement.classList.add('hidden');
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.classList.remove('loading');
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
        }
    }
}

function clearErrors() {
    // Remove visual de erro dos campos
    usernameInput.style.borderColor = '';
    passwordInput.style.borderColor = '';
}

function togglePassword() {
    const passwordIcon = document.getElementById('password-icon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        passwordIcon.className = 'fas fa-eye-slash';
    } else {
        passwordInput.type = 'password';
        passwordIcon.className = 'fas fa-eye';
    }
}

function showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="${icons[type]} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Remover automaticamente após 5 segundos
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// Adicionar animação de saída para toasts
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Expor função globalmente para uso no HTML
window.togglePassword = togglePassword;

