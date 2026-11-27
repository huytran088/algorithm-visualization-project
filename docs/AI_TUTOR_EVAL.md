# AI Tutor evaluation

How well does the AI Tutor write AVP programs that run, are correct, and
visualize truthfully? This page has the method, the numbers (with their
uncertainty), what they say, and what they can't say. Issue #12.

## Summary

- **Production model (Qwen3-Coder-30B-A3B via the HF router):** 76% pass@1 on
  the tuning split and 84–87% on the held-out split. "Pass" means correct on
  about 25 generated inputs, not only the program's own example. Only 52–68%
  of samples are also truthful visualizations whose loop cursors are marked.
- **The largest failure cause was an interpreter bug, not the model.**
  Directives written before an `if` (`@mark<j, outline, yellow> if (...)`)
  were silently dropped. The tutor's own example and six bundled pages use
  that form. This is now fixed (`TraceInterpreterVisitor.visitIfStatement`).
- **The second-largest cause is defective knowledge-base examples, which the
  model copies.** In 15 of 21 wrong results, the defective example had been
  retrieved. This is not fixed yet: see Next steps.
- **The language rules sent with each request (`TutorInstructions`) matter
  most:** without them pass@1 drops from 76% to 3%. RAG mainly improves the
  visualization (truthful pass@1 37% → 68%), not correctness.
- **Gemini Flash-Lite scored higher than Qwen** (87–89% pass@1), with
  overlapping intervals, at about a third of the latency.
- **Grammar-constrained decoding** more than doubles pass@1 on a 7B model
  (18% → 44%). The production model is already 94% syntactically valid, so
  the experiment says the method works, not that production needs it.

## Method

Everything is in `evals/` (app) and `evals/` (avp_rag_system).

**The spec.** The app's grammar and trace interpreter
(`app/hooks/interpreter/`) are what decide whether a program works, not
`docs/PSEUDOCODE.md` or the prompt text.

**The tasks** (`evals/tasks.ts`). There are 42 requests:

- 17 sorts;
- 7 searches;
- 3 partitions;
- 6 in-place transforms and two-pointer tasks;
- 9 scalar results.

Each task has:

- a TypeScript reference that follows Levitin, *Introduction to the Design
  and Analysis of Algorithms* (3rd ed.), where it has the algorithm, and
  CLRS (3rd ed.) or the standard definition otherwise;
- an oracle;
- the input shape (for example, sorted for binary search);
- for 5 tasks, the exact number of element comparisons.

**The split** (`evals/split.json`): 27 tuning and 15 held-out tasks, seeded
and stratified by category. It was committed before any run. The fix was
chosen from tuning results only.

**Sampling.** `evals/run.ts` runs the tutor's own pipeline: `buildTutorRequest`,
`stripFences`, `autoFixDirectives`, `validateSource`, and one
`buildRepairRequest` repair. `tests/evals/pipeline.node.test.ts` checks that
this makes the same requests and keeps the same code as `generateTutorCode`.

Requests go to an eval-only server (`avp_rag_system/evals/server.py`). It
builds the same prompt as `/api/generate`, but:

- it has no cache (the live API would return the same output for all 5
  samples of a request);
- it has no rate limit;
- it has no provider fallback, so every sample comes from one model;
- it has switches for the ablations.

Each task gets N=5 samples at temperature 0.6. Each sample records the
provider, model, temperature, prompt hash and latency.

**Judging** (`evals/harness/`). Each final program is run in the real
`TraceInterpreterVisitor`, with its input array replaced by about 25 arrays:

- the edge cases: empty, one element, all equal, sorted, reversed;
- fast-check arrays with a fixed seed.

For searches, the program's own target is kept and is put in half of the
arrays. Each sample gets the first bucket that applies:

