---
name: skill-factory-agroconnect
description: Diseña, crea y mantiene skills de Codex para AgroConnect con un estándar único de calidad, seguridad y operación. Usar cuando se necesite crear una skill nueva, actualizar una skill existente, definir catálogos de skills por dominio (seguridad, CI/CD, Firebase, testing, go-live), o auditar que una skill del proyecto cumple plantillas y quality gates.
---

# Skill Factory AgroConnect

## Overview

Estandariza cómo se crean y evolucionan skills dentro de AgroConnect para evitar instrucciones ambiguas, duplicadas o difíciles de mantener. Fuerza una estructura mínima, quality gates y criterios de aceptación antes de usar una skill en desarrollo real.

## Workflow

1. Confirmar objetivo de la nueva skill
- Definir output concreto: qué problema resuelve y qué entrega produce.
- Definir límites: qué NO hace la skill.

2. Seleccionar tipo de skill
- `runbook`: pasos operativos repetibles (deploy, incidentes, release).
- `audit`: revisión con hallazgos y severidades.
- `builder`: crea/edita artefactos (pipelines, tests, docs).
- `domain-pack`: reglas por vertical (agro, construcción, seguridad).

3. Crear estructura base
- Crear carpeta: `skills/<skill-name>/`
- Incluir siempre: `SKILL.md`
- Incluir recomendado: `agents/openai.yaml`
- Incluir opcional según necesidad: `scripts/`, `references/`, `assets/`

4. Redactar `SKILL.md` con plantilla de AgroConnect
- Frontmatter: solo `name` y `description`.
- Description debe incluir disparadores de uso.
- Body debe estar en modo imperativo, sin relleno.
- Referenciar archivos específicos de `references/` cuando aplique.

5. Aplicar quality gates antes de publicar
- Validar naming y frontmatter.
- Verificar que no hay secretos ni datos sensibles.
- Confirmar comandos ejecutables y precondiciones.
- Confirmar outputs observables (archivo, diff, checklist, reporte).

6. Versionar e iterar
- Guardar cambios en rama `codex/<tema>`.
- Usar commits pequeños por skill.
- Después de uso real, ajustar la skill con feedback y casos límite.

## Required Standard

1. La skill debe declarar alcance explícito.
2. La skill debe tener al menos una sección de "Workflow" o "Quality Gates".
3. Toda decisión sensible (auth, reglas, prod) debe incluir rollback o mitigación.
4. Si usa scripts, el comando de ejecución debe estar documentado.
5. No incluir documentación decorativa (`README`, changelog interno de la skill).

## Skill Template (copy/paste)

```md
---
name: <skill-name>
description: <que hace + cuando usarla + triggers concretos>
---

# <Title>

## Overview
<1-3 lineas>

## Workflow
1. <paso>
2. <paso>
3. <paso>

## Quality Gates
1. <check tecnico>
2. <check seguridad>
3. <check salida verificable>
```

## Command Snippets

```powershell
# Inicializar una skill nueva (si tienes skill-creator disponible)
python C:\Users\fecep\.codex\skills\.system\skill-creator\scripts\init_skill.py <skill-name> --path C:\Users\fecep\OneDrive\Documentos\New project\agroconnect-10\skills --resources references,scripts

# Validar estructura minima de una skill
python C:\Users\fecep\.codex\skills\.system\skill-creator\scripts\quick_validate.py C:\Users\fecep\OneDrive\Documentos\New project\agroconnect-10\skills\<skill-name>
```

## References

- Catálogo de skills objetivo: `references/skill-catalog.md`
- Quality gates y aceptación: `references/quality-gates.md`