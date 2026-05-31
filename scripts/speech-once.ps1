param(
  [string]$Lang = 'ru-RU',
  [int]$TimeoutSec = 90,
  [switch]$ListOnly
)

$ErrorActionPreference = 'Stop'

function Get-InstalledSpeechCultures {
  Add-Type -AssemblyName System.Speech
  $installed = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
  if (-not $installed -or $installed.Count -eq 0) {
    return @()
  }
  return @($installed | ForEach-Object { $_.Culture.Name })
}

function Normalize-SpeechLang {
  param([string]$Preferred)

  $value = [string]$Preferred
  if (-not $value) { return 'ru-RU' }
  if ($value -like 'ru*') { return 'ru-RU' }
  if ($value -like 'en*') { return 'en-US' }
  if ($value -like 'uk*') { return 'uk-UA' }
  if ($value -like 'de*') { return 'de-DE' }
  return $value
}

function Resolve-SpeechCulture {
  param([string]$Preferred)

  $available = Get-InstalledSpeechCultures
  if ($available.Count -eq 0) {
    throw 'SPEECH_NONE'
  }

  $normalized = Normalize-SpeechLang -Preferred $Preferred
  if ($available -contains $normalized) {
    return [System.Globalization.CultureInfo]::GetCultureInfo($normalized)
  }

  throw "SPEECH_MISSING:$normalized|$($available -join ',')"
}

if ($ListOnly) {
  $langs = Get-InstalledSpeechCultures
  [Console]::Out.WriteLine("LIST:$($langs -join ',')")
  exit 0
}

try {
  $culture = Resolve-SpeechCulture -Preferred $Lang
  [Console]::Out.WriteLine("LANG:$($culture.Name)")
  [Console]::Out.Flush()

  $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine($culture)
  $engine.SetInputToDefaultAudioDevice()
  $grammar = New-Object System.Speech.Recognition.DictationGrammar
  $engine.LoadGrammar($grammar)

  $result = $engine.Recognize([TimeSpan]::FromSeconds($TimeoutSec))
  if ($result -and $result.Text) {
    [Console]::Out.WriteLine("FINAL:$($result.Text)")
  } else {
    [Console]::Out.WriteLine('FINAL:')
  }
  exit 0
}
catch {
  $message = $_.Exception.Message
  if ($message -eq 'SPEECH_NONE' -or $message -like 'SPEECH_MISSING:*') {
    [Console]::Error.WriteLine($message)
  } else {
    [Console]::Error.WriteLine($message)
  }
  exit 1
}