| Bucket | Meaning |
|---|---|
| `syntax` | doesn't parse |
| `not_substitutable` | the harness can't vary the input (for example, bounds hardcoded as `Quick_Sort(a1, 0, 4)`) |
| `runtime` | an exception, or an error the interpreter logs |
| `statement_limit` | over 200,000 statements |
| `wrong_result` | the oracle fails on some input |
| `invariant_shown_is_true` | after some statement, replaying the table's actions doesn't give the real array |
| `invariant_marks_in_bounds` | a mark is not on a cell, or just beside the table (−1 or the length) |
| `invariant_cursor_unmarked` | a loop cursor that indexes an array is never marked |
| `pass` | none of the above |

- **pass@1 / pass@5:** samples that are correct (no bucket before the
  invariants), using the unbiased estimator.
- **Truthful pass@1:** samples that pass every check.
- **Intervals:** 95% percentile bootstrap over tasks.

**Checking the checker** (`tests/evals/harness.node.test.ts`):

- every reference passes its own oracle;
- the knowledge-base Bubble, Insertion, Selection and Linear Search programs
  pass;
- broken variants fail: an off-by-one, a missing swap, a drawn but undone
  swap, a mark off the table, an unmarked cursor.

**CI** (`tests/evals/cached.node.test.ts`) replays one saved program per task
with no model call. It fails when an interpreter, validator, autofix or
harness change flips a verdict: reverting the if-directive fix flips two.

## Results

### Production model

Qwen/Qwen3-Coder-30B-A3B-Instruct:cheapest, temperature 0.6, N=5 per task.

| Run | Valid, first try | Valid, final | pass@1 | pass@5 | Truthful pass@1 | Repair rate | p50 latency |
|---|---|---|---|---|---|---|---|
| Tuning (27 tasks), fixed interpreter | 94% | 96% | 76% [60, 90] | 81% | 68% [51, 84] | 6% | 10.1 s |
| Held-out (15), before the fix | 93% | 97% | 84% [64, 99] | 87% | 52% [29, 75] | 7% | 6.7 s |
| Held-out, same programs, fixed interpreter | 93% | 97% | 84% [64, 99] | 87% | 59% [37, 80] | 7% | 6.7 s |
| Held-out, fresh samples, fixed interpreter | 95% | 96% | 87% [67, 100] | 87% | 63% [39, 84] | 5% | 9.4 s |

Gemini (`gemini-flash-lite-latest`, same prompt, after the fix):

| Split | Valid, first try | pass@1 | pass@5 | Truthful pass@1 | p50 latency |
|---|---|---|---|---|---|
| Tuning | 98% | 87% [78, 96] | 100% | 70% [56, 84] | 3.6 s |
| Held-out | 96% | 89% [75, 99] | 93% | 67% [47, 84] | 3.3 s |

