import { execSync, spawnSync } from "child_process";
import readline from "readline";
import os from "os";

const ports = [53, 80, 443];
const isWindows = os.platform() === "win32";

// --- Validação de Privilégios (Sudo / Administrator) ---
function hasAdminPrivileges() {
  if (isWindows) {
    try {
      // Teste clássico no Windows: tenta ler uma pasta protegida do sistema
      execSync("net session", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  } else {
    // No Linux/Mac, o ID do usuário root é sempre 0
    return process.getuid && process.getuid() === 0;
  }
}

function elevatePrivileges() {
  console.warn(
    "\x1b[33m%s\x1b[0m",
    "⚠️ This command requires Administrator/Sudo privileges. Elevating...",
  );

  if (isWindows) {
    // Reinicia o script abrindo uma nova janela do PowerShell como Administrador
    const result = spawnSync(
      "powershell",
      [
        "-Command",
        `Start-Process node -ArgumentList '"${process.argv[1]}"' -Verb RunAs -Wait`,
      ],
      { stdio: "inherit" },
    );
    process.exit(result.status);
  } else {
    // Reinicia o script no terminal atual pedindo a senha do sudo
    const result = spawnSync("sudo", ["node", process.argv[1]], {
      stdio: "inherit",
    });
    process.exit(result.status);
  }
}

// Executa a checagem antes de exibir o prompt
if (!hasAdminPrivileges()) {
  elevatePrivileges();
}

// --- Fluxo Principal do Script ---
console.info(
  "\x1b[36m%s\x1b[0m",
  "ℹ️ Privilege check passed. Ready to scan ports.",
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question(
  "Do you want to terminate the processes on ports 53, 80, and 443? [Y,N]: ",
  (answer) => {
    if (answer.toUpperCase() === "Y") {
      ports.forEach((port) => {
        console.log(`\n🔎 Checking port ${port}...`);
        let terminated = false;

        try {
          if (isWindows) {
            const stdout = execSync(`netstat -ano`).toString();
            const lines = stdout.split("\n");

            lines.forEach((line) => {
              if (line.includes(`:${port} `) || line.includes(`:${port}\t`)) {
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (pid && !isNaN(pid)) {
                  console.warn(
                    `⚠️ Found process with PID ${pid} on port ${port}. Terminating...`,
                  );
                  execSync(`taskkill /F /PID ${pid} 2>nul`);
                  terminated = true;
                }
              }
            });
          } else {
            // Mac / Linux
            const pidOutput = execSync(`lsof -t -i:${port}`, {
              stdio: ["pipe", "pipe", "ignore"],
            })
              .toString()
              .trim();
            if (pidOutput) {
              pidOutput.split("\n").forEach((pid) => {
                console.warn(
                  `⚠️ Found process with PID ${pid} on port ${port}. Terminating...`,
                );
                execSync(`kill -9 ${pid}`);
                terminated = true;
              });
            }
          }

          if (terminated) {
            console.info(`✅ Port ${port} has been cleared.`);
          } else {
            console.log(`ℹ️ Port ${port} is already free. No process found.`);
          }
        } catch (e: any) {
          console.error(
            `❌ Error trying to clear port ${port}:`,
            e.message || e,
          );
        }
      });

      console.info("\x1b[32m%s\x1b[0m", "\n🎉 Script execution finished.");
    } else {
      console.warn("\x1b[31m%s\x1b[0m", "❌ Operation cancelled by user.");
    }
    rl.close();
  },
);
