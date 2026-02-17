<#
.SYNOPSIS
    Converts MusicXML files to VexFlow JSON format compatible with this project.

.DESCRIPTION
    Parses MusicXML (partwise) files and extracts the melody (voice 1, part 1)
    into the PsalmData JSON format used by the Svelte app. Outputs human-readable
    JSON via format-psalm.js.

.PARAMETER XmlFile
    Path to a specific MusicXML file to convert.

.PARAMETER All
    Convert all XML files in data-raw/melodie/.

.PARAMETER OutputDir
    Output directory for JSON files. Defaults to src/lib/data/liedereen.

.PARAMETER PartIndex
    Which part to extract (1-based). Defaults to 1.

.PARAMETER VoiceNumber
    Which voice to extract from the part. Defaults to 1.

.PARAMETER Id
    Custom ID for the song (e.g., "lied-001"). If not specified, derived from filename.

.PARAMETER Number
    Song number. If not specified, auto-incremented based on existing files.

.PARAMETER Title
    Song title. If not specified, derived from ID.

.PARAMETER KeySignature
    Key signature override (e.g., "G", "D", "C"). If not specified, inferred from
    the notes and accidentals in the MusicXML.

.EXAMPLE
    pwsh convert-musicxml.ps1 -XmlFile data-raw/melodie/3425c00d-c073-45f6-9877-2167e5c34f69.xml
    pwsh convert-musicxml.ps1 -All
    pwsh convert-musicxml.ps1 -XmlFile data-raw/melodie/song.xml -Id "lied-001" -Title "Mijn Lied" -KeySignature "G"
#>

[CmdletBinding(DefaultParameterSetName = "Help")]
param(
    [Parameter(ParameterSetName = "Single")]
    [string]$XmlFile,

    [Parameter(ParameterSetName = "All")]
    [switch]$All,

    [string]$OutputDir = "src/lib/data/liedereen",

    [int]$PartIndex = 1,

    [int]$VoiceNumber = 1,

    [string]$Id,

    [int]$Number = 0,

    [string]$Title,

    [string]$KeySignature
)

$ErrorActionPreference = "Stop"
$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

# ============================================================================
# KEY SIGNATURE DETECTION
# ============================================================================

# Key signature accidentals lookup (circle of fifths)
$keySignatureAccidentals = @{
    'G'  = @{ sharps = @('f') }
    'D'  = @{ sharps = @('f', 'c') }
    'A'  = @{ sharps = @('f', 'c', 'g') }
    'E'  = @{ sharps = @('f', 'c', 'g', 'd') }
    'B'  = @{ sharps = @('f', 'c', 'g', 'd', 'a') }
    'F#' = @{ sharps = @('f', 'c', 'g', 'd', 'a', 'e') }
    'C#' = @{ sharps = @('f', 'c', 'g', 'd', 'a', 'e', 'b') }
    'F'  = @{ flats = @('b') }
    'Bb' = @{ flats = @('b', 'e') }
    'Eb' = @{ flats = @('b', 'e', 'a') }
    'Ab' = @{ flats = @('b', 'e', 'a', 'd') }
    'Db' = @{ flats = @('b', 'e', 'a', 'd', 'g') }
    'Gb' = @{ flats = @('b', 'e', 'a', 'd', 'g', 'c') }
    'C'  = @{ sharps = @(); flats = @() }
}

# MusicXML fifths value to key signature name
$fifthsToKey = @{
    '-7' = 'Cb'; '-6' = 'Gb'; '-5' = 'Db'; '-4' = 'Ab'; '-3' = 'Eb'; '-2' = 'Bb'; '-1' = 'F'
    '0' = 'C'; '1' = 'G'; '2' = 'D'; '3' = 'A'; '4' = 'E'; '5' = 'B'; '6' = 'F#'; '7' = 'C#'
}

# ============================================================================
# MUSICXML DURATION MAPPING
# ============================================================================

# MusicXML type to VexFlow duration
function Get-VexFlowDuration {
    param(
        [string]$Type,
        [bool]$Dotted
    )

    $baseDuration = switch ($Type) {
        'whole'     { 'w' }
        'half'      { 'h' }
        'quarter'   { 'q' }
        'eighth'    { '8' }
        '16th'      { '16' }
        '32nd'      { '32' }
        default     { 'q' }
    }

    if ($Dotted) {
        # VexFlow dotted durations: "hd", "qd", "8d", etc.
        $baseDuration = "${baseDuration}d"
    }

    return $baseDuration
}

