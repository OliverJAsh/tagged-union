import { TaggedUnionMember, Exact } from 'typelevel-ts'
import { TAG, Unit } from './internal'

/**
 * Utility for defining variants of tagged sum types
 *
 * @param Tag a string literal type used to name/tag the variant being defined
 * @param Value (optional) the type of the value of the variant being defined. Defaults to `Tag`.
 *
 * @definition
 * ```ts
 * export type Def<Tag extends string, Value = Unit> =
 *   { readonly [TAG]: Tag } & { readonly [K in Tag]: Value }
 * ```
 *
 * @example
 * ```ts
 * type Maybe<A> =
 *   | Def<'Nothing'>
 *   | Def<'Just', A>
 * ```
 *
 * is literally equivalent to
 *
 * ```ts
 * type Maybe<A> =
 *   | { tag: 'Nothing', Nothing: Unit }
 *   | { tag: 'Just', Just: A }
 *
 * ```
 */
export type Def<Tag extends string, Value = Unit> = { readonly [TAG]: Tag } & {
  readonly [K in Tag]: Value
}

/**
 * A struct of tag-handler pairs, where the handler function
 * receives whatever value (if any) is associated with the
 * given tag.
 *
 */
export type CaseOfStruct<D extends Def<string, unknown>, R> =
  | ExhaustiveCaseOfStruct<D, R>
  | PartialCaseOfStruct<D, R>

type ExhaustiveCaseOfStruct<U extends Def<string, unknown>, R> = {
  readonly [K in U[typeof TAG]]: (val: Extract<U, { [TAG]: K }>[K]) => R
}

type PartialCaseOfStruct<D extends Def<string, unknown>, R> = FallbackMatch<R> &
  Partial<ExhaustiveCaseOfStruct<D, R>>

type FallbackMatch<R> = { readonly _: () => R }

/**
 * A struct of tag-handler pairs, where the handler function
 * receives whatever value (if any) is associated with the
 * given tag. Enforces that all cases are covered and that
 * no excess properties are present.
 *
 */
export type StrictCaseOfStruct<
  D extends Def<string, any>,
  C extends CaseOfStruct<any, any>
> = C extends ExhaustiveCaseOfStruct<D, infer R> & FallbackMatch<infer R>
  ? ExhaustiveCaseOfStruct<D, R>
  : C extends ExhaustiveCaseOfStruct<D, infer R>
  ? Exact<ExhaustiveCaseOfStruct<D, R>, C>
  : C

/**
 * Infers whatever type is returned from all case expressions
 */
export type CaseOfReturn<
  D extends Def<string, unknown>,
  M extends CaseOfStruct<D, unknown>
> = M extends CaseOfStruct<D, infer R> ? R : unknown

/**
 * Constructs a tagged variant.
 * Used to define nullary* data constructors for tagged sum variants.
 *
 * * _"nullary" meaning "arity zero", or not needing any arguments_
 *
 * @example
 * ```ts
 * type Maybe<A> =
 *   | Def<'Nothing'>
 *   | Def<'Just', A>
 *
 * const Nothing: Maybe<never> = def('Nothing')
 * const Just = <A>(a: A): Maybe<A> def('Just', a)
 *
 * const maybeString: Maybe<string> = Nothing
 * ```
 */
export function def<D extends Def<string, unknown>, T extends D[typeof TAG]>(
  tag: string extends T ? never : T
): D extends Def<string, unknown> ? Def<T, Unit> : Def<T, Unit> extends D ? D : Def<T, Unit>

/**
 * Constructs a tagged variant parameterized by some type.
 * Used to define n-arity* data constructors for tagged sum variants.
 *
 * * _"n-arity" meaning it requires some number of arguments to construct_
 *
 * @example
 * ```ts
 * type Maybe<A> =
 *   | Def<'Nothing'>
 *   | Def<'Just', A>
 *
 * const Nothing: Maybe<never> = def('Nothing')
 * const Just = <A>(a: A): Maybe<A> def('Just', a)
 *
 * const maybeString: Maybe<string> = Just("hello")
 * ```
 */
export function def<
  D extends Def<string, unknown>,
  T extends D[typeof TAG],
  V extends Def<string, unknown> extends D ? unknown : TaggedUnionMember<D, typeof TAG, T>[T]
