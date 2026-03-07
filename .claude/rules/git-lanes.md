# git-lanes Workflow Rules

When working in this repository, follow these rules:

1. **Always start a session** before editing files:
   `git lanes start <descriptive-name>`

2. **Use descriptive session names** that reflect the task:
   Good: `fix-auth-bug`, `add-search-feature`
   Bad: `session1`, `test`

3. **Commit frequently** with clear messages:
   `git lanes commit -m "add input validation for login form"`

4. **Check for conflicts** before merging:
   `git lanes conflicts`

5. **Never end a session you did not create.**

6. **Run tests** before ending a session:
   `git lanes test`

7. **End the session** when your task is complete:
   `git lanes end -m "completed: add search feature"`
