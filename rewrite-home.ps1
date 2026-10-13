$root = "C:\Users\Kingsley\OneDrive\Documents\love troll"

if (-not (Test-Path (Join-Path $root 'home.html'))) {
  throw "VYBE home.html was not found at $root"
}

Write-Host "The current VYBE home page is already implemented in home.html and home.css."
Write-Host "This script no longer overwrites the application with the old static prototype."
Write-Host "Running a production build to verify the current project..."

Push-Location $root
try {
  npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "VYBE build failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}
