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
              <li><strong>Datos de identificación:</strong> Nombre completo, correo electrónico y número telefónico, cuando sean proporcionados por el usuario.</li>
              <li><strong>Datos técnicos y de uso:</strong> Dirección IP, información del sistema operativo y registros de acceso.</li>
              <li><strong>Datos de ubicación:</strong> Información de geolocalización del dispositivo cuando el usuario otorgue los permisos correspondientes.</li>
              <li><strong>Datos de contactos de emergencia:</strong> Nombre del contacto y correo electrónico del contacto.</li>
              <li><strong>Datos generados por el uso:</strong> Historial de mensajes, registros de actividad, reportes generados e información relacionada con alertas SOS.</li>
              <li><strong>Datos de audio y video:</strong> Cuando el usuario active una función SOS que requiera el uso del micrófono o la cámara, SOSecure podrá generar grabaciones de audio y video conforme al funcionamiento de la aplicación.</li>
            </ul>
            <p className="mt-2">SOSecure no solicita ni utiliza identificadores persistentes como IMEI, IMSI o número de serie de la tarjeta SIM para vincularlos con la identidad, ubicación u otros datos personales del usuario.</p>
            <p className="mt-1">El acceso a la ubicación, cámara y micrófono se realizará únicamente cuando resulte necesario para una función de la aplicación y conforme a los permisos otorgados por el usuario.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">III. Finalidades del Tratamiento</h2>
            <p><strong>Finalidades primarias:</strong></p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Crear y administrar cuentas de usuario.</li>
              <li>Gestionar contactos de emergencia y operar la función SOS.</li>
              <li>Enviar alertas y notificaciones de emergencia.</li>
              <li>Habilitar la mensajería privada.</li>
              <li>Mostrar información dentro del mapa comunitario.</li>
              <li>Utilizar la ubicación para las funciones de seguridad, alertas SOS y mapa comunitario.</li>
              <li>Utilizar el micrófono y la cámara cuando el usuario active una función que requiera dichos recursos.</li>
              <li>Mantener la seguridad de la plataforma y cumplir obligaciones legales.</li>
            </ul>
            <p className="mt-2"><strong>Finalidades secundarias:</strong></p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Elaboración de estadísticas y análisis de uso.</li>
              <li>Desarrollo de nuevas funcionalidades y mejoras de rendimiento.</li>
            </ul>
            <p className="mt-2">El usuario podrá manifestar su negativa al tratamiento de sus datos para las finalidades secundarias mediante <strong>sosecure61@gmail.com</strong>.</p>
            <p className="mt-1">Los datos personales serán utilizados únicamente para las finalidades informadas en el presente Aviso de Privacidad. Cuando se pretenda utilizarlos para una finalidad distinta, se solicitará el consentimiento correspondiente cuando resulte necesario conforme a la legislación aplicable.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">IV. Geolocalización</h2>
            <p>SOSecure podrá acceder a la ubicación del usuario cuando éste otorgue los permisos correspondientes, para activación de funciones SOS, generación de alertas y funcionamiento del mapa comunitario.</p>
            <p className="mt-1">La ubicación podrá utilizarse para determinar la posición del dispositivo y proporcionar las funciones de seguridad que requieran dicha información.</p>
            <p className="mt-1">Cuando una función de emergencia requiera comunicar la ubicación del usuario, ésta podrá ser enviada a los contactos de emergencia que el propio usuario haya registrado para dicha finalidad.</p>
            <p className="mt-1">SOSecure no utilizará la ubicación para fines publicitarios.</p>
            <p className="mt-1">Los permisos pueden revocarse en cualquier momento desde la configuración del dispositivo. La revocación de un permiso puede impedir el funcionamiento de las funciones que dependan de la ubicación.</p>
            <p className="mt-1">SOSecure no utiliza la ubicación en segundo plano cuando la aplicación no se encuentra en uso, de acuerdo con el funcionamiento actual de la aplicación.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">V. Grabaciones de Audio y Video</h2>
            <p>La función SOS puede generar grabaciones almacenadas localmente en el dispositivo del usuario.</p>
            <p className="mt-1">Dichas grabaciones <strong>no son enviadas</strong> automáticamente a servidores de SOSecure, ni compartidas con contactos de emergencia, ni accesibles para otros usuarios o los desarrolladores de la plataforma.</p>
            <p className="mt-1">El usuario conserva el control de los archivos almacenados localmente en su dispositivo.</p>
            <p className="mt-1">El acceso al micrófono y a la cámara estará sujeto a los permisos otorgados por el usuario y se limitará a las funciones de SOS que requieran dichos recursos.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">VI. Conservación de Datos</h2>
            <p>Los datos se conservarán durante el tiempo necesario para cumplir las finalidades descritas, atender las obligaciones legales aplicables y proporcionar los servicios solicitados por el usuario.</p>
            <p className="mt-1">Cuando el usuario solicite la eliminación de su cuenta, SOSecure eliminará los datos personales asociados a dicha cuenta conforme al procedimiento establecido, salvo aquellos datos cuya conservación resulte necesaria por obligación legal. Al solicitar la eliminación, la cuenta pasa a un periodo de gracia de <strong>30 días</strong> durante el cual el usuario puede retractarse iniciando sesión nuevamente, lo que cancela la eliminación de forma automática; hasta entonces la cuenta sigue funcionando con normalidad. Transcurrido ese plazo sin que el usuario inicie sesión, los datos se eliminan de forma permanente.</p>
            <p className="mt-1">Las cuentas inactivas durante 180 días consecutivos podrán eliminarse automáticamente con notificación previa.</p>
            <p className="mt-1">Para solicitar la eliminación de la cuenta y de los datos asociados, el usuario podrá hacerlo desde la aplicación mediante <strong>Ajustes → Cuenta → Eliminar cuenta</strong>, o mediante el siguiente recurso web sin necesidad de iniciar sesión: <a href="https://sosecure.site/solicitar-eliminacion" className="text-primary hover:underline">sosecure.site/solicitar-eliminacion</a>.</p>
            <p className="mt-1">Los archivos de audio y video almacenados exclusivamente de forma local en el dispositivo del usuario no forman parte de los servidores de SOSecure y su eliminación dependerá del usuario y de las funciones disponibles en su dispositivo.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">VII. Seguridad de la Información</h2>
            <p>SOSecure implementa medidas técnicas, administrativas y organizativas razonables, incluyendo: protocolos seguros HTTPS, protección criptográfica de credenciales y restricción de accesos.</p>
            <p className="mt-1">El acceso a los datos personales estará limitado a las personas y sistemas que lo requieran para proporcionar las funciones de SOSecure.</p>
            <p className="mt-1">Ningún sistema tecnológico puede garantizar seguridad absoluta.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">VIII. Transferencia de Datos</h2>
            <p>SOSecure no vende, renta ni comercializa datos personales.</p>
            <p className="mt-1">Los datos podrán ser tratados por proveedores tecnológicos sujetos a obligaciones de confidencialidad cuando resulte necesario para proporcionar, mantener, proteger o mejorar los servicios de SOSecure.</p>
            <p className="mt-1">Los datos también podrán ser comunicados cuando exista obligación legal, requerimiento de una autoridad competente o cuando dicha comunicación resulte necesaria para proporcionar una función solicitada por el usuario.</p>
            <p className="mt-1">Cuando el usuario active una alerta SOS que requiera comunicar su ubicación u otra información a sus contactos de emergencia, dicha comunicación se realizará conforme a la función utilizada y a los datos que el usuario haya proporcionado para ese propósito.</p>
            <p className="mt-1">SOSecure no compartirá datos personales para fines publicitarios ajenos a las funciones de la plataforma.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">IX. Derechos ARCO</h2>
            <p>Los titulares podrán ejercer sus derechos de Acceso, Rectificación, Cancelación y Oposición enviando solicitud al correo: <strong>sosecure61@gmail.com</strong>.</p>
            <p className="mt-2">La solicitud deberá contener, como mínimo:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Nombre del titular.</li>
              <li>Medio para recibir la respuesta.</li>
              <li>Derecho que desea ejercer.</li>
              <li>Descripción clara de la solicitud.</li>
              <li>Información que permita identificar los datos personales relacionados con la solicitud.</li>
              <li>En su caso, documentación necesaria para acreditar la identidad del solicitante.</li>
            </ul>
            <p className="mt-2">SOSecure atenderá las solicitudes conforme a los requisitos y plazos establecidos por la legislación aplicable.</p>
            <p className="mt-1">El titular también podrá solicitar la revocación de su consentimiento cuando el tratamiento dependa de dicho consentimiento. La revocación podrá impedir el uso de determinadas funciones de SOSecure cuando éstas requieran los datos o permisos correspondientes.</p>
            <p className="mt-1">Para limitar el uso o divulgación de sus datos personales, el titular podrá solicitarlo mediante el mismo correo electrónico.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">X. Menores de Edad</h2>
            <p>Los menores de edad podrán utilizar la plataforma bajo la supervisión, autorización y responsabilidad de sus padres, madres o tutores legales.</p>
            <p className="mt-1">Cuando el tratamiento de datos personales de un menor requiera el consentimiento de quien ejerza la patria potestad, tutela o representación legal, SOSecure aplicará los mecanismos correspondientes conforme a la legislación aplicable.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">XI. Modificaciones al Aviso</h2>
            <p>SOSecure podrá modificar el presente Aviso de Privacidad para adaptarlo a cambios legales, tecnológicos u operativos.</p>
            <p className="mt-1">Las modificaciones serán publicadas a través de los medios oficiales de la plataforma y estarán disponibles en la página de Aviso de Privacidad de SOSecure.</p>
            <p className="mt-1">Cuando una modificación implique cambios relevantes en la forma en que SOSecure trata los datos personales, se informará a los usuarios mediante los medios disponibles y, cuando corresponda, se solicitará nuevamente el consentimiento requerido.</p>
            <p className="mt-1">La fecha de última actualización será indicada en el presente Aviso de Privacidad.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">XII. Aceptación</h2>
            <p>La utilización de SOSecure implica el conocimiento del presente Aviso de Privacidad.</p>
            <p className="mt-1">Cuando una función requiera acceso a datos personales, ubicación, cámara, micrófono u otra información que requiera autorización, SOSecure informará al usuario sobre la finalidad correspondiente y solicitará los permisos necesarios mediante la aplicación y el sistema operativo.</p>
            <p className="mt-1">El usuario podrá negar o revocar los permisos del dispositivo. La negativa o revocación podrá impedir el uso de las funciones que dependan de dichos permisos.</p>
            <p className="mt-1">El tratamiento de datos personales se realizará conforme a las finalidades informadas en este Aviso de Privacidad y a la legislación aplicable.</p>
          </section>

          <p className="text-xs text-muted-foreground pt-2">Última actualización: 21/08/2026</p>

        </div>

        <div className="mt-10 pt-6 border-t text-center text-xs text-muted-foreground">
          <p>SOSecure — Celaya, Guanajuato, México</p>
          <p className="mt-1">Contacto: sosecure61@gmail.com</p>
        </div>
      </div>
    </div>
  )
}