# ============================================================================
# MUSICXML PITCH TO VEXFLOW KEY
# ============================================================================

function Get-VexFlowKey {
    param(
        [System.Xml.XmlElement]$PitchElement
    )

    $stepNode = $PitchElement.SelectSingleNode("step")
    $octaveNode = $PitchElement.SelectSingleNode("octave")
    $alterNode = $PitchElement.SelectSingleNode("alter")

    $step = $stepNode.InnerText.ToLower()
    $octave = $octaveNode.InnerText
    $alter = 0
    if ($alterNode) {
        $alter = [int]$alterNode.InnerText
    }

    $accidentalStr = switch ($alter) {
        -2 { 'bb' }
        -1 { 'b' }
         0 { '' }
         1 { '#' }
         2 { '##' }
        default { '' }
    }

    return "$step$accidentalStr/$octave"
}

# ============================================================================
# INFER KEY SIGNATURE FROM MUSICXML
# ============================================================================

function Get-KeySignatureFromXml {
    param(
        [System.Xml.XmlElement]$ScorePartwise
    )

    # Look for <key> element in attributes
    $keyNodes = $ScorePartwise.SelectNodes("//key/fifths")
    foreach ($fifthsNode in $keyNodes) {
        $fifthsStr = $fifthsNode.InnerText.Trim()
        if ($fifthsToKey.ContainsKey($fifthsStr)) {
            return $fifthsToKey[$fifthsStr]
        }
    }

    # No key element found => C major (no accidentals)
    return 'C'
}

# ============================================================================
# EXTRACT TIME SIGNATURE FROM MUSICXML
# ============================================================================

function Get-TimeSignatureFromXml {
    param(
        [System.Xml.XmlElement]$ScorePartwise
    )

    $beatsNode = $ScorePartwise.SelectSingleNode("//time/beats")
    $beatTypeNode = $ScorePartwise.SelectSingleNode("//time/beat-type")

    if ($beatsNode -and $beatTypeNode) {
        return @([int]$beatsNode.InnerText, [int]$beatTypeNode.InnerText)
    }

    return @(4, 4)
}

# ============================================================================
# CONVERT A SINGLE MUSICXML FILE
# ============================================================================

