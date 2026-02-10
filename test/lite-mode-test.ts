#!/usr/bin/env bun
/**
 * Test script to compare lite mode vs normal mode
 *
 * Usage:
 *   LITE_MODE=true bun run test/lite-mode-test.ts
 *   LITE_MODE=false bun run test/lite-mode-test.ts
 */

import { Session } from "../packages/opencode/src/session"
import { SessionPrompt } from "../packages/opencode/src/session/prompt"
import { Config } from "../packages/opencode/src/config/config"
import { Log } from "../packages/opencode/src/util/log"
import { Instance } from "../packages/opencode/src/project/instance"
import * as fs from "fs/promises"
import * as path from "path"

const TEST_PROMPT = "Make a todo with fish and meats"
const OUTPUT_DIR = "./test-output"

async function runTest(liteMode: boolean) {
  const modeName = liteMode ? "lite" : "normal"
  console.log(`\n=== Running ${modeName.toUpperCase()} MODE TEST ===\n`)

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true })

  // Initialize instance
  await Instance.init()

  // Get config and set lite mode
  const config = await Config.get()
  if (liteMode) {
    config.experimental = { ...config.experimental, lite_mode: true }
  }

  // Create a session
  const session = await Session.create({
    title: `Test - ${modeName} mode`,
  })

  console.log(`Created session: ${session.id}`)

  // Capture the prompt and response
  const outputFile = path.join(OUTPUT_DIR, `${modeName}-mode-output.md`)
  let output = `# ${modeName.toUpperCase()} MODE TEST\n\n`
  output += `**Session ID:** ${session.id}\n`
  output += `**Lite Mode:** ${liteMode}\n`
  output += `**Timestamp:** ${new Date().toISOString()}\n\n`
  output += `## User Prompt\n\n\`\`\`\n${TEST_PROMPT}\n\`\`\`\n\n`

  // Send the prompt
  console.log(`Sending prompt: ${TEST_PROMPT}`)

  try {
    const result = await SessionPrompt.prompt({
      sessionID: session.id,
      parts: [{ type: "text", text: TEST_PROMPT }],
    })

    // Get messages to extract the full prompt that was sent
    const messages = await Session.messages(session.id)

    output += `## Full Message History\n\n`
    output += `\`\`\`json\n${JSON.stringify(messages, null, 2)}\n\`\`\`\n\n`

    output += `## Response\n\n`
    output += `Result: ${JSON.stringify(result, null, 2)}\n\n`

    console.log(`✓ Test completed successfully`)
  } catch (error) {
    output += `## Error\n\n`
    output += `\`\`\`\n${error instanceof Error ? error.message : String(error)}\n\`\`\`\n\n`
    console.error(`✗ Test failed:`, error)
  }

  // Write output file
  await fs.writeFile(outputFile, output)
  console.log(`Output written to: ${outputFile}`)
}

// Main
const liteMode = process.env.LITE_MODE === "true"
runTest(liteMode).catch(console.error)
