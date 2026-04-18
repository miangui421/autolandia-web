import { Bot } from 'grammy';
import { google } from 'googleapis';

// Lazy init to avoid issues during build/SSG
let _bot: Bot | null = null;
function getBot(): Bot {
  if (!_bot) _bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);
  return _bot;
}

export interface TelegramSaleNotification {
  nombreCompleto: string;
  ci: string;
  telefono: string;
  cantidad: number;
  monto: string;
  ticketId: string;
  numerosAsignados: string;
  comprobanteUrl: string;
}

export interface TelegramSorteoNotification {
  sorteoId: string;
  titulo: string;
  premio: number;
  ganadores: Array<{ nombre: string; phone: string; ticket_count: number; pick_order: number }>;
  poolCount: number;
}

export async function notifyTelegramSorteo(data: TelegramSorteoNotification): Promise<void> {
  try {
    const ganadoresLines = data.ganadores
      .map((g) => `  ${g.pick_order}. <b>${g.nombre}</b> (${g.phone}) — ${g.ticket_count} boletos`)
      .join('\n');
    const msg = [
      `🎉 <b>SORTEO EJECUTADO</b>`,
      ``,
      `📝 ${data.titulo}`,
      `🆔 <code>${data.sorteoId}</code>`,
      `💰 Premio: ${data.premio.toLocaleString('es-PY')} Gs`,
      `👥 Pool: ${data.poolCount} participantes`,
      ``,
      `🏆 Ganador${data.ganadores.length > 1 ? 'es' : ''}:`,
      ganadoresLines,
      ``,
      `🔗 Recibo publico: https://autolandia.com.py/sorteo/${data.sorteoId}`,
    ].join('\n');
    await getBot().api.sendMessage(process.env.TELEGRAM_CHAT_ID!, msg, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Error notificando sorteo por Telegram:', err);
  }
}

export async function notifyTelegramSale(data: TelegramSaleNotification): Promise<void> {
  try {
    const caption = [
      `🤑 <b>NUEVA VENTA (WEB)</b>`,
      ``,
      `👤 Cliente: ${data.nombreCompleto}`,
      `🆔 CI: ${data.ci}`,
      `📱 Teléfono: ${data.telefono}`,
      ``,
      `🔢 Cantidad: ${data.cantidad}`,
      `💰 Monto: ${data.monto} Gs`,
      `🎫 Ticket ID: ${data.ticketId}`,
      ``,
      `🎟️ Números: ${data.numerosAsignados}`,
    ].join('\n');

    try {
      if (data.comprobanteUrl) {
        await getBot().api.sendPhoto(process.env.TELEGRAM_CHAT_ID!, data.comprobanteUrl, { caption, parse_mode: 'HTML' });
      } else {
        await getBot().api.sendMessage(process.env.TELEGRAM_CHAT_ID!, caption, { parse_mode: 'HTML' });
      }
    } catch {
      // Fallback: send as text if photo fails (URL not public, etc)
      await getBot().api.sendMessage(process.env.TELEGRAM_CHAT_ID!, caption + (data.comprobanteUrl ? `\n\n📎 ${data.comprobanteUrl}` : ''), { parse_mode: 'HTML' });
    }
  } catch (err) {
    console.error('Error notificando por Telegram:', err);
  }
}

// Google Sheets
function getAuth() {
  let key = process.env.GOOGLE_SHEETS_PRIVATE_KEY || '';
  // Handle escaped \n from env vars (Vercel, .env.local, Docker)
  if (key.includes('\\n')) {
    key = key.split('\\n').join('\n');
  }
  // Strip surrounding quotes if present
  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1);
    if (key.includes('\\n')) {
      key = key.split('\\n').join('\n');
    }
  }
  return new google.auth.JWT({
    email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export interface SheetsSaleRow {
  telefono: string;
  fecha: string;
  ticketId: string;
  nombreCompleto: string;
  ci: string;
  monto: string;
  numerosAsignados: string;
  comprobanteUrl: string;
  cantidad: number;
  telefonoRegistro: string;
  transactionId: string;
  mensajeInicial: string;
}

/**
 * Elimina una fila de la hoja "Ventas" que matchee el ticketId (columna C).
 * Retorna true si elimino una fila, false si no la encontro.
 * Si hay multiples matches (no deberia pasar si los ticketIds son unicos), elimina el primero.
 */
export async function deleteSaleFromSheets(ticketId: string): Promise<boolean> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!;

    // Obtener sheet ID de "Ventas"
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const ventasSheet = meta.data.sheets?.find((s) => s.properties?.title === 'Ventas');
    if (!ventasSheet?.properties?.sheetId) return false;

    // Leer columna C completa para encontrar el ticketId
    const colC = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Ventas!C:C',
    });
    const rows = colC.data.values ?? [];
    const rowIdx = rows.findIndex((r) => r[0] === ticketId);
    if (rowIdx < 0) return false;

    // deleteDimension usa indices 0-based (incluye header si esta en la hoja)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: ventasSheet.properties.sheetId,
                dimension: 'ROWS',
                startIndex: rowIdx,
                endIndex: rowIdx + 1,
              },
            },
          },
        ],
      },
    });
    return true;
  } catch (err) {
    console.error('Error deleteSaleFromSheets:', err instanceof Error ? err.message : err);
    return false;
  }
}

