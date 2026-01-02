<#
.SYNOPSIS
    Generates psalm JSON files by combining melody conversion and verse scraping.

.DESCRIPTION
    1. Reads psalm melody from ABC notation (psalm-melodys.txt)
    2. Scrapes verses from elrenkema.nl
    3. Outputs complete psalm JSON in the application format

.PARAMETER PsalmNumber
    The psalm number to generate (required).

.PARAMETER OutputFile
    Output file path. Defaults to psalm-{number}_generated.json

.EXAMPLE
    .\generate-psalms.ps1 -PsalmNumber 3
    Generates Psalm 3 JSON file.
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [int]$PsalmNumber,
    
    [string]$InputFile = "$PSScriptRoot\psalm-melodys.txt",
    
    [string]$OutputFile = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ============================================================================
# MELODY CONVERSION (from Convert-Psalms.ps1)
# ============================================================================

# Key signature sharps/flats based on circle of fifths
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

function Get-KeySignature {
    param([string]$KeyLine)
    
    if ($KeyLine -match 'K:\s*([A-Ga-g])([#b]?)\s*(\w+)?') {
        $note = $Matches[1].ToUpper()
        $accidental = $Matches[2]
        $mode = if ($Matches[3]) { $Matches[3].ToLower() } else { '' }
        
        # Modal keys: Dorian, Phrygian, etc. use different key signatures
        # D Dorian, E Phrygian, F Lydian, G Mixolydian, A Aeolian, B Locrian all use C major (no accidentals)
        # Map modal root to equivalent major key signature
        $modalKeyMap = @{
            # Dorian mode: root note maps to major key a whole step below
            'dor' = @{ 'D' = 'C'; 'E' = 'D'; 'F#' = 'E'; 'G' = 'F'; 'A' = 'G'; 'B' = 'A'; 'C' = 'Bb' }
            'dorian' = @{ 'D' = 'C'; 'E' = 'D'; 'F#' = 'E'; 'G' = 'F'; 'A' = 'G'; 'B' = 'A'; 'C' = 'Bb' }
            # Phrygian mode: root note maps to major key a major third below
            'phr' = @{ 'E' = 'C'; 'F#' = 'D'; 'G#' = 'E'; 'A' = 'F'; 'B' = 'G'; 'C#' = 'A'; 'D' = 'Bb' }
            'phrygian' = @{ 'E' = 'C'; 'F#' = 'D'; 'G#' = 'E'; 'A' = 'F'; 'B' = 'G'; 'C#' = 'A'; 'D' = 'Bb' }
            # Lydian mode: root note maps to major key a fourth below
            'lyd' = @{ 'F' = 'C'; 'G' = 'D'; 'A' = 'E'; 'Bb' = 'F'; 'C' = 'G'; 'D' = 'A'; 'E' = 'B' }
            'lydian' = @{ 'F' = 'C'; 'G' = 'D'; 'A' = 'E'; 'Bb' = 'F'; 'C' = 'G'; 'D' = 'A'; 'E' = 'B' }
            # Mixolydian mode: root note maps to major key a fifth below
            'mix' = @{ 'G' = 'C'; 'A' = 'D'; 'B' = 'E'; 'C' = 'F'; 'D' = 'G'; 'E' = 'A'; 'F#' = 'B' }
            'mixolydian' = @{ 'G' = 'C'; 'A' = 'D'; 'B' = 'E'; 'C' = 'F'; 'D' = 'G'; 'E' = 'A'; 'F#' = 'B' }
            # Aeolian (natural minor): root note maps to relative major
            'aeo' = @{ 'A' = 'C'; 'B' = 'D'; 'C#' = 'E'; 'D' = 'F'; 'E' = 'G'; 'F#' = 'A'; 'G#' = 'B' }
            'aeolian' = @{ 'A' = 'C'; 'B' = 'D'; 'C#' = 'E'; 'D' = 'F'; 'E' = 'G'; 'F#' = 'A'; 'G#' = 'B' }
            # Minor mode (same as Aeolian)
            'm' = @{ 'A' = 'C'; 'B' = 'D'; 'C#' = 'E'; 'D' = 'F'; 'E' = 'G'; 'F#' = 'A'; 'G#' = 'B' }
            'min' = @{ 'A' = 'C'; 'B' = 'D'; 'C#' = 'E'; 'D' = 'F'; 'E' = 'G'; 'F#' = 'A'; 'G#' = 'B' }
        }
        
        $rootKey = "$note$accidental"
        
        # Check if this is a modal key
        if ($mode -and $modalKeyMap.ContainsKey($mode)) {
            $modeMap = $modalKeyMap[$mode]
            if ($modeMap.ContainsKey($rootKey)) {
                return $modeMap[$rootKey]
            }
        }
        
        # Standard major key mapping for enharmonic equivalents
        $keyMap = @{
            'Cb' = 'B'; 'Db' = 'C#'; 'Eb' = 'Eb'; 'Fb' = 'E'; 'Gb' = 'F#'; 'Ab' = 'Ab'; 'Bb' = 'Bb'
        }
        
        $key = $rootKey
        if ($keyMap.ContainsKey($key)) {
            $key = $keyMap[$key]
        }
        
        return $key
    }
    return 'C'
}

