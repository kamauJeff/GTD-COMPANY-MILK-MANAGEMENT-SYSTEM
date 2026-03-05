# Run from gutoria-dairies\frontend folder
# .\fix-pages.ps1

$pages = @{
  "src\pages\ShopsPage.tsx" = @'
export default function ShopsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Shops & Sales</h1>
      <div className="bg-white rounded-xl border p-12 text-center text-gray-400 mt-8">
        <div className="text-4xl mb-3">🏪</div>
        <p className="font-medium">Shop deliveries, daily sales and Kopokopo reconciliation.</p>
      </div>
    </div>
  );
}
'@
  "src\pages\CollectionsPage.tsx" = @'
export default function CollectionsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Milk Collections</h1>
      <div className="bg-white rounded-xl border p-12 text-center text-gray-400 mt-8">
        <div className="text-4xl mb-3">🥛</div>
        <p className="font-medium">View and record daily milk collections from farmers.</p>
      </div>
    </div>
  );
}
'@
  "src\pages\FactoryPage.tsx" = @'
export default function FactoryPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Factory</h1>
      <div className="bg-white rounded-xl border p-12 text-center text-gray-400 mt-8">
        <div className="text-4xl mb-3">🏭</div>
        <p className="font-medium">Factory receipts, pasteurization batches and quality control.</p>
      </div>
    </div>
  );
}
'@
  "src\pages\PaymentsPage.tsx" = @'
export default function PaymentsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Farmer Payments</h1>
      <div className="bg-white rounded-xl border p-12 text-center text-gray-400 mt-8">
        <div className="text-4xl mb-3">💳</div>
        <p className="font-medium">Advance recording and month-end payment runs via Kopokopo.</p>
      </div>
    </div>
  );
}
'@
  "src\pages\PayrollPage.tsx" = @'
export default function PayrollPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Staff Payroll</h1>
      <div className="bg-white rounded-xl border p-12 text-center text-gray-400 mt-8">
        <div className="text-4xl mb-3">💼</div>
        <p className="font-medium">Monthly payroll with variance deductions.</p>
      </div>
    </div>
  );
}
'@
  "src\pages\ReportsPage.tsx" = @'
export default function ReportsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Reports</h1>
      <div className="bg-white rounded-xl border p-12 text-center text-gray-400 mt-8">
        <div className="text-4xl mb-3">📊</div>
        <p className="font-medium">Monthly collection grid, farmer statements and factory efficiency.</p>
      </div>
    </div>
  );
}
'@
}

foreach ($file in $pages.Keys) {
    $dir = Split-Path $file -Parent
    if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    [System.IO.File]::WriteAllText(
        (Join-Path (Get-Location) $file),
        $pages[$file],
        [System.Text.UTF8Encoding]::new($false)
    )
    Write-Host "Fixed: $file" -ForegroundColor Green
}

Write-Host "`nAll pages fixed! Vite will hot-reload automatically." -ForegroundColor Cyan
