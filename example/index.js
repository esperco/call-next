import test from "blue-tape";
import * as Api from "./api";
import { call, withStub, assertDone } from "../lib/index";

/*
  Suppose you have the following function you want to test. It fetches a list
  of post ids for some category, and then fetches the full post for just the
  first id.
*/
async function oldFetchLastPost(categoryId) {
  let { postIds } = await Api.fetchRecentPostIdsByCategoryId(categoryId);
  if (postIds[0]) {
    let post = await Api.fetchPostById(postIds[0]);
    return { success: true, post };
  } else {
    return { success: false };
  }
}

/*
  To make this easier to test, use the `call` function to wrap your
  asynchronous function calls.
*/
async function newFetchLastPost(categoryId) {
  let { postIds } = await call(Api.fetchRecentPostIdsByCategoryId)(categoryId);
  if (postIds[0]) {
    let post = await call(Api.fetchPostById)(postIds[0]);
    return { success: true, post };
  } else {
    return { success: false };
  }
}

/*
  In your test, use `withStub` to step through your function.
*/
test("fetch last post by category id", t =>
  withStub(async (getCalls, next) => {
    let categoryId = "some-category-id";

    // Invoke function under test. Keep promise around for later.
    let end = newFetchLastPost(categoryId);

    t.equal(getCalls().length, 1, "Only one invocation of call() so far");

    let firstCall = getCalls(0);
    t.deepEquals(firstCall.cmd, {
      fn: Api.fetchRecentPostIdsByCategoryId,
      args: [categoryId]
    }, "Get the info for that call and verify the function being called");

    // Simulate first call resolution
    firstCall.resolve({ postIds: ["id1", "id2", "id3"] });

    // ES6 promises don't resolve immediately. next() clears the call queue
    // and jumps forward one tick so we can see what the results of our
    // call resolution was.
    await next();

    // Test only one new invocation of call
    t.equal(getCalls().length, 1,
      "Only one new invocation of call on next tick");

    let secondCall = getCalls(0);
    t.deepEquals(secondCall.cmd, {
      fn: Api.fetchPostById,
      args: ["id1"]
    }, "Second call for fetchPostById");

    // Simulate second call resolution
    let post = { id: "id1", title: "MyPost" };
    secondCall.resolve(post);

    // Test no further calls
    await next();
    t.equal(getCalls().length, 0);

    // Our promise should be resolved by now
    t.deepEquals(
      await assertDone(end),
      { post, success: true }
    );
  })
);


/*
  You can also test multiple async functions running in parallel
*/

async function getMaxValue() {
  let values = await Promise.all([
    call(Api.getValue1)(),
    call(Api.getValue2)()
  ]);
  return Math.max(...values);
};

test("getMaxValue", t => withStub(async (getCalls, next) => {
  let end = getMaxValue();
  let calls = getCalls();

  t.equals(calls.length, 2);
  t.deepEquals(getCalls(0).cmd, { fn: Api.getValue1, args: [] });
  t.deepEquals(getCalls(1).cmd, { fn: Api.getValue2, args: [] });

  getCalls(0).resolve(10);
  getCalls(1).resolve(20);

  await next();
  t.equal(await assertDone(end), 20);
}));