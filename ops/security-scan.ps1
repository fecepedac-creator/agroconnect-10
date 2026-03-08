param(
  [switch]$RequireEnvMapping
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

$patterns = @(
  'ghp_[0-9A-Za-z]{36}',
  'gho_[0-9A-Za-z]{36}',
  'xox[baprs]-[0-9A-Za-z-]{10,}',
  '-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----'
)

$failed = $false
foreach ($p in $patterns) {
  $matches = git grep -n -E -e $p -- . ':!package-lock.json' ':!functions/package-lock.json' ':!build-output/**' ':!.env.example' ':!.env.local.example'

  if ($LASTEXITCODE -gt 1) {
    Write-Host "git grep failed for pattern: $p"
    $failed = $true
    continue
  }

  if ($LASTEXITCODE -eq 0 -and $matches) {
    Write-Host "Potential secret match for pattern: $p"
    Write-Host $matches
    $failed = $true
  }
}

$placeholders = Select-String -Path '.firebaserc' -Pattern 'REPLACE_WITH_'
if ($RequireEnvMapping -and $placeholders) {
  Write-Host 'Environment placeholders still present in .firebaserc'
  $failed = $true
} elseif ($placeholders) {
  Write-Host 'Warning: environment placeholders present in .firebaserc'
}

Pop-Location
if ($failed) { exit 1 }
Write-Host 'Security scan passed'
