import test = require("blue-tape");
import * as Sinon from "sinon";
import { call, withStub, assertDone } from "./index";

// Promise function to introduce async behavior
const tick = <T>(ret: T) => Promise.resolve(ret);

// Like tick, but a contextual variant
const contextObj = {
  tick(n: number) { return Promise.resolve(n + this.incr); },
  incr: 1
};

/*
  Factory for function under test. Includes both sequential and paralell
  promises.
*/
const getTestFn = (spy: (typeof tick)) => async () => {
  let x = await call(spy)(1);
  let y = await Promise.all([
    call(spy)(2),
    call(spy)(3)
  ]);
  return x + y[0] + y[1];
};

test("call() invokes original function by default", async t => {
  const spy = Sinon.spy(tick);
  const testFn = getTestFn(spy);

  const ret = await testFn();
  Sinon.assert.calledWith(spy, 1);
  Sinon.assert.calledWith(spy, 2);
  Sinon.assert.calledWith(spy, 3);
  t.equals(ret, 6, "Function under test returns original results");
});

test("call() can invoke function with a context", async t => {
  t.equals(await call(contextObj, "tick")(1), 2,
    "Can use object-string format");

  t.equals(await call({ incr: 10 }, contextObj.tick)(2), 12,
    "Can reference function itself with any kind of context");
});

test("assertDone() errors when passed a Promise that has not resolved",
async t => {
  try {
    await assertDone(new Promise(() => {}));
    t.fail("Promise should reject");
  }
  catch (err) {} // Success
});

test("withStub allows step-by-step control of call", t =>
  withStub(async (getCalls, next) => {
    const spy = Sinon.spy(tick);
    const testFn = getTestFn(spy);

    // Start function, save function for return later
    let endP = testFn();

    t.equal(getCalls().length, 1,
      "Only one call in test function");
    t.deepEquals(getCalls(0), getCalls()[0],
      "getCalls with an index equivalent to grabbing index from array");
    t.deepEquals(getCalls(0)!.cmd, {
      fn: spy,
      args: [1]
    }, "Records command and args");

    // Spy should not be called, intercepted by stub.
    Sinon.assert.notCalled(spy);

    // Test resolution with different values than original
    getCalls(0).resolve(5);

    // Test parallel calls
    await next();
    t.deepEquals(getCalls(0).cmd, {
      fn: spy,
      args: [2]
    }, "Next goes to next command after resolution");
    t.deepEquals(getCalls(1).cmd, {
      fn: spy,
      args: [3]
    }, "Next calls parallel promises as well on next tick");
    t.equal(getCalls().length, 2, "Next resets calls");

    // Test resolution with different values again
    getCalls(0).resolve(10);
    getCalls(1).resolve(15);
    await next();

    t.equal(await assertDone(endP), 5 + 10 + 15,
      "System under test uses resolved values, not originals");

    // Test that we never invoked original functions, even after resolution.
    Sinon.assert.notCalled(spy);
  }));

test("withStub allows rejection of calls", t =>
  withStub(async (getCalls, next) => {
    const spy = Sinon.spy(tick);
    const testFn = getTestFn(spy);

    // Start function, save function for return later
    let endP = testFn();

    // Trigger error
    const splatErr = new Error("Splat!");
    getCalls(0).reject(splatErr);
    await next();

    try {
      await assertDone(endP);
      t.fail("Promise shoud reject");
    } catch (err) {
      t.equal(err, splatErr, "Promise should reject with right error");
    }
  }));

test("withStub captures context information in calls", t =>
  withStub(async (getCalls, next) => {
    call(contextObj, "tick")(1);
    t.deepEqual(getCalls(0).cmd, {
      fn: contextObj.tick,
      args: [1],
      context: contextObj
    });

    let contextObj2 = { incr: 10 };
    call(contextObj2, contextObj.tick)(2);
    t.deepEqual(getCalls(1).cmd, {
      fn: contextObj.tick,
      args: [2],
      context: contextObj2
    });
  }));

  test("withStub resets in the event of error", async t => {
    const whoopsErr = new Error("Whoops");

    try {
      await withStub((getCalls, next) => Promise.all([
        call(tick)(1),
        Promise.reject(whoopsErr)
      ]));
      t.fail("withStub error should bubble up");
    }
    catch (err) {
      t.deepEqual(err, whoopsErr, "withStub error should bubble up");
    }

    // Test that call function works normally again
    t.deepEqual(await call(tick)("abc"), "abc",
      "Call function works normally after withStub exits");

    return withStub(async (getCalls, next) => {
      t.equals(getCalls().length, 0,
        "Calls reset after prior withStub exit");

      call(tick)(2);
      t.deepEqual(getCalls(0).cmd, {
        fn: tick,
        args: [2]
      }, "Call tracking works normally after prior withStub exit");
    });
  });
