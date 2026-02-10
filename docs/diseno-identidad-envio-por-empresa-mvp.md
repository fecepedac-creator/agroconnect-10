# Diseño MVP — Identidad de envío por empresa (AgroConnect)

**Estado:** Propuesta de diseño (sin implementación)
**Fecha:** 2026-02-10
**Alcance:** Correos transaccionales salientes desde AgroConnect

---

## 1) Objetivo de negocio (simple)
Hoy AgroConnect envía desde una cuenta global. El objetivo es que cada empresa “se vea” en el correo, sin aumentar complejidad técnica ni costos operativos en esta etapa.

---

## 2) Alternativas evaluadas

### A) Sender global + Reply-To por empresa (**MVP recomendado**)
**Qué es:**
- Se mantiene un único emisor técnico (cuenta global de AgroConnect).
- Se configura por empresa un `Reply-To` y nombre visible.
- El cuerpo/firma del correo incluye identidad de la empresa.

**Evaluación:**
- **Complejidad técnica:** Baja.
- **Riesgo operativo:** Bajo (un solo canal de envío que ya existe).
- **Costos:** Bajos.
- **Escalabilidad:** Buena para etapa temprana.
- **Experiencia cliente:** Buena (responde directo a la empresa y la ve identificada).

### B) SMTP independiente por empresa (fase futura)
**Qué es:**
- Cada empresa usa su propio SMTP/proveedor/dominio para enviar.

**Evaluación:**
- **Complejidad técnica:** Alta (múltiples credenciales, validaciones, errores por tenant).
- **Riesgo operativo:** Alto (rotación de claves, cuentas mal configuradas, soporte).
- **Costos:** Medios/Altos (soporte + potencial infraestructura adicional).
- **Escalabilidad:** Compleja al inicio (cada empresa es un caso).
- **Experiencia cliente:** Muy buena cuando funciona, pero frágil en onboarding.

---

## 3) Decisión final para MVP

### ✅ Implementar ahora
**Alternativa A (sender global + Reply-To por empresa)**

### ⏭️ Dejar para fase futura
**Alternativa B (SMTP por empresa)**

> **Nota explícita:** **No se implementa SMTP por empresa en esta fase.**

---

## 4) Especificación funcional (sin código)

### 4.1 ¿Qué verá el destinatario?
Ejemplo esperado:
- **From:** `AgroConnect (Empresa X) <agroconnect@gmail.com>`
- **Reply-To:** `contacto@empresax.cl`
- **Asunto:** el de la plantilla actual

### 4.2 Identidad dentro del cuerpo
En cada correo debe aparecer claramente:
1. **Nombre de empresa** (encabezado o primera línea).
2. **Firma de empresa** al final del mensaje.
3. **Texto de responsabilidad** claro, por ejemplo:
   - “Este mensaje fue enviado a través de AgroConnect en nombre de Empresa X.”

### 4.3 Fallback seguro (si la empresa no configura datos)
Si faltan datos de identidad por empresa:
- Se usa remitente visible genérico: `AgroConnect`.
- Se usa Reply-To global de soporte/superadmin.
- Se usa firma estándar global.
- El envío **no se cae** por falta de configuración (prioridad: continuidad operativa).

---

## 5) Configuración mínima por empresa (solo diseño)
Campos propuestos:
- `replyToEmail`  
- `replyToName`  
- `senderDisplayName`  
- `footerSignature`  
- `isCommsEnabled` (opcional)

Reglas de uso (funcionales):
- Si `isCommsEnabled = false`, no se envían correos para esa empresa desde flujos empresariales.
- Si faltan campos opcionales, usar fallback global seguro.

---

## 6) Seguridad y gobernanza

### ¿Quién puede configurar?
- **Superadmin**: siempre.
- **CompanyAdmin**: solo su propia empresa (si el producto decide habilitarlo).

### ¿Qué NO se debe permitir en esta fase?
- Guardar passwords SMTP.
- Guardar API keys de proveedores de correo.
- Guardar secretos/certificados por empresa.
- Cualquier credencial de infraestructura en documentos de empresa.

Motivo: evitar riesgo de seguridad y carga operativa en MVP.

---

## 7) Plan por fases (resumen corto)

### Fase MVP (ahora)
- Emisor técnico global.
- Identidad visual por empresa + Reply-To por empresa.
- Fallback seguro para empresas sin configuración.

### Fase futura (si negocio lo justifica)
- Evaluar SMTP/proveedor por empresa con onboarding guiado, validaciones y monitoreo por tenant.

---

## 8) Criterio de éxito del MVP
1. El destinatario reconoce claramente a qué empresa corresponde el correo.
2. Al responder, el correo llega al contacto correcto de esa empresa.
3. El sistema mantiene estabilidad operacional y bajo costo.
4. No se agregan secretos por empresa ni complejidad innecesaria.

