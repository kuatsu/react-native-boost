/**
 * Recursive style prop shape accepted by runtime style helpers.
 *
 * @template T - Style object type.
 */
export type GenericStyleProp<T> = null | void | T | false | '' | ReadonlyArray<GenericStyleProp<T>>;
