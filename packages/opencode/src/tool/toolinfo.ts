import z from "zod"
import { Tool } from "./tool"
import { ToolRegistry } from "./registry"
import type { Agent } from "../agent/agent"
import { Session } from "../session"
import DESCRIPTION from "./toolinfo.txt"

export const ToolInfoTool = Tool.define("toolinfo", async () => {
  return {
    description: DESCRIPTION,
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

      // When "all" is requested, return simplified list to save tokens
      const isAllRequest = params.tools.includes("all")

      let output: string
      if (isAllRequest) {
        output = `# All Available Tools\n\n**Core tools** (available now):\n- bash, read, edit, write, glob, grep, webfetch, question, toolinfo\n\n**Extended tools** (request individually for details):\n${availableTools
          .filter(
            (t) =>
              !["bash", "read", "edit", "write", "glob", "grep", "webfetch", "question", "toolinfo"].includes(t.id),
          )
          .map((t) => `- ${t.id}`)
          .join(
            "\n",
          )}\n\nRequest specific tool info:\n- toolinfo({tools: ["websearch"]})\n- toolinfo({tools: ["todowrite", "task"]})\n- toolinfo({tools: ["skill"], includeExamples: true})`
      } else {
        // Handle not found at the start for visibility
        let notFoundOutput = ""
        if (notFound.length > 0) {
          notFoundOutput = `**Not Found:** ${notFound.map((t) => t.id).join(", ")}\n\n**Tip:** Use toolinfo({tools: ["all"]}) to see all available tools.\n\n`
        }

        output = `# Available Tools\n\n${notFoundOutput}`
        for (const tool of availableTools) {
          output += `## ${tool.id}\n`
          output += `${tool.description}\n\n`
          output += `**Parameters:**\n${JSON.stringify(tool.parameters, null, 2)}\n\n`
        }
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
