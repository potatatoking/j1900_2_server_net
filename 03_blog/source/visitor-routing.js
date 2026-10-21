import { BlockList, isIP } from 'node:net';

function normalizeIp(value) {
  if (typeof value !== 'string') return '';
  const ip = value.trim().toLowerCase();
  if (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) return ip.slice(7);
  return isIP(ip) ? ip : '';
}

function addresses(cidrs) {
  const list = new BlockList();
  for (const cidr of cidrs) {
    const [address, prefix, extra] = cidr.split('/');
    const version = isIP(address);
    const bits = prefix === undefined ? (version === 4 ? 32 : 128) : Number(prefix);
    if (!version || extra !== undefined || (prefix !== undefined && !/^\d+$/.test(prefix)) || !Number.isInteger(bits) || bits < 0 || bits > (version === 4 ? 32 : 128)) {
      throw new Error(`Invalid routing CIDR: ${cidr}`);
    }
    list.addSubnet(address, bits, version === 4 ? 'ipv4' : 'ipv6');
  }
  return ip => Boolean(ip && list.check(ip, isIP(ip) === 4 ? 'ipv4' : 'ipv6'));
}

function origin(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Routing destinations must be HTTP(S) origins');
  }
  return url;
}

export function createVisitorRouter(config, chinaCidrs) {
  const proxies = new Set(config.trustedProxyIps.map(normalizeIp));
  if (proxies.has('')) throw new Error('Invalid trusted proxy IP');
  const campus = addresses(config.campusCidrs);
  const mainland = addresses(chinaCidrs);
  const hosts = new Set(config.entryHosts.map(value => value.toLowerCase()));
  const mainlandOrigin = origin(config.mainlandTarget);
  const campusOrigin = origin(config.campusTarget);
  const globalOrigin = config.globalTarget ? origin(config.globalTarget) : null;
  for (const destination of [mainlandOrigin, campusOrigin, globalOrigin]) {
    if (destination) hosts.add(destination.host);
  }

  function clientIp(req) {
    const peer = normalizeIp(req.socket.remoteAddress);
    if (!proxies.has(peer)) return peer;
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded !== 'string') return '';
    return normalizeIp(forwarded.split(',').at(-1));
  }

  function inspect(req, url) {
    const ip = clientIp(req);
    const authority = (req.headers.host || '').toLowerCase();
    const atCampus = authority === campusOrigin.host;
    const region = atCampus || campus(ip) ? 'campus' : mainland(ip) ? 'mainland' : ip ? 'other' : 'unknown';
    let target = null;
    if (!atCampus && hosts.has(authority) && url.searchParams.get('route') !== 'global') {
      const destination = region === 'campus' ? campusOrigin : region === 'mainland' ? mainlandOrigin : region === 'other' ? globalOrigin : null;
      if (destination && new URL(destination.protocol + '//' + authority).origin !== destination.origin) target = destination.origin;
    }
    return { clientIp: ip || null, region, target };
  }

  return (req, res, url) => {
    if (!config.enabled || !['GET', 'HEAD'].includes(req.method)) return false;
    if (url.pathname === '/api/route') {
      const result = JSON.stringify(inspect(req, url));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : result);
      return true;
    }
    if (!['/', '/index.html', '/study', '/study/', '/work', '/work/', '/friends', '/friends/', '/articles', '/articles/', '/admin', '/admin/', '/admin.html'].includes(url.pathname)) return false;
    const { region, target } = inspect(req, url);
    res.setHeader('X-Site-Route', region);
    if (!target) return false;
    res.writeHead(302, { Location: target + url.pathname + url.search, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end();
    return true;
  };
}
