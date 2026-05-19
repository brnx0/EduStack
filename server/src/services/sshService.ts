import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';

interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export function uploadFile(config: SSHConfig, localPath: string, remotePath: string): Promise<void> {
  const tmpRemote = `/tmp/edustack-upload-${Date.now()}-${path.basename(remotePath)}`;
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) { conn.end(); return reject(err); }

        const readStream = fs.createReadStream(localPath);
        const writeStream = sftp.createWriteStream(tmpRemote);

        writeStream.on('close', () => {
          const remoteDir = path.posix.dirname(remotePath);
          const cmd = `echo '${config.password}' | sudo -S bash -c 'mkdir -p "${remoteDir}" && mv "${tmpRemote}" "${remotePath}" && chmod 644 "${remotePath}"'`;
          conn.exec(cmd, { pty: true }, (execErr, stream) => {
            if (execErr) { conn.end(); return reject(execErr); }
            let output = '';
            stream.on('data', (data: Buffer) => { output += data.toString(); });
            stream.stderr.on('data', (data: Buffer) => { output += data.toString(); });
            stream.on('close', (code: number) => {
              conn.end();
              if (code !== 0) reject(new Error(`sudo mv failed (code ${code}): ${output}`));
              else resolve();
            });
          });
        });
        writeStream.on('error', (e: Error) => { conn.end(); reject(e); });
        readStream.pipe(writeStream);
      });
    });
    conn.on('error', reject);
    conn.connect(config);
  });
}

export function execCommand(config: SSHConfig, command: string, usePty = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      const run = () => {
        conn.exec(command, { pty: usePty }, (err, stream) => {
          if (err) { conn.end(); return reject(err); }
          let output = '';
          let errorOutput = '';
          stream.on('data', (data: Buffer) => { output += data.toString(); });
          stream.stderr.on('data', (data: Buffer) => { errorOutput += data.toString(); });
          stream.on('close', (code: number) => {
            conn.end();
            if (code !== 0) {
              reject(new Error(`Command exited with code ${code}: ${errorOutput || output}`));
            } else {
              resolve(output);
            }
          });
        });
      };
      run();
    });
    conn.on('error', reject);
    conn.connect(config);
  });
}

export async function deployJar(
  config: SSHConfig,
  localJarPath: string,
  remoteBasePath: string,
  jarFileName: string,
  serviceName: string
): Promise<{ uploaded: boolean; restarted: boolean; output: string }> {
  const remotePath = path.posix.join(remoteBasePath, jarFileName);

  await uploadFile(config, localJarPath, remotePath);

  const restartOutput = await execCommand(config, `echo '${config.password}' | sudo -S service ${serviceName} restart`, true);

  return { uploaded: true, restarted: true, output: restartOutput };
}
