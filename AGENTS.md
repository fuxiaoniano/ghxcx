# Project Maintenance Rules

## GitHub synchronization

- The canonical backup repository is `https://github.com/fuxiaoniano/ghxcx.git`.
- After every completed code, configuration, database migration, or documentation update, run the checks appropriate to the changed area.
- Review the working tree and stage only files that belong to the completed update.
- Commit the verified update with a concise task-specific message, then push the current branch to `origin` before reporting completion.
- Never commit `.env` files, credentials, AppSecret values, access tokens, database passwords, SSH keys, uploaded user data, local browser profiles, deployment archives, or temporary screenshots.
- Keep `.env.example` limited to placeholders and documented variable names.
- If a push cannot be completed because GitHub authentication or network access is unavailable, report that explicitly instead of claiming synchronization succeeded.
