Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes

$p = Get-Process | Where-Object { $_.MainWindowTitle -match 'Яндекс Музыка|Yandex Music' -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) {
  Write-Output 'no-window'
  exit 1
}

$root = [Windows.Automation.AutomationElement]::RootElement
$cond = New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ProcessIdProperty, $p.Id)
$window = $root.FindFirst([Windows.Automation.TreeScope]::Children, $cond)
if (-not $window) {
  Write-Output 'no-element'
  exit 1
}

$editCond = New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ControlTypeProperty, [Windows.Automation.ControlType]::Edit)
$btnCond = New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ControlTypeProperty, [Windows.Automation.ControlType]::Button)
$edits = $window.FindAll([Windows.Automation.TreeScope]::Descendants, $editCond)
$buttons = $window.FindAll([Windows.Automation.TreeScope]::Descendants, $btnCond)

Write-Output "edits=$($edits.Count) buttons=$($buttons.Count) title=$($window.Current.Name)"

for ($i = 0; $i -lt [Math]::Min(5, $edits.Count); $i++) {
  $e = $edits.Item($i)
  Write-Output "edit[$i] name=$($e.Current.Name) aid=$($e.Current.AutomationId) class=$($e.Current.ClassName)"
}

for ($i = 0; $i -lt [Math]::Min(8, $buttons.Count); $i++) {
  $b = $buttons.Item($i)
  Write-Output "btn[$i] name=$($b.Current.Name) aid=$($b.Current.AutomationId)"
}
