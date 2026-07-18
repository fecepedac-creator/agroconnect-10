[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$SourceProjectId,
  [Parameter(Mandatory = $true)][string]$SourceBucket,
  [Parameter(Mandatory = $true)][string]$ExportPath,
  [Parameter(Mandatory = $true)][ValidateSet("dev", "staging", "prod")][string]$TargetEnvironment,
  [Parameter(Mandatory = $true)][string]$TargetProjectId,
  [Parameter(Mandatory = $true)][string]$ExpectedTargetProjectId,
  [Parameter(Mandatory = $true)][string]$Confirmation,
  [switch]$AllowInPlace,
  [switch]$AllowProductionTarget,
  [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-ProjectId([string]$Value, [string]$Name) {
  if ($Value -notmatch '^[a-z][a-z0-9-]{4,28}[a-z0-9]$' -or $Value -match '^(demo-|example-|replace-|REPLACE_)') {
    throw "$Name no es un ID de proyecto GCP explicito y valido."
  }
}

function Normalize-Bucket([string]$Value, [string]$Name) {
  $normalized = $Value.TrimEnd('/')
  if ($normalized -notmatch '^gs://[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$') {
    throw "$Name debe tener formato gs://nombre-bucket y no puede incluir una ruta."
  }
  return $normalized
}

Assert-ProjectId $SourceProjectId "SourceProjectId"
Assert-ProjectId $TargetProjectId "TargetProjectId"
Assert-ProjectId $ExpectedTargetProjectId "ExpectedTargetProjectId"
$SourceBucket = Normalize-Bucket $SourceBucket "SourceBucket"
$ExportPath = $ExportPath.TrimEnd('/')

if ($TargetProjectId -cne $ExpectedTargetProjectId) {
  throw "Bloqueado: el proyecto destino no coincide con ExpectedTargetProjectId."
}
if (-not $ExportPath.StartsWith("$SourceBucket/firestore/", [System.StringComparison]::Ordinal)) {
  throw "Bloqueado: ExportPath debe estar dentro de $SourceBucket/firestore/."
}
if ($ExportPath -notmatch '^gs://[a-z0-9][a-z0-9._/-]+$') {
  throw "ExportPath no es una ruta gs:// valida."
}
if ($SourceProjectId -ceq $TargetProjectId -and -not $AllowInPlace) {
  throw "Restauracion in-place bloqueada. Use otro proyecto destino o agregue -AllowInPlace tras aprobar el riesgo."
}
if ($TargetEnvironment -eq "prod" -and -not $AllowProductionTarget) {
  throw "Restauracion a produccion bloqueada. Requiere -AllowProductionTarget y aprobacion de incidente."
}

$requiredConfirmation = "RESTORE $TargetProjectId FROM $ExportPath"
if ($Confirmation -cne $requiredConfirmation) {
  throw "Confirmacion invalida. Debe ser exactamente: $requiredConfirmation"
}

Write-Host "Source project: $SourceProjectId"
Write-Host "Export path:    $ExportPath"
Write-Host "Target:         $TargetEnvironment / $TargetProjectId"
Write-Host "In-place:       $($SourceProjectId -ceq $TargetProjectId)"

if (-not $Apply) {
  Write-Host "Dry-run completado. Agregue -Apply solo durante una restauracion aprobada."
  exit 0
}
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw "gcloud no esta instalado o no esta disponible en PATH."
}

& gcloud firestore import $ExportPath --project=$TargetProjectId --database="(default)"
if ($LASTEXITCODE -ne 0) {
  throw "gcloud firestore import fallo con codigo $LASTEXITCODE."
}
Write-Host "Import finalizado. Ejecute la verificacion de integridad y el smoke post-restore."

