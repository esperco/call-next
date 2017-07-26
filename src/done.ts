/*
  ES6 promises don't come with any method to check their status. Waiting for
  a timeout during testing is annoying, so we use `assertDone` to verify that
  a promise has resolved or rejected by attaching a listener and jumping
  forward one tick. It's still asynchronous, but we're only waiting one tick
  instead of two.
*/
export const assertDone = <R>(p: Promise<R>) => Promise.race([
  p, Promise.reject("Promise has not resolved or rejected")
]);
