param(
  [switch]$RequireEnvMapping,
  [switch]$SkipHistory
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
  # Keep this expression in one argument so git never emits matching content.
  $secretPattern = @(
    'AIza[0-9A-Za-z_-]{35}',
    'GOCSPX-[0-9A-Za-z_-]{20,}',
    'gh[pousr]_[0-9A-Za-z]{36,255}',
    'github_pat_[0-9A-Za-z_]{20,255}',
    'xox[baprs]-[0-9A-Za-z-]{10,}',
    'AKIA[0-9A-Z]{16}',
    '-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----'
  ) -join '|'
  $sensitiveAssignmentPattern = '(API_KEY|PASSWORD|ACCESS_TOKEN|CLIENT_SECRET|PRIVATE_KEY)[[:space:]]*=[[:space:]]*[^[:space:]#]+'

  $excludedPaths = @(
    ':!package-lock.json',
    ':!functions/package-lock.json',
    ':!build-output/**',
    ':!dist/**',
    ':!node_modules/**',
    ':!*.example',
    ':!**/*.example'
  )
  $environmentPaths = @(
    ':(glob).env',
    ':(glob).env.*',
    ':(glob)**/.env',
    ':(glob)**/.env.*',
    ':!*.example',
    ':!**/*.example'
  )

  $failed = $false
  $currentFormatMatches = @(& git grep -I -i -l -E -e $secretPattern -- . @excludedPaths 2>$null)
  $currentFormatExit = $LASTEXITCODE
  $currentAssignmentMatches = @(& git grep -I -i -l -E -e $sensitiveAssignmentPattern -- @environmentPaths 2>$null)
  $currentAssignmentExit = $LASTEXITCODE
  $currentMatches = @($currentFormatMatches + $currentAssignmentMatches | Sort-Object -Unique)
  if ($currentFormatExit -gt 1 -or $currentAssignmentExit -gt 1) {
    Write-Host 'Secret scan failed while inspecting the current tree.'
    $failed = $true
  } elseif ($currentMatches.Count -gt 0) {
    Write-Host 'Potential secrets detected in the current tree (content redacted):'
    $currentMatches | Sort-Object -Unique | ForEach-Object { Write-Host " - $_" }
    $failed = $true
  }

  if (-not $SkipHistory) {
    $historyMatches = @{}
    $commits = @(& git rev-list --all 2>$null)
    if ($LASTEXITCODE -ne 0) {
      Write-Host 'Secret scan failed while enumerating Git history.'
      $failed = $true
    } else {
      foreach ($commit in $commits) {
        $formatMatches = @(& git grep -I -i -l -E -e $secretPattern $commit -- . @excludedPaths 2>$null)
        $formatExit = $LASTEXITCODE
        $assignmentMatches = @(& git grep -I -i -l -E -e $sensitiveAssignmentPattern $commit -- @environmentPaths 2>$null)
        $assignmentExit = $LASTEXITCODE
        $matches = @($formatMatches + $assignmentMatches | Sort-Object -Unique)
        if ($formatExit -gt 1 -or $assignmentExit -gt 1) {
          Write-Host "Secret scan failed at commit $($commit.Substring(0, 12))."
          $failed = $true
          continue
        }

        foreach ($match in $matches) {
          # git grep -l returns only <commit>:<path>; never print matching content.
          $separator = $match.IndexOf(':')
          if ($separator -gt 0) {
            $path = $match.Substring($separator + 1)
            if (-not $historyMatches.ContainsKey($path)) {
              $historyMatches[$path] = @{
                Count = 0
                ExampleCommit = $commit.Substring(0, 12)
              }
            }
            $historyMatches[$path].Count++
          }
        }
      }
    }

    if ($historyMatches.Count -gt 0) {
      Write-Host 'Potential secrets detected in Git history (content redacted):'
      $historyMatches.GetEnumerator() |
        Sort-Object -Property Name |
        ForEach-Object {
          Write-Host " - $($_.Name) ($($_.Value.Count) commits; example $($_.Value.ExampleCommit))"
        }
      $failed = $true
    }
  }

  if ($RequireEnvMapping) {
    & node scripts/validate-firebase-environments.mjs
    if ($LASTEXITCODE -ne 0) {
      $failed = $true
    }
  }

  if ($failed) { exit 1 }
  Write-Host 'Security scan passed; no matching secret material was emitted.'
  exit 0
} finally {
  Pop-Location
}
