import type { ManagedMcpServer } from '../../../core/types';
import { getMcpServerType, isValidMcpServerConfig } from '../../../core/types';
import type { AcpEnvVariable, AcpHttpHeader, AcpMcpServer } from '../types';

/** Converts Grimoire's generic MCP records to the ACP session configuration. */
export function toAcpMcpServers(servers: ManagedMcpServer[]): AcpMcpServer[] {
  const converted: AcpMcpServer[] = [];

  for (const server of servers) {
    if (!server.enabled || !isValidMcpServerConfig(server.config)) continue;

    const type = getMcpServerType(server.config);
    if (type === 'stdio') {
      if (!('command' in server.config) || typeof server.config.command !== 'string') continue;
      converted.push({
        name: server.name,
        command: server.config.command,
        args: Array.isArray(server.config.args)
          ? server.config.args.filter((arg): arg is string => typeof arg === 'string')
          : [],
        env: toAcpEnvVariables(server.config.env),
      });
      continue;
    }

    if (!('url' in server.config) || typeof server.config.url !== 'string') continue;
    const remoteServer = {
      name: server.name,
      url: server.config.url,
      headers: toAcpHttpHeaders(server.config.headers),
    };
    if (type === 'sse') {
      converted.push({ type: 'sse', ...remoteServer });
    } else {
      converted.push({ type: 'http', ...remoteServer });
    }
  }

  return converted;
}

function toAcpEnvVariables(env: Record<string, string> | undefined): AcpEnvVariable[] | undefined {
  const values = toNamedValues(env);
  return values.length > 0 ? values : undefined;
}

function toAcpHttpHeaders(headers: Record<string, string> | undefined): AcpHttpHeader[] | undefined {
  const values = toNamedValues(headers);
  return values.length > 0 ? values : undefined;
}

function toNamedValues(values: Record<string, string> | undefined): Array<{ name: string; value: string }> {
  if (!values) return [];
  return Object.entries(values)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([name, value]) => ({ name, value }));
}
