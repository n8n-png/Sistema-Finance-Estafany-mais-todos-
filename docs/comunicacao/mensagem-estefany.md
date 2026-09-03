# Mensagem para a Estefany — acessos e informações do projeto

> Contexto: pedido único, com 5 itens. Enviar pelo Slack.
> O item 1 e o item 2 são os que destravam o trabalho; os outros três são rápidos.

---

Oi Estefany, tudo bem?

Comecei a migração do painel do Lovable para o sistema próprio da MaisTODOS. Já tirei o
projeto do Lovable e ele está rodando aqui no meu ambiente. Para seguir para a parte de
banco de dados e integrações, preciso de umas coisinhas do lado de vocês. Deixei tudo em
passo a passo para ficar rápido — não deve tomar mais que uns 15 minutos no total 🙂

---

## 1. Acesso ao banco de dados atual (Supabase)

O painel do Lovable guarda os dados num banco chamado **Supabase**. Preciso desses dados
para levar tudo para o banco novo, sem perder nada (histórico de parcelas, usuários,
limites, clientes pré-aprovados).

**O jeito mais simples e mais seguro é você me dar acesso — não precisa me mandar senha nenhuma:**

1. Entre em **https://supabase.com** e faça login com a conta que foi usada no Lovable
   (provavelmente a mesma do Lovable, ou a que criou o projeto).
2. Abra o projeto **`cehpsvuytdriikxtukmb`** (o nome pode aparecer como "mais-todos-finance"
   ou parecido).
3. No menu da esquerda, vá em **Settings** (engrenagem, no rodapé) → **Team**.
4. Clique em **Invite member** (ou "Convidar membro").
5. Digite o meu e-mail: **`mtorquato1910@gmail.com`**
6. Em permissão, escolha **Owner** ou **Administrator** (preciso de permissão de
   administrador só para conseguir exportar o banco inteiro).
7. Clique em **Invite**.

Pronto — eu recebo o convite por e-mail, aceito e faço a exportação por conta própria.

> ⚠️ **Por favor não me mande senha por Slack, e-mail ou WhatsApp.** O convite acima é mais
> seguro e você pode remover meu acesso a qualquer momento depois que a migração terminar.

**Se por algum motivo o convite não funcionar**, o plano B é você exportar as tabelas:
no mesmo projeto, vá em **Table Editor** (menu da esquerda) e, para cada tabela da lista,
clique nos três pontinhos ao lado do nome → **Export data** → **Download as CSV**.
São 18 tabelas, então é bem mais trabalhoso — por isso o convite é o caminho preferido.

---

## 2. Chave de integração do HubSpot

Para o painel espelhar o funil do HubSpot automaticamente, preciso de um **aplicativo privado**
criado aí dentro. Você já é admin, então consegue fazer direto:

1. No HubSpot, clique na **engrenagem** (Configurações), no topo da tela.
2. No menu da esquerda, vá em **Integrações** → **Aplicativos privados**.
3. Clique em **Criar aplicativo privado**.
4. Na aba **Informações básicas**:
   - Nome: `Painel Crédito PJ`
   - Descrição: `Integração do painel de Crédito PJ com o funil de operações`
5. Vá na aba **Escopos** e marque estas permissões:
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`
   - `crm.objects.companies.read`
   - `crm.objects.contacts.read`
   - `crm.schemas.deals.read`

   *(dica: use a caixa de busca da própria tela para achar cada uma pelo nome)*
6. Clique em **Criar aplicativo** no topo direito e confirme.
7. Na tela seguinte vai aparecer o **token de acesso**. Clique em **Mostrar token** e
   depois em **Copiar**.

**Como me mandar esse token com segurança:** me chame no Slack em **mensagem direta**
(não no canal do grupo), mande o token, e **apague a mensagem** depois que eu confirmar
que recebi. Se vocês tiverem um cofre de senhas corporativo (1Password, Bitwarden, LastPass),
melhor ainda — pode compartilhar por lá.

> Com esse token eu consigo puxar sozinho o resto da informação que preciso: o ID do pipeline,
> os nomes e IDs de cada etapa e a lista de propriedades dos negócios. Assim você não precisa
> caçar nada disso na mão 👍

---

## 3. Qual e-mail vai disparar as notificações para o fundo

Na reunião você mencionou o grupo de e-mail **Crédito PJ**. Preciso confirmar duas coisas:

- **Qual é o endereço exato?** (ex: `creditopj@maistodos.com.br`)
- **Esse endereço pode ser usado como remetente automático?** Ou seja, os e-mails de
  "a operação mudou de etapa" sairiam com esse endereço no campo "De:".

Existem dois jeitos de fazer isso funcionar, e a escolha muda um pouco o pedido:

- **Opção A (recomendada):** eu configuro um serviço de envio transacional usando o domínio
  `maistodos.com.br`. Nesse caso preciso que o time de TI adicione dois registros de DNS
  (SPF e DKIM). Vantagem: e-mail nunca cai em spam e não depende de senha de ninguém.
- **Opção B:** envio pela própria conta do Google Workspace do grupo Crédito PJ. Nesse caso
  preciso que alguém do TI libere o acesso de aplicativo para essa conta.

Me diz qual das duas é mais fácil de aprovar aí dentro que eu sigo por esse caminho.

---

## 4. Onde os documentos da operação vão ficar guardados

No protótipo existe a ideia de criar automaticamente uma pasta para cada operação quando ela
entra em "Recolhimento de documentação". Preciso saber onde essa pasta deve nascer:

- **Google Drive** (drive compartilhado do time)?
- **SharePoint / OneDrive**?
- Ou vocês preferem que os arquivos fiquem guardados **dentro do próprio painel**?

Se for Drive ou SharePoint, preciso que você crie a **pasta raiz** onde tudo vai ficar
(ex: "Crédito PJ — Operações") e me dê acesso de edição nela. As subpastas de cada
operação o sistema cria sozinho depois.

---

## 5. Duas confirmações rápidas

**a) Congelar o Lovable.** Como conversamos, a partir da migração o caminho é só de ida:
o que for alterado no Lovable **não chega** no sistema novo. Então, a partir de agora, tudo
que vocês quiserem mudar me mandem pela nossa esteira (o HTML + a documentação de alteração)
em vez de editar lá. Pode confirmar comigo a data em que vocês param de mexer no Lovable?

**b) Acesso do time da Valora.** Como eles são externos e não têm conta MaisTODOS, preciso
definir com você e a Lavínia como eles entram no sistema. Duas opções:

- **Login pelo Google da Valora** — eles usam a conta corporativa deles, eu libero só o
  domínio da Valora. Não tem senha para gerenciar.
- **Usuário e senha criados por nós, com autenticação em dois fatores obrigatória.**

A primeira é mais segura e dá menos trabalho de manutenção, mas depende do time deles usar
Google Workspace. Você consegue confirmar isso com eles?

---

Qualquer dúvida em qualquer um dos passos, me chama que eu faço junto com você numa call
de 10 minutos. Obrigado! 🙏
