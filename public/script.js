// Configurações da API
const API_BASE_URL = '/api';

// Estado da aplicação
let categorias = [];
let produtos = [];
let categoriaAtiva = 'all';
let categoriasProdutos = []

// Elementos DOM
const loadingElement = document.getElementById('loading');
const produtosDestaqueContainer = document.getElementById('produtos-destaque');
const categoriaFiltersContainer = document.getElementById('categoria-filters');
const produtosContainer = document.getElementById('produtos-container');

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    inicializarApp();
    setupEventListeners();
});

async function inicializarApp() {
    try {
        showLoading();
        await carregarConfiguracoes();
        await carregarCategorias();
        await carregarCardapioCompleto();
        renderizarFiltrosCategorias();
        renderizarProdutosDestaque();
        renderizarCardapio();
        hideLoading();
        
        // Adicionar animações de entrada
        setTimeout(() => {
            animateOnScroll();
        }, 500);
    } catch (error) {
        console.error('Erro ao inicializar aplicação:', error);
        hideLoading();
        mostrarErro('Erro ao carregar o cardápio. Tente novamente mais tarde.');
    }
}

// Carregar configurações do sistema
async function carregarConfiguracoes() {
    try {
        const response = await fetch('/api/configuracoes');
        const data = await response.json();
        
        if (data.success) {
            const config = data.data;
            const tempoEntrega = config.tempo_entrega || '60';
            const tempoRetirada = config.tempo_retirada || '45';
            
            // Atualizar texto na hero section
            const infoElement = document.querySelector('.info-item span');
            if (infoElement) {
                infoElement.textContent = `Entrega: ${tempoEntrega}min | Retirada: ${tempoRetirada}min`;
            }
        }
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
    }
}

function setupEventListeners() {
    // Smooth scroll para links de navegação
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Efeito de scroll no header
    window.addEventListener('scroll', function() {
        const header = document.querySelector('.header');
        if (window.scrollY > 100) {
            header.style.background = 'linear-gradient(135deg, rgba(51, 51, 51, 0.95), rgba(44, 44, 44, 0.95))';
            header.style.backdropFilter = 'blur(10px)';
        } else {
            header.style.background = 'linear-gradient(135deg, #333333, #2c2c2c)';
            header.style.backdropFilter = 'none';
        }
    });

    // Event listener para filtro "Todas"
    document.querySelector('.filter-btn[data-categoria="all"]').addEventListener('click', () => {
        filtrarPorCategoria('all');
    });
}

// Funções de Loading
function showLoading() {
    loadingElement.classList.remove('hidden');
}

function hideLoading() {
    loadingElement.classList.add('hidden');
}

// Funções da API
async function carregarCategorias() {
    try {
        const response = await fetch(`${API_BASE_URL}/categorias`);
        const data = await response.json();
        
        if (data.success) {
            categorias = data.data;
        } else {
            throw new Error(data.error || 'Erro ao carregar categorias');
        }
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        throw error;
    }
}

async function carregarCardapioCompleto() {
    try {
        const response = await fetch(`${API_BASE_URL}/cardapio-completo`);
        const data = await response.json();
        
        if (data.success) {
            // Extrair todos os produtos de todas as categorias
            produtos = [];
            categoriasProdutos = data.data;
            data.data.forEach(categoria => {
                categoria.produtos.forEach(produto => {
                    produtos.push({
                        ...produto,
                        categoria_nome: categoria.nome
                    });
                });
            });
        } else {
            throw new Error(data.error || 'Erro ao carregar cardápio');
        }
    } catch (error) {
        console.error('Erro ao carregar cardápio:', error);
        throw error;
    }
}