function Get-TimeSignature {
    param([string]$MeterLine)
    
    if ($MeterLine -match 'M:\s*C\|') {
        return @(4, 4)
    }
    elseif ($MeterLine -match 'M:\s*C(?!\|)') {
        return @(4, 4)
    }
    elseif ($MeterLine -match 'M:\s*(\d+)/(\d+)') {
        return @([int]$Matches[1], [int]$Matches[2])
    }
    return @(4, 4)
}

function Convert-AbcNoteToVexflow {
    param(
        [string]$AbcNote,
        [string]$KeySignature
    )
    
    # Handle rests
    if ($AbcNote -match '^z(\d*)$') {
        $duration = if ($Matches[1]) { $Matches[1] } else { '1' }
        $vexDuration = switch ($duration) {
            '4' { 'w' }
            '2' { 'h' }
            '1' { 'q' }
            default { 'q' }
        }
        return @{
            keys = @('b/4')
            duration = $vexDuration
            rest = $true
        }
    }
    
    # Parse note
    if ($AbcNote -match '^([\^_=]?)([A-Ga-g])([,'']*)(\d*/?[\d]*)$') {
        $accidental = $Matches[1]
        $pitch = $Matches[2]
        $octaveMod = $Matches[3]
        $durationStr = $Matches[4]
        
        $octave = if ($pitch -cmatch '[a-g]') { 5 } else { 4 }
        
        foreach ($char in $octaveMod.ToCharArray()) {
            if ($char -eq ',') { $octave-- }
            elseif ($char -eq "'") { $octave++ }
        }
        
        $noteName = $pitch.ToLower()
        
        $accidentalStr = ''
        if ($accidental -eq '^') {
            $accidentalStr = '#'
        }
        elseif ($accidental -eq '_') {
            $accidentalStr = 'b'
        }
        elseif ($accidental -eq '=') {
            $accidentalStr = ''
        }
        else {
            $keySig = $script:keySignatureAccidentals[$KeySignature]
            if ($keySig) {
                if ($keySig.sharps -and $keySig.sharps -contains $noteName) {
                    $accidentalStr = '#'
                }
                elseif ($keySig.flats -and $keySig.flats -contains $noteName) {
                    $accidentalStr = 'b'
                }
            }
        }
        
        $vexDuration = switch -Regex ($durationStr) {
            '^4$' { 'w' }
            '^2$' { 'h' }
            '^$'  { 'q' }
            '^1$' { 'q' }
            '^/2$' { '8' }
            '^/4$' { '16' }
            '^3$' { 'hd' }
            default { 'q' }
        }
        
        $key = "$noteName$accidentalStr/$octave"
        
        return @{
            keys = @($key)
            duration = $vexDuration
        }
    }
    
    return $null
}

function Parse-MelodyLine {
    param(
        [string]$Line,
        [string]$KeySignature
    )
    
    $notes = @()
    $expandedLine = $Line -replace '(\w\d?)-(\w)', '$1 $2'
    
    $notePattern = '[\^_=]?[A-Ga-g][,'']*/?\d*'
    $restPattern = 'z\d*'
    
    $tokens = [regex]::Matches($expandedLine, "($notePattern|$restPattern)")
    
    foreach ($token in $tokens) {
        $noteStr = $token.Value.Trim()
        if ($noteStr) {
            $note = Convert-AbcNoteToVexflow -AbcNote $noteStr -KeySignature $KeySignature
            if ($note) {
                $notes += $note
            }
        }
    }
    
    return $notes
}