function Convert-MusicXmlToVexFlow {
    param(
        [string]$FilePath,
        [string]$OutputDir,
        [int]$PartIndex = 1,
        [int]$VoiceNumber = 1,
        [string]$SongId,
        [int]$SongNumber,
        [string]$SongTitle,
        [string]$KeySigOverride
    )

    Write-Host "Processing: $FilePath"

    # Load XML
    [xml]$xml = Get-Content -Path $FilePath -Raw
    $scorePw = $xml.SelectSingleNode("score-partwise")

    if (-not $scorePw) {
        Write-Error "Not a valid MusicXML partwise file: $FilePath"
        return
    }

    # Get all parts
    $parts = @($scorePw.SelectNodes("part"))
    if ($parts.Count -lt $PartIndex) {
        Write-Error "Part $PartIndex not found. File has $($parts.Count) part(s)."
        return
    }
    $targetPart = $parts[$PartIndex - 1]

    # Determine key signature
    $detectedKey = Get-KeySignatureFromXml -ScorePartwise $scorePw
    $keySig = if ($KeySigOverride) { $KeySigOverride } else { $detectedKey }
    Write-Host "  Key signature: $keySig$(if ($KeySigOverride) { ' (override)' } else { ' (detected)' })"

    # Determine time signature
    $timeSig = Get-TimeSignatureFromXml -ScorePartwise $scorePw
    Write-Host "  Time signature: $($timeSig[0])/$($timeSig[1])"

    # Extract measures
    $xmlMeasures = @($targetPart.SelectNodes("measure"))
    Write-Host "  Measures in XML: $($xmlMeasures.Count)"

    $vexMeasures = @()

    foreach ($xmlMeasure in $xmlMeasures) {
        $notes = @()
        $xmlNotes = @($xmlMeasure.SelectNodes("note"))

        foreach ($xmlNote in $xmlNotes) {
            # Skip notes from other voices
            $voice = $xmlNote.voice
            if ($voice -and [int]$voice -ne $VoiceNumber) {
                continue
            }

            # Skip grace notes
            if ($xmlNote.SelectSingleNode("grace")) {
                continue
            }

            # Skip chord notes (secondary notes in a chord)
            if ($xmlNote.SelectSingleNode("chord")) {
                continue
            }

            # Get note type
            $noteType = $xmlNote.type
            if (-not $noteType) {
                # Some notes don't have a type (e.g., forward/backup durations)
                continue
            }

            # Check for dot
            $hasDot = $null -ne $xmlNote.SelectSingleNode("dot")

            # Determine VexFlow duration
            $duration = Get-VexFlowDuration -Type $noteType -Dotted $hasDot

            # Check if rest
            $isRest = $null -ne $xmlNote.SelectSingleNode("rest")

            if ($isRest) {
                $noteObj = [ordered]@{
                    keys = @('b/4')
                    duration = $duration
                    rest = $true
                }
                $notes += $noteObj
            }
            else {
                # Get pitch
                $pitchElement = $xmlNote.SelectSingleNode("pitch")
                if (-not $pitchElement) {
                    continue
                }

                $key = Get-VexFlowKey -PitchElement $pitchElement
                $noteObj = [ordered]@{
                    keys = @($key)
                    duration = $duration
                }

                # Check for explicit accidental element (visible accidental in the score)
                # This indicates the accidental is *explicitly shown* (not just from key sig)
                $accidentalElement = $xmlNote.SelectSingleNode("accidental")
                if ($accidentalElement) {
                    $accType = switch ($accidentalElement.InnerText) {
                        'sharp'         { '#' }
                        'flat'          { 'b' }
                        'natural'       { 'n' }
                        'double-sharp'  { '##' }
                        'flat-flat'     { 'bb' }
                        default         { $null }
                    }

                    # Only add explicit accidental if it's NOT already in the key signature
                    # (i.e., it's a chromatic alteration / musica ficta)
                    if ($accType) {
                        $noteLetter = $pitchElement.SelectSingleNode("step").InnerText.ToLower()
                        $isInKeySig = $false
                        $keySigAccidentals = $keySignatureAccidentals[$keySig]
                        if ($keySigAccidentals) {
                            if ($accType -eq '#' -and $keySigAccidentals.sharps -and $keySigAccidentals.sharps -contains $noteLetter) {
                                $isInKeySig = $true
                            }
                            if ($accType -eq 'b' -and $keySigAccidentals.flats -and $keySigAccidentals.flats -contains $noteLetter) {
                                $isInKeySig = $true
                            }
                        }

                        if (-not $isInKeySig) {
                            $noteObj['accidental'] = [ordered]@{ type = $accType }
                        }
                    }
                }

                $notes += $noteObj
            }
        }

        if ($notes.Count -gt 0) {
            $vexMeasures += [ordered]@{
                notes = $notes
            }
        }
    }

    Write-Host "  VexFlow measures: $($vexMeasures.Count)"
    if ($vexMeasures.Count -gt 0) {
        $totalNotes = ($vexMeasures | ForEach-Object { $_.notes.Count } | Measure-Object -Sum).Sum
        Write-Host "  Total notes (voice $VoiceNumber): $totalNotes"
    }

    # Build song ID and metadata
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($FilePath)
    $songId = if ($SongId) { $SongId } else { "lied-$baseName" }
    $songNum = if ($SongNumber -gt 0) { $SongNumber } else { Get-NextSongNumber -OutputDir $OutputDir }
    $songTitle = if ($SongTitle) { $SongTitle } else { "Lied $songNum" }

    # Build PsalmData JSON object (no 'mode' field if not applicable)
    $psalmData = [ordered]@{
        id            = $songId
        number        = $songNum
        title         = $songTitle
        category      = "liedereen"
        keySignature  = $keySig
        timeSignature = $timeSig
        clef          = "treble"
        melody        = [ordered]@{
            measures = $vexMeasures
        }
        verses        = @(
            [ordered]@{
                number    = 1
                lines     = @()
                syllables = @()
            }
        )
    }

    # Write JSON manually to avoid PowerShell ConvertTo-Json quirks with ordered dicts
    # This ensures proper array formatting and avoids issues with nested hashtables

    # Write JSON
    if (-not (Test-Path $OutputDir)) {
        New-Item -Path $OutputDir -ItemType Directory -Force | Out-Null
        Write-Host "  Created directory: $OutputDir"
    }

    $outputFileName = "$songId.json"
    $outputPath = Join-Path $OutputDir $outputFileName

    # Convert to JSON (deep enough for nested structures)
    $jsonContent = $psalmData | ConvertTo-Json -Depth 10
    Set-Content -Path $outputPath -Value $jsonContent -Encoding UTF8

    # Format with format-psalm.js for human-readable output
    $formatScript = Join-Path $scriptRoot "format-psalm.js"
    if (Test-Path $formatScript) {
        Write-Host "  Formatting with format-psalm.js..."
        node $formatScript $outputPath
    }
    else {
        Write-Host "  Warning: format-psalm.js not found, JSON not formatted"
    }

    Write-Host "  Output: $outputPath"
    Write-Host ""

    return $outputPath
}

