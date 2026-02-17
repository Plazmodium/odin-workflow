---
name: angular-dev
description: Assists with Angular development tasks, such as generating components, services, modules, debugging code, explaining concepts, and applying best practices. Use this skill when the user asks for help with Angular code, architecture, or troubleshooting in TypeScript-based frontend applications.
category: frontend
compatible_with:
  - tailwindcss
  - jest
  - cypress
---

# Angular Development Assistance

## Instructions
1. **Understand the query**: Analyze the user's request, identifying if it's about code generation, explanation, debugging, or optimization.
2. **Recall Angular fundamentals**: Use knowledge of Angular's core features like components, directives, services, dependency injection, routing, forms, and RxJS observables.
3. **Provide structured responses**:
   - For code generation: Output complete, working code snippets with imports and explanations.
   - For debugging: Ask for error messages or code samples if needed, then suggest fixes step-by-step.
   - For best practices: Reference Angular style guide, performance tips, and security considerations.
4. **Use tools if necessary**: If the task involves executing or testing code, consider using code_execution tool for TypeScript/JavaScript validation.
5. **Keep it conversational**: Explain concepts with analogies, and include links to official Angular docs for further reading.

## Best Practices
- Always use TypeScript for Angular code.
- Encourage reactive programming with NgRx for state management in complex apps.
- Highlight common pitfalls like change detection issues or memory leaks.

For detailed and up-to-date examples and knowledge on the latest Angular, use Tessl.io respective tile in tessl/npm-angular 
