import { Cmd, PromiseFn, setStub } from "./call";

// Data for a single call to the `call` function
export interface Call<T> {
  cmd: Cmd<PromiseFn<T>>;

  // Resolve promise for this call
  resolve: (t: T) => void;
  reject: (err?: any) => void;
}

// Persistent var for tracking context calls
let calls: Call<any>[] = [];

/*
  Record a command passed to the call function
*/
export const track = <T>(cmd: Cmd<PromiseFn<T>>): Promise<T> => {
  let resolve: (t: T) => void;
  let reject: (err: any) => void;
  let promise = new Promise<T>((ok, err) => {
    resolve = ok;
    reject = err;
  });

  // Normalize cmd's context for testing purposes
  if (typeof cmd.context === "undefined" || cmd.context === null) {
    cmd = { fn: cmd.fn, args: cmd.args };
  }

  calls.push({
    cmd,
    resolve: resolve!,
    reject: reject!
  });

  return promise;
};

// Enable stubbing (tracking)
export const stub = () => {
  reset();
  setStub(track);
};

// Disable stubbing
export const unstub = () => {
  setStub();
};

// Reset list of calls made so far
export const reset = () => {
  calls = [];
};

// Jumps one tick forward. Resets calls.
export const next = async () => {
  reset();
  await Promise.resolve();
};

/*
  Call with number to get a specific call. Call without to get a list
  of all calls in the last tick.

  NB: We technically should type return with number as Call<any>|undefined,
  but we don't really need that degree of type-safety in testing and it's
  a hassle to add additional null-checks for each `getCalls(n)` call.
*/
export function getCalls(n: number): Call<any>;
export function getCalls(): Call<any>[];
export function getCalls(n?: number): Call<any>|Call<any>[] {
  if (typeof n === "number") {
    return calls[n];
  }
  return calls;
}


export type GetCallsFn = typeof getCalls;
export type NextFn = typeof next;

/*
  Wrap a function call with stubs. Prefereable to manually stubbing insofar
  that it always unstubs.
*/
export const withStub = async <T>(
  fn: (getCalls: GetCallsFn, next: NextFn) => Promise<T>
): Promise<T> => {
  stub();
  reset();
  try {
    return (await fn(getCalls, next));
  }
  finally {
    unstub();
  }
};