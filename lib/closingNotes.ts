// Closing notes are stored in jobs.closing_notes as plain structured text, so every app,
// email and report that already prints closing_notes shows them without changes:
//
//   Problem/Issue:
//   <text>
//
//   Troubleshooting:
//   <text>
//
//   Resolution:
//   <text>

export interface ClosingAnswers {
  problem: string;
  troubleshooting: string;
  resolution: string;
}

export const CLOSING_QUESTIONS: { key: keyof ClosingAnswers; heading: string; question: string; placeholder: string }[] = [
  { key: 'problem', heading: 'Problem/Issue', question: 'What was the problem?', placeholder: 'What the customer reported or what you found...' },
  { key: 'troubleshooting', heading: 'Troubleshooting', question: 'What troubleshooting was done?', placeholder: 'Checks, tests and steps taken to find the cause...' },
  { key: 'resolution', heading: 'Resolution', question: 'How was it resolved?', placeholder: 'Work performed, parts used, any follow-up needed...' },
];

export const EMPTY_CLOSING_ANSWERS: ClosingAnswers = { problem: '', troubleshooting: '', resolution: '' };

export function formatClosingNotes(answers: ClosingAnswers): string {
  return CLOSING_QUESTIONS
    .map(q => ({ heading: q.heading, text: answers[q.key].trim() }))
    .filter(s => s.text)
    .map(s => `${s.heading}:\n${s.text}`)
    .join('\n\n');
}

// Reads structured text back into the three answers. Older free-text closing notes
// (no headings) are returned under "resolution" so nothing is lost when re-editing.
export function parseClosingNotes(text: string | null | undefined): ClosingAnswers {
  const answers: ClosingAnswers = { ...EMPTY_CLOSING_ANSWERS };
  if (!text?.trim()) return answers;
  let current: keyof ClosingAnswers | null = null;
  const unstructured: string[] = [];
  for (const line of text.split('\n')) {
    const match = CLOSING_QUESTIONS.find(q => line.trim() === `${q.heading}:`);
    if (match) { current = match.key; continue; }
    if (current) answers[current] += (answers[current] ? '\n' : '') + line;
    else unstructured.push(line);
  }
  for (const q of CLOSING_QUESTIONS) answers[q.key] = answers[q.key].trim();
  const leftover = unstructured.join('\n').trim();
  if (leftover) answers.resolution = [leftover, answers.resolution].filter(Boolean).join('\n');
  return answers;
}