function Get-PsalmMelodyFromAbc {
    param(
        [string]$FilePath,
        [int]$PsalmNum
    )
    
    $content = Get-Content -Path $FilePath -Raw
    $psalmBlocks = $content -split '(?=X:\s*\d+)'
    
    foreach ($block in $psalmBlocks) {
        if ($block -match 'X:\s*(\d+)' -and [int]$Matches[1] -eq $PsalmNum) {
            
            $title = if ($block -match 'T:\s*(.+)') { $Matches[1].Trim() } else { "Psalm $PsalmNum" }
            $mode = if ($block -match 'G:\s*(.+)') { $Matches[1].Trim() } else { "" }
            $composer = if ($block -match 'C:\s*(.+)') { $Matches[1].Trim() } else { "" }
            $keyLine = if ($block -match '(K:\s*.+)') { $Matches[1] } else { "K: C" }
            $meterLine = if ($block -match '(M:\s*.+)') { $Matches[1] } else { "M: C|" }
            
            $keySignature = Get-KeySignature -KeyLine $keyLine
            $timeSignature = Get-TimeSignature -MeterLine $meterLine
            
            $melodyLines = @()
            $lines = $block -split "`n"
            
            foreach ($line in $lines) {
                $trimmed = $line.Trim()
                if ($trimmed -and 
                    $trimmed -notmatch '^[XTGCMKL]:' -and
                    $trimmed -match '[A-Ga-gz]') {
                    
                    $cleanLine = $trimmed -replace '\|.*$', '' -replace '\|', ''
                    $parts = $cleanLine -split '\s+z2\s*'
                    
                    foreach ($part in $parts) {
                        $part = $part.Trim()
                        if ($part -and $part -match '[A-Ga-gz]') {
                            $melodyLines += $part
                        }
                    }
                }
            }
            
            $fullMode = if ($composer) { "$mode ($composer)" } else { $mode }
            
            return @{
                Number = $PsalmNum
                Title = $title
                Mode = $fullMode
                KeySignature = $keySignature
                TimeSignature = $timeSignature
                MelodyLines = $melodyLines
            }
        }
    }
    
    return $null
}

# ============================================================================
# VERSE SCRAPING (from scrape-psalms.ps1)
# ============================================================================

