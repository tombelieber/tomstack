# Model-invoked and user-invoked skills

Every skill has one invocation mode.

- **User-invoked:** only the human may start it. Set
  `disable-model-invocation: true` in `SKILL.md` and
  `policy.allow_implicit_invocation: false` in `agents/openai.yaml`.
- **Model-invoked:** the model or human may start it. Omit both settings and
  keep a trigger-rich frontmatter description.

A user-invoked skill may depend on model-invoked discipline, but another skill
must not attempt to invoke a user-invoked skill. Instructions that actively
need another model-invoked skill should name the Skill tool and one skill per
call, rather than relying on a bare slash-command mention.
