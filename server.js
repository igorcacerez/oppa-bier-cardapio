const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'oppa-bier-secret-key-2024';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

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
        cb(null, 'public/uploads/');
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

// Conectar ao banco de dados SQLite
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
        
        // Criar tabela de usuários admin se não existir
        db.run(`CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Erro ao criar tabela admin_users:', err.message);
            } else {
                // Criar usuário admin padrão
                const defaultPassword = bcrypt.hashSync('admin123', 10);
                db.run(`INSERT OR IGNORE INTO admin_users (username, password) VALUES (?, ?)`, 
                    ['admin', defaultPassword], (err) => {
                    if (err) {
                        console.error('Erro ao criar usuário admin:', err.message);
                    } else {
                        console.log('Usuário admin criado/verificado com sucesso');
                        console.log('Login: admin | Senha: admin123');
                    }
                });
            }
        });
        
        // Criar tabela de configurações do sistema
        db.run(`CREATE TABLE IF NOT EXISTS configuracoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chave TEXT UNIQUE NOT NULL,
            valor TEXT NOT NULL,
            descricao TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Erro ao criar tabela configuracoes:', err.message);
            } else {
                // Inserir configurações padrão
                const configPadrao = [
                    ['tempo_entrega', '60', 'Tempo de entrega em minutos'],
                    ['tempo_retirada', '45', 'Tempo de retirada em minutos']
                ];
                
                configPadrao.forEach(([chave, valor, descricao]) => {
                    db.run(`INSERT OR IGNORE INTO configuracoes (chave, valor, descricao) VALUES (?, ?, ?)`, 
                        [chave, valor, descricao]);
                });
                
                console.log('Configurações do sistema criadas/verificadas');
            }
        });
    }
});

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: 'Token de acesso requerido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
};

// Rotas públicas da API

// Obter todas as categorias
app.get('/api/categorias', (req, res) => {
    const query = `
        SELECT c.*, COUNT(p.id) as total_produtos 
        FROM categorias c 
        LEFT JOIN produtos p ON c.id = p.categoria_id AND p.ativo = 1
        WHERE c.ativo = 1 
        GROUP BY c.id 
        ORDER BY c.ordem
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar categorias:', err.message);
            res.status(500).json({ success: false, error: err.message });
        } else {
            res.json({ success: true, data: rows });
        }
    });
});

// Obter cardápio completo
app.get('/api/cardapio-completo', (req, res) => {
    const query = `
        SELECT 
            c.id as categoria_id,
            c.nome as categoria_nome,
            c.descricao as categoria_descricao,
            c.ordem as categoria_ordem,
            p.id as produto_id,
            p.nome as produto_nome,
            p.descricao as produto_descricao,
            p.preco as produto_preco,
            p.ativo as produto_ativo,
            p.destaque as produto_destaque,
            p.imagem_url as produto_imagem_url
        FROM categorias c
        LEFT JOIN produtos p ON c.id = p.categoria_id AND p.ativo = 1
        WHERE c.ativo = 1
        ORDER BY c.ordem, p.nome
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar cardápio:', err.message);
            res.status(500).json({ success: false, error: err.message });
        } else {
            // Organizar dados por categoria
            const categorias = {};
            
            rows.forEach(row => {
                if (!categorias[row.categoria_id]) {
                    categorias[row.categoria_id] = {
                        id: row.categoria_id,
                        nome: row.categoria_nome,
                        descricao: row.categoria_descricao,
                        ordem: row.categoria_ordem,
                        produtos: []
                    };
                }
                
                if (row.produto_id) {
                    categorias[row.categoria_id].produtos.push({
                        id: row.produto_id,
                        nome: row.produto_nome,
                        descricao: row.produto_descricao,
                        preco: parseFloat(row.produto_preco),
                        categoria_id: row.categoria_id,
                        ativo: row.produto_ativo,
                        destaque: row.produto_destaque,
                        imagem_url: row.produto_imagem_url
                    });
                }
            });
            
            const resultado = Object.values(categorias);
            res.json({ success: true, data: resultado });
        }
    });
});

// Rotas de autenticação

// Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username e password são obrigatórios' });
    }
    
    db.get('SELECT * FROM admin_users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Erro ao buscar usuário:', err.message);
            return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
        }
        
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
        }
        
        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        req.session.user = { id: user.id, username: user.username };
        
        res.json({
            success: true,
            message: 'Login realizado com sucesso',
            token: token,
            user: { id: user.id, username: user.username }
        });
    });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Erro ao fazer logout' });
        }
        res.json({ success: true, message: 'Logout realizado com sucesso' });
    });
});

// Verificar autenticação
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ success: true, user: req.user });
});

// Rotas administrativas (protegidas)

// Estatísticas
app.get('/api/admin/estatisticas', authenticateToken, (req, res) => {
    const queries = {
        categorias_ativas: 'SELECT COUNT(*) as count FROM categorias WHERE ativo = 1',
        total_categorias: 'SELECT COUNT(*) as count FROM categorias',
        produtos_ativos: 'SELECT COUNT(*) as count FROM produtos WHERE ativo = 1',
        produtos_destaque: 'SELECT COUNT(*) as count FROM produtos WHERE destaque = 1 AND ativo = 1'
    };
    
    const stats = {};
    let completed = 0;
    const total = Object.keys(queries).length;
    
    Object.keys(queries).forEach(key => {
        db.get(queries[key], [], (err, row) => {
            if (err) {
                console.error(`Erro ao buscar ${key}:`, err.message);
                stats[key] = 0;
            } else {
                stats[key] = row.count;
            }
            
            completed++;
            if (completed === total) {
                res.json({ success: true, data: stats });
            }
        });
    });
});

// Gerenciar categorias
app.get('/api/admin/categorias', authenticateToken, (req, res) => {
    const query = `
        SELECT c.*, COUNT(p.id) as total_produtos 
        FROM categorias c 
        LEFT JOIN produtos p ON c.id = p.categoria_id
        GROUP BY c.id 
        ORDER BY c.ordem
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar categorias:', err.message);
            res.status(500).json({ success: false, error: err.message });
        } else {
            res.json({ success: true, data: rows });
        }
    });
});

app.post('/api/admin/categorias', authenticateToken, (req, res) => {
    const { nome, descricao, ordem, ativo } = req.body;
    
    if (!nome) {
        return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
    }
    
    const query = 'INSERT INTO categorias (nome, descricao, ordem, ativo) VALUES (?, ?, ?, ?)';
    db.run(query, [nome, descricao || null, ordem || 0, ativo ? 1 : 0], function(err) {
        if (err) {
            console.error('Erro ao criar categoria:', err.message);
            res.status(500).json({ success: false, error: err.message });
        } else {
            res.json({ success: true, message: 'Categoria criada com sucesso', id: this.lastID });
        }
    });
});

app.put('/api/admin/categorias/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { nome, descricao, ordem, ativo } = req.body;
    
    if (!nome) {
        return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
    }
    
    const query = 'UPDATE categorias SET nome = ?, descricao = ?, ordem = ?, ativo = ? WHERE id = ?';
    db.run(query, [nome, descricao || null, ordem || 0, ativo ? 1 : 0, id], function(err) {
        if (err) {
            console.error('Erro ao atualizar categoria:', err.message);
            res.status(500).json({ success: false, error: err.message });
        } else {
            res.json({ success: true, message: 'Categoria atualizada com sucesso' });
        }
    });
});

app.delete('/api/admin/categorias/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    // Verificar se há produtos na categoria
    db.get('SELECT COUNT(*) as count FROM produtos WHERE categoria_id = ?', [id], (err, row) => {
        if (err) {
            console.error('Erro ao verificar produtos:', err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
        
        if (row.count > 0) {
            return res.status(400).json({ success: false, error: 'Não é possível excluir categoria que possui produtos' });
        }
        
        db.run('DELETE FROM categorias WHERE id = ?', [id], function(err) {
            if (err) {
                console.error('Erro ao excluir categoria:', err.message);
                res.status(500).json({ success: false, error: err.message });
            } else {
                res.json({ success: true, message: 'Categoria excluída com sucesso' });
            }
        });
    });
});

// Gerenciar produtos
app.get('/api/admin/produtos', authenticateToken, (req, res) => {
    const query = `
        SELECT p.*, c.nome as categoria_nome 
        FROM produtos p 
        LEFT JOIN categorias c ON p.categoria_id = c.id 
        ORDER BY p.nome
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar produtos:', err.message);
            res.status(500).json({ success: false, error: err.message });
        } else {
            const produtos = rows.map(row => ({
                ...row,
                preco: parseFloat(row.preco)
            }));
            res.json({ success: true, data: produtos });
        }
    });
});

