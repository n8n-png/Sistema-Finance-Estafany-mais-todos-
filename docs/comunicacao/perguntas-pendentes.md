# Painel de Crédito PJ — perguntas pendentes

- **Data:** 03/09/2026
- **Para:** Estefany Gomes e Lavínia Resende
- **De:** Matheus Torquato

> Documento para responder direto aqui, como a Estefany sugeriu.
> Podem preencher aos poucos, na ordem que for mais fácil — cada resposta destrava
> um pedaço do trabalho. As perguntas do **Bloco 1** são as que mais seguram a entrega.

---

## Bloco 1 — Urgente

### 1.1 As planilhas originais dos dados ainda existem?

Como não localizamos o banco antigo, vou criar tudo do zero. O código e a estrutura do
sistema estão salvos — isso não se perde. Mas os **dados** que estavam guardados lá, sim:

- Histórico de parcelas pagas (cerca de 7.300 registros)
- Limites dos clientes
- Operações ativas
- Clientes pré-aprovados

**A boa notícia:** o sistema já tem as telas de importação prontas. Se vocês ainda tiverem as
planilhas que usaram para subir esses dados, eu reimporto tudo e nada se perde.

> ⚠️ Me avisem **antes** de eu descartar o projeto antigo. Se as planilhas não existirem,
> vale uma última tentativa de recuperação.

**Resposta:**

- [ ] Sim, temos as planilhas — vou enviar
- [ ] Não temos todas. Faltam: ______________________
- [ ] Não temos nenhuma

---

### 1.2 Como o time da Valora vai entrar no sistema?

A Lavínia confirmou que eles usam **Outlook**, não Google. Isso muda o plano original (que
era login pelo Google). Três caminhos possíveis:

| Opção | Como funciona | Vantagem | Contrapartida |
|---|---|---|---|
| **A** | Login pela conta Microsoft deles | Usam a conta corporativa que já têm; quando alguém sai da Valora, o acesso cai sozinho | Depende do **time de TI da Valora** fazer uma configuração — pode demorar |
| **B** | Usuário e senha criados por nós, com verificação em duas etapas | Não depende de ninguém; posso entregar já | Nós gerenciamos as contas; vocês precisam avisar quando alguém sair de lá |
| **C** | Login por link enviado no e-mail, sem senha | Não tem senha para vazar | Quem tiver acesso à caixa de entrada, entra |

**Recomendação:** começar pela **B** e migrar para a **A** depois. Assim não seguramos a
entrega esperando o TI de outra empresa, e a segurança já fica adequada desde o início.

**Resposta:**

- [ ] Opção A · [ ] Opção B · [ ] Opção C · [ ] Outra: ______________________

---

### 1.3 Lavínia — o que significa "ROD"?

Na sua mensagem sobre armazenamento você escreveu *"seria interessante fazermos esse
armazenamento direto no ROD"*. Não conheço a sigla e ela pode mudar a solução.

**Resposta:**

---

## Bloco 2 — Campos do HubSpot

Identifiquei o funil certo (**MaisTODOS - Comercial Crédito PJ**) e mapeei os campos das
operações. Uma descoberta importante:

> **Várias propriedades do HubSpot foram reaproveitadas de usos antigos** — o nome interno
> ficou de um assunto e o conteúdo hoje é outro. O campo que guarda o **prazo**, por exemplo,
> se chama internamente "cluster atual parceiro local"; o que guarda a **taxa** se chama
> "dias em atraso consignado".
>
> Não é problema — só significa que não dá para adivinhar pelo nome. Por isso as perguntas
> abaixo.

### 2.1 Qual campo tem o valor da operação?

Existem três preenchidos, com valores diferentes entre si: **"Valor do contrato"**,
**"Valor solicitado"** e **"Amount"**.

Qual deles é o valor que vocês consideram o da operação — o que deve aparecer no painel?

**Resposta:**

---

### 2.2 "Prazo total" e "Número de parcelas" são a mesma coisa?

Os dois campos estão preenchidos em todas as operações. Preciso saber qual usar como prazo,
e se o outro significa algo diferente.

**Resposta:**

---

### 2.3 Quais são as opções do campo "Tipo de Produto"?

Preciso que os valores correspondam às linhas de crédito do painel: **QIA**,
**Amor Saúde** e **Visão de Todos**.

**Resposta:**

---

### 2.4 Como a taxa é montada?

No painel a taxa aparece como um texto, tipo `1,2% a.m. + CDI`. No HubSpot existem os campos
**"Valor da Taxa"** e **"Tipo de Taxa"**.

Esses dois bastam para montar o texto, ou tem outra regra?

**Resposta:**

---

### 2.5 Para onde aponta o campo "Link documentos"?

Está preenchido em todas as operações que olhei, apontando para algum endereço. É Google
Drive, SharePoint, outro lugar?

Isso se conecta diretamente com a pergunta 3.1 (armazenamento de documentos).

**Resposta:**

---

