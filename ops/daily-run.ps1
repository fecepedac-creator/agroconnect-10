param(
  [string]$ReportDate = (Get-Date -Format 'yyyy-MM-dd')
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$reportDir = Join-Path $repoRoot 'docs\reports'
New-Item -ItemType Directory -Force $reportDir | Out-Null
$reportPath = Join-Path $reportDir ("$ReportDate.md")

$results = @()

function Run-Step {
  param(
    [string]$Name,
    [string]$Command,
    [string]$Workdir
  )

  $start = Get-Date
  try {
    Push-Location $Workdir
    Invoke-Expression $Command
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed with exit code $LASTEXITCODE"
    }
    $status = 'PASS'
    $notes = ''
  }
  catch {
    $status = 'FAIL'
    $notes = $_.Exception.Message
  }
  finally {
    Pop-Location
  }

  $duration = [math]::Round(((Get-Date) - $start).TotalSeconds, 2)
  $results += [pscustomobject]@{
    Name = $Name
    Status = $status
    DurationSec = $duration
    Notes = $notes
  }
}

Run-Step -Name 'Frontend install' -Command 'npm ci' -Workdir $repoRoot
Run-Step -Name 'Firestore rules' -Command 'npm run test:rules' -Workdir $repoRoot
Run-Step -Name 'Frontend lint' -Command 'npm run lint' -Workdir $repoRoot
Run-Step -Name 'Frontend build' -Command 'npm run build' -Workdir $repoRoot
Run-Step -Name 'Functions install' -Command 'npm ci' -Workdir (Join-Path $repoRoot 'functions')
Run-Step -Name 'Functions lint' -Command '$env:ESLINT_USE_FLAT_CONFIG="false"; npm run lint' -Workdir (Join-Path $repoRoot 'functions')
Run-Step -Name 'Functions build' -Command 'npm run build' -Workdir (Join-Path $repoRoot 'functions')
Run-Step -Name 'Security scan' -Command 'powershell -ExecutionPolicy Bypass -File ops\security-scan.ps1' -Workdir $repoRoot

$passCount = ($results | Where-Object { $_.Status -eq 'PASS' }).Count
$failCount = ($results | Where-Object { $_.Status -eq 'FAIL' }).Count

$lines = @()
$lines += '# Daily Ops Report'
$lines += ''
$lines += "Date: $ReportDate"
$lines += "Generated: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))"
$lines += ''
$lines += "Summary: $passCount passed / $failCount failed"
$lines += ''
$lines += '| Check | Status | Duration (s) | Notes |'
$lines += '|---|---|---:|---|'
foreach ($r in $results) {
  $note = ($r.Notes -replace "\r|\n", ' ').Trim()
  $lines += "| $($r.Name) | $($r.Status) | $($r.DurationSec) | $note |"
}

$lines -join "`n" | Set-Content -Encoding UTF8 $reportPath
Write-Host "Report written: $reportPath"
if ($failCount -gt 0) {
  exit 1
}
