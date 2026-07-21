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
  "Sum of Digits (Recursive)": { methodName: "sumOfDigitsRecursive", returnType: "int", params: [{ name: "n", type: "int" }] },
  "Power of a Number": { methodName: "power", returnType: "long", params: [{ name: "base", type: "int" }, { name: "exp", type: "int" }] },
  "Palindrome Number Check": { methodName: "isPalindromeNumber", returnType: "boolean", params: [{ name: "n", type: "int" }] },
  "Sum of Array (Recursive)": { methodName: "sumOfArrayRecursive", returnType: "int", params: [{ name: "nums", type: "int[]" }] },
  "Sum of Array Elements": { methodName: "sumArray", returnType: "int", params: [{ name: "nums", type: "int[]" }] },
  "Find Maximum in Array": { methodName: "findMax", returnType: "int", params: [{ name: "nums", type: "int[]" }] },
  "Binary Search": { methodName: "binarySearch", returnType: "int", params: [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }] },
  "Count Even Numbers": { methodName: "countEven", returnType: "int", params: [{ name: "nums", type: "int[]" }] },
  "Reverse a String": { methodName: "reverseString", returnType: "string", params: [{ name: "s", type: "string" }] },
  "Count Character Occurrences": { methodName: "countChar", returnType: "int", params: [{ name: "s", type: "string" }, { name: "c", type: "string" }] },
  "Check Anagram": { methodName: "isAnagram", returnType: "boolean", params: [{ name: "a", type: "string" }, { name: "b", type: "string" }] },
  "Title Case a Sentence": { methodName: "titleCase", returnType: "string", params: [{ name: "s", type: "string" }] },
  "Simple Interest Calculator": { methodName: "simpleInterest", returnType: "long", params: [{ name: "principal", type: "int" }, { name: "ratePercent", type: "int" }, { name: "years", type: "int" }] },
  "Employee Bonus Eligibility": { methodName: "isEligibleForBonus", returnType: "boolean", params: [{ name: "years", type: "int" }, { name: "rating", type: "int" }] },
  "Compare Circle Areas": { methodName: "isFirstCircleLarger", returnType: "boolean", params: [{ name: "r1", type: "double" }, { name: "r2", type: "double" }] },
  "Price After Discount": { methodName: "priceAfterDiscount", returnType: "long", params: [{ name: "price", type: "double" }, { name: "discountPercent", type: "int" }] },
  "Validate Age": { methodName: "validateAge", returnType: "string", params: [{ name: "age", type: "int" }] },
  "Safe Parse Integer": { methodName: "safeParseInt", returnType: "int", params: [{ name: "s", type: "string" }] },
  "Safe Square Root": { methodName: "safeSqrt", returnType: "int", params: [{ name: "n", type: "int" }] },
  "Bank Withdrawal Validator": { methodName: "validateWithdrawal", returnType: "string", params: [{ name: "balance", type: "double" }, { name: "amount", type: "double" }] },
  "First Unique Element": { methodName: "firstUnique", returnType: "int", params: [{ name: "nums", type: "int[]" }] },
  "Balanced Parentheses": { methodName: "isBalancedParens", returnType: "boolean", params: [{ name: "s", type: "string" }] },
  "Front After K Dequeues": { methodName: "frontAfterDequeues", returnType: "int", params: [{ name: "nums", type: "int[]" }, { name: "k", type: "int" }] },
  "Merge Two Sorted Arrays": { methodName: "mergeSorted", returnType: "int[]", params: [{ name: "a", type: "int[]" }, { name: "b", type: "int[]" }] },
  "Count Long Words": { methodName: "countLongWords", returnType: "int", params: [{ name: "words", type: "string[]" }] },
  "Find Longest Word": { methodName: "longestWord", returnType: "string", params: [{ name: "words", type: "string[]" }] },
  "Total Word Length": { methodName: "totalWordLength", returnType: "int", params: [{ name: "words", type: "string[]" }] },
  "Count Capitalized Words": { methodName: "countCapitalizedWords", returnType: "int", params: [{ name: "s", type: "string" }] },
  "Last Thread to Finish": { methodName: "lastThreadToFinish", returnType: "int", params: [{ name: "completionTimes", type: "int[]" }] },
  "Total Sequential Execution Time": { methodName: "sumDurations", returnType: "int", params: [{ name: "durations", type: "int[]" }] },
  "Lost Update Count": { methodName: "lostUpdates", returnType: "int", params: [{ name: "totalIncrements", type: "int" }, { name: "actualFinalValue", type: "int" }] },
  "Last Worker Task Count": { methodName: "lastWorkerTaskCount", returnType: "int", params: [{ name: "totalTasks", type: "int" }, { name: "workers", type: "int" }] },
  "First Match or Default": { methodName: "firstGreaterThan", returnType: "int", params: [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }] },
  "Uppercase All Words": { methodName: "uppercaseJoin", returnType: "string", params: [{ name: "words", type: "string[]" }] },
  "Count Positive Numbers": { methodName: "countPositive", returnType: "int", params: [{ name: "nums", type: "int[]" }] },
  "Product of All Elements": { methodName: "productOfAll", returnType: "long", params: [{ name: "nums", type: "int[]" }] },
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
  "Read two integers M and N and print their greatest common divisor (GCD), computed using recursion (Euclidean algorithm).":
    { methodName: "gcd", returnType: "int", params: [{ name: "a", type: "int" }, { name: "b", type: "int" }] },
  "Read one integer and print \"true\" if it is a power of two, or \"false\" otherwise.":
    { methodName: "isPowerOfTwo", returnType: "boolean", params: [{ name: "n", type: "int" }] },
  "Read space-separated integers and print the second largest distinct value in the array (there will be at least two distinct values).":
    { methodName: "secondLargest", returnType: "int", params: [{ name: "nums", type: "int[]" }] },
  "Read space-separated integers on one line and a target integer on the next line. Print how many times the target appears in the array.":
    { methodName: "countOccurrences", returnType: "int", params: [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }] },
  "Read a string and print it with all vowels (a, e, i, o, u, both cases) removed.":
    { methodName: "removeVowels", returnType: "string", params: [{ name: "s", type: "string" }] },
  "Read a string and print \"true\" if every character in it is a digit, or \"false\" otherwise.":
    { methodName: "isNumeric", returnType: "boolean", params: [{ name: "s", type: "string" }] },
  "Read a rectangle's length and width, and print its area and perimeter as two space-separated integers (area first, then perimeter).":
    { methodName: "rectangleAreaPerimeter", returnType: "int[]", params: [{ name: "length", type: "int" }, { name: "width", type: "int" }] },
  "Read the radius of a circle and print the floor of its area (using pi) as an integer.":
    { methodName: "circleAreaFloor", returnType: "int", params: [{ name: "radius", type: "double" }] },
  "Read two integers a and b, and print a / b as an integer. If b is 0, print \"Error: division by zero\" instead of crashing.":
    { methodName: "safeDivide", returnType: "string", params: [{ name: "a", type: "int" }, { name: "b", type: "int" }] },
  "Read space-separated integers on one line and an index on the next line. If the index is valid, print the element at that index; otherwise print \"Error: index out of bounds\".":
    { methodName: "safeGet", returnType: "string", params: [{ name: "nums", type: "int[]" }, { name: "index", type: "int" }] },
  "Read space-separated integers and print the value that appears most frequently (there is a unique winner).":
    { methodName: "mostFrequent", returnType: "int", params: [{ name: "nums", type: "int[]" }] },
  "Read space-separated integers on one line and an integer K on the next line. Print the Kth largest value.":
    { methodName: "kthLargest", returnType: "int", params: [{ name: "nums", type: "int[]" }, { name: "k", type: "int" }] },
  "Read a string representing text content (space-separated words) and print the total word count.":
    { methodName: "wordCount", returnType: "int", params: [{ name: "s", type: "string" }] },
  "Read space-separated integers (as if read line by line from a file of scores) and print their average, floored to the nearest integer.":
    { methodName: "averageScore", returnType: "int", params: [{ name: "scores", type: "int[]" }] },
  "Read space-separated integers representing amounts contributed by different worker threads (each protected by proper synchronization, so no updates are lost) and print the final total.":
    { methodName: "sumWithSynchronization", returnType: "int", params: [{ name: "amounts", type: "int[]" }] },
  "Read space-separated integers representing the sleep duration in ms of each worker thread, all started at the same time and joined afterward. Print the total wall-clock time until all have finished (the MAXIMUM duration, since they run in parallel, not the sum).":
    { methodName: "maxWorkerDuration", returnType: "int", params: [{ name: "durations", type: "int[]" }] },
  "Read space-separated integers and print the sum of the squares of only the even numbers.":
    { methodName: "sumOfEvenSquares", returnType: "int", params: [{ name: "nums", type: "int[]" }] },
  "Read space-separated integers on one line and a threshold on the next line. Print the count of values strictly greater than the threshold.":
    { methodName: "countGreaterThan", returnType: "int", params: [{ name: "nums", type: "int[]" }, { name: "threshold", type: "int" }] },
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
