---
name: cost-performance-firebase
description: Optimiza costos y rendimiento de Firebase en AgroConnect (Firestore queries, indexes, Functions y uso de recursos). Usar cuando existan consultas lentas/caras, crecimiento de usuarios o antes de escalar a nuevos verticales.
---

# Cost Performance Firebase

## Overview

Orienta decisiones tecnicas para mantener latencia y costo bajo control mientras crece el volumen de operaciones. Prioriza acciones con mayor retorno costo/rendimiento.

## Workflow

1. Medir hotspots
- Identificar consultas repetidas y costosas.
- Revisar triggers Functions de alta frecuencia.
- Detectar lecturas innecesarias en frontend.

2. Optimizar modelo de acceso
- Ajustar indices y orden de filtros.
- Reducir lecturas redundantes y payloads.
- Separar datos publicos y privados para consultas eficientes.

3. Optimizar Functions
- Aplicar idempotencia y evitar trabajo duplicado.
- Minimizar llamadas externas costosas.
- Ajustar retries/timeouts segun criticidad.

4. Definir budget guardrails
- Establecer KPI de costo/latencia.
- Definir umbrales de alerta y acciones correctivas.

## Quality Gates

1. Cada optimizacion reporta impacto esperado y medido.
2. Cambios de query tienen plan de indice asociado.
3. No se degrada seguridad por ahorrar costo.
4. Existe monitoreo de costo y latencia post-cambio.

## References

- KPI base: `references/kpi-baseline.md`
- Playbook de optimizacion: `references/optimization-playbook.md`