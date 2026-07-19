import express from "express";
import https from "node:https";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";

import settings from "./settings.json";

export function setRedirectUrlForTest(value: string | null) {
  (settings as any).redirectUrl = value;
}

export const app = express();

function getRedirectTarget(): string | null {
  const value =
    typeof (settings as any).redirectUrl === "string"
      ? (settings as any).redirectUrl.trim()
      : "";

  if (!value) return null;
  try {
    new URL(value);
    return value;
  } catch {
    return null;
  }
}

app.use((req, res) => {
  const redirect = getRedirectTarget();
  if (redirect) {
    console.log(`Redirecting block page to: ${redirect}`);
    return res.redirect(302, redirect);
  }

  return res.sendFile(path.join(__dirname, "block.html"));
});

export function startHttpServer() {
  http.createServer(app).listen(80, "0.0.0.0", () => {
    console.log("HTTP server running on port 80");
  });

  https
    .createServer(
      {
        key: fs.readFileSync("key.pem"),
        cert: fs.readFileSync("cert.pem"),
      },
      app,
    )
    .listen(443, "0.0.0.0", () => {
      console.log("HTTPS server running on port 443");
    });
}
