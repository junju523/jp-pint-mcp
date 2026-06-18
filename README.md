# jp-pint-mcp

[MCP](https://modelcontextprotocol.io) server that lets AI agents validate **Japanese qualified invoices (適格請求書)** and **registration numbers (T+13)** via [jp-pint](https://jp-pint-rryxbfcsxq-an.a.run.app). Zero dependencies.

## Setup

Get a free key (200 validations/month) at **https://jp-pint-rryxbfcsxq-an.a.run.app**. Add to your MCP client config:

```json
{
  "mcpServers": {
    "jp-pint": {
      "command": "npx",
      "args": ["github:junju523/jp-pint-mcp"],
      "env": { "JP_PINT_KEY": "jpp_live_..." }
    }
  }
}
```

## Tools

- `check_registration_number(number)` — validate a 適格請求書発行事業者登録番号 ("T" + 13 digits): format + 法人番号 check digit. (No key required.)
- `validate_invoice(invoice)` — validate the mandatory fields of a qualified invoice and 8%/10% tax consistency. (Uses `JP_PINT_KEY`.)

## Privacy

Sends only the data you pass to the jp-pint API; invoice contents are not stored. Results are advisory — confirm final tax treatment with a professional.

## License

MIT
