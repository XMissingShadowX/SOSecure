import Link from 'next/link'
import { Shield, ArrowLeft } from 'lucide-react'

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/auth/sign-up" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Términos y Condiciones de Uso</h1>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">SOSecure — Celaya, Guanajuato, México</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-semibold mb-2">I. Aceptación de los Términos</h2>
            <p>Los presentes Términos y Condiciones regulan el acceso, uso y funcionamiento de la plataforma tecnológica SOSecure, incluyendo la aplicación móvil, sitio web y cualquier servicio relacionado.</p>
            <p className="mt-2">Al registrarse, acceder o utilizar la plataforma, el usuario declara haber leído, comprendido y aceptado íntegramente estos Términos y Condiciones. Si el usuario no está de acuerdo con alguna disposición aquí contenida, deberá abstenerse de utilizar la plataforma.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">II. Definiciones</h2>
            <ul className="space-y-1">
              <li><strong>SOSecure:</strong> La plataforma tecnológica objeto de este documento.</li>
              <li><strong>Usuario:</strong> Toda persona que acceda o utilice la plataforma.</li>
              <li><strong>Cuenta:</strong> Registro individual creado por el usuario para acceder a las funcionalidades.</li>
              <li><strong>Reporte comunitario:</strong> Información relacionada con incidentes compartida por usuarios dentro de la plataforma.</li>
              <li><strong>Contacto de emergencia:</strong> Persona registrada por el usuario para recibir notificaciones SOS.</li>
              <li><strong>Alerta SOS:</strong> Función de emergencia disponible dentro de la plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">III. Objeto de la Plataforma</h2>
            <p>SOSecure es una herramienta tecnológica orientada a facilitar funciones de seguridad personal, comunicación preventiva y colaboración comunitaria mediante herramientas digitales. La plataforma tiene fines informativos, preventivos y de apoyo.</p>
            <p className="mt-2"><strong>SOSecure no constituye un servicio de seguridad pública, una corporación policial, una autoridad gubernamental ni un servicio médico de emergencia.</strong></p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">IV. Registro de Usuarios</h2>
            <p>Para utilizar determinadas funcionalidades será necesario crear una cuenta. El usuario se compromete a: proporcionar información veraz, mantener actualizados sus datos, resguardar sus credenciales de acceso y notificar cualquier uso no autorizado de su cuenta.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">V. Función SOS</h2>
            <p>La función SOS puede activarse mediante pulsación prolongada, comandos de voz o secuencias de botones configuradas en la aplicación. Una vez activada:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Se generará un registro asociado al evento.</li>
              <li>Se iniciará una grabación local de audio y video de aproximadamente 30 segundos.</li>
              <li>Se enviará una notificación automática a los contactos prioritarios registrados, incluyendo nombre del usuario, ubicación aproximada y aviso de activación.</li>
            </ul>
            <p className="mt-2">Las grabaciones permanecerán almacenadas localmente en el dispositivo. SOSecure no envía automáticamente dichas grabaciones a terceros.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">VI. Contactos de Emergencia</h2>
            <p>Al registrar un contacto, el usuario declara contar con autorización suficiente para proporcionar la información correspondiente. SOSecure no será responsable por errores derivados de información incorrecta proporcionada por el usuario.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">VII. Reportes Comunitarios</h2>
            <p>Los usuarios podrán generar reportes de incidentes. La información visible para otros usuarios se limitará a: categoría del incidente, fecha del reporte y ubicación aproximada. La identidad del usuario que realizó el reporte no será mostrada públicamente.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">VIII. Obligaciones del Usuario</h2>
            <p>El usuario se compromete a: utilizar la plataforma conforme a la ley, actuar de buena fe, respetar los derechos de terceros, utilizar información veraz y mantener actualizada la información de su cuenta.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">IX. Conductas Prohibidas</h2>
            <p>Queda prohibido: generar reportes falsos o engañosos, difundir información ilícita, utilizar la plataforma para acosar, amenazar o intimidar, compartir contenido discriminatorio, realizar actividades fraudulentas, intentar acceder a cuentas ajenas, alterar el funcionamiento de la plataforma o utilizarla para fines delictivos.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">X. No Sustitución de Servicios de Emergencia</h2>
            <p>SOSecure <strong>no sustituye</strong> a las autoridades de seguridad pública, servicios de emergencia, protección civil, instituciones médicas ni autoridades gubernamentales. Ante una situación de emergencia real, el usuario deberá contactar directamente a las autoridades competentes.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">XI. Planes y Suscripciones</h2>
            <p>SOSecure podrá ofrecer modalidades gratuitas, planes Premium, Familiares, Anuales u otros. Los pagos podrán procesarse mediante Google Play, App Store, PayPal u otros proveedores autorizados. SOSecure no almacena información financiera completa ni datos completos de tarjetas bancarias.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">XII. Eliminación de Cuentas</h2>
            <p>El usuario podrá solicitar la eliminación de su cuenta en cualquier momento. Existirá un periodo de 30 días para retractarse; finalizado dicho plazo, la información será eliminada. Las cuentas inactivas durante 180 días consecutivos podrán eliminarse automáticamente previa notificación.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">XIII. Propiedad Intelectual</h2>
            <p>El código fuente, interfaces gráficas, diseños, documentación, textos, imágenes, bases de datos, logotipos y demás contenidos originales desarrollados para SOSecure están protegidos por la legislación aplicable en materia de derechos de autor. Queda prohibida su reproducción, distribución, modificación, descompilación o explotación sin autorización previa y por escrito de sus titulares.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">XIV. Limitación de Responsabilidad</h2>
            <p>SOSecure se proporciona "tal como está". En la máxima medida permitida por la legislación aplicable, SOSecure no será responsable por: decisiones tomadas por usuarios con base en información publicada por terceros, interrupciones del servicio, errores tecnológicos, fallas de conectividad, eventos de fuerza mayor ni pérdida de información ocasionada por factores ajenos al control razonable de la plataforma.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">XV. Menores de Edad</h2>
            <p>Los menores de edad podrán utilizar la plataforma bajo la supervisión y responsabilidad de sus padres o tutores legales. SOSecure no puede verificar de forma independiente la autorización otorgada por dichos responsables.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">XVI. Modificaciones</h2>
            <p>SOSecure podrá modificar los presentes Términos y Condiciones para adaptarlos a cambios legales, tecnológicos, comerciales u operativos. Las modificaciones serán publicadas mediante los medios oficiales de la plataforma.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">XVII. Legislación Aplicable y Jurisdicción</h2>
            <p>Los presentes Términos y Condiciones se regirán por las leyes aplicables de los Estados Unidos Mexicanos. Cualquier controversia será sometida a la jurisdicción de los tribunales competentes de Celaya, Guanajuato, México.</p>
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
