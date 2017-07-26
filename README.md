call-next
=========
Library to help with asynchronous testing

Usage
-----
Suppose you have the following function you want to test. It fetches a list
of post ids for some category, and then fetches the full post for just the
first id.

```js
async function fetchLastPostByCategoryId(categoryId) {
  let { postIds } = await Api.fetchRecentPostIdsByCategoryId(categoryId);
  if (postIds[0]) {
    let post = await Api.fetchPostById(postIds[0]);
    return { success: true, post };
  } else {
    return { success: false };
  }
}
```

To make this easier to test, use the `call` function to wrap your asynchronous
function calls.

```js
import { call } from "call-next";

async function fetchLastPostByCategoryId(categoryId) {
  let { postIds } = await call(Api.fetchRecentPostIdsByCategoryId)(categoryId);
  if (postIds[0]) {
    let post = await call(Api.fetchPostById)(postIds[0]);
    return { success: true, post };
  } else {
    return { success: false };
  }
}
```

In your test, use `withStub` to step through your function.

```js
import test from "blue-tape";
import { withStub } from "withStub";

test("fetch last post by category id", t =>
  withStub(async (getCalls, next) => {
    let categoryId = "some-category-id";

    // Invoke function under test. Keep promise around for later.
    let end = fetchLastPostByCategoryId("some-category-id");

    // Test only one invocation of call() so far
    t.equal(getCalls().length, 1);

    // Get the info for that call and verify the function being called
    let firstCall = getCalls(0);
    t.deepEquals(firstCall.cmd, {
      fn: Api.fetchRecentPostIdsByCategoryId,
      args: [categoryId]
    });

    // Simulate first call resolution
    firstCall.resolve({ postIds: ["id1", "id2", "id3"] });

    // ES6 promises don't resolve immediately. next() clears the call queue
    // and jumps forward one tick so we can see what the results of our
    // call resolution was.
    await next();

    // Test only one new invocation of call
    t.equal(getCalls().length, 1);

    // Check that our second call occurred
    let secondCall = getCalls(0);
    t.deepEquals(secondCall.cmd, {
      fn: Api.fetchPostById,
      args: ["id1"]
    });

    // Simulate second call resolution
    let post = { id: "id1", title: "MyPost" };
    secondCall.resolve(post);

    // Test no further calls
    await next();
    t.equal(getCalls().length, 0);

    // Our promise should be resolved by now
    t.deepEquals(
      await assertDone(end),
      { post, success: "true" }
    );
  })
);
```

You can also test multiple async functions running in parallel:

```js
async function getMaxValue() {
  let values = await Promise.all([
    call(getValue1)(),
    call(getValue2)()
  ]);
  return Math.max(...values);
};

test("getMaxValue", t => withStub(async (getCalls, next) => {
  let end = getMaxValue();
  let calls = getCalls();

  t.equals(calls.length, 2);
  t.deepEquals(getCalls(0).cmd, { fn: getValue1, args: [] });
  t.deepEquals(getCalls(1).cmd, { fn: getValue2, args: [] });

  getCalls(0).resolve(10);
  getCalls(1).resolve(20);

  await next();
  t.equal(await assertDone(end), 20);
}));
```

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
