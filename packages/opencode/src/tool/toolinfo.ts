import z from "zod"
import { Tool } from "./tool"
import { ToolRegistry } from "./registry"
import type { Agent } from "../agent/agent"
import { Session } from "../session"

export const ToolInfoTool = Tool.define("toolinfo", async () => {
  return {
    description: `Request tool info. Use to get tools not in your core set.

Extended tools available: todowrite, task, websearch, codesearch, skill, apply_patch, lsp, batch

Usage: toolinfo({tools: ["toolname"]})
- Single: toolinfo({tools: ["todowrite"]})
- Multiple: toolinfo({tools: ["todowrite", "websearch"]})
- All: toolinfo({tools: ["all"]})

If tool not found, response shows "Not Found: toolname". Use ["all"] to see complete list.

Examples (set includeExamples: true for more):
1. User asks for todo list -> toolinfo({tools: ["todowrite"]}) -> use todowrite
2. User asks for research -> toolinfo({tools: ["websearch"]}) -> use websearch
3. Not sure what exists -> toolinfo({tools: ["all"]}) -> pick from list 
  toolinfo({tools: ["todowrite"]})
Step 3 - System responds with full tool definition
Step 4 - Now use it:
  todowrite({todos: [{id: "1", content: "Check emails", status: "pending", priority: "high"}]})

Example 2: Request multiple tools at once
Situation: User asks "Plan my project and research the latest libraries"
Step 1 - Identify needs: I need both "todowrite" for planning AND "websearch" for research
Step 2 - Request both:
  toolinfo({tools: ["todowrite", "websearch"]})
Step 3 - System provides both tool definitions
Step 4 - Use them as needed:
  todowrite({todos: [...]})
  websearch({query: "latest React libraries 2025"})

Example 3: List ALL available tools
Situation: You are not sure which tool to use
Step 1 - Request list:
  toolinfo({tools: ["all"]})
Step 2 - System shows every available tool with descriptions
Step 3 - Choose the right one and request it specifically:
  toolinfo({tools: ["skill"]})

Example 4: Request tool with examples
Situation: You need "task" tool but are not sure how to use it
Step 1 - Request with examples flag:
  toolinfo({tools: ["task"], includeExamples: true})
Step 2 - System provides detailed description + usage examples
Step 3 - Use the tool correctly:
  task({description: "Refactor auth system", prompt: "Find all auth files and refactor them"})

Example 5: Request after failing with current tools
Situation: You tried bash/read/edit but the task is too complex
Step 1 - Recognize need: This is too big for core tools, need "task" sub-agent
Step 2 - Request it:
  toolinfo({tools: ["task"]})
Step 3 - Launch sub-agent:
  task({description: "Complex refactoring", prompt: "Detailed instructions here"})

Example 6: Discover custom/unlisted tools
Situation: User mentions "Use the deployment tool" but "deployment" is not in the common list
Step 1 - Try requesting it:
  toolinfo({tools: ["deployment"]})
Step 2a - If found: System provides the custom tool definition
  deployment({action: "deploy", environment: "production"})
Step 2b - If not found: Response shows "Not Found: deployment"
  Step 3b - Discover what's actually available:
    toolinfo({tools: ["all"]})
  Step 4b - System shows complete list including custom tools
  Step 5b - Find the right tool (maybe it's called "deploy" not "deployment")

CRITICAL RULES:

1. ALWAYS request first: You MUST call toolinfo BEFORE using any extended tool
2. Do not guess tool names: Use the exact names from the list (todowrite, not "todo")
3. Check the response: If toolinfo returns "Tool not found", that tool doesn't exist
4. One request at a time: Request what you need, use it, then request more if needed
5. Do not pretend: Never write tool calls as text - actually use the tool after requesting it

Correct flow:
WRONG: "I will use todowrite({...})" (just saying it, not doing it)
RIGHT: toolinfo({tools: ["todowrite"]}) -> [system provides it] -> todowrite({...}) (actually calling it)

Quick Reference:
- Single tool: toolinfo({tools: ["toolname"]})
- Multiple: toolinfo({tools: ["tool1", "tool2"]})
- All tools: toolinfo({tools: ["all"]})
- With examples: toolinfo({tools: ["toolname"], includeExamples: true})

What happens when you request a tool:

Tool exists: 
  - Response shows: full description, parameters, usage info
  - You can now use the tool immediately

Tool doesn't exist:
  - Response shows: "Not Found: toolname"
  - Check the available tools list or use ["all"] to see what's available
  - Tool names are case-sensitive and must match exactly

Example - Tool not found:
You call: toolinfo({tools: ["todo"]})
Response: "Not Found: todo"
Why: The tool is called "todowrite" not "todo"
Fix: Call toolinfo({tools: ["todowrite"]}) instead

Example - Multiple tools, one not found:
You call: toolinfo({tools: ["todowrite", "magicwand"]})
Response: 
  - Shows full info for "todowrite" [checkmark]
  - Shows "Not Found: magicwand" [x]
Result: You get the valid tool and know the other doesn't exist`,
    parameters: z.object({
      tools: z
        .array(z.string())
        .describe(
          "Tool IDs to get. Examples: ['todowrite'], ['task'], ['todowrite', 'websearch'], or ['all'] to list everything.",
        ),
      includeExamples: z
        .boolean()
        .optional()
        .describe("Include detailed usage examples. Default: false. Use true when you are unsure how to use the tool."),
    }),
    async execute(params, ctx) {
      const allTools = await ToolRegistry.all()
      const requestedIds =
        params.tools.includes("all") || params.tools.length === 0 ? allTools.map((t) => t.id) : params.tools

      const toolInfo = await Promise.all(
        requestedIds.map(async (id) => {
          const tool = allTools.find((t) => t.id === id)
          if (!tool) return { id, error: "Tool not found" }

          try {
            const initialized = await tool.init({
              agent: {
                id: ctx.agent,
                name: ctx.agent,
                mode: "subagent",
                permission: [],
                options: {},
              } as unknown as Agent.Info,
            })
            const paramShape = extractParamShape(initialized.parameters)

            return {
              id,
              description: initialized.description,
              parameters: paramShape,
              available: true,
            }
          } catch (err) {
            return {
              id,
              error: `Failed to initialize: ${err instanceof Error ? err.message : String(err)}`,
            }
          }
        }),
      )

      const availableTools = toolInfo.filter((t) => !t.error)
      const notFound = toolInfo.filter((t) => t.error)

      // Store requested tools in session metadata for subsequent steps
      const validToolIds = availableTools.map((t) => t.id)
      if (validToolIds.length > 0 && !params.tools.includes("all")) {
        try {
          await Session.update(ctx.sessionID, (draft) => {
            const meta = (draft.metadata ?? {}) as Record<string, any>
            const requested = (meta.requestedTools ?? []) as string[]
            // Add newly requested tools to the list
            for (const toolId of validToolIds) {
              if (!requested.includes(toolId)) {
                requested.push(toolId)
              }
            }
            draft.metadata = { ...meta, requestedTools: requested }
          })
        } catch (e) {
          // Non-critical error, just log it
          console.error("[TOOLINFO] Failed to store requested tools in session:", e)
        }
      }

      let output = `# Available Tools\n\n`

      for (const tool of availableTools) {
        output += `## ${tool.id}\n`
        output += `${tool.description}\n\n`
        output += `**Parameters:**\n${JSON.stringify(tool.parameters, null, 2)}\n\n`
      }

      if (notFound.length > 0) {
        output += `\n**Not Found:** ${notFound.map((t) => t.id).join(", ")}\n`
      }

      return {
        title: "Tool Information",
        output,
        metadata: {
          count: availableTools.length,
          tools: availableTools.map((t) => t.id),
        },
      }
    },
  }
})

function extractParamShape(schema: z.ZodType): Record<string, any> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>
    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(shape)) {
      result[key] = describeZodType(value)
    }
    return result
  }
  return { type: "object" }
}

function describeZodType(schema: z.ZodType): any {
  if (schema instanceof z.ZodString) return "string"
  if (schema instanceof z.ZodNumber) return "number"
  if (schema instanceof z.ZodBoolean) return "boolean"
  if (schema instanceof z.ZodArray) return [describeZodType((schema as any).element)]
  if (schema instanceof z.ZodObject) return extractParamShape(schema)
  if (schema instanceof z.ZodOptional) return describeZodType((schema as any).unwrap())
  if (schema instanceof z.ZodEnum) return (schema as any).options
  return "any"
}