function Get-PsalmVersesFromWeb {
    param([int]$PsalmNum)
    
    $paddedNum = $PsalmNum.ToString('000')
    $url = "https://elrenkema.nl/psalmen/oude/$paddedNum"
    
    Write-Host "Ophalen van verzen van: $url" -ForegroundColor Cyan
    
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
        $html = $response.Content
        
        # Zoek alle verse divs
        $verseStarts = [regex]::Matches($html, '<div class=verse id="(\d+)">')
        
        $versen = @()
        
        for ($v = 0; $v -lt $verseStarts.Count; $v++) {
            $verseNum = [int]$verseStarts[$v].Groups[1].Value
            $startIdx = $verseStarts[$v].Index
            
            # Bepaal eindpositie (volgende vers of einde document)
            $endIdx = if ($v + 1 -lt $verseStarts.Count) { 
                $verseStarts[$v + 1].Index 
            } else { 
                $html.Length 
            }
            
            $verseHtml = $html.Substring($startIdx, $endIdx - $startIdx)
            
            # Zoek de tekst na het versnummer
            $textStart = $verseHtml.IndexOf("</strong>")
            if ($textStart -lt 0) { continue }
            
            $verseContent = $verseHtml.Substring($textStart + 9)
            
            # Stop bij de volgende </div> op het hoogste niveau
            $divEnd = $verseContent.IndexOf("</div>")
            if ($divEnd -gt 0) {
                $verseContent = $verseContent.Substring(0, $divEnd)
            }
            
            # Split op <br> tags om regels te krijgen
            $rawLines = $verseContent -split '<br\s*/?>' | 
                        ForEach-Object { 
                            # Verwijder HTML tags maar behoud de tekst
                            $line = $_ -replace '<[^>]+>', ''
                            # Vervang HTML entities
                            $line = $line -replace '&nbsp;', ' '
                            $line = $line -replace '&amp;', '&'
                            $line = $line -replace '&lt;', '<'
                            $line = $line -replace '&gt;', '>'
                            $line = $line -replace '&#(\d+);', { [char][int]$_.Groups[1].Value }
                            # Verwijder extra spaties
                            $line = $line -replace '\s+', ' '
                            $line.Trim()
                        } |
                        Where-Object { $_ -and $_.Length -gt 2 }
            
            if ($rawLines.Count -lt 3) { continue }
            
            # Nu de syllabe-splitsing fixen per regel
            $cleanLines = @()
            foreach ($line in $rawLines) {
                $words = $line -split '\s+'
                $result = @()
                $i = 0
                
                while ($i -lt $words.Count) {
                    $current = $words[$i]
                    $next = if ($i + 1 -lt $words.Count) { $words[$i + 1] } else { "" }
                    $currentLower = $current.ToLower()
                    $nextLower = $next.ToLower()
                    
                    $merged = $false
                    
                    # 1. Bekende voorvoegsels die ALTIJD aan woorden vastzitten
                    if ($currentLower -match "^(ge|be|ver|ont|her|er)$" -and $next -cmatch "^[a-z]") {
                        $result += "$current$next"
                        $i += 2
                        $merged = $true
                    }
                    # 2. t'ont + rukken (met curly quote)
                    elseif ($currentLower -match "^t['\u2019]?(ont)?$" -and $next -cmatch "^[a-z]") {
                        $result += "$current$next"
                        $i += 2
                        $merged = $true
                    }
                    # 3. Specifieke patronen: alge+meen, etc.
                    elseif ($currentLower -match "^(alge|scho|tege|vroe|wede|hede)$" -and $next -cmatch "^[a-z]") {
                        $result += "$current$next"
                        $i += 2
                        $merged = $true
                    }
                    # 4. REMOVED - was incorrectly merging separate words like "ijlings heen"
                    # 5. Ver/Ge/Be + lossen (met hoofdletter)
                    elseif ($current -cmatch "^(Ver|Ge|Be|Ont|Her)$" -and $next -cmatch "^[a-z]") {
                        $result += "$current$next"
                        $i += 2
                        $merged = $true
                    }
                    # 6. wel + eer
                    elseif ($currentLower -match "^wel$" -and $nextLower -match "^(eer|eens)[,;.!?'\u2019\u201D]?$") {
                        $result += "$current$next"
                        $i += 2
                        $merged = $true
                    }
                    # 7. Der + genen (specifiek voor psalmen)
                    elseif ($currentLower -match "^(der|ter|des)$" -and $next -cmatch "^[a-z]") {
                        $result += "$current$next"
                        $i += 2
                        $merged = $true
                    }
                    
                    if (-not $merged) {
                        $result += $current
                        $i++
                    }
                }
                
                $cleanLine = $result -join ' '
                
                # Post-processing fixes
                # Fix: m'Uw → m' Uw (spatie na verkorte me/m') - ondersteun zowel ' als '
                $cleanLine = $cleanLine -replace "([md]['\u2019])([A-Z])", '$1 $2'
                # Note: Don't remove space after d' - let d'oprechten stay as separate words
                # so the syllabifier can handle "oprechten" properly
                # Fix specifieke woorden met verkeerde apostrof: vrucht'loos → vruchtloos
                $cleanLine = $cleanLine -replace "vrucht['\u2019]loos", 'vruchtloos'
                
                $cleanLines += $cleanLine
            }
            
            $versen += @{
                number = $verseNum
                lines = $cleanLines
            }
        }
        
        Write-Host "  $($versen.Count) verzen gevonden" -ForegroundColor Green
        return $versen
        
    } catch {
        Write-Warning "Kon verzen niet ophalen: $($_.Exception.Message)"
        return @()
    }
}

