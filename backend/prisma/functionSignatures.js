// Single source of truth for the FUNCTION-mode (LeetCode-style) signatures assigned to the
// platform's existing hand-seeded coding questions. Referenced by BOTH the seed scripts (so a
// fresh/empty database seeds these questions in FUNCTION mode from the start) and
// migrateCodingToFunctionMode.js (a one-shot, idempotent migration that updates the equivalent
// rows on an ALREADY-seeded database — every real deployment has already run these seeders once,
// and each seeder's own "skip if any question already exists for this test/lesson/bank"
// idempotency guard means editing seed data alone has zero effect there; the migration script is
// what actually reaches already-live content).
//
// Two Interview Prep "Graphs" questions (multi-line edge-list input, read until EOF) are
// deliberately left out — that input shape doesn't fit FUNCTION mode's "one value/array per
// parameter line" convention, so they stay in full-program (STDIO) mode.
//
// Types are constrained to functionHarness.js's SUPPORTED_TYPES (int, long, double, boolean,
// string, and their 1D array forms) — there's no `char` type, so single-character
// inputs/outputs are represented as length-1 strings instead.

const MODULE_CODING_SIGNATURES = {
  "Sum of Two Integers": { methodName: "sum", returnType: "int", params: [{ name: "a", type: "int" }, { name: "b", type: "int" }] },
  "Even or Odd": { methodName: "evenOrOdd", returnType: "string", params: [{ name: "n", type: "int" }] },
  "String Length": { methodName: "stringLength", returnType: "int", params: [{ name: "s", type: "string" }] },
  "Largest of Three": { methodName: "largestOfThree", returnType: "int", params: [{ name: "a", type: "int" }, { name: "b", type: "int" }, { name: "c", type: "int" }] },
  "Truncating Cast": { methodName: "truncatingCast", returnType: "int", params: [{ name: "d", type: "double" }] },
  "Sum 1 to N": { methodName: "sumOneToN", returnType: "int", params: [{ name: "n", type: "int" }] },
  "Integer Division": { methodName: "integerDivision", returnType: "int", params: [{ name: "a", type: "int" }, { name: "b", type: "int" }] },
  "Character to ASCII": { methodName: "charToAscii", returnType: "int", params: [{ name: "c", type: "string" }] },
  "Leap Year Checker": { methodName: "isLeapYear", returnType: "boolean", params: [{ name: "year", type: "int" }] },
  "Day Number to Name": { methodName: "dayName", returnType: "string", params: [{ name: "day", type: "int" }] },
  "FizzBuzz": { methodName: "fizzBuzz", returnType: "string", params: [{ name: "n", type: "int" }] },
  "Prime Check": { methodName: "isPrime", returnType: "boolean", params: [{ name: "n", type: "int" }] },
};

// Keyed by exact `prompt` text — Practice Coding / Interview Prep questions don't have distinct
// `title`s the way formal `Question` rows do, so the prompt itself is the match key.
const PRACTICE_CODING_SIGNATURES = {
  "Read one integer and print \"Even\" if it's even, or \"Odd\" if it's odd.":
    { methodName: "evenOrOdd", returnType: "string", params: [{ name: "n", type: "int" }] },
  "Read two integers on one line, separated by a space, and print their sum.":
    { methodName: "sum", returnType: "int", params: [{ name: "a", type: "int" }, { name: "b", type: "int" }] },
  "Read one integer representing a score from 0 to 100 and print the grade: \"A\" for 90 or above, \"B\" for 75-89, \"C\" for 60-74, or \"F\" below 60.":
    { methodName: "gradeForScore", returnType: "string", params: [{ name: "score", type: "int" }] },
  "Read one integer N and print the sum of all even numbers from 1 to N (inclusive).":
    { methodName: "sumOfEvens", returnType: "int", params: [{ name: "n", type: "int" }] },
};