# ============================================================================
# HELPER: Get next song number based on existing files
# ============================================================================

function Get-NextSongNumber {
    param([string]$OutputDir)

    if (-not (Test-Path $OutputDir)) {
        return 1
    }

    $existingFiles = Get-ChildItem -Path $OutputDir -Filter "*.json" -ErrorAction SilentlyContinue
    if (-not $existingFiles -or $existingFiles.Count -eq 0) {
        return 1
    }

    $maxNum = 0
    foreach ($file in $existingFiles) {
        $content = Get-Content $file.FullName -Raw | ConvertFrom-Json
        if ($content.number -and $content.number -gt $maxNum) {
            $maxNum = $content.number
        }
    }

    return $maxNum + 1
}

# ============================================================================
# MAIN
# ============================================================================

$OutputDir = Join-Path $scriptRoot $OutputDir

if ($All) {
    $xmlDir = Join-Path $scriptRoot "data-raw/melodie"
    $xmlFiles = @(Get-ChildItem -Path $xmlDir -Filter "*.xml" -ErrorAction SilentlyContinue)

    if ($xmlFiles.Count -eq 0) {
        Write-Host "No XML files found in $xmlDir"
        exit 0
    }

    Write-Host "Found $($xmlFiles.Count) XML file(s) to convert"
    Write-Host "Output directory: $OutputDir"
    Write-Host ""

    $fileNum = 0
    foreach ($file in $xmlFiles) {
        $fileNum++
        Convert-MusicXmlToVexFlow `
            -FilePath $file.FullName `
            -OutputDir $OutputDir `
            -PartIndex $PartIndex `
            -VoiceNumber $VoiceNumber `
            -SongNumber $fileNum `
            -KeySigOverride $KeySignature
    }

    Write-Host "Done! Converted $($xmlFiles.Count) file(s)."
}
elseif ($XmlFile) {
    $resolvedPath = Resolve-Path $XmlFile -ErrorAction SilentlyContinue
    if (-not $resolvedPath) {
        # Try relative to script root
        $resolvedPath = Join-Path $scriptRoot $XmlFile
        if (-not (Test-Path $resolvedPath)) {
            Write-Error "File not found: $XmlFile"
            exit 1
        }
    }

    Convert-MusicXmlToVexFlow `
        -FilePath $resolvedPath `
        -OutputDir $OutputDir `
        -PartIndex $PartIndex `
        -VoiceNumber $VoiceNumber `
        -SongId $Id `
        -SongNumber $Number `
        -SongTitle $Title `
        -KeySigOverride $KeySignature
}
else {
    Write-Host "Usage:"
    Write-Host "  pwsh convert-musicxml.ps1 -XmlFile <path-to-xml>"
    Write-Host "  pwsh convert-musicxml.ps1 -All"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -OutputDir <dir>      Output directory (default: src/lib/data/liedereen)"
    Write-Host "  -PartIndex <n>        Part to extract, 1-based (default: 1)"
    Write-Host "  -VoiceNumber <n>      Voice to extract (default: 1)"
    Write-Host "  -Id <string>          Custom song ID"
    Write-Host "  -Number <int>         Song number"
    Write-Host "  -Title <string>       Song title"
    Write-Host "  -KeySignature <key>   Override key signature (e.g., G, D, C)"
    exit 0
}
