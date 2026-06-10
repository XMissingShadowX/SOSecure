import Link from 'next/link'
import { Shield, ArrowLeft } from 'lucide-react'

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/auth/sign-up" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Aviso de Privacidad</h1>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">SOSecure — Celaya, Guanajuato, México</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-semibold mb-2">I. Identidad y Domicilio del Responsable</h2>
            <p>En cumplimiento de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares, su Reglamento y demás disposiciones aplicables, SOSecure pone a disposición de los usuarios el presente Aviso de Privacidad con la finalidad de informar la forma en que se recaban, utilizan, almacenan, protegen y, en su caso, transfieren los datos personales obtenidos a través de la aplicación móvil, sitio web y demás servicios relacionados.</p>
            <p className="mt-2">Los responsables del tratamiento de los datos personales son los desarrolladores de SOSecure. Para cualquier asunto relacionado, los usuarios podrán comunicarse mediante el correo electrónico: <strong>sosecure61@gmail.com</strong></p>
            <p className="mt-1">Domicilio de contacto: Celaya, Guanajuato, México.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">II. Datos Personales Recabados</h2>
            <p>Para la prestación de los servicios, podrán recabarse las siguientes categorías de datos personales:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Datos de identificación:</strong> Nombre completo, correo electrónico, número telefónico.</li>
              <li><strong>Datos técnicos y de uso:</strong> Dirección IP, identificadores del dispositivo, información del sistema operativo, registros de acceso.</li>
              <li><strong>Datos de ubicación:</strong> Información de geolocalización aproximada cuando el usuario otorgue los permisos correspondientes.</li>
              <li><strong>Datos de contactos de emergencia:</strong> Nombre del contacto, correo electrónico del contacto.</li>
              <li><strong>Datos generados por el uso:</strong> Historial de mensajes, registros de actividad, reportes generados, información relacionada con alertas SOS.</li>
            </ul>
            <p className="mt-2">SOSecure no solicita ni requiere datos personales sensibles para el funcionamiento ordinario de la plataforma.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">III. Finalidades del Tratamiento</h2>
            <p><strong>Finalidades primarias:</strong></p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Crear y administrar cuentas de usuario</li>
              <li>Gestionar contactos de emergencia y operar la función SOS</li>
              <li>Enviar alertas y notificaciones de emergencia</li>
              <li>Habilitar la mensajería privada</li>
              <li>Mostrar información dentro del mapa comunitario</li>
              <li>Mantener la seguridad de la plataforma y cumplir obligaciones legales</li>
            </ul>
            <p className="mt-2"><strong>Finalidades secundarias:</strong></p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Elaboración de estadísticas y análisis de uso</li>
              <li>Desarrollo de nuevas funcionalidades y mejoras de rendimiento</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">IV. Geolocalización</h2>
            <p>SOSecure podrá acceder a la ubicación del usuario cuando éste otorgue los permisos correspondientes, para activación de funciones SOS, generación de alertas y funcionamiento del mapa comunitario. La ubicación mostrada en el mapa podrá visualizarse de manera aproximada para proteger la privacidad del usuario. Los permisos pueden revocarse en cualquier momento desde la configuración del dispositivo.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">V. Grabaciones de Audio y Video</h2>
            <p>La función SOS puede generar grabaciones almacenadas localmente en el dispositivo del usuario. Dichas grabaciones <strong>no son enviadas</strong> automáticamente a servidores de SOSecure, ni compartidas con contactos de emergencia, ni accesibles para otros usuarios o los desarrolladores de la plataforma. El usuario conserva el control total de los archivos locales.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">VI. Conservación de Datos</h2>
            <p>Los datos se conservarán durante el tiempo necesario para cumplir las finalidades descritas. Al solicitar eliminación de cuenta, se establece un período de 30 días para retractarse; transcurrido ese plazo, la información será eliminada. Las cuentas inactivas durante 180 días consecutivos podrán eliminarse automáticamente con notificación previa.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">VII. Seguridad de la Información</h2>
            <p>SOSecure implementa medidas técnicas, administrativas y organizativas razonables, incluyendo: protocolos seguros HTTPS, protección criptográfica de credenciales y restricción de accesos. Ningún sistema tecnológico puede garantizar seguridad absoluta.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">VIII. Transferencia de Datos</h2>
            <p>SOSecure no vende, renta ni comercializa datos personales. Los datos podrán ser tratados por proveedores tecnológicos sujetos a obligaciones de confidencialidad, o comunicados cuando exista obligación legal o requerimiento de autoridad competente.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">IX. Derechos ARCO</h2>
            <p>Los titulares podrán ejercer sus derechos de Acceso, Rectificación, Cancelación y Oposición enviando solicitud al correo: <strong>sosecure61@gmail.com</strong></p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">X. Menores de Edad</h2>
            <p>Los menores de edad podrán utilizar la plataforma bajo la supervisión, autorización y responsabilidad de sus padres, madres o tutores legales.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">XI. Modificaciones al Aviso</h2>
            <p>SOSecure podrá modificar el presente Aviso de Privacidad para adaptarlo a cambios legales, tecnológicos u operativos. Las modificaciones serán publicadas a través de los medios oficiales de la plataforma.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">XII. Aceptación</h2>
            <p>La utilización de SOSecure implica el conocimiento y aceptación del presente Aviso de Privacidad.</p>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t text-center text-xs text-muted-foreground">
          <p>SOSecure — Celaya, Guanajuato, México</p>
          <p className="mt-1">Contacto: sosecure61@gmail.com</p>
        </div>
      </div>
    </div>
  )
}
