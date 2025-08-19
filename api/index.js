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
        cb(null, path.join(__dirname, '..', 'public', 'uploads'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'produto-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Aceitar apenas imagens
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
        console.log('Conectando ao Turso...');
        
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

        // Verificar se usuário admin existe
        const adminCheck = await client.execute("SELECT COUNT(*) as count FROM admin_users");
        if (adminCheck.rows[0].count === 0) {
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            await client.execute({
                sql: "INSERT INTO admin_users (username, password) VALUES (?, ?)",
                args: ['admin', hashedPassword]
            });
            console.log('Usuário admin criado com sucesso');
        }

        // Verificar se configurações existem
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
            console.log('Configurações padrão criadas');
        }

        console.log('Banco de dados Turso inicializado com sucesso');
    } catch (error) {
        console.error('Erro ao inicializar banco Turso:', error);
        throw error;
    }
}

// Inicializar banco de dados
initializeDatabase().catch((error) => {
    console.error('Erro fatal ao inicializar banco:', error);
    process.exit(1);
});

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
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar categorias:', error);
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
        
        res.json(config);
    } catch (error) {
        console.error('Erro ao buscar configurações:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
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

// Export para Vercel
module.exports = app;

// Para desenvolvimento local
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Servidor rodando na porta ${PORT}`);
        console.log(`Acesse: http://localhost:${PORT}`);
        console.log(`Admin: http://localhost:${PORT}/login.html`);
    });
}

