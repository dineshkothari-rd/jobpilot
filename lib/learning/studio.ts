export type StudioLesson = {
  outcome: string;
  explanation: string[];
  example: string;
  walkthrough: string;
  mistake: string;
  reflection: string;
  answer: string;
};

// Original JobPilot mini-lessons. Publisher references are linked, never reproduced.
const content: Record<string, StudioLesson> = {
  "web-foundations/html": {
    outcome: "Choose semantic elements and connect a visible label to an input.",
    explanation: ["HTML describes the meaning of content. A heading introduces a topic, a list groups related items and a button performs an action. Choosing the right element gives browsers and assistive technology useful information before any CSS is applied.", "Start your fictional job page with one main topic. Use links for navigation and buttons for actions. A form input needs a visible label; a placeholder disappears while typing and is not a substitute for that label."],
    example: '<main>\n  <h1>Frontend opportunity</h1>\n  <ul><li>Remote collaboration</li></ul>\n  <label for="question">Your question</label>\n  <input id="question" name="question">\n  <button type="button">Save draft</button>\n</main>',
    walkthrough: "The label's for value matches the input id. The button is already keyboard-operable. Its type prevents an accidental form submission when used inside a form.",
    mistake: "Replacing a button with a clickable div creates extra keyboard and accessibility work.", reflection: "Should a control that opens a job-detail URL be a link or a button?", answer: "A link: it navigates to a destination. Use a button for an action such as saving a draft.",
  },
  "web-foundations/html-video": {
    outcome: "Turn a visual job card into meaningful HTML without copying a tutorial project.",
    explanation: ["Treat a video as one explanation route, not a requirement to imitate its output. Identify the content in your own design: a title, employer, location and destination. Then choose elements based on their meaning.", "Use the in-app reading route if video playback is unavailable. Build the same exercise either way. Test the result before adding styling: the heading and link should still make sense as plain text."],
    example: '<article>\n  <h2>Interface developer</h2>\n  <p>Example Studio · Jaipur</p>\n  <a href="/opportunities/interface">Read opportunity</a>\n</article>', walkthrough: "The article is a self-contained card. The heading names the opportunity, and the link communicates its destination without relying on colour.", mistake: "A whole card with nested clickable controls can create confusing interaction targets.", reflection: "What should still work if your CSS does not load?", answer: "The content order, headings, labels and navigation should remain understandable and usable.",
  },
  "web-foundations/layout": {
    outcome: "Build a flexible layout that does not overflow a narrow screen.",
    explanation: ["Responsive design is about available space, not a list of device brands. Begin with one column. Add columns when the content has enough room, and let text wrap instead of forcing a fixed width.", "Grid and flex children may need min-width: 0 to shrink below their content width. Long URLs and code are common overflow sources. Give code its own scrolling container rather than making the entire page scroll sideways."],
    example: '.cards { display: grid; gap: 1rem; }\n.card { min-width: 0; overflow-wrap: anywhere; }\n@media (min-width: 48rem) {\n  .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n}', walkthrough: "The default layout works without a media query. At wider sizes two equal columns appear; minmax(0, 1fr) allows each column to shrink.", mistake: "A fixed 900px child can overflow even when its parent is responsive.", reflection: "What should you check besides a 390px screenshot?", answer: "Try longer content, keyboard focus, increased text size and browser zoom. A screenshot alone does not prove usability.",
  },
  "web-foundations/accessibility": {
    outcome: "Make a form usable with a keyboard and understandable error feedback.",
    explanation: ["Accessibility is part of the interaction design. A user should find controls in a sensible tab order, see where focus is, understand each field and recover from errors without guessing.", "Describe an error next to its field and connect that message using aria-describedby. Do not communicate failure through colour alone. Only set aria-invalid when a field is actually invalid."],
    example: '<label for="email">Email</label>\n<input id="email" type="email" aria-invalid="true"\n  aria-describedby="email-error">\n<p id="email-error">Enter a valid email address.</p>', walkthrough: "This example represents an already invalid field. In a real form, update the state after validation and preserve what the user typed.", mistake: "Removing outlines without providing an equally visible focus style hides keyboard position.", reflection: "How do you check a save action without using a mouse?", answer: "Tab to it, verify visible focus, activate it with the keyboard and check that success or failure is communicated.",
  },
  "javascript-typescript/javascript": {
    outcome: "Filter fictional data without modifying the source array.",
    explanation: ["A small function should make its inputs and output obvious. Filtering returns a new array containing items that match a condition, while the original collection stays available for another view.", "Normalize the search input once and decide what an empty search means. Test an empty list and a search with no matches. These are normal product states, not exceptional failures."],
    example: 'function filterJobs(jobs, location) {\n  const query = location.trim().toLowerCase();\n  return jobs.filter(job =>\n    job.location.toLowerCase().includes(query));\n}\nfilterJobs([], "Jaipur"); // []', walkthrough: "This function assumes job.location has already been validated as a string. An empty query matches every location; that is an explicit design choice.", mistake: "Assuming API fields are always present moves input validation problems into rendering.", reflection: "Does filter change the original array?", answer: "No. It returns a new array, although the objects inside it still refer to the original objects.",
  },
  "javascript-typescript/javascript-video": {
    outcome: "Translate a JavaScript concept into your own search interaction.",
    explanation: ["Use functions to separate the data operation from the interface. A search function should not need a DOM node; it can take an array and query and return an answer you can test.", "The video is an optional supplement. For the exercise, invent your own fictional data and write down the behaviour before coding: trim spaces, ignore case and preserve the original list."],
    example: 'const jobs = [{ title: "React developer" }, { title: "SQL analyst" }];\nconst query = " react ".trim().toLowerCase();\nconst matches = jobs.filter(job =>\n  job.title.toLowerCase().includes(query));\nconsole.log(matches.length); // 1', walkthrough: "Normalization makes spaces and capitalization less surprising. The same matching function can support a web screen or a local test.", mistake: "Copying a tutorial's finished interface without understanding its data flow makes changes difficult.", reflection: "Name two useful cases for this function's test.", answer: "An empty query and a query with no matches. Also check mixed-case text and that the original list is unchanged.",
  },
  "javascript-typescript/promises": {
    outcome: "Represent loading, success and failure as different outcomes.",
    explanation: ["A promise represents work whose result arrives later. Await makes the sequence readable, but the operation can still fail. A useful interface explains whether it is waiting, finished or needs a retry.", "Fetch rejects for some network failures but not simply because a server returned an error status. Check response.ok before parsing data. Validate the parsed value before treating it as application data."],
    example: 'async function loadJobs() {\n  const response = await fetch("/sample-jobs.json");\n  if (!response.ok) throw new Error("Could not load jobs");\n  const data = await response.json();\n  if (!Array.isArray(data)) throw new Error("Invalid list");\n  return data;\n}', walkthrough: "The array check is only the first validation step; each row still needs field validation. Callers should catch failures and offer a retry rather than leave a permanent spinner.", mistake: "Clearing an existing draft when a request fails causes avoidable data loss.", reflection: "Is a 404 response guaranteed to reject fetch?", answer: "No. Fetch can resolve with a non-success HTTP status; inspect response.ok or response.status.",
  },
  "javascript-typescript/types": {
    outcome: "Narrow unknown input before reading its fields.",
    explanation: ["TypeScript helps check the code you write, but it does not make a remote payload trustworthy at runtime. Treat incoming data as unknown until checks establish the fields you need.", "Narrowing refines the type through a condition. Prefer a real property check over an assertion that merely tells the compiler to trust you. Keep that validation at the input boundary."],
    example: 'function readTitle(value: unknown): string | null {\n  if (typeof value !== "object" || value === null) return null;\n  if (!("title" in value) || typeof value.title !== "string") return null;\n  return value.title.trim() || null;\n}', walkthrough: "The null check matters because typeof null is object. The property and string checks establish what can safely be read.", mistake: "Casting JSON with as Job does not validate it.", reflection: "What runtime guarantee does a TypeScript assertion provide?", answer: "None. It changes the compiler's interpretation, not the value received at runtime.",
  },
  "react-workflows/react": {
    outcome: "Give a component a small, explicit input contract.",
    explanation: ["A React component describes the interface for its current inputs. Begin with a small boundary such as a lesson card; pass only the information and actions it actually needs.", "Keep stable identifiers in list keys. When data changes order, a title or array index may not describe the identity of the item. An explicit id helps React preserve the correct component state."],
    example: 'function LessonCard({ title, onOpen }) {\n  return <article>\n    <h2>{title}</h2>\n    <button type="button" onClick={onOpen}>Continue</button>\n  </article>;\n}', walkthrough: "The parent owns navigation or selection. The card receives an action rather than independently inventing another source of selected-lesson state.", mistake: "Defining component functions inside another component can reset their identity on every render.", reflection: "Should this card fetch the whole profile to display a title?", answer: "No. Pass the title and required action; fetch shared data at an appropriate existing boundary.",
  },
  "react-workflows/state": {
    outcome: "Store the selection once and derive its displayed information.",
    explanation: ["State should represent information that changes independently. If a selected title can be found from the selected id and the lesson list, storing both creates two values that can disagree.", "Use state updates that preserve the previous value when the next result depends on it. Do not mutate an existing array or object and expect React to infer a reliable change."],
    example: 'const [selectedId, setSelectedId] = useState(lessons[0].id);\nconst selected = lessons.find(lesson => lesson.id === selectedId);\nconst [bookmarks, setBookmarks] = useState([]);\nfunction bookmark(id) {\n  setBookmarks(current => current.includes(id) ? current : [...current, id]);\n}', walkthrough: "The title comes from selected, so a title edit in the lesson list appears without synchronizing duplicate state. Bookmark updates use the latest state.", mistake: "Using an effect to keep two derived state values synchronized adds unnecessary failure paths.", reflection: "What should you store: selectedId or selectedTitle plus selectedId?", answer: "Usually just selectedId; derive the title from the current lesson data.",
  },
  "react-workflows/effects": {
    outcome: "Clean up an external synchronization when its component goes away.",
    explanation: ["Effects connect a component to something outside rendering, such as a network request or event subscription. Calculating a filtered list is not an external synchronization and can happen during rendering.", "When a request becomes irrelevant, cleanup should cancel or ignore its result. Otherwise an older response can update a screen that has moved to another selection."],
    example: 'useEffect(() => {\n  const controller = new AbortController();\n  fetch("/sample.json", { signal: controller.signal })\n    .then(response => {\n      if (!response.ok) throw new Error("Load failed");\n      return response.json();\n    }).then(setData).catch(error => {\n      if (error.name !== "AbortError") setError("Please retry");\n    });\n  return () => controller.abort();\n}, []);', walkthrough: "Cleanup aborts the request. The UI still needs a loading state, payload validation and a retry interaction; this excerpt only demonstrates lifecycle cleanup.", mistake: "Adding an effect for every computed value obscures the real synchronization boundaries.", reflection: "Does filtering an already-loaded array need an effect?", answer: "No. Derive it from the current inputs during rendering.",
  },
  "react-workflows/react-video": {
    outcome: "Apply component and state concepts without adopting outdated tooling.",
    explanation: ["Older tutorials can still explain stable concepts such as props and state, but their installation instructions may no longer be appropriate. Separate the concept from the version-specific setup.", "Build your own tiny application tracker: select an item by id and edit a draft note. Show the saved value separately from pending changes so users understand what survives refresh."],
    example: 'const [draft, setDraft] = useState("");\nconst [saved, setSaved] = useState("");\nconst dirty = draft !== saved;\n// A real app awaits a successful server save before updating saved.\n<button disabled={!dirty} onClick={() => setSaved(draft)}>\n  Save local demo\n</button>', walkthrough: "This local demo is not persistence. In a real app, a failed save must retain the draft and keep the saved value unchanged.", mistake: "Treating a disabled save button or local state as proof that the server stored the changes.", reflection: "When should a real app show Saved?", answer: "After the server confirms the write, not merely after clicking the button.",
  },
  "backend-apis/node": {
    outcome: "Return a small JSON response from a local-only Node server.",
    explanation: ["Node runs JavaScript outside the browser. A server receives requests and returns responses; keep a local learning server separate from production accounts and use fictional data.", "A response has a status, headers and a body. Set the content type so a client knows how to interpret the body, and listen on the loopback interface for a local-only exercise."],
    example: 'import { createServer } from "node:http";\ncreateServer((request, response) => {\n  response.writeHead(200, { "Content-Type": "application/json" });\n  response.end(JSON.stringify([{ id: "intro", title: "First lesson" }]));\n}).listen(3001, "127.0.0.1");', walkthrough: "The example always returns the same catalogue. A real route must check the method, path, authentication and inputs before returning protected data.", mistake: "Binding an experimental server publicly when the exercise only needs local access.", reflection: "Does returning JSON automatically enforce ownership?", answer: "No. Authentication and row ownership are separate checks that must be implemented at the boundary.",
  },
  "backend-apis/http": {
    outcome: "Choose response statuses that explain what happened.",
    explanation: ["HTTP communicates more than a success message. A caller needs to distinguish missing authentication, denied access, malformed input, missing data and a conflict with newer saved data.", "Choose a status and a bounded, understandable error message. Avoid exposing database details or confirming the existence of another user's private record."],
    example: 'Missing authentication: 401\nForbidden operation: 403\nInvalid input: 400\nNot found or not owned: 404\nStale version conflict: 409\nTemporarily unavailable: 503', walkthrough: "An ownership-safe 404 can intentionally avoid disclosing whether a foreign private row exists. A 409 can tell a client to preserve edits and reload the saved version.", mistake: "Returning 200 for failed writes makes clients mistake a failure for saved progress.", reflection: "Which response helps protect an unsaved draft from a stale tab overwrite?", answer: "A version check with a 409 conflict; the client should retain the draft instead of overwriting newer data.",
  },
  "backend-apis/async": {
    outcome: "Run independent asynchronous work together without losing dependency order.",
    explanation: ["Asynchronous I/O lets other work proceed while a request waits. It does not make CPU-heavy JavaScript magically parallel. Long synchronous work can still block the event loop.", "Use concurrency when operations are independent. If one needs another's result, preserve that sequence. Concurrency also needs a bound when processing a large collection."],
    example: 'const [catalogue, preferences] = await Promise.all([\n  loadCatalogue(),\n  loadPreferences()\n]);\n// If profileId is needed, obtain it first:\nconst profileId = await readProfileId();\nconst progress = await loadProgress(profileId);', walkthrough: "The first two operations start together. The progress request starts only after its required id is known. Promise.all rejects if any member rejects.", mistake: "Starting thousands of requests at once can overload your own server or the provider.", reflection: "Can Promise.all speed up two operations when the second needs the first result?", answer: "Not directly. Respect the dependency; only independent branches can start together.",
  },
  "backend-apis/tests": {
    outcome: "Leave a runnable check for a real input-validation branch.",
    explanation: ["A useful test fails when important behaviour breaks. Begin with one happy path and one denial or invalid-input case rather than scaffolding a large suite with no meaningful assertions.", "Node includes a test runner and strict assertions. Use small fictional inputs. A mocked database can test route logic, but it does not prove the actual database access policies."],
    example: 'import test from "node:test";\nimport assert from "node:assert/strict";\nconst validTitle = value => typeof value === "string" && value.trim().length > 0;\ntest("requires a non-empty title", () => {\n  assert.equal(validTitle("Intro"), true);\n  assert.equal(validTitle("  "), false);\n  assert.equal(validTitle(null), false);\n});\n// Run a saved .mjs file with: node --test filename.mjs', walkthrough: "The test covers the successful value, whitespace and a wrong type. Add real role/ownership database checks separately when protecting stored user data.", mistake: "Only asserting that a function returned something does not verify its security decision.", reflection: "Does a mocked owner filter prove production RLS works?", answer: "No. Run the corresponding allow/deny checks against the real database roles and policies.",
  },
  "sql-data/select": {
    outcome: "Select explicit columns and order the result intentionally.",
    explanation: ["A query answers a question about a table. Name the columns you need, filter rows with WHERE and choose an order. Without ORDER BY, do not rely on the database returning rows in a stable sequence.", "A small limit is useful for a preview, but it does not explain what the rows mean. Include a stable tie-breaker when values can be equal."],
    example: "SELECT id, title\nFROM courses\nWHERE subject = 'web'\nORDER BY title, id\nLIMIT 10;", walkthrough: "The query returns at most ten web courses, sorted by title and then id. It is an illustrative query for a fictional schema, not one to run against JobPilot production.", mistake: "SELECT * can expose unnecessary columns and make consumers depend on accidental schema details.", reflection: "Is a table's apparent insertion order a reliable result order?", answer: "No. State the intended order explicitly with ORDER BY.",
  },
  "sql-data/joins": {
    outcome: "Keep learners with no attempts in an enrolment report.",
    explanation: ["A join matches related rows. An inner join keeps matching pairs; a left join also keeps each left-side row that has no match, with null values for the missing right side.", "A condition on the right-hand table placed in WHERE can remove those null rows. Put match requirements in ON when the report must preserve left-side enrolments without matching attempts."],
    example: 'SELECT e.learner_id, COUNT(a.id) AS attempts\nFROM enrolments e\nLEFT JOIN attempts a\n  ON a.learner_id = e.learner_id AND a.course_id = e.course_id\nGROUP BY e.learner_id;', walkthrough: "COUNT(a.id) ignores null, so a learner with no matching attempts can have zero. COUNT(*) would count the preserved join row instead.", mistake: "Joining only by learner id mixes attempts from unrelated courses.", reflection: "Why is COUNT(a.id) useful after a left join?", answer: "It counts real non-null attempt ids rather than the synthetic row representing no match.",
  },
  "sql-data/aggregate": {
    outcome: "Separate row filtering from group filtering.",
    explanation: ["An aggregate summarizes rows, and GROUP BY defines what one output row represents. Decide that meaning first: per learner, per course or per day. Mixing these levels makes counts misleading.", "WHERE filters input rows before grouping. HAVING filters the resulting groups. When joins duplicate rows, check whether you need a different join or a distinct count rather than hiding the problem."],
    example: 'SELECT learner_id, COUNT(*) AS completed\nFROM lesson_progress\nWHERE completed = true\nGROUP BY learner_id\nHAVING COUNT(*) >= 3;', walkthrough: "This assumes one progress row per learner/lesson. Learners with no completed rows are absent; a separate learner table and left join is needed to include them.", mistake: "Presenting only learners with completions as if the report covered every learner.", reflection: "Where should a condition on the final completion count go?", answer: "HAVING, because the aggregate count exists at the group level.",
  },
  "sql-data/sql-video": {
    outcome: "Design a product question before writing its query.",
    explanation: ["Start with the question: which learners need to retry? Define whether that means their latest attempt failed, every attempt failed or their best score is below a threshold. These are different queries.", "This original reading route is an alternative to the external CS50 lecture, not a reproduction of it. Work with fictional data and state the assumptions behind your report."],
    example: 'SELECT learner_id, MAX(score) AS best_score\nFROM attempts\nGROUP BY learner_id\nHAVING MAX(score) < 67;', walkthrough: "The query identifies learners whose best recorded score is below 67. It excludes learners with no attempts and says nothing about the latest attempt.", mistake: "Confusing best score with latest score changes the product decision.", reflection: "Does this query include a learner who never attempted the check?", answer: "No. Start from enrolments and left join attempts if the report must include that learner.",
  },
  "git-quality/git": {
    outcome: "Explain the working tree, staging area and committed snapshot.",
    explanation: ["The working tree contains the files you are editing. The staging area selects changes for the next commit. A commit records a snapshot you can refer to and review later.", "Inspect status and diffs before recording changes. Use a throwaway local repository for learning commands, and never add real secrets or personal documents to it."],
    example: 'git init\ngit status --short\ngit add README.md\ngit diff --cached\ngit commit -m "Describe the sample project"', walkthrough: "Only the named file is staged. The cached diff shows the content about to be committed, not merely every current working-tree change.", mistake: "Staging everything without reviewing it can include unrelated changes or secrets.", reflection: "Does changing a file after staging automatically update its staged content?", answer: "No. Review and stage the new change explicitly before committing it.",
  },
  "git-quality/commits": {
    outcome: "Record focused changes another person can review.",
    explanation: ["A focused commit tells one coherent story. It is easier to review and easier to diagnose than a mixture of a feature, unrelated formatting and personal configuration.", "Review both staged and unstaged diffs. A commit message should explain the intended change, while the diff shows how it was implemented. Run the smallest relevant validation before committing."],
    example: 'git diff\ngit add src/filter.js\ngit diff --cached\ngit commit -m "Handle empty job search results"\ngit status --short', walkthrough: "The final status reveals changes that were not included. Do not discard another person's changes just to produce a clean working tree.", mistake: "A clean status is not proof that the code works; validation is still required.", reflection: "Should an unrelated colour adjustment join a search-validation fix?", answer: "Usually not. Keep the fix focused unless the change is necessary for the same behaviour.",
  },
  "git-quality/branches": {
    outcome: "Resolve a local conflict while preserving both intended changes.",
    explanation: ["A branch gives a name to a line of development. A merge combines histories, but Git cannot always decide how overlapping edits should fit together.", "When a conflict appears, read both intentions. Edit the final content deliberately, remove conflict markers, review the diff and run the relevant check. Practise only in a disposable local repository."],
    example: 'git switch -c practice/labels\n# Make and commit a small change in this sample repository.\ngit switch main\ngit merge practice/labels\n# If needed: edit conflicts, review, test, then stage resolved files.', walkthrough: "A clean merge may finish automatically. A conflicted merge needs a deliberate resolution; do not blindly choose one side for every file.", mistake: "Resetting or overwriting the working tree to escape a conflict can destroy uncommitted work.", reflection: "What is the goal of a conflict resolution?", answer: "A final result that preserves the intended behaviour, not merely removal of Git's conflict markers.",
  },
  "git-quality/quality": {
    outcome: "Create a repeatable keyboard and error-recovery checklist.",
    explanation: ["A quality check should describe an observable behaviour. For a save form, check labels, focus order, keyboard activation, validation messages and whether a failed save preserves the draft.", "A checklist complements tests; it does not replace them. Keep it small enough to run before a meaningful change, and document limitations instead of claiming complete accessibility coverage."],
    example: '1. Reach each control with Tab.\n2. See a clear focus indicator.\n3. Activate the save action with the keyboard.\n4. Read an understandable error message.\n5. Confirm a failed save keeps the draft.\n6. Retry and confirm the saved value after refresh.', walkthrough: "The last step checks persistence, not just a temporary success message. Test long text and a narrow viewport as well.", mistake: "Testing only the successful mouse-click flow misses users who navigate or recover differently.", reflection: "Is an automated accessibility score a complete accessibility audit?", answer: "No. Automated tools catch some issues; keyboard, content and assistive-technology checks remain important.",
  },
  "computer-science/scratch": {
    outcome: "Describe an algorithm through inputs, steps and outputs.",
    explanation: ["An algorithm is a precise sequence for solving a problem. Before choosing a language, write down the input, the desired output and the decisions in between.", "For a fictional shortlist, decide what to do with duplicate opportunities and missing locations. A deterministic rule makes the result explainable and gives you concrete test cases."],
    example: 'Input: a list of fictional opportunities\n1. Keep the first occurrence of each id.\n2. Separate rows with a missing location for review.\n3. Group the remaining rows by location.\nOutput: grouped rows plus the review list', walkthrough: "The first-occurrence rule is a choice, not a universal truth. Document it so another person can predict the output.", mistake: "Saying sort the jobs without defining the sort key leaves the algorithm ambiguous.", reflection: "What should this algorithm return for an empty input?", answer: "Empty groups and an empty review list, without inventing an opportunity or failing unexpectedly.",
  },
  "computer-science/python": {
    outcome: "Group fictional opportunities using a dictionary and a loop.",
    explanation: ["A dictionary maps keys to values. A list holds ordered items. Combine them when each location should map to the opportunities recorded there.", "Begin with already validated fictional inputs. Decide how to represent a missing location rather than silently discarding a row. Keep personal information out of learning examples."],
    example: 'jobs = [{"title": "UI role", "location": "Jaipur"}]\ngroups = {}\nfor job in jobs:\n    location = job.get("location") or "Needs review"\n    groups.setdefault(location, []).append(job)\nprint(groups)', walkthrough: "setdefault creates the list only when the key is absent, then append adds the current job to that group. This example does not deduplicate ids.", mistake: "Using one shared list for all dictionary keys mixes the groups.", reflection: "Does grouping automatically remove duplicate opportunities?", answer: "No. Add an explicit identity rule if deduplication is required.",
  },
  "computer-science/sql": {
    outcome: "Compare a relational query with an in-memory grouping operation.",
    explanation: ["A script can group objects already loaded into memory. A relational query asks the database to select and summarize stored rows. Both need clear assumptions about missing values and duplicates.", "Choose the representation for the product question. A course with many enrolments is a relationship, not a reason to copy the course title into every user record without considering consistency."],
    example: 'SELECT location, COUNT(*) AS opportunities\nFROM fictional_jobs\nGROUP BY location\nORDER BY opportunities DESC, location;', walkthrough: "This query counts rows, not unique employers or unique ids. Null locations form their own group unless you explicitly choose another representation.", mistake: "A count with no definition of what one row represents can sound more precise than it is.", reflection: "What does COUNT(*) measure here?", answer: "The number of rows per location. It is not automatically the number of unique employers or valid opportunities.",
  },
  "computer-science/web": {
    outcome: "Present your organiser with meaningful structure and clear controls.",
    explanation: ["A useful interface makes its data and actions understandable. Present a group heading, a list of opportunities and a clear way to inspect each item. Do not make a count substitute for the content itself.", "The browser renders HTML and CSS; JavaScript can update interactions. Begin with a readable static page and add interaction only where it helps the user's actual task."],
    example: '<section aria-labelledby="jaipur-title">\n  <h2 id="jaipur-title">Jaipur opportunities</h2>\n  <ul><li><a href="/sample/ui">UI role</a></li></ul>\n</section>', walkthrough: "The heading names the section and the link names its destination. The result remains meaningful without a scripted interaction.", mistake: "Adding a framework before defining the content and user action increases work without clarifying the product.", reflection: "What should your organiser explain about uncertain data?", answer: "Show missing or uncertain fields honestly and provide a review route rather than presenting guessed facts as confirmed.",
  },
};

export const studioLesson = (pathId: string, lessonId: string) => content[`${pathId}/${lessonId}`];

const videoIds = new Set(["pQN-pnXPaVg", "PkZNo7MFNFg", "bMknfKXIFA8"]);
export function studioVideoUrl(embedUrl: string, origin: string) {
  const url = new URL(embedUrl);
  if (url.protocol !== "https:" || url.host !== "www.youtube-nocookie.com" || url.username || url.password || !videoIds.has(url.pathname.replace(/^\/embed\//, ""))) throw Error("Unsupported learning player");
  const parent = new URL(origin);
  if (!["http:", "https:"].includes(parent.protocol) || parent.username || parent.password) throw Error("Invalid player origin");
  url.search = "";
  url.searchParams.set("enablejsapi", "1");
  url.searchParams.set("origin", parent.origin);
  url.searchParams.set("playsinline", "1");
  return url.toString();
}

export const playbackSeconds = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 86400 ? Math.floor(value) : 0;
export const timestamp = (seconds: number) => `${Math.floor(playbackSeconds(seconds) / 60)}:${String(playbackSeconds(seconds) % 60).padStart(2, "0")}`;
