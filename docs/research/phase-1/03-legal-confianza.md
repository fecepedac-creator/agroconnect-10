# Marco legal y confianza

Fecha de corte: 14 de julio de 2026.

Este documento identifica decisiones de producto que requieren control. No reemplaza
un informe juridico de un abogado laboral, de datos personales y consumo en Chile.

## 1. Posicion juridica buscada

MundoConnect pretende realizar mera intermediacion entre oferta y demanda:

- La empresa usuaria define cargo, requisitos, remuneracion, horario y condiciones.
- La empresa decide a quien contratar y celebra el contrato directamente.
- El trabajador decide si expresa interes y con quien comparte contacto.
- MundoConnect no paga remuneraciones, no supervisa el trabajo y no controla jornada.

La Direccion del Trabajo reconoce la categoria de mera intermediacion que no participa
en la organizacion del trabajo ni decide condiciones o contratacion. Tambien advierte
que la calificacion depende de los hechos y de indicios de subordinacion/dependencia.

Fuente: [Dictamen y explicacion de la Direccion del Trabajo sobre plataformas](https://www.dt.gob.cl/portal/1627/w3-article-122872.html).

## 2. Funciones que aumentan riesgo laboral

Requieren revision juridica antes de implementarse:

- Asignar unilateralmente turnos o trabajadores.
- Fijar o negociar remuneraciones en nombre de las partes.
- Controlar entrada, salida, ubicacion continua o cumplimiento de instrucciones.
- Aplicar sanciones por rechazo, ausencia o rendimiento.
- Pagar al trabajador o facturar a la empresa por sus horas.
- Exigir exclusividad o disponibilidad minima.
- Proporcionar elementos de trabajo o asumir seguridad laboral.
- Presentarse comercialmente como proveedor de personal.

El lenguaje contractual no corrige una operacion que en los hechos funciona de otra
manera. Cada nueva funcion debe evaluarse por su efecto real.

## 3. Proteccion de datos

La Ley 21.719 fue publicada el 13 de diciembre de 2024 y entra en vigencia el 1 de
diciembre de 2026. Refuerza derechos, crea una Agencia de Proteccion de Datos Personales
y establece un marco mas robusto para tratamiento y perfilamiento.

Fuente: [Balance legislativo Ley 21.719, Biblioteca del Congreso Nacional](https://www.bcn.cl/balance-legislativo/detalle/ficha_LEY_21719_2024-12-13).

### Reglas de diseno recomendadas

- Recoger solo datos necesarios para el match y la seguridad.
- Separar aceptacion de terminos, autorizacion de contacto y comunicaciones de
  marketing.
- Informar finalidades con lenguaje breve antes de pedir los datos.
- Registrar version, fecha, canal y alcance del consentimiento.
- Separar crear perfil, producir recomendaciones, mostrar perfil limitado, revelar
  contacto y recibir marketing; una sola casilla de "acepto todo" no es suficiente.
- Permitir consultar, corregir, descargar y eliminar el perfil.
- Definir plazos de inactividad y eliminacion.
- No hacer publicos RUT, telefono, direccion exacta o documentos.
- Mostrar ubicacion aproximada hasta que exista aceptacion.
- Restringir busqueda y exportacion masiva por empresas.
- Mantener trazabilidad de quien accede a datos sensibles.
- Formalizar encargados de tratamiento y proveedores, incluidos servicios de IA.
- Preparar protocolo de incidentes y comunicacion.

## 4. Matching, explicabilidad y discriminacion

El ranking laboral puede generar exclusiones aunque no use explicitamente categorias
sensibles. Comuna, fotografia, historial, nombre o disponibilidad pueden actuar como
proxies.

Para el MVP:

- Utilizar criterios objetivos acordados: oficio, requisitos obligatorios,
  disponibilidad, distancia aproximada y preferencias.
- No incluir edad, sexo, fotografia, nacionalidad, discapacidad o situacion familiar
  en el puntaje general.
- Mostrar una explicacion breve de los factores relevantes.
- Permitir corregir datos y solicitar revision.
- Auditar tasas de recomendacion y contacto por grupos cuando exista base juridica para
  medir equidad.
- No generar listas negras compartidas.
- Separar hechos verificables de opiniones empresariales.
- Evitar inicialmente estrellas generales. Si se registra una ausencia o falta de
  respuesta, debe existir contexto, caducidad, derecho de respuesta y revision humana.

La Ley 21.719 contempla derechos frente a decisiones basadas en tratamiento
automatizado que produzcan efectos juridicos o afecten significativamente. Aunque el
ranking se presente como recomendacion, quedar sistematicamente fuera de resultados
puede afectar oportunidades. Antes del piloto se recomienda una evaluacion de impacto
del motor de match y un mecanismo simple de revision.

Fuentes:

- [Ley 21.719 y decisiones automatizadas](https://www.bcn.cl/leychile/Navegar?idNorma=1209272&idParte=10527471&idVersion=2026-12-01)
- [Codigo del Trabajo, articulo 2 y discriminacion](https://www.bcn.cl/leychile/navegar?idNorma=207436&idParte=8512448)

La DT destaca proteccion de datos y prohibicion de discriminacion por mecanismos
automatizados en el contexto regulado de plataformas. Aunque el encuadre exacto de
MundoConnect debe validarse, es un estandar prudente de producto.

## 5. Confianza y seguridad

### Empresas

- Verificar identidad legal, RUT, representante y canal corporativo.
- Moderar la primera oferta y cambios de datos de pago/contacto.
- Exigir remuneracion y condiciones esenciales visibles.
- Prohibir cobros a trabajadores por postular o ser contactados.
- Canal para denunciar oferta falsa, discriminacion o condiciones distintas.

### Trabajadores

- Verificar telefono y controlar duplicados sin exponer el RUT.
- Permitir ocultar o pausar perfil.
- Evitar fotografias obligatorias salvo necesidad juridica demostrable.
- Ofrecer bloqueo de empresas y soporte accesible.
- No mostrar telefono hasta aceptacion o consentimiento especifico.

### Plataforma

- Registro de accesos y acciones administrativas.
- Limites de consultas, invitaciones y mensajes.
- Deteccion de scraping y uso anormal.
- Retencion limitada de documentos.
- Respuesta a incidentes y canal humano.

## 6. Contratos y documentos requeridos antes del piloto pagado

- Terminos para trabajadores.
- Terminos comerciales para empresas.
- Politica de privacidad y aviso resumido por pantalla.
- Acuerdo de tratamiento con proveedores tecnologicos pertinentes.
- Politica de publicaciones y contenido prohibido.
- Procedimiento de denuncias, suspension y apelacion.
- Declaracion clara de roles y responsabilidades laborales.
- Politica de retencion y eliminacion.

## 7. Lista para validacion con abogado

1. Confirmar que flujos de invitacion, match y contacto conservan mera intermediacion.
2. Revisar implicaciones especiales de intermediacion en trabajo agricola.
3. Revisar uso de RUT, antecedentes, certificaciones y geolocalizacion.
4. Validar bases de licitud y consentimiento bajo Ley 21.719.
5. Revisar decisiones automatizadas, explicacion y oposicion.
6. Revisar obligaciones de consumo y facturacion de suscripciones.
7. Definir responsabilidad ante ofertas fraudulentas y contenido empresarial.
8. Revisar transferencia internacional de datos y proveedores de IA.
9. Revisar objeto social, giro tributario y riesgo de empresa de servicios transitorios.
10. Revisar mensajeria por WhatsApp/SMS y separacion de comunicaciones operativas y
    promocionales.

## 8. Criterio de salida

No se debe iniciar una campana abierta ni cobrar suscripciones hasta tener terminos,
privacidad, verificacion empresarial, denuncia y eliminacion funcionales. El piloto de
investigacion puede utilizar datos minimos y consentimiento especifico, con acceso
restringido y sin publicacion abierta de perfiles.
