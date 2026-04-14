const { execSync } = require('child_process');
const { getRuntimeConfig } = require('./runtime-config');

const runtimeConfig = getRuntimeConfig();
const port = Number(process.argv[2] || runtimeConfig.port || 3001);

function run(command) {
    return execSync(command, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
    });
}

function freePortWindows(targetPort) {
    let output = '';

    try {
        output = run(`netstat -ano | findstr :${targetPort}`);
    } catch (error) {
        return;
    }

    const pids = new Set();
    for (const line of output.split(/\r?\n/)) {
        if (!line.includes('LISTENING')) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid)) {
            pids.add(pid);
        }
    }

    for (const pid of pids) {
        try {
            console.log(`[free-port] Encerrando PID ${pid} na porta ${targetPort}`);
            execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        } catch (error) {
            console.warn(`[free-port] Falha ao encerrar PID ${pid}: ${error.message}`);
        }
    }
}

function freePortUnix(targetPort) {
    let output = '';

    try {
        output = run(`lsof -ti tcp:${targetPort}`);
    } catch (error) {
        return;
    }

    for (const pid of output.split(/\r?\n/).map(value => value.trim()).filter(Boolean)) {
        try {
            console.log(`[free-port] Encerrando PID ${pid} na porta ${targetPort}`);
            process.kill(Number(pid), 'SIGKILL');
        } catch (error) {
            console.warn(`[free-port] Falha ao encerrar PID ${pid}: ${error.message}`);
        }
    }
}

if (process.platform === 'win32') {
    freePortWindows(port);
} else {
    freePortUnix(port);
}