### 2.6 O "ID da Operação" (formato `PO…`) é o número que vocês usam no dia a dia?

Se for a referência que a área usa para falar de uma operação, faz sentido ele aparecer no
painel também.

**Resposta:**

---

### 2.7 O que acontece com uma operação marcada como "Negociação perdida"?

Se ela já estiver no painel e for marcada como perdida no HubSpot, o que deve acontecer?

**Resposta:**

- [ ] Sumir do painel
- [ ] Ficar arquivada, visível só se procurar
- [ ] Aparecer com um alerta
- [ ] Outro: ______________________

---

### 2.8 Confirmação das etapas

No HubSpot, **"Formalização" é uma etapa só**. No painel ela é dividida em **três** —
aguardando contrato → contrato emitido → contrato assinado. Essa é justamente a visibilidade
que vocês pediram na reunião.

Quando o painel atualizar o HubSpot de volta, proponho:

| Etapa no painel | Vira, no HubSpot |
|---|---|
| Aguardando contrato | Formalização |
| Contrato emitido | Formalização (sem mudança) |
| Contrato assinado | **Aguardando desembolso** |
| Desembolsado | **Crédito concedido** |

Assim o HubSpot mantém a visão macro para o SLA da esteira, e o detalhe fica no painel.

**Resposta:**

- [ ] Faz sentido, pode seguir
- [ ] Ajustar: ______________________

---

## Bloco 3 — Documentos

### 3.1 Painel e SharePoint — proposta de sequência

Consigo fazer os dois, mas os custos são bem diferentes:

| Destino | Complexidade | O que exige |
|---|---|---|
| **No painel** | Baixa | Funciona assim que o sistema subir |
| **SharePoint** | Alta | Configuração com o TI: registro de aplicativo, permissões e aprovação de administrador |

**Proposta:** entregar o painel primeiro, para vocês já usarem, e o SharePoint na sequência.
Amarrados na mesma entrega, o SharePoint acaba segurando o que já funcionaria.

**Resposta:**

- [ ] Concordamos com a sequência
- [ ] Precisamos dos dois juntos porque: ______________________

### 3.2 Qual site e qual pasta do SharePoint devem receber os arquivos?

**Resposta:**

---

## Bloco 4 — E-mail

### 4.1 Resposta à pergunta da Lavínia sobre o SPAM

> *"Caso a gente opte pela opção A, quanto tempo aproximadamente isso deve levar? Pergunto
> porque recentemente tivemos problemas com os e-mails do HubSpot caindo no SPAM."*

**A opção A é exatamente o que resolve esse problema.**

Sem termo técnico: quando uma ferramenta externa envia usando `@maistodos.com.br`, o servidor
de quem recebe precisa encontrar uma autorização registrada no domínio de vocês dizendo que
aquela ferramenta pode enviar em nome da MaisTODOS. Sem essa autorização, o e-mail parece
falsificado e vai direto para o spam. Foi o que aconteceu com o HubSpot.

**Prazo:**

| Etapa | Tempo |
|---|---|
| Configuração técnica do envio | algumas horas |
| Time de infra adicionar os registros no domínio | **depende da fila deles** — é o gargalo |
| Propagação | minutos a poucas horas |

Ou seja: **horas de trabalho, alguns dias de espera pelo time de infra.**

### 4.2 Sugestão: usar um subdomínio de envio

Recomendo enviar por um endereço tipo `notificacoes.maistodos.com.br` em vez do domínio
principal. Assim, se algum e-mail automático for marcado como spam por alguém, isso não afeta
a reputação do e-mail corporativo de toda a empresa.

Para quem recebe, continua aparecendo `credito.pj@maistodos.com.br` no campo de resposta.

**Resposta:**

- [ ] Pode usar o subdomínio
- [ ] Preferimos o domínio principal
- [ ] Precisamos confirmar com o TI

---

## Bloco 5 — Já resolvido (só para conferência)

Nada a responder aqui — é registro do que já foi definido.

| Item | Situação |
|---|---|
| E-mail remetente | `credito.pj@maistodos.com.br`, autorizado como remetente automático |
| Congelamento do Lovable | 01/09/2026 às 16:42 — **conferido:** o pacote que recebi é posterior a essa data, nada ficou para trás |
| Token do HubSpot | Recebido e funcionando. Funil identificado e campos mapeados |
| Fonte da verdade | HubSpot manda nas etapas comerciais; o painel manda da formalização em diante |
| Quem cria e administra | Estefany é a criadora do projeto e admin do HubSpot |

---

## Pendências que estão com o time de infra (não com vocês)

Só para vocês saberem o que mais está em aberto, caso precisem cobrar internamente:

| Pendência | Com quem |
|---|---|
| Servidor para hospedar o sistema | Victor Betini |
| Backup automático | Victor Betini |
| Endereço do sistema (`credito.maistodos.com.br`) | Victor Betini |
| Registros de domínio para o e-mail | Victor Betini |
| Registro de aplicativo para o SharePoint | TI |
