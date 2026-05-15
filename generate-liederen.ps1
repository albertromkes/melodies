<#
.SYNOPSIS
    Generates liederen JSON files from liederen-melodies.txt.

.DESCRIPTION
    Reads one or more liederen from a simple melody format and writes VexFlow-compatible
    JSON files to src/lib/data/liederen.

    Supported input shape:

        title: Lied title
        kind: 3 flats
        lines:
        E2,G1 A1 B1, B1 A2, G2

    A bare first title line is also accepted:

        Lied title
        kind: 3 flats
        lines:
        ...

    Notes are A-G. Uppercase notes render in octave 4, lowercase notes in octave 5.
    Durations are 1=quarter, 2=half, 3=dotted half, 4=whole, 8=eighth.
    Add -cancel, -sharp, or -flat after a note to force an explicit accidental,
    for example A1-cancel, A2-sharp, or A2-flat.

.PARAMETER Title
    Optional title filter. When supplied, only this lied is generated.

.PARAMETER InputFile
    Path to the source melody file. Defaults to liederen-melodies.txt.

.PARAMETER OutputDir
    Folder for generated JSON. Defaults to src/lib/data/liederen.

.PARAMETER SkipInvalidTokens
    Warn and skip malformed melody tokens instead of stopping.

.EXAMPLE
    .\generate-liederen.ps1
    Generates all liederen in liederen-melodies.txt.

.EXAMPLE
    .\generate-liederen.ps1 -Title "Al heeft Hij ons verlaten"
    Generates only the matching lied.
#>

param(
    [string]$Title = "",
    [string]$InputFile = "$PSScriptRoot\liederen-melodies.txt",
    [string]$OutputDir = "$PSScriptRoot\src\lib\data\liederen",
    [switch]$SkipInvalidTokens
)

$ErrorActionPreference = "Stop"

$keySignatureAccidentals = @{
    'C'  = @{ sharps = @(); flats = @() }
    'G'  = @{ sharps = @('f'); flats = @() }
    'D'  = @{ sharps = @('f', 'c'); flats = @() }
    'A'  = @{ sharps = @('f', 'c', 'g'); flats = @() }
    'E'  = @{ sharps = @('f', 'c', 'g', 'd'); flats = @() }
    'B'  = @{ sharps = @('f', 'c', 'g', 'd', 'a'); flats = @() }
    'F#' = @{ sharps = @('f', 'c', 'g', 'd', 'a', 'e'); flats = @() }
    'C#' = @{ sharps = @('f', 'c', 'g', 'd', 'a', 'e', 'b'); flats = @() }
    'F'  = @{ sharps = @(); flats = @('b') }
    'Bb' = @{ sharps = @(); flats = @('b', 'e') }
    'Eb' = @{ sharps = @(); flats = @('b', 'e', 'a') }
    'Ab' = @{ sharps = @(); flats = @('b', 'e', 'a', 'd') }
    'Db' = @{ sharps = @(); flats = @('b', 'e', 'a', 'd', 'g') }
    'Gb' = @{ sharps = @(); flats = @('b', 'e', 'a', 'd', 'g', 'c') }
    'Cb' = @{ sharps = @(); flats = @('b', 'e', 'a', 'd', 'g', 'c', 'f') }
}

function Get-KeySignatureFromKind {
    param([string]$Kind)

    $normalized = $Kind.Trim().ToLowerInvariant()

    if ($normalized -match '^([a-g])\s*([#b]?)$') {
        return "$($Matches[1].ToUpper())$($Matches[2])"
    }

    if ($normalized -match '^(\d+)\s*flat') {
        $flatKeys = @('C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb')
        $count = [int]$Matches[1]
        if ($count -ge 0 -and $count -lt $flatKeys.Count) {
            return $flatKeys[$count]
        }
    }

    if ($normalized -match '^(\d+)\s*sharp') {
        $sharpKeys = @('C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#')
        $count = [int]$Matches[1]
        if ($count -ge 0 -and $count -lt $sharpKeys.Count) {
            return $sharpKeys[$count]
        }
    }

    if ($normalized -in @('none', 'natural', 'naturals', '0 flats', '0 sharps')) {
        return 'C'
    }

    throw "Unsupported kind '$Kind'. Use values like '3 flats', '2 sharps', or 'G'."
}

