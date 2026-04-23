import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de privacidad — Autolandia',
  description: 'Cómo tratamos tus datos en Autolandia.',
  robots: { index: false, follow: false },
};

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen px-4 py-12">
      <article className="max-w-3xl mx-auto prose prose-invert">
        <h1>Política de privacidad</h1>

        <p className="text-white/60">
          Última actualización: 22 de abril de 2026
        </p>

        <h2>1. Datos que recolectamos</h2>
        <p>Al usar Autolandia, recolectamos los siguientes datos:</p>
        <ul>
          <li>Número de teléfono (para verificación por OTP y contacto sobre tu pedido).</li>
          <li>Nombre completo y número de Cédula de Identidad.</li>
          <li>Datos del comprobante de pago: número de cuenta de origen, imagen del comprobante.</li>
          <li>Dirección IP y datos del navegador (user agent).</li>
          <li>Cookies de sesión e identificadores de navegador para publicidad (pixel de Meta).</li>
        </ul>

        <h2>2. Para qué los usamos</h2>
        <ul>
          <li>Procesar y confirmar tu compra.</li>
          <li>Contactarte sobre el estado de tu pedido.</li>
          <li>Prevenir fraude y validar comprobantes.</li>
          <li>Mejorar la experiencia de navegación.</li>
          <li>Medir el rendimiento de nuestras campañas publicitarias.</li>
        </ul>

        <h2>3. Con quién compartimos</h2>
        <p>No vendemos tus datos. Compartimos información estrictamente necesaria con:</p>
        <ul>
          <li><strong>Meta Platforms Inc.</strong> (pixel de Facebook/Instagram) para medir el rendimiento de anuncios. Los datos se envían hasheados (SHA-256) cuando es posible.</li>
          <li><strong>Twilio Inc.</strong> para enviar códigos de verificación por SMS.</li>
          <li><strong>Google LLC</strong> (Google Sheets) como registro interno de operaciones.</li>
          <li><strong>Supabase</strong> como proveedor de base de datos.</li>
        </ul>

        <h2>4. Cookies y tecnologías de seguimiento</h2>
        <p>
          Usamos cookies para mantener tu sesión activa y para medir el rendimiento de nuestra publicidad (pixel de Meta). Podés borrar las cookies desde la configuración de tu navegador. Tené en cuenta que esto puede afectar tu experiencia en el sitio.
        </p>

        <h2>5. Tus derechos</h2>
        <p>
          Podés solicitar acceso, rectificación o eliminación de tus datos enviándonos un mensaje al contacto indicado abajo.
        </p>

        <h2>6. Retención</h2>
        <p>
          Mantenemos tus datos mientras dure el evento asociado a tu compra y hasta seis (6) meses posteriores, salvo que la ley nos exija conservarlos por más tiempo.
        </p>

        <h2>7. Contacto</h2>
        <p>Para ejercer tus derechos o consultas sobre privacidad:</p>
        <ul>
          <li>Email: <a href="mailto:CONTACTO_EMAIL@autolandia.com.py">CONTACTO_EMAIL@autolandia.com.py</a> (placeholder — completar antes del deploy a PROD)</li>
          <li>Teléfono: CONTACTO_TELEFONO (placeholder — completar antes del deploy a PROD)</li>
        </ul>
      </article>
    </main>
  );
}
