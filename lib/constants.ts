import type { Pack } from '@/types';

export const SORTEO_DATE = new Date('2026-06-06T16:00:00-04:00');
export const SORTEO_TITLE = 'AUTOLANDIA 3.0';
export const SORTEO_PRIZE = 'BMW Serie 5 2013';
export const SORTEO_PRIZE_DETAIL = 'Diesel · Recién importado · Nivel premium';
export const PRECIO_BASE = 20_000;
export const MAX_NUMERO = 59_999;
export const WHATSAPP_GROUP_LINK = 'https://chat.whatsapp.com/Fe9iPH8qw779BIpIZBKnEl?mode=gi_t';

export const PACKS_NORMALES: Pack[] = [
  { cantidad: 1, precio: 20_000, descuento: '', precioPorBoleto: 20_000 },
  { cantidad: 2, precio: 40_000, descuento: '', precioPorBoleto: 20_000 },
  { cantidad: 3, precio: 50_000, descuento: '17% OFF', precioPorBoleto: 16_667 },
  { cantidad: 7, precio: 100_000, descuento: '29% OFF', precioPorBoleto: 14_286, popular: true },
  { cantidad: 11, precio: 150_000, descuento: '32% OFF', precioPorBoleto: 13_636 },
  { cantidad: 16, precio: 200_000, descuento: '38% OFF', precioPorBoleto: 12_500 },
];

export const PACKS_3X1: Pack[] = [
  { cantidad: 3, precio: 20_000, descuento: '3x1', precioPorBoleto: 6_667 },
  { cantidad: 6, precio: 40_000, descuento: '3x1', precioPorBoleto: 6_667 },
  { cantidad: 9, precio: 60_000, descuento: '3x1', precioPorBoleto: 6_667 },
  { cantidad: 15, precio: 100_000, descuento: '3x1', precioPorBoleto: 6_667 },
  { cantidad: 24, precio: 160_000, descuento: '3x1', precioPorBoleto: 6_667 },
  { cantidad: 30, precio: 200_000, descuento: '3x1', precioPorBoleto: 6_667 },
];

export const PROMO_3X1_END = new Date('2026-04-18T23:59:59-04:00');

export const BANK_INFO = {
  banco: 'Ueno Bank',
  alias: '3415028',
  cuenta: '61921962',
  titular: 'Oscar Santander',
};

export const TITULARES_VALIDOS = ['OSCAR', 'PAUL', 'SANTANDER', 'VILLAGRA', 'CUPON'];
export const FECHA_MINIMA_COMPROBANTE = '2026-04-08';
