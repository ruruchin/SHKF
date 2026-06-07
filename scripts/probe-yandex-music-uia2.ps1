Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes

$p = Get-Process | Where-Object { $_.MainWindowTitle -match 'Яндекс Музыка|Yandex Music' -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { Write-Output 'no-window'; exit 1 }

$root = [Windows.Automation.AutomationElement]::RootElement
$cond = New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ProcessIdProperty, $p.Id)
$window = $root.FindFirst([Windows.Automation.TreeScope]::Children, $cond)

function Dump($el, $depth) {
  if ($depth -gt 4) { return }
  $indent = ' ' * ($depth * 2)
  $ct = $el.Current.ControlType.ProgrammaticName
  $name = $el.Current.Name
  $aid = $el.Current.AutomationId
  $cls = $el.Current.ClassName
  Write-Output "$indent$ct name='$name' aid='$aid' class='$cls'"
  $children = $el.FindAll([Windows.Automation.TreeScope]::Children, [Windows.Automation.Condition]::TrueCondition)
  for ($i = 0; $i -lt $children.Count; $i++) {
    Dump $children.Item($i) ($depth + 1)
  }
}

Dump $window 0
