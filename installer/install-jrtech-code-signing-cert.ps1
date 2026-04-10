$ErrorActionPreference = 'Stop'

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$certificatePath = Join-Path $scriptDirectory 'JRTECH_AkasiaPro_Local_Code_Signing.cer'

if (-not (Test-Path $certificatePath)) {
  Write-Error "No se encontro el certificado en $certificatePath"
}

Import-Certificate -FilePath $certificatePath -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
Import-Certificate -FilePath $certificatePath -CertStoreLocation 'Cert:\CurrentUser\TrustedPublisher' | Out-Null

Write-Host ''
Write-Host 'Certificado JRTech instalado correctamente en el usuario actual.' -ForegroundColor Green
Write-Host 'Ya puedes ejecutar OrbitPOS firmado con menos advertencias para este usuario.' -ForegroundColor Green