app.post('/api/admin/produtos', authenticateToken, upload.single('imagem'), (req, res) => {
    const { nome, descricao, preco, categoria_id, ativo, destaque } = req.body;
    
    if (!nome || !preco || !categoria_id) {
        return res.status(400).json({ success: false, error: 'Nome, preço e categoria são obrigatórios' });
    }
    
    // Se foi enviada uma imagem, usar o caminho do arquivo
    const imagem_url = req.file ? `/uploads/${req.file.filename}` : null;
    
    const query = 'INSERT INTO produtos (nome, descricao, preco, categoria_id, imagem_url, ativo, destaque) VALUES (?, ?, ?, ?, ?, ?, ?)';
    db.run(query, [nome, descricao || null, preco, categoria_id, imagem_url, ativo ? 1 : 0, destaque ? 1 : 0], function(err) {
        if (err) {
            console.error('Erro ao criar produto:', err.message);
            res.status(500).json({ success: false, error: err.message });
        } else {
            res.json({ success: true, message: 'Produto criado com sucesso', id: this.lastID });
        }
    });
});

app.put('/api/admin/produtos/:id', authenticateToken, upload.single('imagem'), (req, res) => {
    const { id } = req.params;
    const { nome, descricao, preco, categoria_id, ativo, destaque, manter_imagem } = req.body;
    
    if (!nome || !preco || !categoria_id) {
        return res.status(400).json({ success: false, error: 'Nome, preço e categoria são obrigatórios' });
    }
    
    // Se foi enviada uma nova imagem, usar o caminho do arquivo
    // Se não foi enviada imagem e manter_imagem é true, manter a imagem atual
    let imagem_url = null;
    if (req.file) {
        imagem_url = `/uploads/${req.file.filename}`;
    } else if (manter_imagem === 'true') {
        // Buscar imagem atual do produto
        db.get('SELECT imagem_url FROM produtos WHERE id = ?', [id], (err, row) => {
            if (!err && row) {
                imagem_url = row.imagem_url;
            }
            
            const query = 'UPDATE produtos SET nome = ?, descricao = ?, preco = ?, categoria_id = ?, imagem_url = ?, ativo = ?, destaque = ? WHERE id = ?';
            db.run(query, [nome, descricao || null, preco, categoria_id, imagem_url, ativo ? 1 : 0, destaque ? 1 : 0, id], function(err) {
                if (err) {
                    console.error('Erro ao atualizar produto:', err.message);
                    res.status(500).json({ success: false, error: err.message });
                } else {
                    res.json({ success: true, message: 'Produto atualizado com sucesso' });
                }
            });
        });
        return;
    }
    
    const query = 'UPDATE produtos SET nome = ?, descricao = ?, preco = ?, categoria_id = ?, imagem_url = ?, ativo = ?, destaque = ? WHERE id = ?';
    db.run(query, [nome, descricao || null, preco, categoria_id, imagem_url, ativo ? 1 : 0, destaque ? 1 : 0, id], function(err) {
        if (err) {
            console.error('Erro ao atualizar produto:', err.message);
            res.status(500).json({ success: false, error: err.message });
        } else {
            res.json({ success: true, message: 'Produto atualizado com sucesso' });
        }
    });
});

app.delete('/api/admin/produtos/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM produtos WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Erro ao excluir produto:', err.message);
            res.status(500).json({ success: false, error: err.message });
        } else {
            res.json({ success: true, message: 'Produto excluído com sucesso' });
        }
    });
});

