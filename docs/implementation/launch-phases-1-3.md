# MundoConnect: puesta en marcha, fases 1 a 3

Fecha de decision: 15 de julio de 2026.

## Fase 1: celula piloto

### Alcance aprobado

- Marca e infraestructura: MundoConnect.
- Vertical operativa inicial: AgroConnect.
- Territorio: San Clemente, con radio operativo definido por cada oferta.
- Ocupaciones iniciales: cosecha, packing y poda.
- Empresas ancla requeridas antes de captar trabajadores: 3.
- Ofertas reales requeridas antes de abrir campana: 5.
- SeguridadConnect permanece habilitado para pruebas funcionales y entrevistas, pero no
  se promociona masivamente durante el piloto agricola.

San Clemente es una hipotesis operativa, no una expansion regional. Si no se consiguen
tres empresas con necesidades proximas, el piloto no se abre a trabajadores y se
revisa San Javier como segunda celula candidata.

### Matriz de sectores

| Sector | Estado | Prueba exigida |
|---|---|---|
| AgroConnect | Piloto operativo | Registro, ofertas, postulacion, match y empresa |
| SeguridadConnect | Beta funcional | Registro, ofertas y portal empresa compartido |
| Construccion, salud, transporte, forestal, retail, logistica, aseo B2B, servicios, turismo e industria | Investigacion | Navegacion, contenido y estado `En preparacion` |

Las areas en investigacion no muestran ofertas ficticias ni permiten registrar una
postulacion sectorial hasta que exista una celula aprobada para ese rubro.

### Criterios de cierre

1. Alcance territorial y ocupacional documentado.
2. Matriz de sectores incorporada a los E2E.
3. Lista de empresas ancla gestionada fuera de datos personales productivos.
4. Captacion de trabajadores bloqueada comercialmente hasta confirmar demanda.

## Fase 2: cierre tecnico del MVP

### Bloqueadores P0

- Produccion no usa trabajadores, empresas ni ofertas demo como fallback.
- Auth, Firestore y Functions se prueban en emuladores aislados.
- Los recorridos de trabajador se verifican para agricultura y seguridad.
- El portal empresa compartido se verifica con membresia y datos aislados.
- Las paginas de expansion declaran de forma visible que estan en preparacion.
- CI ejecuta lint, build, Functions, reglas y E2E.

### Matriz E2E minima

| Actor | Agro | Seguridad | Expansion |
|---|---|---|---|
| Visitante | Landing y acceso directo | Landing y acceso directo | Landing `En preparacion` |
| Trabajador | Registro y portal | Registro y portal | No habilitado |
| Empresa | Acceso, dashboard y oferta agro | Acceso, dashboard y oferta seguridad | Solicitud de incorporacion |

## Fase 3: confianza, legalidad y operacion

### Entregables

- Consentimiento versionado y separado entre servicio y marketing.
- Terminos y privacidad accesibles durante el registro.
- Protocolo de verificacion empresarial.
- Procedimiento de denuncias, suspension y apelacion.
- Procedimiento de acceso, correccion y eliminacion de datos.
- Runbook de soporte e incidentes.

### Dependencias externas que bloquean un lanzamiento pagado

- Razon social, RUT, domicilio y correo legal definitivos del operador.
- Revision por abogado chileno laboral, datos personales y consumo.
- Proyectos Firebase separados para staging y produccion.
- Contrato comercial y mecanismo de facturacion aprobados.

## Gate de salida a piloto cerrado

El piloto solo puede abrirse cuando:

- No existen hallazgos P0 abiertos.
- Los E2E de AgroConnect, SeguridadConnect y portal empresa estan verdes.
- Existe respaldo y rollback probado.
- Terminos, privacidad, denuncias y soporte tienen responsables reales.
- Hay tres empresas verificadas y cinco ofertas con fechas proximas.