// Funções de Renderização
function renderizarFiltrosCategorias() {
    // Não limpar o container, apenas adicionar os novos botões após o botão "Todas"
    const botaoTodas = categoriaFiltersContainer.querySelector('[data-categoria="all"]');
    
    categoriasProdutos.forEach(categoria => {
        const button = document.createElement('button');
        button.className = 'filter-btn';
        button.setAttribute('data-categoria', categoria.id);
        
        // Ícones específicos para cada categoria
        const icones = {
            'Mais vendidos': 'fas fa-fire',
            'Promoções': 'fas fa-percent',
            'Caldos': 'fas fa-bowl-hot',
            'Hot Dog': 'fas fa-hotdog',
            'Sucos Naturais': 'fas fa-glass-water',
            'X-Salada': 'fas fa-hamburger',
            'X-Frango': 'fas fa-drumstick-bite',
            'No Pão Francês': 'fas fa-bread-slice',
            'Bauru': 'fas fa-sandwich',
            'Lanches': 'fas fa-burger',
            'Omelete': 'fas fa-egg',
            'Porções': 'fas fa-utensils',
            'Bebidas': 'fas fa-wine-bottle'
        };
        
        let icone = 'fas fa-utensils';
        for (const [key, value] of Object.entries(icones)) {
            if (categoria.nome.includes(key)) {
                icone = value;
                break;
            }
        }
        
        button.innerHTML = `
            <i class="${icone}"></i>
            ${categoria.nome}
            <span class="badge">${categoria.produtos.length}</span>
        `;
        
        button.addEventListener('click', () => filtrarPorCategoria(categoria.id));
        categoriaFiltersContainer.appendChild(button);
    });
}

