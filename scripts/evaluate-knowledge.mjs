import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isClosingMessage, isGreetingOnly, continuationSignal, isPointTopic, pointArticleTitle } from "../lib/retrieval.ts";

const cases = JSON.parse(await readFile(new URL("./knowledge-evaluation.json", import.meta.url), "utf8"));
for (const test of cases) {
  assert.equal(isGreetingOnly(test.query), test.isGreeting, `${test.query}: greeting`);
  assert.equal(isClosingMessage(test.query), test.isClosing, `${test.query}: closing`);
  assert.equal(continuationSignal(test.query), test.isContinuation, `${test.query}: continuation`);
  assert.equal(isPointTopic(test.query), test.isPointTopic, `${test.query}: point topic`);
  if (test.pointArticle) assert.equal(pointArticleTitle(test.query), test.pointArticle, `${test.query}: point article`);
}
console.log(`knowledge-evaluation passed (${cases.length} deterministic cases; live DB/Claude cases skipped)`);
