#!/usr/bin/env node

import { spawn } from 'child_process';
import { join } from 'path';
import http from 'http';

const ROOT = process.cwd();
const PORT = 3001;

console.log(`
╔══════════════════════════════════════════╗
║     🚀 Career-Ops Elite Dashboard       ║
║         AI Job Search Pipeline           ║
╚══════════════════════════════════════════╝
`);

// Start the API + static server
const server = spawn('node', ['server.mjs'], { stdio: 'inherit', cwd: ROOT });

// Once server is up, open the browser
function waitForServer(retries = 10) {
    setTimeout(() => {
        const req = http.get(`http://localhost:${PORT}/`, (res) => {
            if (res.statusCode === 200) {
                const url = `http://localhost:${PORT}`;
                console.log(`\n✅ Dashboard ready at ${url}`);
                // Open browser
                const platform = process.platform;
                const cmd = platform === 'win32' ? 'start' :
                            platform === 'darwin' ? 'open' : 'xdg-open';
                spawn(cmd, [url], { stdio: 'ignore', detached: true });
            }
        });
        req.on('error', () => {
            if (retries > 0) {
                process.stdout.write('.');
                waitForServer(retries - 1);
            } else {
                console.log('\n⚠️  Server didn\'t start. Try: node server.mjs');
            }
        });
        req.end();
    }, 500);
}

waitForServer();

// Graceful shutdown
process.on('SIGINT', () => {
    server.kill();
    process.exit(0);
});
