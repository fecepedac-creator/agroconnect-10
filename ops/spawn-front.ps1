param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('security', 'tests', 'docs', 'product')]
  [string]$Front
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $repoRoot
$worktreeBase = Join-Path $workspaceRoot 'agroconnect-10-worktrees'
$targetDir = Join-Path $worktreeBase $Front
$branch = "codex/$Front"

New-Item -ItemType Directory -Force $worktreeBase | Out-Null

$exists = git -C $repoRoot worktree list | Select-String -Pattern [regex]::Escape($targetDir)
if (-not $exists) {
  git -C $repoRoot worktree add $targetDir -b $branch
}

if (Test-Path (Join-Path $targetDir 'package.json')) {
  Push-Location $targetDir
  npm install
  Pop-Location
}

if (Test-Path (Join-Path $targetDir 'functions\package.json')) {
  Push-Location (Join-Path $targetDir 'functions')
  npm install
  Pop-Location
}

Write-Host "Worktree ready: $targetDir ($branch)"
