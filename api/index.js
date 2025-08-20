const express = require('express');
const { createClient } = require('@libsql/client');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'oppa-bier-secret-key-2024';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Session middleware
app.use(session({
    secret: JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

// Configuração do Multer para upload de imagens
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'produto-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Apenas arquivos de imagem são permitidos!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

// Configuração do cliente Turso
const client = createClient({
    url: "libsql://database-oppa-bier-vercel-icfg-8r97zqoxqmz3z9w7wuixjouq.aws-us-east-1.turso.io",
    authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NTU2MDU2MTcsImlkIjoiMWI2OTdlYjUtZjU4OC00ZDFjLWI3ODEtYTEwNTlmMmI1Nzg5IiwicmlkIjoiOGU1YjZiODEtOTIxMS00Y2QwLTg4YTktNTdhYmExOTgzODFmIn0.OU6AbcnyeDtMQvvJBhCGbhrq4RNOqKNMAkJNypspJby77O4V-ljAuu8UTisWXrXD6sw55VYzYdF81-n55FjLBg",
});

// Função para inicializar banco de dados
async function initializeDatabase() {
    try {
        console.log('🔄 Conectando ao Turso...');
        
        // Criar tabela de usuários admin
        await client.execute(`CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Criar tabela de categorias
        await client.execute(`CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            descricao TEXT,
            ativo INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Criar tabela de produtos
        await client.execute(`CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            descricao TEXT,
            preco REAL NOT NULL,
            categoria_id INTEGER,
            imagem TEXT,
            ativo INTEGER DEFAULT 1,
            destaque INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (categoria_id) REFERENCES categorias (id)
        )`);

        // Criar tabela de configurações
        await client.execute(`CREATE TABLE IF NOT EXISTS configuracoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chave TEXT UNIQUE NOT NULL,
            valor TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Verificar e criar usuário admin
        const adminCheck = await client.execute("SELECT COUNT(*) as count FROM admin_users");
        if (adminCheck.rows[0].count === 0) {
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            await client.execute({
                sql: "INSERT INTO admin_users (username, password) VALUES (?, ?)",
                args: ['admin', hashedPassword]
            });
            console.log('✅ Usuário admin criado');
        }

        // Verificar e criar configurações
        const configCheck = await client.execute("SELECT COUNT(*) as count FROM configuracoes");
        if (configCheck.rows[0].count === 0) {
            await client.execute({
                sql: "INSERT INTO configuracoes (chave, valor) VALUES (?, ?)",
                args: ['tempo_entrega', '60']
            });
            await client.execute({
                sql: "INSERT INTO configuracoes (chave, valor) VALUES (?, ?)",
                args: ['tempo_retirada', '45']
            });
            console.log('✅ Configurações padrão criadas');
        }

        // Popular categorias se estiver vazio
        const catCheck = await client.execute("SELECT COUNT(*) as count FROM categorias");
        if (catCheck.rows[0].count === 0) {
            await popularCategorias();
        }

        // Popular produtos se estiver vazio
        const prodCheck = await client.execute("SELECT COUNT(*) as count FROM produtos");
        if (prodCheck.rows[0].count === 0) {
            await popularProdutos();
        }

        console.log('✅ Banco de dados Turso inicializado com sucesso');
    } catch (error) {
        console.error('❌ Erro ao inicializar banco Turso:', error);
        throw error;
    }
}

// Função para popular categorias
async function popularCategorias() {
    const categorias = [
        {"nome": "Mais vendidos", "descricao": "Os produtos mais pedidos pelos nossos clientes"},
        {"nome": "Promoções", "descricao": "Ofertas especiais e promoções"},
        {"nome": "Caldos", "descricao": "Caldos quentes e saborosos"},
        {"nome": "Hot Dog", "descricao": "Variedade de hot dogs"},
        {"nome": "Sucos Naturais", "descricao": "Sucos frescos e naturais"},
        {"nome": "X-Salada", "descricao": "Hambúrgueres com salada"},
        {"nome": "X-Frango (Hambúrguer)", "descricao": "Hambúrgueres de frango"},
        {"nome": "X-Frango (Filé)", "descricao": "Sanduíches com filé de frango"},
        {"nome": "No Pão Francês", "descricao": "Sanduíches no pão francês"},
        {"nome": "Bauru's Aberto", "descricao": "Bauros servidos abertos"},
        {"nome": "Lanches da Casa", "descricao": "Especialidades da casa"},
        {"nome": "Lanches Gourmet", "descricao": "Lanches especiais gourmet"},
        {"nome": "Lanches no Prato", "descricao": "Lanches servidos no prato"},
        {"nome": "Omelete", "descricao": "Variedade de omeletes"},
        {"nome": "Porções", "descricao": "Porções para compartilhar"},
        {"nome": "Bebidas", "descricao": "Bebidas diversas"}
    ];

    console.log('📋 Populando categorias...');
    for (const categoria of categorias) {
        await client.execute({
            sql: "INSERT INTO categorias (nome, descricao) VALUES (?, ?)",
            args: [categoria.nome, categoria.descricao]
        });
    }
    console.log(`✅ ${categorias.length} categorias inseridas`);
}

// Função para popular produtos
async function popularProdutos() {
    const produtos = [
        // Mais vendidos (categoria_id: 1)
        {"nome": "Bauru Nordestino", "descricao": "Pão francês, mais de 300g de carne seca desfiada, catupiry", "preco": 45.00, "categoria_id": 1, "destaque": 1},
        {"nome": "Hot Dog Burger", "descricao": "Hambúrguer, salsicha, batata, cenoura, mostarda, catchup e maionese", "preco": 22.00, "categoria_id": 1, "destaque": 1},
        {"nome": "X-OPPA", "descricao": "1 hambúrguer de costela, 1 hambúrguer de linguiça, 1 hambúrguer de carne, queijo prato, presunto, bacon, calabresa, ovo, cebola, cheddar, catupiry, tomate, alface e maionese", "preco": 33.00, "categoria_id": 1, "destaque": 1},
        {"nome": "Cowboy", "descricao": "Pão, 2 hamburgueres de 100g, queijo prato, bacon, catupiry, tomate, alface e maionese", "preco": 40.00, "categoria_id": 1, "destaque": 1},
        {"nome": "Costela Premium", "descricao": "300g de costela, catupiry, queijo prato, oregano, vinagrete, tomate e alface", "preco": 40.00, "categoria_id": 1, "destaque": 1},
        {"nome": "X-Alcatra Acebolada", "descricao": "Alcatra fatiada, queijo prato, tomate, cebola, maionese, alface", "preco": 36.00, "categoria_id": 1, "destaque": 1},

        // Promoções (categoria_id: 2)
        {"nome": "Bauru Nordestino Promoção", "descricao": "Pão francês, mais de 300g de carne seca desfiada, catupiry... (Promoção especial)", "preco": 45.00, "categoria_id": 2, "destaque": 1},

        // Caldos (categoria_id: 3)
        {"nome": "Caldo Verde", "descricao": "Batata, couve, bacon e calabresa. Acompanha torradas", "preco": 25.00, "categoria_id": 3},
        {"nome": "Dobradinha", "descricao": "Dobradinha, acompanha torradas e farofa", "preco": 25.00, "categoria_id": 3},

        // Hot Dog (categoria_id: 4)
        {"nome": "Hot Dog Simples", "descricao": "Salsicha, batata, cenoura, mostarda, catchup e maionese", "preco": 12.00, "categoria_id": 4},
        {"nome": "Hot Dog Duplo", "descricao": "Duas salsichas, batata, cenoura, mostarda, catchup e maionese", "preco": 14.00, "categoria_id": 4},
        {"nome": "Hot Dog Salada", "descricao": "Salsicha, batata, cenoura, kechup, tomate, alface, mostarda e maionese", "preco": 14.00, "categoria_id": 4},
        {"nome": "Hot Dog Pizza", "descricao": "Salsicha, batata, cenoura, mostarda, catchup, presunto, queijo e maionese", "preco": 17.00, "categoria_id": 4},
        {"nome": "Hot Dog Nordestino", "descricao": "Salsicha, carne seca, catupiry, cenoura, maionese, ketchup e mostarda", "preco": 25.00, "categoria_id": 4},
        {"nome": "Hot Costela", "descricao": "Salsicha perdigão mostarda maionese kechup batata cenoura costela", "preco": 25.00, "categoria_id": 4},
        {"nome": "Hot da Casa (pão francês)", "descricao": "Salsicha, queijo prato, presunto, ovo, calabresa, bacon, batata, cenoura, mostarda, ketchup e maionese", "preco": 37.00, "categoria_id": 4},

        // Sucos Naturais (categoria_id: 5)
        {"nome": "Suco Natural 500ml", "descricao": "Suco natural de frutas variadas 500ml", "preco": 14.00, "categoria_id": 5},

        // X-Salada (categoria_id: 6)
        {"nome": "X-Burguer", "descricao": "Hambúrguer artesanal, presunto, queijo e maionese caseira", "preco": 18.00, "categoria_id": 6},
        {"nome": "X-Salada", "descricao": "Hambúrguer artesanal, presunto, queijo, tomate, alface e maionese caseira", "preco": 18.00, "categoria_id": 6},
        {"nome": "X-Egg", "descricao": "Hambúrguer artesanal, presunto, queijo, tomate, alface, ovo e maionese caseira", "preco": 20.00, "categoria_id": 6},
        {"nome": "X-Acebolado", "descricao": "Hambúrguer artesanal, presunto, queijo, tomate, alface, cebola e maionese caseira", "preco": 20.00, "categoria_id": 6},
        {"nome": "X Egg Acebolado", "descricao": "Hambúrguer artesanal queijo prato presunto ovo cebola tomate alface maionese caseira", "preco": 22.00, "categoria_id": 6},
        {"nome": "X-Bacon", "descricao": "Hambúrguer artesanal, presunto, queijo, bacon, tomate, alface e maionese caseira", "preco": 23.00, "categoria_id": 6},
        {"nome": "X-Calabresa", "descricao": "Hambúrguer artesanal, presunto, queijo, tomate, alface, calabresa e maionese caseira", "preco": 23.00, "categoria_id": 6},
        {"nome": "X-Tudo", "descricao": "Hambúrguer artesanal, presunto, queijo, tomate, alface, calabresa, bacon, ovo, cebola e maionese caseira", "preco": 35.00, "categoria_id": 6},

        // X-Frango (Hambúrguer) (categoria_id: 7)
        {"nome": "X-Frango Acebolado", "descricao": "Hambúrguer artesanal de frango, presunto, queijo, tomate, alface, cebola e maionese caseira", "preco": 20.00, "categoria_id": 7},

        // X-Frango (Filé) (categoria_id: 8)
        {"nome": "X-Frango Filé", "descricao": "Filé de frango, presunto, queijo, tomate, alface e maionese caseira", "preco": 20.00, "categoria_id": 8},
        {"nome": "X-Frango Filé Acebolado", "descricao": "Filé de frango, presunto, queijo, tomate, alface, cebola e maionese caseira", "preco": 22.00, "categoria_id": 8},
        {"nome": "X-Frango Filé Bacon", "descricao": "Filé de frango, presunto, queijo, tomate, alface, bacon e maionese caseira", "preco": 27.00, "categoria_id": 8},
        {"nome": "X-Frango Filé Calabresa", "descricao": "Filé de frango, presunto, queijo, tomate, alface, calabresa e maionese caseira", "preco": 27.00, "categoria_id": 8},
        {"nome": "X-Frango Filé Tudo", "descricao": "Filé de frango, presunto, queijo, tomate, alface, calabresa, bacon, ovo, cebola e maionese caseira", "preco": 35.00, "categoria_id": 8},

        // No Pão Francês (categoria_id: 9)
        {"nome": "Queijo Quente", "descricao": "Queijo, tomate, alface e maionese", "preco": 16.00, "categoria_id": 9},
        {"nome": "Bauru", "descricao": "Presunto, queijo, tomate e maionese", "preco": 16.00, "categoria_id": 9},
        {"nome": "Misto", "descricao": "Presunto, queijo e maionese", "preco": 16.00, "categoria_id": 9},
        {"nome": "Americano", "descricao": "Presunto, queijo, tomate, alface, ovo e maionese", "preco": 18.00, "categoria_id": 9},
        {"nome": "Bauru Acebolado", "descricao": "Presunto, queijo, tomate, cebola e maionese", "preco": 18.00, "categoria_id": 9},
        {"nome": "Misto Acebolado", "descricao": "Presunto, queijo, cebola e maionese", "preco": 18.00, "categoria_id": 9},
        {"nome": "Americano Acebolado", "descricao": "Presunto, queijo, tomate, cebola, alface, ovo e maionese", "preco": 20.00, "categoria_id": 9},
        {"nome": "Americano Bacon", "descricao": "Presunto, queijo, tomate, alface, ovo, bacon e maionese", "preco": 23.00, "categoria_id": 9},
        {"nome": "Queijo Quente Bacon", "descricao": "Queijo, tomate, alface, bacon e maionese", "preco": 23.00, "categoria_id": 9},
        {"nome": "Queijo Quente Calabresa", "descricao": "Queijo, calabresa, tomate, alface e maionese", "preco": 23.00, "categoria_id": 9},
        {"nome": "Bauru Bacon", "descricao": "Presunto, queijo, tomate, bacon e maionese", "preco": 23.00, "categoria_id": 9},
        {"nome": "Bauru Calabresa", "descricao": "Presunto, queijo, calabresa, tomate e maionese", "preco": 23.00, "categoria_id": 9},
        {"nome": "Misto Bacon", "descricao": "Presunto, queijo, bacon e maionese", "preco": 23.00, "categoria_id": 9},
        {"nome": "Misto Calabresa", "descricao": "Presunto, queijo, calabresa e maionese", "preco": 23.00, "categoria_id": 9},
        {"nome": "Americano Tudo", "descricao": "Presunto, queijo, tomate, alface, ovo, bacon, calabresa e maionese", "preco": 35.00, "categoria_id": 9},
        {"nome": "Queijo Quente Tudo", "descricao": "Queijo, tomate, alface, bacon, calabresa, presunto, ovo e maionese", "preco": 35.00, "categoria_id": 9},
        {"nome": "Bauru Tudo", "descricao": "Presunto, queijo, tomate, bacon, calabresa, ovo e maionese", "preco": 35.00, "categoria_id": 9},
        {"nome": "Misto Tudo", "descricao": "Presunto, queijo, bacon, calabresa, ovo e maionese", "preco": 35.00, "categoria_id": 9},

        // Bauru's Aberto (categoria_id: 10)
        {"nome": "Bauru Aberto Simples", "descricao": "Oito fatias de presunto, quatro fatias de queijo e tomate", "preco": 25.00, "categoria_id": 10},
        {"nome": "Bauru Aberto Completo", "descricao": "Oito fatias de presunto, quatro fatias de queijo, tomate, alface, ovo, bacon, calabresa e maionese", "preco": 38.00, "categoria_id": 10},
        {"nome": "Bauru Costela", "descricao": "Pão francês, mais de 300g de costela desfiada, catupiry, tomate e oregano", "preco": 40.00, "categoria_id": 10},

        // Lanches da Casa (categoria_id: 11)
        {"nome": "X-Costela", "descricao": "Hambúrguer de costela, pão de hambúrguer, queijo prato, presunto, tomate, alface e maionese", "preco": 18.00, "categoria_id": 11},
        {"nome": "X-Duplo", "descricao": "Hambúrguer de sua preferência (carne, linguiça ou frango), queijo prato, presunto, tomate, alface e maionese", "preco": 25.00, "categoria_id": 11},
        {"nome": "Combo Kids", "descricao": "Burguer Kids, Smiles, Docinho, Suquinho e um brinquedinho", "preco": 28.00, "categoria_id": 11},
        {"nome": "Paulista Filé de Frango", "descricao": "Filé de Frango, queijo prato, presunto, maionese, tomate e alface", "preco": 30.00, "categoria_id": 11},
        {"nome": "X-Contra Filé", "descricao": "Pão francês, contra filé fatiado, creme cream cheese, maionese, tomate, alface", "preco": 37.00, "categoria_id": 11},

        // Lanches Gourmet (categoria_id: 12)
        {"nome": "Duplo Gourmet", "descricao": "2 hambúrguer caseiro cebola roxa queijo prato alface tomate maionese", "preco": 30.00, "categoria_id": 12},
        {"nome": "Duplo Caramelo", "descricao": "Pão Gourmet, 2 hamburgueres de 120g, queijo prato, catupiry, cebola caramelizada, tomate, alface e maionese", "preco": 35.00, "categoria_id": 12},
        {"nome": "Calabresa Conhaque", "descricao": "2 hambúrguer caseiro queijo prato calabresa com cebola caramelizada no conhaque tomate alface maionese", "preco": 35.00, "categoria_id": 12},
        {"nome": "Bacon Extreme", "descricao": "Queijo prato, hambúrguer de 120g, muito bacon e um delicioso molho especial", "preco": 40.00, "categoria_id": 12, "destaque": 1},
        {"nome": "Vulcão Gourmet", "descricao": "2 hambúrguer caseiro queijo prato presunto ovo calabresa bacon cebola roxa tomate alface maionese", "preco": 40.00, "categoria_id": 12, "destaque": 1},

        // Lanches no Prato (categoria_id: 13)
        {"nome": "X-Salada (No Prato)", "descricao": "Hambúrguer, queijo, tomate, presunto, alface", "preco": 18.00, "categoria_id": 13},
        {"nome": "X-Filé de Frango (No Prato)", "descricao": "Filé de frango, queijo, tomate, presunto, alface", "preco": 22.00, "categoria_id": 13},

        // Omelete (categoria_id: 14)
        {"nome": "Omelete", "descricao": "Cinco Ovos, presunto, queijo, calabresa, alface e tomate", "preco": 26.00, "categoria_id": 14},

        // Porções (categoria_id: 15)
        {"nome": "Batata Frita", "descricao": "Porção de batata frita crocante", "preco": 20.00, "categoria_id": 15},
        {"nome": "Cebola Empanada", "descricao": "500g porção de cebola empanada", "preco": 25.00, "categoria_id": 15},
        {"nome": "Porção Calabresa Acebolada", "descricao": "Acompanha torradas. Serve em média 2 a 3 pessoas", "preco": 35.00, "categoria_id": 15},
        {"nome": "Porção de Filé de Frango", "descricao": "Acompanha torradas", "preco": 35.00, "categoria_id": 15},
        {"nome": "Isca de Frango Empanado", "descricao": "Iscas de frango empanado crocante", "preco": 40.00, "categoria_id": 15},
        {"nome": "Batata Frita com Costela Desfiada", "descricao": "Costela desfiada, catupiry, queijo prato, oregano, vinagrete, tomate e alface", "preco": 50.00, "categoria_id": 15, "destaque": 1},
        {"nome": "Alcatra Completa + Batata", "descricao": "Alcatra, batata frita, torradas. Serve em média 3 a 4 pessoas", "preco": 80.00, "categoria_id": 15, "destaque": 1},

        // Bebidas (categoria_id: 16)
        {"nome": "Refrigerante Lata", "descricao": "Refrigerante em lata 350ml", "preco": 5.00, "categoria_id": 16},
        {"nome": "Refrigerante 600ml", "descricao": "Refrigerante garrafa 600ml", "preco": 8.00, "categoria_id": 16},
        {"nome": "Água Mineral", "descricao": "Água mineral 500ml", "preco": 3.00, "categoria_id": 16},
        {"nome": "Suco de Caixinha", "descricao": "Suco de caixinha 200ml", "preco": 4.00, "categoria_id": 16},
        {"nome": "Cerveja Long Neck", "descricao": "Cerveja long neck 355ml", "preco": 6.00, "categoria_id": 16}
    ];

    console.log('🍔 Populando produtos originais...');
    for (const produto of produtos) {
        await client.execute({
            sql: `INSERT INTO produtos (nome, descricao, preco, categoria_id, destaque) 
                  VALUES (?, ?, ?, ?, ?)`,
            args: [produto.nome, produto.descricao, produto.preco, produto.categoria_id, produto.destaque || 0]
        });
    }
    console.log(`✅ ${produtos.length} produtos originais inseridos`);
}

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de acesso requerido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
};

// ROTAS DE AUTENTICAÇÃO

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
        }

        const result = await client.execute({
            sql: "SELECT * FROM admin_users WHERE username = ?",
            args: [username]
        });

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const user = result.rows[0];
        if (!bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login realizado com sucesso',
            token: token,
            user: {
                id: user.id,
                username: user.username
            }
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ROTAS DE CATEGORIAS

// Listar todas as categorias
app.get('/api/categorias', async (req, res) => {
    try {
        const result = await client.execute("SELECT * FROM categorias WHERE ativo = 1 ORDER BY nome");
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Erro ao buscar categorias:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor' 
        });
    }
});


// Verificar token e retornar usuário autenticado
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
    try {
        const userResult = await client.execute({
            sql: "SELECT id, username FROM admin_users WHERE id = ?",
            args: [req.user.id]
        });

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const user = userResult.rows[0];
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username
            }
        });
    } catch (error) {
        console.error('Erro na verificação do token:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});


// Criar nova categoria
app.post('/api/categorias', authenticateToken, async (req, res) => {
    try {
        const { nome, descricao } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
        }

        const result = await client.execute({
            sql: "INSERT INTO categorias (nome, descricao) VALUES (?, ?)",
            args: [nome, descricao || '']
        });
        
        res.status(201).json({
            message: 'Categoria criada com sucesso',
            id: result.lastInsertRowid
        });
    } catch (error) {
        console.error('Erro ao criar categoria:', error);
        res.status(500).json({ error: 'Erro ao criar categoria' });
    }
});

// Atualizar categoria
app.put('/api/categorias/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, descricao } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
        }

        const result = await client.execute({
            sql: "UPDATE categorias SET nome = ?, descricao = ? WHERE id = ?",
            args: [nome, descricao || '', id]
        });
        
        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Categoria não encontrada' });
        }
        
        res.json({ message: 'Categoria atualizada com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar categoria:', error);
        res.status(500).json({ error: 'Erro ao atualizar categoria' });
    }
});

// Deletar categoria
app.delete('/api/categorias/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar se há produtos nesta categoria
        const productCheck = await client.execute({
            sql: "SELECT COUNT(*) as count FROM produtos WHERE categoria_id = ? AND ativo = 1",
            args: [id]
        });

        if (productCheck.rows[0].count > 0) {
            return res.status(400).json({ 
                error: 'Não é possível deletar categoria com produtos ativos' 
            });
        }

        const result = await client.execute({
            sql: "UPDATE categorias SET ativo = 0 WHERE id = ?",
            args: [id]
        });
        
        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Categoria não encontrada' });
        }
        
        res.json({ message: 'Categoria deletada com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar categoria:', error);
        res.status(500).json({ error: 'Erro ao deletar categoria' });
    }
});

// ROTAS DE PRODUTOS

// Listar todos os produtos
app.get('/api/produtos', async (req, res) => {
    try {
        const { categoria_id, destaque } = req.query;
        
        let sql = `
            SELECT p.*, c.nome as categoria_nome 
            FROM produtos p 
            LEFT JOIN categorias c ON p.categoria_id = c.id 
            WHERE p.ativo = 1
        `;
        let args = [];

        if (categoria_id) {
            sql += ' AND p.categoria_id = ?';
            args.push(categoria_id);
        }

        if (destaque) {
            sql += ' AND p.destaque = 1';
        }

        sql += ' ORDER BY p.nome';

        const result = await client.execute({ sql, args });
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Criar novo produto
app.post('/api/produtos', authenticateToken, upload.single('imagem'), async (req, res) => {
    try {
        const { nome, descricao, preco, categoria_id, destaque } = req.body;
        const imagem = req.file ? `/uploads/${req.file.filename}` : '';

        if (!nome || !preco || !categoria_id) {
            return res.status(400).json({ 
                error: 'Nome, preço e categoria são obrigatórios' 
            });
        }

        const result = await client.execute({
            sql: `INSERT INTO produtos (nome, descricao, preco, categoria_id, imagem, destaque) 
                  VALUES (?, ?, ?, ?, ?, ?)`,
            args: [nome, descricao || '', parseFloat(preco), categoria_id, imagem, destaque ? 1 : 0]
        });
        
        res.status(201).json({
            message: 'Produto criado com sucesso',
            id: result.lastInsertRowid
        });
    } catch (error) {
        console.error('Erro ao criar produto:', error);
        res.status(500).json({ error: 'Erro ao criar produto' });
    }
});

// Atualizar produto
app.put('/api/produtos/:id', authenticateToken, upload.single('imagem'), async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, descricao, preco, categoria_id, destaque } = req.body;
        
        if (!nome || !preco || !categoria_id) {
            return res.status(400).json({ 
                error: 'Nome, preço e categoria são obrigatórios' 
            });
        }

        let result;
        if (req.file) {
            const imagem = `/uploads/${req.file.filename}`;
            result = await client.execute({
                sql: `UPDATE produtos SET nome = ?, descricao = ?, preco = ?, 
                      categoria_id = ?, imagem = ?, destaque = ? WHERE id = ?`,
                args: [nome, descricao || '', parseFloat(preco), categoria_id, imagem, destaque ? 1 : 0, id]
            });
        } else {
            result = await client.execute({
                sql: `UPDATE produtos SET nome = ?, descricao = ?, preco = ?, 
                      categoria_id = ?, destaque = ? WHERE id = ?`,
                args: [nome, descricao || '', parseFloat(preco), categoria_id, destaque ? 1 : 0, id]
            });
        }
        
        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }
        
        res.json({ message: 'Produto atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        res.status(500).json({ error: 'Erro ao atualizar produto' });
    }
});

// Deletar produto
app.delete('/api/produtos/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await client.execute({
            sql: "UPDATE produtos SET ativo = 0 WHERE id = ?",
            args: [id]
        });
        
        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }
        
        res.json({ message: 'Produto deletado com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar produto:', error);
        res.status(500).json({ error: 'Erro ao deletar produto' });
    }
});

// ROTAS DE CONFIGURAÇÕES

// Buscar configurações
app.get('/api/configuracoes', async (req, res) => {
    try {
        const result = await client.execute("SELECT * FROM configuracoes");
        
        const config = {};
        result.rows.forEach(row => {
            config[row.chave] = row.valor;
        });
        
        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('Erro ao buscar configurações:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor' 
        });
    }
});

// Atualizar configurações
app.put('/api/configuracoes', authenticateToken, async (req, res) => {
    try {
        const { tempo_entrega, tempo_retirada } = req.body;

        if (!tempo_entrega || !tempo_retirada) {
            return res.status(400).json({ 
                error: 'Tempo de entrega e retirada são obrigatórios' 
            });
        }

        await client.execute({
            sql: "UPDATE configuracoes SET valor = ? WHERE chave = 'tempo_entrega'",
            args: [tempo_entrega]
        });
        
        await client.execute({
            sql: "UPDATE configuracoes SET valor = ? WHERE chave = 'tempo_retirada'",
            args: [tempo_retirada]
        });
        
        res.json({ message: 'Configurações atualizadas com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar configurações:', error);
        res.status(500).json({ error: 'Erro ao atualizar configurações' });
    }
});

// ROTAS DE USUÁRIO

// Atualizar usuário
app.put('/api/usuario', authenticateToken, async (req, res) => {
    try {
        const { username, password, currentPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword) {
            return res.status(400).json({ error: 'Senha atual é obrigatória' });
        }

        // Verificar senha atual
        const userResult = await client.execute({
            sql: "SELECT * FROM admin_users WHERE id = ?",
            args: [userId]
        });

        if (userResult.rows.length === 0 || !bcrypt.compareSync(currentPassword, userResult.rows[0].password)) {
            return res.status(401).json({ error: 'Senha atual incorreta' });
        }

        const user = userResult.rows[0];
        let updates = [];
        let args = [];

        if (username && username !== user.username) {
            updates.push("username = ?");
            args.push(username);
        }

        if (password) {
            updates.push("password = ?");
            args.push(bcrypt.hashSync(password, 10));
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhuma alteração fornecida' });
        }

        const sql = `UPDATE admin_users SET ${updates.join(", ")} WHERE id = ?`;
        args.push(userId);

        await client.execute({ sql, args });
        res.json({ message: 'Usuário atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
});

// ROTAS ESTATÍSTICAS

// Cardápio completo (endpoint que estava faltando)
app.get('/api/cardapio-completo', async (req, res) => {
    try {
        const categoriasResult = await client.execute("SELECT * FROM categorias WHERE ativo = 1 ORDER BY nome");
        
        const cardapio = [];
        for (const categoria of categoriasResult.rows) {
            const produtosResult = await client.execute({
                sql: "SELECT * FROM produtos WHERE categoria_id = ? AND ativo = 1 ORDER BY nome",
                args: [categoria.id]
            });
            
            cardapio.push({
                id: categoria.id,
                nome: categoria.nome,
                descricao: categoria.descricao,
                produtos: produtosResult.rows
            });
        }
        
        res.json({
            success: true,
            data: cardapio
        });
    } catch (error) {
        console.error('Erro ao buscar cardápio completo:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor' 
        });
    }
});

// Dashboard stats
app.get('/api/stats', authenticateToken, async (req, res) => {
    try {
        const categoriasResult = await client.execute("SELECT COUNT(*) as count FROM categorias WHERE ativo = 1");
        const produtosResult = await client.execute("SELECT COUNT(*) as count FROM produtos WHERE ativo = 1");
        const destaquesResult = await client.execute("SELECT COUNT(*) as count FROM produtos WHERE ativo = 1 AND destaque = 1");
        
        const stats = {
            categorias: categoriasResult.rows[0].count,
            produtos: produtosResult.rows[0].count,
            destaques: destaquesResult.rows[0].count
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para servir arquivos estáticos
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// Inicializar banco de dados
initializeDatabase().catch((error) => {
    console.error('❌ Erro fatal ao inicializar banco:', error);
    process.exit(1);
});

// Export para Vercel
module.exports = app;

// Para desenvolvimento local
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Servidor rodando na porta ${PORT}`);
        console.log(`🌐 Acesse: http://localhost:${PORT}`);
        console.log(`🔐 Admin: http://localhost:${PORT}/login.html`);
    });
}