The intervals overlap with Qwen's, so "Gemini is better" is likely, not
shown. Its first run failed with HTTP 402 ("prepayment credits are
depleted"). That also meant the Space's Gemini fallback was not working until
the credits were added.

### Failure taxonomy

Tuning split, baseline, before the fix (135 samples):

| Bucket | Samples | Cause |
|---|---|---|
| invariant_cursor_unmarked | 28 | 24: the cursor was marked only on an `if` line, which the interpreter dropped |
| wrong_result | 21 | 5: `comparison_counting_sort` copies the KB example's in-place write `array[count[i]] = array[i]`, which loses values. 10: `unique_elements` and `is_palindrome` return 1/0 like the KB `check_unique`, though the request says true/false. 5: `even_odd_partition` uses `x % 2 == 1`, which is false for negative odd numbers. 1: `reverse_array` |
| syntax | 6 | 5: `odd_even_sort` uses `not`, which AVP doesn't have, and the one repair didn't remove it. 1: `cocktail_sort` |
| runtime | 4 | `majority_element` logs an error on an empty array |
| not_substitutable | 2 | binary search with `size` hardcoded |
| invariant_marks_in_bounds | 1 | |

Every failing `comparison_counting_sort`, `unique_elements` and
`is_palindrome` sample had retrieved the defective example.

On held-out, most remaining mark failures mark a value as if it were an index
(`@mark<total>` in `sum_array`, `@mark<value>` in counting sort). These are
real model mistakes.

### The fix and its held-out effect

The largest bucket by tuning count was `invariant_cursor_unmarked`, and the
fix is in the interpreter (commit `fix: draw directives written before an if
statement`).

On the held-out programs, judged before and after the fix, 6 samples changed
from fail to pass and 1 from pass to fail. Marks that are now drawn showed one
mark outside the table. The exact McNemar test gives a two-sided p ≈ 0.13.
That is the right direction, but not significant at this N. The tuning split
(24 vs. 5) chose the fix, so it isn't evidence for it. Correctness doesn't
change (marks don't change results), as expected.

A fresh held-out run after the fix gives 63% truthful pass@1 [39, 84]. That
is consistent with the paired result, with the usual sampling noise.

### Ablations

Tuning split, fixed interpreter, N=5:

| Config | Valid, first try | pass@1 | pass@5 | Truthful pass@1 | Repair rate |
|---|---|---|---|---|---|
| baseline | 94% | 76% | 81% | 68% | 6% |
| no RAG (no reference code) | 76% | 70% | 85% | 37% | 24% |
| no instructions (`TutorInstructions` omitted) | 1% | 3% | 7% | 3% | 99% |
| no autofix | 88% | 75% | 81% | 67% | 12% |
| no repair | 93% | 75% | 81% | 68% | 0% |

- **The instructions are what make the output AVP at all.**
- **RAG mostly helps the visualization:** retrieved examples show `@init`,
  marks and in-place swaps. It also adds the defective examples above.
- **Autofix and the one repair attempt each add a few points of validity**
  and about 1 point of pass@1. That is within the noise at N=5.

### Retrieval

Retrieval was run on the same 42 requests, each labeled by hand with the
`data/*.avp` functions it should find (`avp_rag_system/evals/`). 9 requests
have no matching example in the knowledge base: merge sort, heap sort,
counting sort, Dutch flag, move zeros, reverse, rotate, two-sum and majority.
They are reported as coverage gaps, not misses.

| | recall@1 | recall@2 (what the API uses) | recall@5 | MRR |
|---|---|---|---|---|
| With reranker (production) | 0.65 | 0.73 | 0.88 | 0.74 |
| Without reranker | 0.71 | 0.85 | 1.00 | 0.83 |

On these labels the reranker makes retrieval worse. I wrote the labels, and
some are loose (for example, `prefix_sums` → `sum_array`), so treat this as a
reason to look further, not a verdict.

### Constrained decoding (a 7B model, not production)

The production model can't run on the available GPU (12 GB). The experiment
used Qwen2.5-Coder-7B-Instruct-AWQ in local vLLM 0.34.0. The grammar is
`avp_rag_system/evals/avp.gbnf`, a translation of `Pseudocode.g4` that accepts
every `data/*.avp` file; vLLM's `structured_outputs` applies it. Tuning split,
N=5:

| Config | Valid, first try | Valid, final | pass@1 | pass@5 | Truthful pass@1 | p50 latency |
|---|---|---|---|---|---|---|
| unconstrained + autofix + repair | 29% | 30% | 18% [10, 27] | 48% | 14% | 50 s |
| grammar + autofix + repair | 67% | 73% | 44% [31, 58] | 74% | 34% | 50 s |
| grammar only | 65% | 65% | 44% [30, 58] | 74% | 34% | 37 s |

- **Constraining more than doubles pass@1 and makes autofix and repair
  unnecessary** (same pass@1 without them).
- **The remaining syntax errors with the grammar have two causes:**
  - The GBNF lets keywords be identifiers (13 samples): `end = n - 1`, or
    `arr[50]` read as an array access.
  - Programs end before they are complete (17 samples): the grammar allows
    ending after any statement.

  Both can be tightened.
- **The grammar also exposed a failure mode:** asked casually, the model
  forced its prose ("Surely, here is...") into syntactically valid AVP
  expressions. The real prompt avoided this.
- **I didn't check** whether the HF router's providers accept a grammar.

## Weaknesses, plainly

- **N is small.** 5 samples per task and 15 held-out tasks give intervals 30–40
  points wide. Differences under about 10 points (autofix, repair, Gemini vs.
  Qwen) aren't established.
- **I wrote the tasks, references, oracles and labels.** The references follow
  the standard definitions; I didn't check them against the printed pages.
  The request wording sets the contracts (for example, "return -1",
  "true or false"), and a stricter or looser wording would move the numbers.
- **The inputs include negative numbers** (−9..20 for most tasks). That is
  what fails `even_odd_partition`. Real users may rarely use negatives.
- **I loosened one check after seeing the data.** At first a mark had to be
  on a cell. The first tuning run showed all 32 failures of that check were
  pointers just outside the table (Lomuto's `i = low - 1`, a scan ending at
  `n`), which are textbook-correct. The check now allows −1 and the length.
  Under the original check, tuning truthful pass@1 was 44%.
- **The cursor check is static.** It finds loop variables used as plain
  subscripts and looks for an `@mark` on them, so it can miss cursors (`j - 1`)
  or credit a mark that rarely runs. The comparison counts are recorded but
  not used to judge, because a program that compares through a temporary
  (`key < x`) isn't counted.
- **Input substitution excludes some programs:** 2–8% of samples, bucketed
  separately.
- **Temperature 0.6 is the production setting.** Other temperatures weren't
  tried.

## What execution can't verify

All of the above checks that the program is correct and that the table tells
the truth. None of it checks whether a student **learns** from the page. That
needs people. Here is a protocol for 3–5 students:

1. **Participants:** students who have taken (or are taking) an intro
   algorithms course, but haven't studied the algorithms used.
2. **Material:** two algorithms each, one sort and one search, for example
   Lomuto Quick Sort and binary search. For each, a page from the AI Tutor and
   a hand-written page from `public/code`, in counterbalanced order.
3. **Session (about 30 minutes, recorded with consent):**
   1. The student steps through each page thinking aloud. Prompt: "What is
      the algorithm doing right now?"
   2. At 5 preset steps, pause and ask: "What will the next step change in
      the table?"
   3. Afterwards: "Explain the algorithm in your own words," and "What on the
      page confused you?"
4. **Scoring:**
   - the share of correct next-step predictions, per page;
   - whether the explanation names the invariant (for example, "everything
     left of i is ≤ the pivot");
   - a list of confusion points, each tagged with the directive or line that
     caused it.
5. **What it would tell us:** whether the tutor's pages teach as well as
   hand-written ones, and which visual choices (outlines vs. highlights,
   which pointers are marked) matter. Five students won't give significance,
   but they will show the largest problems.
6. **Consent:** explain the purpose, that it's voluntary, and that recordings
   are kept only for scoring and deleted afterwards. Name no one in the
   results.

## Next steps (not done)

1. **Fix the knowledge-base examples** in avp_rag_system `data/`. Make
   `comparison_counting_sort.avp` write to a separate array, make
   `check_unique.avp` return true/false, and use `floor` in
   `binary_search.avp`. Then re-run the eval. This is the next-largest bucket.
2. **Re-check the reranker** against an independent label set. If it still
   hurts, consider turning it off or reranking more candidates.
3. **Re-run with a larger N** (for example, 15) before acting on differences
   under 10 points.
4. **Tighten the GBNF** (exclude keywords from identifiers, require the
   top-level call at the end) if constrained decoding is pursued.

## Reproduce

```bash
# avp_rag_system: the eval server (HF_TOKEN in .env)
LLM_PROVIDER=hf uv run uvicorn evals.server:app --port 8799
uv run python -m evals.retrieval_eval --out evals/retrieval_results.json
uv run --group eval pytest tests/test_gbnf.py

# app
npx vite-node evals/run.ts -- --config baseline --split tune --n 5
npx vite-node evals/report.ts -- evals/results/baseline-tune-rejudged-fix.jsonl --tasks
npx vite-node evals/rejudge.ts -- <results.jsonl>   # re-judge saved samples, no model calls
```

Results files in `evals/results/`:

- `baseline-{tune,heldout}.jsonl`: the interpreter before the fix.
- `*-rejudged-fix.jsonl`: the same samples judged with the fixed interpreter.
- The other files were sampled after the fix.
