// Configuração da API
const API_BASE_URL = '/api';

// Estado da aplicação
let isLoading = false;

// Elementos DOM
let loginForm, usernameInput, passwordInput, loginBtn, toastContainer;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    checkAuthStatus();
    setupEventListeners();
    
    // Focar no campo de usuário
    if (usernameInput) {
        usernameInput.focus();
    }
});

function initializeElements() {
    loginForm = document.getElementById('login-form');
    usernameInput = document.getElementById('username');
    passwordInput = document.getElementById('password');
    loginBtn = document.getElementById('login-btn');
    toastContainer = document.getElementById('toast-container');
    
    // Criar container de toast se não existir
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
}

function setupEventListeners() {
    // Submit do formulário
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            e.stopPropagation();
            handleLogin();
        });
    }
    
    // Enter nos campos
    if (usernameInput) {
        usernameInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && passwordInput) {
                e.preventDefault();
                passwordInput.focus();
            }
        });
    }
    
    if (passwordInput) {
        passwordInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLogin();
            }
        });
    }
    
    // Click no botão de login
    if (loginBtn) {
        loginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            handleLogin();
        });
    }
}

async function checkAuthStatus() {
    const token = localStorage.getItem('admin_token');
    
    if (token) {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/categorias`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                // Token válido, redirecionar
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

async function handleLogin() {
    // Prevenir múltiplas execuções
    if (isLoading) {
        return;
    }
    
    if (!usernameInput || !passwordInput) {
        showToast('Erro', 'Elementos do formulário não encontrados', 'error');
        return;
    }
    
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
            if (passwordInput) {
                passwordInput.value = '';
                passwordInput.focus();
            }
        }
        
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        showToast('Erro', 'Erro de conexão. Tente novamente.', 'error');
    } finally {
        setLoading(false);
    }
}

function setLoading(loading) {
    isLoading = loading;
    
    if (loginBtn) {
        if (loading) {
            loginBtn.disabled = true;
            loginBtn.classList.add('loading');
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
        } else {
            loginBtn.disabled = false;
            loginBtn.classList.remove('loading');
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
        }
    }
}

function togglePassword() {
    if (!passwordInput) return;
    
    const passwordIcon = document.getElementById('password-icon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        if (passwordIcon) {
            passwordIcon.className = 'fas fa-eye-slash';
        }
    } else {
        passwordInput.type = 'password';
        if (passwordIcon) {
            passwordIcon.className = 'fas fa-eye';
        }
    }
}

function showToast(title, message, type = 'info') {
    if (!toastContainer) return;
    
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
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        }
    }, 5000);
}

// Expor função globalmente para uso no HTML
window.togglePassword = togglePassword;

// Adicionar estilos para toasts se não existirem
if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        .toast-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .toast {
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 300px;
            max-width: 400px;
            animation: slideInRight 0.3s ease;
        }
        
        .toast.success {
            border-left: 4px solid #28a745;
        }
        
        .toast.error {
            border-left: 4px solid #dc3545;
        }
        
        .toast.warning {
            border-left: 4px solid #ffc107;
        }
        
        .toast.info {
            border-left: 4px solid #17a2b8;
        }
        
        .toast-icon {
            font-size: 20px;
        }
        
        .toast.success .toast-icon {
            color: #28a745;
        }
        
        .toast.error .toast-icon {
            color: #dc3545;
        }
        
        .toast.warning .toast-icon {
            color: #ffc107;
        }
        
        .toast.info .toast-icon {
            color: #17a2b8;
        }
        
        .toast-content {
            flex: 1;
        }
        
        .toast-title {
            font-weight: 600;
            margin-bottom: 4px;
        }
        
        .toast-message {
            font-size: 14px;
            color: #666;
        }
        
        .toast-close {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: #999;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .toast-close:hover {
            color: #666;
        }
        
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        
        @media (max-width: 480px) {
            .toast-container {
                top: 10px;
                right: 10px;
                left: 10px;
            }
            
            .toast {
                min-width: auto;
                max-width: none;
            }
        }
    `;
    document.head.appendChild(style);
}

