Param(
  [string]$DataRoot = "$env:USERPROFILE\exam-permit-data"
)

$ErrorActionPreference = 'Stop'

$dataRootResolved = [System.IO.Path]::GetFullPath($DataRoot)
$dbDir = Join-Path $dataRootResolved 'data'
$uploadsDir = Join-Path $dataRootResolved 'uploads'
$dbPath = Join-Path $dbDir 'production.sqlite'

if (-not (Test-Path $dbPath)) {
  throw "Database file not found at $dbPath. Start the backend at least once before backup."
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path $dataRootResolved 'backups'
$targetDir = Join-Path $backupRoot $timestamp
$targetUploads = Join-Path $targetDir 'uploads'
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
New-Item -ItemType Directory -Force -Path $targetUploads | Out-Null

Copy-Item -Path $dbPath -Destination (Join-Path $targetDir 'production.sqlite') -Force

if (Test-Path $uploadsDir) {
  Copy-Item -Path (Join-Path $uploadsDir '*') -Destination $targetUploads -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Backup complete: $targetDir"
