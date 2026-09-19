/**
 * CivicTrust AI - Deterministic Spam, Abuse & Anomaly Gate
 * 
 * Provides explainable, multi-factor heuristic checks for text input to prevent:
 * - Repetitive character flooding (e.g. "aaaaaaa", "!!!!!!!")
 * - Word repetition flooding (e.g. "pothole pothole pothole pothole")
 * - Keyboard smashes and low lexical entropy
 * - Meaningless symbol floods
 * 
 * In strict compliance with AGENTS.md:
 * - Outputs are transparent risk signals and metrics, not unexplained scores.
 * - Fatal spam (clear abuse/nonsense) is rejected with clear citizen-friendly error messages.
 * - Borderline / suspicious text is flagged for officer review rather than silently blocked.
 */

export interface SpamCheckMetrics {
  charCount: number;
  wordCount: number;
  distinctWordCount: number;
  shannonEntropy: number;
  maxConsecutiveCharRepeat: number;
  maxConsecutiveWordRepeat: number;
  symbolRatio: number;
  consonantClusterMax: number;
}

export interface SpamCheckResult {
  isSpam: boolean;
  riskLevel: 'CLEAN' | 'SUSPICIOUS' | 'FLAGGED_SPAM';
  signals: string[];
  reasons: string[];
  metrics: SpamCheckMetrics;
}

/**
 * Common QWERTY keyboard smash sequences
 */
const KEYBOARD_SMASH_PATTERNS = [
  /asdfgh/i,
  /sdfghj/i,
  /dfghjk/i,
  /fghjkl/i,
  /qwerty/i,
  /wertyu/i,
  /ertyui/i,
  /rtyuio/i,
  /tyuiop/i,
  /zxcvbn/i,
  /xcvbnm/i,
  /123456/i,
  /qazwsx/i,
  /wsxedc/i,
];

/**
 * Calculates Shannon entropy of a string (bits per character).
 * Natural English typically scores between 3.2 and 4.8 bits/char.
 * Highly repetitive text scores < 2.0.
 */
export function calculateShannonEntropy(text: string): number {
  if (!text || text.length === 0) return 0;

  const frequencies = new Map<string, number>();
  for (const char of text) {
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }

  let entropy = 0;
  const len = text.length;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return Math.round(entropy * 100) / 100;
}

/**
 * Finds the maximum number of times any single character repeats consecutively.
 */
export function getMaxConsecutiveCharRepeat(text: string): { char: string; maxRepeat: number } {
  if (!text) return { char: '', maxRepeat: 0 };

  let maxRepeat = 0;
  let maxChar = '';
  let currentChar = '';
  let currentCount = 0;

  for (const char of text) {
    if (char === currentChar) {
      currentCount++;
    } else {
      if (currentCount > maxRepeat) {
        maxRepeat = currentCount;
        maxChar = currentChar;
      }
      currentChar = char;
      currentCount = 1;
    }
  }

  if (currentCount > maxRepeat) {
    maxRepeat = currentCount;
    maxChar = currentChar;
  }

  return { char: maxChar, maxRepeat };
}

/**
 * Finds the maximum number of consecutive repetitions of the same word.
 */
export function getMaxConsecutiveWordRepeat(words: string[]): { word: string; maxRepeat: number } {
  if (words.length === 0) return { word: '', maxRepeat: 0 };

  let maxRepeat = 0;
  let maxWord = '';
  let currentWord = '';
  let currentCount = 0;

  for (const word of words) {
    const normalized = word.toLowerCase();
    if (normalized === currentWord) {
      currentCount++;
    } else {
      if (currentCount > maxRepeat) {
        maxRepeat = currentCount;
        maxWord = currentWord;
      }
      currentWord = normalized;
      currentCount = 1;
    }
  }

  if (currentCount > maxRepeat) {
    maxRepeat = currentCount;
    maxWord = currentWord;
  }

  return { word: maxWord, maxRepeat };
}

/**
 * Checks for abnormal consonant clusters (e.g. "grthjklmn" with 7+ consecutive consonants).
 */
export function getMaxConsonantCluster(text: string): number {
  const matches = text.match(/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{4,}/g);
  if (!matches) return 0;
  return Math.max(...matches.map((m) => m.length));
}

/**
 * Main Deterministic Spam and Anomaly Detector
 */
