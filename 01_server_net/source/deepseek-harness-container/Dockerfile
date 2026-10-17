FROM local/web:node24.22.0 AS node-runtime
FROM mcr.microsoft.com/devcontainers/base:debian-13@sha256:2e826a6ae92e5744cc0a471a03b4411e64f6b7cc6af3adaecddad697f0018f10

USER root
COPY --from=node-runtime /opt/node/bin/node /usr/local/bin/node
COPY cache/pnpm-10.32.1.tgz /tmp/pnpm.tgz
COPY cache/dsh-0.2.0-rc.2.tgz /tmp/dsh.tgz
RUN printf '%s  %s\n' \
      a706938f0e89ac1456b6563eab4edf1d1faf3368d1191fc5c59790e96dc918e4456ab2e67d613de1043d2e8c81f87303e6b40d4ffeca9df15ef1ad567348f2be /tmp/pnpm.tgz \
      10027780f35c56dfeebfc5f5f4f326f4d915856813ef15cd324d14282566f88439ae949039cb0c51ad075a59d8615c9b28cb1c723711076d6f555b1a5d0e8874 /tmp/dsh.tgz \
      | sha512sum --check --strict \
    && mkdir -p /opt/pnpm /opt/dsh \
    && tar -xzf /tmp/pnpm.tgz -C /opt/pnpm --strip-components=1 \
    && ln -s /opt/pnpm/bin/pnpm.cjs /usr/local/bin/pnpm \
    && ln -s /opt/pnpm/bin/pnpx.cjs /usr/local/bin/pnpx \
    && chmod +x /opt/pnpm/bin/*.cjs

WORKDIR /opt/dsh
COPY package.json pnpm-workspace.yaml ./
RUN pnpm install --prod --reporter=append-only \
    && ln -s /opt/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js /usr/local/bin/dsh \
    && rm /tmp/pnpm.tgz /tmp/dsh.tgz \
    && node --version && pnpm --version && dsh --version

ENV DSH_HOME=/home/vscode/.dsh HOME=/home/vscode TZ=Asia/Shanghai TERM=xterm-256color
USER vscode
WORKDIR /workspace
EXPOSE 3080
CMD ["dsh", "web", "--no-open"]
