FROM mcr.microsoft.com/devcontainers/base:debian-13@sha256:2e826a6ae92e5744cc0a471a03b4411e64f6b7cc6af3adaecddad697f0018f10

USER root
RUN --mount=type=bind,source=cache/codex-0.162.1-linux-x64.tgz,target=/tmp/codex.tgz \
    printf '%s  %s\n' \
      7232b699d1c87c47a9675950d4c5f7693402fbc9dc22cbe769c97feaf23674821c7cff3f32b853436faa46591714d0f32528f5777eaab88b333fedffe0250959 \
      /tmp/codex.tgz | sha512sum --check --strict \
    && mkdir -p /opt/codex \
    && tar -xzf /tmp/codex.tgz -C /opt/codex --strip-components=3 \
      package/vendor/x86_64-unknown-linux-musl \
    && ln -s /opt/codex/bin/codex /usr/local/bin/codex

ENV CODEX_HOME=/home/vscode/.codex \
    TZ=America/Denver \
    LANG=en_US.UTF-8 \
    LANGUAGE=en_US:en \
    LC_ALL=en_US.UTF-8 \
    PATH=/opt/codex/codex-path:${PATH} \
    TERM=xterm-256color

USER vscode
WORKDIR /workspace
RUN codex --version && rg --version
CMD ["sleep", "infinity"]