export function detectSpamAndAnomalies(rawText?: string): SpamCheckResult {
  const reasons: string[] = [];
  const signals: string[] = [];

  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    return {
      isSpam: true,
      riskLevel: 'FLAGGED_SPAM',
      signals: ['Empty input text'],
      reasons: ['Complaint description is empty.'],
      metrics: {
        charCount: 0,
        wordCount: 0,
        distinctWordCount: 0,
        shannonEntropy: 0,
        maxConsecutiveCharRepeat: 0,
        maxConsecutiveWordRepeat: 0,
        symbolRatio: 0,
        consonantClusterMax: 0,
      },
    };
  }

  const text = rawText.trim();
  const charCount = text.length;

  // Extract word tokens (alphanumeric sequences of length >= 1)
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;
  const cleanWordTokens = words
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length >= 2);
  const distinctWords = new Set(cleanWordTokens);
  const distinctWordCount = distinctWords.size;

  // Compute metrics
  const entropy = calculateShannonEntropy(text);
  const { char: repeatChar, maxRepeat: maxConsecutiveCharRepeat } = getMaxConsecutiveCharRepeat(text);
  const { word: repeatWord, maxRepeat: maxConsecutiveWordRepeat } = getMaxConsecutiveWordRepeat(words);
  const consonantClusterMax = getMaxConsonantCluster(text);

  // Symbol ratio: non-alphanumeric and non-space characters
  const symbolCount = (text.match(/[^a-zA-Z0-9\s]/g) || []).length;
  const nonSpaceCount = (text.match(/\S/g) || []).length;
  const symbolRatio = nonSpaceCount > 0 ? Math.round((symbolCount / nonSpaceCount) * 100) / 100 : 0;

  const metrics: SpamCheckMetrics = {
    charCount,
    wordCount,
    distinctWordCount,
    shannonEntropy: entropy,
    maxConsecutiveCharRepeat,
    maxConsecutiveWordRepeat,
    symbolRatio,
    consonantClusterMax,
  };

  // --- FATAL SPAM RULES (Reject immediately with clear explanation) ---

  // Rule 1: Character repetition flood (5 or more consecutive identical characters)
  if (maxConsecutiveCharRepeat >= 5) {
    reasons.push(
      `Repetitive character sequence detected ('${repeatChar}' repeated ${maxConsecutiveCharRepeat} times).`
    );
  }

  // Rule 2: Word repetition flood (4 or more consecutive identical words)
  if (maxConsecutiveWordRepeat >= 4) {
    reasons.push(
      `Repetitive word flooding detected ('${repeatWord}' repeated ${maxConsecutiveWordRepeat} times).`
    );
  }

  // Rule 3: Severe vocabulary constraint / single word dominance
  if (wordCount >= 5 && distinctWordCount === 1) {
    reasons.push(
      `Description contains ${wordCount} words but only 1 unique word ('${Array.from(distinctWords)[0]}'). Meaningful descriptions require varied vocabulary.`
    );
  }

  // Rule 4: Extremely low Shannon entropy on medium-to-long strings (keyboard smash or single-char flood)
  if (charCount >= 15 && entropy < 2.0) {
    reasons.push(
      `Text information diversity is too low (entropy: ${entropy} bits/char). Text lacks normal linguistic variation.`
    );
  }

  // Rule 5: Known QWERTY keyboard smash sequence
  for (const smashRegex of KEYBOARD_SMASH_PATTERNS) {
    if (smashRegex.test(text)) {
      reasons.push('Detected sequential keyboard typing sequence (keyboard smash).');
      break;
    }
  }

  // Rule 6: Unnatural consonant cluster (7+ consecutive consonants without vowel or space)
  if (consonantClusterMax >= 7) {
    reasons.push(
      `Detected unnatural consonant sequence (${consonantClusterMax} consonants in a row).`
    );
  }

  // Rule 7: Extreme symbol flooding (> 60% non-alphanumeric symbols when length >= 15)
  if (charCount >= 15 && symbolRatio > 0.60) {
    reasons.push(
      `Excessive non-alphanumeric symbols detected (${Math.round(symbolRatio * 100)}% of content).`
    );
  }

  // --- SUSPICIOUS ANOMALY RULES (Flag for officer review without outright rejection) ---
  const suspiciousSignals: string[] = [];

  // Suspicious: Word repetition 3 times
  if (maxConsecutiveWordRepeat === 3) {
    suspiciousSignals.push(
      `Moderate word repetition: '${repeatWord}' repeated 3 times consecutively.`
    );
  }

  // Suspicious: Consecutive char repeat 4 times (e.g. "soooo", "noooo")
  if (maxConsecutiveCharRepeat === 4) {
    suspiciousSignals.push(
      `Character emphasis detected: '${repeatChar}' repeated 4 times.`
    );
  }

  // Suspicious: Moderately low entropy (between 2.0 and 2.6) for text >= 20 chars
  if (charCount >= 20 && entropy >= 2.0 && entropy < 2.6) {
    suspiciousSignals.push(
      `Low lexical diversity: entropy is ${entropy} bits/char (typical English text is 3.2 - 4.8).`
    );
  }

  // Suspicious: High symbol ratio (between 35% and 60%)
  if (charCount >= 15 && symbolRatio >= 0.35 && symbolRatio <= 0.60) {
    suspiciousSignals.push(
      `Elevated symbol content: ${Math.round(symbolRatio * 100)}% of text consists of punctuation or special characters.`
    );
  }

  // Suspicious: Few distinct words despite long description
  if (charCount > 50 && distinctWordCount < 3) {
    suspiciousSignals.push(
      `Low vocabulary depth: only ${distinctWordCount} distinct words in ${charCount} characters.`
    );
  }

  // Determine overall outcome
  if (reasons.length > 0) {
    return {
      isSpam: true,
      riskLevel: 'FLAGGED_SPAM',
      signals: reasons.map((r) => `SPAM_GATE_FAILURE: ${r}`),
      reasons,
      metrics,
    };
  }

  if (suspiciousSignals.length > 0) {
    return {
      isSpam: false,
      riskLevel: 'SUSPICIOUS',
      signals: suspiciousSignals.map((s) => `ANOMALY_SIGNAL: ${s}`),
      reasons: [],
      metrics,
    };
  }

  return {
    isSpam: false,
    riskLevel: 'CLEAN',
    signals: [
      `Spam gate passed: lexical entropy ${entropy} bits/char, ${distinctWordCount} unique words, symbol ratio ${symbolRatio}.`,
    ],
    reasons: [],
    metrics,
  };
}
