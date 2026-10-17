FROM mcr.microsoft.com/devcontainers/base:debian-13@sha256:2e826a6ae92e5744cc0a471a03b4411e64f6b7cc6af3adaecddad697f0018f10

# Anthropic's official linux-x64 package contains the standalone native CLI.
# Verify the npm registry's SHA-512 integrity value before extracting it.
USER root
RUN curl --fail --show-error --location --retry 3 --connect-timeout 15 --max-time 600 \
      https://registry.npmjs.org/@anthropic-ai/claude-code-linux-x64/-/claude-code-linux-x64-2.1.300.tgz \
      --output /tmp/claude-code.tgz \
    && printf '%s  %s\n' \
      a16e3f8b880177463bbea293a0af9168efdf666e28656000f35089d6cd1a7e0f9b3fe387f5025d3972830f043d7a2cdc57bf1ae3899001b71ee5662c375f0203 \
      /tmp/claude-code.tgz | sha512sum --check --strict \
    && mkdir -p /opt/claude-code \
    && tar -xzf /tmp/claude-code.tgz -C /opt/claude-code --strip-components=1 \
    && install -m 0755 /opt/claude-code/claude /usr/local/bin/claude \
    && rm -f /tmp/claude-code.tgz /opt/claude-code/claude

ENV CLAUDE_CONFIG_DIR=/home/vscode/.claude \
    DISABLE_AUTOUPDATER=1 \
    TZ=America/Denver \
    LANG=en_US.UTF-8 \
    LANGUAGE=en_US:en \
    LC_ALL=en_US.UTF-8 \
    TERM=xterm-256color

USER vscode
WORKDIR /workspace
RUN claude --version

# Installation must not trigger an account login or a model request.
CMD ["sleep", "infinity"]
