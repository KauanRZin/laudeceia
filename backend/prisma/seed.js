const bcrypt = require("bcryptjs");
const env = require("./config/env");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const VINCULOS = ["LAUDYS Corretora", "LAUDYS CORRETORA AGENCIA", "Agência 1", "Agência 2"];
const INSURANCE_TYPES = [
  { id: 1, nome: "Seguro de Vida" },
  { id: 2, nome: "Seguro Residencial" },
  { id: 3, nome: "Seguro Auto" },
  { id: 4, nome: "Seguro Empresarial" },
];

const clients = [
  {
    nome: "João Pereira",
    cpf: "123.456.789-00",
    telefone: "(11) 99999-1111",
    nascimento: "1985-04-12",
    observacao: "Cliente prefere contato por WhatsApp.",
    vinculos: ["Seguradora X"],
    endereco: {
      cep: "01001-000",
      logradouro: "Praça da Sé",
      numero: "100",
      complemento: "Apto 12",
      bairro: "Sé",
      cidade: "São Paulo",
      estado: "SP",
    },
    seguros: [{ tipoId: 1, inicioVigencia: "2024-01-10", fimVigencia: null, vinculoNome: "Seguradora X" }],
  },
  {
    nome: "Maria Souza",
    cpf: "987.654.321-00",
    telefone: "(21) 98888-2222",
    nascimento: "1990-08-22",
    observacao: "",
    vinculos: ["Escritório Y"],
    endereco: {
      cep: "20040-020",
      logradouro: "Rua da Assembleia",
      numero: "45",
      complemento: "Sala 701",
      bairro: "Centro",
      cidade: "Rio de Janeiro",
      estado: "RJ",
    },
    seguros: [{ tipoId: 2, inicioVigencia: "2024-03-01", fimVigencia: "2025-03-01", vinculoNome: "Escritório Y" }],
  },
  {
    nome: "Carlos Lima",
    cpf: "111.222.333-44",
    telefone: "(31) 97777-3333",
    nascimento: "1978-11-05",
    observacao: "Renovação próxima.",
    vinculos: ["Agência 1"],
    endereco: {
      cep: "30140-071",
      logradouro: "Avenida Afonso Pena",
      numero: "1500",
      complemento: "",
      bairro: "Centro",
      cidade: "Belo Horizonte",
      estado: "MG",
    },
    seguros: [{ tipoId: 3, inicioVigencia: "2023-09-15", fimVigencia: "2024-09-15", vinculoNome: "Agência 1" }],
  },
  {
    nome: "Fernanda Costa",
    cpf: "555.666.777-88",
    telefone: "(41) 96666-4444",
    nascimento: "1995-02-18",
    observacao: "",
    vinculos: ["Agência 2", "Seguradora X"],
    endereco: {
      cep: "80010-000",
      logradouro: "Rua XV de Novembro",
      numero: "300",
      complemento: "Conjunto 5",
      bairro: "Centro",
      cidade: "Curitiba",
      estado: "PR",
    },
    seguros: [
      { tipoId: 4, inicioVigencia: "2024-02-01", fimVigencia: "2025-02-01", vinculoNome: "Agência 2" },
      { tipoId: 1, inicioVigencia: "2024-04-20", fimVigencia: null, vinculoNome: "Seguradora X" },
    ],
  },
  {
    nome: "Roberto Alves",
    cpf: "222.333.444-55",
    telefone: "(51) 95555-5555",
    nascimento: "1969-06-30",
    observacao: "Cliente inativo no sistema antigo.",
    vinculos: ["Seguradora X"],
    endereco: {
      cep: "90010-150",
      logradouro: "Rua dos Andradas",
      numero: "999",
      complemento: "",
      bairro: "Centro Histórico",
      cidade: "Porto Alegre",
      estado: "RS",
    },
    seguros: [],
  },
];

async function main() {
  await prisma.insurance.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.insuranceType.deleteMany();
  await prisma.vinculo.deleteMany();

  for (const nome of VINCULOS) {
    await prisma.vinculo.create({ data: { nome } });
  }

  for (const type of INSURANCE_TYPES) {
    await prisma.insuranceType.create({ data: type });
  }

  const allVinculos = await prisma.vinculo.findMany();
  const byName = Object.fromEntries(allVinculos.map((vinculo) => [vinculo.nome, vinculo]));
  const passwordHash = await bcrypt.hash(process.env.DEFAULTPW, 10);

  await prisma.user.create({
    data: {
      nome: "SuperAdmin",
      email: process.env.process.env.SUPERADMIN_EMAIL,
      passwordHash,
      role: "SUPERADMIN",
      vinculos: { connect: allVinculos.map((vinculo) => ({ id: vinculo.id })) },
    },
  });

  await prisma.user.create({
    data: {
      nome: "Gerente",
      email: process.env.MANAGER_EMAIL,
      passwordHash,
      role: "MANAGER",
      vinculos: { connect: allVinculos.map((vinculo) => ({ id: vinculo.id })) },
    },
  });

  await prisma.user.create({
    data: {
      nome: "Ana Funcionária",
      email: process.env.EMPLOYEE_EMAIL,
      passwordHash,
      role: "EMPLOYEE",
      vinculos: { connect: [{ id: byName["Seguradora X"].id }] },
    },
  });
  /*
  for (const client of clients) {
    await prisma.client.create({
      data: {
        nome: client.nome,
        cpf: client.cpf,
        telefone: client.telefone,
        nascimento: new Date(client.nascimento),
        observacao: client.observacao,
        endereco: client.endereco,
        vinculos: { connect: client.vinculos.map((nome) => ({ id: byName[nome].id })) },
        seguros: {
          create: client.seguros.map((seguro) => ({
            tipoId: seguro.tipoId,
            inicioVigencia: new Date(seguro.inicioVigencia),
            fimVigencia: seguro.tipoId === 1 || !seguro.fimVigencia ? null : new Date(seguro.fimVigencia),
            vinculoId: byName[seguro.vinculoNome].id,
          })),
        },
      },
    });
  }
  */
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