function Split-WordIntoSyllables {
    <#
    .SYNOPSIS
        Splits a Dutch word into syllables using basic rules.
        Handles apostrophes ('lijk → vrees, 'lijk) as natural split points.
    #>
    param([string]$Word)
    
    if (-not $Word -or $Word.Length -le 2) {
        return @($Word)
    }
    
    # Curly apostrophe character
    $curlyApostrophe = [char]0x2019  # '
    
    # Check of het woord een apostrof bevat (natuurlijk splitpunt)
    # Bijv: vrees'lijk → vrees, 'lijk of m'Uw → m', Uw
    $apostropheIdx = $Word.IndexOf("'")
    if ($apostropheIdx -lt 0) {
        $apostropheIdx = $Word.IndexOf($curlyApostrophe)
    }
    
    if ($apostropheIdx -gt 0 -and $apostropheIdx -lt $Word.Length - 1) {
        $before = $Word.Substring(0, $apostropheIdx)
        $after = $Word.Substring($apostropheIdx)
        
        # Return als 2 delen: deel voor apostrof, en apostrof+rest
        return @($before, $after)
    }
    
    # Behoud interpunctie apart
    $punctuation = ""
    $cleanWord = $Word
    # Match common punctuation at end
    $punctMatch = [regex]::Match($Word, '([,;.!?"„"]+)$')
    if ($punctMatch.Success) {
        $punctuation = $punctMatch.Value
        $cleanWord = $Word.Substring(0, $Word.Length - $punctuation.Length)
    }
    
    if ($cleanWord.Length -le 2) {
        return @($Word)
    }
    
    # Nederlandse klinkers
    $vowels = 'aeiouyAEIOUY'
    $vowelPattern = "[$vowels]"
    
    # Probeer te splitsen op medeklinker tussen twee klinkers
    $result = @()
    $current = ""
    $chars = $cleanWord.ToCharArray()
    
    for ($i = 0; $i -lt $chars.Count; $i++) {
        $current += $chars[$i]
        
        # Kijk of we kunnen splitsen
        if ($i + 2 -lt $chars.Count) {
            $c1 = $chars[$i]
            $c2 = $chars[$i + 1]
            $c3 = $chars[$i + 2]
            
            # Als we klinker-medeklinker-klinker hebben
            if ($c1 -match $vowelPattern -and 
                $c2 -notmatch $vowelPattern -and 
                $c3 -match $vowelPattern) {
                # Split hier (medeklinker gaat naar volgende syllabe)
                $result += $current
                $current = ""
            }
            # Dubbele medeklinker: split ertussen
            elseif ($c1 -match $vowelPattern -and 
                    $c2 -notmatch $vowelPattern -and 
                    $c3 -notmatch $vowelPattern -and
                    ($i + 3) -lt $chars.Count -and
                    $chars[$i + 3] -match $vowelPattern) {
                # voeg eerste medeklinker toe en split
                $current += $chars[$i + 1]
                $i++
                $result += $current
                $current = ""
            }
        }
    }
    
    if ($current) {
        $result += $current
    }
    
    # Voeg interpunctie toe aan laatste syllabe
    if ($punctuation -and $result.Count -gt 0) {
        $result[-1] = $result[-1] + $punctuation
    }
    
    # Als geen splitsing gevonden, return origineel woord
    if ($result.Count -eq 0 -or ($result.Count -eq 1 -and $result[0] -eq $Word)) {
        return @($Word)
    }
    
    return $result
}

