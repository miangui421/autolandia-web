import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de privacidad — Autolandia',
  description: 'Cómo tratamos tus datos en Autolandia.',
  robots: { index: false, follow: false },
};

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen px-4 py-12">
      <article className="max-w-2xl mx-auto text-sm text-white/70 leading-relaxed">
        <header className="mb-10 border-b border-white/10 pb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
            Política de privacidad
          </h1>
          <p className="text-xs text-white/40">
            Última actualización: 24 de abril de 2026
          </p>
        </header>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-white mb-3">
            1. Datos que recolectamos
          </h2>
          <p className="mb-3">
            Al usar Autolandia, recolectamos los siguientes datos:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-white/60">
            <li>Número de teléfono (para verificación por OTP y contacto sobre tu pedido).</li>
            <li>Nombre completo y número de Cédula de Identidad.</li>
            <li>Datos del comprobante de pago: número de cuenta de origen, imagen del comprobante.</li>
            <li>Dirección IP y datos del navegador (user agent).</li>
            <li>Cookies de sesión e identificadores de navegador para publicidad (pixel de Meta).</li>
            <li>
              Cookie propia <code className="text-white/85">al_utm</code> con parámetros UTM de
              la campaña por la que llegaste (ej: Meta, TikTok). Sin datos personales.
            </li>
            <li>
              Datos anónimos de uso del sitio (clicks, scrolls, navegación) vía Microsoft Clarity.
              Los campos de formulario se enmascaran automáticamente.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-white mb-3">
            2. Para qué los usamos
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-white/60">
            <li>Procesar y confirmar tu compra.</li>
            <li>Contactarte sobre el estado de tu pedido.</li>
            <li>Prevenir fraude y validar comprobantes.</li>
            <li>Mejorar la experiencia de navegación.</li>
            <li>Medir el rendimiento de nuestras campañas publicitarias.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-white mb-3">
            3. Con quién compartimos
          </h2>
          <p className="mb-3">
            No vendemos tus datos. Compartimos información estrictamente necesaria con:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-white/60">
            <li>
              <span className="text-white/85 font-medium">Meta Platforms Inc.</span>{' '}
              (pixel de Facebook/Instagram) para medir el rendimiento de anuncios.
              Los datos se envían hasheados (SHA-256) cuando es posible.
            </li>
            <li>
              <span className="text-white/85 font-medium">Twilio Inc.</span>{' '}
              para enviar códigos de verificación por SMS.
            </li>
            <li>
              <span className="text-white/85 font-medium">Google LLC</span>{' '}
              (Google Sheets) como registro interno de operaciones.
            </li>
            <li>
              <span className="text-white/85 font-medium">Supabase</span>{' '}
              como proveedor de base de datos.
            </li>
            <li>
              <span className="text-white/85 font-medium">Microsoft Clarity</span>{' '}
              para entender cómo usás el sitio de forma anónima (heatmaps y grabaciones
              de sesión sin datos personales, con enmascarado automático de formularios).
              Ver la{' '}
              <a
                href="https://privacy.microsoft.com/privacystatement"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#d4af37] hover:text-[#f5d76e] transition-colors underline"
              >
                política de privacidad de Microsoft
              </a>.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-white mb-3">
            4. Cookies y tecnologías de seguimiento
          </h2>
          <p className="text-white/60 mb-3">
            Usamos cookies para mantener tu sesión activa y para medir el rendimiento
            de nuestra publicidad (pixel de Meta). Podés borrar las cookies desde la
            configuración de tu navegador. Tené en cuenta que esto puede afectar tu
            experiencia en el sitio.
          </p>
          <p className="text-white/60">
            Adicionalmente usamos la cookie <code className="text-white/85">al_utm</code>{' '}
            (180 días) para recordar por cuál anuncio llegaste al sitio. Esto nos ayuda a
            decidir qué campañas funcionan mejor. No se comparte con terceros.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-white mb-3">
            5. Tus derechos
          </h2>
          <p className="text-white/60">
            Podés solicitar acceso, rectificación o eliminación de tus datos
            enviándonos un mensaje al contacto indicado abajo.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-white mb-3">
            6. Retención
          </h2>
          <p className="text-white/60">
            Mantenemos tus datos mientras dure el evento asociado a tu compra y hasta
            seis (6) meses posteriores, salvo que la ley nos exija conservarlos por
            más tiempo.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-white mb-3">
            7. Contacto
          </h2>
          <p className="text-white/60 mb-3">
            Para ejercer tus derechos o realizar consultas sobre privacidad:
          </p>
          <ul className="space-y-2 text-white/60">
            <li>
              <span className="text-white/40">Email: </span>
              <a
                href="mailto:contacto@autolandia.com.py"
                className="text-[#d4af37] hover:text-[#f5d76e] transition-colors"
              >
                contacto@autolandia.com.py
              </a>
            </li>
            <li>
              <span className="text-white/40">Teléfono: </span>
              <a
                href="tel:+595983757010"
                className="text-[#d4af37] hover:text-[#f5d76e] transition-colors"
              >
                0983 757 010
              </a>
            </li>
          </ul>
        </section>

        <footer className="mt-12 pt-6 border-t border-white/10 text-center text-xs text-white/30">
          © 2026 Autolandia
        </footer>
      </article>
    </main>
  );
}
