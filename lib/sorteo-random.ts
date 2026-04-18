import { randomInt } from 'crypto';
import type { PoolEntry } from './sorteo-pool';

/**
 * Selecciona N ganadores sin reemplazo usando crypto.randomInt().
 * - ponderar=true: cada entry pesa por ticket_count (más boletos = más chance).
 * - ponderar=false: cada entry pesa 1 (todos iguales).
 */
export function pickWinners(
  pool: PoolEntry[],
  cantidad: number,
  ponderar: boolean,
): PoolEntry[] {
  if (cantidad <= 0) throw new Error('cantidad debe ser >= 1');
  if (pool.length < cantidad) {
    throw new Error(`Pool insuficiente: ${pool.length} participantes para ${cantidad} ganador(es)`);
  }

  const remaining: PoolEntry[] = [...pool];
  const winners: PoolEntry[] = [];

  for (let i = 0; i < cantidad; i++) {
    let pickIdx = 0;

    if (ponderar) {
      const totalWeight = remaining.reduce((s, p) => s + p.ticket_count, 0);
      if (totalWeight <= 0) throw new Error('Weight total 0 (ticket_count invalidos)');
      let r = randomInt(totalWeight);
      for (let j = 0; j < remaining.length; j++) {
        r -= remaining[j].ticket_count;
        if (r < 0) {
          pickIdx = j;
          break;
        }
      }
    } else {
      pickIdx = randomInt(remaining.length);
    }

    winners.push(remaining[pickIdx]);
    remaining.splice(pickIdx, 1);
  }

  return winners;
}
