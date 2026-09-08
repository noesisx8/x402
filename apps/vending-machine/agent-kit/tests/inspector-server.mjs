// Offline Inspector fixture. No wallet, network calls, or real payment signature.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../server.mjs";
import { fixture } from "./fixture.mjs";
await createServer(fixture().client).connect(new StdioServerTransport());
