# Resolve Conflict

Use `/totalreclaw resolve "<query>"` to list the current top conflicting records.

Then choose an action:

```text
/totalreclaw resolve "<query>" --action keep-newer
/totalreclaw resolve "<query>" --action keep-older
/totalreclaw resolve "<query>" --action merge
/totalreclaw resolve "<query>" --action defer
```

`merge` creates a new review draft instead of silently rewriting durable memory.
