# interlock_mcp

MCP server built with TypeScript for the Model Context Protocol.

## Description

This is an MCP (Model Context Protocol) server implementation using Node.js and TypeScript. The Model Context Protocol is Anthropic's standard for connecting LLMs to external data sources and tools.

## Prerequisites

- Node.js >= 16.0.0
- npm or yarn

## Installation

```bash
npm install
```

## Development Commands

### Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

### Watch Mode

Automatically rebuild on file changes during development:

```bash
npm run watch
```

### Run Server

Start the compiled MCP server:

```bash
npm start
```

Note: You must build the project first before running it.

### Code Quality

#### Linting

Check code style with ESLint:

```bash
npm run lint
```

Auto-fix linting issues:

```bash
npm run lint:fix
```

#### Formatting

Format code with Prettier:

```bash
npm run format
```

Check formatting without modifying files (useful for CI):

```bash
npm run format:check
```

#### Type Checking

Run TypeScript type checking without emitting files:

```bash
npm run typecheck
```

### Debugging

Launch the MCP Inspector for interactive debugging:

```bash
npm run inspector
```

## Project Structure

```
interlock_mcp/
├── src/              # TypeScript source files
│   └── index.ts      # Main server entry point
├── build/            # Compiled JavaScript output (git-ignored)
├── node_modules/     # Dependencies (git-ignored)
├── package.json      # Project metadata and dependencies
├── tsconfig.json     # TypeScript configuration
├── .eslintrc.json    # ESLint configuration
├── .prettierrc       # Prettier configuration
└── README.md         # This file
```

## Development Workflow

1. **Build**: Compile TypeScript code with `npm run build`
2. **Test**: Run the server with `npm start` or use `npm run inspector` for debugging
3. **Format**: Ensure code is properly formatted with `npm run format`
4. **Lint**: Check code quality with `npm run lint`

For active development, use `npm run watch` to automatically rebuild on changes.

## Important Notes

### STDIO Transport Logging

This server uses STDIO transport for communication with MCP clients. **Always use `console.error()` for logging**, never `console.log()`. Using `console.log()` will interfere with the protocol communication since stdout is reserved for the MCP protocol messages.

✅ Correct:
```typescript
console.error("Server started");
```

❌ Incorrect:
```typescript
console.log("Server started"); // This will break STDIO communication
```

### Schema Validation

This project uses Zod for schema validation, which is a required peer dependency of the MCP SDK. Schema validation ensures type safety for tool arguments and responses.

### Building Before Running

Always run `npm run build` before executing `npm start`. The server runs the compiled JavaScript from the `build/` directory, not the TypeScript source files directly.

## Adding Tools

To add new tools to your MCP server:

1. Define the tool in the `ListToolsRequestSchema` handler in `src/index.ts`
2. Implement the tool logic in the `CallToolRequestSchema` handler
3. Use Zod schemas for input validation if needed
4. Rebuild with `npm run build`
5. Test with `npm run inspector`

Example tool structure is provided as comments in `src/index.ts`.

## License

MIT
