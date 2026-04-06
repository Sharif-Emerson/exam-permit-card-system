Param(
  [string]$DataRoot = "$env:USERPROFILE\exam-permit-data",
  [int]$Port = 4000
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path "$PSScriptRoot\.."
$backendRoot = Join-Path $projectRoot 'examples/rest-backend'
$dataRootResolved = [System.IO.Path]::GetFullPath($DataRoot)
$dbDir = Join-Path $dataRootResolved 'data'
$uploadsDir = Join-Path $dataRootResolved 'uploads'
$dbPath = Join-Path $dbDir 'production.sqlite'

New-Item -ItemType Directory -Force -Path $dbDir | Out-Null
New-Item -ItemType Directory -Force -Path $uploadsDir | Out-Null

$env:PORT = "$Port"
$env:APP_DB_PATH = $dbPath
$env:APP_UPLOADS_DIR = $uploadsDir

Write-Host "Starting backend with persistent storage:"
Write-Host "  PORT=$($env:PORT)"
Write-Host "  APP_DB_PATH=$($env:APP_DB_PATH)"
Write-Host "  APP_UPLOADS_DIR=$($env:APP_UPLOADS_DIR)"

Push-Location $backendRoot
try {
  npm.cmd run start
} finally {
  Pop-Location
}
