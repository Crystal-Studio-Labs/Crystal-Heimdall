import net from "net";
import tls from "tls";

export interface PortCheckResult {
  isHealthy: boolean;
  latencyMs: number;
  errorMessage: string;
}

export interface SslCheckResult {
  daysRemaining: number | null;
  validTo?: string;
  issuer?: string;
  error?: string;
}

/**
 * Parses target host, port, and protocol from strings like:
 * - "tcp://127.0.0.1:5432"
 * - "https://api.github.com"
 * - "localhost" with port 3030
 */
export function parseTargetAddress(endpoint: string, defaultPort?: number | null): { host: string; port: number; protocol: string } {
  const trimmed = endpoint.trim();
  
  if (trimmed.startsWith("tcp://")) {
    const withoutScheme = trimmed.replace(/^tcp:\/\//, "");
    const parts = withoutScheme.split(":");
    return {
      host: parts[0] || "127.0.0.1",
      port: parts[1] ? parseInt(parts[1], 10) : (defaultPort || 80),
      protocol: "tcp",
    };
  }

  try {
    const url = new URL(trimmed);
    const isHttps = url.protocol === "https:";
    const port = url.port ? parseInt(url.port, 10) : (isHttps ? 443 : 80);
    return {
      host: url.hostname,
      port: defaultPort || port,
      protocol: url.protocol.replace(":", ""),
    };
  } catch {
    // If not a URL, treat as raw host/IP
    const parts = trimmed.split(":");
    return {
      host: parts[0] || "127.0.0.1",
      port: parts[1] ? parseInt(parts[1], 10) : (defaultPort || 80),
      protocol: "tcp",
    };
  }
}

/**
 * Real TCP port connection check (e.g. Postgres, Redis, Game servers, Web servers)
 * Tests if target socket responds within timeout and measures connection round-trip latency.
 */
export function checkTcpPort(host: string, port: number, timeoutMs = 5000): Promise<PortCheckResult> {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const socket = new net.Socket();
    let settled = false;

    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      if (!settled) {
        settled = true;
        const latencyMs = Math.round(performance.now() - startTime);
        socket.destroy();
        resolve({
          isHealthy: true,
          latencyMs,
          errorMessage: "",
        });
      }
    });

    socket.on("timeout", () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve({
          isHealthy: false,
          latencyMs: Math.round(performance.now() - startTime),
          errorMessage: `Connection timeout (> ${timeoutMs}ms)`,
        });
      }
    });

    socket.on("error", (err: any) => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve({
          isHealthy: false,
          latencyMs: Math.round(performance.now() - startTime),
          errorMessage: err.code === "ECONNREFUSED" ? `Port ${port} connection refused` : err.message,
        });
      }
    });
  });
}

/**
 * Real TLS / SSL Certificate Inspector
 * Connects to remote HTTPS server, reads actual valid_to date, and computes days to expiry.
 */
export function checkSslExpiry(hostname: string, port = 443, timeoutMs = 6000): Promise<SslCheckResult> {
  return new Promise((resolve) => {
    try {
      const socket = tls.connect(
        {
          host: hostname,
          port,
          servername: hostname,
          rejectUnauthorized: false, // allows checking days remaining even on self-signed or staging certs
          timeout: timeoutMs,
        },
        () => {
          const cert = socket.getPeerCertificate();
          socket.destroy();

          if (cert && cert.valid_to) {
            const expiryDate = new Date(cert.valid_to);
            const daysRemaining = Math.round((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const issuerRaw = cert.issuer?.O || cert.issuer?.CN;
            const issuer = Array.isArray(issuerRaw) ? issuerRaw.join(", ") : (issuerRaw || undefined);
            resolve({
              daysRemaining,
              validTo: cert.valid_to,
              issuer,
            });
          } else {
            resolve({
              daysRemaining: null,
              error: "No peer SSL certificate returned",
            });
          }
        }
      );

      socket.on("timeout", () => {
        socket.destroy();
        resolve({
          daysRemaining: null,
          error: "SSL handshake timeout",
        });
      });

      socket.on("error", (err) => {
        socket.destroy();
        resolve({
          daysRemaining: null,
          error: err.message,
        });
      });
    } catch (err: any) {
      resolve({
        daysRemaining: null,
        error: err.message,
      });
    }
  });
}