const INTERVIEW_CODING_SIGNATURES = {
  "Read space-separated integers on one line and print the maximum value.":
    { methodName: "maxValue", returnType: "int", params: [{ name: "nums", type: "int[]" }] },
  "Read space-separated integers and print them in reverse order, space-separated.":
    { methodName: "reverseArray", returnType: "int[]", params: [{ name: "nums", type: "int[]" }] },
  "Read a string and print \"true\" if it's a palindrome, else \"false\".":
    { methodName: "isPalindrome", returnType: "boolean", params: [{ name: "s", type: "string" }] },
  "Read a string and print the number of vowels in it.":
    { methodName: "countVowels", returnType: "int", params: [{ name: "s", type: "string" }] },
  "Read a string of brackets ()[]{} and print \"true\" if they are balanced, else \"false\".":
    { methodName: "isBalanced", returnType: "boolean", params: [{ name: "s", type: "string" }] },
  "Read space-separated integers and print \"true\" if reversing them with a stack gives a strictly descending sequence, else \"false\".":
    { methodName: "isAscending", returnType: "boolean", params: [{ name: "nums", type: "int[]" }] },
  "Read space-separated integers representing a queue (front to back). Print them after removing the front element.":
    { methodName: "dequeue", returnType: "int[]", params: [{ name: "nums", type: "int[]" }] },
  "Read space-separated integers. Print \"true\" if they are already in ascending order (a valid sorted queue), else \"false\".":
    { methodName: "isSorted", returnType: "boolean", params: [{ name: "nums", type: "int[]" }] },
  "Read a level-order array of a binary tree (space-separated, -1 for null). Print the count of non-null nodes.":
    { methodName: "countNodes", returnType: "int", params: [{ name: "levelOrder", type: "int[]" }] },
  "Read a level-order array of a binary tree (space-separated, -1 for null). Print the sum of all non-null node values.":
    { methodName: "sumNodes", returnType: "int", params: [{ name: "levelOrder", type: "int[]" }] },
  "Read an integer N and print the Nth Fibonacci number (0-indexed, F(0)=0, F(1)=1).":
    { methodName: "fib", returnType: "long", params: [{ name: "n", type: "int" }] },
  "Read an integer N and print the number of ways to climb N stairs taking 1 or 2 steps at a time.":
    { methodName: "climbStairs", returnType: "long", params: [{ name: "n", type: "int" }] },
  "Read space-separated integers (a linked list) and print them in reverse order.":
    { methodName: "reverseList", returnType: "int[]", params: [{ name: "nums", type: "int[]" }] },
  "Read space-separated integers and print them with duplicates removed, preserving first-occurrence order.":
    { methodName: "dedupe", returnType: "int[]", params: [{ name: "nums", type: "int[]" }] },
  "Read an integer N and print its factorial using recursion.":
    { methodName: "factorial", returnType: "long", params: [{ name: "n", type: "int" }] },
  "Read an integer N and print the sum of its digits using recursion.":
    { methodName: "digitSum", returnType: "int", params: [{ name: "n", type: "int" }] },
  "Read space-separated integers and print them sorted in ascending order.":
    { methodName: "sortAsc", returnType: "int[]", params: [{ name: "nums", type: "int[]" }] },
  "Read space-separated integers and print them sorted in descending order.":
    { methodName: "sortDesc", returnType: "int[]", params: [{ name: "nums", type: "int[]" }] },
  "Read space-separated sorted integers on one line and a target on the next line. Print the 0-based index of the target, or -1 if not found.":
    { methodName: "search", returnType: "int", params: [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }] },
  "Read space-separated integers on one line and a target on the next. Print \"true\" if the target exists, else \"false\".":
    { methodName: "contains", returnType: "boolean", params: [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }] },
  "Read space-separated integers and print \"true\" if there are any duplicates, else \"false\".":
    { methodName: "hasDuplicates", returnType: "boolean", params: [{ name: "nums", type: "int[]" }] },
  "Read a string and print its first non-repeating character.":
    { methodName: "firstNonRepeating", returnType: "string", params: [{ name: "s", type: "string" }] },
  "Read an integer N and print the total number of permutations of N distinct items (N!).":
    { methodName: "permutationCount", returnType: "long", params: [{ name: "n", type: "int" }] },
  "Read an integer N (board size) and print \"true\" if the N-Queens problem has at least one solution, else \"false\".":
    { methodName: "nQueensSolvable", returnType: "boolean", params: [{ name: "n", type: "int" }] },
  // Company-round CODING extras (seedInterviewExtras2.js)
  "Read space-separated integers on one line and a target sum on the next. Print the first pair (in index order) that adds up to the target, space-separated.":
    { methodName: "twoSum", returnType: "int[]", params: [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }] },
  "Read a non-negative integer and print its digits reversed (drop any leading zeros in the result).":
    { methodName: "reverseDigits", returnType: "long", params: [{ name: "n", type: "int" }] },
};

module.exports = { MODULE_CODING_SIGNATURES, PRACTICE_CODING_SIGNATURES, INTERVIEW_CODING_SIGNATURES };
