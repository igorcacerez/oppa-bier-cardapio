// Configurações da API
const API_BASE_URL = '/api';

// Estado da aplicação
let currentUser = null;
let categorias = [];
let produtos = [];
let currentTab = 'categorias';
let editingItem = null;

// Elementos DOM
const loadingElement = document.getElementById('loading');
const toastContainer = document.getElementById('toast-container');
const usernameDisplay = document.getElementById('username-display');
const logoutBtn = document.getElementById('logout-btn');

// Inicialização
document.addEventListener('DOMContentLoaded', function () {
    checkAuthentication();
});

async function checkAuthentication() {
    const token = localStorage.getItem('admin_token');
    if (!token) {
        redirectToLogin();
        return;
    }

    try {
        // A rota /api/auth/verify deve validar o Bearer e devolver { user: { id, username } }
        const response = await fetch(`${API_BASE_URL}/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            usernameDisplay.textContent = currentUser.username;
            initializeApp();
        } else {
            localStorage.removeItem('admin_token');
            redirectToLogin();
        }
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        localStorage.removeItem('admin_token');
        redirectToLogin();
    }
}

function redirectToLogin() {
    window.location.href = '/login.html';
}

async function initializeApp() {
    try {
        showLoading();
        await loadStatistics();   // /api/stats (protegida)
        await loadCategorias();   // /api/categorias
        await loadProdutos();     // /api/produtos
        setupEventListeners();
        renderCategorias();
        renderProdutos();
    } catch (error) {
        console.error('Erro ao inicializar aplicação:', error);
        showToast('Erro', 'Erro ao carregar dados do painel', 'error');
    } finally {
        hideLoading();
    }
}

function setupEventListeners() {
    // Logout (não há rota no backend — apenas limpar token)
    logoutBtn.addEventListener('click', handleLogout);

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Categorias
    document.getElementById('add-categoria-btn').addEventListener('click', () => openCategoriaModal());
    document.getElementById('categoria-form').addEventListener('submit', handleCategoriaSubmit);
    document.getElementById('cancel-categoria').addEventListener('click', closeCategoriaModal);

    // Produtos
    document.getElementById('add-produto-btn').addEventListener('click', () => openProdutoModal());
    document.getElementById('produto-form').addEventListener('submit', handleProdutoSubmit);
    document.getElementById('cancel-produto').addEventListener('click', closeProdutoModal);
    document.getElementById('search-produtos').addEventListener('input', filterProdutos);
    document.getElementById('filter-categoria').addEventListener('change', filterProdutos);

    // Modals
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });

    // Fechar modal clicando fora
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeAllModals();
        });
    });
}

// Funções de Loading
function showLoading() { loadingElement.classList.remove('hidden'); }
function hideLoading() { loadingElement.classList.add('hidden'); }

// Funções da API com autenticação
function getAuthHeaders() {
    const token = localStorage.getItem('admin_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

async function handleLogout() {
    try {
        // Não existe /auth/logout no backend. Apenas limpar o token.
    } finally {
        localStorage.removeItem('admin_token');
        redirectToLogin();
    }
}

// --------- LOADERS ---------
async function loadStatistics() {
    // /api/stats exige Bearer (middleware authenticateToken)
    try {
        const response = await fetch(`${API_BASE_URL}/stats`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Falha ao carregar estatísticas');
        const data = await response.json();
        renderStatistics(data);
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        throw error;
    }
}

async function loadCategorias() {
    try {
        const response = await fetch(`${API_BASE_URL}/categorias`);
        if (!response.ok) throw new Error('Falha ao carregar categorias');
        const data = await response.json(); // { success, data }
        if (data && data.success) {
            categorias = data.data || [];
            updateCategoriaSelects();
        } else {
            throw new Error(data?.error || 'Erro ao carregar categorias');
        }
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        throw error;
    }
}

async function loadProdutos() {
    try {
        const response = await fetch(`${API_BASE_URL}/produtos`);
        if (!response.ok) throw new Error('Falha ao carregar produtos');
        // Retorno é um array direto
        produtos = await response.json();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        throw error;
    }
}

// --------- RENDER ---------
function renderStatistics(stats) {
    const statsContainer = document.getElementById('stats-container');

    const statsData = [
        { number: stats.categorias || 0, label: 'Categorias', icon: 'fas fa-tags', type: 'success' },
        { number: stats.produtos || 0, label: 'Produtos', icon: 'fas fa-hamburger', type: 'info' },
        { number: stats.destaques || 0, label: 'Em Destaque', icon: 'fas fa-star', type: 'warning' }
    ];

    statsContainer.innerHTML = statsData.map(stat => `
    <div class="stat-card ${stat.type}">
      <div class="stat-number">${stat.number}</div>
      <div class="stat-label">${stat.label}</div>
      <i class="${stat.icon} stat-icon"></i>
    </div>
  `).join('');
}

function switchTab(tabName) {
    currentTab = tabName;

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

function renderCategorias() {
    const tbody = document.querySelector('#categorias-table tbody');

    // O GET /api/categorias já retorna só ativas; não há 'ordem' nem 'total_produtos'
    tbody.innerHTML = categorias.map(categoria => `
    <tr>
      <td>${categoria.id}</td>
      <td>${categoria.nome}</td>
      <td>${categoria.descricao || '-'}</td>
      <td>
        <span class="status-badge ${categoria.ativo ? 'status-active' : 'status-inactive'}">
          ${categoria.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td>
        <button class="btn btn-sm btn-warning" onclick="editCategoria(${categoria.id})">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="deleteCategoria(${categoria.id})">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function renderProdutos() {
    const tbody = document.querySelector('#produtos-table tbody');

    tbody.innerHTML = produtos.map(produto => `
    <tr>
      <td>${produto.id}</td>
      <td>${produto.nome}</td>
      <td>${produto.categoria_nome || '-'}</td>
      <td>R$ ${formatPrice(produto.preco)}</td>
      <td>
        <span class="status-badge ${produto.ativo ? 'status-active' : 'status-inactive'}">
          ${produto.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td>
        ${produto.destaque ? '<span class="destaque-badge"><i class="fas fa-star"></i> Destaque</span>' : '-'}
      </td>
      <td>
        <button class="btn btn-sm btn-warning" onclick="editProduto(${produto.id})">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="deleteProduto(${produto.id})">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function updateCategoriaSelects() {
    const selects = ['produto-categoria', 'filter-categoria'];

    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;

        const currentValue = select.value;
        const isFilter = selectId === 'filter-categoria';

        select.innerHTML = isFilter
            ? '<option value="">Todas as categorias</option>'
            : '<option value="">Selecione uma categoria</option>';

        categorias.forEach(categoria => {
            const option = document.createElement('option');
            option.value = categoria.id;
            option.textContent = categoria.nome;
            select.appendChild(option);
        });

        if (currentValue) select.value = currentValue;
    });
}

function filterProdutos() {
    const searchTerm = document.getElementById('search-produtos').value.toLowerCase();
    const categoriaFilter = document.getElementById('filter-categoria').value;

    const filteredProdutos = produtos.filter(produto => {
        const matchesSearch =
            produto.nome.toLowerCase().includes(searchTerm) ||
            (produto.descricao && produto.descricao.toLowerCase().includes(searchTerm));
        const matchesCategoria = !categoriaFilter || produto.categoria_id == categoriaFilter;
        return matchesSearch && matchesCategoria;
    });

    const tbody = document.querySelector('#produtos-table tbody');
    tbody.innerHTML = filteredProdutos.map(produto => `
    <tr>
      <td>${produto.id}</td>
      <td>${produto.nome}</td>
      <td>${produto.categoria_nome || '-'}</td>
      <td>R$ ${formatPrice(produto.preco)}</td>
      <td>
        <span class="status-badge ${produto.ativo ? 'status-active' : 'status-inactive'}">
          ${produto.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td>
        ${produto.destaque ? '<span class="destaque-badge"><i class="fas fa-star"></i> Destaque</span>' : '-'}
      </td>
      <td>
        <button class="btn btn-sm btn-warning" onclick="editProduto(${produto.id})">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="deleteProduto(${produto.id})">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

// --------- MODAL CATEGORIA ---------
function openCategoriaModal(categoria = null) {
    editingItem = categoria;
    const modal = document.getElementById('categoria-modal');
    const title = document.getElementById('categoria-modal-title');
    const form = document.getElementById('categoria-form');

    title.textContent = categoria ? 'Editar Categoria' : 'Nova Categoria';

    if (categoria) {
        document.getElementById('categoria-nome').value = categoria.nome;
        document.getElementById('categoria-descricao').value = categoria.descricao || '';
    } else {
        form.reset();
    }

    modal.classList.add('show');
}

function closeCategoriaModal() {
    document.getElementById('categoria-modal').classList.remove('show');
    editingItem = null;
}

async function handleCategoriaSubmit(e) {
    e.preventDefault();

    const formData = {
        nome: document.getElementById('categoria-nome').value.trim(),
        descricao: document.getElementById('categoria-descricao').value.trim()
    };

    if (!formData.nome) {
        showToast('Erro', 'Nome da categoria é obrigatório', 'error');
        return;
    }

    try {
        showLoading();

        const url = editingItem
            ? `${API_BASE_URL}/categorias/${editingItem.id}`
            : `${API_BASE_URL}/categorias`;

        const method = editingItem ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Sucesso', data.message || 'Operação realizada com sucesso', 'success');
            closeCategoriaModal();
            await loadCategorias();
            await loadStatistics();
            renderCategorias();
        } else {
            showToast('Erro', data.error || 'Falha ao salvar categoria', 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar categoria:', error);
        showToast('Erro', 'Erro ao salvar categoria', 'error');
    } finally {
        hideLoading();
    }
}

// --------- MODAL PRODUTO ---------
function openProdutoModal(produto = null) {
    editingItem = produto;
    const modal = document.getElementById('produto-modal');
    const title = document.getElementById('produto-modal-title');
    const form = document.getElementById('produto-form');

    title.textContent = produto ? 'Editar Produto' : 'Novo Produto';

    if (produto) {
        document.getElementById('produto-nome').value = produto.nome;
        document.getElementById('produto-descricao').value = produto.descricao || '';
        document.getElementById('produto-preco').value = produto.preco;
        document.getElementById('produto-categoria').value = produto.categoria_id;
        document.getElementById('produto-destaque').checked = !!produto.destaque;
    } else {
        form.reset();
    }

    modal.classList.add('show');
}

function closeProdutoModal() {
    document.getElementById('produto-modal').classList.remove('show');
    editingItem = null;
}

async function handleProdutoSubmit(e) {
    e.preventDefault();

    const nome = document.getElementById('produto-nome').value.trim();
    const descricao = document.getElementById('produto-descricao').value.trim();
    const preco = parseFloat(document.getElementById('produto-preco').value);
    const categoria_id = parseInt(document.getElementById('produto-categoria').value);
    const destaque = document.getElementById('produto-destaque').checked;
    const imagemFile = document.getElementById('produto-imagem').files[0];

    if (!nome || !preco || !categoria_id) {
        showToast('Erro', 'Nome, preço e categoria são obrigatórios', 'error');
        return;
    }

    try {
        showLoading();

        const url = editingItem
            ? `${API_BASE_URL}/produtos/${editingItem.id}`
            : `${API_BASE_URL}/produtos`;

        const method = editingItem ? 'PUT' : 'POST';

        // FormData para upload de arquivo conforme backend espera (campo "imagem")
        const formData = new FormData();
        formData.append('nome', nome);
        formData.append('descricao', descricao);
        formData.append('preco', preco);
        formData.append('categoria_id', categoria_id);
        formData.append('destaque', destaque ? 1 : 0);
        if (imagemFile) formData.append('imagem', imagemFile);

        const response = await fetch(url, {
            method,
            headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Sucesso', data.message || 'Operação realizada com sucesso', 'success');
            closeProdutoModal();
            await loadProdutos();
            await loadStatistics();
            renderProdutos();
        } else {
            showToast('Erro', data.error || 'Falha ao salvar produto', 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        showToast('Erro', 'Erro ao salvar produto', 'error');
    } finally {
        hideLoading();
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('show'));
    editingItem = null;
}

// --------- EDIÇÃO / EXCLUSÃO ---------
function editCategoria(id) {
    const categoria = categorias.find(c => c.id === id);
    if (categoria) openCategoriaModal(categoria);
}

function editProduto(id) {
    const produto = produtos.find(p => p.id === id);
    if (produto) openProdutoModal(produto);
}

async function deleteCategoria(id) {
    const categoria = categorias.find(c => c.id === id);
    if (!categoria) return;

    if (!confirm(`Tem certeza que deseja excluir a categoria "${categoria.nome}"?`)) return;

    try {
        showLoading();

        const response = await fetch(`${API_BASE_URL}/categorias/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Sucesso', data.message || 'Categoria excluída', 'success');
            await loadCategorias();
            await loadStatistics();
            renderCategorias();
        } else {
            showToast('Erro', data.error || 'Falha ao excluir categoria', 'error');
        }
    } catch (error) {
        console.error('Erro ao excluir categoria:', error);
        showToast('Erro', 'Erro ao excluir categoria', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteProduto(id) {
    const produto = produtos.find(p => p.id === id);
    if (!produto) return;

    if (!confirm(`Tem certeza que deseja excluir o produto "${produto.nome}"?`)) return;

    try {
        showLoading();

        const response = await fetch(`${API_BASE_URL}/produtos/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Sucesso', data.message || 'Produto excluído', 'success');
            await loadProdutos();
            await loadStatistics();
            renderProdutos();
        } else {
            showToast('Erro', data.error || 'Falha ao excluir produto', 'error');
        }
    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        showToast('Erro', 'Erro ao excluir produto', 'error');
    } finally {
        hideLoading();
    }
}

// --------- UTIL ---------
function formatPrice(price) {
    return parseFloat(price).toFixed(2).replace('.', ',');
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

    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// Expor funções globalmente
window.editCategoria = editCategoria;
window.editProduto = editProduto;
window.deleteCategoria = deleteCategoria;
window.deleteProduto = deleteProduto;

// Preview de imagem
document.addEventListener('DOMContentLoaded', function () {
    const imagemInput = document.getElementById('produto-imagem');
    const previewContainer = document.getElementById('imagem-preview');
    const previewImg = document.getElementById('preview-img');
    const removerBtn = document.getElementById('remover-imagem');

    if (imagemInput) {
        imagemInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    previewImg.src = e.target.result;
                    previewContainer.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (removerBtn) {
        removerBtn.addEventListener('click', function () {
            if (imagemInput) imagemInput.value = '';
            previewContainer.style.display = 'none';
            previewImg.src = '';
        });
    }
});
