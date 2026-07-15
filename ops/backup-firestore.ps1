param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [Parameter(Mandatory = $true)][string]$Bucket,
  [Parameter(Mandatory = $true)][string]$ConfirmProject,
  [switch]$Apply
)

$ErrorActionPreference = "Stop"

if ($ProjectId -ne $ConfirmProject) {
  throw "ConfirmProject debe coincidir exactamente con ProjectId."
}
if ($ProjectId -match '^(demo-|replace-|example)') {
  throw "No se permite exportar un identificador de demostracion."
}
if ($Bucket -notmatch '^gs://[a-z0-9][a-z0-9._-]+$') {
  throw "Bucket debe tener formato gs://nombre-bucket."
}
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw "gcloud no esta instalado o no esta disponible en PATH."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$destination = "$Bucket/firestore/$ProjectId/$timestamp"
Write-Host "Proyecto: $ProjectId"
Write-Host "Destino: $destination"

if (-not $Apply) {
  Write-Host "Simulacion solamente. Agrega -Apply para ejecutar el export."
  exit 0
}

& gcloud firestore export $destination --project $ProjectId --async
if ($LASTEXITCODE -ne 0) {
  throw "gcloud firestore export fallo con codigo $LASTEXITCODE."
}
Write-Host "Export solicitado. Verifica su estado en Cloud Console antes de un despliegue riesgoso."
