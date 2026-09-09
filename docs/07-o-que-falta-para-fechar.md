# O que falta para fechar o sistema

- **Data:** 06/09/2026
- **Objetivo:** consolidar tudo que ainda depende de terceiros, na ordem em que desbloqueia

---

## 1. O caminho crítico

Uma coisa segura todas as outras:

```
Servidor de pé (Victor)
   └── banco criado
        ├── migrations executadas de verdade  ← hoje só têm sintaxe validada
        ├── sync do HubSpot testado
        ├── anexos funcionando
        └── sistema publicado e usável
```

Tudo que foi construído até aqui — 33 migrations, 4 edge functions, funil, anexos, segurança,
sync — **nunca rodou**. Não é possível validar comportamento sem banco. Enquanto o servidor
não sai, o projeto acumula código não verificado, e cada dia a mais aumenta o volume que a
primeira execução vai ter que atravessar de uma vez.

**Se houver uma única coisa para cobrar esta semana, é o servidor.**

---

## 2. Pedidos — Victor Betini (infraestrutura)

| # | O que | Desbloqueia | Urgência |
|---|---|---|---|
| V1 | **VPS** — separada, de preferência. A atual tem ~5 GB livres dividida com Hub e Faturamento em produção | Tudo | 🔴 Máxima |
| V2 | **Bucket S3 + credencial** para backup | Publicar com segurança | 🔴 Alta |
| V3 | **DNS** de `credito.maistodos.com.br` (ou provisório) | Acesso do time | 🟡 Média |
| V4 | **DNS de envio** (SPF, DKIM, DMARC) para `notificacoes.maistodos.com.br` | E-mail automático | 🟡 Média |
| V5 | Confirmar o **IP real da VPS** — `187.77.59.57` parece IP residencial, não de servidor | Configurar acesso | 🟢 Rápido |

> V5 é de 10 segundos: `curl -s ifconfig.me` de dentro da VPS. Se o IP estiver errado e for
> usado em alguma liberação, nada conecta e a causa é difícil de achar.

---

## 3. Pedidos — Estefany

| # | O que | Desbloqueia | Urgência |
|---|---|---|---|
| E1 | **Usuário administrador no painel do Lovable** | Resgate de todo o histórico | 🔴 Com prazo |
| E2 | **Credencial de serviço da Flixsign** (a conta é do fundo) | Integração de assinatura | 🟡 Média |
| E3 | **Token de integração do Notion** — precisa de alguém N2 | OKRs na tela inicial | 🟢 Baixa |
| E4 | Confirmar o **endereço de envio** com o TI | E-mail automático | 🟡 Média |

> **E1 é o único item do projeto com prazo real.** Sem as planilhas originais, o banco do
> Lovable é a única cópia do histórico da área. Projetos gratuitos do Supabase pausam por
> inatividade, e ninguém sabe quem controla a organização onde ele vive. Depois que fechar,
> não tem de onde recuperar.

---

## 4. Pedidos — Lavínia

| # | O que | Desbloqueia | Urgência |
|---|---|---|---|
| L1 | **Formato do ID da operação**: manter o atual ou adotar o de 20 caracteres da própria planilha | Geração automática do ID | 🟡 Média |
| L2 | **Como o `envelopeId` da Flixsign chega ao painel** — digitado, vindo do fundo, outro caminho | Integração de assinatura | 🟡 Média |
| L3 | O que significa **"FUMAÇA"** como tipo de operação | Completar a regra do ID | 🟢 Baixa |
| L4 | Se o **valor efetivamente depositado deve voltar ao HubSpot** | Sync de volta | 🟢 Baixa |

Sobre L1: a função já está implementada e testada no formato atual (validada contra os 5
exemplos reais). Se a escolha for o formato novo, muda o corpo de uma função — os testes
ficam e ganham casos.

---

## 5. O que já está costurado

Para dimensionar o que resta, o que já existe:

| Área | Situação |
|---|---|
| **Funil de formalização** | Persistido, com histórico auditável por trigger |
| **Permissão por etapa** | No banco, não só na tela — é o que permite dar acesso ao fundo |
| **Valores da operação** | Bruto, TAC e líquido separados, com alerta de divergência no depósito |
| **Documentos** | Vários por item, cada um identificado, em bucket privado com URL expirável |
| **Sync HubSpot** | Nos dois sentidos, com três camadas contra loop |
| **Autenticação** | Senha endurecida, redefinição corrigida, segundo fator, login Google |
| **Segurança** | 8 functions autenticadas, RLS endurecida, conformidade com o padrão da TI |
| **Regras de negócio** | Taxa, valores, ID e linha de crédito, com 38 testes |
| **Esteira de evolução** | Pacote de contexto gerado do próprio código |
| **Deploy** | Dockerfile, nginx com CSP, procedimento documentado |

**Nada disso foi executado.** É a ressalva que atravessa o projeto inteiro.

---

## 6. Sequência sugerida

1. **Cobrar o servidor** (V1). Sem isso, o resto rende pouco.
2. **Cobrar o acesso ao Lovable** (E1) em paralelo — é o único com risco de perda permanente.
3. Com o servidor: subir o banco, **executar as 33 migrations**, corrigir o que aparecer.
4. Rodar o **sync do HubSpot** com acompanhamento — conferir se as propriedades trazem o
   esperado (os nomes internos enganam).
5. Publicar em domínio provisório e **homologar com a Estefany e a Lavínia**.
6. Só então: Flixsign, Notion, e-mail real.

Os itens 4 a 6 dependem do 3, que depende do 1. Por isso o servidor é o pedido único.

---

## 7. O que dá para fazer enquanto isso

Pouco, e nada essencial. O que sobrou não depende de ninguém, mas também não destrava nada:

- Geração do `.zip` no download em lote de documentos
- Migração do React Router v6 → v7 (vulnerabilidade de baixa exposição)
- Redução do tamanho do bundle (1,8 MB — precisa de `manualChunks` antes de produção)
- Roteiro de homologação para a primeira subida

O mais útil dos quatro é o **roteiro de homologação**: a sequência de verificações da primeira
execução, na ordem certa, com o que conferir em cada etapa. Isso encurta o dia em que o
servidor finalmente sair.
