# Mensagem para o Victor Betini — infraestrutura do Painel de Crédito PJ

> Contexto: técnico, direto. Enviar pelo Slack.
> Antes de enviar: confirmar se `187.77.59.57` é mesmo o IP público da VPS Hostinger
> (essa faixa é de banda larga residencial brasileira — pode ser IP de estação de trabalho,
> não do servidor). Rodar `curl -s ifconfig.me` dentro da VPS para ter o número certo.

---

Fala Victor, tudo certo?

Estou tirando do Lovable o Painel de Crédito PJ da área da Estefany e transformando em
aplicação própria. Vai precisar de banco e de deploy, e antes de escolher o desenho eu
queria alinhar contigo, porque tem um detalhe que muda tudo.

## O contexto técnico

A aplicação é React/Vite no front e **Supabase** no back — não é só banco, é a stack inteira:
Postgres + autenticação (GoTrue) + API REST (PostgREST) + Storage + Edge Functions em Deno,
com toda a política de permissão implementada em **RLS** dentro do Postgres. Reescrever isso
para um Postgres puro significaria jogar fora a autenticação e as 72 policies já prontas,
então a intenção é subir a stack Supabase self-hosted no Dokploy.

## O ponto que muda o desenho

Levantei o ambiente e vi que **o Dokploy está numa VPS Hostinger, não na AWS**. Isso tira
VPC peering e security group interno da mesa, e some com isso a forma "natural" de falar
com um RDS.

Além disso — e esse é o problema maior — **o Supabase self-hosted exige extensões que o RDS
não oferece**: `pgjwt`, `pg_net`, `pgsodium`, `pg_graphql` e o `supabase_vault`. Várias delas
precisam de superuser, que o RDS não dá. Ou seja, a combinação "Supabase self-hosted + RDS"
provavelmente não fecha, independente da rede.

## O que eu proponho

**Postgres em container no próprio Dokploy, junto com o resto da stack Supabase, e backup
automatizado para um bucket S3 na AWS.** O dado continua em infraestrutura da MaisTODOS,
o backup fica na AWS, e a gente não esbarra nem em rede nem em extensão. Se o time de
segurança exigir que o dado more no RDS, aí eu preciso repensar a arquitetura da aplicação
inteira — e isso é outro projeto.

Mas antes de eu seguir por esse caminho, preciso de quatro respostas tuas:

### 1. Máquina
A VPS atual tem ~5 GB de RAM livres e já roda o Hub P&C e o Faturamento em produção.
A stack Supabase completa come 3–4 GB em idle. Dá para empilhar, mas fica com pouca folga —
se estourar, o OOM killer derruba qualquer um dos três, inclusive os que já estão em produção.

**Dá para provisionar uma VPS separada para este projeto, ou é para empilhar nesse host mesmo?**
Se for empilhar, eu subo com o módulo de analytics (Logflare/vector) desabilitado, que é o
componente mais pesado e o menos essencial — mas continuo achando arriscado.

### 2. RDS — ainda faz sentido?
Se mesmo assim vocês quiserem o dado no RDS, preciso saber:
- É **RDS ou Aurora**? Qual versão do Postgres? Qual **região**?
- Vocês aceitariam **publicly accessible** com security group travado só no IP da VPS
  (+ `rds.force_ssl=1`), ou o padrão de segurança exige **VPN site-to-site**?
- **Qual a latência** da VPS até o endpoint do RDS? Se a VPS estiver num datacenter fora do
  Brasil e o RDS em `sa-east-1`, cada query vira ~200 ms e a aplicação fica inviável.
  Um `ping`/`psql` de dentro do host resolve essa em 10 segundos.

### 3. Backup
Vi que o Dokploy **não tem nenhum destino S3 configurado** — ou seja, nada nesse host está
com backup automatizado hoje, nem o Hub nem o Faturamento. Consegue disponibilizar um bucket
S3 + credencial IAM (só `PutObject`/`ListBucket` no prefixo) para eu configurar o backup
diário? Aproveito e configuro para os outros serviços também, se você quiser.

### 4. Domínio e padrão de segurança
- A área pediu o subdomínio **`credito.maistodos.com.br`**. Quem controla o DNS e qual é o
  processo para solicitar? Enquanto não sai, publico num subdomínio provisório.
- Existe um **documento de padrão de segurança** da TI que eu deva seguir antes de expor esse
  painel na internet? Pergunto porque ele vai ter usuário externo (o time do fundo, a Valora)
  acessando, e eu já mapeei pontos do protótipo que preciso fechar antes de publicar.

Qualquer coisa a gente marca 20 minutos e eu te mostro a arquitetura na tela.
Valeu!