function renderizarProdutosDestaque() {
    const produtosDestaque = produtos.filter(produto => produto.destaque);
    
    produtosDestaqueContainer.innerHTML = '';
    
    if (produtosDestaque.length === 0) {
        produtosDestaqueContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666;">
                <i class="fas fa-star" style="font-size: 3rem; margin-bottom: 1rem; color: #FFD700;"></i>
                <p>Nenhum produto em destaque no momento.</p>
            </div>
        `;
        return;
    }
    
    produtosDestaque.forEach((produto, index) => {
        const produtoCard = criarProdutoCard(produto, true);
        produtoCard.style.animationDelay = `${index * 0.1}s`;
        produtoCard.classList.add('fade-in-up');
        produtosDestaqueContainer.appendChild(produtoCard);
    });
}

function renderizarCardapio() {
    produtosContainer.innerHTML = '';
    
    if (categoriaAtiva === 'all') {
        // Mostrar todas as categorias
        categorias.forEach((categoria, index) => {
            const produtosDaCategoria = produtos.filter(p => p.categoria_id === categoria.id);
            
            if (produtosDaCategoria.length > 0) {
                const categoriaSection = criarCategoriaSection(categoria, produtosDaCategoria);
                categoriaSection.style.animationDelay = `${index * 0.1}s`;
                categoriaSection.classList.add('fade-in-up');
                produtosContainer.appendChild(categoriaSection);
            }
        });
    } else {
        // Mostrar apenas uma categoria
        const categoria = categorias.find(c => c.id === parseInt(categoriaAtiva));
        const produtosDaCategoria = produtos.filter(p => p.categoria_id === parseInt(categoriaAtiva));
        
        if (categoria && produtosDaCategoria.length > 0) {
            const categoriaSection = criarCategoriaSection(categoria, produtosDaCategoria);
            categoriaSection.classList.add('fade-in-up');
            produtosContainer.appendChild(categoriaSection);
        }
    }
    
    // Reativar animações
    setTimeout(() => {
        animateOnScroll();
    }, 100);
}

function criarCategoriaSection(categoria, produtosDaCategoria) {
    const section = document.createElement('div');
    section.className = 'categoria-section';
    
    const title = document.createElement('h3');
    title.className = 'categoria-title';
    
    // Ícone específico para a categoria
    const icones = {
        'Mais vendidos': 'fas fa-fire',
        'Promoções': 'fas fa-percent',
        'Caldos': 'fas fa-bowl-hot',
        'Hot Dog': 'fas fa-hotdog',
        'Sucos Naturais': 'fas fa-glass-water',
        'X-Salada': 'fas fa-hamburger',
        'X-Frango': 'fas fa-drumstick-bite',
        'No Pão Francês': 'fas fa-bread-slice',
        'Bauru': 'fas fa-sandwich',
        'Lanches': 'fas fa-burger',
        'Omelete': 'fas fa-egg',
        'Porções': 'fas fa-utensils',
        'Bebidas': 'fas fa-wine-bottle'
    };
    
    let icone = 'fas fa-utensils';
    for (const [key, value] of Object.entries(icones)) {
        if (categoria.nome.includes(key)) {
            icone = value;
            break;
        }
    }
    
    title.innerHTML = `
        <i class="${icone}"></i>
        ${categoria.nome}
        <span style="font-size: 0.8em; color: #666; font-weight: normal;">
            (${produtosDaCategoria.length} ${produtosDaCategoria.length === 1 ? 'item' : 'itens'})
        </span>
    `;
    
    const produtosGrid = document.createElement('div');
    produtosGrid.className = 'categoria-produtos';
    
    produtosDaCategoria.forEach((produto, index) => {
        const produtoCard = criarProdutoCard(produto);
        produtoCard.style.animationDelay = `${index * 0.05}s`;
        produtoCard.classList.add('fade-in-up');
        produtosGrid.appendChild(produtoCard);
    });
    
    section.appendChild(title);
    section.appendChild(produtosGrid);
    
    return section;
}

function criarProdutoCard(produto, isDestaque = false) {
    const card = document.createElement('div');
    card.className = `produto-card ${produto.destaque ? 'produto-destaque' : ''}`;
    
    const destaqueBadge = produto.destaque ? `
        <div class="destaque-badge">
            <i class="fas fa-star"></i>
            Destaque
        </div>
    ` : '';
    
    const imagemProduto = produto.imagem_url ? `
        <div class="produto-imagem">
            <img src="${produto.imagem_url}" alt="${produto.nome}" loading="lazy" onerror="this.parentElement.style.display='none'">
        </div>
    ` : '';
    
    card.innerHTML = `
        ${destaqueBadge}
        ${imagemProduto}
        <div class="produto-header">
            <div class="produto-info">
                <h4 class="produto-nome">${produto.nome}</h4>
                <span class="produto-categoria">${produto.categoria_nome}</span>
            </div>
            <div class="produto-preco">R$ ${formatarPreco(produto.preco)}</div>
        </div>
        <p class="produto-descricao">${produto.descricao || 'Delicioso produto da nossa cozinha!'}</p>
    `;
    
    // Adicionar efeito hover
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-8px) scale(1.02)';
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0) scale(1)';
    });
    
    return card;
}

// Funções de Filtro
function filtrarPorCategoria(categoriaId) {
    categoriaAtiva = categoriaId;
    
    // Atualizar botões ativos
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (categoriaId === 'all') {
        document.querySelector('.filter-btn[data-categoria="all"]').classList.add('active');
    } else {
        document.querySelector(`.filter-btn[data-categoria="${categoriaId}"]`).classList.add('active');
    }
    
    // Animação de saída
    const currentCards = document.querySelectorAll('.categoria-section');
    currentCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
    });
    
    // Renderizar novo conteúdo após animação
    setTimeout(() => {
        renderizarCardapio();
        
        // Scroll suave para o cardápio
        document.getElementById('cardapio').scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }, 300);
}

// Funções de Animação
function animateOnScroll() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    document.querySelectorAll('.fade-in-up').forEach(el => {
        observer.observe(el);
    });
}

// Adicionar CSS para animações
const style = document.createElement('style');
style.textContent = `
    .fade-in-up {
        opacity: 0;
        transform: translateY(30px);
        transition: all 0.6s ease;
    }
    
    .fade-in-up.animate {
        opacity: 1;
        transform: translateY(0);
    }
    
    .badge {
        background: rgba(255, 165, 0, 0.2);
        color: #FFA500;
        padding: 0.2rem 0.5rem;
        border-radius: 10px;
        font-size: 0.75rem;
        font-weight: 600;
        margin-left: 0.5rem;
    }
    
    .produto-card {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .categoria-section {
        transition: all 0.3s ease;
    }
`;
document.head.appendChild(style);

// Funções utilitárias
function formatarPreco(preco) {
    return parseFloat(preco).toFixed(2).replace('.', ',');
}

function mostrarErro(mensagem) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #dc3545, #c82333);
        color: white;
        padding: 1rem 2rem;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(220, 53, 69, 0.3);
        z-index: 1001;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
    `;
    errorDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i class="fas fa-exclamation-triangle"></i>
            <span>${mensagem}</span>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: white; font-size: 1.2rem; cursor: pointer; margin-left: auto;">
                ×
            </button>
        </div>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Remover automaticamente após 5 segundos
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => errorDiv.remove(), 300);
        }
    }, 5000);
}

// Adicionar animações CSS para mensagens de erro
const errorAnimations = document.createElement('style');
errorAnimations.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(errorAnimations);

