import { IgvAffectation, PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // RUC de la cuenta APISUNAT dev "arkosprueba" (validado contra SUNAT) → emite de fábrica.
  const ruc = '10758936746';
  const existing = await prisma.organization.findUnique({ where: { ruc } });
  if (existing) {
    console.log('Seed ya aplicado (organización demo existe).');
    return;
  }

  const passwordHash = await bcrypt.hash('password123', 10);
  const org = await prisma.organization.create({
    data: {
      ruc,
      razonSocial: 'ARKOS PRUEBA',
      nombreComercial: 'FacturArkos Demo',
      direccion: 'Av. Demo 123, Lima',
      ubigeo: '150101',
      establishments: { create: { code: '0000', name: 'Principal', isMain: true } },
      warehouses: { create: { name: 'Principal', isMain: true } },
      priceLists: { create: { name: 'General', isDefault: true } },
      units: {
        create: [
          { code: 'NIU', name: 'Unidad' },
          { code: 'ZZ', name: 'Servicio' },
          { code: 'KGM', name: 'Kilogramo' },
        ],
      },
      categories: { create: [{ name: 'General' }] },
      users: {
        create: { email: 'demo@facturarkos.pe', name: 'Demo Owner', passwordHash, role: UserRole.OWNER },
      },
    },
  });

  await prisma.product.createMany({
    data: [
      { organizationId: org.id, name: 'Gaseosa 500ml', barcode: '7501000111', price: 3.5, cost: 2.0 },
      { organizationId: org.id, name: 'Pan francés', barcode: '7501000222', price: 0.5, cost: 0.2 },
      {
        organizationId: org.id,
        name: 'Servicio de delivery',
        price: 5.0,
        igvAffectation: IgvAffectation.GRAVADO,
        tracksStock: false,
        unitCode: 'ZZ',
      },
    ],
  });

  console.log('✓ Seed OK. Login: demo@facturarkos.pe / password123 (RUC 20123456789)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
