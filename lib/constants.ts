import type { Pack } from '@/types';

export const SORTEO_DATE = new Date('2026-06-06T16:00:00-04:00');
export const SORTEO_TITLE = 'AUTOLANDIA 3.0';
export const SORTEO_PRIZE = 'BMW Serie 5 2013';
export const SORTEO_PRIZE_DETAIL = 'Diesel · Recién importado · Nivel premium';
export const PRECIO_BASE = 20_000;
export const MAX_NUMERO = 59_999;
export const WHATSAPP_GROUP_LINK = 'https://chat.whatsapp.com/Fe9iPH8qw779BIpIZBKnEl?mode=gi_t';

export const PACKS_NORMALES: Pack[] = [
  { cantidad: 1,  precio: 20_000,  descuento: '',        precioPorBoleto: 20_000 },
  { cantidad: 2,  precio: 40_000,  descuento: '',        precioPorBoleto: 20_000 },
  { cantidad: 3,  precio: 50_000,  descuento: '17% OFF', precioPorBoleto: 16_667, popular: true },
  { cantidad: 10, precio: 100_000, descuento: '50% OFF', precioPorBoleto: 10_000 },
  { cantidad: 20, precio: 150_000, descuento: '63% OFF', precioPorBoleto: 7_500 },
  { cantidad: 30, precio: 200_000, descuento: '67% OFF', precioPorBoleto: 6_667 },
  { cantidad: 80, precio: 500_000, descuento: '69% OFF', precioPorBoleto: 6_250 },
];

export const PACKS_3X1: Pack[] = [
  { cantidad: 3, precio: 20_000, descuento: '3x1', precioPorBoleto: 6_667 },
  { cantidad: 6, precio: 40_000, descuento: '3x1', precioPorBoleto: 6_667 },
  { cantidad: 9, precio: 60_000, descuento: '3x1', precioPorBoleto: 6_667 },
  { cantidad: 15, precio: 100_000, descuento: '3x1', precioPorBoleto: 6_667 },
  { cantidad: 24, precio: 160_000, descuento: '3x1', precioPorBoleto: 6_667 },
  { cantidad: 30, precio: 200_000, descuento: '3x1', precioPorBoleto: 6_667 },
];

// Promo 3x1 desactivada (pedido Paul 2026-04-21). Fecha pasada = todos los checks
// existentes la ocultan en cascade: banner, CTA mis-boletos, pagina /promo-3x1.
// Codigo queda intacto por si se reactiva en sorteos futuros: solo mover la fecha.
export const PROMO_3X1_END = new Date('2026-04-20T23:59:59-04:00');

// Mini sorteos: 3 sorteos de 500k Gs entre compradores de 3+ boletos.
// Fecha del draw el 30 de abril. Banner se oculta automatico despues.
export const MINI_SORTEO_DATE = new Date('2026-04-30T23:59:59-04:00');
export const MINI_SORTEO_PREMIO = 500_000;
export const MINI_SORTEO_CANTIDAD = 3;
export const MINI_SORTEO_MIN_BOLETOS = 3;

export const BANK_INFO = {
  banco: 'Ueno Bank',
  alias: '3415028',
  cuenta: '61921962',
  titular: 'Oscar Santander',
};

export const TITULARES_VALIDOS = ['OSCAR', 'PAUL', 'SANTANDER', 'VILLAGRA', 'CUPON'];
export const FECHA_MINIMA_COMPROBANTE = '2026-04-08';
