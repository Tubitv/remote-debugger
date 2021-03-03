// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Parameters<T> = T extends (...args: infer T) => any ? T : never;
