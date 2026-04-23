export interface Pack {
  cantidad: number;
  precio: number;
  descuento: string;
  precioPorBoleto: number;
  popular?: boolean;
}

export interface RaffleNumber {
  numero: number;
  disponible: boolean;
}

export interface CheckoutState {
  step: 1 | 2 | 3 | 4;
  qty: number;
  price: number;
  isPromo3x1: boolean;
  selectedNumbers: number[];
  mode: 'manual' | 'random';
  ci: string;
  nombre: string;
  telefono: string;
  ticketId?: string;
  numerosAsignados?: string;
  receiptUrl?: string;
}

export interface VisionResult {
  tipoDocumento: 'TRANSFERENCIA' | 'CUPON';
  montoDetectado: number;
  fechaOperacion: string | null;
  bancoOrigen: string;
  bancoDestino: string;
  titularDestino: string;
  idTransaccion: string;
  analisisFraude: {
    esSospechoso: boolean;
    motivoSospecha: string | null;
  };
}

export interface FraudCheckResult {
  status: 'approved' | 'rejected';
  motivoRechazo: string | null;
  montoDetectado: number;
  idTransaccion: string;
  metodoPago: 'TRANSFERENCIA' | 'CUPON';
}

export interface SaleResult {
  ticketId: string;
  numerosAsignados: string;
  event_id?: string;
}