>(
  tag: string extends T ? never : T,
  value: V
): D extends Def<string, unknown> ? Def<typeof tag, typeof value> : D

export function def<
  D extends Def<string, unknown>,
  T extends D[typeof TAG],
  V extends Def<string, unknown> extends D ? unknown : TaggedUnionMember<D, typeof TAG, T>[T]
>(tag: string extends T ? never : T, value?: V) {
  return value === undefined ? { [TAG]: tag, [tag]: Unit } : { [TAG]: tag, [tag]: value }
}

/**
 * A curried, data-last (i.e. pipeable) version of [caseWhen](#caseWhen)
 *
 * Pattern matching for tagged unions. Supply a struct of tag-handler pairs
 * to handle each case of the tagged sum. Use the `_` pattern to provide a
 * fallback handler if you don't want to handle every variant of the union.
 *
 * @example
 * ```ts
 * type List<A> =
 *   | Def<'Nil'>
 *   | Def<'Cons', [A, List<A>]>
 *
 * const ls: List<string> = List.singleton('hello')
 *
 * const num: number = pipe(
 *   ls,
 *   caseOf({
 *     Nil: () => 0,
 *     Cons: ([a, ls]) => 1
 *   })
 * )
 *
 * const fallbackCase = pipe(
 *   ls,
 *   caseOf({
 *     Cons: ([a, as]) => a,
 *     _: () => 'fallback'
 *   })
 * )
 *
 * expect(num).toEqual(1)
 * expect(fallbackCase).toEqual('fallback')
 * ```
 *
 * @param D a tagged variant against which to pattern match
 * @param C an object/struct defining how to handle all possible variants of the tagged sum
 */
export function caseOf<D extends Def<string, unknown>, C extends CaseOfStruct<D, unknown>>(
  cases: StrictCaseOfStruct<D, C>
): (data: D) => CaseOfReturn<D, C> {
  return data => caseWhen(data, cases)
}

/**
 * Pattern matching for tagged unions. Supply a struct of tag-handler pairs
 * to handle each case of the tagged sum. Use the `_` pattern to provide a
 * fallback handler if you don't want to handle every variant of the union.
 *
 * @example
 * ```ts
 * type List<A> =
 *   | Def<'Nil'>
 *   | Def<'Cons', [A, List<A>]>
 *
 * const ls: List<string> = List.singleton('hello')
 * const num: number = caseWhen(ls, {
 *   Nil: () => 0,
 *   Cons: ([a, ls]) => 1
 * })
 *
 * const fallbackCase = caseWhen(ls, {
 *   Cons: ([a, as]) => a,
 *   _: () => 'fallback'
 * })
 *
 * expect(num).toEqual(1)
 * expect(fallbackCase).toEqual('fallback')
 * ```
 *
 * @param D a tagged variant against which to pattern match
 * @param C an object/struct defining how to handle all possible variants of the tagged sum
 */
export function caseWhen<D extends Def<string, unknown>, C extends CaseOfStruct<D, unknown>>(
  data: D,
  cases: StrictCaseOfStruct<D, C>
): CaseOfReturn<D, C> {
  if (isPartialCaseOfStruct<D, CaseOfReturn<D, C>>(cases)) {
    const tag: D[typeof TAG] = data[TAG]
    const val: D[D[typeof TAG]] = data[tag]
    const handler = cases[tag]
    const fallback: () => CaseOfReturn<D, C> = cases['_']

    if (isCaseHandler<D[D[typeof TAG]], CaseOfReturn<D, C>>(handler, val)) {
      return handler(val)
    } else {
      return fallback()
    }
  }
  const tag: D[typeof TAG] = data[TAG]
  const val: D[D[typeof TAG]] = data[tag]
  const handler = (cases[tag] as unknown) as (v: typeof val) => CaseOfReturn<D, C>

  return handler(val)
}

// ----------------------------------------------

function isPartialCaseOfStruct<D extends Def<string, unknown>, R>(
  v: unknown
): v is PartialCaseOfStruct<D, R> {
  return typeof v === 'object' && typeof (v as any)['_'] === 'function'
}

function isCaseHandler<T, R>(f: unknown, v: T): f is (val: T) => R {
  if (typeof f === 'function') {
    try {
      f(v)
      return true
    } catch (e) {
      /* istanbul ignore next */
      return false
    }
  } else {
    return false
  }
}
