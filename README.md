# Cardápio Online - Oppa Bier

Sistema completo de cardápio online para a lanchonete Oppa Bier, desenvolvido em Node.js com Express.js.

## 🚀 Deploy na Vercel

### Pré-requisitos
- Conta na [Vercel](https://vercel.com)
- Node.js 18+ instalado localmente (para testes)

### Instruções de Deploy

1. **Faça upload do projeto**
   - Extraia o arquivo ZIP
   - Faça upload para seu repositório GitHub ou GitLab

2. **Conecte à Vercel**
   - Acesse [vercel.com](https://vercel.com)
   - Conecte seu repositório
   - Importe o projeto

3. **Configurações automáticas**
   - A Vercel detectará automaticamente que é um projeto Node.js
   - O arquivo `vercel.json` já está configurado
   - As dependências serão instaladas automaticamente

4. **Deploy**
   - Clique em "Deploy"
   - Aguarde o processo de build
   - Sua aplicação estará disponível na URL fornecida

### Funcionalidades

#### 🍔 Cardápio Público
- Interface responsiva e moderna
- 78 produtos organizados em 16 categorias
- Filtros dinâmicos por categoria
- Produtos em destaque
- Design otimizado para mobile

#### ⚙️ Painel Administrativo
- Sistema de login seguro (usuário: admin, senha: admin123)
- Gerenciamento completo de categorias (CRUD)
- Gerenciamento completo de produtos (CRUD)
- Upload de imagens para produtos
- Configurações de tempo de entrega/retirada
- Alteração de usuário e senha

### Tecnologias Utilizadas
- **Backend:** Node.js + Express.js
- **Banco de Dados:** SQLite
- **Frontend:** HTML5 + CSS3 + JavaScript
- **Autenticação:** JWT + bcrypt
- **Upload:** Multer

### Estrutura do Projeto
```
oppabier-cardapio/
├── server.js          # Servidor principal
├── database.db        # Banco SQLite com dados
├── package.json       # Dependências e scripts
├── vercel.json        # Configuração da Vercel
├── public/            # Arquivos estáticos
│   ├── index.html     # Cardápio público
│   ├── login.html     # Tela de login
│   ├── admin.html     # Painel administrativo
│   ├── styles.css     # Estilos principais
│   ├── uploads/       # Imagens dos produtos
│   └── ...
└── README.md          # Este arquivo
```

### Configurações Importantes

#### Variáveis de Ambiente (opcional)
- `JWT_SECRET`: Chave secreta para JWT (padrão: 'oppa-bier-secret-key')
- `PORT`: Porta do servidor (padrão: 3000)

#### URLs Importantes
- `/` - Cardápio público
- `/login.html` - Login administrativo
- `/admin.html` - Painel administrativo (requer login)

### Suporte
Para dúvidas ou problemas, verifique:
1. Se todas as dependências foram instaladas
2. Se o arquivo `database.db` está presente
3. Se as configurações do `vercel.json` estão corretas

© 2024 Oppa Bier. Todos os direitos reservados.

