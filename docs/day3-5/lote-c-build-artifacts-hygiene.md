# Lote C - Higiene de Artefactos Build

Fecha: 2026-03-08

## Problema

El directorio `build-output/` estaba versionado, incluyendo bundles de frontend con configuraci�n de entorno embebida. Esto aumenta superficie de exposici�n y genera drift operacional.

## Cambios aplicados

1. `.gitignore`
- Se agrega `build-output/` para evitar nuevos commits de artefactos compilados.

2. �ndice Git
- Se remueven del versionado los archivos existentes en `build-output/` (`git rm --cached`).

## Impacto esperado

- Menor riesgo de exposici�n accidental de configuraci�n en bundles versionados.
- Historial de Git m�s limpio y enfocado en c�digo fuente.
- Reproducibilidad de build delegada a CI/CD en lugar de artefactos committeados.

## Rollback

1. Eliminar `build-output/` de `.gitignore`.
2. Reagregar artefactos con `git add build-output`.
3. Commit de reversi�n con justificaci�n expl�cita.
