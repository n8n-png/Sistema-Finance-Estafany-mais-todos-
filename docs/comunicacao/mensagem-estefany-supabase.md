# Resposta para a Estefany — "o projeto do Lovable não está no Supabase"

> Contexto: ela logou no supabase.com e vê só dois projetos, nenhum aparenta ser o do painel.
> O projeto que procuramos tem o identificador **`cehpsvuytdriikxtukmb`** (está no `.env` do
> export do Lovable, então é certo que existe).

---

Oi Estefany! Isso é normal, não é erro seu 🙂

Quando o projeto é criado pelo Lovable, o banco costuma nascer dentro da infraestrutura
**deles**, e não na sua conta pessoal do Supabase. Por isso ele não aparece na lista junto
com os seus outros projetos.

O identificador do banco que a gente precisa é este: **`cehpsvuytdriikxtukmb`**

Fiz uma lista do mais rápido para o mais trabalhoso. Provavelmente o passo 1 já resolve.

---

## Passo 1 — Teste de 5 segundos (comece por aqui)

Cole este endereço direto no navegador, já logada na sua conta do Supabase:

```
https://supabase.com/dashboard/project/cehpsvuytdriikxtukmb
```

- **Se abrir o projeto:** ótimo, ele existe na sua conta e só não estava aparecendo na lista.
  Vá em **Settings → Team → Invite member** e me convide como **Owner**
  (`mtorquato1910@gmail.com`).
- **Se der erro, "not found" ou pedir acesso:** siga para o passo 2.

---

## Passo 2 — Confira o segundo projeto pelo identificador, não pelo nome

Reparei que o segundo projeto da sua lista tem o **seu e-mail como nome**
(`estefany.gomes@maistodo...`). Isso é bem típico de projeto criado automaticamente por
ferramenta externa — o nome não ajuda a identificar.

Vale conferir pelo identificador real:

1. Abra esse projeto.
2. Vá em **Settings** (engrenagem, no menu da esquerda) → **General**.
3. Procure o campo **Reference ID** (ou "Project ID").
4. Compare com `cehpsvuytdriikxtukmb`.

Se bater, é ele — pode me convidar como Owner por **Settings → Team**.

---

## Passo 3 — Verifique organização e filtro

Duas coisas escondem projetos na tela que você me mandou:

**a) Organização.** No topo da página existe um seletor de organização. Se a sua conta
participa de mais de uma, cada uma mostra só os projetos dela. Clique nele e veja se
aparece outra organização além da atual.

**b) Filtro de status.** Na sua tela está **"Status: Active, Paused"**. Se o projeto estiver
em outro estado, ele simplesmente não aparece. Clique nesse filtro e marque **todos** os
status disponíveis.

---

## Passo 4 — Pelo próprio Lovable

Se nada acima funcionar, o banco está mesmo do lado do Lovable. Dentro do projeto lá:

1. Procure, no menu do projeto, uma seção chamada **Cloud**, **Backend**, **Database**
   ou **Supabase** (o nome muda conforme a versão).
2. Ou vá em **Settings / Project Settings → Integrations**.

Nessa área costuma existir a opção de abrir o banco ou de **conectar o projeto a uma conta
Supabase própria** — que é exatamente o que a gente quer, porque aí ele passa a aparecer
na sua lista e eu consigo exportar tudo.

> A interface do Lovable muda com frequência. **Se você chegar nessa tela e ficar em dúvida,
> me manda um print que eu te falo onde clicar.** Não clique em nada que fale em
> desconectar, resetar ou excluir o banco.

---

## Não se preocupe: existe um plano B

Se o acesso ao painel do Supabase não sair, a migração **não fica travada**. Eu já tenho no
repositório toda a estrutura do banco (as tabelas, as regras, o histórico de alterações), que
veio junto com a exportação do projeto. O que faltaria são os dados — e esses eu consigo
extrair usando o próprio login do painel, com a sua autorização.

Então: tente os passos acima com calma, e se não der, a gente segue por esse outro caminho.
Nada se perde 👍

---

## Notas para o Matheus (não enviar)

**Diagnóstico.** O projeto `cehpsvuytdriikxtukmb` existe — a URL e a chave `anon` estão no
`.env` do export. O que aconteceu é o padrão do Lovable Cloud: o Supabase é provisionado na
organização do Lovable, não na conta pessoal de quem usa a ferramenta.

**A pista mais forte** é o segundo projeto da lista dela ter o e-mail dela como nome, em
`us-east-2`, plano NANO. É a assinatura de projeto criado por integração automática. Ela
descartou pelo nome; o `Reference ID` em Settings → General é o que decide.

**Plano C — extração via API, se o dashboard não sair.** Viável e suficiente para a migração:

| Item | Situação |
|---|---|
| Schema completo | ✅ Já temos — 25 migrations no repositório |
| Dados das tabelas | ✅ Extraíveis via PostgREST com a `anon key` + login de um usuário admin do painel, respeitando RLS |
| Edge Functions | ✅ Já temos — 8 arquivos no repositório |
| Usuários (`auth.users`) | ❌ Não migram — mas serão recriados de qualquer forma quando entrar o login Google (Story 2.3) |
| Senhas | ❌ Não migram — irrelevante pelo mesmo motivo |

Ou seja, o único item realmente perdido sem o dashboard é a base de usuários, que já estava
prevista para ser refeita. **O acesso ao dashboard continua sendo o caminho preferido** (é
mais rápido, traz tudo de uma vez e permite `pg_dump` fiel), mas a ausência dele não bloqueia
o projeto.

Se for para o Plano C, o script de extração é uma tarefa pequena — me avise que eu escrevo.
