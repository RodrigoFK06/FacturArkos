import { CatalogService } from './catalog.service';

const svc = (prisma: any) => new CatalogService(prisma);

describe('CatalogService — listas de precios', () => {
  it('listProducts sobre-escribe el precio con el de la lista (cae al base si no hay especial)', async () => {
    const prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'p1', name: 'A', price: 10, prices: [{ price: 8 }] },
          { id: 'p2', name: 'B', price: 20, prices: [] },
        ]),
      },
    };
    const r = (await svc(prisma).listProducts('org', undefined, false, 'list1')) as any[];
    expect(r[0].price).toBe(8); // precio especial de la lista
    expect(r[1].price).toBe(20); // sin especial → precio base
    expect(r[0].prices).toBeUndefined(); // no se filtra la relación al cliente
  });

  it('listProducts sin priceListId devuelve los productos tal cual', async () => {
    const products = [{ id: 'p1', name: 'A', price: 10 }];
    const prisma = { product: { findMany: jest.fn().mockResolvedValue(products) } };
    const r = await svc(prisma).listProducts('org');
    expect(r).toBe(products);
  });

  it('setPrices: upsert para precio>0, deleteMany para 0, ignora productos ajenos', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const deleteMany = jest.fn().mockResolvedValue({});
    const prisma = {
      priceList: { findFirst: jest.fn().mockResolvedValue({ id: 'l1' }) },
      product: { findMany: jest.fn().mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]) },
      productPrice: { upsert, deleteMany },
    };
    const r = await svc(prisma).setPrices('org', 'l1', {
      prices: [
        { productId: 'p1', price: 10 },
        { productId: 'p2', price: 0 },
        { productId: 'p3', price: 5 }, // ajeno → ignorado
      ],
    });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(r.applied).toBe(2);
  });
});
