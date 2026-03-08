# Lote A - Test Execution Notes

Fecha: 2026-03-08

## Implementado

- Suite de reglas: `tests/firestore.rules.test.mjs`
- Scripts:
  - `npm run test:rules`
  - `npm run test:rules:local`
- Dependencias agregadas en `package.json`:
  - `@firebase/rules-unit-testing`
  - `firebase-tools`

## Estado de ejecución local

1. `npm run test:rules:local`
- Resultado: carga correcta de suite/dependencias, pero requiere emulador Firestore activo (`host/port`).

2. `npm run test:rules`
- Resultado: intenta levantar emulador, pero falla por runtime Java local (`Firestore Emulator exited with code 1`).

## Bloqueador actual

- Entorno local sin runtime Java funcional para Firestore Emulator.

## Siguiente paso para ejecutar end-to-end

1. Instalar/ajustar Java (JDK 21 recomendado por firebase-tools).
2. Ejecutar:

```bash
npm run test:rules
```

3. Verificar resultado esperado de 10/10 casos (5 abuso fail + 5 legítimos pass).
