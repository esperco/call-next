call-next
=========
Library to help with asynchronous testing

Usage
-----
See [example/index.js](/example/index.js).

Rationale
---------
Testing asynchronous code with side effects (e.g. a function that makes an API
call and does something with the result) can be difficult. Stubbing specific
functions in advance of a test may result in over-stubbing (e.g. stubbing all
the API calls the function under test ) or under-stubbing (e.g. forgetting to
stub a particular API call, which triggers a side effect during testing).

This library is loosely inspired by how
[Redux-Saga approaches testing](https://redux-saga.js.org/docs/advanced/Testing.html),
which uses a combination of generators and declarative effects to let a test
"step" through an otherwise asynchronous function and test that the right
things happen at each step. This library mimics that functionality for
environments where generators are unavilable or where the mental overhead of
using something like Redux-Saga is undesirable.

API
---

```ts
call<F>(fn: F): F
call<F>(context: any, fn: F): F
call<F>(context: any, name: string): context[name]
```
Wraps an async function.
Function should return a promise. You can specify a context to bind to the
function by providing the context as a first argument and the function or
the property name on the context as the second argument.

---

```ts
withStub((getCalls, next) => async { ... })
```
Stubs the `call` function.
Returns the return value of its callback (which should be a promise).
Callback receives the `getCalls` and `next` functions (see below). These
functions can also be imported directly from the `call-next` module.

---

```ts
getCalls(): Calls[]
getCalls(n: number): Call
```
Returns either a list of Call objects
(if no argument is passed) or a single Call object if passed an index for the
call being examined. There should be one Call object for each invocation
of the stubbed `call` in the last tick. A Call object comes with `resolve` and
`reject` methods to resolve and reject the promise returned by the stubbed
`call` method. It also contains a `cmd` property that declaratively describes
how it was called and can be deeply compared to an expected value:

```ts
interface Cmd {
  fn: Function;
  args: any[];
  context?: any; // If context is undefined, this property will not exist
}
```

---

```ts
next(): Promise<void>
```
Jumps one tick forward and resets the value of getCalls.

---

```ts
assertDone<T>(promise: Promise<T>): Promise<T>
```
Returns a promise that
rejects if the given promise does not resolve in the next tick. Use this
so that any async call that you forget to resolve doesn't cause our test
to timeout.

---

```ts
stub()
unstub()
```
Manually stub and unstub the `call` function. You may want to
use these functions in lieu of `withStub` if you want the stubbing to happen
in your own setup and teardown functions.

---

```ts
reset()
```
Manually reset the value of `getCalls`
