/** A finger rather than a mouse is the main pointer: phones and most tablets. */
export const IS_TOUCH = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse), (hover: none)').matches;
