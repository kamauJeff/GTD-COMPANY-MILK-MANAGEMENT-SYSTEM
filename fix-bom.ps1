# Run from your gutoria-dairies root folder:
# .\fix-bom.ps1

$root = Get-Location
$fixed = 0

Get-ChildItem -Path $root -Recurse -File | Where-Object {
    $_.FullName -notmatch 'node_modules' -and
    $_.FullName -notmatch '\.git' -and
    $_.FullName -notmatch '\\dist\\'
} | ForEach-Object {
    try {
        $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
        if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
            $content = [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
            [System.IO.File]::WriteAllText($_.FullName, $content, [System.Text.UTF8Encoding]::new($false))
            Write-Host "Fixed: $($_.FullName.Replace($root.Path + '\', ''))" -ForegroundColor Green
            $fixed++
        }
    } catch {
        Write-Host "Skipped: $($_.Name)" -ForegroundColor Yellow
    }
}

Write-Host "`nDone! Fixed $fixed files." -ForegroundColor Cyan
