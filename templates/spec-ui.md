# Specification: [FEATURE-ID] [Feature Name]

**Template Type**: UI Feature
**Complexity Level**: [1/2/3]
**Status**: draft

---

## 1. Context & Goals

**Problem Statement**: [What user problem does this solve?]

**User Stories**:
- As a [role], I want to [action] so that [benefit]

**Success Metrics**: [Conversion rate, task completion time, etc.]

---

## 2. User Flows

### Primary Flow

```
[Page/Screen A] → [Action] → [Page/Screen B] → [Result]
```

1. User lands on [page]
2. User [action — clicks, fills form, etc.]
3. System [response — shows, navigates, etc.]
4. User sees [outcome]

### Alternative Flows

- **Empty state**: What shows when there's no data?
- **Error state**: What shows when something fails?
- **Loading state**: What shows during async operations?

---

## 3. Component Design

### New Components

| Component | Description | Props |
|-----------|-------------|-------|
| [ComponentName] | [What it does] | [Key props] |

### Component Hierarchy

```
Page
├── Header
├── MainContent
│   ├── FilterBar
│   ├── ItemList
│   │   └── ItemCard (repeated)
│   └── Pagination
└── Footer
```

### State Management

- **Local state**: [What's managed per-component]
- **Shared state**: [What's in context/store]
- **Server state**: [What comes from API — cache strategy]

---

## 4. UI/UX Requirements

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| Mobile (<640px) | [Single column, stacked] |
| Tablet (640-1024px) | [Two column] |
| Desktop (>1024px) | [Full layout] |

### Accessibility

- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Screen reader labels (aria-label, aria-describedby)
- [ ] Color contrast (WCAG AA minimum)
- [ ] Focus indicators visible
- [ ] Form error announcements (aria-live)

### Error Messages

| Error | User-Facing Message |
|-------|-------------------|
| Network failure | "Unable to connect. Please try again." |
| Validation error | [Specific field message] |
| Not found | "This page doesn't exist." |

---

## 5. Acceptance Criteria

- [ ] Primary user flow completes end-to-end
- [ ] All states handled (loading, empty, error, success)
- [ ] Responsive on mobile, tablet, desktop
- [ ] Keyboard accessible
- [ ] Form validation shows clear error messages
- [ ] [Additional criteria]

---

## 6. Technical Implementation

### Required Skills

| Skill | Category | Why Needed |
|-------|----------|------------|
| [skill] | [category] | [reason] |

### API Dependencies

| Endpoint | Method | Used For |
|----------|--------|----------|
| /api/... | GET | Fetch data |

### Performance Requirements

| Metric | Target |
|--------|--------|
| First Contentful Paint | < [X]s |
| Largest Contentful Paint | < [X]s |
| Bundle size impact | < [X] KB |
