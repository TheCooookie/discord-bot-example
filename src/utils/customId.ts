/** Which component handler gets a customId: the part before the first ':' ('poll:vote:42' → 'poll'). */
export const componentKey = (customId: string) => customId.split(':')[0];
