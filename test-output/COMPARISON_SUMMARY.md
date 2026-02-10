# Lite Mode vs Normal Mode Comparison

## Test Results: "Make a todo with fish and meats"

### Tool Count

- **Lite Mode:** 10 tools (20KB prompt)
- **Normal Mode:** 15 tools (21KB prompt)
- **Reduction:** 5 tools removed, ~5% smaller prompt

### Tools Available

**Lite Mode (Core Tools Only):**

```
1. invalid
2. bash
3. read
4. glob
5. grep
6. edit
7. write
8. webfetch
9. toolinfo
10. question
```

**Normal Mode (All Tools):**

```
1. invalid
2. bash
3. read
4. glob
5. grep
6. edit
7. write
8. webfetch
9. toolinfo
10. question
11. task (extended)
12. todowrite (extended)
13. websearch (extended)
14. codesearch (extended)
15. skill (extended)
```

### How Lite Mode Works

1. **Initial Load:** Only 8 core tools + toolinfo + question (10 total)
2. **On-Demand:** Model can request additional tools via `toolinfo` tool
3. **Progressive:** After requesting a tool, it becomes available in subsequent steps

### Key Observations

- The ~5% reduction (1KB) seems small, but this is with only 5 extended tools
- With more custom tools/skills, the savings would be larger
- The real benefit is for local models with limited context windows
- Token usage is reduced by minimizing tool descriptions, not just tool count

### Test Output Files

- Lite mode prompts: `/home/steffen/opencode/opencode/test-output/prompt-ses_3b770cfceffefAP2Wq9EVBZ9yI-*.json`
- Normal mode prompts: `/home/steffen/opencode/opencode/test-output/prompt-ses_3b7707db0ffeJ6N46VviKqMDdO-*.json`

### How to Enable Lite Mode

Add to your `opencode.json`:

```json
{
  "experimental": {
    "lite_mode": true
  }
}
```

## Conclusion

Lite mode successfully reduces the initial tool set from 15 to 10 tools, saving ~5% of prompt size. The model can dynamically request additional tools as needed using the `toolinfo` tool.
