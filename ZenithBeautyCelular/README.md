# Zenith Beauty Studio

Sistema acadêmico de agenda e gestão de serviços para salão de beleza. A interface foi evoluída a partir do protótipo visual inicial do projeto; esta versão acrescenta uma API e persistência em SQLite.

## Funcionalidades

- Painel com métricas de agenda do dia e receita de serviços concluídos.
- Cadastro, edição e exclusão de serviços, com preço, duração e descrição.
- Cadastro de agendamentos com cliente, telefone, serviço, data e hora.
- Bloqueio de horário já ocupado e rejeição de datas passadas.
- Alteração de status entre Agendado, Concluído e Cancelado.
- Lista de clientes derivada dos agendamentos e busca nas telas.
- Persistência em banco SQLite no arquivo `data/zenith.sqlite`.
- Dados iniciais de demonstração e opção de restauração.

## Requisitos e execução

Requer Node.js 22 ou superior e npm.

```bash
npm install
npm run dev
```

Abra o endereço exibido pelo Vite (normalmente `http://localhost:5173`). O comando inicia em paralelo a interface e a API local na porta 3001. Para iniciar apenas a API: `npm run api`. O banco será criado automaticamente em `data/zenith.sqlite`.

Para compilar a interface: `npm run build`.

## API principal

- `GET /api/health` — verificação do servidor.
- `GET /api/bootstrap` — serviços e agendamentos iniciais para a interface.
- `POST /api/services` e `PUT /api/services/:id` — criar e editar serviço.
- `DELETE /api/services/:id` — excluir serviço sem agendamento ativo.
- `POST /api/appointments` — criar agendamento com validação de conflito.
- `PATCH /api/appointments/:id` — atualizar status.
- `POST /api/reset` — restaurar dados de demonstração.

## Limites importantes

Este é um MVP acadêmico para execução local, não um sistema pronto para operação comercial na internet. Ainda não há autenticação/autorização de usuários, proteção contra abuso, política de privacidade, backups automatizados, testes automatizados ou implantação. Não use dados pessoais reais. Antes de publicar ou utilizar com clientes, é necessário implementar autenticação segura, validação e proteção de API, HTTPS, backups e requisitos legais aplicáveis.

## Como apresentar

Demonstre o cadastro de serviço, a criação de um agendamento, a tentativa de repetir o mesmo horário, a mudança do status para concluído e a persistência após atualizar a página. Explique que o primeiro material era um protótipo visual e que esta versão adiciona lógica e persistência local em SQLite; não descreva o MVP como serviço online nem como sistema com login seguro.