function Get-MatchedSyllables {
    <#
    .SYNOPSIS
        Splits verse lines into syllables matching the note count per measure.
        Tries to produce natural-looking syllables for Dutch text.
    .PARAMETER Lines
        Array of verse lines (one per measure)
    .PARAMETER NotesPerMeasure
        Array of note counts for each measure
    #>
    param(
        [string[]]$Lines,
        [int[]]$NotesPerMeasure
    )
    
    # Apostrophe characters: ' (0027 straight), ' (2019 curly)
    $curlyApos = [char]0x2019
    
    # Clear syllable cache at start of each verse processing
    $script:syllableCache = $null
    
    $allSyllables = @()
    
    for ($lineIdx = 0; $lineIdx -lt $Lines.Count; $lineIdx++) {
        $line = $Lines[$lineIdx]
        $targetCount = if ($lineIdx -lt $NotesPerMeasure.Count) { 
            $NotesPerMeasure[$lineIdx] 
        } else { 
            6  # Default
        }
        
        # Start met woorden
        $words = @($line -split '\s+' | Where-Object { $_ })
        
        # Pre-process: combine apostrophe-only words with the next word
        # e.g., "d'" + "onschuld" -> "d'onschuld"
        # e.g., "'t" + "veilig" -> "'t veilig" (with space for readability)
        # Apostrophe characters: ' (0027), ' (2019 curly)
        $curlyApos = [char]0x2019
        $combinedWords = @()
        for ($j = 0; $j -lt $words.Count; $j++) {
            $word = $words[$j]
            # Check if this is an apostrophe-only word (e.g., "d'", "m'", "'t", "'k")
            # Pattern: 1-2 chars with apostrophe at start or end
            $isApostropheWord = $word -match "^['$curlyApos][a-zA-Z]?$" -or $word -match "^[a-zA-Z]['$curlyApos]$"
            
            if ($isApostropheWord -and ($j + 1) -lt $words.Count) {
                # Combine with next word
                # For 't (apostrophe at start), add a space for readability
                # For d' (apostrophe at end), no space
                if ($word -match "^['$curlyApos]") {
                    $combinedWords += $word + " " + $words[$j + 1]
                } else {
                    $combinedWords += $word + $words[$j + 1]
                }
                $j++  # Skip next word
            } else {
                $combinedWords += $word
            }
        }
        $words = $combinedWords
        
        $syllables = @()
        
        # Eerste pass: houd elk woord intact
        foreach ($word in $words) {
            $syllables += $word
        }
        
        # Als we al genoeg "syllaben" hebben (1 per noot), zijn we klaar
        if ($syllables.Count -eq $targetCount) {
            $allSyllables += ,@($syllables)
            continue
        }
        
        # Als we te veel syllaben hebben, combineer woorden
        while ($syllables.Count -gt $targetCount -and $syllables.Count -gt 1) {
            # Zoek de kortste combinatie
            $minLen = [int]::MaxValue
            $combineIdx = $syllables.Count - 2
            
            for ($j = 0; $j -lt $syllables.Count - 1; $j++) {
                $combined = $syllables[$j] + $syllables[$j + 1]
                if ($combined.Length -lt $minLen) {
                    $minLen = $combined.Length
                    $combineIdx = $j
                }
            }
            
            # Combineer op de gevonden positie
            $newSyllables = @()
            for ($j = 0; $j -lt $syllables.Count; $j++) {
                if ($j -eq $combineIdx) {
                    $newSyllables += $syllables[$j] + $syllables[$j + 1]
                    $j++
                } else {
                    $newSyllables += $syllables[$j]
                }
            }
            $syllables = $newSyllables
        }
        
        # Als we te weinig syllaben hebben, split woorden using hypher
        $triedWords = @{}  # Track words we've already tried (can't split further)
        $iteration = 0
        
        # Pre-syllabify all words once
        if (-not $script:syllableCache) {
            $allWords = $Lines -join ' ' -split '\s+' | Where-Object { $_ }
            $script:syllableCache = Get-DutchSyllables -Words $allWords
        }
        
        while ($syllables.Count -lt $targetCount -and $iteration -lt 30) {
            $iteration++
            $addedSplit = $false
            
            # Sort words by length descending, skip already-tried words and hyphenated parts
            $candidates = @()
            for ($j = 0; $j -lt $syllables.Count; $j++) {
                $syl = $syllables[$j]
                # Skip words already tried, or that start/end with hyphen (already split parts)
                if ($triedWords.ContainsKey($syl) -or $syl -match "^-" -or $syl -match "-$") {
                    continue
                }
                if ($syl.Length -ge 3) {
                    $candidates += @{ Index = $j; Word = $syl; Length = $syl.Length }
                }
            }
            
            # Sort by length descending
            $candidates = $candidates | Sort-Object -Property Length -Descending
            
            foreach ($candidate in $candidates) {
                $splitIdx = $candidate.Index
                $word = $candidate.Word
                
                $parts = $script:syllableCache.$word
                
                # If word not in cache (e.g., combined apostrophe words), syllabify on demand
                if (-not $parts -or $parts.Count -eq 0) {
                    $onDemand = Get-DutchSyllables -Words @($word)
                    if ($onDemand -and $onDemand.$word) {
                        $parts = @($onDemand.$word)
                    } else {
                        $parts = @($word)
                    }
                }
                
                if ($parts.Count -gt 1) {
                    # Replace the word with its syllables
                    # Add dashes to all syllables except the last one (to show word continuation)
                    $newSyllables = @()
                    for ($j = 0; $j -lt $syllables.Count; $j++) {
                        if ($j -eq $splitIdx) {
                            for ($p = 0; $p -lt $parts.Count; $p++) {
                                $part = $parts[$p]
                                # Add dash to all parts except the last one
                                if ($p -lt $parts.Count - 1) {
                                    # Only add dash if it doesn't already end with punctuation or dash
                                    if ($part -notmatch '[,;.!?"\-]$') {
                                        $part = "$part-"
                                    }
                                }
                                $newSyllables += $part
                            }
                        } else {
                            $newSyllables += $syllables[$j]
                        }
                    }
                    $syllables = $newSyllables
                    $addedSplit = $true
                    break  # Start fresh iteration with updated syllables
                } else {
                    # Hypher couldn't split this word - mark it as tried
                    $triedWords[$word] = $true
                }
            }
            
            if (-not $addedSplit) { break }
        }
        
        # Post-process: combine apostrophe-only syllables with the next syllable
        # In Dutch psalm singing, syllables like "'t", "d'", "m'" should be sung with the first syllable of the following word
        $newSyllables = @()
        for ($j = 0; $j -lt $syllables.Count; $j++) {
            $syl = $syllables[$j]
            # Check if this is an apostrophe-only syllable (e.g., "'t", "d'", "m'", "'k", etc.)
            # Pattern: short syllable (1-2 chars) with apostrophe at start or end
            $isApostropheSyllable = $syl -match "^['$curlyApos][a-zA-Z]?$" -or $syl -match "^[a-zA-Z]['$curlyApos]$"
            
            if ($isApostropheSyllable -and ($j + 1) -lt $syllables.Count) {
                $nextSyl = $syllables[$j + 1]
                # Combine with next syllable
                $newSyllables += "$syl$nextSyl"
                $j++  # Skip the next syllable since we combined it
            } else {
                $newSyllables += $syl
            }
        }
        $syllables = $newSyllables
        
        # Als we nog steeds te weinig hebben, probeer unsplit woorden opnieuw te splitten
        # Dit vangt woorden op die hypher niet automatisch splitst maar wel gesplitst kunnen worden
        if ($syllables.Count -lt $targetCount) {
            $neededExtra = $targetCount - $syllables.Count
            
            # Zoek woorden die nog niet gesplitst zijn (geen hyphen aan begin/eind)
            # en die meer dan 3 karakters hebben (potentieel splitsbaar)
            for ($j = 0; $j -lt $syllables.Count -and $neededExtra -gt 0; $j++) {
                $syl = $syllables[$j]
                
                # Skip reeds gesplitste syllaben
                if ($syl -match "^-" -or $syl -match "-$") { continue }
                
                # Verwijder interpunctie voor check
                $cleanSyl = $syl -replace '[,;.!?"„"]+$', ''
                
                # Check of dit een woord is dat gesplitst kan worden
                # Moet minstens 2 klinkers hebben om splitsbaar te zijn
                $vowelCount = ([regex]::Matches($cleanSyl, '[aeiouyAEIOUY]')).Count
                
                if ($vowelCount -ge 2 -and $cleanSyl.Length -ge 3) {
                    # Forceer syllabificatie via node script (fresh call)
                    $freshSyllables = Get-DutchSyllables -Words @($syl)
                    $parts = $freshSyllables.$syl
                    
                    if ($parts -and $parts.Count -gt 1) {
                        # Vervang dit woord met zijn syllaben
                        $beforeParts = @()
                        for ($k = 0; $k -lt $j; $k++) {
                            $beforeParts += $syllables[$k]
                        }
                        
                        $splitParts = @()
                        for ($p = 0; $p -lt $parts.Count; $p++) {
                            $part = $parts[$p]
                            if ($p -lt $parts.Count - 1 -and $part -notmatch '[,;.!?"\-]$') {
                                $part = "$part-"
                            }
                            $splitParts += $part
                        }
                        
                        $afterParts = @()
                        for ($k = $j + 1; $k -lt $syllables.Count; $k++) {
                            $afterParts += $syllables[$k]
                        }
                        
                        $syllables = $beforeParts + $splitParts + $afterParts
                        $neededExtra -= ($parts.Count - 1)
                        
                        # Herstarten van de loop aangezien indices veranderd zijn
                        $j = -1
                    }
                }
            }
        }
        
        # Als we nog steeds te weinig hebben, voeg lege syllaben toe
        while ($syllables.Count -lt $targetCount) {
            $syllables += "-"
        }
        
        $allSyllables += ,@($syllables)
    }
    
    return $allSyllables
}

