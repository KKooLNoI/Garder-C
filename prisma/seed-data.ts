// Seed content: 4 chapters, 20 problems. Expected outputs are produced by `solve`,
// a reference implementation, so they are never hand-typed.

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface SeedProblem {
  slug: string;
  title: string;
  chapter: number; // index into chapters
  difficulty: Difficulty;
  score: number;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  hints: string[];
  starterCode: string;
  explanation: string;
  /** Test inputs. The first `samples` entries are visible; the rest are hidden. */
  inputs: string[];
  samples: number;
  solve: (input: string) => string;
  floatTolerance?: number;
}

export const chapters = [
  { slug: "basic-io", title: "Basic Input / Output", description: "Print text and read numbers with printf and scanf." },
  { slug: "variables-operators", title: "Variables and Operators", description: "Store values and compute with arithmetic operators." },
  { slug: "conditionals", title: "Conditional Statements", description: "Make decisions with if / else." },
  { slug: "loops", title: "Loops", description: "Repeat work with for and while loops." },
];

const nums = (s: string) => s.trim().split(/\s+/).map(Number);
const f2 = (x: number) => x.toFixed(2);

const stub = (body: string, header = "#include <stdio.h>\n\n") =>
  `${header}int main(void) {\n${body}\n    return 0;\n}\n`;

