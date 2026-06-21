import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InvoiceStatus, OrderStatus } from '@prisma/client';
import OpenAI from 'openai';
import { env } from '../common/config/env';
import { PrismaService } from '../common/prisma/prisma.service';
import { limaDateString } from '../common/utils/lima-time';
import { round2 } from '../common/utils/money';

/** Borrador extraído de una factura de compra (OCR por IA). */
export interface PurchaseDraft {
  supplierName?: string;
  supplierRuc?: string;
  documentSeries?: string;
  documentNumber?: string;
  issueDate?: string;
  currency?: string;
  items: { description: string; quantity: number; unitPrice: number }[];
  total?: number;
  notes?: string;
}

/**
 * IA agnóstica de proveedor mediante API compatible con OpenAI
 * (DeepSeek por defecto; también MiniMax, OpenRouter, Gemini, etc.).
 * El chat usa el modelo principal; el OCR usa un modelo con visión aparte.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly chat: OpenAI | null;
  private readonly chatModel: string;
  private readonly vision: OpenAI | null;
  private readonly visionModel: string;

  constructor(private readonly prisma: PrismaService) {
    const cfg = env.ai();
    this.chatModel = cfg.model;
    this.chat = cfg.apiKey ? new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl }) : null;
    this.visionModel = cfg.vision.model;
    this.vision =
      cfg.vision.apiKey && cfg.vision.model
        ? new OpenAI({ apiKey: cfg.vision.apiKey, baseURL: cfg.vision.baseUrl })
        : null;
    if (!this.chat) this.logger.warn('IA sin configurar (AI_API_KEY ausente) — asistente deshabilitado.');
    if (!this.vision) this.logger.warn('OCR sin configurar (AI_VISION_MODEL ausente) — escaneo de compras deshabilitado.');
  }

  available(): boolean {
    return this.chat !== null;
  }
  visionAvailable(): boolean {
    return this.vision !== null;
  }

  private ensureChat(): OpenAI {
    if (!this.chat) {
      throw new ServiceUnavailableException(
        'La IA no está configurada. Define AI_API_KEY (y opcionalmente AI_BASE_URL/AI_MODEL) en el servidor.',
      );
    }
    return this.chat;
  }

  /** Snapshot compacto del negocio para alimentar al asistente. */
  private async snapshot(organizationId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [org, hoy, mes, invoiceGroups, lowStock, topProducts, igvVentas, igvCompras, customers] =
      await Promise.all([
        this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { razonSocial: true, nombreComercial: true, ruc: true },
        }),
        this.prisma.order.aggregate({
          where: { organizationId, status: OrderStatus.PAID, createdAt: { gte: todayStart } },
          _sum: { total: true },
          _count: true,
        }),
        this.prisma.order.aggregate({
          where: { organizationId, status: OrderStatus.PAID, createdAt: { gte: monthStart } },
          _sum: { total: true },
          _count: true,
        }),
        this.prisma.invoice.groupBy({ by: ['status'], where: { organizationId }, _count: true }),
        this.prisma.stock.findMany({
          where: { product: { organizationId, tracksStock: true } },
          select: { quantity: true, product: { select: { name: true, minStock: true } } },
          take: 200,
        }),
        this.prisma.orderItem.groupBy({
          by: ['name'],
          where: { order: { organizationId, createdAt: { gte: monthStart } } },
          _sum: { quantity: true, total: true },
          orderBy: { _sum: { total: 'desc' } },
          take: 5,
        }),
        this.prisma.invoice.aggregate({
          where: { organizationId, status: InvoiceStatus.ACCEPTED, createdAt: { gte: monthStart } },
          _sum: { igv: true },
        }),
        this.prisma.purchase.aggregate({
          where: { organizationId, createdAt: { gte: monthStart } },
          _sum: { igv: true },
        }),
        this.prisma.customer.count({ where: { organizationId } }),
      ]);

    const byStatus: Record<string, number> = {};
    for (const g of invoiceGroups) byStatus[g.status] = g._count;
    const stockBajo = lowStock
      .filter((s) => Number(s.quantity) <= Number(s.product.minStock ?? 0))
      .map((s) => `${s.product.name} (${Number(s.quantity)})`)
      .slice(0, 15);
    const debito = round2(Number(igvVentas._sum.igv ?? 0));
    const credito = round2(Number(igvCompras._sum.igv ?? 0));

    return {
      fecha: limaDateString(),
      negocio: org?.nombreComercial || org?.razonSocial,
      ruc: org?.ruc,
      ventasHoy: { total: round2(Number(hoy._sum.total ?? 0)), num: hoy._count },
      ventasMes: { total: round2(Number(mes._sum.total ?? 0)), num: mes._count },
      comprobantes: byStatus,
      pendientesSunat: (byStatus[InvoiceStatus.PENDING] ?? 0) + (byStatus[InvoiceStatus.VOID_PENDING] ?? 0),
      rechazadosSunat: byStatus[InvoiceStatus.REJECTED] ?? 0,
      topProductosMes: topProducts.map((p) => ({
        nombre: p.name,
        cantidad: Number(p._sum.quantity ?? 0),
        venta: round2(Number(p._sum.total ?? 0)),
      })),
      stockBajo,
      igvMes: { debito, credito, porPagar: round2(debito - credito) },
      clientes: customers,
    };
  }

  /** Responde una pregunta del dueño sobre su propio negocio, con datos en vivo. */
  async ask(organizationId: string, question: string): Promise<{ answer: string }> {
    const client = this.ensureChat();
    if (!question?.trim()) throw new BadRequestException('La pregunta está vacía');

    const data = await this.snapshot(organizationId);
    const system = [
      'Eres el asistente de FacturArkos, un sistema peruano de facturación electrónica (SUNAT), punto de venta e inventario para Mypes.',
      'Respondes preguntas del dueño sobre SUS datos, entregados abajo en JSON (montos en soles, S/).',
      'Reglas: responde en español, claro y breve (1-4 frases o lista corta). Usa solo los datos provistos; si algo no está, dilo y sugiere dónde verlo en el panel. No inventes cifras. Formatea montos como "S/ 1,234.56".',
      '',
      'DATOS DEL NEGOCIO (en vivo): ' + JSON.stringify(data),
    ].join('\n');

    try {
      const res = await client.chat.completions.create({
        model: this.chatModel,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: question },
        ],
      });
      const answer = res.choices[0]?.message?.content?.trim();
      return { answer: answer || 'No pude generar una respuesta.' };
    } catch (e) {
      this.logger.error(`ask falló: ${(e as Error).message}`);
      throw new ServiceUnavailableException('El asistente IA no está disponible por ahora.');
    }
  }

  /** OCR de una factura de compra: extrae proveedor e ítems de una imagen (base64). */
  async scanPurchase(dataBase64: string, mediaType: string): Promise<PurchaseDraft> {
    if (!this.vision) {
      throw new ServiceUnavailableException(
        'El OCR no está configurado. Define AI_VISION_MODEL (un modelo con visión, p.ej. de MiniMax/Gemini/Qwen-VL vía OpenRouter).',
      );
    }
    if (!dataBase64) throw new BadRequestException('No se recibió el archivo');
    const allowedImg = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowedImg.includes(mediaType)) {
      throw new BadRequestException('Sube una imagen (PNG/JPG/WEBP) o una foto del comprobante.');
    }

    const instruction =
      'Eres un extractor de facturas/boletas de compra peruanas. Lee el comprobante de la imagen y responde EXCLUSIVAMENTE con un objeto JSON (sin texto extra, sin ```), con esta forma:\n' +
      '{"supplierName":string,"supplierRuc":string,"documentSeries":string,"documentNumber":string,"issueDate":"YYYY-MM-DD","currency":"PEN"|"USD","items":[{"description":string,"quantity":number,"unitPrice":number}],"total":number,"notes":string}\n' +
      'unitPrice es el precio unitario CON IGV tal como figura. Si un campo no aparece, omítelo. Si no es una factura/boleta, devuelve {"items":[],"notes":"<motivo>"}.';

    try {
      const res = await this.vision.chat.completions.create({
        model: this.visionModel,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: instruction },
              { type: 'image_url', image_url: { url: `data:${mediaType};base64,${dataBase64}` } },
            ],
          },
        ],
      });
      const text = res.choices[0]?.message?.content?.trim() ?? '';
      return this.parseDraft(text);
    } catch (e) {
      this.logger.error(`scanPurchase falló: ${(e as Error).message}`);
      throw new ServiceUnavailableException('No se pudo leer el documento con IA por ahora.');
    }
  }

  private parseDraft(text: string): PurchaseDraft {
    const match = text.match(/\{[\s\S]*\}/);
    const raw = match ? match[0] : text;
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('La IA no devolvió datos legibles. Intenta con una foto más nítida.');
    }
    const items = Array.isArray(parsed.items)
      ? parsed.items
          .map((it: any) => ({
            description: String(it.description ?? '').trim(),
            quantity: Number(it.quantity) || 0,
            unitPrice: Number(it.unitPrice) || 0,
          }))
          .filter((it: PurchaseDraft['items'][number]) => it.description)
      : [];
    return {
      supplierName: parsed.supplierName ? String(parsed.supplierName) : undefined,
      supplierRuc: parsed.supplierRuc ? String(parsed.supplierRuc) : undefined,
      documentSeries: parsed.documentSeries ? String(parsed.documentSeries) : undefined,
      documentNumber: parsed.documentNumber ? String(parsed.documentNumber) : undefined,
      issueDate: parsed.issueDate ? String(parsed.issueDate) : undefined,
      currency: parsed.currency === 'USD' ? 'USD' : 'PEN',
      items,
      total: parsed.total != null ? Number(parsed.total) : undefined,
      notes: parsed.notes ? String(parsed.notes) : undefined,
    };
  }
}
