export type ServiceInfo = {
  name: string;
  description: string;
  activeState: string;
  subState: string;
  mainPid: number | null;
  since: string | null;
  workingDirectory: string | null;
  execPath: string | null;
};

export const SYSV_MARKER = '@@EDUSTACK_SYSV@@';

const SHOW_PROPERTIES =
  'Id,Description,LoadState,ActiveState,SubState,MainPID,ActiveEnterTimestamp,ExecStart,WorkingDirectory,FragmentPath,SourcePath';

// Executado com "bash -s" (o script vai pelo stdin). Não precisa de sudo.
// list-unit-files garante que serviços parados e não carregados continuem aparecendo.
export const DISCOVERY_SCRIPT = `
UNITS=$( { systemctl list-units --type=service --all --no-legend --plain 2>/dev/null | awk '{print $1}'; systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk '{print $1}'; } | grep -E '\\.service$' | grep -v '@\\.service$' | sort -u )
if [ -n "$UNITS" ]; then
  systemctl show $UNITS --no-pager -p ${SHOW_PROPERTIES}
fi
echo "${SYSV_MARKER}"
grep -l '/opt/' /etc/init.d/* 2>/dev/null || true
`;

const OPT = '/opt/';

function parseBlocks(text: string): Record<string, string>[] {
  return text
    .split(/\r?\n[ \t]*\r?\n/)
    .map((block) => {
      const record: Record<string, string> = {};
      for (const line of block.split(/\r?\n/)) {
        const eq = line.indexOf('=');
        if (eq > 0) record[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
      }
      return record;
    })
    .filter((record) => Boolean(record['Id']));
}

function extractExecPath(execStart: string): string | null {
  return /path=([^\s;]+)/.exec(execStart)?.[1] ?? null;
}

export function parseServiceDiscovery(output: string): ServiceInfo[] {
  const [showPart = '', sysvPart = ''] = output.split(SYSV_MARKER);
  const sysvScripts = new Set(
    sysvPart.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
  );

  const services: ServiceInfo[] = [];
  for (const record of parseBlocks(showPart)) {
    if (record['LoadState'] === 'not-found') continue;

    const execStart = record['ExecStart'] ?? '';
    const workingDirectory = record['WorkingDirectory'] || null;
    const underOpt =
      execStart.includes(OPT) ||
      (workingDirectory?.includes(OPT) ?? false) ||
      (record['FragmentPath'] ?? '').includes(OPT) ||
      sysvScripts.has(record['SourcePath'] ?? '');
    if (!underOpt) continue;

    const pid = Number(record['MainPID']);
    const since = record['ActiveEnterTimestamp'];
    services.push({
      name: record['Id'] as string,
      description: record['Description'] ?? '',
      activeState: record['ActiveState'] ?? 'unknown',
      subState: record['SubState'] ?? '',
      mainPid: Number.isFinite(pid) && pid > 0 ? pid : null,
      since: since && since !== 'n/a' ? since : null,
      workingDirectory,
      execPath: extractExecPath(execStart),
    });
  }

  return services.sort((a, b) => a.name.localeCompare(b.name));
}

const SERVICE_NAME = /^[A-Za-z0-9@._-]+$/;

export function normalizeServiceName(raw: string): string | null {
  if (!raw) return null;
  const name = raw.endsWith('.service') ? raw : `${raw}.service`;
  if (name.startsWith('-') || !SERVICE_NAME.test(name)) return null;
  return name;
}

export const LOG_LINE_OPTIONS: readonly number[] = [100, 500, 1000];

export function normalizeLogLines(raw: unknown): number {
  const value = Number(raw);
  return LOG_LINE_OPTIONS.includes(value) ? value : 500;
}

export function isSudoAuthFailure(stderr: string): boolean {
  return /incorrect password|sorry, try again|a password is required/i.test(stderr);
}