export const problems: SeedProblem[] = [
  {
    slug: "hello-world", title: "Hello World", chapter: 0, difficulty: "EASY", score: 10,
    statement: "Print the text `Hello, World!` followed by a newline.",
    inputFormat: "There is no input.", outputFormat: "A single line: `Hello, World!`",
    constraints: "None.", hints: ["Use printf from <stdio.h>.", "End the line with \\n."],
    starterCode: stub("    // Write your code here"),
    explanation: "printf(\"Hello, World!\\n\"); prints the text.",
    inputs: ["", ""], samples: 1, solve: () => "Hello, World!\n",
  },
  {
    slug: "print-your-name", title: "Print Your Name", chapter: 0, difficulty: "EASY", score: 10,
    statement: "Read a single word (a name) and print `Hello, <name>!`.",
    inputFormat: "One word `name` with no spaces.", outputFormat: "`Hello, <name>!`",
    constraints: "1 ≤ length of name ≤ 50, letters only.",
    hints: ["Declare `char name[64];`.", "Read with scanf(\"%s\", name)."],
    starterCode: stub("    char name[64];\n    // Read the name and print the greeting"),
    explanation: "scanf(\"%s\") reads one word; printf(\"Hello, %s!\\n\", name) prints it.",
    inputs: ["Alice\n", "Bob\n", "Z\n", "Chananthorn\n", "Sam\n"], samples: 2,
    solve: (i) => `Hello, ${i.trim()}!\n`,
  },
  {
    slug: "sum-of-two-numbers", title: "Sum of Two Numbers", chapter: 0, difficulty: "EASY", score: 10,
    statement: "Read two integers and print their sum.",
    inputFormat: "Two integers `a` and `b` separated by a space.", outputFormat: "One integer: a + b",
    constraints: "-10^9 ≤ a, b ≤ 10^9 (use `long long`).",
    hints: ["The sum can exceed the range of int.", "Use %lld with long long."],
    starterCode: stub("    long long a, b;\n    // Read a and b, print a + b"),
    explanation: "Read both values as long long and print a + b.",
    inputs: ["3 5\n", "-4 10\n", "0 0\n", "1000000000 1000000000\n", "-1000000000 -1000000000\n", "123 -123\n"], samples: 2,
    solve: (i) => { const [a, b] = nums(i); return `${a + b}\n`; },
  },
  {
    slug: "difference-of-two-numbers", title: "Difference of Two Numbers", chapter: 0, difficulty: "EASY", score: 10,
    statement: "Read two integers `a` and `b` and print `a - b`.",
    inputFormat: "Two integers separated by a space.", outputFormat: "One integer: a - b",
    constraints: "-10^9 ≤ a, b ≤ 10^9.",
    hints: ["Order matters: a - b is not b - a."],
    starterCode: stub("    long long a, b;\n    // Read a and b, print a - b"),
    explanation: "Print a - b using long long.",
    inputs: ["10 3\n", "3 10\n", "0 0\n", "-1000000000 1000000000\n", "7 -7\n"], samples: 2,
    solve: (i) => { const [a, b] = nums(i); return `${a - b}\n`; },
  },
  {
    slug: "rectangle-area", title: "Calculate Rectangle Area", chapter: 0, difficulty: "EASY", score: 10,
    statement: "Read the width and height of a rectangle (integers) and print its area.",
    inputFormat: "Two integers `w` and `h`.", outputFormat: "One integer: w × h",
    constraints: "1 ≤ w, h ≤ 10^6.", hints: ["Area = width × height.", "The product may exceed int; use long long."],
    starterCode: stub("    long long w, h;\n    // Read w and h, print the area"),
    explanation: "Multiply w by h using long long.",
    inputs: ["4 5\n", "1 1\n", "1000000 1000000\n", "12 7\n", "999999 2\n"], samples: 2,
    solve: (i) => { const [w, h] = nums(i); return `${BigInt(w) * BigInt(h)}\n`; },
  },
  {
    slug: "celsius-to-fahrenheit", title: "Convert Celsius to Fahrenheit", chapter: 1, difficulty: "EASY", score: 15,
    statement: "Read a temperature in Celsius and print it in Fahrenheit, rounded to 2 decimal places. F = C × 9/5 + 32.",
    inputFormat: "One real number `c`.", outputFormat: "F with exactly 2 decimal places.",
    constraints: "-100 ≤ c ≤ 1000.",
    hints: ["Use double.", "Beware of integer division: write 9.0 / 5.0.", "Print with %.2f."],
    starterCode: stub("    double c;\n    // Read c, print Fahrenheit with 2 decimals"),
    explanation: "f = c * 9.0 / 5.0 + 32; printf(\"%.2f\\n\", f);",
    inputs: ["0\n", "100\n", "-40\n", "36.6\n", "25\n", "-17.5\n"], samples: 2,
    solve: (i) => `${f2(Number(i.trim()) * 9 / 5 + 32)}\n`,
  },
  {
    slug: "calculate-average", title: "Calculate Average", chapter: 1, difficulty: "EASY", score: 15,
    statement: "Read three integers and print their average with 2 decimal places.",
    inputFormat: "Three integers separated by spaces.", outputFormat: "The average with exactly 2 decimals.",
    constraints: "0 ≤ each number ≤ 1000.",
    hints: ["(a + b + c) / 3 is integer division if all are int.", "Divide by 3.0."],
    starterCode: stub("    int a, b, c;\n    // Read the numbers and print the average"),
    explanation: "Cast or divide by 3.0 to get a floating-point result.",
    inputs: ["1 2 3\n", "10 20 25\n", "0 0 0\n", "1000 1000 999\n", "7 8 8\n"], samples: 2,
    solve: (i) => { const [a, b, c] = nums(i); return `${f2((a + b + c) / 3)}\n`; },
  },
  {
    slug: "circle-area", title: "Calculate Circle Area", chapter: 1, difficulty: "EASY", score: 15,
    statement: "Read the radius of a circle and print its area with 2 decimals. Use π = 3.14159.",
    inputFormat: "One real number `r`.", outputFormat: "Area = π r² with exactly 2 decimals.",
    constraints: "0 ≤ r ≤ 1000.",
    hints: ["Define `const double PI = 3.14159;`.", "Area = PI * r * r."],
    starterCode: stub("    const double PI = 3.14159;\n    double r;\n    // Read r, print the area"),
    explanation: "area = PI * r * r, printed with %.2f.",
    inputs: ["1\n", "2.5\n", "0\n", "10\n", "123.4\n"], samples: 2,
    solve: (i) => { const r = Number(i.trim()); return `${f2(3.14159 * r * r)}\n`; },
  },
  {
    slug: "swap-two-numbers", title: "Swap Two Numbers", chapter: 1, difficulty: "EASY", score: 15,
    statement: "Read two integers `a` and `b`. Swap their values using a temporary variable, then print `a` and `b` separated by a space.",
    inputFormat: "Two integers.", outputFormat: "The swapped values on one line.",
    constraints: "-10^9 ≤ a, b ≤ 10^9.",
    hints: ["int tmp = a; a = b; b = tmp;"],
    starterCode: stub("    int a, b;\n    // Read, swap, print"),
    explanation: "Use a temporary variable to hold one value during the swap.",
    inputs: ["1 2\n", "-5 9\n", "7 7\n", "1000000000 -1000000000\n"], samples: 2,
    solve: (i) => { const [a, b] = nums(i); return `${b} ${a}\n`; },
  },
  {
    slug: "simple-interest", title: "Calculate Simple Interest", chapter: 1, difficulty: "MEDIUM", score: 20,
    statement: "Given principal P, annual rate R (in percent) and time T (in years), print the simple interest `P × R × T / 100` with 2 decimals.",
    inputFormat: "Three real numbers: `P R T`.", outputFormat: "The interest with exactly 2 decimals.",
    constraints: "0 ≤ P ≤ 10^6, 0 ≤ R ≤ 100, 0 ≤ T ≤ 50.",
    hints: ["Use double for all values.", "Print with %.2f."],
    starterCode: stub("    double p, r, t;\n    // Read the values, print the interest"),
    explanation: "interest = p * r * t / 100.0",
    inputs: ["1000 5 2\n", "2500 4.5 3\n", "0 10 10\n", "100000 7.25 4\n", "999 1 1\n"], samples: 2,
    solve: (i) => { const [p, r, t] = nums(i); return `${f2(p * r * t / 100)}\n`; },
  },
  {
    slug: "even-or-odd", title: "Even or Odd", chapter: 2, difficulty: "EASY", score: 10,
    statement: "Read an integer and print `Even` if it is even, otherwise `Odd`.",
    inputFormat: "One integer `n`.", outputFormat: "`Even` or `Odd`.",
    constraints: "-10^9 ≤ n ≤ 10^9.",
    hints: ["Use the remainder operator %.", "In C, -3 % 2 is -1, so compare with 0, not 1."],
    starterCode: stub("    int n;\n    // Read n and print Even or Odd"),
    explanation: "n % 2 == 0 means even; negatives give -1 for odd, so test equality with 0.",
    inputs: ["4\n", "7\n", "0\n", "-3\n", "-8\n", "1000000000\n"], samples: 2,
    solve: (i) => (Number(i.trim()) % 2 === 0 ? "Even\n" : "Odd\n"),
  },
  {
    slug: "positive-negative-zero", title: "Positive, Negative or Zero", chapter: 2, difficulty: "EASY", score: 10,
    statement: "Read an integer and print `Positive`, `Negative` or `Zero`.",
    inputFormat: "One integer `n`.", outputFormat: "One of `Positive`, `Negative`, `Zero`.",
    constraints: "-10^9 ≤ n ≤ 10^9.", hints: ["Use if / else if / else."],
    starterCode: stub("    int n;\n    // Read n and classify it"),
    explanation: "Compare n with 0 using if / else if / else.",
    inputs: ["5\n", "-2\n", "0\n", "1000000000\n", "-1000000000\n"], samples: 2,
    solve: (i) => { const n = Number(i.trim()); return n > 0 ? "Positive\n" : n < 0 ? "Negative\n" : "Zero\n"; },
  },
  {
    slug: "max-of-two", title: "Find Maximum of Two Numbers", chapter: 2, difficulty: "EASY", score: 10,
    statement: "Read two integers and print the larger one.",
    inputFormat: "Two integers.", outputFormat: "The larger integer.",
    constraints: "-10^9 ≤ a, b ≤ 10^9.", hints: ["If they are equal, either one is the answer."],
    starterCode: stub("    int a, b;\n    // Read a and b, print the maximum"),
    explanation: "if (a > b) print a else print b.",
    inputs: ["3 9\n", "9 3\n", "5 5\n", "-4 -9\n", "-1000000000 1000000000\n"], samples: 2,
    solve: (i) => { const [a, b] = nums(i); return `${Math.max(a, b)}\n`; },
  },
  {
    slug: "max-of-three", title: "Find Maximum of Three Numbers", chapter: 2, difficulty: "EASY", score: 15,
    statement: "Read three integers and print the largest.",
    inputFormat: "Three integers.", outputFormat: "The largest integer.",
    constraints: "-10^9 ≤ each number ≤ 10^9.",
    hints: ["Keep a variable `max` and update it as you compare."],
    starterCode: stub("    int a, b, c;\n    // Read the numbers and print the maximum"),
    explanation: "Start with max = a, then update with b and c.",
    inputs: ["1 2 3\n", "9 2 3\n", "4 8 1\n", "-5 -2 -9\n", "7 7 7\n", "0 -1 0\n"], samples: 2,
    solve: (i) => `${Math.max(...nums(i))}\n`,
  },
  {
    slug: "grade-calculator", title: "Grade Calculator", chapter: 2, difficulty: "MEDIUM", score: 20,
    statement: "Read a score and print the grade: 80–100 → `A`, 70–79 → `B`, 60–69 → `C`, 50–59 → `D`, below 50 → `F`.",
    inputFormat: "One integer `score`.", outputFormat: "A single letter: A, B, C, D or F.",
    constraints: "0 ≤ score ≤ 100.",
    hints: ["Test from the highest range down with else-if.", "Check boundaries: 80, 70, 60, 50."],
    starterCode: stub("    int score;\n    // Read the score and print the grade"),
    explanation: "A chain of if / else if tests each lower bound.",
    inputs: ["85\n", "72\n", "100\n", "80\n", "79\n", "70\n", "69\n", "60\n", "59\n", "50\n", "49\n", "0\n"], samples: 2,
    solve: (i) => { const s = Number(i.trim()); return (s >= 80 ? "A" : s >= 70 ? "B" : s >= 60 ? "C" : s >= 50 ? "D" : "F") + "\n"; },
  },
  {
    slug: "print-1-to-n", title: "Print Numbers from 1 to N", chapter: 3, difficulty: "EASY", score: 10,
    statement: "Read `N` and print the integers 1 to N on one line, separated by single spaces.",
    inputFormat: "One integer `N`.", outputFormat: "N integers separated by spaces, then a newline (no trailing space).",
    constraints: "1 ≤ N ≤ 100.",
    hints: ["Use a for loop.", "Print a space before every number except the first."],
    starterCode: stub("    int n;\n    // Read n and print 1..n"),
    explanation: "for (i = 1; i <= n; i++) with separator handling.",
    inputs: ["5\n", "1\n", "10\n", "100\n", "37\n"], samples: 2,
    solve: (i) => { const n = Number(i.trim()); return Array.from({ length: n }, (_, k) => k + 1).join(" ") + "\n"; },
  },
  {
    slug: "sum-1-to-n", title: "Sum of Numbers from 1 to N", chapter: 3, difficulty: "EASY", score: 10,
    statement: "Read `N` and print 1 + 2 + … + N.",
    inputFormat: "One integer `N`.", outputFormat: "The sum.",
    constraints: "1 ≤ N ≤ 10^6.",
    hints: ["Accumulate in a long long.", "Or use N(N+1)/2."],
    starterCode: stub("    int n;\n    long long sum = 0;\n    // Read n, compute the sum"),
    explanation: "Loop and add, or use the closed form N*(N+1)/2.",
    inputs: ["5\n", "1\n", "100\n", "1000000\n", "999999\n"], samples: 2,
    solve: (i) => { const n = BigInt(i.trim()); return `${(n * (n + 1n)) / 2n}\n`; },
  },
  {
    slug: "multiplication-table", title: "Multiplication Table", chapter: 3, difficulty: "EASY", score: 15,
    statement: "Read `N` and print its multiplication table from 1 to 12, one line per row in the form `N x i = result`.",
    inputFormat: "One integer `N`.", outputFormat: "12 lines such as `3 x 1 = 3`.",
    constraints: "1 ≤ N ≤ 1000.",
    hints: ["Loop i from 1 to 12.", "Format: printf(\"%d x %d = %d\\n\", n, i, n * i);"],
    starterCode: stub("    int n;\n    // Read n and print the table"),
    explanation: "A for loop from 1 to 12 printing each product.",
    inputs: ["3\n", "12\n", "1\n", "1000\n", "7\n"], samples: 2,
    solve: (i) => { const n = Number(i.trim()); return Array.from({ length: 12 }, (_, k) => `${n} x ${k + 1} = ${n * (k + 1)}`).join("\n") + "\n"; },
  },
  {
    slug: "factorial", title: "Factorial", chapter: 3, difficulty: "MEDIUM", score: 20,
    statement: "Read `N` and print N! (N factorial). 0! = 1.",
    inputFormat: "One integer `N`.", outputFormat: "N!",
    constraints: "0 ≤ N ≤ 20 (20! fits in unsigned long long and long long).",
    hints: ["Use unsigned long long.", "Start the product at 1, not 0."],
    starterCode: stub("    int n;\n    unsigned long long result = 1;\n    // Read n and compute n!"),
    explanation: "Multiply result by every integer from 2 to N.",
    inputs: ["5\n", "0\n", "1\n", "10\n", "20\n", "13\n"], samples: 2,
    solve: (i) => { let r = 1n; for (let k = 2n; k <= BigInt(i.trim()); k++) r *= k; return `${r}\n`; },
  },
  {
    slug: "reverse-a-number", title: "Reverse a Number", chapter: 3, difficulty: "MEDIUM", score: 25,
    statement: "Read a non-negative integer and print its digits in reverse order. Trailing zeros of the input become leading zeros in the output and are dropped (e.g. 1200 → 21). 0 stays 0.",
    inputFormat: "One integer `n`.", outputFormat: "The reversed number.",
    constraints: "0 ≤ n ≤ 10^9.",
    hints: ["Repeatedly take n % 10 and n / 10.", "Build rev = rev * 10 + digit.", "Use long long for rev."],
    starterCode: stub("    long long n, rev = 0;\n    // Read n and reverse its digits"),
    explanation: "Peel digits off with % 10 and append them to rev.",
    inputs: ["123\n", "1200\n", "0\n", "7\n", "1000000000\n", "987654321\n"], samples: 2,
    solve: (i) => `${Number(i.trim().split("").reverse().join(""))}\n`,
  },
];