function Get-DutchSyllables {
    param(
        [string[]]$Words,
        [string]$NodeScriptPath = "$PSScriptRoot\syllabify-nl.js"
    )

    if (-not (Test-Path $NodeScriptPath)) {
        throw "Node syllabifier not found: $NodeScriptPath"
    }

    $uniqueWords = $Words | Where-Object { $_ } | Sort-Object -Unique
    if ($uniqueWords.Count -eq 0) {
        return @{}
    }

    # Ensure we always pass an array to the JSON (single items need -AsArray)
    $jsonInput = ConvertTo-Json -InputObject @($uniqueWords) -Compress
    $output = $jsonInput | & node $NodeScriptPath

    return $output | ConvertFrom-Json
}

# ============================================================================
# MAIN: Combineer melodie en verzen
# ============================================================================

Write-Host "`n=== Psalm $PsalmNumber genereren ===" -ForegroundColor Cyan

# 1. Haal melodie op
Write-Host "`n[1] Melodie ophalen uit: $InputFile" -ForegroundColor Yellow

if (-not (Test-Path $InputFile)) {
    Write-Error "Input file niet gevonden: $InputFile"
    exit 1
}

$psalmMelody = Get-PsalmMelodyFromAbc -FilePath $InputFile -PsalmNum $PsalmNumber