// Rotas de configurações do sistema
app.get('/api/admin/configuracoes', authenticateToken, (req, res) => {
    db.all('SELECT * FROM configuracoes ORDER BY chave', [], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar configurações:', err.message);
            res.status(500).json({ success: false, error: err.message });
        } else {
            res.json({ success: true, data: rows });
        }
    });
});

app.put('/api/admin/configuracoes/:chave', authenticateToken, (req, res) => {
    const { chave } = req.params;
    const { valor } = req.body;
    
    if (!valor) {
        return res.status(400).json({ success: false, error: 'Valor é obrigatório' });
    }
    
    db.run('UPDATE configuracoes SET valor = ?, updated_at = CURRENT_TIMESTAMP WHERE chave = ?', 
        [valor, chave], function(err) {
        if (err) {
            console.error('Erro ao atualizar configuração:', err.message);
            res.status(500).json({ success: false, error: err.message });
        } else {
            res.json({ success: true, message: 'Configuração atualizada com sucesso' });
        }
    });
});

// Rotas para gerenciar usuário admin
app.get('/api/admin/usuario', authenticateToken, (req, res) => {
    db.get('SELECT id, username FROM admin_users WHERE id = ?', [req.user.id], (err, row) => {
        if (err) {
            console.error('Erro ao buscar usuário:', err.message);
            res.status(500).json({ success: false, error: err.message });
        } else {
            res.json({ success: true, data: row });
        }
    });
});

app.put('/api/admin/usuario', authenticateToken, (req, res) => {
    const { username, password, newPassword } = req.body;
    
    if (!username) {
        return res.status(400).json({ success: false, error: 'Nome de usuário é obrigatório' });
    }
    
    // Verificar senha atual se uma nova senha foi fornecida
    if (newPassword) {
        if (!password) {
            return res.status(400).json({ success: false, error: 'Senha atual é obrigatória para alterar a senha' });
        }
        
        db.get('SELECT password FROM admin_users WHERE id = ?', [req.user.id], (err, row) => {
            if (err) {
                console.error('Erro ao verificar senha:', err.message);
                return res.status(500).json({ success: false, error: err.message });
            }
            
            if (!row || !bcrypt.compareSync(password, row.password)) {
                return res.status(401).json({ success: false, error: 'Senha atual incorreta' });
            }
            
            // Atualizar usuário e senha
            const hashedPassword = bcrypt.hashSync(newPassword, 10);
            db.run('UPDATE admin_users SET username = ?, password = ? WHERE id = ?', 
                [username, hashedPassword, req.user.id], function(err) {
                if (err) {
                    console.error('Erro ao atualizar usuário:', err.message);
                    res.status(500).json({ success: false, error: err.message });
                } else {
                    res.json({ success: true, message: 'Usuário e senha atualizados com sucesso' });
                }
            });
        });
    } else {
        // Atualizar apenas o nome de usuário
        db.run('UPDATE admin_users SET username = ? WHERE id = ?', 
            [username, req.user.id], function(err) {
            if (err) {
                console.error('Erro ao atualizar usuário:', err.message);
                res.status(500).json({ success: false, error: err.message });
            } else {
                res.json({ success: true, message: 'Nome de usuário atualizado com sucesso' });
            }
        });
    }
});

// Rota para buscar configurações públicas (para o frontend)
app.get('/api/configuracoes', (req, res) => {
    db.all('SELECT chave, valor FROM configuracoes WHERE chave IN (?, ?)', 
        ['tempo_entrega', 'tempo_retirada'], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar configurações públicas:', err.message);
            res.status(500).json({ success: false, error: err.message });
        } else {
            const config = {};
            rows.forEach(row => {
                config[row.chave] = row.valor;
            });
            res.json({ success: true, data: config });
        }
    });
});

// Rota para servir arquivos estáticos
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
    console.log(`Admin: http://localhost:${PORT}/admin`);
});

// Fechar conexão com banco ao encerrar aplicação
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Erro ao fechar banco de dados:', err.message);
        } else {
            console.log('Conexão com banco de dados fechada.');
        }
        process.exit(0);
    });
});

