const { Client } = require("@upstash/workflow");

async function main() {
  const client = new Client({ token: process.env.QSTASH_TOKEN });
  console.log("Triggering...");
  try {
    const result = await client.trigger({
      url: "https://app.launchfly.ai/api/agent/workflow-run",
      body: { taskId: "test-task" }
    });
    console.log(result);
  } catch (err) {
    console.error(err);
  }
}
main();
