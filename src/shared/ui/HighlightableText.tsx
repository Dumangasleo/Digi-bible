import { type StyleProp, Text, type TextStyle } from 'react-native';

interface HighlightableTextProps {
  text: string;
  /** 0-based word positions to mark. */
  highlighted: readonly number[];
  /** When set, every word becomes tappable and reports its position. */
  onToggleWord?: (wordIndex: number) => void;
  style?: StyleProp<TextStyle>;
  className?: string;
}

/**
 * Splits text into words and spaces, keeping every character.
 *
 * @param text - The verse text.
 * @returns Tokens in order; whitespace tokens carry `word: -1`, words carry
 *          their 0-based word position.
 * @remarks Word positions are the storage format for highlights, so this split
 *          must stay identical between the screen that saves a highlight and the
 *          one that shows it — which is why it lives here, in one place.
 */
export function tokenizeWords(text: string): { token: string; word: number }[] {
  let word = 0;
  return text
    .split(/(\s+)/)
    .filter((token) => token.length > 0)
    .map((token) => ({ token, word: /^\s+$/.test(token) ? -1 : word++ }));
}

/**
 * Adds a word position to a selection, or removes it if already there.
 *
 * @param words - Current selection.
 * @param index - Tapped word.
 * @returns A new array; the input is not mutated.
 */
export function toggleWord(words: readonly number[], index: number): number[] {
  return words.includes(index) ? words.filter((w) => w !== index) : [...words, index];
}

/**
 * Text with highlighted words, optionally tappable to change the highlight.
 *
 * @param text - The text to show.
 * @param highlighted - Word positions to mark.
 * @param onToggleWord - Tap handler per word; omit for a read-only display.
 * @param style - Passed to the outer Text (e.g. the reader's font scale).
 * @param className - Passed to the outer Text.
 * @returns The rendered text.
 * @remarks **Tap, not drag-select.** React Native gives no way to read which
 *          characters a user has drag-selected inside a Text, so a tap per word
 *          is the selection that works the same on every phone.
 *
 *          Each word is a nested `<Text onPress>`, which React Native supports,
 *          so the paragraph still wraps as one block of text.
 */
export function HighlightableText({
  text,
  highlighted,
  onToggleWord,
  style,
  className,
}: HighlightableTextProps) {
  const marked = new Set(highlighted);

  return (
    <Text style={style} className={className}>
      {tokenizeWords(text).map(({ token, word }, i) => {
        if (word < 0) return token;
        const isMarked = marked.has(word);
        return (
          <Text
            key={i}
            onPress={onToggleWord ? () => onToggleWord(word) : undefined}
            className={
              isMarked
                ? 'bg-yellow-200 font-semibold text-neutral-900 dark:bg-yellow-500/40 dark:text-white'
                : undefined
            }>
            {token}
          </Text>
        );
      })}
    </Text>
  );
}
