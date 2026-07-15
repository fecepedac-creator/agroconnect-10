param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [Parameter(Mandatory = $true)][string]$ConfirmProject,
  [Parameter(Mandatory = $true)][string]$GitRef,
  [ValidateSet("hosting", "functions", "firestore")][string]$Component = "hosting",
  [switch]$Apply
)

$ErrorActionPreference = "Stop"
if ($ProjectId -ne $ConfirmProject) { throw "ConfirmProject debe coincidir exactamente con ProjectId." }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "git no esta disponible." }
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) { throw "firebase no esta disponible." }

& git rev-parse --verify "$GitRef^{commit}" *> $null
if ($LASTEXITCODE -ne 0) { throw "GitRef no existe localmente: $GitRef" }

$deployTarget = if ($Component -eq "firestore") { "firestore:rules,firestore:indexes" } else { $Component }
Write-Host "Rollback preparado: $GitRef -> $ProjectId ($deployTarget)"
Write-Host "Este script no cambia tu worktree. Ejecutalo desde un worktree limpio creado en GitRef."
if (-not $Apply) {
  Write-Host "Simulacion solamente. Agrega -Apply cuando HEAD sea exactamente GitRef."
  exit 0
}

$head = (& git rev-parse HEAD).Trim()
$target = (& git rev-parse "$GitRef^{commit}").Trim()
if ($head -ne $target) { throw "HEAD no coincide con GitRef. Crea un worktree aislado antes de aplicar." }
if ((& git status --porcelain)) { throw "El worktree debe estar limpio." }

if ($Component -eq "hosting") {
  & npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci fallo." }
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw "build frontend fallo." }
} elseif ($Component -eq "functions") {
  & npm --prefix functions ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci Functions fallo." }
  & npm --prefix functions test
  if ($LASTEXITCODE -ne 0) { throw "tests Functions fallaron." }
}

& firebase deploy --project $ProjectId --only $deployTarget
if ($LASTEXITCODE -ne 0) { throw "Rollback fallo con codigo $LASTEXITCODE." }