function Convert-LiedNoteToVexflow {
    param(
        [string]$Token,
        [string]$KeySignature,
        [int]$LineNumber
    )

    $cleanToken = $Token.Trim().Trim(',')
    if (-not $cleanToken) {
        return $null
    }

    if ($cleanToken -notmatch '^([A-Ga-g])([#b]?)(1|2|3|4|8)(-(cancel|sharp|flat))?$') {
        $message = "Invalid melody token '$Token' on source line $LineNumber. Expected note plus duration, for example E2 or g8. Use A1-cancel, A2-sharp, or A2-flat for explicit accidentals."
        if ($SkipInvalidTokens) {
            Write-Warning $message
            return $null
        }
        throw $message
    }

    $pitch = $Matches[1]
    $explicitAccidental = $Matches[2]
    $durationValue = $Matches[3]
    $explicitSuffix = $Matches[5]
    $noteName = $pitch.ToLowerInvariant()
    $octave = if ($pitch -cmatch '[a-g]') { 5 } else { 4 }

    $accidental = $explicitAccidental
    $explicitAccidentalType = $null
    if ($explicitSuffix) {
        switch ($explicitSuffix) {
            'cancel' {
                $accidental = ''
                $explicitAccidentalType = 'n'
            }
            'sharp' {
                $accidental = '#'
                $explicitAccidentalType = '#'
            }
            'flat' {
                $accidental = 'b'
                $explicitAccidentalType = 'b'
            }
        }
    }
    elseif (-not $accidental) {
        $keyAccidentals = $keySignatureAccidentals[$KeySignature]
        if ($keyAccidentals) {
            if ($keyAccidentals.sharps -contains $noteName) {
                $accidental = '#'
            }
            elseif ($keyAccidentals.flats -contains $noteName) {
                $accidental = 'b'
            }
        }
    }

    $duration = switch ($durationValue) {
        '1' { 'q' }
        '2' { 'h' }
        '3' { 'hd' }
        '4' { 'w' }
        '8' { '8' }
    }

    $noteData = @{
        keys = @("$noteName$accidental/$octave")
        duration = $duration
    }

    if ($explicitAccidentalType) {
        $noteData.accidental = @{
            type = $explicitAccidentalType
        }
    }

    return $noteData
}

function Convert-MelodyLine {
    param(
        [string]$Line,
        [string]$KeySignature,
        [int]$LineNumber
    )

    $notes = @()
    $tokens = $Line -split '[\s,]+' | Where-Object { $_.Trim() }
    foreach ($token in $tokens) {
        $note = Convert-LiedNoteToVexflow -Token $token -KeySignature $KeySignature -LineNumber $LineNumber
        if ($note) {
            $notes += $note
        }
    }

    return @{
        notes = $notes
    }
}

function New-SafeFileName {
    param([string]$Name)

    $safeName = $Name.Trim()
    foreach ($char in [System.IO.Path]::GetInvalidFileNameChars()) {
        $safeName = $safeName.Replace($char, '-')
    }
    return ($safeName -replace '\s+', ' ')
}

function New-SongId {
    param([string]$Name)

    $idTitle = New-SafeFileName -Name $Name
    return "lied-$idTitle"
}

function Complete-CurrentSong {
    param(
        [System.Collections.Generic.List[object]]$Songs,
        [hashtable]$Current
    )

    if (-not $Current -or -not $Current.Title) {
        return
    }

    if (-not $Current.Kind) {
        throw "Missing kind for '$($Current.Title)'."
    }

    if (-not $Current.Lines -or $Current.Lines.Count -eq 0) {
        throw "Missing lines for '$($Current.Title)'."
    }

    $Songs.Add([pscustomobject]@{
        Title = $Current.Title
        Kind = $Current.Kind
        Lines = @($Current.Lines)
    })
}

