# Relatório de QA — 06/09/2026

Auditoria de qualidade antes da hospedagem. O objetivo era deixar o sistema pronto para subir,
sem depender de banco nem de infraestrutura.

---

## 1. Achados

### 🔴 A1 — Falha silenciosa no carregamento do funil

**O mais grave da auditoria.**

```tsx
useEffect(() => {
  listarOperacoes().then(setOperacoes);   // sem catch
}, []);
```

Se a busca falhasse — banco fora do ar, sessão expirada, erro de rede — a promessa era
rejeitada sem tratamento e a tela mostrava **um quadro vazio**.

Num painel de esteira, quadro vazio não se lê como "deu erro". Lê-se como **"não há nada
pendente"**. Alguém poderia encerrar o dia achando que a fila estava limpa enquanto havia
operações estouradas de SLA esperando.

**Corrigido:** três estados distintos — carregando, erro (com o motivo e botão de tentar de
novo) e vazio de verdade. O texto do erro diz explicitamente que o quadro está vazio *por
causa da falha*, não por ausência de operações.

### 🔴 A2 — Hooks declarados depois de retorno antecipado

Dois `useState` do `OperacaoModal` estavam **abaixo** de um `if (!op) return null`.

O React associa estado à ordem de chamada dos hooks. Se a quantidade varia entre
renderizações, o estado passa a ser atribuído ao hook errado. É falha que não quebra na hora:
quebra depois, de forma difícil de reproduzir.

Introduzido por mim nesta mesma semana, ao declarar os estados junto das funções que os usam.

**Corrigido:** todos os hooks agrupados antes de qualquer retorno antecipado, com comentário
explicando o motivo.

### 🟡 A3 — Import quebrava fora do navegador

`client.ts` referenciava `localStorage` diretamente no nível do módulo. Qualquer contexto sem
DOM — teste, script de linha de comando, renderização no servidor — falhava **no import**,
antes de qualquer código rodar.

Descoberto porque o primeiro teste de `documentos.ts` não conseguiu sequer carregar o módulo.

**Corrigido:** `typeof window === "undefined" ? undefined : window.localStorage`. Sem storage,
o supabase-js usa memória, que é o comportamento correto nesses casos.

### 🟡 A4 — `..` sobrevivia no nome do arquivo

`nomeSeguro("../../../etc/passwd")` produzia `...-..-..-..-etc-passwd`.

Não chegava a ser travessia de diretório — as barras viram hífen, então o arquivo continuava
dentro da pasta da operação, que é o que garante a permissão. Mas era fraqueza sem motivo.

**Corrigido:** a extensão é separada antes da limpeza e o resto perde todos os pontos. Efeito
colateral bom: `boleto.pdf.exe` vira `boleto-pdf.exe` — o que é executável **parece**
executável na listagem.

### 🟢 A5 — Mocks visíveis ao usuário

Três funcionalidades ainda eram simulação, e uma delas escrevia "(mock)" na tela:

| Era | Ficou |
|---|---|
| `baixarDocumentacaoZip` — só devolvia um nome | Zip real, montado no navegador |
| `anexarComprovante` — devolvia o nome recebido | Upload real para o bucket |
| "Anexado (mock): ..." na tela | Link que abre o comprovante |

### 🟢 A6 — Bundle de 1,8 MB

Todo o código num arquivo só. Em conexão ruim, é a diferença entre abrir o painel e desistir.

**Corrigido** com separação por biblioteca:

| | Antes | Depois |
|---|---|---|
| Bundle principal | 1.811 kB (548 kB comprimido) | **417 kB (123 kB comprimido)** |

Redução de **77%**. As bibliotecas pesadas (gráficos, geração de PDF/DOCX, Supabase) foram
para pacotes próprios: mudam pouco, então o navegador as reaproveita entre publicações
enquanto só o código da aplicação é rebaixado.

---

## 2. Cobertura de testes

**52 testes automatizados**, todos passando.

| Área | O que cobre |
|---|---|
| ID da operação | Os **5 exemplos reais** da planilha da Lavínia, colisão conhecida, dados faltando |
| Serial de data do Excel | Conversão e origem do calendário |
| Taxa | Rótulo pré/pós, normalização de "PRÉ/PÓS" |
| Valores | Fórmula bruto − TAC, tolerância de centavo, **o erro real de 03/09** |
| Linha de crédito | Mapeamento do HubSpot, produtos de outro fundo ignorados |
| Nome de arquivo | Unicidade, acento, extensão dupla, tentativa de travessia |
| Limites de upload | Tamanho batendo com o bucket, tipos aceitos e recusados |

Dois testes merecem destaque por documentarem comportamento perigoso em vez de escondê-lo:

- **Colisão de ID** — a regra atual pode gerar o mesmo código para operações diferentes. O
  teste afirma isso explicitamente, para que ninguém "corrija" achando que é bug.
- **O erro da Valora** — `houveDivergencia(100000, 2040.82)` reproduz o depósito errado que
  aconteceu de verdade.