export interface TelegramTicketDeleteNotification {
  ticketId: string;
  nombreCompleto: string;
  telefono: string;
  ci: string;
  monto: number;
  cantidad: number;
  numerosAsignados: string;
  deletedByPhone: string;
  sheetsDeleted: boolean;
}

export async function notifyTelegramTicketDeleted(data: TelegramTicketDeleteNotification): Promise<void> {
  try {
    const msg = [
      `🗑️ <b>TICKET ELIMINADO</b>`,
      ``,
      `🎫 ${data.ticketId}`,
      `👤 ${data.nombreCompleto} (CI: ${data.ci})`,
      `📱 ${data.telefono}`,
      `🔢 ${data.cantidad} boleto(s) · 💰 ${data.monto.toLocaleString('es-PY')} Gs`,
      `🎟️ Numeros liberados: ${data.numerosAsignados}`,
      ``,
      `👮 Admin: ${data.deletedByPhone}`,
      `📊 Sheets: ${data.sheetsDeleted ? '✓ fila eliminada' : '⚠️ NO se encontro fila'}`,
    ].join('\n');
    await getBot().api.sendMessage(process.env.TELEGRAM_CHAT_ID!, msg, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Error notificando ticket-delete por Telegram:', err);
  }
}

export async function appendSaleToSheets(row: SheetsSaleRow): Promise<void> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    // Escribimos en A:M. Columnas A-L iguales al bot. Columna M = "Canal" (WEB).
    // El bot escribe 12 valores y deja M vacia, asi se distinguen ventas web vs bot.
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: 'Ventas!A:M',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            row.telefono,
            row.fecha,
            row.ticketId,
            row.nombreCompleto,
            row.ci,
            row.monto,
            row.numerosAsignados,
            row.comprobanteUrl,
            row.cantidad,
            row.telefonoRegistro,
            row.transactionId,
            row.mensajeInicial,
            'WEB', // col M = Canal
          ],
        ],
      },
    });
  } catch (err) {
    console.error('Error Google Sheets:', err instanceof Error ? err.message : err);
  }
}

// ─── Leads Web ────────────────────────────────────────────────
// Registra un lead nuevo (registrado en la web) en la hoja "Leads Web"
// del mismo spreadsheet. Si la hoja no existe, la crea.

export interface SheetsLeadRow {
  fecha: string;
  telefono: string;
  nombreCompleto: string;
  ci: string;
  canal: string; // WEB | BOT
  stage: string; // NUEVO | INTERESADO | COMPRADOR | RECURRENTE
}

/**
 * Crea la hoja "Leads Web" si no existe, con headers.
 * Idempotente: si ya existe, no hace nada.
 */
async function ensureLeadsSheetExists(): Promise<void> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() });
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === 'Leads Web');
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        { addSheet: { properties: { title: 'Leads Web' } } },
      ],
    },
  });

  // Agregar headers
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Leads Web!A1:F1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [['Fecha', 'Telefono', 'Nombre Completo', 'CI', 'Canal', 'Stage']],
    },
  });
}

export async function appendLeadToSheets(row: SheetsLeadRow): Promise<void> {
  try {
    await ensureLeadsSheetExists();

    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: 'Leads Web!A:F',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [
          [
            row.fecha,
            row.telefono,
            row.nombreCompleto,
            row.ci,
            row.canal,
            row.stage,
          ],
        ],
      },
    });
  } catch (err) {
    console.error('Error Google Sheets (Leads Web):', err instanceof Error ? err.message : err);
  }
}