if (-not (Test-Path -Path $InputFile)) {
    throw "Input file not found: $InputFile"
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$songs = [System.Collections.Generic.List[object]]::new()
$current = $null
$inLines = $false
$sourceLines = Get-Content -Path $InputFile

for ($i = 0; $i -lt $sourceLines.Count; $i++) {
    $lineNumber = $i + 1
    $line = $sourceLines[$i].Trim()

    if (-not $line) {
        continue
    }

    if ($line -match '^\s*title\s*:\s*(.+)$') {
        Complete-CurrentSong -Songs $songs -Current $current
        $current = @{
            Title = $Matches[1].Trim()
            Kind = ''
            Lines = [System.Collections.Generic.List[object]]::new()
        }
        $inLines = $false
        continue
    }

    if (-not $current) {
        $current = @{
            Title = $line
            Kind = ''
            Lines = [System.Collections.Generic.List[object]]::new()
        }
        $inLines = $false
        continue
    }

    if ($line -match '^\s*kind\s*:\s*(.+)$') {
        $current.Kind = $Matches[1].Trim()
        $inLines = $false
        continue
    }

    if ($line -match '^\s*lines\s*:\s*$') {
        $inLines = $true
        continue
    }

    if ($inLines) {
        $current.Lines.Add([pscustomobject]@{
            Text = $line
            SourceLine = $lineNumber
        })
        continue
    }

    throw "Unexpected content on source line ${lineNumber}: '$line'"
}

Complete-CurrentSong -Songs $songs -Current $current

if ($Title) {
    $songs = [System.Collections.Generic.List[object]]@($songs | Where-Object { $_.Title -eq $Title })
    if ($songs.Count -eq 0) {
        throw "No lied found with title '$Title'."
    }
}

$generatedCount = 0
for ($songIndex = 0; $songIndex -lt $songs.Count; $songIndex++) {
    $song = $songs[$songIndex]
    $keySignature = Get-KeySignatureFromKind -Kind $song.Kind
    $measures = @()

    foreach ($melodyLine in $song.Lines) {
        $measures += Convert-MelodyLine -Line $melodyLine.Text -KeySignature $keySignature -LineNumber $melodyLine.SourceLine
    }

    $songData = [ordered]@{
        id = New-SongId -Name $song.Title
        number = $songIndex + 1
        title = $song.Title
        category = 'liederen'
        keySignature = $keySignature
        timeSignature = @(4, 4)
        clef = 'treble'
        melody = [ordered]@{
            measures = $measures
        }
        verses = @(
            [ordered]@{
                number = 1
                lines = @()
                syllables = @()
            }
        )
    }

    $fileName = "$(New-SafeFileName -Name $song.Title).json"
    $outputPath = Join-Path -Path $OutputDir -ChildPath $fileName
    $json = $songData | ConvertTo-Json -Depth 10
    $json | Out-File -FilePath $outputPath -Encoding UTF8

    $formatScript = Join-Path -Path $PSScriptRoot -ChildPath "format-psalm.js"
    if (Test-Path $formatScript) {
        try {
            $nodeResult = & node $formatScript $outputPath 2>&1
            Write-Host "  $nodeResult" -ForegroundColor Gray
        } catch {
            Write-Warning "Kon format-psalm.js niet uitvoeren: $($_.Exception.Message)"
        }
    } else {
        Write-Warning "format-psalm.js niet gevonden op: $formatScript"
    }

    Write-Host "Generated $outputPath" -ForegroundColor Green
    $generatedCount++
}

Write-Host "Generated $generatedCount liederen file(s)." -ForegroundColor Cyan
