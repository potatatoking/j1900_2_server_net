FROM local/deepseek-harness:0.2.0-rc.2 AS builder
USER root
WORKDIR /build/zcode
COPY cache/source.tar.gz /tmp/zcode-source.tar.gz
RUN echo 'a77cb72315deb872fb7de183111f3b8887e30c4cff5f99e5c23794238899bee3  /tmp/zcode-source.tar.gz' | sha256sum -c - \
    && tar -xzf /tmp/zcode-source.tar.gz --strip-components=1 -C /build/zcode \
    && rm /tmp/zcode-source.tar.gz
ENV CI=true HUSKY=0 ELECTRON_SKIP_BINARY_DOWNLOAD=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN pnpm install --frozen-lockfile --ignore-scripts --reporter=append-only
RUN pnpm exec tsc -b packages/shared \
    && pnpm build:zcode --base-url http://10.42.0.106:3030/distribution/ \
    && mkdir -p /opt/zcode \
    && tar -xzf dist/zcode/releases/3.15.1/zcode-3.15.1.tar.gz --strip-components=1 -C /opt/zcode

FROM local/web:node24.22.0 AS node-runtime
FROM mcr.microsoft.com/devcontainers/base:debian-13@sha256:2e826a6ae92e5744cc0a471a03b4411e64f6b7cc6af3adaecddad697f0018f10
USER root
COPY --from=node-runtime /opt/node/bin/node /usr/local/bin/node
COPY --from=builder /opt/zcode /opt/zcode
COPY entrypoint.sh /usr/local/bin/zcode-container-entrypoint
RUN chmod 755 /usr/local/bin/zcode-container-entrypoint \
    && ln -s /opt/zcode/bin/zcode.mjs /usr/local/bin/zcode \
    && node --version && zcode --version
ENV HOME=/home/vscode ZCODE_DATA_BASE_DIR=/home/vscode TZ=Asia/Shanghai TERM=xterm-256color
USER vscode
WORKDIR /workspace
EXPOSE 3030
ENTRYPOINT ["/usr/local/bin/zcode-container-entrypoint"]
