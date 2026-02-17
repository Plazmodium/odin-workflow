# Specification: Code Copy Button for Documentation

**ID**: DOC-001-code-copy-button
**Complexity Level**: 1 (Simple)
**Status**: draft
**Created**: 2026-01-09
**Version**: 1.0

---

## 1. Context & Goals (The "Why")

**User Story**:
As a developer reading the Odin documentation, I want to click a button to copy code examples to my clipboard, so that I can easily paste them into my project without error-prone manual text selection.

**Problem Solved**:
Developers currently must manually select and copy code blocks from markdown documentation, which is time-consuming and error-prone (especially for multi-line code with specific indentation). This creates friction during framework adoption and onboarding.

**Success Metrics**:
- [ ] Copy functionality works on 100% of fenced code blocks across all documentation files
- [ ] Copy operation completes in < 100ms (95th percentile)
- [ ] Page load time increases by < 50ms due to feature implementation
- [ ] Accessibility: keyboard navigation and screen reader support verified

---

## 2. Behavioral Requirements (The "What")

### 2.1 Core Functionality

The feature adds a "Copy" button to every fenced code block in markdown documentation. When clicked:
1. The exact text content of the code block is copied to the system clipboard
2. The button displays visual feedback ("Copied!" state) for 2 seconds
3. The button returns to its default "Copy" state after timeout

**Key Behaviors**:
- Button positioned in top-right corner of each code block (8px padding from edges)
- Each code block has an independent button (no shared state)
- Clicking a button only affects that specific code block
- Copied content preserves all whitespace, indentation, and newlines exactly as displayed

### 2.2 Edge Cases

- **ec_1**: Empty code block
  - Action: Copy button still appears
  - Expected: Copies empty string without error, shows "Copied!" feedback

- **ec_2**: Very long code block (500+ lines)
  - Action: User clicks copy button
  - Expected: Copies successfully within 100ms, no timeout or memory issues