if (-not $psalmMelody) {
    Write-Error "Psalm $PsalmNumber niet gevonden in $InputFile"
    exit 1
}

Write-Host "  Titel: $($psalmMelody.Title)" -ForegroundColor Gray
Write-Host "  Modus: $($psalmMelody.Mode)" -ForegroundColor Gray
Write-Host "  Toonsoort: $($psalmMelody.KeySignature)" -ForegroundColor Gray
Write-Host "  Melodieregels: $($psalmMelody.MelodyLines.Count)" -ForegroundColor Gray

# 2. Converteer melodie naar VexFlow measures
Write-Host "`n[2] Melodie converteren naar VexFlow formaat" -ForegroundColor Yellow

$measures = @()
foreach ($line in $psalmMelody.MelodyLines) {
    $notes = Parse-MelodyLine -Line $line -KeySignature $psalmMelody.KeySignature
    
    if ($notes.Count -gt 0) {
        $measureNotes = @()
        foreach ($n in $notes) {
            $noteObj = [ordered]@{
                keys = $n.keys
                duration = $n.duration
            }
            if ($n.rest) {
                $noteObj.rest = $true
            }
            $measureNotes += $noteObj
        }
        
        $measures += @{
            lyrics = ""
            notes = $measureNotes
        }
    }
}

Write-Host "  $($measures.Count) maten geconverteerd" -ForegroundColor Gray

# 3. Haal verzen op van website
Write-Host "`n[3] Verzen ophalen van elrenkema.nl" -ForegroundColor Yellow

$webVerses = Get-PsalmVersesFromWeb -PsalmNum $PsalmNumber

# 4. Bouw verses array
Write-Host "`n[4] Verzen formatteren" -ForegroundColor Yellow

# Bepaal aantal noten per maat (exclusief rusten - die krijgen geen tekst)
$notesPerMeasure = @()
foreach ($measure in $measures) {
    $singableNotes = @($measure.notes | Where-Object { -not $_.rest })
    $notesPerMeasure += $singableNotes.Count
}

Write-Host "  Noten per maat: $($notesPerMeasure -join ', ')" -ForegroundColor Gray

$verses = @()
foreach ($vers in $webVerses) {
    $syllables = Get-MatchedSyllables -Lines $vers.lines -NotesPerMeasure $notesPerMeasure
    
    $verses += [ordered]@{
        number = $vers.number
        lines = $vers.lines
        syllables = $syllables
    }
}

# 5. Bouw complete JSON
Write-Host "`n[5] JSON genereren" -ForegroundColor Yellow

$paddedNum = $PsalmNumber.ToString('000')

# Nieuwe structuur: melody bevat de measures, verses bevat alle verzen (inclusief vers 1)
$jsonObj = [ordered]@{
    id = "psalm-$paddedNum"
    number = $PsalmNumber
    title = $psalmMelody.Title
    category = "psalm"
    mode = $psalmMelody.Mode
    keySignature = $psalmMelody.KeySignature
    timeSignature = $psalmMelody.TimeSignature
    clef = "treble"
    melody = [ordered]@{
        measures = $measures
    }
    verses = $verses
}

# Bepaal output bestand
if (-not $OutputFile) {
    #$OutputFile = "$PSScriptRoot\Psalm${PsalmNumber}_generated.json"
    $OutputFile = "$PSScriptRoot\src\lib\data\psalms\psalm-${PsalmNumber}.json"
}

# Converteer naar JSON met goede formatting
$json = $jsonObj | ConvertTo-Json -Depth 10

# Schrijf naar bestand
$json | Out-File -FilePath $OutputFile -Encoding UTF8

Write-Host "`n[6] JSON formatteren met format-psalm.js" -ForegroundColor Yellow

# Run format-psalm.js om de JSON netjes te formatteren
$formatScript = "$PSScriptRoot\format-psalm.js"
if (Test-Path $formatScript) {
    try {
        $nodeResult = & node $formatScript $OutputFile 2>&1
        Write-Host "  $nodeResult" -ForegroundColor Gray
    } catch {
        Write-Warning "Kon format-psalm.js niet uitvoeren: $($_.Exception.Message)"
    }
} else {
    Write-Warning "format-psalm.js niet gevonden op: $formatScript"
}

Write-Host "`n=== Klaar! ===" -ForegroundColor Green
Write-Host "Output: $OutputFile" -ForegroundColor Cyan
Write-Host "  - $($measures.Count) maten in melodie"
Write-Host "  - $($verses.Count) verzen met tekst"
