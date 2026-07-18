[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidateSet("staging", "prod")][string]$Environment,
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [Parameter(Mandatory = $true)][string]$Bucket,
  [Parameter(Mandatory = $true)][string]$ExpectedProjectId,
  [Parameter(Mandatory = $true)][string]$ExpectedBucket,
  [Parameter(Mandatory = $true)][string]$Confirmation,
  [string]$RunId = "local",
  [string]$MetadataPath,
  [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-ProjectId([string]$Value, [string]$Name) {
  if ($Value -notmatch '^[a-z][a-z0-9-]{4,28}[a-z0-9]$') {
    throw "$Name no es un ID de proyecto GCP valido."
  }
  if ($Value -match '^(demo-|example-|replace-|REPLACE_)') {
    throw "$Name no puede ser un identificador de demostracion o placeholder."
  }
}

function Normalize-Bucket([string]$Value, [string]$Name) {
  $normalized = $Value.TrimEnd('/')
  if ($normalized -notmatch '^gs://[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$') {
    throw "$Name debe tener formato gs://nombre-bucket y no puede incluir una ruta."
  }
  return $normalized
}

Assert-ProjectId $ProjectId "ProjectId"
Assert-ProjectId $ExpectedProjectId "ExpectedProjectId"
$Bucket = Normalize-Bucket $Bucket "Bucket"
$ExpectedBucket = Normalize-Bucket $ExpectedBucket "ExpectedBucket"

if ($ProjectId -cne $ExpectedProjectId) {
  throw "Bloqueado: ProjectId no coincide exactamente con el proyecto esperado para $Environment."
}
if ($Bucket -cne $ExpectedBucket) {
  throw "Bloqueado: Bucket no coincide exactamente con el bucket esperado para $Environment."
}

$requiredConfirmation = "BACKUP $ProjectId TO $Bucket"
if ($Confirmation -cne $requiredConfirmation) {
  throw "Confirmacion invalida. Debe ser exactamente: $requiredConfirmation"
}

$safeRunId = ($RunId -replace '[^A-Za-z0-9._-]', '-')
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$destination = "$Bucket/firestore/$Environment/$ProjectId/$timestamp-$safeRunId"
$metadata = [ordered]@{
  schemaVersion = 1
  operation = "firestore-export"
  environment = $Environment
  projectId = $ProjectId
  bucket = $Bucket
  destination = $destination
  runId = $RunId
  requestedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
  applied = [bool]$Apply
  status = if ($Apply) { "requested" } else { "dry-run" }
}

Write-Host "Environment: $Environment"
Write-Host "Project:     $ProjectId"
Write-Host "Destination: $destination"

if ($Apply) {
  if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    throw "gcloud no esta instalado o no esta disponible en PATH."
  }

  $output = & gcloud firestore export $destination --project=$ProjectId --database="(default)" --format=json 2>&1
  $exitCode = $LASTEXITCODE
  $metadata["gcloudOutput"] = ($output | Out-String).Trim()
  $metadata["completedAtUtc"] = (Get-Date).ToUniversalTime().ToString("o")
  if ($exitCode -ne 0) {
    $metadata["status"] = "failed"
  } else {
    $metadata["status"] = "completed"
  }

  if ($MetadataPath) {
    $metadata | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $MetadataPath -Encoding UTF8
  }
  if ($exitCode -ne 0) {
    throw "gcloud firestore export fallo con codigo $exitCode."
  }
} elseif ($MetadataPath) {
  $metadata | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $MetadataPath -Encoding UTF8
}

Write-Host "Firestore export status: $($metadata.status)"
Write-Host "Export path: $destination"

