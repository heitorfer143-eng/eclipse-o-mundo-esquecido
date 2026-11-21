# Integração Manus via GitHub Actions (sem Railway)

## Ativação única

1. No repositório, abra **Settings → Secrets and variables → Actions → New repository secret**.
2. Nome: `MANUS_API_KEY`.
3. Valor: sua chave Manus API. Salve sem publicar no chat, em issue, arquivo ou commit.
4. No Manus, conecte/autorize o conector GitHub para este repositório.
5. Confirme que GitHub Actions está habilitado no repositório.

## Enviar uma tarefa

Crie uma issue neste repositório:
- Título começando com `[MANUS]`, por exemplo `[MANUS] Corrigir escala dos personagens`.
- Descreva o trabalho no corpo da issue.

A automação só executa issues abertas pelo proprietário do repositório. Ela cria uma tarefa privada no Manus, acompanha o status e publica o retorno como comentário na issue.

## Segurança e limites

- A chave Manus fica em GitHub Actions Secrets; nunca no site Pages ou no código.
- A automação usa o GitHub Actions, sem Railway ou servidor permanente.
- O Manus precisa ter o conector GitHub autorizado e com acesso ao repositório para editar arquivos.
- A automação não aprova nem faz merge automático de PRs.
- Cada execução acompanha a tarefa por até 12 minutos; tarefas mais longas continuam acessíveis pelo link do Manus publicado na issue.
- GitHub Actions tem limites de minutos e concorrência conforme o plano e a visibilidade do repositório.
