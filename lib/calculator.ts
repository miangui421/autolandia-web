const PRECIO_BASE = 20_000;

export function formatGs(amount: number): string {
  return amount.toLocaleString('es-PY') + ' Gs';
}

export interface CalculatorResult {
  subtotal: number;
  total: number;
  ahorro: number;
  descuento: string;
}

export function calcularPrecio(cantidad: number, montoPromo: number): CalculatorResult {
  if (cantidad < 0) cantidad = 0;
  if (montoPromo < 0) montoPromo = 0;

  const subtotal = cantidad * PRECIO_BASE;
  let total: number;
  let pct: number;

  if (montoPromo > 0) {
    total = montoPromo;
    const ahorroReal = subtotal - total;
    pct = subtotal > 0 ? ahorroReal / subtotal : 0;
  } else {
    if (cantidad > 100) pct = 0.25;
    else if (cantidad > 50) pct = 0.20;
    else pct = 0;
    total = Math.round(subtotal * (1 - pct));
  }

  const ahorro = Math.max(0, subtotal - total);

  return {
    subtotal,
    total,
    ahorro,
    descuento: Math.round(pct * 100) + '%',
  };
}
