# 🛡️ SeguraPro

O **SeguraPro** é um sistema completo e baseado em nuvem de gestão de clientes (CRM) desenvolvido especificamente para **corretoras de seguros**. 

O objetivo principal da plataforma é modernizar e centralizar o fluxo de trabalho dos corretores, oferecendo um ambiente seguro, altamente escalável e de fácil navegação para o gerenciamento de apólices, dados de segurados e controle estrito de acessos da equipe.

## 🚀 Tecnologias Utilizadas

O sistema foi construído no formato Full-Stack, utilizando tecnologias modernas para garantir performance e manutenibilidade:

**Front-end:**
- [React](https://reactjs.org/) - Arquitetura modular
- [TypeScript](https://www.typescriptlang.org/) - Tipagem estática
- [Tailwind CSS](https://tailwindcss.com/) - Estilização ágil e responsiva

**Back-end:**
- [Node.js](https://nodejs.org/) - Ambiente de execução
- [Prisma (ORM)](https://www.prisma.io/) - Modelagem de banco de dados e validações

## 🎯 Dores Sanadas 

O desenvolvimento do SeguraPro foi focado em resolver problemas reais do dia a dia de corretoras:
- **Fim da Desorganização de Dados:** Substitui múltiplas planilhas, pastas físicas e sistemas legados por uma única fonte da verdade, onde o cliente e seus seguros estão sempre conectados.
- **Segurança de Dados Comprometida:** Previne o vazamento ou alteração não autorizada de dados sensíveis de clientes por meio de hierarquias de permissão estritas.
- **Microgerenciamento de Equipes:** Facilita a delegação de operações diárias para a equipe de funcionários, permitindo que gestores e SuperAdmins foquem na estratégia e na supervisão por meio de acessos privilegiados.

## ✨ Principais Funcionalidades

- **Controle de Acesso Baseado em Cargos (RBAC):** O sistema possui três níveis de autorização independentes:
  - `SuperAdmins`: Acesso irrestrito a todas as configurações e gestão global da corretora.
  - `Gestores`: Controle sobre as operações táticas, relatórios e supervisão direta dos funcionários.
  - `Funcionários`: Acesso seguro e restrito apenas para a operação diária (cadastros e consultas de rotina).
- **Gestão Avançada de Clientes:** CRUD completo de segurados, mantendo todo o histórico organizado.
- **Gerenciamento de Seguros e Apólices:** Associação direta dos dados de cada apólice ao perfil do cliente, validando as informações e mantendo tudo rastreável.
- **Arquitetura Cloud-Based:** Permite que a corretora acesse o sistema de qualquer lugar com garantia de disponibilidade.

## ⚙️ Como executar o projeto localmente

Siga os passos abaixo para rodar o projeto na sua máquina:

### Pré-requisitos
- Node.js (v16 ou superior)
- Gerenciador de pacotes (NPM ou Yarn)
- Banco de dados configurado (PostgreSQL/MySQL - *ver `.env`*)


