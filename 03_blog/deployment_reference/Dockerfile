FROM scratch
# Verified Node.js 24.22.0 and its existing Debian runtime libraries.
# The archive contains no Claude CLI, website files, or credentials.
ADD runtime-rootfs.tar /
ENV PATH=/opt/node/bin HOME=/home/node NODE_ENV=production PORT=3000 TZ=Asia/Shanghai
USER 1000:1000
WORKDIR /app
EXPOSE 3000
CMD ["node", "server.js"]
