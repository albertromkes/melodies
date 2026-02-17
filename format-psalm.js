import fs from 'fs';
import path from 'path';

if (process.argv.length < 3) {
  console.error('Usage: node format-psalm.js <psalm-file>');
  process.exit(1);
}

const filePath = path.resolve(process.argv[2]);
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const indent = level => '  '.repeat(level);
const lines = [];

const push = (level, content) => {
  lines.push(`${indent(level)}${content}`);
};

push(0, '{');
push(1, `"id": ${JSON.stringify(data.id)},`);
push(1, `"number": ${data.number},`);
push(1, `"title": ${JSON.stringify(data.title)},`);
push(1, `"category": ${JSON.stringify(data.category)},`);
if (data.mode !== undefined && data.mode !== null) {
  push(1, `"mode": ${JSON.stringify(data.mode)},`);
}
push(1, `"keySignature": ${JSON.stringify(data.keySignature)},`);
push(1, `"timeSignature": [${data.timeSignature.join(', ')}],`);
push(1, `"clef": ${JSON.stringify(data.clef)},`);

// New structure: melody contains measures
push(1, '"melody": {');
push(2, '"measures": [');

const measures = data.melody?.measures ?? data.verses?.[0]?.measures ?? [];
measures.forEach((measure, measureIdx) => {
  push(3, '{');
  push(4, '"notes": [');
  measure.notes.forEach((note, noteIdx) => {
    const parts = [];
    const keysArray = `[${note.keys.map(k => JSON.stringify(k)).join(', ')}]`;
    parts.push(`"keys": ${keysArray}`);
    parts.push(`"duration": ${JSON.stringify(note.duration)}`);
    if (note.rest === true) {
      parts.push('"rest": true');
    }
    if (note.accidental) {
      const accParts = [`"type": ${JSON.stringify(note.accidental.type)}`];
      if (note.accidental.cautionary === true) {
        accParts.push('"cautionary": true');
      }
      parts.push(`"accidental": { ${accParts.join(', ')} }`);
    }
    const noteLine = `{ ${parts.join(', ')} }${noteIdx < measure.notes.length - 1 ? ',' : ''}`;
    push(5, noteLine);
  });
  push(4, ']');
  push(3, `}${measureIdx < measures.length - 1 ? ',' : ''}`);
});

push(2, ']');
push(1, '},');

// Verses array (all verses including verse 1)
push(1, '"verses": [');

const verses = data.verses ?? data.additionalVerses ?? [];
verses.forEach((verse, verseIdx, arr) => {
  push(2, '{');
  push(3, `"number": ${verse.number},`);
  if (Array.isArray(verse.lines)) {
    push(3, '"lines": [');
    verse.lines.forEach((line, lineIdx) => {
      push(4, `${JSON.stringify(line)}${lineIdx < verse.lines.length - 1 ? ',' : ''}`);
    });
    push(3, '],');
  }
  if (Array.isArray(verse.syllables)) {
    push(3, '"syllables": [');
    verse.syllables.forEach((syllLine, syllIdx) => {
      const arrStr = `[${syllLine.map(s => JSON.stringify(s)).join(', ')}]`;
      push(4, `${arrStr}${syllIdx < verse.syllables.length - 1 ? ',' : ''}`);
    });
    push(3, ']');
  } else {
    push(3, '"syllables": []');
  }
  push(2, `}${verseIdx < arr.length - 1 ? ',' : ''}`);
});

push(1, ']');
push(0, '}');

fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
console.log(`Formatted ${path.basename(filePath)}`);