---

## 3. Estado dos fluxos

| Fluxo | Situação |
|---|---|
| Login (senha, Google, MFA) | Implementado |
| Redefinição de senha | Corrigida — não é mais login automático |
| Quadro do funil | Carregando, erro e vazio tratados |
| Modal da operação | Todos os botões ligados a ação real |
| Checklist com anexos | Envio múltiplo, descrição, abertura, remoção |
| Comprovante de desembolso | Upload real, com conferência de valor |
| Baixar tudo (.zip) | Real, montado no navegador |
| Sync HubSpot (ida e volta) | Implementado |
| Notificação por e-mail | Implementada, em modo simulado até a chave existir |

**Único fluxo ainda sem implementação:** sincronização de assinaturas da Flixsign — depende
de credencial que é do fundo.

---

## 4. O que esta auditoria NÃO conseguiu verificar

Vale ser explícito, porque a lista é grande e importa:

| Não verificado | Por quê |
|---|---|
| As 33 migrations executam | Sem banco. Só a sintaxe foi validada |
| Triggers disparam corretamente | Idem |
| RLS bloqueia o que deve bloquear | Idem — **é a verificação mais importante que falta** |
| Upload chega ao bucket | Sem Storage |
| Sync traz os dados certos do HubSpot | Sem banco para gravar |
| Fluxo completo no navegador | Sem ambiente publicado |

Sintaxe validada, tipo checado e teste unitário passando **não são** o mesmo que
comportamento verificado. O roteiro abaixo existe para o dia em que houver ambiente.

---

## 5. Roteiro de homologação

Para a primeira subida. A ordem importa: cada etapa só faz sentido se a anterior passou.

### Etapa 1 — Banco

1. Executar as migrations em ordem. **Esperar erros**: são 33 nunca executadas.
2. Conferir se as 6 etapas do funil existem em `operacoes_formalizacao_sla`.
3. Conferir se o modelo de checklist tem 9 itens para QIA e 6 para Amor Saúde.

### Etapa 2 — Permissão (a mais importante)

Crie três usuários de teste e confirme, **entrando com cada um**:

| Usuário | Deve ver | NÃO pode ver |
|---|---|---|
| Administrador | Tudo | — |
| Interno (com `operacoes_valora`) | Todas as etapas | — |
| **Externo (fundo)**, com `user_etapas_acesso` só em `analise` | Só operações em Análise fornecedor | Limites, parcelas, pré-aprovados, operações de outras etapas |

> Teste o usuário externo **chamando a API direto**, não só pela tela. A interface esconde;
> o que precisa bloquear é o banco. Se ele conseguir ler uma operação de outra etapa pela
> API, a RLS está errada — e é exatamente esse o cenário que motivou a Story 3.2.

### Etapa 3 — Funil

4. Criar uma operação e conferir que sobrevive ao F5.
5. Mover de etapa e conferir se o **histórico registrou sozinho** (trigger).
6. Tentar editar o histórico — deve ser impossível, inclusive para administrador.

### Etapa 4 — Documentos

7. Anexar 3 arquivos no mesmo item, com descrições diferentes.
8. Conferir que o item ficou marcado sozinho.
9. Remover um anexo e conferir que os outros dois permaneceram.
10. Remover todos e conferir que o item voltou a pendente.
11. Baixar tudo em .zip e conferir se os nomes saíram como as descrições.

### Etapa 5 — Desembolso

12. Informar um valor **diferente** do previsto e conferir se o alerta aparece **antes** de
    confirmar.
13. Confirmar e verificar se a divergência entrou no histórico.

### Etapa 6 — HubSpot

14. Rodar o sync e conferir o resumo (`criados`, `ignorados`, `erros`).
15. **Conferir os valores de uma operação importada contra a tela do HubSpot.** Os nomes
    internos das propriedades enganam — é aqui que um erro de mapeamento aparece.
16. Mover uma operação para "contrato assinado" e conferir se o HubSpot foi atualizado.
17. Rodar o sync de entrada de novo e confirmar que **não puxou a etapa de volta**.

### Etapa 7 — Segurança

18. Verificar os cabeçalhos em https://securityheaders.com/ — meta nota **A**.
19. Conferir se o `connect-src` do CSP inclui o domínio real do Supabase.
20. Testar a redefinição de senha ponta a ponta: o link **não** pode dar acesso ao painel.

---

## 6. Dívida conhecida

| Item | Avaliação |
|---|---|
| 36 erros de lint (`any` herdados do Lovable) | Não bloqueiam nada. Reduzem aos poucos, ao tocar em cada arquivo |
| React Router v6 → v7 | Vulnerabilidade de baixa exposição — o app não constrói rota a partir de entrada do usuário |
| `vite`/`esbuild` | Afetam só o servidor de desenvolvimento; produção serve estáticos |
| Testes de componente | Só há testes de lógica. Componentes ainda dependem de verificação manual |
