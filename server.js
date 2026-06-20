#!/usr/bin/env node
"use strict";

// jp-pint-mcp — zero-dependency MCP stdio server exposing jp-pint validation.
// Newline-delimited JSON-RPC 2.0 over stdin/stdout. Logs to stderr only.

const readline = require("readline");

const BASE =
  process.env.JP_PINT_URL || "https://jp-pint-rryxbfcsxq-an.a.run.app";
const NAME = "jp-pint";
const VERSION = "0.1.0";

const TOOLS = [
  {
    name: "check_registration_number",
    title: "Check a Japanese invoice registration number (T+13)",
    description:
      "Validate a 適格請求書発行事業者登録番号 (Japanese qualified-invoice registration number, 'T' followed by 13 digits): format and the 法人番号 check digit. Free, no key needed.",
    inputSchema: {
      type: "object",
      properties: {
        number: { type: "string", description: "e.g. T2010401021385" },
      },
      required: ["number"],
    },
  },
  {
    name: "validate_invoice",
    title: "Validate a Japanese qualified invoice (適格請求書)",
    description:
      "Validate that a Japanese qualified invoice has the mandatory fields (発行者名/登録番号/取引年月日/受領者名/取引内容/税率ごとの対価・消費税額) and consistent 8%/10% tax. Requires JP_PINT_KEY.",
    inputSchema: {
      type: "object",
      properties: {
        invoice: {
          type: "object",
          description:
            "seller_name, registration_number (T+13), issue_date, recipient_name, lines[{description, amount, tax_rate}], tax_summary[{tax_rate, taxable_amount, tax_amount}]",
        },
      },
      required: ["invoice"],
    },
  },
];

function send(m) {
  process.stdout.write(JSON.stringify(m) + "\n");
}
function result(id, res) {
  send({ jsonrpc: "2.0", id, result: res });
}
function error(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}
function textResult(obj, isError) {
  return {
    content: [{ type: "text", text: JSON.stringify(obj, null, 2) }],
    isError: !!isError,
  };
}

async function checkRegistration(args) {
  try {
    const r = await fetch(
      BASE + "/v1/registration/" + encodeURIComponent(args.number || ""),
    );
    return textResult(await r.json(), !r.ok);
  } catch (e) {
    return textResult(
      { error: "network error: " + String(e.message || e) },
      true,
    );
  }
}

async function validateInvoice(args) {
  const key = process.env.JP_PINT_KEY;
  if (!key)
    return textResult(
      { error: "JP_PINT_KEY is not set. Get a free key at " + BASE },
      true,
    );
  try {
    const r = await fetch(BASE + "/v1/validate", {
      method: "POST",
      headers: { "x-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ invoice: args.invoice || {} }),
    });
    return textResult(await r.json(), !r.ok);
  } catch (e) {
    return textResult(
      { error: "network error: " + String(e.message || e) },
      true,
    );
  }
}

async function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined || id === null) return; // notification
  switch (method) {
    case "initialize":
      return result(id, {
        protocolVersion: (params && params.protocolVersion) || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: NAME, version: VERSION },
      });
    case "ping":
      return result(id, {});
    case "tools/list":
      return result(id, { tools: TOOLS });
    case "tools/call": {
      const name = params && params.name;
      const args = (params && params.arguments) || {};
      if (name === "check_registration_number")
        return result(id, await checkRegistration(args));
      if (name === "validate_invoice")
        return result(id, await validateInvoice(args));
      return error(id, -32602, `Unknown tool: ${name}`);
    }
    default:
      return error(id, -32601, `Method not found: ${method}`);
  }
}

const rl = readline.createInterface({ input: process.stdin });
const pending = new Set(); // in-flight async tool calls; drain before exit
rl.on("line", (line) => {
  const s = line.trim();
  if (!s) return;
  let msg;
  try {
    msg = JSON.parse(s);
  } catch (e) {
    return;
  }
  const p = Promise.resolve(handle(msg))
    .catch((e) => {
      if (msg && msg.id != null)
        error(msg.id, -32603, "Internal error: " + String(e.message || e));
    })
    .finally(() => pending.delete(p));
  pending.add(p);
});
// Don't kill in-flight responses when stdin closes (e.g. batch/pipe probes).
process.stdin.on("end", () => {
  Promise.allSettled([...pending]).then(() => process.exit(0));
});
