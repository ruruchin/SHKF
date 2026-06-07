Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 } |
  Where-Object {
    $_.ProcessName -match 'Yandex|Music|Музык|яндекс' -or
    $_.MainWindowTitle -match 'Музык|Music|Yandex|Яндекс'
  } |
  Select-Object ProcessName, Id, MainWindowTitle |
  Format-Table -AutoSize

Write-Host '--- all with handle ---'
Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 -and ($_.Path -like '*YandexMusic*' -or $_.Path -like '*яндекс*') } |
  Select-Object ProcessName, Id, MainWindowTitle, Path |
  Format-List
