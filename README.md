# Loja MZ

Plataforma de gestão de lojas em Moçambique.

## Tecnologia

- Cloudflare Workers
- Cloudflare D1
- HTML, CSS e JavaScript
- Progressive Web App (PWA)

## Funcionalidades da versão inicial

- Registo e autenticação
- Produtos e stock
- Registo de vendas
- Clientes
- Despesas
- Painel de indicadores
- Instalação PWA

## Configuração

1. Criar uma base de dados D1 chamada loja-mz-db.
2. Copiar o ID real da base de dados para wrangler.toml.
3. Executar schema.sql na base de dados.
4. Publicar o Worker através do Wrangler.
5. Testar o endpoint /api/health.
6. Testar registo, login e operações.

## Moeda

Metical moçambicano (MZN).

## Importante

Esta versão é uma base de implementação.
Antes de utilização comercial, devem ser concluídos e testados
os controlos de segurança, as vendas transacionais, os planos,
a administração e a confirmação de pagamentos.

## Licença

Todos os direitos reservados ao proprietário do projecto.
