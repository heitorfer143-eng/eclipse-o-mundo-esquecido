# Eclipse Agent Bridge

Backend privado para enviar tarefas ao Manus API v2 sem expor a chave no navegador.

## Railway

Configure o serviço com Root Directory `/bridge`, Start Command `npm start` e Healthcheck Path `/health`.

Variáveis obrigatórias:
- `MANUS_API_KEY`: chave criada em Manus Developers. Nunca coloque no GitHub.
- `ECLIPSE_BRIDGE_TOKEN`: segredo forte e exclusivo para autorizar chamadas do painel.
- `ALLOWED_ORIGIN`: `https://heitorfer143-eng.github.io`

Variável opcional:
- `MANUS_PROJECT_ID`: ID do projeto Manus com as instruções e conectores padrão para o Eclipse.

O conector GitHub precisa estar habilitado na conta/projeto Manus para que o agente acesse o repositório.

## Rotas

- `GET /health`: status sem revelar segredos.
- `POST /api/manus/tasks`: cria tarefa. JSON: `{"message":"...","title":"...","agent_profile":"standard"}`
- `GET /api/manus/tasks/:taskId/messages`: consulta mensagens e progresso.
- `POST /api/manus/tasks/:taskId/messages`: envia continuação. JSON: `{"message":"..."}`

Rotas privadas exigem o header `x-eclipse-bridge-token`.

## Segurança

- A chave Manus fica somente no backend Railway.
- O token do bridge não deve ser commitado nem embutido no bundle público.
- Tarefas são privadas por padrão.
- O backend aceita CORS somente da origem configurada.
- A integração não faz merge automático nem concede acesso de escrita por si só; permissões dependem do conector GitHub configurado no Manus.
