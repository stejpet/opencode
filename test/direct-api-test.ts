#!/usr/bin/env bun
/**
 * Direct API test for lite mode comparison
 * This bypasses the TUI and calls the session API directly
 */

import { Session } from "../packages/opencode/src/session"
import { SessionPrompt } from "../packages/opencode/src/session/prompt"
import { Instance } from "../packages/opencode/src/project/instance"
import { InstanceBootstrap } from "../packages/opencode/src/project/bootstrap"
import * as fs from "fs/promises"
import * as path from "path"

const TEST_PROMPT = "Make a todo with fish and meats"
const OUTPUT_DIR = "./test-output"

async function runTest(liteMode: boolean) {
  const modeName = liteMode ? "lite" : "normal"
  console.log(`\n=== Running ${modeName.toUpperCase()} MODE TEST ===\n`)

  const outputData: any = {
    mode: modeName,
    timestamp: new Date().toISOString(),
    prompt: TEST_PROMPT,
    liteMode: liteMode,
  }

  try {
    await Instance.provide({
      directory: process.cwd(),
      init: InstanceBootstrap,
      fn: async () => {
        // Create a session
        const session = await Session.create({
          title: `Test - ${modeName} mode`,
        })

        console.log(`Created session: ${session.id}`)
        outputData.sessionId = session.id

        // Send the prompt
        console.log(`Sending prompt: ${TEST_PROMPT}`)
        const result = await SessionPrompt.prompt({
          sessionID: session.id,
          parts: [{ type: "text", text: TEST_PROMPT }],
        })

        outputData.result = result

        // Get messages to see the conversation
        const messages = await Session.messages(session.id)
        outputData.messages = messages

        console.log(`✓ Test completed`)

        await Instance.dispose()
      },
    })
  } catch (error) {
    console.error(`✗ Test failed:`, error)
    outputData.error = error instanceof Error ? error.message : String(error)
  }

  // Ensure output directory exists and write results
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  const outputFile = path.join(OUTPUT_DIR, `${modeName}-mode-prompt.json`)
  await fs.writeFile(outputFile, JSON.stringify(outputData, null, 2))
  console.log(`Output saved to: ${outputFile}`)
}

// Run tests
const liteMode = process.env.LITE_MODE === "true"
runTest(liteMode)
  .then(() => console.log("\nTest complete!"))
  .catch(console.error)
