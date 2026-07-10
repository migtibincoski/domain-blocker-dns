import os from "node:os";
import dns from "node:dns/promises";
import { createServer, Packet } from "dns2";
import { watch } from "node:fs";

import settings from "./settings.json";

let cachedBlockedDomains: string[] = [];
let cachedSettings: typeof settings = settings;
const localAddress = getLocalAddress();

function getUpstreamServers(): string[] {
  const dnsConfig = cachedSettings.dns;
  if (!Array.isArray(dnsConfig) || dnsConfig.length === 0) {
    console.error("No upstream DNS servers configured.");
    process.exit(1);
  }
  return dnsConfig.map((s) => String(s));
}

async function queryUpstream(domain: string, type: number): Promise<string[]> {
  const servers = getUpstreamServers();
  let lastError = new Error("No upstream DNS servers succeeded");

  for (const server of servers) {
    try {
      const resolver = new dns.Resolver();
      resolver.setServers([server]);

      if (type === Packet.TYPE.A) {
        const ips = await resolver.resolve4(domain);
        if (ips.length > 0) return ips;
      } else if (type === Packet.TYPE.AAAA) {
        const ips = await resolver.resolve6(domain);
        if (ips.length > 0) return ips;
      }
    } catch (err) {
      console.warn(
        `Upstream DNS ${server} failed for ${domain}:`,
        (err as Error).message,
      );
      lastError = err as Error;
    }
  }

  throw lastError;
}

export function startDnsServer() {
  setupSettingsWatcher();

  const server = createServer({
    udp: true,
    tcp: true,

    handle: async (request, send) => {
      const response = Packet.createResponseFromRequest(request);

      try {
        for (const q of request.questions) {
          const question = q as any;
          const domain = question.name.toLowerCase();
          const type = question.type;
          console.log(`Query: ${domain}`);

          if (isBlocked(domain)) {
            console.log(`Blocked domain: ${domain}`);

            if (type === Packet.TYPE.A) {
              response.answers.push({
                name: domain,
                type: Packet.TYPE.A,
                class: Packet.CLASS.IN,
                ttl: 300,
                address: localAddress,
                toBuffer: () =>
                  Buffer.from(localAddress.split(".").map(Number)),
              });
            } else if (type === Packet.TYPE.AAAA) {
              response.answers.push({
                name: domain,
                type: Packet.TYPE.AAAA,
                class: Packet.CLASS.IN,
                ttl: 300,
                address: "::1",
                toBuffer: () => Buffer.alloc(16, 0),
              });
            }

            continue;
          }

          try {
            if (type === Packet.TYPE.A) {
              const ips = await queryUpstream(domain, Packet.TYPE.A);

              for (const ip of ips) {
                response.answers.push({
                  name: domain,
                  type: Packet.TYPE.A,
                  class: Packet.CLASS.IN,
                  ttl: 300,
                  address: ip,
                  toBuffer: () => Buffer.from(ip.split(".").map(Number)),
                });
              }
            } else if (type === Packet.TYPE.AAAA) {
              const ips = await queryUpstream(domain, Packet.TYPE.AAAA);

              for (const ip of ips) {
                response.answers.push({
                  name: domain,
                  type: Packet.TYPE.AAAA,
                  class: Packet.CLASS.IN,
                  ttl: 300,
                  address: ip,
                  toBuffer: () =>
                    Buffer.from(
                      ip
                        .split(":")
                        .filter(Boolean)
                        .map((x) => parseInt(x, 16)),
                    ),
                });
              }
            }
          } catch (err) {
            console.error(
              "DNS server error querying upstream for:",
              domain,
              err,
            );
          }
        }

        send(response);
      } catch (err) {
        console.error("DNS server error:", err);
      }
    },
  });

  server.listen({
    udp: {
      port: 53,
      address: "0.0.0.0",
    },

    tcp: {
      port: 53,
      address: "0.0.0.0",
    },
  });

  console.log("DNS server running on port 53");
}

function loadBlockedDomains(): string[] {
  const content: string[] | undefined = cachedSettings.blockedDomains;
  const domains: string[] = [];

  if (!content) return [];
  if (!Array.isArray(content)) {
    console.error(
      "Invalid blockedDomains configuration in settings.json. It should be an array, ignoring.",
    );
    return [];
  }

  for (const raw of content) {
    if (typeof raw !== "string") {
      console.error(
        `Invalid input in blockedDomains configuration, ignoring: ${raw}`,
      );
      continue;
    }

    const domain = raw.trim().toLowerCase();
    if (!domain) continue;

    if (!isValidDomainPattern(domain)) {
      console.error(
        `Invalid domain pattern in blockedDomains, ignoring: ${raw}`,
      );
      continue;
    }

    domains.push(domain);
  }

  return domains;
}

function isValidDomainPattern(value: string): boolean {
  if (!value) return false;

  if (value.startsWith("*.")) {
    const base = value.slice(2);
    return isValidDomain(base);
  }

  return isValidDomain(value);
}

function isValidDomain(domain: string): boolean {
  if (!domain) return false;
  if (domain.startsWith("*.")) return false;

  try {
    new URL(`http://${domain}`);
    return true;
  } catch {
    return false;
  }
}

export function isBlocked(domain: string): boolean {
  cachedBlockedDomains = loadBlockedDomains();
  domain = domain.toLowerCase();

  for (const pattern of cachedBlockedDomains) {
    if (!pattern.startsWith("*.")) {
      if (domain === pattern) return true;
      continue;
    }

    const base = pattern.slice(2);
    if (domain === base || domain.endsWith("." + base)) return true;
  }

  return false;
}

function setupSettingsWatcher() {
  try {
    const watcher = watch("src/settings.json", () => {
      try {
        const raw = require("node:fs").readFileSync(
          "src/settings.json",
          "utf-8",
        );
        cachedSettings = JSON.parse(raw);
        cachedBlockedDomains = [];
        console.log("Settings reloaded from settings.json");
      } catch (err) {
        console.error("Failed to reload settings.json:", err);
      }
    });

    console.log("Settings watcher started");
  } catch (err) {
    console.warn("Could not start settings watcher:", (err as Error).message);
  }
}

function getLocalAddress(): string {
  const interfaces = os.networkInterfaces();

  for (const name in interfaces) {
    const iface = interfaces[name];
    if (!iface) continue;

    for (const net of iface) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }

  throw new Error(
    "Local IPv4 address not found. Please check your network configuration.",
  );
}
