CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'MANAGER', 'EMPLOYEE');
CREATE TYPE "Status" AS ENUM ('ATIVO', 'INATIVO');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "status" "Status" NOT NULL DEFAULT 'ATIVO',
  "avatar" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Vinculo" (
  "id" SERIAL NOT NULL,
  "nome" TEXT NOT NULL,
  CONSTRAINT "Vinculo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Client" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "cpf" TEXT NOT NULL,
  "telefone" TEXT NOT NULL,
  "nascimento" TIMESTAMP(3) NOT NULL,
  "observacao" TEXT NOT NULL DEFAULT '',
  "endereco" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InsuranceType" (
  "id" INTEGER NOT NULL,
  "nome" TEXT NOT NULL,
  CONSTRAINT "InsuranceType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Insurance" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "tipoId" INTEGER NOT NULL,
  "inicioVigencia" TIMESTAMP(3) NOT NULL,
  "fimVigencia" TIMESTAMP(3),
  "vinculoId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Insurance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_UserVinculos" (
  "A" TEXT NOT NULL,
  "B" INTEGER NOT NULL
);

CREATE TABLE "_ClientVinculos" (
  "A" TEXT NOT NULL,
  "B" INTEGER NOT NULL
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Vinculo_nome_key" ON "Vinculo"("nome");
CREATE UNIQUE INDEX "Client_cpf_key" ON "Client"("cpf");
CREATE UNIQUE INDEX "InsuranceType_nome_key" ON "InsuranceType"("nome");
CREATE UNIQUE INDEX "_UserVinculos_AB_unique" ON "_UserVinculos"("A", "B");
CREATE INDEX "_UserVinculos_B_index" ON "_UserVinculos"("B");
CREATE UNIQUE INDEX "_ClientVinculos_AB_unique" ON "_ClientVinculos"("A", "B");
CREATE INDEX "_ClientVinculos_B_index" ON "_ClientVinculos"("B");

ALTER TABLE "Insurance" ADD CONSTRAINT "Insurance_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Insurance" ADD CONSTRAINT "Insurance_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "InsuranceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Insurance" ADD CONSTRAINT "Insurance_vinculoId_fkey" FOREIGN KEY ("vinculoId") REFERENCES "Vinculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "_UserVinculos" ADD CONSTRAINT "_UserVinculos_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_UserVinculos" ADD CONSTRAINT "_UserVinculos_B_fkey" FOREIGN KEY ("B") REFERENCES "Vinculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ClientVinculos" ADD CONSTRAINT "_ClientVinculos_A_fkey" FOREIGN KEY ("A") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ClientVinculos" ADD CONSTRAINT "_ClientVinculos_B_fkey" FOREIGN KEY ("B") REFERENCES "Vinculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
