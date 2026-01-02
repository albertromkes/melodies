#!/usr/bin/env node
import fs from "fs";
import Hypher from "hypher";
import dutch from "hyphenation.nl";

const h = new Hypher(dutch);

// Read stdin
const input = fs.readFileSync(0, "utf8").trim();
if (!input) {
  console.log("{}");
  process.exit(0);
}

const words = JSON.parse(input);
const result = {};

// Simple punctuation splitter
function splitPunctuation(word) {
  const match = word.match(/^(.+?)([.,;:!?"]*)$/);
  return match ? [match[1], match[2]] : [word, ""];
}

// Fix hypher's compound word splitting issue
// Hypher sometimes splits compound words incorrectly, e.g., "jammerstaat" -> ["jam", "mer", "s", "taat"]
// This should be ["jam", "mer", "staat"]
// Rule: merge a single consonant syllable with the following syllable
function fixCompoundSyllables(syllables) {
  if (syllables.length < 2) return syllables;
  
  const result = [];
  let i = 0;
  
  while (i < syllables.length) {
    const syl = syllables[i];
    // Check if this is a single consonant (no vowels) and there's a next syllable
    // Match: single consonant letter (not a vowel) - common linking consonants in Dutch compounds
    if (i < syllables.length - 1 && /^[bcdfghjklmnpqrstvwxz]$/i.test(syl)) {
      // Merge with next syllable
      result.push(syl + syllables[i + 1]);
      i += 2;
    } else {
      result.push(syl);
      i++;
    }
  }
  
  return result;
}

// Fix hypher's issue with words starting with vowel-consonant-vowel pattern
// Words like "ogen", "open", "even", "Uwe" should be split as "o-gen", "o-pen", "e-ven", "U-we"
// Hypher doesn't split these correctly
function fixVowelConsonantVowel(word, syllables) {
  // Only fix if hypher returned the word unsplit (1 syllable)
  if (syllables.length !== 1) return syllables;
  
  const syl = syllables[0];
  
  // Skip proper nouns (capital letter after first char usually indicates proper noun)
  // But allow words that are ALL caps (like HEER)
  // Only apply this check for longer words (4+ chars) - very short words like "Uwe" (3 chars, formal pronoun)
  // are not proper nouns even when capitalized
  if (syl.length >= 4 && syl[0] === syl[0].toUpperCase() && syl[1] === syl[1].toLowerCase()) {
    // This looks like a proper noun (e.g., "Adams", "Eden"), don't split
    // Check if the rest of the word is lowercase
    const rest = syl.slice(1);
    if (rest === rest.toLowerCase()) {
      return syllables;
    }
  }
  
  // Check if word matches pattern: vowel + consonant(s) + vowel (+ optional more letters)
  // Pattern: starts with vowel, then consonant(s), then vowel with optional chars after
  // Include 'ij' as a Dutch vowel combination
  const match = syl.match(/^([aeiouAEIOU]|[iI][jJ])([bcdfghjklmnpqrstvwxz]+)([aeiouAEIOU].*|[iI][jJ].*)$/i);
  
  if (match) {
    // Split after the first vowel: "ogen" -> ["o", "gen"], "Uwe" -> ["U", "we"]
    return [match[1], match[2] + match[3]];
  }
  
  return syllables;
}

// Fix words ending in common suffixes that hypher doesn't split
// e.g., "fijnste" -> ["fijn", "ste"], "grootste" -> ["groot", "ste"]
function fixUnsplitSuffixes(word, syllables) {
  // Only fix if hypher returned the word unsplit (1 syllable)
  if (syllables.length !== 1) return syllables;
  
  const syl = syllables[0];
  
  // Common Dutch suffixes that should be split
  // -ste (superlative), -heid, -lijk, -nis, -ing, -sel, etc.
  const suffixPatterns = [
    { pattern: /^(.{2,})(ste)$/i, minRootVowels: 1 },      // fijnste -> fijn-ste
    { pattern: /^(.{2,})(heid)$/i, minRootVowels: 1 },     // schoonheid -> schoon-heid
    { pattern: /^(.{2,})(nis)$/i, minRootVowels: 1 },      // kennis -> ken-nis
    { pattern: /^(.{2,})(sel)$/i, minRootVowels: 1 },      // voedsel -> voed-sel
    { pattern: /^(.{3,})(lijk)$/i, minRootVowels: 1 },     // eerlijk -> eer-lijk (but not 'lijk' itself)
  ];
  
  for (const { pattern, minRootVowels } of suffixPatterns) {
    const match = syl.match(pattern);
    if (match) {
      const root = match[1];
      const suffix = match[2];
      // Check that root has at least minRootVowels vowels
      const vowelCount = (root.match(/[aeiouij]/gi) || []).length;
      if (vowelCount >= minRootVowels) {
        return [root, suffix];
      }
    }
  }
  
  return syllables;
}

for (const word of words) {
  if (!word || word.length < 3) {
    result[word] = [word];
    continue;
  }

  // Handle d' prefix (common Dutch contraction for "de/het")
  // d'oprechten -> ["d'op-", "rech-", "ten"]
  // The d' should be combined with the first syllable
  // Apostrophe can be ' (0027) or ' (2019 curly)
  const dPrefixMatch = word.match(/^([dDmM]['\u2019])(.*)/);
  if (dPrefixMatch && dPrefixMatch[2].length >= 2) {
    const prefix = dPrefixMatch[1];
    const rest = dPrefixMatch[2];
    const [core, punct] = splitPunctuation(rest);
    let syllables = h.hyphenate(core);
    syllables = fixCompoundSyllables(syllables);
    syllables = fixVowelConsonantVowel(core, syllables);
    syllables = fixUnsplitSuffixes(core, syllables);
    if (syllables.length > 0) {
      // Combine prefix with first syllable
      syllables[0] = prefix + syllables[0];
      if (punct) {
        syllables[syllables.length - 1] += punct;
      }
      result[word] = syllables;
    } else {
      result[word] = [prefix + rest];
    }
    continue;
  }

  // Handle 't prefix (common Dutch contraction for "het")
  // "'t gebergt'" -> ["'t ge-", "bergt'"]
  // "'t rechtvaardig" -> ["'t recht-", "vaar-", "dig"]
  // Handles both "'tword" and "'t word" (with space)
  // Apostrophe can be ' (0027) or ' (2019 curly)
  const tPrefixMatch = word.match(/^(['\u2019][tT])\s*(.*)/);
  if (tPrefixMatch && tPrefixMatch[2].length >= 2) {
    const prefix = tPrefixMatch[1];
    const rest = tPrefixMatch[2];
    const [core, punct] = splitPunctuation(rest);
    let syllables = h.hyphenate(core);
    syllables = fixCompoundSyllables(syllables);
    syllables = fixVowelConsonantVowel(core, syllables);
    syllables = fixUnsplitSuffixes(core, syllables);
    if (syllables.length > 0) {
      // Combine prefix with first syllable (with space for readability)
      syllables[0] = prefix + " " + syllables[0];
      if (punct) {
        syllables[syllables.length - 1] += punct;
      }
      result[word] = syllables;
    } else {
      result[word] = [prefix + " " + rest];
    }
    continue;
  }

  // Apostrophe handling for other cases (' or ')
  // e.g., vrees'lijk -> ["vrees", "'lijk"]
  // e.g., onvergank'lijk -> ["on", "ver", "gank", "'lijk"] (syllabify the part before apostrophe)
  // BUT NOT HEER', where apostrophe is at end (possibly followed by punctuation)
  // Apostrophe can be ' (0027) or ' (2019 curly)
  const aposMatch = word.match(/^(.+?)(['\u2019].+)$/);
  if (aposMatch) {
    const afterApos = aposMatch[2].slice(1); // Everything after the apostrophe
    // Only split if there's actual content after apostrophe (not just punctuation)
    if (afterApos && !/^[.,;:!?"]*$/.test(afterApos)) {
      const beforeApos = aposMatch[1];
      // Syllabify the part before apostrophe
      let beforeSyllables = h.hyphenate(beforeApos);
      beforeSyllables = fixCompoundSyllables(beforeSyllables);
      beforeSyllables = fixVowelConsonantVowel(beforeApos, beforeSyllables);
      beforeSyllables = fixUnsplitSuffixes(beforeApos, beforeSyllables);
      // Combine with the apostrophe part
      result[word] = [...beforeSyllables, aposMatch[2]];
      continue;
    }
  }

  const [core, punct] = splitPunctuation(word);
  let syllables = h.hyphenate(core);
  syllables = fixCompoundSyllables(syllables);
  syllables = fixVowelConsonantVowel(core, syllables);
  syllables = fixUnsplitSuffixes(core, syllables);

  if (syllables.length === 0) {
    result[word] = [word];
  } else {
    if (punct) {
      syllables[syllables.length - 1] += punct;
    }
    result[word] = syllables;
  }
}

process.stdout.write(JSON.stringify(result));
