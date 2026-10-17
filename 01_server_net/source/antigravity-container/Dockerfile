FROM mcr.microsoft.com/devcontainers/base:debian-13@sha256:2e826a6ae92e5744cc0a471a03b4411e64f6b7cc6af3adaecddad697f0018f10

USER root
COPY cache/agy-1.3.5-linux-x64.tar.gz /tmp/agy.tar.gz
RUN printf '%s  %s\n' \
      0fa5ff7ca8661ef6379da219dd30552327b0deaf112ea896882daaba8bd6abff76ff097ef7b38211bffb78be6871f7494a1739b7160b483cb68481a24d435c47 \
      /tmp/agy.tar.gz | sha512sum --check --strict \
    && mkdir -p /opt/antigravity \
    && tar -xzf /tmp/agy.tar.gz -C /opt/antigravity antigravity \
    && chmod 0755 /opt/antigravity/antigravity \
    && ln -s /opt/antigravity/antigravity /usr/local/bin/agy \
    && rm /tmp/agy.tar.gz

ENV HOME=/home/vscode TZ=America/Denver LANG=en_US.UTF-8 LANGUAGE=en_US:en LC_ALL=en_US.UTF-8 TERM=xterm-256color
USER vscode
WORKDIR /workspace
RUN agy --version
CMD ["sleep", "infinity"]
