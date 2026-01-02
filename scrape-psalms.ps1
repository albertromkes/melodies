# Verbeterde versie: Psalm 3 - Oude Berijming 1773 ophalen en omzetten naar JSON
# Met robuustere parsing en betere Nederlandse syllabificatie

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

Write-Host "Psalm 3 (Berijming 1773) ophalen..." -ForegroundColor Cyan

try {
    # Bron (elrenkema.nl is het meest betrouwbaar voor oude berijming)
    $url = "https://elrenkema.nl/psalmen/oude/003"
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
    $html = $response.Content

    Write-Host "Pagina opgehaald." -ForegroundColor Green

    # --------------------------------------------------------------------
    # Stap 1: HTML → pure tekst converteren (beter dan simpele replace)
    # --------------------------------------------------------------------
    # Verwijder scripts, styles, comments
    $text = $html -replace '(?s)<script.*?</script>', '' `
                  -replace '(?s)<style.*?</style>', '' `
                  -replace '(?s)<!--.*?-->', ''

    # Converteer <br>, <p>, <div> naar newlines
    $text = $text -replace '<br\s*/?>', "`n" `
                  -replace '</?(p|div|h[1-6]|li)[^>]*>', "`n"

    # Strip alle overige tags
    $text = $text -replace '<[^>]+>', ' '

    # Meerdere spaties/newlines normaliseren
    $text = $text -replace '\s+', ' ' -replace '\s*\n\s*', "`n" -replace '^\s+|\s+$', ''

    # --------------------------------------------------------------------
    # Stap 2: Alleen echte psalmregels filteren
    # --------------------------------------------------------------------
    $lines = $text -split "`n" | ForEach-Object { $_.Trim() } | Where-Object {
        $_ -and
        $_ -notmatch '^(Inhoud|Over deze berijming|Boek [IV]+:|(\d+\s*·)+|\[.*\]|function|let|var|return|false|true)$' -and
        $_ -notmatch '^(♫|🔗|noten|link|toon|verberg|download audio|<|>|emsp;)$' -and
        $_ -notmatch '^\d+$' -and                          # alleen nummer
        $_ -notmatch '^\s*[“"”]\s*$'                        # lege aanhaling
    }

    # --------------------------------------------------------------------
    # Stap 3: Groepeer per vers
    # De verzen staan in formaat "2. Maar, trouwe God..." of "3. Ik lag..."
    # met alles op één lange regel
    # --------------------------------------------------------------------
    $versen = @()

    # Gebruik regex om alle verzen te vinden: nummer gevolgd door punt en tekst
    # tot het volgende versnummer of speciale markers
    $versePattern = '(\d+)\.\s+((?:(?!\d+\.\s|♫|Inhoud|Boek [IV]+:)[^♫])+)'
    $verseMatches = [regex]::Matches($text, $versePattern)
    
    foreach ($match in $verseMatches) {
        $verseNum = [int]$match.Groups[1].Value
        $verseText = $match.Groups[2].Value.Trim()
        
        # Filter uit: alleen echte psalmverzen (niet navigatie etc.)
        if ($verseText.Length -lt 50) { continue }  # Te kort = waarschijnlijk geen vers
        if ($verseText -match '^(Inhoud|Over deze|Boek |&nbsp;|\d+\s*·)') { continue }  # Navigatie
        
        # Stop bij "Inhoud" of navigatie-elementen
        if ($verseText -match 'Inhoud') {
            $verseText = ($verseText -split 'Inhoud')[0].Trim()
        }
        
        # Verwijder trailing navigatie en cleanup
        $verseText = $verseText -replace '\s*♫.*$', '' `
                                -replace '\s*noten\s*🔗.*$', '' `
                                -replace '\s*\[.*?\]', '' `
                                -replace '&nbsp;', ' ' `
                                -replace '\s+', ' '
        
        # Splits de tekst in regels op punten/komma's gevolgd door hoofdletter
        $verseLines = $verseText -split '(?<=[.;])\s+(?=[A-Z''"])' | 
                      ForEach-Object { $_.Trim() } |
                      Where-Object { $_ -and $_.Length -gt 2 }
        
        if ($verseLines.Count -eq 0) {
            $verseLines = @($verseText)
        }
        
        $versen += [PSCustomObject]@{
            number = $verseNum
            lines  = $verseLines
        }
    }

    if ($versen.Count -lt 3) {
        Write-Warning "Mogelijk onvolledige parsing – check handmatig de bron."
    }

    # --------------------------------------------------------------------
    # Stap 4: Betere Nederlandse syllabificatie (specifiek voor 18e-eeuws Nederlands)
    # --------------------------------------------------------------------
    function Get-DutchSyllables {
        param([string]$line)

        $words = $line -split '\s+'
        $syllables = @()

        foreach ($word in $words) {
            if (-not $word) { continue }

            # Scheid trailing leestekens
            $clean = $word -replace '([,;.:!?‘’“”"»«()])+$', { $global:punct = $_.Value; '' }
            $punct = if ($global:punct) { $global:punct } else { '' }
            $global:punct = $null

            if (-not $clean) {
                $syllables += $word
                continue
            }

            # Basisregel Nederlands: syllabegrens vóór enkele medeklinker na vocaal
            # (behalve bij samenstellingen / uitzonderingen)
            $s = $clean -replace '([aeiouyAEIOUY])([bcdfghjklmnpqrstvwxz])(?=[aeiouyAEIOUY])', '$1-$2'
            # Extra regels voor typische patronen
            $s = $s -replace '([dt])([aeiouy])', '$1-$2'           # dt-a etc.
            # behoud lettergreep bij eindigend op 't, 'k, m' of n'
            # Gebruik dubbele quotes zodat de enkele quotes in het regexpatroon niet afgesloten worden
            $s = $s -replace "([aeiouy])('t|'k|m'|n')$", '$1$2'
            $s = $s -replace '--', '-'

            # Als woord kort is → niet splitsen
            if (($s -split '-').Count -le 1 -or $s.Length -le 4) {
                $s = $clean
            }

            $syllables += "$s$punct"
        }

        return ,$syllables  # retourneer als array
    }

    # --------------------------------------------------------------------
    # Bouw final JSON-structuur
    # --------------------------------------------------------------------
    $additionalVerses = @()
    foreach ($vers in $versen) {
        $sylArray = $vers.lines | ForEach-Object { Get-DutchSyllables $_ }

        $additionalVerses += [PSCustomObject]@{
            number    = $vers.number
            lines     = $vers.lines
            syllables = $sylArray
        }
    }

    $jsonObj = [ordered]@{
        sourceUrl     = $url
        psalm         = 3
        berijming     = "1773 (Oude / Statenberijming)"
        additionalVerses = $additionalVerses
    }

    $json = $jsonObj | ConvertTo-Json -Depth 6

    Write-Host "`nResultaat JSON:" -ForegroundColor Green
    Write-Host $json

    $json | Out-File -FilePath "Psalm3_1773_clean.json" -Encoding utf8
    Write-Host "`nOpgeslagen als: Psalm3_1773_clean.json" -ForegroundColor Cyan

} catch {
    Write-Error "Fout: $($_.Exception.Message)"
    Write-Host "Controleer handmatig: $url" -ForegroundColor Yellow
}