- **ec_3**: Code with special characters (`, \, ", ', <, >, &)
  - Action: User clicks copy button
  - Expected: Copies exact characters without HTML entity encoding or escaping

- **ec_4**: Rapid clicking (5+ clicks in 1 second)
  - Action: User rapidly clicks the same copy button
  - Expected: Button state remains stable, no duplicate clipboard writes, no UI break

- **ec_5**: Browser denies clipboard permission
  - Action: User clicks copy button with clipboard permissions denied
  - Expected: Button shows error message "Clipboard access denied. Please enable in browser settings" for 2 seconds, then resets

- **ec_6**: Code block inside nested markdown (quoted text, list items)
  - Action: Page renders with nested code blocks
  - Expected: Copy button still appears and functions correctly

### 2.3 Constraints

- **constraint_1**: Must use vanilla JavaScript only (no jQuery, React, or external frameworks) - keep framework lightweight
- **constraint_2**: No modification to existing .md files - copy button injected via client-side JavaScript after page render
- **constraint_3**: All JavaScript and CSS hosted locally (no external CDNs) - must work offline
- **constraint_4**: Must work with existing markdown renderer without replacing or modifying the markdown pipeline
- **constraint_5**: Button must not obstruct code readability or interfere with manual text selection

---

## 3. Acceptance Criteria (Given/When/Then)

### Scenario 1: Successful Copy on First Code Block

**Given**: I am viewing a documentation page with at least one fenced code block
**When**: I click the "Copy" button in the top-right corner of the code block
**Then**:
- The exact code text is copied to my clipboard
- The button text changes to "Copied!" or displays a checkmark icon
- After 2 seconds, the button returns to "Copy" state
- I can paste the code elsewhere with correct formatting

**Acceptance Checklist**:
- [ ] Copy button visible on first render
- [ ] Clipboard contains exact code text (verified with paste test)
- [ ] Visual feedback displays for exactly 2 seconds
- [ ] Button returns to default state automatically

### Scenario 2: Multiple Independent Code Blocks

**Given**: A documentation page contains 10 different code blocks (TypeScript, Bash, JSON, Markdown, Python)
**When**: I view the page
**Then**:
- Each code block has its own "Copy" button
- Clicking button on code block #3 copies only that block's content
- Other buttons remain in default state (no state sharing)

**Acceptance Checklist**:
- [ ] All 10 code blocks have copy buttons
- [ ] Each button operates independently
- [ ] No cross-button state interference

### Scenario 3: Keyboard Accessibility

**Given**: I am navigating the page using only keyboard
**When**: I press Tab key to navigate through interactive elements
**Then**:
- Copy buttons receive focus (visible focus indicator)
- Pressing Enter or Space while button is focused triggers copy operation
- Screen reader announces "Copy code to clipboard" (via ARIA label)

**Acceptance Checklist**:
- [ ] Buttons are tab-navigable
- [ ] Enter key triggers copy
- [ ] Space key triggers copy
- [ ] ARIA label present and correct

### Scenario 4: Browser Compatibility

**Given**: I am using Chrome 120+, Firefox 115+, Safari 17+, or Edge 120+
**When**: I click any copy button
**Then**: The code is copied successfully to clipboard

**Acceptance Checklist**:
- [ ] Tested and working in Chrome 120+
- [ ] Tested and working in Firefox 115+
- [ ] Tested and working in Safari 17+
- [ ] Tested and working in Edge 120+

### Scenario 5: Clipboard Permission Error

**Given**: I have denied clipboard permissions in my browser settings
**When**: I click the "Copy" button
**Then**:
- An error message displays: "Clipboard access denied. Please enable in browser settings"
- The button shows error state (red border or error icon)
- After 2 seconds, the button returns to normal state
- No JavaScript errors thrown

**Acceptance Checklist**:
- [ ] Error message displayed to user
- [ ] Visual error state shown
- [ ] Button recovers after 2 seconds
- [ ] No console errors

### Scenario 6: Mobile Touch Interaction

**Given**: I am viewing documentation on a mobile device
**When**: I see a code block
**Then**:
- The copy button is visible (no hover required on touch devices)
- The button is at least 44x44px for touch accuracy
- Tapping the button triggers copy operation

**Acceptance Checklist**:
- [ ] Button visible without hover on mobile
- [ ] Button meets minimum touch target size (44x44px)
- [ ] Touch interaction works correctly

---

## 4. Technical Approach (The "How")

### 4.1 Architecture

**Implementation Strategy**: Client-side JavaScript injection

1. **Initialization Phase** (DOMContentLoaded):
   - Query all `<pre><code>` elements (standard markdown rendered structure)
   - For each code block, inject a copy button element
   - Attach event listeners to each button

2. **Copy Operation Flow**:
   - User clicks button → Extract text content from code block
   - Attempt clipboard write using Clipboard API (navigator.clipboard.writeText)
   - On success: Show "Copied!" feedback, set 2-second timeout
   - On error: Show error message, set 2-second timeout
   - Reset button to default state after timeout

3. **Fallback Strategy** (for older browsers):
   - Check if `navigator.clipboard` exists
   - If not available, use `document.execCommand('copy')` with temporary textarea
   - If both fail, display manual copy instructions

### 4.2 Data Models

```typescript
// Button State Machine
type ButtonState = 'default' | 'copying' | 'success' | 'error';

interface CopyButtonConfig {
  defaultText: string;        // "Copy"
  successText: string;        // "Copied!"
  errorText: string;          // "Error"
  feedbackDuration: number;   // 2000ms
  buttonClasses: string[];    // CSS classes for styling
  ariaLabel: string;          // "Copy code to clipboard"
}

// DOM Structure for each code block
interface CodeBlockWithButton {
  codeElement: HTMLElement;   // The <code> element containing text
  buttonElement: HTMLButtonElement;  // Injected copy button
  state: ButtonState;         // Current button state
  timeoutId: number | null;   // For feedback timeout management
}
```

### 4.3 Component Design

**HTML Structure** (injected via JavaScript):
```html
<pre class="code-block-container">
  <code>
    <!-- Original code content -->
  </code>
  <button
    class="copy-button"
    aria-label="Copy code to clipboard"
    data-state="default">
    Copy
  </button>
</pre>
```

**CSS Classes**:
```css
.copy-button {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: opacity 0.2s;
}

.copy-button:hover {
  background: rgba(255, 255, 255, 1);
  border-color: #a0a0a0;
}

.copy-button:focus {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

.copy-button[data-state="success"] {
  background: #d4edda;
  border-color: #c3e6cb;
  color: #155724;
}

.copy-button[data-state="error"] {
  background: #f8d7da;
  border-color: #f5c6cb;
  color: #721c24;
}

.code-block-container {
  position: relative;
  /* Allow absolute positioning of button */
}
```

### 4.4 Files to Modify/Create

**New Files**:
- `docs/assets/js/copy-button.js` (create) - Core copy button functionality
- `docs/assets/css/copy-button.css` (create) - Button styling

**Files to Modify**:
- Documentation HTML template or layout file (location depends on hosting platform answer)
  - Add `<script src="assets/js/copy-button.js"></script>` before `</body>`
  - Add `<link rel="stylesheet" href="assets/css/copy-button.css">` in `<head>`

**Note**: File paths assume standard static site structure. May need adjustment based on hosting platform (Open Question #1).

### 4.5 Dependencies

**Internal**:
- Existing markdown renderer (likely GitHub-flavored markdown or static site generator)
- Assumes rendered output uses standard `<pre><code>` HTML structure

**External**:
- None (vanilla JavaScript, no npm packages required)

**Browser APIs**:
- `navigator.clipboard.writeText()` - Primary clipboard API (Promise-based)
- `document.execCommand('copy')` - Fallback for older browsers (deprecated but widely supported)
- `document.querySelector()` / `querySelectorAll()` - DOM manipulation

---

## 5. Testing Strategy

### 5.1 Unit Tests

**Test Suite**: `tests/copy-button.test.js`

1. **Test: extractCodeText()**
   - Input: `<code>const x = 1;\nconst y = 2;</code>`
   - Expected: Returns `"const x = 1;\nconst y = 2;"` (preserves newlines)

2. **Test: copyToClipboard() success**
   - Mock: `navigator.clipboard.writeText` returns resolved Promise
   - Expected: Function returns `true`, no errors thrown

3. **Test: copyToClipboard() permission denied**
   - Mock: `navigator.clipboard.writeText` returns rejected Promise with DOMException
   - Expected: Function returns `false`, error message generated

4. **Test: Button state transitions**
   - Trigger: Call `setButtonState(button, 'success')`
   - Expected: Button text changes to "Copied!", data-state attribute set to "success"

5. **Test: Timeout reset**
   - Trigger: Set button to success state, wait 2.1 seconds
   - Expected: Button returns to "Copy" state, data-state="default"

### 5.2 Integration Tests

**Test Suite**: `tests/copy-button.integration.test.js`

1. **Test: Button injection on page load**
   - Setup: Load HTML with 3 code blocks
   - Execute: Initialize copy button script
   - Verify: 3 copy buttons exist, each positioned correctly

2. **Test: End-to-end copy operation**
   - Setup: Page with code block containing TypeScript code
   - Execute: Click copy button
   - Verify: Clipboard contains exact code text (use Clipboard API to read back)

3. **Test: Multiple buttons independence**
   - Setup: Page with 5 code blocks
   - Execute: Click button #2, verify clipboard, click button #4, verify clipboard
   - Verify: Clipboard content changes correctly, only clicked button shows "Copied!" state

4. **Test: Nested code blocks**
   - Setup: Markdown with code block inside blockquote or list
   - Execute: Initialize script
   - Verify: Copy button appears and functions correctly

### 5.3 Manual Browser Testing

**Test Plan** (perform on each browser):

1. **Chrome 120+ / Edge 120+**
   - [ ] Copy button appears on all code blocks
   - [ ] Click triggers copy, clipboard contains correct text
   - [ ] Visual feedback (Copied! state) displays for 2 seconds
   - [ ] Keyboard navigation (Tab, Enter, Space) works
   - [ ] ARIA label read by screen reader (test with ChromeVox)

2. **Firefox 115+**
   - [ ] Same tests as Chrome
   - [ ] Verify clipboard permission prompt behavior (if first use)

3. **Safari 17+**
   - [ ] Same tests as Chrome
   - [ ] Verify iOS Safari on touch device (button visible, touch target size adequate)

4. **Mobile Testing** (Chrome Android, Safari iOS)
   - [ ] Button visible without hover
   - [ ] Touch target meets 44x44px minimum
   - [ ] Copy operation works correctly

---

## 6. Security & Performance

### 6.1 Security Considerations

- [x] **Input Validation**: No user input processed - button operates on static code block content
- [x] **XSS Prevention**: Code content treated as plain text only, never executed or evaluated
- [x] **Content Security Policy**: Clipboard API respects browser CSP; no inline scripts used
- [x] **Permission Handling**: Clipboard API automatically prompts user for permission (browser-managed)
- [x] **No Sensitive Data**: Copy operation only affects user's local clipboard, no data sent to server

**Security Review Checklist**:
- [ ] Code does not use `eval()` or `Function()` constructor
- [ ] No innerHTML assignment with user-controlled content
- [ ] Clipboard errors handled gracefully without exposing system details
- [ ] No sensitive data logged to console

### 6.2 Performance Requirements

**Target**: < 50ms page load time increase

**Measurement Method**:
1. Record baseline DOMContentLoaded time without copy button script
2. Add copy button script and measure new DOMContentLoaded time
3. Calculate difference: `Δ = t_with_script - t_baseline`

**Expected Performance**:
- 10 code blocks: ~10-15ms initialization time
- 50 code blocks: ~30-40ms initialization time
- 100+ code blocks: Consider lazy loading (initialize on scroll)

**Copy Operation Performance**:
- Target: < 100ms for 95th percentile
- Maximum code block size tested: 1000 lines (~50KB text)
- Expected: Clipboard API is near-instantaneous (< 10ms) for typical code blocks

**Performance Optimization Strategies**:
1. Use `document.querySelectorAll()` once, cache results
2. Event delegation (single listener on document, not per-button) - if performance issues observed
3. Debounce rapid clicks (prevent multiple simultaneous clipboard writes)
4. Lazy initialization: Only inject buttons for code blocks in viewport, load more on scroll (if page has 50+ blocks)

---

## 7. Complexity Assessment

**Weighted Score**: 2.4
**Classification**: Level 1 (Simple)
**Confidence**: High

**Dimension Scores**:
- **Code Scope**: 3/10 (2 new files: copy-button.js, copy-button.css; ~150 LOC total; 1 existing file modified for script inclusion)
- **Technical Risk**: 2/10 (Low risk; uses standard browser APIs; no breaking changes; isolated feature)
- **Domain Complexity**: 1/10 (Simple domain; well-understood UX pattern; no complex business logic)
- **Integration Surface**: 2/10 (Internal integration only; depends on existing markdown renderer structure; no external APIs)
- **Testing Requirements**: 4/10 (Unit tests + integration tests + manual browser testing across 4 browsers)
- **Documentation Needs**: 3/10 (Basic implementation notes; user-facing documentation minimal; inline code comments)

**Calculation**:
```
weightedScore = (3 × 0.30) + (2 × 0.25) + (1 × 0.20) + (2 × 0.15) + (4 × 0.05) + (3 × 0.05)
              = 0.9 + 0.5 + 0.2 + 0.3 + 0.2 + 0.15
              = 2.25
```

**Rationale**:
This is a straightforward UI enhancement feature with clear boundaries:
- Single responsibility (copy code to clipboard)
- No data persistence or backend integration
- Standard browser APIs with well-documented fallback strategies
- Minimal file changes and no architectural impact
- Testing is straightforward (unit tests + browser compatibility checks)

The complexity assessment confirms Level 1 classification. The feature can be implemented in 2-3 days by a single developer with standard web development skills.

**Routing Decision**:
✅ **Level 1** → Skip Planning Agent, proceed directly to PHASE_3 (Architect task breakdown)

---

## 8. Self-Assessment (Quality Rubric)

**Criteria**:

1. **Clarity** [1.9/2.0]
   - ✅ Requirements are specific and unambiguous
   - ✅ Technical approach clearly defined with code examples
   - ✅ Edge cases documented with expected behaviors
   - ⚠️ Minor: File paths depend on hosting platform answer (Open Question #1)
   - **Notes**: Specification is clear enough for Guardian review. File path resolution will happen in PHASE_2.

2. **Completeness** [1.8/2.0]
   - ✅ All 6 user scenarios from requirements covered in acceptance criteria
   - ✅ Edge cases identified and documented (6 edge cases)
   - ✅ Security and performance requirements included
   - ⚠️ Minor: Two open questions remain from requirements (hosting platform, existing tooling)
   - **Notes**: Open questions do not block implementation but will inform file path decisions. Guardian can address these in PHASE_2.

3. **Testability** [2.0/2.0]
   - ✅ All acceptance criteria use Given/When/Then format
   - ✅ Each criterion has binary pass/fail checklist items
   - ✅ Success metrics are measurable (< 100ms, < 50ms load time)
   - ✅ Test strategy includes unit, integration, and manual browser tests
   - **Notes**: Every requirement can be verified through automated or manual testing.

4. **Technical Feasibility** [2.0/2.0]
   - ✅ Approach uses standard browser APIs (Clipboard API, DOM manipulation)
   - ✅ Fallback strategy documented for browser compatibility
   - ✅ No external dependencies (vanilla JavaScript constraint met)
   - ✅ Component design includes HTML structure, CSS classes, and state management
   - **Notes**: Implementation is straightforward using proven web development patterns.

5. **Complexity Accuracy** [1.9/2.0]
   - ✅ Weighted score calculation documented with justification
   - ✅ Dimension scores reasonable (Code Scope: 3, Technical Risk: 2, Domain: 1)
   - ✅ Classification as Level 1 (Simple) is accurate
   - ⚠️ Testing Requirements scored 4/10 - could be argued as 3/10 for even lower complexity
   - **Notes**: Assessment is conservative but justified. Feature is definitively Level 1.

**Overall Score**: 1.92/2.0 (average of 5 criteria)

**Self-Assessment Notes**:
- **Strengths**: Specification is clear, testable, and technically sound. All acceptance criteria are well-defined with binary pass/fail conditions.
- **Areas for Guardian Review**:
  1. **Open Question #1** (Hosting Platform): Guardian should validate actual hosting setup and adjust file paths accordingly
  2. **Open Question #2** (Existing Tooling): Guardian should verify if documentation build process exists and how to integrate script includes
- **Concerns**: None blocking. The two open questions are information-gathering, not design blockers.
- **Recommendation**: Proceed to Guardian review (PHASE_2). Specification is ready for codebase validation.

**Proceed to Guardian?**:
✅ **YES** (overall score ≥ 1.5)

---

## 9. Open Questions

**Addressed from Requirements Document**:

1. **Hosting Platform** (Open Question #1 from Requirements)
   - **Status**: OPEN → TO BE RESOLVED BY GUARDIAN
   - **Owner**: Guardian Agent (PHASE_2)
   - **Impact**: Determines exact file paths and script include method
   - **Question**: Are the markdown files rendered via GitHub Pages, a static site generator (Jekyll, Hugo, Docusaurus), or viewed locally as HTML?
   - **Guardian Task**: Inspect repository structure, check for config files (e.g., `_config.yml`, `docusaurus.config.js`, `.github/workflows`), determine hosting platform
   - **Fallback**: If no static site generator found, assume simple HTML files with manual script includes

2. **Existing Tooling** (Open Question #2 from Requirements)
   - **Status**: OPEN → TO BE RESOLVED BY GUARDIAN
   - **Owner**: Guardian Agent (PHASE_2)
   - **Impact**: May already have infrastructure for adding scripts/styles
   - **Question**: Is there an existing build process or documentation toolchain that compiles/processes the markdown files?
   - **Guardian Task**: Look for `package.json`, build scripts, CI/CD workflows that process markdown
   - **Fallback**: If no build process exists, create standalone JavaScript/CSS files with manual include instructions

**New Questions from Specification Phase**:

3. **Code Block Selector Specificity**
   - **Status**: NEW → TO BE RESOLVED BY GUARDIAN
   - **Owner**: Guardian Agent (PHASE_2)
   - **Impact**: Determines exact CSS selector for code blocks
   - **Question**: What is the exact HTML structure of rendered code blocks? (e.g., `<pre><code>`, `<div class="highlight"><pre><code>`, custom structure?)
   - **Guardian Task**: Inspect rendered HTML of existing documentation pages, identify precise DOM structure
   - **Decision**: Write selector in copy-button.js: `document.querySelectorAll('pre > code')` or adjust based on findings

---

## 10. Next Steps

- [ ] **Guardian review (PHASE_2)**:
  - Validate specification against actual codebase
  - Resolve 3 open questions (hosting platform, build process, code block HTML structure)
  - Verify markdown renderer structure and patterns
  - Confirm file paths are accurate
  - Review security and performance assumptions

- [ ] **Address Guardian feedback**:
  - Update spec based on codebase findings
  - Adjust file paths if necessary
  - Refine technical approach if conflicts found

- [ ] **Final approval**:
  - Guardian approves specification
  - Transition to PHASE_3 (Task Breakdown)

**Estimated Timeline**:
- Guardian review: 1-2 hours
- Feedback iteration: 0-1 hour (if minor adjustments needed)
- Task breakdown (PHASE_3): 1 hour
- Implementation (PHASE_4): 2-3 days
- Testing & validation: 1 day

**Total Estimated Time to Completion**: 3-4 days
